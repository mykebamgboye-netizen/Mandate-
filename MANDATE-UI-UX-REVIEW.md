# MANDATE — UI/UX Review & Direction v1.0

*Every screen in the game, the patterns that bind them, and the UX debt to clear before M1.*

Prepared alongside the Master Design & Architecture Document v1.0 · reviewed through Parts I–V · status: direction input for Gate 2–5 (§16.4).

---

## 0. How this review was produced

1. Read the master document end-to-end with a UI lens: §12 (the Document World), §5.3, §9.3, §10, §18.6, §19–21, §23.1, §26, §27, §36–38, §43–44, §48, §50, §53, §55.
2. Built and hand-audited the M0 Situation Desk prototype (the three mockups) against those sections.
3. Every finding is tagged **[keep]** (already right), **[fix]** (correctable now), **[decide]** (needs the design lead), **[gate]** (needs a usability test).

---

## 1. The ten UX laws of MANDATE (derived, not invented)

These are the rules every screen in every part must obey. They restate §1, §12 and §16.4 as testable laws.

1. **Every screen is one physical object.** No dashboards, no card feeds, no app chrome. If a new system needs a UI, it needs an *object* first. **[keep]**
2. **The paper cites the law.** Every document shows its constitutional authority — one flip away, never buried. **[keep]**
3. **Specific numbers, always.** ₦214,371,000, never "a shortfall". Round numbers break the spell. **[keep]**
4. **Hidden information is shown as ranges, not bars.** Pencil estimates with sources and confidence; never a percentage the sim "really" has. **[keep]**
5. **Feedback is a mark on paper, not UI chrome.** Confirmations land as stamps, ink, marginalia and filed notes — never as green toasts or checkmark snackbars. **[fix — prototype toast]** 
6. **Time is felt, not listed.** Desk Hours, the FAAC drop, strike windows and tribunal dates must be visible *in the world* (a desk clock, a circled date), not in a status bar. **[fix — absent from prototype]**
7. **Consequences surface as the world responding.** The ledgers the player writes are echoed back in the next week's documents, not in floating "+2 favours" popups (§19.1). **[keep — content side]**
8. **Understanding costs something, but never excludes anyone.** Max-jargon default (§53.1) must sit beside Learner Mode, gloss taps, and the plain-text sidecar (§12.8). The tension between law 8 and law 1 is the single biggest UX risk in the design. **[decide — see §6]**
9. **One hand, one life, one save.** Portrait one-handed play; every commit is a write-ahead event; no confirmation-dialog spam — the *stamp* is the confirmation. **[keep]**
10. **The object carries its state.** Coffee ring = opened and unacted; fold = forwarded; red biro = urgent; a file in the cabinet = decided. State lives on the material (§12.1 rule 3), never in a separate "status" column. **[keep — prototype implements ring/fold/biro]**

---

## 2. Global patterns (apply to every part)

### 2.1 The session loop (one week)
Triage → read → act (stamp / decide / annotate / delegate) → spend Desk Hours → **end week** → tidying-the-desk animation (§13.1, never a spinner) → new inbox slides in.

**[fix]** The prototype has no week-close gesture. Recommendation: a physical **blotter/closing strip** at the tray's foot — *"Nothing else this week — close the desk"* — that runs the tick. It doubles as the commitment boundary for the autosave (§3.7), so the save ritual and the gesture are the same act. **[gate]**

### 2.2 Three reading depths
Every document should support: (1) **headline depth** — title, object type, urgency mark, one-line tray summary (3-second triage); (2) **body depth** — the actual paper; (3) **forensic depth** — verso authority + audit trail + annotations. The prototype implements all three. **[keep]** Rule: nothing in depth 1 may require depth 3 to act.

### 2.3 Alerts and urgency (§11: loud and layered, never generic banners)
Priority order on a phone: material marks (biro, ring) → red deadline marginalia → a *sound bed* (generator hum rising, §12.6) → ticker crawl on the desk header for one-off news → only then a system notification (opt-in). **Never** badge-count as the primary urgency cue; badges are a summary, the paper is the message. **[keep in principle; prototype badge = summary only — keep]**

