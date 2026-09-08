# Quantum Box

Quantum Box is a browser-game anthology built as if a 1970s experimental game
console had been given access to present-day quantum hardware. Its five games
use stored, provenance-rich results from MOTH engine runs on IBM hardware, then
turn those results into rules, terrain, mazes, or pursuit relations through
explicit local decoders.

[Play the latest verified build](https://dougathlon.github.io/quantum-box/) ·
[Project map](docs/project-map.md) ·
[Current status](docs/current-status.md) ·
[Contributing](CONTRIBUTING.md) ·
[Documentation index](docs/README.md)

> **Release status:** public demo. The core games, deterministic run evidence,
> hardware-backed data banks, saves, Arcade scoreboards, and complete Story
> route are implemented. Qong and SkiPixl have the most developed Story
> staging. Later Story transitions and the Workshop still need a dedicated
> presentation and editorial pass; they should not be represented as final.

## The five cabinets

| Cabinet  | What the player does                                      | Stored hardware result used in play                                                                                        |
| -------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Qong     | Plays Pong under an unresolved own/opposite goal rule.    | One-shot Coin Toss results resolve the constitutive goal rule.                                                             |
| SkiPixl  | Skis a slalom course through trees and moguls.            | Twenty recorded QPixl fields become terrain through a disclosed residual decoder.                                          |
| Fluxball | Plays a two- or four-player ball game with mutable rules. | Forty recorded QGraph distributions supply Global or player-specific rule states.                                          |
| Quantman | Clears a maze whose passages react to gaze.               | Eight Labyrinth captures are grouped beneath seven authored maze topologies; intact admissible states are sampled locally. |
| Quarry   | Hunts and evades other ducks in a changing ecology.       | Twenty-four QGraph captures supply directed predator-to-quarry relations.                                                  |

The browser never contacts MOTH or IBM during play. It selects a validated
record before a run, preserves its identity, and executes the game locally.
Authored input, provider return, local filtering or decoding, simulation, and
presentation are deliberately kept separate. See
[Source lineage](docs/source-lineage.md) for the exact contracts and hashes.

## Try it locally

Requirements:

- Node.js 24 or newer
- pnpm 10.14.0 or another compatible pnpm 10 release
- Python 3.13 and the packages in `requirements-ci.txt` for the full audit suite

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://127.0.0.1:4390>. The development server intentionally uses that
strict port so a stale or duplicate server cannot silently produce the wrong
build.

The default keyboard profiles are:

| Player | Movement   | Action |
| ------ | ---------- | ------ |
| A      | W A S D    | Space  |
| B      | Arrow keys | Enter  |
| C      | T F G H    | R      |
| D      | I J K L    | O      |

Escape returns, P pauses, and M mutes. Player bindings can be changed in
Settings. Each Arcade trial sheet states the controls and win condition for its
game before launch.

## Product structure

The home screen has four routes:

- **Story** presents five chapters and eight ordered stages: Qong; SkiPixl
  Medium and Hard; Fluxball 2P Global and 4P Individual; Quantman Hold and
  Invert; and Quarry.
- **Arcade** presents all five cabinets in one index. Selecting a cabinet opens
  a separate trial sheet before its modes and scoreboards.
- **Workshop** is always selectable. Its five records begin unrecovered and
  unlock through Story. The MOTH platform link is gated by Quarry completion
  and appears within Quarry's final Workshop/recovery material, never as an
  ungated menu shortcut.
- **Settings** contains display, field, control, and save-data controls.

Story and Arcade instantiate the same fixed-step cabinet simulations. Story
owns progression and evidence; Arcade owns optional repeat play and the
SkiPixl/Quantman top-five scoreboards. Arcade, QA, and replay cannot advance
Story.

## How the code is organized

```text
semantic DOM shell and input
          ↓
application flow and frozen RunContext
          ↓
fixed-step cabinet session
          ↓
immutable presentation snapshot
          ↓
Phaser raster display and local audio
```

Start with these directories:

- `src/app/` — launch, Story/Arcade flow, run construction, and result handling
- `src/games/` — cabinet simulations, policies, banks, and game-specific types
- `src/story/v2/` — current Story sequence, evidence binding, and presentation
- `src/ui/` and `src/display/` — semantic UI, Brown Box renderer, HUDs, and type
- `src/save/` — save migration, Story state, settings, and Arcade records
- `src/assets/` and `src/audio/` — audited runtime assets and local sound
- `tests/` — unit, contract, determinism, save, browser, and visual checks
- `compiler/` — offline acquisition/validation tooling; never imported by Vite

There are two historical naming traps. Player-facing **Quarry** still lives
under some `quag` module and asset paths for save and provenance compatibility.
The hardware-backed Quantman runtime lives under `quantmanSynthetic` because
that directory predates the installed IBM Fez bank. Do not rename either as a
drive-by cleanup; both require explicit migration work.

The more detailed map is in [docs/project-map.md](docs/project-map.md). The
binding runtime architecture is [docs/architecture.md](docs/architecture.md).

## Validation

For a focused code change, run the nearest unit tests and TypeScript check. For
a release candidate, run:

```bash
pnpm check
pnpm test:e2e
pnpm scan:source
```

`pnpm check` runs formatting, strict TypeScript, unit and compiler tests,
asset/provenance audits, Playwright collection, the production build, Pages
artifact checks, and the release scan. It collects the browser suite but does
not execute it. `pnpm test:e2e` performs the browser journeys separately.

Canvas-heavy changes also require screenshots at native `320×180`, served
`1280×720`, and served `1920×1080`. Automated checks, local browser execution,
the deployed build, and human acceptance are separate evidence categories.
The full change protocol is in [CONTRIBUTING.md](CONTRIBUTING.md).

## GitHub Pages

`main` is the public release branch. A push triggers
[the pinned verification and deployment workflow](.github/workflows/deploy-pages.yml),
which performs a clean install, audits dependencies and source, runs all local
checks, executes the Chromium journeys on Linux, and deploys only the verified
`dist/` artifact. Do not commit `dist/` or bypass a failed gate with a manual
upload.

The stable public address is
<https://dougathlon.github.io/quantum-box/>. Query parameters such as `?build=`
may identify a review request, but do not create a separate deployment.

The workflow requires no provider credentials. `.moth-cache`, environment
files, raw operator material, local QA history, source maps, and retired
production code are excluded from the public release surface.

## Rights and collaboration

This repository is public for review and invited collaboration, but Quantum
Box does **not** currently carry an open-source project licence. Third-party
dependency notices in `public/THIRD_PARTY_NOTICES.txt` apply only to those
dependencies. Until the maintainer chooses a project licence, do not assume
permission to redistribute or reuse the game's code, writing, music, or visual
assets outside this repository. Pull requests and issue reports remain welcome
under the process in [CONTRIBUTING.md](CONTRIBUTING.md).
