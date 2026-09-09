# Quantum Box architecture

This document is the binding runtime contract. It describes authority and state
flow, not every class.

## Runtime layers

```text
semantic controls / keyboard / pointer / gamepad
                    ↓
QuantumBoxApp route and frozen RunContext
                    ↓
fixed-step cabinet session and deterministic policy
                    ↓
immutable snapshot and event stream
                    ↓
native 320×180 presentation + local effects/background audio
```

The fixed-step session is authoritative. Presentation rounds continuous
simulation coordinates once, at the final draw boundary. Terminal typing,
background animation, audio, and DOM focus are presentation state.

## Application responsibilities

`QuantumBoxApp` owns route changes, run construction, Story graph actions,
outcome persistence, Arcade recording, audio cue requests, and teardown.
`QuantumBoxShell` owns semantic UI, bitmap projection, focus/navigation,
terminal typing, Settings, and Arcade trial sheets. Cabinet views consume
snapshots; they do not decide gameplay.

There is no physical Story world in production. The unseen Designer is present
only through terminal copy. `STORY` resumes the persisted graph directly;
`TERMINAL` opens the transcript index.

## Run and determinism boundary

A run freezes:

- game and mode;
- rules/challenge version;
- deterministic seed;
- selected bank, pack, topology/state, and content hash;
- immutable source/job/backend provenance.

The browser may sample a captured distribution with the frozen seed. It may not
fetch provider work, change a bank mid-run, repair a measured state, or use a
synthetic fallback as authority. Deterministic replay is QA infrastructure and
does not count as a new Story or Arcade run.

## Story graph

`src/story/terminal/content.ts` defines data-only nodes:

- `terminal-page`, `loading-transition`, or `placeholder`;
- `game-launch`;
- `outcome-branch`;
- `completion`.

The current node is persisted before transition. An action during typing reveals
the complete page; a subsequent action advances. Reduced Motion skips typing.
Only a completed game writes an outcome, and only a qualified win writes clear
evidence. See [Terminal Story](story-terminal.md).

## Save-v6

`SaveRepository` owns `quantum-box-save-v6`. Story state separately records:

- `currentNodeId` and completion;
- experienced and cleared stages;
- transcript-seen chapters;
- attempt counts and last outcomes;
- exact qualified `RunContext` records;
- Qong selection, SkiPixl course receipts, and retained legacy v5 data.

Settings, key bindings, initials, background programme, audio state, and Arcade
records remain independent. Migration accepts legacy v1–v5 shapes, preserves
their evidence and hashes, and selects the earliest coherent unfinished node.
It never promotes an attempt or obsolete stage into a new win.

## Rendering and semantic UI

All visible in-game geometry is painted on one logical `320×180` framebuffer.
Public draw boundaries accept integer positions, dimensions, stroke widths, and
sprite scales. Raster helpers replace antialiased vector curves. The browser
scales the finished plane by whole-number nearest-neighbour multiples whenever
the viewport permits.

Transparent semantic DOM controls retain focus, pointer, keyboard, form, scroll,
and assistive-technology behavior. Bounds are projected to integer logical
rectangles before the bitmap layer paints text, separators, selectors, fields,
and focus state. Complete terminal pages are exposed semantically; individual
typed characters are not announced.

## Audio

`SynthAudio` owns one native `<audio>` background transport and Web Audio
effects. Cue requests are route-level state. Same-cue requests are no-ops;
cross-cue transitions fade out then in; a generation token prevents stale play
promises from reviving an obsolete cue. Games request no background cue.
See [Audio](audio.md).

## Cabinet contracts

### Qong

Seven rounds use one stored one-shot Coin Toss selection. The own/opposite rule
begins unresolved and can be observed three times across the match. A physical
line crossing resolves scoring if the rule is still unknown.

### SkiPixl

All three Arcade modes and both Story courses have a 60-second base limit.
Twenty immutable QPixl capture triplets feed nested residual cuts. Local
thresholding determines terrain and gates without altering provider bytes.
Presentation speed approaches 72 at neutral, accelerates toward 92 while Down
is held at 36 units/s², and returns at 18 units/s². Current receipts use rules
v8; legacy replay versions remain readable.

### Quantman

The bank models authored topology separately from hardware capture. Seven maze
topologies are visible as successive courses; eight captures are available
because the original topology has two independent IBM Fez executions. Runtime
selects a topology/capture deterministically and samples only complete measured
states accepted by the explicit admissibility index. It never repairs bits or
walls. Arcade exposes Hold and Invert, not maze selection.

### Fluxball

Global owns one shared mutable rule state. Individual owns separate hidden
player rules coupled through the joint recorded QGraph state. Every format uses
four 40-second rounds and one shared `CHANGE RULES` opportunity per round.

CPU policy uses only public positions, velocities, possession, and observed goal
outcomes. It probes movement deterministically, infers direction from public
events, assigns chase/defence/support/interception roles, and cannot inspect
hidden rules. Physical goal crossing is detected before rule-based attribution.
Held possession uses a hand socket rather than a beam or duplicate loose ball;
deterministic body contact can dislodge it with pair-specific cooldown.

### Quarry

Each run deterministically selects one of 24 IBM Fez QGraph captures, covering
six relation recipes with four independent realizations each. Complete 12-bit
states install all directed relations together on the fixed remeasurement
schedule. Catches score, knock out the target, and respawn it elsewhere with
grace; they do not consume the relation or resample the graph. Arcade supports
one to four humans. Historical `quag` names remain at source/save boundaries.

## Asset and provider seam

Production loads the shipped canonical manifest rather than the historical
archive handoff. The shipping set excludes physical Designer/player/morph room
assets. Source manifests and acquisition material can remain in private history
but are never bundled automatically.

`compiler/` may validate and promote captured data offline. Runtime modules may
import only sanitized promoted banks. Network-boundary tests and release scans
guard this separation.

## CPU information boundary

CPU policies receive only the same public simulation information a player could
act on. Hidden rule values, future scheduled states, unobserved pack outcomes,
and privileged Story evidence are unavailable. A test fixture may inject state
to prove scoring or collision paths, but production policy cannot.
