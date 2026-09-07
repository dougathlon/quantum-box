# Quantum Box MOTH demo release contract

**Status:** canonical implementation contract, accepted 2026-09-06

**Source:** `qbox/main-game@28deff7fe80244cacdf2ada7f1d8423c2126fb44`

**Release branch:** `qbox/demo-release`

This document supersedes contrary player-flow, timing, source, and publication
directions in earlier QA notes. Historical QA files remain evidence of the
state inspected at the time; they are not silently rewritten into current
acceptance claims.

## Product and narrative decisions

- The main-menu Workshop row remains visible but locked. Story office and
  terminal scenes remain available at the appropriate post-game transitions.
- The Designer received access to MOTH and experimented with its engines. He
  did not invent MOTH, its engines, or the provider hardware.
- Stored provider returns are selected before play. No screen may describe
  them as a live computation.
- Qong and Fluxball teach their central rule after the first complete
  unsuccessful Story match, never after a single lost round. That explanation
  is shown once, persists across reload, and precedes a fresh retry. Arcade may
  expose the same material only through an optional `HOW TO PLAY` action.
- A completed SkiPixl Medium or Hard attempt advances Story whether it succeeds
  or fails. The saved evidence retains the outcome, time, collisions, gates,
  triplet, and source provenance. Genuine success receives distinct feedback.
- Qong and SkiPixl receive the bespoke court/slope-to-office presentation pass.
  Fluxball, Quantman, and Quarry still require truthful, navigable, complete
  Story transitions, but their visual staging may remain provisional for this
  demo and must be reported as such.
- The five visible chapters and eight gameplay stages remain Qong; SkiPixl
  Medium and Hard; Fluxball 2P and 4P; Quantman Stabilized and Inverted Gaze;
  and Quarry. Enclose remains absent from the shipped application.

## Game contracts

- **Qong:** seven rounds, three observations, unresolved to measuring to
  resolved rule state, and stored one-shot Coin Toss QPU authority. A physical
  line crossing forces measurement when the rule remains unresolved. The first
  Story round uses the admitted stored OWN-goal state already in the bank.
- **SkiPixl:** current QPixl residual terrain remains authoritative. Medium and
  Hard progression is attempt-complete rather than win-gated. Missed gates add
  time; gates, trees, and moguls must be visually and sonically distinct.
- **Fluxball:** Global keeps one shared mutable rule state and Individual keeps
  coupled player-specific hidden rules. The first human to use the one shared
  `CHANGE RULES` opportunity consumes it. A physical goal crossing is recorded
  once before the operative rule determines point attribution. Goals do not
  change rules. Every Arcade and Story format uses approximately 60-second
  rounds.
- **Quantman:** both gaze modes remain. Arcade selects deterministically among
  admissible installed hardware fixtures. Story selects a single fixture at
  Stabilize and persists its exact ID and content hash through Inverse. Runtime
  sampling is conditioned on an explicit admissible-state index; the original
  returned bitstrings and weights are never repaired, spliced, or fabricated.
- **Quarry:** exactly three approximately 60-second rounds. The complete
  directed pursuit relation changes on an approximately 12-second schedule,
  never because of a catch. A catch scores, briefly knocks out the caught duck,
  then returns it at a different safe perch with visible respawn grace. The
  directed relation remains in force until its scheduled change. Match order is
  rounds won, then total points; an exact remaining tie is `DRAW`.

## Acquisition cutoff and source classifications

The original release cutoff was 2026-09-06; the validated serial Quantman
captures collected by 2026-09-07 are now part of the frozen runtime corpus.
This integration performs no provider submission, retry, polling, or purchase.

- Qong: four authenticated seven-result Coin Toss QPU packs plus the sealed
  selector bank already installed.
- SkiPixl: twenty preserved QPixl IBM Fez source/return captures already
  installed; difficulty is a local residual decoding of a selected triplet.
- Fluxball: forty recorded QGraph IBM Fez distributions already installed.
- Quarry: twenty-four recorded QGraph IBM Fez jobs already installed, four
  independent realizations in each of six recipe families.
- Quantman: eight independent 4,096-shot IBM Fez measurements are grouped
  beneath seven distinct authored 10 by 10 Labyrinth topologies. The original
  topology owns the original job `b26af8de-d420-41f9-88cb-dfd436320304` and
  serial control `62e54fda-a9eb-4c23-baf1-3b0815d81479`; Maps 01–06 each own
  one validated serial capture. The failed twelve-job bulk campaign is not
  runtime evidence. Story advances across distinct topologies without a
  selector or high score; Arcade rotates courses automatically while retaining
  course-indexed score records.

For Quantman, the authored coupling map is submitted input; the complete
measured bitstring distribution is returned output; playability filtering and
parity-to-passage conversion are local deterministic operations. Multiple
hardware executions of one topology do not constitute additional maze levels.

## Shared presentation and publication

- The existing default background programme and bytes remain unchanged. Its
  visible label is `STANDARD`, replacing only `CURRENT`. Adaptive programmes
  retain their recorded whole-field evolution and individual timing contracts.
- Resetting the save must reproduce a new-profile player state, including
  progression, help flags, pending presentation, records, background, keymap,
  and run recovery.
- Every visible Space continuation is state-aware and release-latched so one
  press cannot also trigger the next scene's action.
- Menu music is the exact approved local
  `fluxball-01-open-field-likeness-65-region-03-repeated.wav` asset derived
  from the QRC/Qiskit Aer experiment. It is not QPU-generated audio and resumes
  on every menu return.
- Publication target is the public, no-project-license repository
  `dougathlon/quantum-box`. Publication uses a sanitized one-commit archive of
  the final internal release commit, not internal history. GitHub Pages is
  complete only after the deployed game itself is exercised at
  `https://dougathlon.github.io/quantum-box/`.

## Evidence boundary

Automated checks, direct local browser execution, a complete fresh-save Story
run, hosted-site verification, and external human acceptance are separate
evidence categories. This release requires the first four. External human
acceptance remains future work and must not be inferred from tests or screenshots.
