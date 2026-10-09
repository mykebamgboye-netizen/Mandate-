# MANDATE — Situation Desk

A Nigerian political-life game. You are the Executive Governor of Delta State,
eighteen months into a first term, with the general election fifteen months out.
One save, no reload.

This repository is the **working prototype**: a single week on the desk —
Thursday 8 October 2026, EXCO Week 41, Asaba.

## What's here

- **The desk** — an in-tray of physical documents (gazette, FAAC communiqué,
  security digest, tribunal summons, dossiers, clippings, leaflets), all of them
  paper objects with clips, stains, folds and audit trails on the verso.
- **Decisions** — the week's items awaiting your stamp. Nothing irreversible is a
  tap: routine items tap, policy holds one second, career-ending holds three.
- **The treasury is barely solvent** — ₦12bn opening against a ₦18.4bn wage bill,
  about two and a half months of salary cover.
- **The stamp** — press and hold; a dashed ghost lands first with the ledger line
  it will write, then ink lands on exactly that spot.
- **Sector literacy** — tap jargon to gloss it, or spend ¼ Desk Hour on the aide.
  The chain of hands un-redacts backwards to the truth as your literacy rises.
- **Spot the Tell** — red-pen the inconsistencies in a committee bundle.
- **The transfer slip** — one encrypted export that burns the desk it came from.
  Not save-scumming; succession.

`MANDATE-UI-UX-REVIEW.md` is the full UI/UX direction and review document: screen
catalogue, measured contrast audits, usability gates and open decisions.

## Stack

React 18 · TypeScript (strict) · Vite 5 · Vitest. No runtime dependencies beyond
React. Fonts are loaded from Google Fonts in `index.html`.

## Running it

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # tsc -b && vite build
npm run test       # vitest run
```

## Layout

```
src/
  App.tsx            the desk: Briefings, Allies, Decisions, Budget, Files
                     + the settings drawer and the Expanded (≥1100px) layout
  DocumentView.tsx   one open document: recto, verso, stamp, red pen, signature
  templates.tsx      one renderer per document kind
  Stamp.tsx          press-and-hold stamping, ink splatter, thud
  hold.tsx           the hold-to-commit ladder (levels 1/2/3)
  content.ts         the content pack — the sample week, decisions, dossiers
  game-context.ts    settings, the aide, per-sector literacy
  styles.css         design tokens + document materials
  sim/               deterministic simulation core
    rng.ts           seeded PRNG, one stream per subsystem
    ledger.ts        kobo-exact BigInt ledger, conservation enforced
    bus.ts           command → event, legality + feasibility + exposure
    perception.ts    the perception decay/update model
    world.ts         world container, replay, stable state hash
    sim.test.ts      golden replay + determinism tests
```

## Content policy

People, parties, papers and firms are fictional. Places, statutes, institutions
and constitutional sections (s.162, ss.121–125, ss.192–194, ss.214–216, the Fifth
and Sixth Schedules) are real.
