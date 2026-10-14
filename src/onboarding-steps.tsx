/* MANDATE — first-open wizard screens (steps 1–4).
   Presentation only: the phase machine lives in App.tsx, the sheet derivation in
   profile-state.ts, and the reference reads in profile/client.ts. This module owns the
   four screens a new file passes through — post, jurisdiction, who-you-are, review — and
   the chrome they share (back arrow, step rail, progress bar, green call-to-action). */

import { useEffect, useState } from 'react'
import type { ReactNode, SVGProps } from 'react'
import type { FederationLga, FederationOffice, FederationParty, FederationState } from './profile/types'
import type { ProfileSheet } from './profile/onboarding'
import type { Bringer, FirstScar, Origin } from './profile/prologue'
import { BRINGERS, FIRST_SCARS, ORIGINS } from './profile/prologue'
import { TIER_ORDER } from './profile/playable-offices'
import { listLgas } from './profile/client'
import { IcBack, IcCheck } from './icons'

/* ---------- glyphs local to the wizard ---------- */

const glyph = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true, ...p,
})

const IcArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>
)
const IcSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
)
const IcDome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M3 20h18" /><path d="M6 20v-7M18 20v-7" /><path d="M12 4c-3 0-5 2.6-5 6h10c0-3.4-2-6-5-6Z" /><path d="M7 13h10" /></svg>
)
const IcColumns = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M3 20h18" /><path d="M6 20V8.5l6-4 6 4V20" /><path d="M10 20v-5.5M14 20v-5.5" /></svg>
)
const IcTerritory = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M3 20h18" /><path d="M5 20v-9l7-4 7 4v9" /><path d="M12 7v13M9 20v-5h6v5" /></svg>
)
const IcCouncil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M2.5 20h19" /><path d="M5 20v-8h14v8" /><path d="M9.5 12V9.5L12 8l2.5 1.5V12" /></svg>
)
const IcBriefcase = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><rect x="3" y="7.5" width="18" height="12" rx="2" /><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" /><path d="M3 12.5h18" /></svg>
)
const IcUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><circle cx="9" cy="9" r="3" /><circle cx="16.6" cy="10" r="2.4" /><path d="M3.4 19c.6-2.8 2.7-4.4 5.6-4.4s5 1.6 5.6 4.4" /><path d="M16 14.8c2.1 0 3.7 1.3 4.4 3.6" /></svg>
)
const IcPeople = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><circle cx="12" cy="8" r="3" /><circle cx="5.6" cy="10" r="2.2" /><circle cx="18.4" cy="10" r="2.2" /><path d="M6 19c.5-3 2.8-4.6 6-4.6s5.5 1.6 6 4.6" /></svg>
)
const IcTower = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><rect x="6" y="3.5" width="12" height="17" rx="1.5" /><path d="M9.5 7.5h5M9.5 11.5h5M9.5 15.5h5" /></svg>
)
const IcMegaphone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M4 10.5 17 5v11L4 13.5Z" /><path d="M7 14.5V19h3" /><path d="M19 9.5v4" /></svg>
)
const IcHandshake = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="m3 11 4-4 5 4 5-4 4 4" /><path d="M7 11v4a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3v-4" /></svg>
)
const IcChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M4 4v16h16" /><path d="M8 17v-5M12.5 17V8M17 17v-7" /></svg>
)
const IcScroll = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V4Z" /><path d="M9.5 8.5h6M9.5 12h6" /></svg>
)
const IcProtest = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><circle cx="12" cy="7" r="2.4" /><path d="M8 20v-4.5l-2.5 3" /><path d="M16 20v-4.5l2.5 3" /><path d="M8 12.5h8" /></svg>
)
const IcBolt = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M13 3 5.5 13H11l-1 8 7.5-11H12l1-7Z" /></svg>
)
const IcBanknote = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><rect x="2.5" y="7" width="19" height="10" rx="2" /><circle cx="12" cy="12" r="2.4" /><path d="M6 12h.01M18 12h.01" /></svg>
)
const IcShield = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M12 3.5 19 6v6c0 4.5-3 7.6-7 8.5-4-.9-7-4-7-8.5V6l7-2.5Z" /></svg>
)
const IcSeal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><circle cx="12" cy="9.5" r="5.5" /><path d="m9.6 14.2-1 6.3 3.4-1.9 3.4 1.9-1-6.3" /></svg>
)
const IcFlag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M6 21V4" /><path d="M6 5h11l-2 4 2 4H6" /></svg>
)
const IcSprout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...glyph(p)}><path d="M12 21v-7" /><path d="M12 14c0-3 2.5-5 6-5 0 3-2.5 5-6 5Z" /><path d="M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z" /></svg>
)