### 2.4 Gestures need visible twins (§12.2 vs. reality)
Swipe-pinch-two-finger-tap are fine on a phone but fail on desktop, on accessibility switch controls, and as *discoverable* actions. Rule: **every gesture has a button twin** in the action bar. Prototype: flip = button + ℹ icon ✔, annotate = button ✔, stamp = hold button ✔. Missing twin: pinch-to-open-folder — needs a literal "OPEN FILE" affordance when it lands. **[fix when folders ship]**

### 2.5 Danger and reversibility
Stamps are irreversible-by-design (one life). Therefore: the hold-to-slam *is* the friction, and the UI must show what a stamp will do *before* it lands. Recommendation: while holding, a ghost preview of the stamp position + the ledger line it writes appears on the page. Refusal/decline is always an equally prominent option, never a grey "cancel". **[fix — add stamp preview at M1]**

### 2.6 Empty, loading and error states as paper
- Empty cabinet: pencil note *"Nothing yet. The paper keeps what you do."* **[keep — implemented]**
- Tick running: desk tidying itself (documents stacking, lamp dimming) **[not built — M1]**
- Save/storage failure: a red-ink **"FILE NOT SAFE"** slip on the desk, retry by tapping — never a browser dialog. **[fix — build with persistence]**
- Tab discard resume (§17.1): on return, the same document reopens at the same scroll offset with an ink-note *"resumed"*. **[gate]**

---

## 3. The screen catalogue — every part of the game

Format: **Object → core interaction → UX risks → recommendation.** Section refs to the master doc.

### Part I/II — the office loop

| # | Screen (§ ref) | Object | Core interaction | UX review |
|---|---|---|---|---|
| 1 | Situation Desk (12.3) | Desk + in-tray | Triage, open, close week | **[keep]** tray materiality. **[fix]** Desk Hours meter + FAAC/deadline rail belong here (§26). Add closing strip (2.1). |
| 2 | Exco Minutes (12.3) | Handwritten minutes, binder clip | Act on 4 numbered items | **[fix]** each numbered item must link to its own decision/document — cross-linking is the spine of the loop (prototype: item→decision links missing, being added). |
| 3 | Gazette Memo (12.3) | Official gazette page | Hold-slam stamp, sign | **[keep]** signature-as-stroke + typed fallback (§12.4 accessibility rule). **[fix]** stamp preview ghost (2.5). Watch: gazette cites federal s.162 while a governor signs — see open decision. **[decide]** |
| 4 | Dossier / Fifth Schedule (5.3) | Declaration form + pencil estimates | Read ranges, commission intel | **[keep]** printed = verified, pencilled = scouted. **[fix]** each range needs a *tap → source + last-updated + confidence* sheet, and a visible decay hint ("stale" ticks) or ranges feel arbitrarily vague (risk: "systems too opaque", §16.1). |
| 5 | Promise Book (12.3) | Hardcover ledger | Handshake gesture, review kept/broken | Two-finger handshake needs a button twin (2.4). Show promises as *due dates circled in red*, sorted by "when saying no is most expensive" (37.4). **[fix]** |
| 6 | The Sow — ward map (9.3) | Hand-drawn map stapled to memo | Drag seeds, glow rule on capture | Skill-moment glow is good feedback. **[risk]** on small screens dragging = fat-finger; needs undo ("retrieve the seed") free within the week and zoom-to-ward. **[gate]** Scope: ward/LGA only (16.2). |
| 7 | Collation Sheet (12.3) | Thumbprint-smudged result form | Inspect, query, adjust (risk) | The most ethically loaded screen. **[fix]** rigging actions must be *quiet by design* (no glow, no sound, the paper must not celebrate them) and immediately write visible Evidence seeds on the verso. **[decide]** exact risk presentation with sensitivity readers (§14). |
| 8 | Tribunal Summons (12.3) | Court summons, red stamp | File, adjourn, settle | Dates must dominate (a stamped hearing date, a paper calendar tear-off). Countdown in red pencil, not a timer widget. **[keep/fix]** |
| 9 | Press Desk (12.3) | Clippings + radio schedule | Draft statements, plant leaks | Three inputs (draft, outlet choice, deny/plant) — keep as *three slips on one desk*, not tabs. Radio = audio waveform object with a play strip; captions always (audio is decorative-informational, §12.6). **[fix]** |
| 10 | Budget Ledger (12.3) | Accountant's ledger | Allocate, release, audit | **[keep]** prototype's pending-unsanctioned rows. Add the **salary-day clock** (§44.2) — salary day is the month's pulse. Gross-vs-net must be visually separated or players "read only the gross headline" (§44.2). **[fix]** |
| 11 | Oath Card (12.3) | Seventh Schedule card | Take oath (ceremony) | Ceremony screen: slow, one-thumb, no other input. Use once per office. **[keep]** |
| 12 | Legacy Archive (10.4, 12.3) | Locked filing cabinet | Review files, choose protege | Drawer-pull metaphor. Protege choice = three files on the desk; the choice carries to next life — give it ceremony weight (no undo). **[fix: build at M3]** |
| — | Service Record, Three Clippings, Whisper Sheet, Enemy's Dossier (18.6) | Stapled file / cuttings / rumour sheet / rival's file | Review the three mirrors | **[keep]** each mirror biased in its own way; add outlet-masthead + date so bias is *learnable*. Enemy's dossier = the only place the player sees what opponents can prove — make its redactions literal scrawls (§37.7 pattern). **[fix]** |
| — | Consequence views (19) | The six ledgers | — | **Never a stats page.** Ledgers are read back *by the world*: an aide's note listing what you planted (19.2), a successor's file, a post-mortem file after failure (§post-mortem, honest teacher). Recommendation: a **"Your record" section inside Files**, written as an aide's weekly précis in handwriting. **[decide]** |
| — | Post-mortem file (§feel) | Aide's honest memo | Read what mattered | Sits in Briefings after major failure; must arrive as *paper*, with the decisions that mattered circled. Never called "tutorial" or "report card". **[keep per doc]** |

