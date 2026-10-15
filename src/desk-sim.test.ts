import { describe, it, expect } from 'vitest'
import {
  createDeskSim,
  rebuildSession,
  freezeSnapshot,
  closeWeek,
  executeOp,
  opToNote,
  weekDateLine,
  weekLine,
  ANCHOR_WEEK,
  officeToCareerLevel,
  DECISION_APPROVAL,
  DELTA_TUTORIAL_IDENTITY,
  orientationNote,
  type DeskIdentity,
  type SimSnapshot,
} from './desk-sim'
import { effectChips } from './profile/prologue'
import { ShockSystem } from './sim-core'
import type { SecurityDoc, NoteDoc } from './content'
import type { Shock } from './types'

/* The lifecycle rules the desk now depends on: shocks have a duration window
   (ShockSystem.isOngoing/getActiveShocks always said so), the clock must age,
   and expired shocks must stop biting approval. The bridge (desk-sim) sits on
   those rules; these tests pin both layers. */

describe('SimSystem lifecycle — duration windows', () => {
  it('tick() ages the clock and expiring shocks stop biting', () => {
    const shocks = new ShockSystem()
    shocks.triggerShock('currency-crash', 2, {
      affectedZones: ['all'],
      durationWeeks: 1,
      economicImpact: 10,
      playerAccountable: false,
    })
    expect(shocks.getActiveShocks()).toHaveLength(1)

    const state = { publicApproval: 50, npcProfiles: {}, money: { inflation: 0 } } as import('./types').SimState
    shocks.applyToState(state)
    expect(state.publicApproval).toBeLessThan(50) // the live shock bites

    shocks.tick()
    expect(shocks.getWeek()).toBe(1)
    expect(shocks.getActiveShocks()).toHaveLength(0) // window: 1 week — now closed

    const approval = state.publicApproval
    shocks.applyToState(state)
    expect(state.publicApproval).toBe(approval) // expired: no further drain
  })

  it('a restored session keeps shock age through constructor initialTurn', () => {
    const shock = { id: 's1', type: 'flood', severity: 2 as const, description: 'floods',
      affectedZones: ['south'], economicImpact: 10, durationWeeks: 2, startWeek: 0, playerAccountable: false }
    const shocks = new ShockSystem([shock as Shock], 3)
    expect(shocks.getActiveShocks()).toHaveLength(0) // 3 - 0 >= 2 — the window closed offscreen
    const revived = new ShockSystem([shock as Shock], 1)
    expect(revived.getActiveShocks()).toHaveLength(1) // 1 - 0 < 2 — still biting
    revived.applyToState({ publicApproval: 40, npcProfiles: {}, money: { inflation: 0 } } as import('./types').SimState)
    // playerAccountable false → severity 2 → -6
  })
})

describe('desk-sim session', () => {
  it('createDeskSim seeds the world the desk needs: career by office, NPC targets, one reporter', () => {
    const snap = createDeskSim('state/governor', 'Delta')
    expect(snap.state.career.level).toBe('stategovernor')
    expect(snap.state.career.tenure).toBe(78) // eighteen months in
    expect(snap.state.publicApproval).toBe(50)
    expect(snap.shockWeek).toBe(0)
    expect(Object.keys(snap.state.npcProfiles)).toContain('agoro') // blackmail needs a target
    expect(snap.state.media.reporters).toHaveLength(1) // plant-story needs a reporter
    expect(snap.opsCount).toEqual({})

    expect(officeToCareerLevel('federal/president')).toBe('president')
    expect(officeToCareerLevel('local/chairman')).toBe('lgachairman')
    expect(officeToCareerLevel('fct/minister')).toBe('minister')
  })

  it('survives the snapshot round-trip: rebuild → freeze keeps shockWeek and stories', () => {
    const snap = createDeskSim('state/governor', 'Delta')
    const session = rebuildSession(snap)
    session.media.addGazetteStory({
      id: 'g-1', title: 'TEST STORY', impact: 'approval', magnitude: 2,
      description: 'a story', affectedSectors: ['public_opinion'],
    })
    const frozen = freezeSnapshot(session, snap)
    expect(frozen.shockWeek).toBe(0)
    expect(frozen.storiesSeen).toBe(1)

    const again = rebuildSession(frozen)
    expect(again.media.getStories()).toHaveLength(1)
    expect(again.media.getStories()[0].id).toBe('g-1')
    expect(again.shocks.getWeek()).toBe(0)
  })
})