/* ---------- shared chrome ---------- */

function ObPage({ step, total, caps, title, sub, onBack, children, ctaLabel, ctaDisabled, onCta, ctaDark }: {
  step: number
  total: number
  caps?: boolean
  title: ReactNode
  sub?: ReactNode
  onBack: () => void
  children: ReactNode
  ctaLabel: string
  ctaDisabled?: boolean
  onCta: () => void
  ctaDark?: boolean
}) {
  const pct = Math.round((step / total) * 100)
  return (
    <div className="ob-page">
      <div className="ob-top">
        <button className="ob-backbtn" onClick={onBack} aria-label="back"><IcBack /></button>
      </div>
      <div className="ob-head">
        <h1 className={`ob-title${caps ? ' caps' : ''}`}>{title}</h1>
        <div className="ob-rail">Step {step} of {total}</div>
        <div className="ob-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step}>
          <span style={{ width: `${pct}%` }} />
        </div>
        {sub ? <p className="ob-sub">{sub}</p> : null}
      </div>
      <div className="ob-body">{children}</div>
      <div className="ob-foot">
        <button className={`ob-cta${ctaDark ? ' dark' : ''}`} disabled={ctaDisabled} onClick={onCta}>
          <span>{ctaLabel}</span>
          {ctaDark ? null : <IcArrowRight />}
        </button>
      </div>
    </div>
  )
}

/* ---------- 1 · post ---------- */

const CARD_TIER: Record<string, string> = {
  federal: 'Federal', state: 'State', fct: 'Territory', local: 'Local',
}

function postGlyph(office: FederationOffice): ReactNode {
  if (office.id === 'federal/president') return <IcDome />
  if (office.tier === 'state') return <IcColumns />
  if (office.tier === 'fct') return <IcTerritory />
  if (office.tier === 'local') return <IcCouncil />
  return <IcDome />
}

export function PostStep({ offices, officeId, onPick, step, total, onBack, onContinue }: {
  offices: FederationOffice[]
  officeId: string | null
  onPick: (office: FederationOffice) => void
  step: number
  total: number
  onBack: () => void
  onContinue: () => void
}) {
  const ordered = [...offices].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.post.localeCompare(b.post),
  )
  return (
    <ObPage
      step={step} total={total} caps
      title={<>New File —<br />Choose Your Post</>}
      sub="Pick the office you will run for"
      onBack={onBack}
      ctaLabel="Continue" ctaDisabled={!officeId} onCta={onContinue}
    >
      <div className="ob-cards">
        {ordered.map(o => (
          <button key={o.id} className={`ob-card${officeId === o.id ? ' selected' : ''}`} onClick={() => onPick(o)}>
            <span className="ob-card-ic">{postGlyph(o)}</span>
            <span className="ob-card-tx">
              <span className="ob-card-title">{o.post}</span>
              <span className="ob-card-meta">{CARD_TIER[o.tier] ?? o.tier} • {o.route.toUpperCase()}</span>
            </span>
            {officeId === o.id ? <span className="ob-card-check"><IcCheck /></span> : null}
          </button>
        ))}
      </div>
    </ObPage>
  )
}

/* ---------- 2 · jurisdiction ---------- */

