import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import FolderShell from './FolderShell'
import PatronsScreen from './PatronsScreen'
import PressScreen from './PressScreen'
import OpsScreen from './OpsScreen'
import CabinetScreen from './CabinetScreen'
import TreasuryScreen from './TreasuryScreen'
import AtlasScreen from '../atlas/AtlasScreen'
import { OPS as OPS_CATALOGUE } from '../../desk-sim'
import { EFCC_RISK, ICPC_RISK } from '../../sim-core'
import type { GazetteStory } from '../../types'

/* The folder screens are prop-driven the same way the desk is: the same chrome has
   to name the Federation, a state or an LGA, and the same panel has to be honest
   when the save carries no money. These tests pin what each screen owns —
   including the two rules that are easy to lose in a restyle: a pending ledger
   line is never added in, and an absent bank is not printed as ₦0. */

const noop = () => undefined

describe('FolderShell — the chrome every folder wears', () => {
  it('prints the office, the week and the seat, then the folder itself', () => {
    const html = renderToStaticMarkup(
      <FolderShell
        tab="patrons"
        kicker="FOLDER · THE BOOK OF OWED"
        title="PATRONAGE"
        sub="Who put you here."
        level="federal"
        week={47}
        capital="Abuja"
        budget={8_275_860_000}
        onTabChange={noop}
      >
        <p>body</p>
      </FolderShell>,
    )
    expect(html).toContain('FEDERAL EXECUTIVE COUNCIL')
    expect(html).toContain('WEEK 47 · ABUJA')
    expect(html).toContain('FOLDER · THE BOOK OF OWED')
    expect(html).toContain('PATRONAGE')
    expect(html).toContain('Who put you here.')
    expect(html).toContain('body')
    /* the folders bar is the desk's own, treasure pill included */
    expect(html).toContain('aria-label="Desk folders"')
    expect(html).toContain('TREASURY')
    expect(html).toContain('Week 47')
  })

  it('gives a sub-folder a way back and the purse a way into the ledger', () => {
    const html = renderToStaticMarkup(
      <FolderShell
        tab="desk"
        kicker="FOLDER · THE CABINET"
        title="WHAT THE PAPER REMEMBERS"
        sub="Everything filed."
        budget={1_000_000}
        onTabChange={noop}
        onBack={noop}
        onOpenTreasury={noop}
      >
        <p>files</p>
      </FolderShell>,
    )
    expect(html).toContain('BACK TO THE DESK')
    expect(html).toContain('open the ledger')
  })
})

describe('PatronsScreen — the book of owed', () => {
  const patrons = [
    { id: 'agoro', name: 'Hon. Felix Agoro', role: 'Works Commissioner', loyalty: 2, ROI_due_weeks: 1 },
    { id: 'bello', name: 'Hajia Bello', role: "Women's Leader", loyalty: 5, ROI_due_weeks: 0 },
    { id: 'owhonda', name: 'Elder Tom Owhonda', role: 'Party Elder', loyalty: 1, ROI_due_weeks: 6 },
  ]

  it('reads loyalty as tone and prints the bank it has', () => {
    const html = renderToStaticMarkup(
      <PatronsScreen patrons={patrons} patronageBank={3_834_790_251} approval={44} seatName="Asaba" />,
    )
    expect(html).toContain('Hon. Felix Agoro')
    expect(html).toContain('Works Commissioner')
    expect(html).toContain('Due in 1 week')
    /* loyalty 2 wavering · 5 loyal · 1 angry — the tone, not the number, is the message */
    expect(html).toContain('data-tone="wavering"')
    expect(html).toContain('data-tone="angry"')
    expect(html).toContain('data-tone="loyal"')
    /* 3.83bn of patronage bank, and the quarter it has to stretch across */
    expect(html).toContain('₦3.83bn')
    expect(html).toContain('₦295m')
    expect(html).toContain('44%')
    expect(html).not.toContain('not on file')
  })

  it('says the bank is unknown rather than printing ₦0', () => {
    const html = renderToStaticMarkup(<PatronsScreen patrons={patrons} />)
    expect(html).toContain('not on file')
    expect(html).not.toContain('₦0')
  })

  it('stands in the demo roster and admits it', () => {
    const html = renderToStaticMarkup(<PatronsScreen patrons={[]} />)
    expect(html).toContain('demo roster — no patron data on file')
    expect(html).toContain('No patron data on file')
  })
})

