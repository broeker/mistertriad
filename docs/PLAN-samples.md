# Sample Library Plan

> Generated at: 2026-07-10 21:31 CDT

## Revision log

- **2026-07-10 21:31 CDT** — Initial version: current inventory, engine
  requirements, import pipeline, Karoryfer free-library evaluation. More
  candidates to be added as Tim feeds them in.
- **2026-07-10 ~21:40 CDT** — Evaluated VSCO 2 Community Edition (parked;
  solo violin earmarked as future fiddle lead).
- **2026-07-10 ~21:45 CDT** — Evaluated DSK Music (ruled out: VST plugins,
  no redistributable samples). Tightened license criterion: redistribution
  rights required, not just free-to-use.
- **2026-07-10 ~22:00 CDT** — Evaluated sfzinstruments.github.io guitars
  catalog: confirmed queue #1/#2, promoted ganjo (CC0 guitar-banjo) into the
  queue, added BJAM/DamiensFunkyGuitar to audition pool, noted commercial
  Karoryfer line is permission-gated regardless of fee.
- **2026-07-10 ~22:05 CDT** — Promoted Osiris Piano to queue #2 on Tim's ear
  verdict ("notably better than our current piano"). Clarified that the
  redistribution wall never applied to Karoryfer's free (CC0) libraries.
- **2026-07-10 ~22:10 CDT** — Added "Offbeat expansions" section (tuba bass,
  sax leads, choir comp, fiddle, bagpipes, organ) with the
  ride-an-existing-channel integration insight: tuba→bass set, sax→lead set,
  choir/organ→keys set are imports, not new band members.
- **2026-07-10 ~22:20 CDT** — Evaluated FreePats: legacy GM tier skipped,
  modern GitHub SFZ tier added (old-piano-FB, spanish-classical-guitar,
  upright-piano-KW, e-guitar-FSBS, drum kits, world-percussion to audition
  pools; button-accordion-HN and bagpipe to offbeat bench).
- **2026-07-10 ~22:30 CDT** — Evaluated hilbricht.net FOSS list: Salamander
  Grand V3 to piano audition pool; Flame Studios banjo noted as GPL fallback
  for the banjo slot; AVL kits skipped (ShareAlike); setBFree noted as an
  offline-sampling path to an organ set.
- **2026-07-10 ~23:15 CDT** — Imported queue #1 and #2: Black And Green
  Guitars (E.Black/E.Green) and Osiris Piano, with a new piano Samples
  switcher (`PIANO_SETS`), measured SET_TRIM entries, footer credits, and
  `pianoInst` support in genres/Copy style/bake-style.
- **2026-07-10 ~23:40 CDT** — Osiris verdict: Tim not sold; VCSL stays
  default. Imported queue #3 and #4: Shinyguitar (E.Shiny) and ganjo
  (Banjo), trims measured, credits added.

## Current inventory

| Channel | Set (Mixer name) | Source | Format | License |
|---|---|---|---|---|
| Guitar | Musyng, Fluid, FatBoy (default), Nylon, E.Jazz, E.Muted | midi-js-soundfonts renders | flat per-note MP3s (39 notes E2–F5) | CC BY-SA 3.0 (FatBoy), MIT-ish for others |
| Bass | Upright (default) | Karoryfer **Meatbass** | manifest: sparse roots (m3 spacing, MIDI 27–48), velocity layers × round-robins | CC0 |
| Bass | Electric | Karoryfer **Black And Blue Basses** | manifest, same shape | CC0 |
| Drums | (single kit) | Salamander Drumkit + Karoryfer **Swirly Drums** (brushes) | manifest: pieces → layers/RRs | Public domain / CC0 |
| Piano | (single) | Versilian VCSL upright | manifest | CC0 |

