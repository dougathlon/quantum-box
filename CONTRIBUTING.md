# Contributing to Quantum Box

Quantum Box accepts focused issues and pull requests. The repository is public
for inspection and invited collaboration. There is no open-source project licence.
Discuss reuse or redistribution with the maintainer; a pull request does not
grant broader rights to the project or its assets.

## Before changing code

1. Play the stable build at <https://dougathlon.github.io/quantum-box/>.
2. Read the [project map](docs/project-map.md),
   [current status](docs/current-status.md), and the relevant
   [architecture](docs/architecture.md) section.
3. For Story work, read the [terminal Story contract](docs/story-terminal.md).
4. For audio work, read the [audio contract](docs/audio.md).
5. For quantum-derived data, read [source lineage](docs/source-lineage.md)
   before touching a bank, selector, decoder, or public claim.
6. For visual work, read the
   [visual reference contract](docs/visual-reference-contract.md) and
   [design system](docs/design-system-v1.md).

Historical names and recovery adapters can be load-bearing. An apparently
obvious rename or deletion can invalidate saves, replays, manifests, or exact
provider provenance. Inspect call sites and tests first.

## Local setup

Use Node.js 24+, pnpm 10, and Python 3.13 for the full suite.

```bash
pnpm install --frozen-lockfile
python3 -m pip install --requirement requirements-ci.txt
pnpm dev
```

The game uses the strict local URL <http://127.0.0.1:4390>. If it is occupied,
stop the stale project process instead of accepting a different port and
reviewing the wrong build.

## Change workflow

- Branch from public `main`; do not develop directly on the release branch.
- Keep a change centered on one player-visible result or one coherent boundary.
- Preserve unrelated work and immutable source artifacts.
- Add or update tests using the nearest existing pattern.
- Use a frozen run seed when behavior must be reproducible.
- Include the exact commit, URL, viewport, route, and state with screenshots.
- Separate automatic checks, browser execution, and human judgment in reports.

Do not call a collected Playwright suite an executed browser test. Do not call a
derived asset a provider return. Tests and screenshots cannot establish player
comprehension or game feel by themselves.

## Non-negotiable boundaries

### Quantum data and provenance

- The public browser contains no MOTH or IBM credentials and makes no provider
  call during play.
- Provider-returned bytes, outcomes, weights, job IDs, bit ordering, and hashes
  are immutable evidence. Never repair, splice, interpolate, or fabricate them.
- Authored input, provider return, admissibility filtering, local decoding,
  simulation, and presentation remain separately named.
- Synthetic fixtures may remain explicit test controls but cannot silently
  become runtime authority.
- `compiler/` is offline acquisition and validation tooling. Never submit work
  without explicit authorization.

### Simulation, Story, and saves

- Fixed-step simulation is authoritative. Rendering, audio, and terminal
  transitions do not mutate a run.
- A run freezes its bank entry, seed, rule version, and mode before it starts.
- Only a proven Story result advances Story. Arcade, QA, replay, and abandoned
  runs do not.
- Current saves use `quantum-box-save-v6`. Preserve the
  `quantum-box/save-v5` legacy union and its historical hashes. Migration must
  not invent a score, provider record, qualified run, transcript, or clear.
- Player-facing Retry creates a fresh run. Deterministic replay remains internal
  QA and evidence infrastructure.

### Visual and interaction system

- All game-display geometry uses a logical `320×180` framebuffer and integer
  nearest-neighbour scaling.
- Use only the Brown Box palette and binary alpha. Do not add blur, smoothing,
  gradients, bloom, extra accents, or fractional sprite placement.
- Semantic DOM controls own focus, forms, keyboard, pointer, and accessibility;
  the raster layer owns visible geometry.
- Terminal copy comes from the pinned corpus in `src/story/terminal/`. Do not
  improvise late-Story prose where `PLACEHOLDER` is required.

### Audio

- Only one background cue may play: title hum, menu backing, or terminal loop.
- Games are effects-only. Muting, volume, tab suspension, and same-cue requests
  must not restart transport.
- Do not replace the menu backing with the older Fluxball composition or add a
  foreground lead.

## Checks

Useful focused checks include:

```bash
pnpm typecheck
pnpm test
pnpm test:moth
pnpm audit:visual
pnpm audit:assets
pnpm audit:qgraph-assets
pnpm audit:runtime-pixels
pnpm build
pnpm check:pages
pnpm scan:artifact
pnpm scan:source
```

The complete local gate is:

```bash
pnpm check
```

Browser journeys execute separately:

```bash
pnpm test:e2e
```

For visible work, inspect native `320×180` and served `1280×720`; run a larger
desktop viewport before release. Exercise keyboard focus, gamepad navigation,
pause, mute, blur/release, reduced motion, retry, save/reload, and return paths.

## Pull requests and releases

Describe the player-visible outcome, affected authority boundary, checks,
browser evidence, and remaining risks. `main` deploys to the stable Pages URL,
so merge is a release action. Do not commit `dist/`, source maps, credentials,
private acquisition caches, or local QA artifacts, and do not bypass failed
workflow gates with a manual upload.

For bugs, include the complete URL (including `?build=`), browser and operating
system, fresh or migrated save, input method, exact steps, and a screenshot or
recording when relevant.