describe('PressScreen — the week\u2019s paper', () => {
  const stories: GazetteStory[] = [
    { id: 'g-1', title: 'FAAC Revision Sparks Pushback', impact: 'both', magnitude: 2, description: 'One.\n\nTwo.', affectedSectors: ['finance'] },
    { id: 'g-2', title: 'Road Contract Questioned', impact: 'approval', magnitude: -1, description: 'A quiet story.', affectedSectors: [] },
  ]

  it('totals what the press did and prints each story as a clipping', () => {
    const html = renderToStaticMarkup(<PressScreen stories={stories} week={41} seatName="Asaba" />)
    expect(html).toContain('THE PRESS LEDGER')
    expect(html).toContain('THE GAZETTE')
    expect(html).toContain('FAAC Revision Sparks Pushback')
    expect(html).toContain('Road Contract Questioned')
    expect(html).toContain('THURSDAY · 8 OCTOBER 2026')
    /* net polling = 2 + (-1) */
    expect(html).toContain('+1')
    expect(html).toContain('EFCC-grade risk')
  })

  it('says plainly when nothing ran', () => {
    const html = renderToStaticMarkup(<PressScreen stories={[]} week={42} />)
    expect(html).toContain('No clippings this week')
    expect(html).toContain('Nothing ran this week')
  })
})

describe('OpsScreen — the other ledger', () => {
  it('lists every move the simulation can actually run, with its exposure', () => {
    const html = renderToStaticMarkup(<OpsScreen ops={{}} onOrder={noop} approval={50} deskHoursLeft={9} />)
    for (const op of OPS_CATALOGUE) expect(html).toContain(op.label)
    expect(html).toContain('OFF THE BOOKS')
    expect(html).toContain('no desk hours')
    expect(html).toContain('ORDER IT — HOLD TO COMMIT')
    /* suppress-vote is the one move with no agency exposure */
    expect(EFCC_RISK['bribe-official']).toBe(true)
    expect(EFCC_RISK['suppress-vote']).toBe(false)
    expect(ICPC_RISK['plant-story']).toBe(true)
    expect(html).toContain('no agency exposure on this one')
    expect(html).toContain('DESK HOURS LEFT')
  })

  it('reports what the machinery actually did, once it has run', () => {
    const html = renderToStaticMarkup(
      <OpsScreen
        ops={{ 'plant-story': { ok: true, effect: 'The Gazette prints', approval: 2, efcc: true } }}
        onOrder={noop}
      />,
    )
    expect(html).toContain('The Gazette prints')
    expect(html).toContain('carried off')
    expect(html).toContain('approval +2')
    expect(html).toContain('a probe may follow')
    /* a run is not offered again while its result stands on the book */
    expect((html.match(/ORDER IT — HOLD TO COMMIT/g) ?? []).length).toBe(OPS_CATALOGUE.length - 1)
  })
})

