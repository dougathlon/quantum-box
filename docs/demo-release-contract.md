# Quantum Box public demo contract

**Status:** binding public product contract, revised 2026-11-15

## Product and fiction

- The main menu is Story, Arcade, Terminal, and Settings.
- The Designer is a fictional experimenter given access to MOTH, not its
  inventor. The Designer communicates only through the forgotten Quantum Box
  terminal.
- Physical Designer/player figures, morphs, doors, offices, dens, walking
  sequences, and Workshop rooms are not production surfaces or assets.
- Story opens Continue/New Story; Continue is offered only with active progress.
  New Story resets the narrative cursor while retaining historical records.
  There is no chapter-selection menu.
- Terminal offers Read for cleared programs and independent Retry for encountered, unfinished programs.
- This is a desktop browser game. At most two humans may play; four-competitor
  formats fill remaining places with CPUs. Mobile controls and layouts are retired.
- Enclose is not a shipped cabinet, route, asset, or source-record entry.

## Story

The deterministic gameplay order is Qong; SkiPixl feasible; SkiPixl overloaded;
Quantman Hold; Fluxball 2P Global; Fluxball 2P Individual; and Quarry.

The approved complete Story corpus, separately supplied Postscript, and authorized
corrections are pinned in `src/story/terminal/text-notes-provenance.json`.

Successful outcomes offer Continue only. Qong and Quantman require Retry after
the first completed loss in a main Story playthrough; subsequent losses offer
Retry and Continue. Both SkiPixl courses, both Fluxball stages, and Quarry offer
Retry and Continue from their first loss. Starting or abandoning a game is not
a completed loss. New Story resets this first-loss routing while retaining earned
results. Feasible SkiPixl's shared explanation offers Continue only, after the
outcome choice.

The narrative ending includes the closing sequence and both Postscript pages;
the first Postscript says `YOU REACHED THE END OF THE DEMO.` No win gate applies.
Terminal Read requires every stage in its chapter to be cleared and presents the
complete authored success transcript. Encountered, uncleared chapters offer
Retry through the introduction and tutorial for their earliest uncleared stage.
Terminal retries preserve the main Story cursor; genuine wins count toward the
same clear evidence. Transcript reading does not rewrite the factual read-page
history or create wins. Older completed saves can reach a previously missed
Postscript without replaying games.

## Game contracts

- **Qong:** seven rounds, three optional observations, and a recorded one-shot
  Coin Toss bank. An unresolved physical crossing forces measurement.
- **SkiPixl:** Easy, Medium, and Hard each use 60 seconds. Medium and Hard are
  the feasible and overloaded Story courses. Down accelerates from cruise 72
  toward 92 at 36 units/s²; release returns at 18 units/s².
- **Quantman:** Hold and Invert remain Arcade modes; Story currently uses Hold.
  Seven authored hardware-backed maze topologies rotate internally. The
  original topology's two independent captures do not create two menu levels.
- **Fluxball:** new matches use three 40-second rounds; historical v5 replays
  retain four. Global has one shared
  mutable rule state; Individual has coupled hidden player rules. One shared
  `CHANGE RULES` opportunity exists per round. CPU policy sees no hidden rules.
  Intermediate rounds reveal their rules before Next Round. The final round
  reaches results automatically, retaining its final rule history.
- **Quarry:** Arcade supports one or two humans among four competitors. A caught duck is knocked out,
  respawns elsewhere with grace, and retains its directed relation until the
  fixed scheduled remeasurement. One of 24 recorded QGraph jobs is selected.
  Current `quarry-rules-v7` awards a round win to each leader tied above the
  remaining players. Partial match ties are shared wins; all-player ties remain
  draws. v4/v5 replay contexts preserve their original unique-round-win scoring;
  v4 also retains its total-points match tiebreak. Their exact installed qualified
  run identities remain valid.

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

Quarry round breaks last three seconds in new v7 runs. Older v4/v5/v6 runs retain their two-second timing; v6 shared-win scoring is preserved. Qualifying SkiPixl/Quantman Arcade results offer Continue into initials entry; cleared Arcade Quantman mazes offer Next Maze only.
