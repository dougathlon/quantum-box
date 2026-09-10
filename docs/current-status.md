# Quantum Box current status

**Branch family:** public demo release

**Product URL:** <https://dougathlon.github.io/quantum-box/>

**Status date:** 2026-09-10

**Local QA candidate:** presentation corrections are implemented locally after public `0532428`; see [the detailed QA report](qa/2026-09-10-detailed-game-qa.md) for fixes, evidence, and decisions still needed.

## Implemented

- `320×180` logical layout with a `640×360` Brown Box text/graphics raster, integer nearest-neighbour scaling,
  bitmap UI, animated selectable background programmes, and a field-based title.
- Home routes: Story (Continue/New Story), Arcade, Terminal, and Settings.
- Spatial keyboard/gamepad focus, selectable footer actions, and controller-only
  initials entry. Enter / A selects menus; Space / A is Player A's live action.
- Shared top pause headers; Quarry hunt relations and opening/round/result
  notices at the top, with a single brief remeasurement pulse.
- Quantman Hold/Invert share a cone without a target square; restored brown
  changed walls and readable labels. SkiPixl acceleration has trailing speed cues.
- A linear terminal-mediated Story with seven gameplay stages. Physical
  Designer/player morphs, rooms, doors, dens, and Workshop presentation are not
  part of the shipping application.
- Exact pinned terminal copy through Quantman, typed presentation, coherent
  reload, first/later-loss branches, and literal late-Story placeholders.
- Terminal transcript gating and independent retry of an experienced but
  uncleared chapter.
- Save-v6 with explicit v1–v5 migration and preserved historical evidence.
- Qong, three 60-second SkiPixl modes with Down boost, Quantman Hold/Invert,
  four Fluxball formats, each with three 40-second rounds, and one-to-four-player Quarry.
- Hardware-backed runtime banks: Qong Coin Toss, SkiPixl QPixl, Quantman
  Labyrinth, Fluxball QGraph, and Quarry QGraph. Gameplay is provider-free.
- Silent title, then mutually exclusive menu backing and terminal loop.
  Browser unlock and scene ownership prevent overlap. Games are effects-only.
- Persistent top-five SkiPixl and Quantman Arcade boards with initials and exact
  run/course provenance.
- Enclose absent from the shipped navigation, runtime imports, and release
  artifact.

## Deliberately unfinished

- Fluxball and Quarry terminal prose is literally `PLACEHOLDER`; approved copy
  is required before those chapters can be considered editorially complete.
- Human visual review is still required for the complete terminal flow, dense
  Arcade trial sheets, moving sprites, and game-result transitions.
- Human listening approval is still required for three consecutive repetitions
  of each cue. Waveform and transport tests establish mechanics, not taste or an
  inaudible seam on every playback device.
- Broad external playtesting is not a release gate, but Fluxball CPU feel,
  overloaded SkiPixl difficulty, Quantman legibility, and Quarry match pacing
  remain the highest-value playtest targets.

## Technical cautions

- `quag` and `quantmanSynthetic` remain internal compatibility names.
- The Quantman bank contains seven distinct maze topologies and eight hardware
  captures: the original topology has two independent captures; six maps have
  one each. Failed bulk acquisition is excluded.
- Quarry has 24 captured jobs: four hardware realizations for each of six recipe
  families. Provider returns contain the ranked returned subset, not a complete
  4,096-shot distribution, and provenance states that limitation.
- Browser automation can be infrastructure-blocked on some managed macOS hosts.
  Test collection is not execution; use the Linux Pages workflow and direct
  served-browser checks as separate evidence.

## Next work

1. Approve final Fluxball and Quarry Story copy and replace only the literal
   placeholders.
2. Conduct a fresh-save comprehension/playability session, concentrating on
   terminal pacing, Fluxball CPU decisions, SkiPixl Hard, and Quarry pacing.
3. Decide a project licence if outside reuse is intended. The current public
   repository permits review and invited contribution but grants no general
   open-source licence.
