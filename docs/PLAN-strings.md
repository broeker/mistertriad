# PLAN: Multi-set strings selector + dial-in triad picker

_Generated 2026-07-15._

## Goal

Let the user choose **multiple** string sets and, in the per-bar triad picker,
pick alt voicings from **any** chosen set — the manual "dial-in" workflow —
while keeping an intelligent auto ("Magic") mode on top.

## Background — how the strings/triad engine works today

- **Search space** (`candidatesFor`, `Player.jsx`): every triad voicing of a
  bar's chord across the active string sets, tagged with its set.
- **Position** (`anchorsFrom`): derived from **bar 1 only**; a position is a
  neck region (fret window), not a string set — several sets can voice a chord
  inside one position. Drives the Position stepper / climb chips.
- **Path** (`pathForAnchor`): bar 1 takes the position's voicing (sets a fret
  window `win`); later bars minimize `posCost` — dominated by "stay near
  `win`", then pitch continuity, then a nudge against switching sets. Repeats
  reuse the prior shape; a pin forces a voicing and moves the window.
- **Picker** (per-bar popover): today shows only **closed** voicings within
  **±3 frets** of the current shape, from **Auto's sets only (no 6-5-4)**.
  That triple filter is why certain sets' chords never appear.

### Selector today
Single-select: `Auto | 3-2-1 | 4-3-2 | 5-4-3 | 6-5-4`. Auto = the three movable
sets with cross-set voice-leading; a fixed set locks to one.

## Design decisions (confirmed with Tim)

1. **Two modes.** Dial-in = full manual control (pick sets, positions,
   per-position voicings). Magic = intelligent auto that runs up/down the neck
   and can swap chords.
2. **Per-position independence.** A voicing picked in Position 1 does not carry
   into Position 2 — each position remembers its own picks.
3. **Open shapes** appear in the picker when in a low position; movable/closed
   shapes elsewhere. (Open grips only exist low, so this falls out naturally.)

## Phases

### Phase 1 — Multi-select sets + fixed picker (ships the bug fix) — DONE (2026-07-15)
- Replace single `setKeySel` with `selectedSets` (subset of the four sets,
  persisted to localStorage). Chips become independent toggles; ≥1 stays on.
  Default = the three movable sets (preserves today's Auto sound).
- `candidatesFor` spans `selectedSets`; **drop the hard 6-5-4 exclusion**.
- Replace the `auto` flag with `multi = selectedSets.length > 1`; multi uses the
  `posCost` cross-set engine, single uses `closestVoicing` (preserves both of
  today's behaviors).
- Picker: **drop the `!hasOpenString` filter** — open grips show, and only in
  low positions because that's the only place they exist. Picker now shows every
  reasonable voicing of the chord in the current position across selected sets.

### Phase 2 — Per-position picks — DONE (2026-07-15)
- Pin keys `${sec}:${bar}` → `${sec}:${bar}:${position}` in climb/manual, so each
  position remembers its own picks. Vary keeps the bare per-bar key. A bare
  `${sec}:${bar}` key (legacy saves, vary pins) still applies as a fallback
  across every position, so old saved progressions keep their pins.
- `pathForAnchor` reads the position-scoped key (falling back to the bare one);
  `remapPins` preserves the position suffix on structural edits; `barPinKey` /
  `barPinVal` resolve the effective pin for the displayed position (badge, picker
  Auto state, pinned highlight). Picker help text names the position; "Auto"
  clears both the position key and the bare key for that bar.

### Phase 3 — Magic mode
- Refine the auto climb; add chord-swap (substitution / quality) options in the
  picker. Fuzziest piece — design after Phase 1–2 feel right.

### Note — surfacing open shapes (found during verification)
The ±3-fret window is keyed to the current (closed) voicing, whose lowest anchor
sits near fret-center 3.5. A truly open grip has center 0, so `|0−3.5| > 3` — it
was excluded even in first position. Fix: in a low position (`centerOf(cur) ≤ 5`)
the picker also includes any open-string voicing regardless of the window.

## Revision log
- 2026-07-15: Initial plan. Phase 1 built and verified in-browser:
  multi-select chips (persisted, never-empty), 6-5-4 now selectable,
  `multi = selectedSets.length>1` drives cross-set vs single-set engines,
  picker shows all in-position voicings across selected sets, and open grips
  now appear in low positions (e.g. the open D-G-B G on 4-3-2). Production build
  clean. Phase 3 (Magic + chord swaps) pending.
- 2026-07-15: Phase 2 built and verified in-browser. Per-position pins: pinned
  the open 0-0-0 G at Position 1, an independent 5-5-4 at Position 2; stepping
  between positions showed each holds its own pick; unpinning Position 1 left
  Position 2 intact. Position-aware help text and per-position badge confirmed.
  Legacy fallback keeps bare per-bar pins working. Build clean, no console
  errors. Phase 3 (Magic + chord swaps) pending.
