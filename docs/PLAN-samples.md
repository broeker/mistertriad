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
- **2026-07-13** — Keys-expansion search (electric piano / Moog / synth —
  first time this slot was searched): jRhodes3 to audition pool (CC-BY-NC
  caveat), Wurlitzer parked pending a license-verified source, no CC0 Moog
  multisamples exist — mint-your-own from FOSS synths noted as the path;
  Caveman Cosmonaut re-elevated as the existing CC0 synth-keys candidate.
- **2026-07-13 (later)** — Tim OK'd non-CC0 use with a commercialization exit
  map (new section below). **Imported jRhodes3c** → `piano-rhodes` (Rhodes in
  the Mixer's piano row): mono looped FLACs, 15 roots (29–96) × 5 vel layers,
  SFZ-parsed layer order, 48 kbps mono MP3, 1.5 MB. Trim 0.75 (attack-RMS vs
  VCSL at roots 55/59/65). Footer credit names the CC BY-NC license.
- **2026-07-13 (later still)** — License criterion relaxed to "freely
  downloadable" (personal-use era; triage section is the commercial exit
  map). New sweep added: Unreal Standard Guitar (best free e-guitar),
  DrumGizmo kits (deepest free acoustic drums), Flame Studios real banjo,
  Pianobook WörliTzer + catalog, AVL kits re-eligible. Sealed formats
  (Kontakt/plugin-only) remain excluded on format grounds.
- **2026-07-13 (night)** — **Imported Standard Guitar** → `guitar-standard`
  (E.Std, Sus_Down articulation) + `guitar-stdmute` (E.SMute, Mute_Down).
  716 MB RAR (Google Drive; portable unrar in scratchpad since no sudo);
  chromatic roots E2–D6 with 8 RRs and filter-modeled dynamics (single
  velocity layer — matches our gain-scaling fine). Flattened every 3rd
  semitone × 3 spread RRs: 51 + 39 files, 1.6 MB total, 48 kbps mono.
  Trims vs FatBoy: standard 0.3 (~10 dB hot), stdmute 1.0. Bundled terms:
  "license-free, no credit required" — credited anyway; triage row added.
  Unused articulations parked in the archive: alternate strokes, slides,
  hammers/pulls, harmonics, brush, fret-mute (interesting for a future
  strum-engine articulation pass).
