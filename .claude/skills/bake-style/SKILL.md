---
name: bake-style
description: Bake Tim's ear-tuned style settings into code defaults for the Progression Player. Use this whenever Tim pastes a "Copy style" JSON blob (it has genre/meter/tempo/strum/… plus a nested mixer object), pastes mixer JSON and names a style, or says anything like "bake this in", "set this as the default for honky-tonk", "make this the new bossa sound", "dial in this style", or "save these settings as defaults". Also use it when he pastes plain "Copy settings" mixer JSON — that's the global-baseline variant of the same workflow.
---

# Bake a tuned style into code defaults

Tim tunes one style at a time by ear in the Player: he picks the style, adjusts
band knobs and the Mixer while it plays, then clicks **Copy style** (in the
Mixer panel) and pastes the JSON here. This skill turns that paste into code
defaults so the style sounds tuned for everyone, from a fresh browser.

## Where defaults live

- `src/Player.jsx` → `GENRES`: one entry per style — `meter, tempo, feel,
  strum, drums, drumFills, bass, bassFills, backup, lead, leadEvery, keys`
  (`backup` is `off|roll|chop`, omit when off), optional
  `guitarInst`/`bassInst`/`pianoInst` (omit when they'd be the defaults
  `fatboy`/`upright`/`vcsl`), optional `mix:{channel:multiplier}`. Omit
  `bassFills` when false and `leadEvery` when 4 — those are the defaults.
- `src/Player.jsx` → `PROGRESSIONS[style][n].set`: per-progression overrides
  (same knobs plus `mix`) — only for tunings that belong to one progression,
  not the whole style.
- `src/audio.js` → `AUDIO_DEFAULTS`: the global mixer baseline (master, and
  per-channel `vol/send/low/high`). Global — touching it changes every style.

The engine applies per-style `mix` as **multipliers on top of the mixer
volumes** (`setMix` in audio.js multiplies `vol` only). Per-style EQ and
reverb-send are not supported — only volume balance.

## Procedure

1. **Parse the paste.** A "Copy style" blob has band knobs + `mixer`; bare
   mixer JSON (from "Copy settings") means global-baseline tuning — skip to
   step 5 with all diffs treated as global.
2. **Pick the scope.** Default to the style (`GENRES` entry matching
   `blob.genre`). If Tim says the tuning is for one progression ("this is for
   the 12-bar only"), write to that progression's `set` instead and leave the
   style entry alone.
3. **Band knobs.** Update the entry's fields to the blob's values
   (`bass` in the blob maps to the `bass` field; `keys` is `off|on|fills`).
   Keep the file's compact one-line entry style. Drop `guitarInst`/`bassInst`
   if they equal `fatboy`/`upright`.
4. **Volume balance → mix multipliers.** For each channel, compute
   `blob.mixer[ch].vol / AUDIO_DEFAULTS[ch].vol`, rounded to 2 decimals. Keep
   multipliers that differ from 1.0 by more than ~5%; if none survive, omit
   the `mix` field entirely.
5. **Everything mix multipliers can't hold** — master volume, any channel's
   `send`, `low`, `high` that differ from `AUDIO_DEFAULTS` — cannot be
   per-style. List the diffs and ask Tim: bake into `AUDIO_DEFAULTS`
   (global, affects all styles) or drop for now. Don't silently bake globals
   while doing a per-style pass.
6. **Verify.** `npx vite build` must pass. Summarize what changed as a short
   before → after list.
7. **Remind Tim to hit the Mixer's Reset button in the app.** His browser's
   saved mixer (localStorage `mrtriad.mixer`) still holds the tuned absolute
   volumes, and baked multipliers stack on top of whatever the mixer says —
   without Reset the channel plays double-boosted and he'll think the bake
   overshot.
8. Offer to commit (one commit per tuned style keeps the history reviewable);
   commit only when he confirms.

## Gotchas

- Progression `set.mix` beats the style's `mix`; the style's `mix` applies to
  all its progressions otherwise (and to saved entries loaded under it).
- If the blob's `genre` key isn't in `GENRES`, stop and ask — don't guess.
- Ratios near a default of 0 (a channel Tim zeroed): a multiplier can't
  express "off" from a nonzero default cleanly — flag it and suggest turning
  that instrument off via the band knob instead.
- Tim tunes by ear over time; earlier baked values are superseded without
  ceremony — overwrite, don't merge.