describe('CabinetScreen — what the paper remembers', () => {
  it('files each worked document with the state it left in', () => {
    const html = renderToStaticMarkup(
      <CabinetScreen
        rows={[
          { id: 'sapele-gazette', title: 'Gazette No. 147 — Sapele Market', recordId: 'MANDATE/2026/W41/G147', state: 'STAMPED APPROVED', tone: 'good' },
          { id: 'clipping-asuu', title: 'ASUU ultimatum', recordId: 'MANDATE/2026/W42/CLIPPING', state: 'DECIDED' },
        ]}
        reference={[{ id: 'handover', title: 'Note from the outgoing Chief of Staff', authority: 'n/a — handover note' }]}
        onOpen={noop}
        onOpenDrawer={noop}
      />,
    )
    expect(html).toContain('WHAT THE PAPER REMEMBERS')
    expect(html).toContain('STAMPED APPROVED')
    expect(html).toContain('DECIDED')
    expect(html).toContain('THE REFERENCE SHELF')
    expect(html).toContain('n/a — handover note')
    expect(html).toContain('OPEN THE DRAWER')
  })

  it('says the cabinet is empty instead of showing nothing', () => {
    const html = renderToStaticMarkup(<CabinetScreen rows={[]} reference={[]} onOpen={noop} onOpenDrawer={noop} />)
    expect(html).toContain('The cabinet is empty')
  })
})

describe('TreasuryScreen — the ledger rule', () => {
  const html = renderToStaticMarkup(
    <TreasuryScreen
      title="Consolidated Revenue Fund — State Treasury"
      sub="OCTOBER 2026 · WEEK 41"
      opening={1_000}
      openingNote="ABOUT ONE WEEK OF PAYROLL — NOT SIX"
      rows={[
        { date: '01 Oct', memo: 'FAAC net to treasury', amount: 5_000 },
        { date: '02 Oct', memo: 'Teachers payroll', amount: -2_000 },
        { date: '08 Oct', memo: 'Sapele Market Renovation', amount: -300, pending: true },
      ]}
      closing={4_000}
      pendingTotal={300}
      afterSanction={3_700}
      authority="ss.121–125"
      shortfall={50}
    />,
  )

  it('prints opening, closing and the pending line separately', () => {
    expect(html).toContain('₦1,000')
    expect(html).toContain('₦4,000')
    expect(html).toContain('₦300')
    expect(html).toContain('AWAITING YOUR SANCTION — NOT CHARGED')
    expect(html).toContain('IF EVERY PENDING ITEM IS SANCTIONED: ₦3,700')
    expect(html).toContain('ss.121–125')
    expect(html).toContain('CLOSING BALANCE')
  })

  it('never folds a pending line into the closing figure', () => {
    /* 1000 + 5000 - 2000 = 4000 charged; the pending 300 is printed, not added */
    expect(html).toContain('2 lines are posted and charged')
    expect(html).toContain('1 line is waiting on your hand')
  })
})

describe('AtlasScreen — the seats and the century', () => {
  it('wraps the atlas in the folder chrome and lists the lives on file', () => {
    const html = renderToStaticMarkup(
      <AtlasScreen
        lives={[
          { id: 'life-2', summary: 'The Player · 2026-01-01 → 2026-03-01 · elected Governor', active: true, ended: false },
          { id: 'life-1', summary: 'The Player · 2025-01-01 → 2026-01-01 · retired', active: false, ended: true },
        ]}
        onRunFor={noop}
        week={41}
        capital="Asaba"
        budget={8_275_860_000}
        onTabChange={noop}
      />,
    )
    expect(html).toContain('FOLDER · THE COUNTRY')
    expect(html).toContain('THE STRUCTURE OF THE COUNTRY')
    expect(html).toContain('POSITION ATLAS')
    expect(html).toContain('RUN HERE')
    expect(html).toContain('THE CENTURY — LIVES ON FILE')
    expect(html).toContain('2 on file · 1 ended')
    expect(html).toContain('2026-03-01')
    expect(html).toContain('ON THE DESK')
    expect(html).toContain('ENDED')
    /* every life stays readable: nothing here is a wipe */
    expect(html).toContain('One save per life, and no life is ever erased')
  })

  it('opens with no lives at all without pretending otherwise', () => {
    const html = renderToStaticMarkup(<AtlasScreen lives={[]} onRunFor={noop} onTabChange={noop} />)
    expect(html).toContain('No lives on file yet')
    expect(html).toContain('none yet')
  })
})
