# Quantum Box architecture

**Status:** implementation contract, revised 2026-09-06. The release-specific
decisions in `demo-release-contract.md` supersede contrary historical QA notes.

## Runtime layers

```text
DOM shell and accessible controls
        ↓ semantic actions
mode/session controller
        ↓ frozen RunContext
pure fixed-step cabinet simulation
        ↓ presentation snapshot
deterministic Story presentation machine
        ↓ immutable beat / terminal model
Phaser raster renderer + synthesized audio
```

The simulation owns state and time. Pure display adapters convert snapshots into immutable render views. Phaser draws those views over the shared Brown Box field; camera, flicker, animation partitioning, pause rendering, and audio cannot mutate a run.

## Product responsibilities

`QuantumBoxApp` currently coordinates the product flow; the names below are
responsibilities, not separate controller classes:

- Story flow owns five visible chapters, eight ordered gameplay stages,
  attempt counts, completed-run evidence, resumable post-run presentation, and
  the ending.
- Arcade flow starts any cabinet from the all-open library and never writes
  Story progression or formula recovery.
- The main-menu Workshop is always selectable. Its five records begin
  unrecovered and unlock only from their corresponding Story chapters.
  Story-owned office and terminal scenes read validated source-specific
  recovery records; neither Workshop nor those scenes can contact Moth,
  retroactively qualify a run, or grant progress from an Arcade score.
- Every flow constructs the same cabinet-specific session from a frozen
  `RunContext`; Story and Arcade do not fork the simulation rules.
- Player-facing `RETRY` creates a fresh run. Deterministic replay tapes remain
  internal QA/evidence infrastructure rather than a literal post-game replay.

## Determinism

A playable replay identity is:

```text
committed pack content hash + browser run seed + cabinet rules version
```

Story stage and play mode are also bound into `RunContext.runId`. Every timed session uses a fixed-step clock. External I/O completes before `RUN_STARTED`. Presentation frame partitions may change how many fixed steps are rendered at once but not the resulting trace. Completed Qong, SkiPixl, Fluxball, Quantman, and Quarry runs additionally freeze one semantic input per executed fixed step. Replay ignores live movement input and feeds that tape into a fresh session with the original context, pack, and cabinet rules; Story mutation is disabled during replay. Fluxball records only active-round inputs: between-round dwell time and the player's manual advance do not consume simulation steps or the match PRNG.

After completion, `core/replay.ts` can reconstruct a versioned artifact containing the complete `RunContext`, completion outcome, semantic input tape, and final public state. It is internal rather than a player-facing replay control, adds no clock or timestamp to replay identity, and contains committed pack hashes rather than provider secrets or transient asset URLs.

## Save and Story v2 presentation

`SaveRepository` owns `quantum-box/save-v5`. Earlier versions remain a legacy
input union, but migration never recalculates their content hashes or invents a
qualified run, provider return, Arcade score, or completed Story stage. V5 adds
the selected background program, versioned Arcade record cohorts, explicit
Story-stage completion, a pending post-run beat, and Quarry finale evidence.

The canonical Story registry lives under `src/story/v2/` and separates five
menu chapters from eight gameplay stages:

| Chapter  | Ordered stages                   | Qualification                                 | Post-run flow                                   |
| -------- | -------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Qong     | `qong`                           | match win                                     | simultaneous morph, court door, office terminal |
| SkiPixl  | `skipixl-medium`, `skipixl`      | completed Medium, then completed Hard attempt | slope handoff, then cabin                       |
| Fluxball | `fluxball-two`, `fluxball-four`  | 2P win, then 4P win                           | field handoff, then ball portal                 |
| Quantman | `quantman-stabilize`, `quantman` | complete screen in each mode                  | mode handoff, then ghost den                    |
| Quarry   | `quarry`                         | Player A wins the three-round match outright  | duck morph and final Workshop                   |

New Story and run records use `quarry`; `quag` survives only as a compatibility
alias and asset/source lineage. Enclose has no shipped cabinet row, launch
route, runtime import, Workshop copy, or Story stage. Its unreferenced source
and historical QA artifacts remain recoverable development history.

`StoryV2PresentationMachine` consumes a qualified stage plus an optional
versioned resume token and emits one immutable beat at a time. It owns no game
simulation, save store, renderer, clock, or provider client. Before an
interlude starts, the app stores the qualified run and the token for its active
beat. A resumed sequence therefore returns to the exact dialogue, morph,
terminal, or transition beat instead of replaying the cleared cabinet.

Each chapter terminal uses a typed evidence binding and presents three distinct
layers: submitted input, returned artifact/result, and local game mapping. Its
`sourceStatus`, `gameplayAuthority`, and `activePlayNetwork: none` fields prevent
presentation copy from silently upgrading a synthetic control or comparison
record into provider authority.

