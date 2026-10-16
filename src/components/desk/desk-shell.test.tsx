import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DeskShell from './DeskShell'
import FederalHeader, { COUNCIL_NAME } from './FederalHeader'
import DeskCard, { MOCK_DESK_CARD } from './DeskCard'
import PatronRow, { DEMO_PATRONS, patronStatusLabel, patronTone } from './PatronRow'
import Gazette, { MOCK_GAZETTE } from './Gazette'
import BottomNav, { NAV_ITEMS, formatBudget } from './BottomNav'

/* The DeskCard surface is prop-driven by design: the same components have to
   name the Federation, a state or an LGA and read the same with or without a
   database. These tests render them and pin the content each one owns. */

const noop = () => undefined

/* React escapes apostrophes in static markup (Governors' → Governors&#x27;) */
const markupText = (s: string) => s.replace(/'/g, '&#x27;')

describe('FederalHeader — one bar, three tiers', () => {
  it('names the council that matches the tier and prints week · seat', () => {
    const fed = renderToStaticMarkup(<FederalHeader level="federal" week={41} capital="Abuja" />)
    expect(fed).toContain('FEDERAL EXECUTIVE COUNCIL')
    expect(fed).toContain('WEEK 41 · ABUJA')

    const lga = renderToStaticMarkup(<FederalHeader level="lga" week={47} capital="Sapele" />)
    expect(lga).toContain('LGA EXECUTIVE COUNCIL')
    expect(lga).toContain('WEEK 47 · SAPELE')

    const state = renderToStaticMarkup(<FederalHeader level="state" week={41} capital="Ikeja" />)
    expect(state).toContain('STATE EXECUTIVE COUNCIL')
    expect(state).toContain('WEEK 41 · IKEJA')
  })

  it('carries the FAAC pulse for every tier', () => {
    for (const level of ['federal', 'state', 'lga'] as const) {
      const html = renderToStaticMarkup(<FederalHeader level={level} week={41} capital="Abuja" />)
      expect(html).toContain('aria-label="FAAC pulse"')
      expect(COUNCIL_NAME[level]).toContain('COUNCIL')
    }
  })
})

describe('DeskCard — the decision and the three hands', () => {
  const props = {
    title: 'FAAC revision',
    status: 'PENDING',
    description: 'Two lines of the matter.',
    impacts: ['+₦2.1bn monthly', 'Governors −1 loyalty'],
    onSign: noop, onDefer: noop, onReject: noop,
  }

  it('heads the card with DECISION: and stamps the status', () => {
    const html = renderToStaticMarkup(<DeskCard {...props} />)
    expect(html).toContain('DECISION:')
    expect(html).toContain('FAAC revision')
    expect(html).toContain('PENDING')
    expect(html).toContain('data-tone="pending"')
  })

  it('renders the impact tags and the Sign / Defer / Reject actions', () => {
    const html = renderToStaticMarkup(<DeskCard {...props} deadline="SIGN BEFORE FAAC DROPS — 21 OCT" />)
    expect(html).toContain('+₦2.1bn monthly')
    expect(html).toContain('Governors −1 loyalty')
    expect(html).toContain('>Sign<')
    expect(html).toContain('>Defer<')
    expect(html).toContain('>Reject<')
    expect(html).toContain('SIGN BEFORE FAAC DROPS')
  })

  it('stands in mock data when there is no live decision', () => {
    expect(MOCK_DESK_CARD.title).toBe('FAAC revision')
    const html = renderToStaticMarkup(<DeskCard {...MOCK_DESK_CARD} onSign={noop} onDefer={noop} onReject={noop} />)
    expect(html).toContain(MOCK_DESK_CARD.impacts[0])
  })
})

describe('PatronRow — loyalty at a glance', () => {
  it('reads loyalty as tone and flags what is due', () => {
    expect(patronTone(5)).toBe('loyal')
    expect(patronTone(4)).toBe('loyal')
    expect(patronTone(3)).toBe('wavering')
    expect(patronTone(1)).toBe('angry')
    expect(patronStatusLabel({ name: 'A', role: 'r', loyalty: 4, ROI_due_weeks: 2 })).toBe('Due in 2 weeks')
    expect(patronStatusLabel({ name: 'A', role: 'r', loyalty: 4, ROI_due_weeks: 0 })).toBe('Due now')
    expect(patronStatusLabel({ name: 'A', role: 'r', loyalty: 4, ROI_due_weeks: 9 })).toBe('Loyal')
    expect(patronStatusLabel({ name: 'A', role: 'r', loyalty: 3, ROI_due_weeks: 9 })).toBe('Wavering')
    expect(patronStatusLabel({ name: 'A', role: 'r', loyalty: 1, ROI_due_weeks: 9 })).toBe('Angry')
  })

  it('renders the desk\u2019s own patrons when there are any', () => {
    const html = renderToStaticMarkup(<PatronRow patrons={[
      { id: 'agoro', name: 'Hon. Felix Agoro', role: 'Works Commissioner', loyalty: 2, ROI_due_weeks: 1 },
    ]} />)
    expect(html).toContain('Hon. Felix Agoro')
    expect(html).toContain('Works Commissioner')
    expect(html).toContain('Due in 1 week')
    expect(html).toContain('data-tone="wavering"')
    expect(html).toContain('Loyalty 2 of 5')
    expect(html).not.toContain('Dr. Okafor')
  })

  it('falls back to three demo patrons instead of an empty strip', () => {
    const html = renderToStaticMarkup(<PatronRow patrons={[]} />)
    for (const p of DEMO_PATRONS) expect(html).toContain(p.name)
    expect(html).toContain('demo roster')
  })
})

describe('Gazette — a clipping you can open', () => {
  it('prints the masthead, date, headline and folio', () => {
    const html = renderToStaticMarkup(
      <Gazette headline="FAAC Revision Sparks Governors' Pushback" date="THURSDAY 8 OCTOBER 2026" body="One.\n\nTwo." />,
    )
    expect(html).toContain('THE GAZETTE')
    expect(html).toContain('THURSDAY 8 OCTOBER 2026')
    expect(html).toContain(markupText("FAAC Revision Sparks Governors' Pushback"))
    expect(html).toContain('Page 3 · Politics')
    /* the reader is closed until the clipping is tapped */
    expect(html).not.toContain('Close the paper')
  })

  it('ships a stand-in story for a week with no press', () => {
    const html = renderToStaticMarkup(<Gazette {...MOCK_GAZETTE} />)
    expect(html).toContain(markupText(MOCK_GAZETTE.headline))
    expect(html).toContain(MOCK_GAZETTE.body.split('\n\n')[0])
  })
})

describe('BottomNav — folders, purse and clock', () => {
  it('prints four folders, the treasury pill and the week', () => {
    const html = renderToStaticMarkup(
      <BottomNav activeTab="patrons" budget={8_275_860_000} week={41} onTabChange={noop} />,
    )
    for (const item of NAV_ITEMS) expect(html).toContain(item.label)
    expect(html).toContain('8.28bn')
    expect(html).toContain('TREASURY')
    expect(html).toContain('Week 41')
    expect(html).toContain('aria-label="Desk folders"')
  })

  it('formats money for the pill', () => {
    expect(formatBudget(500_000_000)).toBe('₦500m')
    expect(formatBudget(8_275_860_000)).toBe('₦8.28bn')
    expect(formatBudget(950_000_000)).toBe('₦950m')
    expect(formatBudget(-2_000_000_000)).toBe('−₦2.00bn')
    expect(formatBudget(0)).toBe('₦0')
  })
})

describe('DeskShell — the composed surface', () => {
  it('composes header, patrons, decision, gazette and folders', () => {
    const html = renderToStaticMarkup(
      <DeskShell
        level="state"
        week={41}
        capital="Asaba"
        budget={8_275_860_000}
        patrons={[{ id: 'p1', name: 'Hajia Bello', role: "Women's Leader", loyalty: 3, ROI_due_weeks: 2 }]}
        card={{
          title: 'ASUU State Chapter — what do you offer by Friday?',
          status: 'PENDING',
          description: 'On the desk now: ASUU suspends · Treasury −₦2.1bn.',
          impacts: ['ASUU suspends', 'Treasury −₦2.1bn'],
        }}
        cardDeadline="DEADLINE — 15 OCT · STRIKE BALLOT FRIDAY"
        signNote="Offer 12% now"
        deferNote="stays on the desk"
        rejectNote="Offer 8% + arrears in two tranches"
        onSign={noop} onDefer={noop} onReject={noop}
        gazette={{ headline: 'FAAC Revision Sparks Pushback', date: 'THURSDAY 8 OCTOBER 2026', body: 'Body.' }}
        tray={[{ id: 'exco-minutes', title: 'Exco Minutes — 8 Oct 2026', trayLine: 'Four items await your hand', mark: 'urgent' }]}
        onOpenDoc={noop}
        activeTab="desk"
        onTabChange={noop}
        onCloseWeek={noop}
      />,
    )

    expect(html).toContain('STATE EXECUTIVE COUNCIL')
    expect(html).toContain('WEEK 41 · ASABA')
    expect(html).toContain('Hajia Bello')
    expect(html).toContain('ASUU State Chapter')
    expect(html).toContain('Offer 12% now')
    expect(html).toContain('FAAC Revision Sparks Pushback')
    expect(html).toContain('Exco Minutes — 8 Oct 2026')
    expect(html).toContain('URGENT')
    expect(html).toContain('CLOSE THE WEEK')
    expect(html).toContain('Desk folders')
  })

  it('switches tier by hand without touching the data above it', () => {
    const lga = renderToStaticMarkup(<DeskShell level="lga" week={44} capital="Sapele" />)
    expect(lga).toContain('LGA EXECUTIVE COUNCIL')
    expect(lga).toContain('WEEK 44 · SAPELE')
    expect(lga).toContain('aria-pressed="true"')
    /* no onTabChange → the shell does not paint a folders bar of its own */
    expect(lga).not.toContain('Desk folders')
  })

  it('renders the mock decision and gazette when the save has neither', () => {
    const html = renderToStaticMarkup(<DeskShell />)
    expect(html).toContain(MOCK_DESK_CARD.title)
    expect(html).toContain(markupText(MOCK_GAZETTE.headline))
    for (const p of DEMO_PATRONS) expect(html).toContain(p.name)
  })
})