Known weakness: **the electrics**. E.Jazz (soundfont) carries Honky-Tonk,
Rockabilly, Rock & Roll, and Jazz; E.Muted is very quiet/percussive (now
trimmed +4 dB via `SET_TRIM`). Real electric samples are the highest-value
upgrade.

## What the engine can use

- **Pitched instruments**: per-note one-shots. Either flat chromatic files
  (`A2.mp3` … like the guitars) or a `manifest.json` with sparse roots — the
  engine retunes between roots via playbackRate (minor-third spacing works
  well). Velocity layers (picked by musical gain) and round-robins supported.
- **Drums**: one-shot per piece (`kick`, `snare`, `hat`, `ride`, `brush`,
  `rim`, `stomp`, `hitom`, `lotom`), layers/RRs supported, `trim` per piece.
- **Doesn't fit**: loop/wavetable synth banks, voice banks, anything not
  per-note one-shots.
- New *instruments* (sax lead, tuba bass, …) are features, not imports — they
  need a channel strip, patterns, and UI, not just samples.

## Import pipeline (repeatable)

1. Download library (SFZ + WAV/FLAC). Check license; credit in the app footer
   regardless (existing convention).
2. Flatten: pick sparse roots (every 3 semitones across the needed range),
   2–3 velocity layers, 2–4 round-robins; convert to MP3 (**needs ffmpeg —
   not currently installed**; `sudo apt install ffmpeg`).
3. Write `public/samples/<set>/manifest.json` (shape: `{type, notes:{<midi>:
   {layers:[[files…]…]}}}`), or flat per-note MP3s for guitar-style sets.
4. Measure loudness (attack RMS, first 250 ms, notes across the range —
   OfflineAudioContext method) against FatBoy (guitars) / Meatbass (basses)
   and add a `SET_TRIM` entry in `src/audio.js` so the set arrives
   level-matched.
5. Wire into `GUITAR_SETS`/`BASS_SETS` (or drum manifest), add the Mixer
   Samples button, add footer credit.
6. Assign to styles via `guitarInst`/`bassInst` in `GENRES` where it fits;
   Tim's ear pass (Copy style → bake-style skill) settles final assignments.

## Evaluation criteria

- Fills a real gap (electrics ≫ everything else right now)
- Per-note one-shots (see engine constraints)
- Sounds better than the incumbent for at least one style
- Reasonable flattened size (a few MB per set; GitHub Pages hosting)
- License: must permit **redistribution**, not just use — the app rehosts
  samples on GitHub Pages. CC0/PD preferred; attribution licenses (CC-BY)
  OK with footer credit. "Free to use" plugin freeware fails this.

## Candidates

### Karoryfer free libraries (evaluated 2026-07-10)

| Library | Verdict | Notes |
|---|---|---|
| **Black And Green Guitars** | ★ import first | Two real hollowbody electrics; targets Honky-Tonk/Rockabilly/Rock & Roll/Jazz — the weakest current sound |
| **Shinyguitar** | ★ audition alongside | Real archtop; same niche — keep the better of the two, or both as distinct flavors |
| **Virtuosity Drums** | ★ round two | Jazzy kit + GM percussion; upgrades Swing ride/Kit realism, real shaker for Bossa |
| **Osiris Piano** | ★ promoted 2026-07-10 | Tim's ear: "notably better than our current piano." CC0 (Karoryfer × Versilian). Piano now touches 8 styles, so high leverage. Import needs either replacing the VCSL set or adding a piano Samples switcher (small: `PIANO_SETS` analogous to `BASS_SETS`). |
| Sneakybass / Ergo EUB / Big Little Bass | ○ low urgency | Alternative bass flavors; Meatbass already good |
| Big Rusty / Unruly Drums / Frankensnare / Hat With The Phat | ○ later | Rock-kit and cymbal alternatives; current kit adequate |
| Gogodze Phu I/II | ○ later | Lo-fi kit (II) could suit the Lo-Fi style; percussion (I) needs new patterns |
| Bear Sax / Weresax / War Tuba / cello / tagelharpa | fun, future | New band members, not sample swaps — each needs channel + patterns |
| String Cyborgs / Cowsynth / Caveman Cosmonaut / Marie Ork / Zamenhof | ✗ | Synth/loop/voice banks — not per-note one-shots (Caveman might flatten, but organ-ish keys is off-core) |