### Part III — the living society

| Screen | Object | Core interaction | UX review |
|---|---|---|---|
| Allegiance Map (37.7) | Hand-drawn web on butcher paper, corkboard | Read line kinds, annotate | Line grammar (solid/dashed/pencil/red/knotted/torn) is excellent — but **colour-only + texture needs a legend that is itself an object** (a pinned index card), and the map needs pinch-zoom with one-thumb pan. Redactions as scrawls: **[keep]**. **[gate]** line-kind legibility at 360px width. |
| State / Cleavage Map (38.3) | State outline, allegiance colours, overlays | Toggle overlays incl. "Who owes whom" | Overlay toggles should look like **translucent tracing-paper sheets** laid on/off the map — material metaphor, persistent labels, max 3 layers at once. **[decide]** |
| Sentiment & community ledgers (33) | — (not yet designed) | Read a community's expectations | **[fix]** must be an *in-world object*: a town-union secretary's minutes or a market-women's bonnet? Recommendation: **Community file** — one folder per community with the expectation ledger written as letters received. Never a 12-dimension radar chart. |
| Rumour / Whisper sheet (18.6, 35) | Rumour sheet graded by credibility | — | Credibility as pencil grades (★★☆ written, not filled icons). Source line always visible; bias learnable. **[keep]** |
| Receipts & Spot-the-Tell (36.3–36.5) | The player's red pen over invoices/vouchers | Mark inconsistencies | The red pen already exists in the prototype — reuse it as the detective tool. Wrong marks must visibly *cost* (hours burn, a pencilled "apology" note). **[fix: build at M2]** |
| Scheme cards (36.4) | Nicknamed cards w/ tell + Cover Integrity | Study, imitate, detect | Cards are the game's best teaching object: keep nicknames as **rubber-stamp titles**. Cover Integrity = a wax seal that cracks. **[decide]** |
| Bribery interaction (20.7) | Brown envelope / gift object | Frame + intermediary + amount | Amount entry must be a *physical* slider (notes in a bundle), not a keypad; "too little insults, too much suspects" needs pre-send feedback the player can *feel* (the receiver's face/Ask style as a margin note). **[gate]** |
| Alliance foreplay ladder (21.2) | — | Climb 7 rungs with an ally | **[fix]** render the ladder as **seven rungs drawn in the ally's dossier margin**, current rung ticked; cold-jump penalties shown *before* the move (pencilled warning). Never a progress bar. |
| Party desk (55.8) | Document set | Congress notice, delegate lists, screening reports | Delegate lists = tickable paper with rubber stamps for blocs; totals added by hand and cross-checked. **[fix: M3]** |

### Part IV — the sector engine

| Screen | Object | Core interaction | UX review |
|---|---|---|---|
| Sector Brief (50.5) | Briefing binder w/ coloured dividers — notebook (ward) → ring binder (governor) → tabbed file (minister) → folded sheet (president) | Read, tap-to-gloss | The object changing *with office* is a signature move: **[keep]**. Risk: dividers-as-tabs on 360px → use tab-edges with hand-written labels rotated 90°. |
| One event, ten desks (48) | Same fact, ten objects | — | Perfect demo screen (51.3: grid-collapse at three desks + literacy slider). **[fix]** literacy slider should be the **aide** (ask the aide = pay Desk Hours) not a bare slider — §53.1 already rules this; make the UI obey the ruling. |
| Jargon & gloss (43.4, 53.1) | Underlined term → pencil-note gloss | Tap term; pay time | Default mode **Native (max jargon)** per §53.1. Gloss = *pencil note in the margin*, biased by the aide giving it (loyalty colours wording). **[keep]**. Learner Mode in Settings must be plainly labelled and honest (marks the obituary) — **[keep]**. |
| Information Lens view (43.2) | — | Understand lag/noise/bias | Hardest UX problem in the design: the player must *feel* that truth → measurement → chain → document distorts. Recommendation: a **"chain of hands" margin diagram** on each sector document — who carried it, what they changed — revealed progressively with literacy. Never a data pipeline diagram. **[decide]** |
| Capture score / lobbies (49.2) | — | — | Show capture as **furniture in the regulator's office** (the same three faces in every photo?) in documents, not a 0–100 dial. **[decide]** |

### Part V — weight of office & appointments

| Screen | Object | Core interaction | UX review |
|---|---|---|---|
| Handover Note (53.1) | Outgoing aide's memo | Read, dismiss | In-world onboarding — **[keep]** ruling. Implementation: first item in the tray, dismissible, never returns (being added to prototype). |
| Offers (55.6) | Appointment letter(s) | Accept / negotiate / refuse | Multiple simultaneous offers = overlapping letters on the desk, each with its own post-it terms; refusing draws a red line through it and writes the favour cost. **[fix: M3]** |
| Screening scene (55.6) | Panel table, transcript | Q&A with jargon-heavy questions | Question as an audio-less transcript: panel member's stance shown as their *written note of you* appearing live on the margin. No timers (§12.8). **[gate]** |
| Committee allocation list (55.11) | Typed list + handwritten amendments | Assign seats | Direct-manipulation: drag names between seats; hand-written amendments persist exactly as made. **[fix: M3]** |
| Running-Mate balance sheet | Mockup 2 object | Compare zones | Already prototyped. **[keep]** red-pen circle language. |

### System & shell screens

| Screen | Object | UX review |
|---|---|---|
| Tick progress | Desk tidied overnight (13.1/17.3) | **[fix]** build at M1; must be skippable after first view; never block input for >1.5s (budget §17.1). |
| Settings | A **desk drawer** with typed dividers: Accessibility / Language / Audio / Data Saver / Save | Learner Mode, text scale to 150%, high-contrast paper mode, dyslexia-friendly face for handwriting docs, haptics toggle, Pidgin toggle (12.7–12.8). **[fix: define at M1, build at M2]** |
| Save / one-life | The journal (3.7) | Autosave-on-commit only; show saves as *"filed"* ink marks, not spinners. No manual reload UI — by design. **[keep]** |
| Offline | Paper world | Fully playable offline (§17.1): the only network-UI is cloud backup (later) shown as an optional *"post"* envelope in the drawer. **[keep]** |
| Expanded layout (2.1) | Desk with 2–3 documents, reference shelf | Tray-left / surface-centre / shelf-right. Documents stay identical objects; only the desk grows. Watch: two documents open on the same topic must not sync-scroll. **[gate at M2]** |

---


---

## 4. Typography, contrast and numbers (measured)

### 4.1 Type system (§12.5) — roles are right, sizes need a floor

| Role | Face | Used for | Finding |
|---|---|---|---|
| Editorial serif | Playfair Display | gazettes, headlines | **[keep]** contrast role: authority |
| Typewriter/mono | Courier Prime | memos, ledgers, tables | **[keep]**; monospace tables need tabular alignment or numbers wobble — pad columns |
| Handwriting | Caveat (neat) + Shadows Into Light Two (hurried) | minutes, marginalia | **[keep]** two-hands rule; §28.1 plans 6 hands — budget memory, lazy-load rare hands |
| Condensed grotesque | Oswald | stamps, labels | **[keep]** |

**[fix] Size floor:** nothing below 11px anywhere; labels below 10px fail the 150%-text-scale budget (§12.8) and get worse on a 360px Android. The prototype's 9–10px micro-labels are being raised.

**[fix] Contrast:** pencil grey `#6B6A63` on paper `#E9E0C9` measures ≈ 3.9:1 — **fails WCAG AA (4.5:1) for body text**. Darken pencil *text* to ≈ `#57564F` (≈ 5.1:1) while keeping `#6B6A63` for decorative strokes only. Red `#B3261E` on paper ≈ 5.4:1 ✔; biro `#2B3A67` ≈ 9.6:1 ✔; stamp-on-red reversed text needs weight ≥ 700 ✔.

**[keep] The 6-hand + 40-stamp plan (§28.1)** — but stamp variants must differ in *texture*, not in label wording; "colour-blind-safe stamps (shape + colour)" (§12.8) means APPROVED and DECLINED need different shapes or border grammar, not only red vs blue.

### 4.2 Naira and dates
- Always `₦84,700,000` — comma-grouped, no decimals, minus sign as a red parenthetical `(214,371,000)` in ledgers rather than a hyphen. **[fix]**
- Dates: `8 OCT 2026` on documents; relative pressure ("in 6 days") only as red marginalia, never as a widget. **[keep]**
- Kobo exists in the sim (§3.4) but the *display* layer must never show kobo in player documents. **[decide — confirm]**

---

## 5. The big tension: max jargon (§53.1) vs. usability (§16.1)

§53.1 rules Native register at full density by default, with understanding costing Desk Hours (aide gloss, reference shelf, mentor) and **Learner Mode** as the honest accessibility escape. §16.1 lists "UI too ornate to be unusable" as a top risk. These coexist only if the following UI contract is built:

1. **Every jargon term is tappable always** — in Learner Mode free; in Native mode the tap shows *"ask the aide (¼ Desk Hour)"* first. The tap target must be visually clear (dotted underline in pencil, not colour-only).
2. **The aide's gloss is biased and says so.** After the gloss, a footer line: *"— as explained by X (loyalty 62, confidence: medium)"*. This converts §5.2's over-trust trap into readable UI.
3. **Reference shelf** = a physical book on the desk: free, slow, teaches literacy permanently. Must be reachable from *inside* a document (bookmark ribbon icon), not only from Settings.
4. **Learner Mode is labelled in plain English** ("Plain-language mode — for anyone new to Nigerian public finance"), does not change simulation, and marks the obituary (§53.1) **[keep ruling]**.
5. **Misreading must be visible after the fact**: when a misread costs you, the post-mortem circles the term with the gloss you *would* have seen. Otherwise max-jargon reads as unfair, reviving §16.1's opacity risk.

**[gate]** Usability test G-LEX: give three players (political novice / Nigerian politics-literate / diaspora) the same FAAC memo in Native with aide available; measure: can they state the shortfall, its consequence, and what an "derivation tranche" is, within 90 seconds without help? Pass = 2/3 with no help or one aide tap.

---

## 6. Prototype audit (M0) — what's in, what's missing

Implemented and passing **[keep]**: object-per-screen with12 templates; three reading depths (tray line / body / verso authority + audit); material state (coffee ring, fold, biro); stamp hold-and-slam with pressure→splatter; signature stroke + typed fallback; red-pen annotations persisting to verso + Files; tab bar as folder tabs; decisions writing named ledgers; pending budget rows unsanctioned; empty state as pencil note; reduced-motion honoured.

Audit findings and disposition:

| # | Finding | Class | Disposition this pass |
|---|---|---|---|
| P1 | No Desk Hours anywhere — §26's economy is invisible | fix | **Adding** a Desk Hours meter on the desk header, spending as you decide |
| P2 | Documents don't link to their decisions (minutes↔decisions) | fix | **Adding** cross-links both ways |
| P3 | No in-world onboarding (Handover Note, §53.1) | fix | **Adding** the Handover Note as first tray item, dismissible |
| P4 | Toast confirmations are app chrome (violates law 5) | fix | **Restyling** as a torn paper slip + aria-live |
| P5 | Pencil-grey text fails AA; micro-labels <10px | fix | **Raising** size floor + darkening pencil text |
| P6 | Choice-grammar marginalia (§26.4) absent from options | fix | **Adding** pencilled axis tags per option |
| P7 | No deadline/FAAC pressure visible on the desk | fix | **Adding** a red-pencilled deadline rail |
| P8 | No week-close gesture / tick animation | fix (M1) | Documented (§2.1); not built |
| P9 | Stamp ghost preview before landing (§2.5) | fix (M1) | Documented; not built |
| P10 | Dossier range tap→source sheet | fix (M1) | Documented; not built |
| P11 | Landscape/Expanded layout, Sector Brief, settings drawer | later | Documented in catalogue |

---

## 7. Usability gates (extends §16.4)

| Gate | Task | Pass condition |
|---|---|---|
| G-TRIAGE | Open the desk cold; no instruction. Count seconds to first document opened | < 10s for 4/5 testers (matches the first-ten-seconds script, §12.9) |
| G-AUTHORITY | "Which law lets the Governor do this?" on a random doc | Found via flip by 4/5 without help |
| G-STAMP | Stamp the gazette, then sign it | 5/5 complete unaided; 0 accidental double-stamps |
| G-HIDDEN | Read a dossier: state what the pencil numbers mean and their confidence | 4/5 mention "estimate/range/source" unprompted |
| G-LEX | see §5 gate | see §5 |
| G-ONEHAND | Complete the week holding the phone one-handed at 360px width | 0 mis-taps closing a document |
| G-SIDE | Enable plain-text sidecar + 150% text scale; complete a week | No horizontal scroll, no clipped controls |

---

## 8. Open decisions this review adds to §16.3 / §30.2

1. **Gazette authority mismatch** (federal s.162 vs a state governor signing): either the mockup's federal header stays as *federal money through state hands*, or the object becomes a state gazette citing ss.121–125. Affects screen 3 template and citation-check CI. **[decide]**
2. **Ledger read-back form**: aide's weekly précis (recommended) vs. a dedicated Files section vs. both. Affects §19 UI.
3. **Sentiment/communities object** (Part III): community file folder (recommended) vs. letter stack.
4. **Information Lens "chain of hands" margin diagram** — new persistent UI element on sector documents; confirm before Part IV build.
5. **Shape-coded stamps** for colour-blind safety: APPROVED rounded / DECLINED slashed? Needs art direction sign-off.

---

*End of review. Paired prototype changes (P1–P7) are implemented in the running preview.*

---

## 9. Addendum — backlog items now implemented (same review cycle)

| Item (from §8/§7) | Status | Where |
|---|---|---|
| Sector Brief — one event, three desks (§51.3) | **Built** | tray document "Sector Brief — the grid collapsed": ward voice-note / governor brief / minister report switcher |
| Tap-to-gloss jargon + misreading risk (§43.4) | **Built** | dotted-underlined terms; Learner Mode glosses free, otherwise *ask the aide (¼ Desk Hour)*; fine print unlocks at literacy ≥ 3 |
| Literacy slider | **Built** | 0–5 on the Sector Brief; drives chain redactions |
| Information Lens — chain of hands (§43.2) | **Built** | on the brief's recto *and* verso; steps redact until literacy reveals them backwards from "your document" to TRUTH |
| Settings drawer — Learner Mode, text scale, haptics (§12.8, §53.1) | **Built** | Files tab → "Open the drawer" (and the reference shelf in Expanded); text scale zooms reading surfaces to 150% |
| Desk Hours + aide cost visible (§26, §53.1) | **Built** | desk header meter; quarters display (`13¾ / 14`) once glosses are bought |
| Spot the Tell (§36.5) | **Built** | tray document "Committee bundle — three bids, one phone": circle lines, *File the finding* → Receipt (+35) or burned hours |
| Expanded layout (§2.1/§12.2) | **Built** | ≥1100px: tray left / working surface centre / reference shelf right (widen the window — the preview panel shows Compact) |
| Week-close gesture, stamp ghost, range source sheet | previously done | §6 P1–P7 |

Still open: full gesture twins for pinch-to-open, Sector Brief per-office content beyond the grid event, official symbol-coloured stamps (art direction).