export function JurisdictionStep({ office, states, stateCode, lgaName, onPickState, onPickLga, step, total, onBack, onContinue }: {
  office: FederationOffice
  states: FederationState[]
  stateCode: string | null
  lgaName: string | null
  onPickState: (code: string | null) => void
  onPickLga: (lga: FederationLga | null) => void
  step: number
  total: number
  onBack: () => void
  onContinue: () => void
}) {
  const needsLga = office.jurisdiction === 'lga'
  const state = states.find(s => s.code === stateCode) ?? null
  const [query, setQuery] = useState('')
  const [lgas, setLgas] = useState<FederationLga[] | null>(null)

  useEffect(() => {
    if (!needsLga || !stateCode) { setLgas(null); return }
    let live = true
    setLgas(null)
    listLgas(stateCode)
      .then(rows => { if (live) setLgas(rows) })
      .catch(() => { if (live) setLgas([]) })
    return () => { live = false }
  }, [needsLga, stateCode])

  /* A council post: after the state is chosen the same step re-casts as the council list. */
  if (needsLga && state) {
    const needle = query.trim().toLowerCase()
    const shown = (lgas ?? []).filter(l => l.name.toLowerCase().includes(needle))
    return (
      <ObPage
        step={step} total={total}
        title={<>Which council in<br />{state.name}?</>}
        sub={state.tier === 'fct' ? 'The FCT runs six area councils — the third tier under the territory.' : 'The third tier, funded through the state joint account.'}
        onBack={() => { onPickState(null); onPickLga(null); setQuery('') }}
        ctaLabel="Continue" ctaDisabled={lgas === null || (lgas.length > 0 && !lgaName)} onCta={onContinue}
      >
        <div className="ob-search">
          <IcSearch />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search council…" />
        </div>
        {lgas === null ? (
          <p className="ob-note">Reading the council register…</p>
        ) : lgas.length === 0 ? (
          /* Offline the register only carries a sample. Rather than dead-end a council post
             in a state we have no rows for, let the file proceed and file the council later. */
          <p className="ob-note">The council register for {state.name} is not on this device — continue and the council can be filed later.</p>
        ) : shown.length === 0 ? (
          <p className="ob-note">No council matches “{query}”.</p>
        ) : (
          <div className="ob-cards">
            {shown.map(l => (
              <button key={l.id} className={`ob-card${lgaName === l.name ? ' selected' : ''}`} onClick={() => onPickLga(l)}>
                <span className="ob-card-ic"><IcCouncil /></span>
                <span className="ob-card-tx">
                  <span className="ob-card-title">{l.name}</span>
                  <span className="ob-card-meta">{state.tier === 'fct' ? 'Area Council' : 'Local Government'}</span>
                </span>
                {lgaName === l.name ? <span className="ob-card-check"><IcCheck /></span> : null}
              </button>
            ))}
          </div>
        )}
      </ObPage>
    )
  }

  const needle = query.trim().toLowerCase()
  const shown = states.filter(s => s.name.toLowerCase().includes(needle))
  const title = office.jurisdiction === 'lga'
    ? 'Which state is your council in?'
    : 'Pick the state you will govern'
  return (
    <ObPage
      step={step} total={total}
      title={title}
      sub={office.jurisdiction === 'lga'
        ? 'The 774 LGAs sit under the 36 states; the FCT runs six area councils of its own.'
        : 'The 36 states — the FCT has no governorship (s.299).'}
      onBack={onBack}
      ctaLabel="Continue" ctaDisabled={!stateCode} onCta={onContinue}
    >
      <div className="ob-search">
        <IcSearch />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search state…" />
      </div>
      <div className="ob-grid">
        {shown.map(s => (            <button key={s.code} className={`ob-tile${stateCode === s.code ? ' selected' : ''}`} onClick={() => { setQuery(''); onPickState(s.code) }}>
            <span className="ob-tile-name">{s.name}</span>
            <span className="ob-tile-meta">Capital: {s.capital}</span>
          </button>
        ))}
      </div>
    </ObPage>
  )
}

/* ---------- 3 · who are you ---------- */

const ORIGIN_GLYPH: Record<string, ReactNode> = {
  'civil-service': <IcBriefcase />, 'party-youth': <IcUsers />, 'business': <IcTower />, 'activist': <IcMegaphone />,
}
const BRINGER_GLYPH: Record<string, ReactNode> = {
  godfather: <IcHandshake />, grassroots: <IcPeople />, technocrat: <IcChart />,
}
const SCAR_GLYPH: Record<string, ReactNode> = {
  none: <IcSprout />, 'contract-query': <IcScroll />, protest: <IcProtest />,
}

function ChoiceRow({ icon, label, sub, selected, onClick }: {
  icon: ReactNode; label: string; sub: string; selected: boolean; onClick: () => void
}) {
  return (
    <button className={`ob-card${selected ? ' selected' : ''}`} onClick={onClick}>
      <span className="ob-card-ic">{icon}</span>
      <span className="ob-card-tx">
        <span className="ob-card-title">{label}</span>
        <span className="ob-card-meta">{sub}</span>
      </span>
      {selected ? <span className="ob-card-check"><IcCheck /></span> : null}
    </button>
  )
}

