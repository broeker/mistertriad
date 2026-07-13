# PLAN — Player UX simplification & practice mode

> Generated at: 2026-07-12 17:35 CDT

## Revision log

- **2026-07-12 17:35 CDT** — Initial plan from UX review session (full-page screenshot of dev build).
- **2026-07-12 17:40 CDT** — Step 1 shipped: `practice` state hides everything but a sticky transport (Play/Loop/tempo/Fullscreen/Exit) and the chart card; diagrams scale up via CSS (`[&_svg]:w-56`, wider cards, larger chord names); screen wake lock while playing or practicing, re-acquired on visibilitychange; fullscreen toggle. Verified in browser both directions.
- **2026-07-12 21:30 CDT** — Section suggestions ("Suggest a chorus/bridge…")
  shipped for Country + Blues genres. Curated degree-based catalogs
  (`COUNTRY_IDEAS`/`BLUES_IDEAS` → `SECTION_IDEAS`) named after public-domain
  classics; a ✨ Suggest button appears on empty Chorus/Bridge tabs and opens a
  ranked card panel (rank: ends on V pulls back to the verse +2, bridge opens
  on a different chord than the verse +2, pass-aligned bar count +1). Applying
  fills the section and clears its pins, same as picking an iconic
  progression. Also fixed Bob Wills: bare `[1]` played II major (toBars
  defaults quality to maj) — now `[1,'min']`. Other genre groups show no
  button until their catalogs are curated.
- **2026-07-12 20:15 CDT** — "Vary" position mode shipped (magic mode, Option
  A). Third mode alongside Loop the neck / Manual: holds one position (picked
  with the ▼/▲ steppers) and plays one pass per same-position shape — bar 1
  rotates through the picker's ±3-fret neighborhood (starting from the default
  shape) and the whole path re-voice-leads from each. Mechanics generalize the
  climb machinery: `pathForAnchor(anchor, startV)` gained an optional bar-1
  override, `passOrder` carries variant indices in vary mode, `passPath(p)`
  resolves either kind, and the scheduler/grid/"next loop" card consume it
  unchanged. Position label shows "shape k/n"; the next-loop card names the
  coming string set. Pins still override everything. Verified live: rotation
  3-2-1 → 4-3-2 → 5-4-3 → back, diagrams and preview card following each pass.
- **2026-07-12 19:35 CDT** — Triad picker separated from the bar editor into a
  popover anchored to the bar card. In Triads view, clicking a bar opens the
  picker in place (no scrolling to the editor); "Edit chord…" inside it opens
  the full editor, ✕ or re-clicking the bar closes it. Cowboy view keeps the
  click-to-edit behavior. `pickIdx` resets everywhere `editIdx` does. Verified:
  pin → whole path re-voice-leads, Auto unpins, Edit chord… round trip.