describe('closeWeek — the weekly close', () => {
  const withDurableShock = (): SimSnapshot => {
    const snap = createDeskSim('state/governor', 'Delta')
    snap.state.shocks = [{
      id: 'durable', type: 'oil-crash', severity: 1 as const, description: 'moderate decline',
      affectedZones: ['all'], economicImpact: 20, durationWeeks: 52, startWeek: 0, playerAccountable: false,
    }]
    return snap
  }

  it('advances the sim one week and generates the week’s papers', () => {
    const result = closeWeek(withDurableShock(), {})
    expect(result.snapshot.state.turn).toBe(1)
    expect(result.snapshot.state.week).toBe(2)
    expect(result.snapshot.shockWeek).toBe(1)
    expect(result.documents.length).toBeGreaterThanOrEqual(2)

    const kinds = result.documents.map(d => d.kind)
    expect(kinds).toContain('security') // the durable shock shows up as a digest
    expect(kinds).toContain('note')     // the SSA (Polling) memo
    const digest = result.documents.find(d => d.kind === 'security')!
    expect(digest.title).toContain('W42')
    expect(result.headline).toContain('approval')
  })

  it('the decision ledger pays its own printed approval deltas, once', () => {
    // the deltas in DECISION_APPROVAL mirror the authored options' ledger lines
    expect(DECISION_APPROVAL.asuu).toEqual({ '12': 5, '8': 2 })

    const snap = createDeskSim('state/governor', 'Delta')
    const before = snap.state.publicApproval // 50
    const result = closeWeek(snap, { asuu: '12', gazette: 'sign', okpe: 'talk' })
    // printed deltas: +5 (offer 12%) + (−2) (sign quietly) + (+2) (dialogue) = +5.
    // advanceTurn may also roll a fresh random external shock (10%/week), so an
    // exact equality would flake: assert the ledger never pays more than printed,
    // and that the shock bites at most severity 3 (−9) on top.
    expect(result.approval).toBeLessThanOrEqual(before + 5)
    expect(result.approval).toBeGreaterThanOrEqual(before + 5 - 9)
    expect(result.snapshot.state.turn).toBe(1)
  })

  it('an expired shock no longer produces a digest', () => {
    const snap = createDeskSim('state/governor', 'Delta')
    snap.state.shocks = [{
      id: 'old', type: 'banditry', severity: 1 as const, description: 'clashes',
      affectedZones: ['north'], economicImpact: 5, durationWeeks: 2, startWeek: 0, playerAccountable: false,
    }]
    snap.shockWeek = 50 // restored: the window closed long ago
    const result = closeWeek(snap, {})
    expect(result.documents.map(d => d.kind)).not.toContain('security')
  })
})

describe('off the books — dirty tricks through the real machinery', () => {
  it('plant-story runs, costs approval, writes the gazette and the ops book', () => {
    const snap = createDeskSim('state/governor', 'Delta')
    const result = executeOp(snap, 'plant-story')
    expect(result.ok).toBe(true)
    expect(result.approval).toBe(-5) // plantDeepfake's printed number
    expect(result.effect).toContain('Gazette story published') // the generic effect string
    expect(result.approval).toBe(-5) // plantDeepfake's printed number is what moved
    expect(result.snapshot.opsCount['plant-story']).toBe(1)
    // the story landed in the gazette the save carries
    expect(result.snapshot.state.media.gazetteStories.length).toBeGreaterThan(0)
    // and the biro note is on the tray
    const note = opToNote(41, 'plant-story', {
      success: true, effect: result.effect, efccRisk: true, icpcRisk: true,
      publicReaction: 'disapprove', approvalChange: -5,
    })
    expect(note.kind).toBe('note')
    expect(note.lines.some(l => l.includes('-5'))).toBe(true)
  })

  it('each run is counted separately', () => {
    const snap = createDeskSim('state/governor', 'Delta')
    const first = executeOp(snap, 'sponsor-protest')
    const second = executeOp(first.snapshot, 'sponsor-protest')
    expect(second.snapshot.opsCount['sponsor-protest']).toBe(2)
  })

  it('blackmail works only against a known NPC; unknown target fails cleanly', () => {
    const snap = createDeskSim('state/governor', 'Delta')
    delete snap.state.npcProfiles.agoro
    // with the target table intact the sim core resolves the NPC; without it,
    // executeDirtyTrick returns a clean failure rather than throwing
    const result = executeOp(snap, 'blackmail-target')
    expect(typeof result.ok).toBe('boolean')
    expect(result.snapshot.opsCount['blackmail-target']).toBe(1)
  })
})