### Further candidates

**VSCO 2 Community Edition** (versilian-studios.com/vsco-community, evaluated 2026-07-10)
Chamber orchestra — strings, winds, brass, orchestral percussion. SFZ + WAV
(44.1 kHz), CC0, ~3 GB full download.

| Aspect | Verdict |
|---|---|
| Format | ✓ compatible — per-note SFZ one-shots, flattenable like the basses |
| License | ✓ CC0 (same developer as the current VCSL piano) |
| Fills current gap? | ✗ — nothing here upgrades the electrics or the kit |
| Real interest | **Solo violin as a future fiddle lead** for Old-Time / Bluegrass / Celtic — the most app-relevant instrument in it. Trumpet/clarinet if jazz ever expands. |
| Caveats | New-band-member territory: a fiddle lead needs a channel, patterns, and note-length handling for bowed sustains — feature work, not an import. And a static sustain library gives long notes and simple fills, not idiomatic fiddling (slides, double stops); expectations should be modest. Orchestral percussion doesn't map to the kit pieces. |

Verdict: **park** — earmark the solo violin for a future fiddle-lead feature;
skip the rest for now.

**DSK Music** (dskmusic.com, evaluated 2026-07-10)
Two tiers:

- *Free tier*: VST/AU plugin instruments (romplers) and SF2/SFZ **players**
  (DSK SF2 v2, DSK SFz Player) — samples sealed inside binaries, no
  importable files. Fails on format.
- *Paid tier*: "HQ Instruments" — 1,640 instruments in SF2/SFZ/WAV/Kontakt,
  $25. Format ✓ and price trivial, but the license is only "royalty-free,
  use in any project" with **no redistribution rights** — and this app
  serves raw per-note files to every visitor, which is redistribution of
  the product itself. Would require explicit written permission from DSK.
- Quality: broad rompler-style content of mixed provenance; unlikely to
  beat current soundfont renders, and not competitive with real CC0
  multisamples (Karoryfer).

Verdict: ✗ **ruled out** (free tier: format; paid tier: redistribution
license; neither beats the queue).

**sfzinstruments.github.io guitars catalog** (evaluated 2026-07-10)
The index for the same GitHub org the basses come from. Findings:

*Free and redistributable:*

| Library | License | Verdict |
|---|---|---|
| Black And Green Guitars | CC0, 500 MB raw | confirms queue #1; release zip: `github.com/sfzinstruments/karoryfer.black-and-green-guitars/releases` (v1.000) |
| Shinyguitar | CC0, 352 MB | confirms queue #2 audition |
| **ganjo** | CC0 (verified LICENSE.md) | **new — promoted to queue.** SX 6-string guitar-banjo: banjo timbre with guitar mapping, drops straight onto the existing strum engine for Old-Time/Bluegrass color. Honest caveat: it's a guitjo, not a 5-string bluegrass banjo, and real banjo rolls would need a new per-string pattern type — as a strummed rhythm timbre it still adds a lot. |
| DamiensFunkyGuitar | unverified | funky muted guitar — potential E.Muted upgrade; check license before import |
| Blue Jeans And Moonbeams | MIT (redistribution OK) | electric + acoustic, FLAC 48 kHz, by "Malaclypse the Younger", Google Drive hosted — audition tier, quality unvetted |
| Emilyguitar, OvationGuitar | CC0 / unverified | acoustics — slot already well covered, skip |

