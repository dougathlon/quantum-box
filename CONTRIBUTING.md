# Contributing to Quantum Box

Quantum Box accepts focused issues and pull requests. The repository is public
so collaborators can inspect and improve the game, but it does not currently
carry an open-source project licence. Discuss any intended reuse or
redistribution with the maintainer; a pull request does not grant broader rights
to the project or its assets.

## Before changing code

1. Play the current build at <https://dougathlon.github.io/quantum-box/>.
2. Read the [project map](docs/project-map.md),
   [current status](docs/current-status.md), and the relevant section of the
   [architecture contract](docs/architecture.md).
3. For any change involving quantum-derived data, read
   [source lineage](docs/source-lineage.md) before touching a bank, selector,
   decoder, or player-facing claim.
4. For UI, sprite, or background work, read the
   [visual reference contract](docs/visual-reference-contract.md) and
   [design system](docs/design-system-v1.md).

The project has accumulated historical names and retained recovery code. An
apparently obvious rename or deletion can invalidate saves, replay evidence,
asset manifests, or provider provenance. Inspect call sites and tests before
changing structure.

## Local setup

Use Node.js 24+, pnpm 10, and Python 3.13 for the complete audit suite.

```bash
pnpm install --frozen-lockfile
python3 -m pip install --requirement requirements-ci.txt
pnpm dev
```

The game is served at <http://127.0.0.1:4390>. The port is strict by design.
If it is occupied, identify and stop the stale project process rather than
accepting a different port and accidentally reviewing another build.

## Change workflow

- Branch from the current public `main`; do not develop directly on the release
  branch.
- Keep one pull request centered on one player-visible outcome or one coherent
  infrastructure boundary.
- Preserve unrelated changes and immutable source artifacts.
- Add or update tests using the nearest existing pattern.
- Run focused checks while working, then the full applicable gate before asking
  for review.
- Include screenshots for visible changes and identify the exact URL, commit,
  viewport, and state shown.
- State what was checked automatically, what was exercised in a browser, and
  what still needs human judgment.

Do not describe a collected Playwright suite as an executed browser test. Do
not describe a generated or rendered artifact as a provider return. Tests and
screenshots are evidence, not proof of player comprehension or game feel.

## Non-negotiable boundaries

### Quantum data and provenance

- The public browser must never contain a MOTH or IBM credential.
- Active play must not submit, poll, retry, or purchase provider work.
- Provider-returned bytes, outcome weights, job IDs, bit ordering, and hashes
  are immutable evidence. Never repair, splice, interpolate, or fabricate them.
- Authored input, provider return, local filtering, local decoding, simulation,
  and presentation must remain separately named in code and documentation.
- Synthetic and simulator fixtures may remain explicit tests or controls, but
  may not silently become runtime authority.
- Offline acquisition tooling under `compiler/` is not part of ordinary game
  development. Do not run submission commands without explicit authorization.

### Simulation and saves

- Fixed-step simulation is authoritative. Render interpolation, camera effects,
  audio, and Story staging cannot mutate a run.
- A run freezes its validated pack, seed, rules version, and mode before
  `RUN_STARTED`.
- Story and Arcade use the same cabinet sessions, but only Story can advance
  Story state.
- Preserve the `quantum-box/save-v5` legacy union. Migration must not invent a
  score, provider record, qualified run, or completed stage.
- Player-facing Retry starts a fresh run. Deterministic replay remains internal
  QA and evidence infrastructure.

### Visual and interaction system

- Internal screens use a logical `320×180` plane, integer nearest-neighbour
  scaling, and the exact Brown Box palette.
- The physical title image is the sole approved photographic exception.
- Do not add blur, antialiasing, gradients, bloom, extra accent colours, generic
  CRT noise, or fractional sprite placement.
- Preserve semantic DOM controls and accessible text; important instructions
  must not exist only on canvas.
- Keep rule text and permanent HUD copy out of active playfields.

## Checks

Useful focused commands include:

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

The complete local release gate is:

```bash
pnpm check
```

The browser journeys execute separately:

```bash
pnpm test:e2e
```

For a visible change, inspect at native `320×180`, `1280×720`, and
`1920×1080`. Exercise keyboard focus, pause, mute, blur/release behavior,
reduced motion where relevant, and the route back to the menu. Game changes
should also cover retry, save/reload, and deterministic replay identity.

## Pull requests

The pull-request template asks for the user-visible outcome, affected authority
boundary, tests, browser evidence, and remaining risks. `main` deploys to the
stable Pages URL, so a merge is a release action. The GitHub workflow must pass;
do not commit `dist/` or bypass failed checks with a manual Pages upload.

For bugs, include the full Pages or local URL (including any `?build=` tag),
browser and operating system, whether the save was fresh, input method, exact
steps, and a screenshot or recording when the failure is visual.
