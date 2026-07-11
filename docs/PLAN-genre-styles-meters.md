# Genre → Style hierarchy + time signatures (3/4, 6/8)

> Generated at: 2026-07-10 20:18 CDT

## Revision log

- **2026-07-10 20:18 CDT** — Initial version; implemented in the same session.
- **2026-07-10 ~21:30 CDT** — Tuning infrastructure: audio transition fixes
  (cancelPending for seamless live rebuilds, deeper stopAll fade, master
  limiter, 450ms scheduling horizon); per-style `mix` volume multipliers on
  GENRES + "Copy style" button + `bake-style` project skill for baking Tim's
  ear-tuned settings; measured per-sample-set loudness trims (`SET_TRIM` in
  audio.js — Fluid −4dB, E.Jazz +1.2dB, E.Muted +4dB compromise) and
  provisional per-style mixes pending Tim's one-by-one ear passes.

## Context

The Player's 11 flat genres were getting crowded and everything was hardcoded 4/4. This round:

1. **Genre → Style picker** — styles grouped under 6 genre tabs (Country, Blues, Folk, Rock & Pop, Jazz & Latin, Groove). A style is exactly what a genre was before: a preset bundle of meter/tempo/feel/strum/drums/bass/lead/keys/samples plus a progression list.
2. **Meter support** — 3/4 and 6/8 alongside 4/4, built meter-generic so future meters are data-only.
3. **8 new styles** — Honky-Tonk, Rockabilly, Rock & Roll, Piedmont Blues, Country Waltz, Folk Waltz, Jazz Waltz, Slow Blues (6/8) — 19 total.

All changes live in `src/Player.jsx`; `src/audio.js` schedules events at absolute times and needed no changes.

## Design

### Meter model

`METERS` table: `beats` (bar length in pattern-time units), `grid` (the bar's subdivision — lead lines and fill placement derive from it), `swing` (whether the Shuffle feel applies). Pattern `b` values are quarter-note beats in simple meters; in 6/8 they're dotted-quarter **pulse** units (tempo = pulse bpm) with eighths on thirds — so 6/8 has `beats:2` and a grid of `[0, 1/3, 2/3, 1, 4/3, 5/3]`. Shuffle is forced straight (and the button disabled) in 6/8 since compound meter is already triplet-based.

`barDur = METERS[meter].beats * spb`. Drum fills, keys fills, and lead fills land on the last 3–4 grid slots instead of hardcoded 4/4 beats.

### Patterns are meter-keyed data

- `STRUMS[key].p` is keyed by meter; a strum supports only the meters it defines. Folk/Travis/Lo-fi cover all three meters; Boom-chick adds 3/4; Bluegrass/Pop/Bossa/Funk are 4/4-only.
- `DRUM_PATTERNS[mode][meter]` — extracted from the old inline code (4/4 transcribed exactly). Stomp/Kit/Train cover all meters, Swing adds a 3/4 jazz-waltz ride; Bossa/Funk are 4/4-only.
- Bass modes: Root/Root–5th/Walking work in all meters (per-meter shapes); Boogie/Bossa/Funk are 4/4 idioms (`BASS_METERS`).
- Keys comp: 4/4 as before, 3/4 oom-pah-pah, 6/8 both pulses.
- The UI hides unsupported patterns for the current meter; `applyMeter` pulls invalid knobs back to safe ones (Folk/Kit/Root–5th) in the same update, and `buildSchedule` has the same fallbacks as a guard against stale combos mid-rebuild.

### Genre tree

| Group | Styles |
|---|---|
| Country | Old-Time, Bluegrass, Honky-Tonk, Alt Country, Country Waltz (3/4) |
| Blues | Blues, Piedmont, Slow Blues (6/8) |
| Folk | Folk, Folk Waltz (3/4) |
| Rock & Pop | Pop, Indie Pop, Rock & Roll, Rockabilly |
| Jazz & Latin | Jazz, Bossa Nova, Jazz Waltz (3/4) |
| Groove | Funk, Lo-Fi |

Picker: a row of group tabs (browsing only; a dot marks the tab holding the active style) over a row of style chips (clicking applies the bundle via `applyGenre`). Non-4/4 styles show their meter on the chip.

### Persistence

Saves store `meter`; legacy saves load as 4/4. `loadEntry` validates strum/drums/bass against the loaded meter and falls back like `applyMeter`. Progression `set` overrides may pin `meter`.

## Follow-ups

- New style bundles (tempos, band choices) and the 3/4 / 6/8 patterns ship as reasonable defaults — to be tuned by ear.
- Honky-Tonk / Rockabilly / Rock & Roll use the E.Jazz hollowbody sample set as the "electric" — no Telecaster-style sample set exists yet.
- Candidate future meters (data-only now): 2/4 march/polka, 12/8, 9/8.