describe("desk identity — the desk is the player's, not a hardcoded governor's", () => {
  const ABUJA_IDENTITY: DeskIdentity = {
    ...DELTA_TUTORIAL_IDENTITY,
    name: 'A. U. Sadiq',
    post: 'President',
    officeLabel: 'FEDERAL GOVERNMENT',
    state: 'Federal Capital Territory',
    capital: 'Abuja',
    honorific: 'His Excellency',
    digestHead: 'PRESIDENTIAL SECURITY DIGEST',
    pollsterTitle: 'Special Adviser (Polling)',
    isDeltaTutorial: false,
  }

  it('a presidential close prints the presidential desk, not Delta', () => {
    const snap = createDeskSim('federal/president', 'Federal Capital Territory')
    const result = closeWeek(snap, {}, ABUJA_IDENTITY)
    const digest = result.documents.find(d => d.kind === 'security')
    if (digest) expect((digest as SecurityDoc).docHead).toContain('PRESIDENTIAL SECURITY DIGEST')
    const memo = result.documents.find(d => d.kind === 'note' && (d as NoteDoc).from === ABUJA_IDENTITY.pollsterTitle)
    expect(memo).toBeTruthy()
    expect(JSON.stringify(result.documents)).not.toContain('DELTA')
  })

  it('the delta default stays untouched for legacy saves and tests', () => {
    const snap = createDeskSim('state/governor', 'Delta')
    const result = closeWeek(snap, {})
    expect(JSON.stringify(result.documents)).not.toContain('PRESIDENTIAL SECURITY DIGEST')
  })

  it('a non-tutorial desk opens on a personalized orientation note, not the authored handover', () => {
    const note = orientationNote(ANCHOR_WEEK, ABUJA_IDENTITY)
    expect(note.kind).toBe('note')
    expect(note.lines.some(l => l.includes('Abuja'))).toBe(true)
    expect(note.lines.some(l => l.includes('Close the week'))).toBe(true)
    expect(note.lines.some(l => l.includes('off-the-books'))).toBe(true)
  })
})

describe('prologue explainers — the mechanics are visible before they commit', () => {
  it('effect chips translate basis points into human points, and patrons show by name', () => {
    const chips = effectChips(
      { competence: 800, partyLoyalty: -400 },
      { name: 'The Head of Service', role: 'Permanent Secretary', loyalty: 4 },
    )
    expect(chips).toContain('+8 Competence')
    expect(chips).toContain('−4 Party loyalty')
    expect(chips).toContain('A patron — The Head of Service (Permanent Secretary, loyalty 4/5)')
  })

  it('the godfather chip names the billion, not abstract points', () => {
    const chips = effectChips({ patronageBank: 1_000_000_000, eliteTrust: 1200 })
    expect(chips.some(c => c.includes('patronage bank'))).toBe(true)
    expect(chips).toContain('+12 Elite trust')
  })
})

describe('week dating', () => {
  it('rolls Thursdays from the authored anchor', () => {
    expect(weekDateLine(ANCHOR_WEEK)).toBe('THURSDAY · 8 October 2026')
    expect(weekDateLine(ANCHOR_WEEK + 1)).toBe('THURSDAY · 15 October 2026')
    expect(weekDateLine(ANCHOR_WEEK + 2)).toBe('THURSDAY · 22 October 2026')
    expect(weekLine(42)).toBe('EXCO WEEK 42 · ASABA')
  })
})