- **2026-07-12 19:10 CDT** — Bar editor upgrades (follow-on requests): "✕ Done"
  close button; the Voicing row is now a visual triad picker — clickable
  `FretDiag` cards instead of text buttons (amber border = pinned, emerald =
  what Auto is playing). Candidates are filtered to the current position's
  neighborhood (±3 frets of the playing voicing's center) since the Position
  control owns big moves; falls back to the full neck when fewer than 2 shapes
  remain (fixed string sets have one voicing per position).
- **2026-07-12 17:50 CDT** — Reverted the practice-mode diagram scale-up (`[&_svg]:w-56`, wider cards, larger chord names) per Tim: proportional SVG scaling made fret markers/string labels look giant, especially on triad diagrams. Practice mode now renders charts identically to normal view. If bigger practice charts come back, do it inside `FretDiag`/`GripDiag` (larger canvas, same marker/label sizes), not CSS scaling.
- **2026-07-12 17:45 CDT** — Steps 2+3 shipped in one pass (same JSX region): Song card wraps Key/Genre/Progressions; Band card collapses Time/Feel/Guitar/Strum/Drums/Bass/Backup/Keys/Lead behind a header with a live summary line, Mixer panel nested inside; one unified sticky transport (normal + practice modes, tempo lives there now); View/Strings/Position moved into the chart card header (compact chips, work in practice mode too); how-to + credits behind a native `<details>`. Verified in browser: band expand/mixer, triads header controls, practice round trip.

## Problem

The Player page is one flat vertical stack where every control band has equal
visual weight: ~6 rows of song setup, ~5 rows of band chips, then the charts —
the actual payoff — starting below the fold, then a wall of how-to text.
Nothing signals "this is setup / this is sound / this is the music."

Grouping in the current code (top to bottom): header → Key → Genre →
Progressions → Tempo + View + String Set + Position (one wrap row) → Play/Loop
+ Time/Feel/Guitar/Strum/Drums/Bass/Backup/Keys/Lead + Mixer (one wrap row) →
Mixer panel → chart card (Section/Arrangement + bars + bar editor) → save row
→ how-to text.

## Target structure

1. **Sticky transport bar** — Play/Stop, Loop, compact tempo slider, Practice
   toggle. Pinned (`position: sticky`) so it survives scrolling and mode
   changes. Tempo moves here from the song area (serves both modes, removes a
   row).
2. **Song card** — Key, Genre, Progressions in one bordered card with a small
   header. "What am I playing."
3. **Band card, collapsible** — Time, Feel, Guitar, Strum, Drums, Bass,
   Backup, Keys, Lead, plus the Mixer button/panel nested inside. Collapsed by
   default to a single header row with a summary of the current sound
   (e.g. `4/4 · Straight · Boom-chick · Train · Root–5th+Fills`). Rationale: a
   genre tap already sets all of these; the chip rows are override detail.
   Extends the existing Mixer disclosure pattern up one level.
4. **Chart card** absorbs the View controls — View (Cowboy/Triads), String
   Set, Position move into its header next to Section/Arrangement. They
   control what the charts display, nothing about the sound.
5. **Save row** stays below the chart card (may later move into the chart
   header).
6. **How-to text** collapses behind a native `<details>` disclosure.

## Practice mode

One feature covering both "hide everything but charts" and "fullscreen":

- `practice` boolean state. When on: hide header, Song card, Band card, save
  row, help. Keep: sticky transport (Play/Loop/tempo/exit) and the chart card
  (Section/Arrangement strip stays — you want to see which section is live).
- Fullscreen button inside practice mode calls `requestFullscreen()` on top.
  Esc drops fullscreen but stays in practice mode (standard browser behavior);
  the Practice button toggles back out entirely.
- **Screen wake lock** (`navigator.wakeLock`) while playing or in practice
  mode, re-acquired on `visibilitychange` — a practicing tablet must not
  sleep. Silently skipped where unsupported.
- ~~Diagrams scale up in practice mode via CSS~~ — tried and reverted:
  proportional SVG scaling makes fret markers and string labels look giant.
  Practice mode renders charts identically to normal view. If larger practice
  charts are wanted later, add a size variant inside `FretDiag`/`GripDiag`
  (bigger canvas, unchanged marker/label proportions) instead.
- PWA note: the installed app already hides browser chrome, so practice mode
  alone covers tablets; the fullscreen button is for browser use.

## Order of work

1. [x] Practice mode + wake lock + fullscreen (highest value, smallest diff,
       independent of the reshuffle)
2. [x] Sticky transport bar + collapsible Band card
3. [x] Song card + View controls into chart header + help collapse

All render-layer; no audio or scheduling logic changes.

## Out of scope (parked)

- **Offline mode (service worker).** The PWA is installable (manifest + icons)
  but has no service worker, so the app shell and samples need network —
  playing on an iPad away from wifi fails once uncached samples are requested.
  Sketch: precache the app shell (index/JS/CSS/icons) on install;
  cache-first + background-refresh for `samples/**` so any sample set that
  has been *played once* works offline thereafter (full precache of all sets
  is too heavy — Strum Machine gates offline for the same reason). Optionally
  a "download this band" button that warms the cache for the current
  guitar/bass/piano/drum sets. Vite plugin `vite-plugin-pwa` (Workbox) fits
  the existing build; test the GitHub Pages `/mistertriad/` base path
  carefully. Add a small "offline ready / needs network" indicator near the
  transport.

- **Guitar tab export** (rhythm + generated fills/solos). Rhythm is pure
  rendering (grips/triadPath store string+fret; strums are beat-placed with
  direction/span). Lead needs the generator to record {string, fret, beat,
  articulation} instead of discarding them to MIDI (`leadPool` builds notes
  from string+fret already) — then the tab is a faithful "as played"
  transcript of the current loop's solo, one block per pass in climb/vary.
  Start with ASCII tab; VexFlow/alphaTab only if engraving is ever wanted.
  Bass/banjo tab extends the same way.

- Split-bar support (2 chords per bar) for authentic turnarounds — separate
  project touching bar model, editor, grid, scheduler.
- Uppercasing dominant-7 numerals (VI7 currently renders "vi7").
- `FEATURED` progression-row management as with/without-turnaround variants
  multiply.