- **2026-07-13 (acoustic batch)** — Tim wanted the full acoustic audition pool
  (data point: he's been preferring Musyng over FatBoy). **Imported four
  sets** (~10 MB total): `guitar-shinyac` (**A.Shiny** — Shinyguitar's
  acoustic variant, CC0, native m3 roots, vl2–4 × 3 RRs, trim 0.19);
  `guitar-emily` (**A.Emily** — Karoryfer Emilyguitar, CC0, mf/f × 3 RRs,
  trim 0.24); `guitar-ovation` (**A.Ovation** — S. Christian Collins
  GigaSampler conversion, chromatic per-string samples that *sound an octave
  below their SFZ keys* — verified by pitch analysis, mapped key−12; no
  stated license → triage row; trim 0.10); `guitar-spanish` (**A.Spanish** —
  FreePats classical nylon, CC0, chromatic + pitch_keycenter low-range
  regions, trim 0.08). Mixer guitar row now groups acoustics (A.*) before
  electrics (E.*). Pianobook acoustics still unexplored (browsing trip).
  gaps. Found **Real Rotor Organ** (Indiginus; real B3 + spinning Leslie,
  free, Decent Sampler format) — added as the organ answer with a pre-loop
  conversion caveat. Corrected the 07-10 sweep's "acoustic slot covered"
  call: all current acoustics are soundfont renders; Shinyguitar's parked
  acoustic variant is the cheapest real replacement, Emilyguitar/Ovation
  re-opened for evaluation.

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
- License *(relaxed 2026-07-13 — personal-use era)*: anything **freely
  downloadable** qualifies; redistribution-clean (CC0/PD/CC-BY) still
  preferred where quality is equal. Every non-CC0 import gets a row in the
  license-triage section (the commercial exit map) and a footer credit
  naming its license. Sealed formats (Kontakt .nkx, plugin-only) still fail
  on *format*, not license.

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

**Keys expansion: electric piano / Moog / synth (searched 2026-07-13)**
All of these ride the existing keys channel via `PIANO_SETS` — cheap imports
through the standard pipeline.

| Candidate | License / format | Verdict |
|---|---|---|
| **jRhodes3c/3d** (sfzinstruments — 1977 Rhodes Mark I Stage 73) | samples **CC-BY-NC**, rest CC0; SFZ, up to 5 vel layers, roots every 4th white key | **IMPORTED 2026-07-13** as `piano-rhodes` (3c mono). First non-commercial-only set — see license-triage section. Targets Lo-Fi, Funk, Slow Blues, Pop, Jazz comp; style assignments await Tim's ear pass. 3d (full-length) is the fallback if 3c's looped one-shots feel truncated under sustained comping. |
| Wurlitzer (musical-artifacts #645; Greg Sullivan e-pianos; Pianobook WörliTzer) | unverified / GigaStudio format / Pianobook community license | ○ parked — no license-verified redistributable source found; musical-artifacts page blocks automated fetch, check by hand if the Wurli itch is real |
| Moog / analog synth multisamples | none found CC0 — KVR confirms the gap; commercial "royalty-free" packs fail redistribution (the DSK wall) | ✗ as an import. **★ as a mint-your-own**: render per-note one-shots offline from FOSS synths — Surge XT (analog/Moog-ish), Dexed (DX-style FM e-piano) — synth *output* is unencumbered, and we choose roots/layers to fit the manifest exactly. Same trick as the setBFree organ note. |
| **Caveman Cosmonaut** (Karoryfer, CC0, sampled 80s Polish analog keys) | CC0 | re-elevated: this is the already-identified real-hardware synth-keys candidate; audition before minting anything |

## Loosened-license candidates (searched 2026-07-13)

What the personal-use relaxation newly unlocks, best-first per slot:

| Slot | Candidate | Why it's the best available | Cost/notes |
|---|---|---|---|
| **Electric guitar** | **Unreal Instruments Standard Guitar** (sfz+FLAC, ~2400 samples, 44.1k/24-bit, sustain/mute/hammer/pull articulation groups) | KVR consensus "best free e-guitar"; real humbucker with picking noise; the mute group doubles as an E.Muted upgrade for funk | free DL, custom license (triage row on import). Flatten sustain + mute groups separately |
| Electric guitar (heavy) | Unreal Metal GTX | if a rock style ever wants chunk | same |
| **Drums** | **DrumGizmo kits** (drumgizmo.org/kits): DRSKit (general studio kit), CrocellKit (8.4 GB, ~100-hit snare), Aasimonster (metal), MuldjordKit (already queued via FreePats) | deepest free multisampled acoustic kits anywhere; WAV+XML per-hit → flattens straight into the drum manifest with real velocity layers | huge raw downloads; pick 3–4 layers per piece. CC-BY-SA-family licenses now fine |
| Drums (alt) | AVL Drumkits (Black Pearl, Red Zeppelin) | previously skipped only for ShareAlike; solid rock/vintage kits | now eligible |
| **Banjo** | **Flame Studios 5-string banjo** | a *real* banjo vs ganjo's guitjo compromise; feeds the Backup channel's Roll/Chop | GPL (fine now); GigaStudio .gig needs extraction tooling (`gigextract`) — the one-time tooling also unlocks Greg Sullivan's sets |
| **Wurlitzer** | Pianobook **WörliTzer** (Decent Sampler ver.) or Greg Sullivan e-pianos (.gig) | fills the Wurli hole next to the new Rhodes | Pianobook DS = .dspreset XML + WAVs, fully extractable; Pianobook license = free use, no redistribution (triage row) |
| **Keys/synth/organ** | **Pianobook catalog broadly** (1200+ packs; filter to Decent Sampler versions) — organs, synths, felt pianos, EPs | the largest free characterful-instrument pool now that its license is acceptable; audition-driven | per-pack import via .dspreset parsing; add a small dspreset→manifest converter to the pipeline |
| **Organ** | **Real Rotor Organ** (Indiginus) — a real 1957 Hammond B3 sampled through a *spinning* Leslie at chorale speed, drawbars 688600000, 2nd/3rd percussion, vibrato on/off | the missing organ answer: actual hardware+Leslie beats anything mintable from setBFree for the classic sound; Decent Sampler version = extractable XML+WAV | free from indiginus.com (check exact terms at import → triage row). Import caveat: sustains are *looped* — pre-loop to ~4 s fixed one-shots with a fade during conversion, since the engine ignores loop points |
| **Acoustic guitar** | (a) **Shinyguitar's acoustic variant** — parked in its zip at the 07-10 import, CC0, re-download; (b) Emilyguitar / OvationGuitar (sfzinstruments) — *wrongly skipped in the 07-10 sweep as "slot covered": the slot is covered only by soundfont renders, no real steel-string multisample exists in the app*; (c) FreePats spanish-classical (real nylon, for Bossa); (d) Pianobook acoustics (browsing trip) | first *real* recorded acoustic; FatBoy render is the default sound of half the styles | (a) is the cheapest — source already vetted, pipeline exists |
| Skipped despite relaxation | Sennheiser DrumMic'a, MT Power Drums, Ample lites | sealed Kontakt/plugin formats — format wall, not license | — |
| Skipped | DSK paid tier | license now acceptable but rompler quality won't beat the above | — |

Priority read: Standard Guitar first (electrics remain the stated weakest
slot), then a DrumGizmo kit for the Kit sound, then banjo/Wurli per Tim's
appetite. Pianobook is a browsing trip, not a queue item.

## If this ever goes commercial (license triage)

Decision 2026-07-13: non-commercial-only licenses are acceptable **now**;
this section is the exit map. "Commercial" here includes ads, paid tiers,
or bundling into paid products — mere donations are a gray zone worth a
lawyer-minute at the time.

| License | Sets affected | On commercialization |
|---|---|---|
| CC0 / public domain | Meatbass, Black And Blue Basses, Swirly Drums, Salamander Drumkit, VCSL, Osiris, Black And Green, Shinyguitar, ganjo, (Caveman Cosmonaut, accordion-HN if imported) | nothing to do |
| CC BY-SA 3.0 | **FatBoy** (default guitar!) | commercial use OK with attribution; ShareAlike applies to the *samples as redistributed* (already the case). Fine to keep, but note the SA obligation travels. |
| MIT-ish | Musyng/Fluid renders, Blue Jeans And Moonbeams | fine with license text |
| **CC-BY-NC** | **jRhodes3** (this import) | **must be removed or replaced before any commercial use.** Nearest replacements: mint a Rhodes-ish set from a FOSS synth (Dexed/Surge), license a commercial Rhodes multisample, or negotiate with the author (jlearman). Keep the set isolated in its own folder (`piano-rhodes/`) so removal is one directory + one `PIANO_SETS` line + one credit line. |
| GPL (fallback bench only) | Flame Studios banjo (never imported) | redistribution legal with license text; fine commercially but messier — still last resort |
| "Royalty-free" purchased (DSK, Karoryfer commercial) | none imported | unchanged: fails redistribution regardless of commercial status |
| **"License-free" (informal)** | **Standard Guitar** (E.Std/E.SMute) | bundled terms say "license-free, no credit required" — permissive but informal, with no explicit redistribution or commercial grant. Before commercial use: email Unreal Instruments for written confirmation, or replace. Isolated in `guitar-standard/` + `guitar-stdmute/` (two `GUITAR_SETS` entries, two trims, one credit line). |
| **No stated license** | **Ovation Guitar** (A.Ovation) | S. Christian Collins GigaSampler conversion; README credits the author but states no license. Before commercial use: confirm with schristiancollins.com or remove (`guitar-ovation/` + one `GUITAR_SETS` entry + credit line). |

Rule going forward: every non-CC0 import gets its license named in the
footer credit and a row here.

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