## Asset seam

Shipping raster assets are referenced through `assets/manifest.ts`.
`canonical-runtime-assets-v2` is an immutable, manifest-driven package with 26
source records, 45 runtime PNGs, and 98 frames. Its source-manifest SHA-256 is
`ba0ff61d315690adcdac094ff4b810f411a01be1f30810b6b0d660c4c5c958d5`;
its runtime-handoff SHA-256 is
`469b9474866522f919a57b18df30e7c06c272ed0e27cbe8198ec513fb16c3638`.
The loader fails on manifest identity, file-count, palette, logical-resolution,
alpha, or scaling drift. `BrownBoxAssetManifest` separately owns the
decomposed physical title layers in `src/assets/brown-box/`; this photographic
room/device composition is the sole approved exception to the internal
three-colour `320×180` display.

`src/assets/designer-professor/` is a separate deterministic presentation
package. It preserves the selected 20×20 professor source as an exact locked
copy, then derives pipe, walk, talk, point, and door-opening frames plus four
seven-frame morph strips. Its runtime loader resolves typed Story asset cues;
it does not replace the immutable canonical-runtime-v2 package. The generator
performs only local pixel operations, and the audit pins source hashes, palette,
binary alpha, integer anchors, dimensions, and exact first/last morph frames.

## SkiPixl course and completion envelope

SkiPixl separates immutable QPixl capture evidence and course decoding from
local simulation. One run selects an ordered triplet from the twenty preserved
20 × 20 IBM Fez captures. For that same 1,200-cell triplet, decoder v7 computes
`returnedValue - submittedGrayscaleByte / 255` and exposes three nested local
cuts: P90/Easy selects 120 hazards, P84/Medium selects 192, and P78/Hard selects
264–265 where threshold ties are retained. These are three decodings of the same recorded triplet, not three provider
executions. Residual sign maps non-negative cells to trees and negative cells to
moguls; neighboring residuals deterministically stagger horizontal and downhill
placement without editing the source or return values.

The resulting committed payload freezes triplet order, source and return hashes,
Moth and IBM job identifiers, bank hash, decoder/cut identity, corridor, speed
bounds, exact obstacle receipts, and gate anchors before `RUN_STARTED`. Easy is
a compressed gate-free 60-second descent. Medium and Hard retain the longer
course at 75 seconds and derive eight and twelve gates respectively from QPixl
obstacle anchors. No per-row winner or authored safe-route repair is added, so
an unfavorable triplet may remain impractical.

Gameplay, cut selection, gate construction, steering, collisions, timing, and
score calculation are entirely local and deterministic. Story omits Easy: it
requires Medium and then Hard, carrying the selected triplet forward after a
success and rotating deterministically after a failure. Human playtesting is
not a gate. QRC remains a possible later sequential generator and is not a
dependency or claim of this build.

Story progression is based on completing the descent, not beating its time
limit. Both outcomes enter the canonical in-world transition. Each completed
attempt appends an immutable receipt containing the success/limit outcome,
elapsed time, collisions, gate outcomes, selected triplet and cut, pack and
bank hashes, and the three ordered Moth/IBM source-job identities. Arcade
leaderboards remain stricter and accept successful finishes only.
The score screen always renders five ranked places, using empty placeholders
rather than an ambiguous no-score state. A retained player-Arcade result is
written before the transition, then its unique record sequence—not its
repeatable deterministic run ID—keys the optional three-character initials
edit. The same validated save commit updates that entry and the default
initials for later runs.

V5 migration preserves exact legacy SkiPixl receipts and maps proven P84/P78
progress to the Medium/Hard Story boundary. It does not infer a descent finish
from an older formula unlock or manufacture a scoreboard entry. A valid
downstream record remains inspectable even when the new Story resumes at an
earlier stage.

## Fluxball authority and rule-change boundary

The anthology copies Fluxball's standalone rule sampler, interpreter, scoring, RNG, fixture catalog, fixture resolver, and both local-Aer fixture artifacts as exact regression sources. Its two-player path remains pairwise tomography; its four-player path remains full-register joint-count gameplay with pair fits used only for explanation and diagnostics. They share an acquisition transport boundary but not a misleading scientific description.

`FluxballSession` synchronously selects two QGraph-derived states for each round and constructs each state from exactly three local draws: X/MOVE, Y/BALL, then Z/GOAL. Global Fluxball interprets one shared rule triplet for everybody. Individual Fluxball interprets a separate hidden triplet per player from one coupled joint QGraph state. One shared human-triggered `CHANGE RULES` opportunity may advance the state during a round; in Individual mode neither the outgoing nor incoming rules enter the live or round-end DOM. CPUs reset their beliefs and infer again from public consequences. Goals reset each round, an outright goal leader earns one round win, and the match is decided by round wins.