export function WhoStep({ office, stateName, name, age, pronouns, locale, altName, bio, partyCode, parties, origin, bringer, scar, onField, onParty, onOrigin, onBringer, onScar, step, total, onBack, onContinue }: {
  office: FederationOffice
  stateName: string
  name: string
  age: string
  pronouns: string
  locale: string
  altName: string
  bio: string
  partyCode: string | null
  parties: FederationParty[]
  origin: Origin | null
  bringer: Bringer | null
  scar: FirstScar | null
  onField: (field: 'name' | 'age' | 'pronouns' | 'locale' | 'altName' | 'bio', value: string) => void
  onParty: (code: string) => void
  onOrigin: (o: Origin) => void
  onBringer: (b: Bringer) => void
  onScar: (s: FirstScar) => void
  step: number
  total: number
  onBack: () => void
  onContinue: () => void
}) {
  const ready = Boolean(name.trim() && partyCode && origin && bringer && scar)
  /* A nationwide post stands for the Federation, the FCT ministership already names its
     territory, and the state/local posts name the state they sit in. */
  const jurisdiction = office.tier === 'federal' ? 'the Federation' : office.tier === 'fct' ? '' : stateName
  return (
    <ObPage
      step={step} total={total}
      title={name.trim() ? `Who are you, ${name.trim()}?` : 'Who are you?'}
      sub={`You are taking the ${office.post}${jurisdiction ? ` of ${jurisdiction}` : ''}. This is your record — typed by you, not pulled from a file.`}
      onBack={onBack}
      ctaLabel="Continue" ctaDisabled={!ready} onCta={onContinue}
    >
      <div className="ob-fields">
        <label className="ob-field">
          <span className="ob-label">Name</span>
          <input className="ob-input" value={name} onChange={e => onField('name', e.target.value)} placeholder="e.g. M. A. Bamgboye" />
        </label>
        <div className="ob-field-row">
          <label className="ob-field">
            <span className="ob-label">Age</span>
            <input className="ob-input" type="number" value={age} onChange={e => onField('age', e.target.value)} placeholder="52" />
          </label>
          <label className="ob-field">
            <span className="ob-label">Pronouns</span>
            <input className="ob-input" value={pronouns} onChange={e => onField('pronouns', e.target.value)} placeholder="he/him" />
          </label>
        </div>
        <div className="ob-field-row">
          <label className="ob-field">
            <span className="ob-label">Phone locale</span>
            <input className="ob-input" value={locale} onChange={e => onField('locale', e.target.value)} placeholder="+234" />
          </label>
          <label className="ob-field">
            <span className="ob-label">Other name</span>
            <input className="ob-input" value={altName} onChange={e => onField('altName', e.target.value)} placeholder="an alias" />
          </label>
        </div>
        <label className="ob-field">
          <span className="ob-label">Bio / notes</span>
          <textarea className="ob-input ob-textarea" rows={3} value={bio} onChange={e => onField('bio', e.target.value)} placeholder="optional — your own note to yourself" />
        </label>
      </div>

      <div className="ob-sect"><IcBolt /><span>Where did you come from?</span></div>
      <div className="ob-cards">
        {ORIGINS.map(o => (
          <ChoiceRow key={o.id} icon={ORIGIN_GLYPH[o.id]} label={o.label} sub={o.sub} selected={origin === o.id} onClick={() => onOrigin(o.id)} />
        ))}
      </div>

      <div className="ob-sect"><IcBolt /><span>Who brought you?</span></div>
      <div className="ob-cards">
        {BRINGERS.map(b => (
          <ChoiceRow key={b.id} icon={BRINGER_GLYPH[b.id]} label={b.label} sub={b.sub} selected={bringer === b.id} onClick={() => onBringer(b.id)} />
        ))}
      </div>

      <div className="ob-sect"><IcBolt /><span>Your first scar?</span></div>
      <div className="ob-cards">
        {FIRST_SCARS.map(s => (
          <ChoiceRow key={s.id} icon={SCAR_GLYPH[s.id]} label={s.label} sub={s.sub} selected={scar === s.id} onClick={() => onScar(s.id)} />
        ))}
      </div>

      <div className="ob-sect"><IcFlag /><span>Which party will you travel under?</span></div>
      <div className="ob-chips">
        {parties.map(p => (
          <button key={p.code} className={`ob-chip${partyCode === p.code ? ' selected' : ''}`} onClick={() => onParty(p.code)} title={p.note}>
            {p.name}
          </button>
        ))}
      </div>
    </ObPage>
  )
}

