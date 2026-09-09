# Quantum Box

Quantum Box is a browser-game anthology built as if a 1970s experimental game
console had been given access to present-day quantum hardware. Five games use
stored, provenance-rich results from MOTH engine runs on IBM hardware, then
turn those results into rules, terrain, mazes, or pursuit relations through
explicit local decoders.

[Play Quantum Box](https://dougathlon.github.io/quantum-box/) ·
[Project map](docs/project-map.md) ·
[Current status](docs/current-status.md) ·
[Contributing](CONTRIBUTING.md) ·
[Documentation index](docs/README.md)

> **Release status:** public demo candidate. The five cabinets, terminal-led
> Story, Terminal transcript archive, deterministic run evidence, save
> migration, and Arcade scoreboards are implemented. Fluxball and Quarry Story
> prose is deliberately labelled `PLACEHOLDER` until approved copy exists.

## The five cabinets

| Cabinet  | Player action                                            | Stored hardware result used in play                                                                                        |
| -------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Qong     | Play Pong under an unresolved own/opposite goal rule.    | One-shot Coin Toss results resolve the constitutive goal rule.                                                             |
| SkiPixl  | Ski a timed slalom through trees, moguls, and gates.     | Twenty recorded QPixl fields become terrain through a disclosed residual decoder.                                          |
| Quantman | Clear a maze whose passages respond to gaze.             | Eight Labyrinth captures are grouped beneath seven authored maze topologies; intact admissible states are sampled locally. |
| Fluxball | Play a two- or four-player ball game with mutable rules. | Forty recorded QGraph distributions supply Global or player-specific rule states.                                          |
| Quarry   | Hunt and evade other ducks in a changing ecology.        | Twenty-four QGraph captures supply directed predator-to-quarry relations.                                                  |

The browser never contacts MOTH or IBM during play. It selects validated
recorded evidence before a run, preserves its identity, and executes gameplay
locally. Authored input, provider return, local filtering or decoding,
simulation, and presentation remain separate. See
[source lineage](docs/source-lineage.md) for the contracts and caveats.

## Product flow

The title opens on the animated Brown Box field with `QUANTUM BOX` and
`PRESS START`. The first valid Start gesture unlocks audio and enters a home
screen with four routes:

- **Story** begins or resumes a linear terminal demonstration. Its seven
  gameplay stages are Qong; two SkiPixl courses; Quantman Hold; Fluxball 2P
  Global and 2P Individual; and Quarry.
- **Arcade** lists all five cabinets. Each opens a terminal-style trial sheet
  containing the tutorial, modes, player choices, and scores where applicable.
- **Terminal** archives the five Story program transcripts. An experienced but
  uncleared program offers a retry; a transcript unlocks only after its required
  genuine Story wins.
- **Settings** contains display, background field, controls, initials, audio,
  and save-data controls.

Story and Arcade instantiate the same fixed-step simulations. Story owns
progression and evidence. Arcade owns repeat play and the SkiPixl/Quantman
top-five boards. Arcade, QA, deterministic replay, and abandoned runs cannot
advance Story or write Story evidence.

## Run locally

Requirements:

- Node.js 24 or newer
- pnpm 10.14.0 or a compatible pnpm 10 release
- Python 3.13 plus `requirements-ci.txt` for the complete audit suite

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://127.0.0.1:4390>. The strict port prevents a stale second server
from silently becoming the build under review.

Default keyboard controls:

| Player | Movement   | Action |
| ------ | ---------- | ------ |
| A      | W A S D    | Space  |
| B      | Arrow keys | Enter  |
| C      | T F G H    | R      |
| D      | I J K L    | O      |

Escape returns, P pauses, and M mutes. Controls can be rebound in Settings.
SkiPixl uses Down to accelerate. Each Arcade trial sheet states the applicable
controls and victory condition before launch.

## Repository map

```text
semantic DOM input and accessibility
               ↓
application flow + frozen run context
               ↓
fixed-step cabinet simulation
               ↓
immutable presentation snapshot
               ↓
native 320×180 raster + local audio
```

- `src/app/` — route, launch, Story, Arcade, and result orchestration
- `src/story/terminal/` — terminal pages, graph, transcript gates, and copy
  provenance
- `src/games/` — cabinet sessions, deterministic policies, banks, and decoders
- `src/ui/` and `src/display/` — semantic controls and Brown Box raster output
- `src/save/` — `quantum-box-save-v6`, legacy migration, settings, and records
- `src/assets/` and `src/audio/` — audited shipping assets and cue transport
- `tests/` — unit, provenance, save, deterministic, browser, and visual checks
- `compiler/` — offline acquisition/validation tools; never imported by Vite

Two source names are historical. Player-facing Quarry still uses some `quag`
module paths, and the hardware-backed Quantman runtime still lives under
`quantmanSynthetic`. They preserve save and source lineage; do not rename them
without a complete migration.

See the [project map](docs/project-map.md),
[architecture](docs/architecture.md), [Story contract](docs/story-terminal.md),
and [audio contract](docs/audio.md) before changing cross-cutting behavior.

## Validation

For a release candidate:

```bash
pnpm check
pnpm test:e2e
pnpm scan:source
```

`pnpm check` formats, type-checks, runs unit and compiler tests, audits assets
and provenance, collects the browser suite, builds production output, and scans
the Pages artifact. `pnpm test:e2e` executes browser journeys separately.

Automated checks, direct browser execution, fresh-save Story completion,
deployed-site verification, and human visual/listening acceptance are distinct
forms of evidence. See [deployment](docs/deployment.md).

## GitHub Pages and rights

`main` is the public release branch. Its pinned workflow verifies and deploys
only `dist/` to the stable address
<https://dougathlon.github.io/quantum-box/>. Query parameters may identify a
build but do not create a second public URL.

This repository is public for review and invited collaboration, but Quantum
Box does **not** currently carry an open-source project licence. Dependency
notices in `public/THIRD_PARTY_NOTICES.txt` apply only to those dependencies.
Do not assume permission to redistribute the game's code, writing, music, or
visual assets outside this repository.
