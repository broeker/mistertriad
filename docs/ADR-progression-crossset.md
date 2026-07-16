# ADR: Cross-set voice-leading on the Progression page

_Generated at: 2026-07-16 15:05 (local)_

## Status

Accepted — implemented 2026-07-16.

## Context

The app had two divergent string-set engines (see
[ADR-modular-refactor](ADR-modular-refactor.md), which flagged this seam):

- **Progression page** — old two-set model (`SETS` = `s1`/`s2`, 3-2-1 & 4-3-2),
  **sticky-set** path: pick a starting voicing, voice-lead every later bar on
  that *same* set via `closestVoicing`; sets only changed on a manual alt-pick.
- **Player / Triad Finder** — `STRING_SETS` (four colored sets) with **cost-based
  cross-set** voice-leading (`posCost`) that hops sets to minimize hand movement,
  plus a **pin** model to override any bar.

The user wanted the Progression page to use the cross-set engine while keeping
full per-bar override ("switch out triads at will") and gaining a global
neck-position control.

## Decision

Port Player's engine into `src/ProgressionPage.jsx`, reusing the already-extracted
`centerOf` / `posCost` / `pinKeyOf` from `src/arranger.js` and `STRING_SETS` /
`getVoicings` / `closestVoicing` from `src/music.js`.

- **State:** replaced `startChoice`/`overrides`/`showAltIdx` with `selectedSets`
  (default `321`,`432`,`543`), `posIdx`, `pins` (`{barIndex: pinKey}`), `pickIdx`.
- **Path:** `candidatesFor` (voicings across active sets, tagged `.set`) →
  `pathForAnchor` with pins → `posCost` (multi-set) or `closestVoicing` (single).
  Dropped the parallel `pathSets` array — each voicing carries its `.set`.
- **UI:** color-coded String-Sets toggle chips; **Position ▼/▲** stepper
  (re-anchors the whole path up/down the neck); per-bar **Voicings** picker
  grouped by set with pin / **Auto** (unpin). Bar cards, arrows, details table,
  Overlay, and the Print view all read `v.set`.
- **Retired `SETS`** from `music.js` — the app is now unified on `STRING_SETS`.

### Behavior notes

- A pin is **non-destructive**: pinning a bar no longer wipes downstream picks
  (later bars re-lead from it automatically). Pins persist even if their set is
  toggled off — they go dormant and are restored when the set returns. The
  "Pinned" badge reflects the pin *actually in effect*, not merely stored.
- **Not ported:** Player's climb / vary / loop modes (playback-only; this page is
  a static chart).

## Consequences

- The path can now cross sets between bars (the point) — a behavior change from
  the old predictable sticky-set model, so there is no pixel baseline to match.
- One engine, one mental model, shared helpers across all three pages.
- Bundle: 334.24 → 337.13 kB (gzip 99.88 → 100.58 kB) for the added UI.

## Verification

- `npm run build` + `npm test` (17/17) green.
- Production build driven in-browser across a I–IV–V–vi in C: cross-set path,
  Position stepper shifting the whole path up the neck, cross-set pinning with
  downstream re-lead, 6-5-4 toggle, single-set fallback, dormant-pin badge
  honesty (disable then re-enable a pinned set), Overlay, details table, and
  Print view — all correct, zero console errors.