/* ---------- 4 · review ---------- */

const AXIS_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Power', keys: ['PATRONAGE BANK', 'ELITE TRUST', 'COMPETENCE', 'INTEGRITY', 'INSTITUTIONAL MEMORY'] },
  { label: 'Public', keys: ['POPULAR SUPPORT', 'PRESS TONE', 'CONSTITUENCY ALIGNMENT'] },
  { label: 'Party', keys: ['PARTY LOYALTY', 'MANDATE LEGITIMACY'] },
]

const AXIS_DISPLAY: Record<string, string> = {
  'COMPETENCE': 'Competence', 'INTEGRITY': 'Integrity', 'POPULAR SUPPORT': 'Popular Support',
  'PARTY LOYALTY': 'Party Loyalty', 'ELITE TRUST': 'Elite Trust', 'PRESS TONE': 'Press Tone',
  'CONSTITUENCY ALIGNMENT': 'Constituency Alignment', 'PATRONAGE BANK': 'Patronage Bank',
  'MANDATE LEGITIMACY': 'Mandate Legitimacy', 'INSTITUTIONAL MEMORY': 'Institutional Memory',
}

const AXIS_GLYPH: Record<string, ReactNode> = {
  'PATRONAGE BANK': <IcBanknote />, 'ELITE TRUST': <IcShield />, 'COMPETENCE': <IcChart />,
  'INTEGRITY': <IcShield />, 'INSTITUTIONAL MEMORY': <IcScroll />, 'POPULAR SUPPORT': <IcUsers />,
  'PRESS TONE': <IcMegaphone />, 'CONSTITUENCY ALIGNMENT': <IcPeople />,
  'PARTY LOYALTY': <IcHandshake />, 'MANDATE LEGITIMACY': <IcSeal />,
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'FI'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ReviewStep({ sheet, meta, step, total, onBack, onAccept }: {
  sheet: ProfileSheet
  meta: string
  step: number
  total: number
  onBack: () => void
  onAccept: () => void
}) {
  const byLabel = new Map(sheet.axes.map(a => [a.label, a]))
  return (
    <ObPage
      step={step} total={total} caps
      title={<>New File —<br />Review Your Record</>}
      onBack={onBack}
      ctaLabel="Accept and enter the desk" onCta={onAccept} ctaDark
    >
      <div className="ob-ident">
        <span className="ob-avatar">{initialsOf(sheet.name)}</span>
        <div className="ob-ident-tx">
          <div className="ob-ident-name">{sheet.name}</div>
          <div className="ob-ident-meta">{meta}</div>
          <div className="ob-party"><IcFlag /> Party: {sheet.party}</div>
        </div>
      </div>

      {AXIS_GROUPS.map(g => {
        const rows = g.keys.map(k => byLabel.get(k)).filter((a): a is NonNullable<typeof a> => Boolean(a))
        if (rows.length === 0) return null
        return (
          <div className="ob-group" key={g.label}>
            <div className="ob-sect"><IcBolt /><span>{g.label}</span></div>
            <div className="ob-cards">
              {rows.map(a => (
                <div className="ob-row" key={a.label}>
                  <span className="ob-row-ic">{AXIS_GLYPH[a.label] ?? <IcBolt />}</span>
                  <span className="ob-row-name">{AXIS_DISPLAY[a.label] ?? a.label}</span>
                  <span className="ob-row-val">{a.value}</span>
                  <span className={`ob-pill ${a.band.toLowerCase()}`}>{a.band}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {sheet.patrons.length > 0 ? (
        <>
          <div className="ob-sect"><IcHandshake /><span>Patronage network</span></div>
          <div className="ob-cards">
            {sheet.patrons.map(p => (
              <div className="ob-row" key={p.name}>
                <span className="ob-row-ic"><IcHandshake /></span>
                <span className="ob-row-name">{p.name}</span>
                <span className="ob-row-val">{p.role}</span>
                <span className="ob-pill even">loyalty {p.loyalty}/5</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </ObPage>
  )
}
