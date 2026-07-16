# ADR: Modular split of the god-components

_Generated at: 2026-07-16 14:25 (local)_

## Status

Accepted — implemented 2026-07-16.

## Context

The app grew feature-by-feature and the debt concentrated in two files:

- `Player.jsx` — 1,660 lines: a single component holding ~470 lines of static
  data tables, the ~170-line arranger (`buildSchedule`), pure helpers, and
  ~500 lines of JSX, with 46 `useState` calls.
- `App.jsx` — 530 lines: acted as both the hash router **and** the entire
  Progression page (page + print view + overlay diagram).

Concrete duplication (verified before the change):

- Fret-window math (`maxF<=4?0:…` / `Math.max(startF+4,maxF+1)`) copied in 3 places.
- The note-list renderer (`notes.map(...).reduce(...)`) copied in 2 places.
- The `sk==='s1'?'3-2-1':'4-3-2'` string-set label literal in 4 places.
- The `Promise.all([...preload...])` bundle duplicated across `start()` and the
  live-rebuild effect.
- localStorage `try/catch` + persist effects repeated ~6 times.

There were **no tests**, and the most valuable, most-changed logic (voicing
generation, CAGED matching, the arranger) was pure and eminently testable.

## Decision

Behavior-preserving structural refactor only. No functional changes.

1. **Safety net first** — added Vitest and `music.test.js` (17 property tests
   over all 12 roots × every quality) before touching structure.
2. **Extracted pure data + logic out of `Player.jsx`:**
   - `styles.js` — all arrangement data (progressions, genres, meters, strum /
     drum / bass / backup patterns, section ideas) plus `chordOf` / `numeralOf`
     / `progSummary`.
   - `arranger.js` — `buildSchedule` converted from a closure into a **pure
     function** taking a settings object, plus the path-engine helpers
     (`centerOf`, `posCost`, `pinKeyOf`, `leadPool`, `leadArt`). `Player` now
     wraps it in a thin memo.
3. **Shared diagram helpers** — `fretboard.js` (`fretWindow`, `dotLabel`) and a
   reusable `NoteList` exported from `FretDiag.jsx`, consumed by `FretDiag`,
   `GripDiag`, and the print voicings. `setShort(sk)` derives the string-set
   label from `SETS[sk].strs` instead of the repeated literal.
4. **`usePersistentState` hook** (`hooks.js`) replaced the repeated localStorage
   boilerplate; `preloadSchedule()` deduped the preload bundle.
5. **Split `ProgressionPage.jsx` out of `App.jsx`** — `App.jsx` is now just the
   hash router.

### Deliberately NOT done

- **No single "mega" Fretboard component.** The four diagrams have genuinely
  different geometry (3-string horizontal, 6-string grip, vertical multi-layer
  overlay, print). Only the exact-duplicate parts were shared; forcing one
  component would have risked more than it removed.
- **No `useReducer` migration** and **no retiring of the old `SETS` (s1/s2)
  model.** These carry real regression risk and were out of scope for a
  behavior-preserving pass.

> **Revision 2026-07-16 15:05:** `SETS` has since been retired — the Progression
> page was migrated to the unified `STRING_SETS` cross-set engine as a follow-up
> feature (see [ADR-progression-crossset](ADR-progression-crossset.md)). The
> `useReducer` migration remains deferred.

## Consequences

| File | Before | After |
|---|---|---|
| `Player.jsx` | 1,660 | 1,018 |
| `App.jsx` | 530 | 22 |
| new: `styles.js` / `arranger.js` / `ProgressionPage.jsx` | — | 435 / 242 / 512 |
| new: `fretboard.js` / `hooks.js` / `music.test.js` | — | 21 / 19 / 177 |

- Production bundle: 334.36 kB → 334.24 kB (gzip 100.31 → 99.88 kB — the dedup
  slightly shrank it).
- `buildSchedule` is now pure and importable — the prime future unit-test
  target, though it needs a seeded RNG injected before its randomized branches
  (fills / lead lines) can be asserted deterministically.

## Verification

- `npm run build` green; `npm test` 17/17 green.
- Production build driven in-browser: zero console errors on all pages;
  playback runs through the extracted arranger, the cross-set path engine works,
  `usePersistentState` round-trips to localStorage, and all four diagram
  consumers (Player cowboy/triads, Progressions, Print view, Triad Finder)
  render pixel-identical to the pre-change baseline.