*Commercial (Karoryfer paid line: Glockenskull, Secret Agent 12-string,
Snowkiss/Surfkiss Jazzmasters; Unreal Instruments' Standard Guitar/Metal
GTX "custom" license):* fees are acceptable per Tim, but **the fee doesn't
buy redistribution** — same wall as DSK. Path if ever wanted: email
Karoryfer asking permission to rehost a flattened subset; they CC0 enough
that they might agree. Secret Agent (12-string) and the Jazzmasters would
be the interesting ones if a jangle/surf style ever materializes.

**FreePats** (freepats.zenvoid.org + github.com/freepats, evaluated 2026-07-10)
Two tiers. The legacy GM "Sound Sets" (GUS patches) are the low-quality
soundbank tier — skip. The modern tier is **44 per-instrument SFZ repos on
GitHub with real recordings, mostly CC0** (their stated preference; vet
each repo's license at import — some may be CC-BY). Site blocks direct
fetches; use the GitHub repos.

| Repo | Verdict |
|---|---|
| `old-piano-FB` | ★ audition — "old piano" character; candidate Honky-Tonk-specific piano set |
| `upright-piano-KW` | audition vs Osiris for main piano |
| `spanish-classical-guitar` | ★ audition — real nylon; likely beats soundfont Nylon for Bossa |
| `e-guitar-FSBS-direct` / `-jazz` (+2 dist variants) | electric audition pool next to Black And Green |
| `muldjordkit`, `colomboADK` | drum-kit pool alongside Virtuosity |
| `world-percussion` | real shaker/hand percussion for Bossa (needs drum-pattern hookup) |
| `button-accordion-HN` | offbeat bench — real Hohner, confirmed CC0; keys-channel accordion (Cajun/folk/polka) |
| `bagpipe` | offbeat bench, next to Squidpipes |
| `electric-bass-YR`, `lately-bass`, synths, hang/glass/bells/ocarina | off-core or slot already covered — skip |

**hilbricht.net FOSS sampled instruments list** (evaluated 2026-07-10)
Small curated directory; mostly overlaps what's above (Salamander Drumkit —
already in use; VSCO CE — parked). New findings:

| Item | Verdict |
|---|---|
| **Salamander Grand Piano V3** (PD, SFZ, 16 vel layers) | ★ piano audition pool — arguably the best free piano anywhere; a *grand*, so different character than Osiris (quiet) / KW (upright). Piano bake-off now: Osiris vs KW vs Salamander vs incumbent VCSL. |
| Flame Studios banjo (+guitars/bass) | fallback for the banjo slot if ganjo disappoints — real banjo, but GPLv3 (rehosting legal with license text, just messier than CC0) and GigaStudio .gig format (extra conversion tooling) |
| AVL Drumkits | skip — CC-BY-SA (ShareAlike friction on rehosted MP3s) when CC0 kits (Muldjord, Colombo, Virtuosity) exist |
| Aeolus / setBFree | not samples — synth engines, unusable in-browser directly. **But**: setBFree could be *sampled offline* to mint a Hammond-ish organ set (synth output isn't GPL-encumbered) — noted as the path to an organ set if Caveman Cosmonaut disappoints. |

## Offbeat expansions (keep in mind)

The trick: most of these ride an **existing channel** as an alternative
sample set — much cheaper than a new band member. The channel's patterns
already speak the instrument's language.

*(2026-07-11: the "second rhythm instrument" slot is now real — the
**Backup channel** shipped with banjo Roll/Chop patterns; Bluegrass defaults
to Roll. Mandolin/accordion below now route through `BACKUP_SETS` — each is
a sample import + a chip + possibly a pattern.)*

| Idea | Source / license | Integration path | Cost | Styles it serves |
|---|---|---|---|---|
| **Punk tuba bass** | Karoryfer War Tuba (CC0, 1000+ samples) | `BASS_SETS.tuba` — bass patterns (root, root–5th, walkup fills) are exactly what oompah tuba plays | cheap import | Old-Time gets hilarious/great; future Polka/2-4 styles |
| **Baritone sax lead** | Karoryfer Bear Sax (CC0, 1926 Conn) | lead-channel sample-set switcher (lead currently hardwired to guitar folders — small refactor: `LEAD_SETS`) | moderate | Jazz, Slow Blues, Funk honks |
| **Tenor sax lead** | Karoryfer Weresax (CC0) | same as Bear Sax | moderate | Jazz, Rock & Roll solos |
| **Choir comp** | source TBD — vet VCSL vocal content and other CC0 choirs | keys-channel alternative set ("oohs/aahs" block chords instead of piano comp) | cheap-ish once vetted | Gospel (future style!), Slow Blues, Pop |
| **Accordion comp** | FreePats `button-accordion-HN` (real Hohner, CC0) | keys-channel alternative set | cheap import | future Cajun/Polka/Tejano; Folk color |
| **Fiddle lead** | VSCO 2 CE solo violin (CC0, already parked) | new lead behavior — bowed sustains need note-length handling | real feature | Old-Time, Bluegrass, future Celtic |
| **Bagpipe drone** | Karoryfer Squidpipes (CC0) | needs a drone concept (sustained root under everything) | real feature | future Celtic; maximum offbeat |
| **Organ-ish keys** | Karoryfer Caveman Cosmonaut (CC0, sampled 80s Polish analog keys) | keys-channel alternative set | cheap-ish | Americana/Alt Country pad, Funk |

Notes: sax/fiddle leads inherit the lead engine's articulations —
playbackRate "bends" on a sax read as slides, which is arguably a feature.
Gospel as a style (choir + piano + 6/8 or 12/8) would be a natural
Blues-group addition once a choir set exists.

## Queue

*(All queue items are CC0. The redistribution wall applies only to
Karoryfer's commercial line and DSK — nothing on
shop.karoryfer.com/pages/free-samples is affected.)*

1. ~~Black And Green Guitars~~ **IMPORTED 2026-07-10** → `guitar-black` /
   `guitar-green` (E.Black/E.Green in the Mixer). `ord` articulation
   (main clean picking), 14 roots × 3 vel layers × 3 RRs, 1.7/2.4 MB.
   Trims measured: black 0.45 (ran 8 dB hot), green 0.9. Unused
   articulations parked in the zip: staccato, behind-the-bridge, muted `fb`.
   Tim's first listen (2026-07-10): "awesome" (along with the electric bass).
2. ~~Osiris Piano~~ **IMPORTED 2026-07-10** → `piano-osiris` (Osiris in the
   Mixer's new piano Samples row). UC set, Mic A, 29 roots × 2 vel layers,
   1.6 MB, trim 1.2. VCSL stays the default — Tim not sold on Osiris after
   in-app A/B (2026-07-10); available per-style via `pianoInst` where it wins.
3. ~~Shinyguitar~~ **IMPORTED 2026-07-10** → `guitar-shiny` (E.Shiny).
   Electric variant, native sparse roots 37–81, vl2–4 × 3 RRs, 3.4 MB,
   trim 0.22. Acoustic variant parked in the zip.
4. ~~ganjo~~ **IMPORTED 2026-07-10** → `guitar-ganjo` (Banjo). Single
   layer, filename RRs, roots 39–68 (152 KB!), trim 0.11. High positions
   above sounding MIDI 71 retune-stretch from the top root — acceptable
   for plinky banjo, revisit if it grates.
5. Virtuosity Drums → kit/ride upgrade (needs drum-manifest work, not just notes)
6. (audition pool) Blue Jeans And Moonbeams, DamiensFunkyGuitar (license
   check first), Salamander Grand / Upright KW / Old Piano FB (piano
   bake-off round 2)

Style assignments deliberately unchanged — Tim A/Bs via the Mixer, then
bakes winners per style with Copy style → bake-style (blob now carries
`pianoInst` too).
