# Quantum Box project map

This is the shortest route from an unfamiliar checkout to the part of Quantum
Box that owns a given behavior.

## Product flow

```text
photographic title
       ↓
home: Story · Arcade · Workshop · Settings
       ↓
semantic shell action
       ↓
QuantumBoxApp selects mode, pack, seed, and rules
       ↓
fixed-step cabinet session
       ↓
display adapter → Phaser raster + semantic DOM + local audio
       ↓
result persistence / Story presentation / Arcade scoreboard
```

The simulation owns time and gameplay state. The renderer interpolates and
draws; it does not decide collisions, scores, rules, pack selection, or Story
progress. Story animation and dialogue are presentation state over a completed,
already-persisted run.

## Cabinet map

| Cabinet  | Runtime location                       | Hardware/runtime authority                                                                        | Story stages                     |
| -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| Qong     | `src/games/qong/`                      | Installed one-shot Coin Toss QPU bank; local unresolved-rule interpreter                          | `qong`                           |
| SkiPixl  | `src/games/skipixl/`                   | Twenty QPixl IBM Fez captures; local residual cuts, staggering, gates, and collision simulation   | `skipixl-medium`, `skipixl`      |
| Fluxball | `src/games/fluxball/`                  | Forty QGraph IBM Fez distributions; local Global/Individual rule interpreter                      | `fluxball-two`, `fluxball-four`  |
| Quantman | `src/games/quantmanSynthetic/`         | Eight Labyrinth IBM Fez captures beneath seven authored topologies; disclosed admissibility index | `quantman-stabilize`, `quantman` |
| Quarry   | `src/games/quag/`, `src/games/qgraph/` | Twenty-four QGraph IBM Fez captures; local directed-relation schedule                             | `quarry`                         |

The `quag` and `quantmanSynthetic` directory names are compatibility lineage,
not current player-facing source claims. Rename them only through a planned
save, import, test, and provenance migration.

## Data path

Every hardware-backed mechanic follows the same separation even though the
engine-specific contracts differ:

1. **Authored input** — circuit recipe, grid, value field, or maze topology.
2. **Provider return** — captured outcomes and weights plus exact job, backend,
   request, result, bit-order, and hash provenance.
3. **Promoted bank** — a credential-free immutable runtime record accepted by
   an engine-specific validator.
4. **Local selection/decoder** — deterministic selection and an explicit rule
   mapping the stored result into a game condition.
5. **Fixed-step simulation** — classical browser gameplay using the frozen
   pack and run seed.
6. **Presentation** — sprites, field, HUD, audio, interpolation, Story, and
   Workshop explanation.

The browser begins at step 3. It cannot acquire or repair provider data.
`compiler/quantum_box_moth/` contains offline acquisition and promotion tooling,
but Vite never imports it. Exact game-specific identities and caveats are in
[source-lineage.md](source-lineage.md).

## Code ownership by concern

| Concern                         | Primary files or directories                                 |
| ------------------------------- | ------------------------------------------------------------ |
| Application routing             | `src/app/QuantumBoxApp.ts`, `src/ui/QuantumBoxShell.ts`      |
| Cabinet registry and trial copy | `src/games/registry.ts`                                      |
| Input and rebinding             | `src/input/`                                                 |
| Determinism and replay          | `src/core/`                                                  |
| Story sequence and evidence     | `src/story/v2/`, `src/app/StoryResultPersistence.ts`         |
| Save migration and scoreboards  | `src/save/`                                                  |
| Shared display and typography   | `src/display/`, `src/display/brownBox.css`, `src/styles.css` |
| Game-specific rendering         | `src/display/views/`                                         |
| Audio lifecycle and cues        | `src/audio/`                                                 |
| Runtime images and manifests    | `src/assets/`                                                |
| Hardware banks                  | game-local `data/` or `packs/` directories                   |
| Offline provider tooling        | `compiler/quantum_box_moth/`                                 |
| Unit and contract tests         | `tests/unit/`, `compiler/tests/`                             |
| Served browser journeys         | `tests/e2e/`                                                 |
| Release and provenance audits   | `scripts/`, `.github/workflows/deploy-pages.yml`             |

`QuantumBoxApp` is intentionally the integration seam. Before adding another
responsibility there, look for an existing pure session, policy, view adapter,
or repository that can own the behavior. Avoid introducing a second router or
parallel source of Story/save truth.

## Persistence and public evidence

`SaveRepository` owns the versioned local save. The current schema is
`quantum-box/save-v5`; legacy inputs remain accepted through an explicit union.
Migration preserves old bytes and evidence and fails closed when authority is
missing. Never derive a new provider record, qualification, Story completion,
or Arcade score from an older flag.

A deterministic replay identity binds the committed pack content hash, run
seed, rules version, mode, and semantic input tape. Replay is internal evidence
infrastructure. The player-facing `RETRY` action creates a fresh run.

## Common changes

- **Menu wording or Arcade comprehension:** update `src/games/registry.ts` and
  `src/ui/QuantumBoxShell.ts`; add shell and browser assertions.
- **Gameplay feel:** change the owning pure session/runtime, preserve fixed-step
  authority, and add deterministic traces before tuning the renderer.
- **Story flow:** update the Story-v2 registry/machine and pending-beat save
  tests. Persist a qualified run before presentation begins.
- **Quantum bank or decoder:** use the engine-specific compiler and validator;
  preserve every provider byte and provenance field; update source-lineage and
  audit tests.
- **Sprite or background:** update the deterministic generator where one
  exists, manifests, hashes, and asset audits. Review at integer scale.
- **Scoreboard:** update `src/save/ArcadeRecords.ts` and save migration tests.
  Story, QA, replay, and abandoned runs must remain ineligible.
- **Release:** merge to public `main` only after local checks and browser review.
  The GitHub workflow owns deployment; `dist/` is never committed.

## Evidence vocabulary

Use precise completion language:

- **implemented** — code exists;
- **automatically verified** — named checks passed;
- **browser exercised** — the exact served build and route were operated;
- **deployed** — the Pages workflow published the exact public commit;
- **human accepted** — a person reviewed the relevant visual, audio, narrative,
  or gameplay experience.

One status does not imply the next.