Story does not accept an arbitrary run seed. A fresh unsigned candidate selects from small, versioned two- and four-player Story pools whose schedules have both a minimum structural scoring margin and a demonstrated win by a deterministic policy using only public observations. The selected seed, not the discarded candidate, is frozen in `RunContext` and therefore in replay identity. `FluxballSession` rejects any Story context outside its certified pool before `RUN_STARTED`; Arcade continues to accept the exact developer-entered seed, including pathological schedules. This is disclosed before the match, performs no network work, does not consume the match PRNG, and cannot change an active round.

The anthology CPU is not the standalone privileged controller. `FluxballCpuPolicy` accepts only positions, public motion, ball state, contact consequences, physical goal and award events, score, and time. It first probes its ACTION mapping, learns CARRY/STRIKE from its own contact consequence, and updates a target-goal hypothesis from public awards. Until it observes evidence, it alternates hypotheses and hesitates deterministically. Its output is the same four-button `PlayerInput` accepted from a human.

## Quantman completion and information boundary

The shipped Quantman game has two internal mechanics, `STABILIZE GAZE` and
`INVERSE GAZE`, exposed in Arcade as `HOLD` and `INVERT`,
over an incrementally extensible bank of 10×10/100-bit Moth Labyrinth returns
from IBM Fez. The current corpus contains seven distinct authored maze
topologies and eight independent 4,096-shot hardware captures: the original
topology has two captures, and Maps 01–06 have one each. The bank models those
as separate topology and capture records rather than presenting every execution
as a new level. Every capture retains exact campaign, target, Moth-job,
IBM-job, backend, request, raw-result, capture, bit-order, and shot identity.
Clearing every collectible is mandatory in both Story stages.

The submitted target maze is authored input. Each fixture derives a frozen
admissible-state index by testing intact measured bitstrings against documented
spawn, objective, connectivity, screen-clearance, and two-mode requirements.
The browser samples by the original returned weights only within that admitted
set; it never repairs or fabricates bits or walls. A fixture with no admissible
state remains acquisition evidence but is not gameplay authority. Neither
Story nor Arcade exposes a course selector. Each advances automatically through
the distinct topology order; the run seed then chooses a capture beneath the
selected topology. Story cycles only if future progression exceeds the
available corpus and never writes a high score. Arcade retains course identity
inside its mode scoreboard and run provenance. The local decoder maps equal
endpoint bits to an open passage and unequal endpoint bits to a wall. The
terminal keeps topology input, provider return, filtering, and local game
mapping distinct. Active play remains provider-free and does not imply live
QPU execution.

## Workshop disclosure

The main-menu Workshop is reachable by pointer and keyboard from the beginning.
It contains five Story records: Qong, SkiPixl, Fluxball, Quantman, and Quarry.
Each remains `UNRECOVERED` until its corresponding Story chapter supplies
qualified evidence. A recovered record descends through visible game behavior,
local classical decoder, returned engine artifact/result, submitted input,
evidenced engine operation, source hashes and warnings, and fiction. The MOTH
platform link remains gated by Quarry completion and is presented within its
final Workshop/recovery material rather than as an ungated menu shortcut. A
missing layer is shown as missing; the UI does not invent an acquisition to
complete the pattern.

The Designer is an experimenter who received an opaque key and access to MOTH,
not the inventor of MOTH or its engines. His office terminal explains what he
supplied, what MOTH returned when a provider record exists, and what local rule
he wrote to make that return matter in play. Quantman binds its explanation to
the exact IBM Fez Labyrinth record; Quarry binds its explanation to the exact
selected IBM Fez QGraph record.

## Moth boundary

Developer-side tooling may acquire and validate committed packs after a per-engine approval. The static client reads only promoted pack files. Each engine has its own request, result, decoder, and promotion validator:

- Coin Toss: independently identified one-shot QPU results map through the fixed
  heads/opponent-goal and tails/own-goal table. Story requires four validated
  seven-result packs plus a separate validated selector bank.
- QPixl: SkiPixl consumes the preserved twenty-capture IBM Fez bank and a local
  residual decoder. It makes no provider request during a descent.
- Quantum Graph: Fluxball consumes a promoted bank of forty identified Moth
  `graph-v1` IBM Fez distributions acquired before play. Quarry independently
  selects one of 24 promoted twelve-qubit IBM Fez QGraph returns—four hardware
  realizations of each of six recipes—then applies a local weighted decoder to
  freeze seven relation phases before play. The two games share an engine
  family but never share provider records.
