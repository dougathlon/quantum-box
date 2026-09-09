# Quantum Box public demo contract

**Status:** binding public product contract, revised 2026-09-09

## Product and fiction

- The main menu is Story, Arcade, Terminal, and Settings.
- The Designer is a fictional experimenter given access to MOTH, not its
  inventor. The Designer communicates only through the forgotten Quantum Box
  terminal.
- Physical Designer/player figures, morphs, doors, offices, dens, walking
  sequences, and Workshop rooms are not production surfaces or assets.
- Story opens Continue/New Story; Continue is disabled without progress.
  New Story resets the narrative cursor while retaining historical records.
  There is no chapter-selection menu.
- Terminal is a five-program transcript archive and independent retry surface.
- Enclose is not a shipped cabinet, route, asset, or source-record entry.

## Story

The deterministic gameplay order is Qong; SkiPixl feasible; SkiPixl overloaded;
Quantman Hold; Fluxball 2P Global; Fluxball 2P Individual; and Quarry.

The exact approved document is player-copy authority through Quantman. Its hash,
normalization rules, and exact runtime corpus hash are pinned in
`src/story/terminal/text-notes-provenance.json`. Fluxball and Quarry terminal
pages remain literal `PLACEHOLDER` pages until approved prose exists.

Only proven wins unlock transcript evidence: Qong once; both SkiPixl courses;
Quantman Hold; both Fluxball Story modes; and Quarry. Story may continue along
an explicit loss branch without converting that attempt into a clear.

## Game contracts

- **Qong:** seven rounds, three optional observations, and a recorded one-shot
  Coin Toss bank. An unresolved physical crossing forces measurement.
- **SkiPixl:** Easy, Medium, and Hard each use 60 seconds. Medium and Hard are
  the feasible and overloaded Story courses. Down accelerates from cruise 72
  toward 92 at 36 units/s²; release returns at 18 units/s².
- **Quantman:** Hold and Invert remain Arcade modes; Story currently uses Hold.
  Seven authored hardware-backed maze topologies rotate internally. The
  original topology's two independent captures do not create two menu levels.
- **Fluxball:** every format uses four 40-second rounds. Global has one shared
  mutable rule state; Individual has coupled hidden player rules. One shared
  `CHANGE RULES` opportunity exists per round. CPU policy sees no hidden rules.
- **Quarry:** Arcade supports one to four humans. A caught duck is knocked out,
  respawns elsewhere with grace, and retains its directed relation until the
  fixed scheduled remeasurement. One of 24 recorded QGraph jobs is selected.

Story has no high score. Successful terminal Arcade runs write only to the
existing SkiPixl or Quantman top-five systems, with initials, course/mode, run
identity, and immutable provenance.

## Hardware and runtime boundary

This release performs no provider submission, polling, purchase, or retry.

- Qong uses four authenticated seven-result Coin Toss packs and its sealed
  selector bank.
- SkiPixl uses twenty preserved QPixl IBM Fez captures.
- Quantman uses eight successful IBM Fez Labyrinth captures beneath seven
  authored topologies. The failed bulk tranche is excluded.
- Fluxball uses forty IBM Fez QGraph distributions.
- Quarry uses twenty-four IBM Fez QGraph distributions: four realizations of
  each of six recipes. The API-returned top-outcome projection is disclosed and
  is not represented as a complete 4,096-shot distribution.

Every run freezes its bank/pack, seed, rules version, and exact provenance
before fixed-step browser play. No synthetic fallback can silently replace
hardware authority.

## Presentation and audio

- The title and every internal surface share the native `320×180` Brown Box
  field and integer bitmap grid.
- The title displays `QUANTUM BOX` at three logical pixels per glyph cell and
  `PRESS START` at two.
- Arcade uses a five-cabinet index; each selection opens a terminal-style trial
  sheet with tutorial copy and controls.
- Story terminals type header then body, reveal actions only when complete, and
  persist their node before transition. Reduced Motion renders them immediately.
- Title is silent; after the first gesture, menu surfaces use the lead-free Key Is Opaque backing;
  terminal pages use A Spare Key; games and results are effects-only.

## Persistence and publication

Current saves use `quantum-box-save-v6`; v1–v5 migration preserves settings,
Arcade records, selected hardware evidence, and exact historical hashes without
inventing completion.

The public target is `dougathlon/quantum-box` at
<https://dougathlon.github.io/quantum-box/>. Publication uses a sanitized fresh
clone and excludes credentials, caches, local paths, private QA, retired assets,
source maps, and internal history. The project has no open-source licence.

Automated checks, executed browser tests, fresh-save Story traversal, deployed
site verification, and human visual/listening acceptance remain separate.
