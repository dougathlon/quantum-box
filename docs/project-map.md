# Quantum Box project map

This is the shortest route from a new checkout to the code that owns a given
behavior.

## Product flow

```text
animated Brown Box field + QUANTUM BOX / PRESS START
       ↓ first valid gesture unlocks audio
home: Story · Arcade · Terminal · Settings
       ├─ Story → persisted terminal node → fixed-step game → outcome branch
       ├─ Arcade → five-cabinet index → trial sheet → game / scores
       └─ Terminal → transcript or independent retry of earliest uncleared stage
       ↓
native 320×180 raster + transparent semantic controls + one local audio cue
```

The simulation owns time, collisions, scores, rules, and outcomes. The renderer
snaps presentation to the logical pixel grid. Terminal typing, menu focus,
audio fades, and interpolated movement cannot mutate authoritative run state.

## Cabinet map

| Cabinet  | Runtime location                       | Runtime authority                                                                                  | Story stages                             |
| -------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Qong     | `src/games/qong/`                      | Captured one-shot Coin Toss bank and local unresolved-rule interpreter                             | `qong`                                   |
| SkiPixl  | `src/games/skipixl/`                   | Twenty QPixl IBM Fez captures; local residual cuts, gates, and deterministic movement              | `skipixl-feasible`, `skipixl-overloaded` |
| Quantman | `src/games/quantmanSynthetic/`         | Eight Labyrinth IBM Fez captures under seven authored topologies; explicit admissibility filtering | `quantman-hold`                          |
| Fluxball | `src/games/fluxball/`                  | Forty QGraph IBM Fez distributions; local Global/Individual rule interpretation                    | `fluxball-global`, `fluxball-individual` |
| Quarry   | `src/games/quag/`, `src/games/qgraph/` | Twenty-four QGraph IBM Fez captures; local directed-relation schedule                              | `quarry`                                 |

`quag` and `quantmanSynthetic` are historical source-lineage names. They do not
describe player-facing fiction and should not be renamed casually.

## Hardware-to-play data path

1. **Authored input** — recipe, field, topology, or circuit request.
2. **Provider return** — captured bytes, outcomes, weights, job identifiers,
   backend, bit order, and hashes.
3. **Promoted bank** — immutable credential-free runtime data accepted by an
   engine-specific validator.
4. **Local selection and decoder** — deterministic selection plus an explicit
   mapping into a playable condition.
5. **Fixed-step simulation** — classical browser gameplay using the frozen bank
   entry, rule version, and run seed.
6. **Presentation** — native raster, semantic controls, terminal, and audio.

The browser starts at step 3. It cannot acquire, repair, or fabricate provider
data. `compiler/quantum_box_moth/` is offline tooling and is never imported by
the shipping application.

## Code ownership

| Concern                            | Primary location                                                 |
| ---------------------------------- | ---------------------------------------------------------------- |
| Application and result routing     | `src/app/QuantumBoxApp.ts`, `src/app/StoryResultPersistence.ts`  |
| Story graph and exact copy         | `src/story/terminal/`                                            |
| Cabinet registry and Arcade briefs | `src/games/registry.ts`                                          |
| Input and rebinding                | `src/input/`                                                     |
| Determinism and frozen run context | `src/core/`                                                      |
| Cabinet simulations and policies   | `src/games/`                                                     |
| Save-v6 and legacy migration       | `src/save/`                                                      |
| Semantic shell and bitmap UI       | `src/ui/QuantumBoxShell.ts`, `src/display/`                      |
| Background programmes              | `src/display/backgrounds/`                                       |
| Local audio transport and assets   | `src/audio/`                                                     |
| Immutable visual assets            | `src/assets/canonical-runtime-assets-v2/`, `src/assets/qgraph-*` |
| Browser journeys                   | `tests/e2e/`                                                     |
| Unit and contract tests            | `tests/unit/`                                                    |
| Release and public-source audits   | `scripts/check-pages-artifact.mjs`, `scripts/scan-*.mjs`         |

## Persistence

`src/save/SaveRepository.ts` owns `quantum-box-save-v6`. The Story portion
separates current node, experienced stages, cleared stages, transcript state,
attempts, last outcomes, and exact qualified-run provenance. Arcade records,
settings, initials, key bindings, sound, and background selection are separate.

Legacy v1–v5 inputs pass through explicit migration. Historical run evidence
and hashes are retained; missing wins, transcripts, and scores are never
inferred. Invalid current-node IDs fall back to the earliest coherent unfinished
stage.

## Common changes

- Story copy or routing: `src/story/terminal/`, then Story and save tests.
- Arcade wording or modes: `src/games/registry.ts` and shell layout tests.
- Simulation behavior: cabinet session/policy, deterministic fixtures, and
  replay tests; avoid changing the renderer first.
- Hardware bank: bank validator, source lineage, selector reachability, and
  provenance persistence; never alter captured return bytes.
- Visible geometry: native raster helper/view plus 1×–6× uniformity tests.
- Audio: `src/audio/SynthAudio.ts`, cue provenance, and lifecycle tests.

## Evidence vocabulary

- **Automated:** a named command completed successfully.
- **Browser-executed:** a served interaction was actually exercised.
- **Fresh-save Story:** the complete current graph was traversed from empty
  storage.
- **Deployed:** the stable Pages asset was loaded and exercised after workflow
  success.
- **Human accepted:** a person judged visual quality, comprehension, sound, or
  game feel. This cannot be inferred from the other four.