- Labyrinth: played Quantman uses the admitted portion of the installed
  10×10/100-bit, 4,096-shot IBM Fez corpus. Its target maze is authored input;
  playability conditioning, weighted topology selection, parity-to-passage
  decoding, gaze rules, ghosts, and scoring are local.
- Quantum Blur: the local sibling simulator and all its outputs are excluded
  from Quantum Box. No Blur result is terrain or visual authority here.

No generic `quantumResult` union is permitted. Missing or undocumented contracts remain `UNRECOVERED`.

The browser also defines `PreMatchPackBroker`, with V1 instantiated only as `DisabledPreMatchPackBroker`. It rejects every preparation request with a stable explanation. Enabling it requires a separately approved server broker with origin, credential, credit, concurrency, durable-ledger, and result-validation controls; it cannot be enabled by adding a browser environment variable.

The developer implementation lives under `compiler/quantum_box_moth/`; it is not imported by the Vite runtime. The common layer is restricted to origin-bound transport, mutation approval, durable job identity, safe-GET polling, presigned storage without bearer authorization, redaction, content hashing, and immutable candidate records. `adapters.py` then performs four explicitly separate decisions. Contract mocks use their own `contract-mock` source classification and cannot satisfy the runtime's `MOTH ACQUIRED` predicate.

Qong Story requires a validated installed bank with four exact seven-item
`rallyPolarities` packs and a distinct selector pack containing an even,
ordered sequence of recorded bits. Each hardware result must come from one independently
identified, one-shot Coin Toss QPU job. Two selector bits are read at
Story-attempt creation, mapped locally to one of the four packs, and frozen with
the run in a selection receipt. Attempts consume selector pairs in order and
record cycle/reuse when the bank wraps. Job completion order, acquisition
retries, and browser randomness cannot affect the selected sequence.

Qong's canonical gameplay fiction is an unresolved constitutive rule, not a
hidden polarity to be scanned. Each rally can instantiate either the
opponent-goal rule or the own-goal rule. The physical line crossing is
determinate; its scoring meaning remains unresolved until the player observes
the rule with Space or the crossing itself forces measurement. In the latter
case, measurement resolves the rule, the meaning of the crossing, and the point
winner together. The browser must never present this as a completed goal
followed by a random choice of winner. Internally, the frozen pack may retain
the legacy `direct` and `invert` identifiers for compatibility. The full fiction
and HUD contract is `docs/design/qong-unresolved-rule-state.md`.

The installed bank is `qong-moth-qpu-bank-7e49214d4fe7`, canonical content
SHA-256 `5b2cc29a0f0dbfe5ce3d34e1d4fa225408d79dbddc79873149c00a301fff3b94`.
It contains four seven-result play packs and forty-four ordered selector results,
providing twenty-two non-reused two-bit selections before cycling. Every record
retains its actual provider-selected QPU backend under the reviewed adapter-v5
policy. If the bank is absent, invalid, tampered with, or incompletely sealed,
Story and Arcade Qong both fail closed when the installed hardware bank cannot
be validated. Arcade selects from the same four authenticated play packs by
run seed; Story additionally consumes the recorded selector sequence and alone
can advance progression.

A qualifying Qong victory freezes the completed run, final-court snapshot, and
selection receipt before opening the Story sequence. That exact completed
court remains mounted: both rendered paddles disappear from the canvas and two
source-locked morph strips begin simultaneously at their exact final paddle
anchors. The left paddle becomes the player avatar while the right paddle
becomes the Designer. The Designer walks to and opens a doorway within the same
court; there is no narrated replacement tableau and no continue prompt between
those actions. The player then directly walks across the court and through the
door.

Crossing the threshold changes the presentation scene, not the qualified run,
to a deterministic top-down office with walls, floor depth, furniture, desk,
chair, and computer. The player walks to the computer, explicitly sits, and
only then enters its full-screen terminal. Seven short terminal pages teach the
request, the definite 0 start, the Hadamard operation, ideal equal measurement
probabilities, measurement into one classical bit, the actual stored result,
the fixed heads/opponent-goal and tails/own-goal mapping, and the distinction
between pre-acquired hardware data and the game's unresolved-state fiction.
Exact job IDs, hashes, selector receipts, and backend identity remain available
under the optional Technical Record rather than appearing in the default
lesson. Only completion of that evidence-bound sequence advances Story and
opens the corresponding Workshop material; resuming it never consumes another
selector pair and reconstructs the saved final court when available.

## CPU information boundary

Cabinet simulations produce `AgentObservation<TPublicState, TPublicEvent>`. A CPU policy combines that observation with its private `AgentBeliefState<THypothesis>`. Hidden rules, selected outcomes, committed distributions, and unrevealed provider results are not part of either input. Tests must demonstrate that CPU traces are reproducible and do not change when hidden authority fields are added outside the observation boundary.
