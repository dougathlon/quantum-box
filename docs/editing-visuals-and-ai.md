# Editing Quantum Box visuals and AI

Start here when changing what players see or how computer-controlled characters
behave. The renderer consumes snapshots; policies choose inputs; sessions own
physics, scores, rule changes and outcomes. Changing a visual cue must not change
the underlying game or recorded quantum data.

## Visual entry points

| Change                                                 | Edit here                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Palette and logical screen                             | [BrownBoxTheme.ts](../src/display/BrownBoxTheme.ts)                                                |
| Integer pixel geometry                                 | [NativePixelRaster.ts](../src/display/NativePixelRaster.ts)                                        |
| Game lettering                                         | [PixelText.ts](../src/display/PixelText.ts), [TitleLettering.ts](../src/display/TitleLettering.ts) |
| Shared pause box and HUD primitives                    | [PixelHud.ts](../src/display/PixelHud.ts)                                                          |
| Terminal/menu composition and spacing                  | [brownBox.css](../src/display/brownBox.css)                                                        |
| Visible bitmap DOM text, wrapping and focus paint      | [BitmapDomText.ts](../src/display/BitmapDomText.ts)                                                |
| Semantic buttons, spatial focus, Settings and initials | [QuantumBoxShell.ts](../src/ui/QuantumBoxShell.ts)                                                 |
| Keyboard/gamepad mapping and held-input release        | [InputController.ts](../src/input/InputController.ts)                                              |
| Animated field programmes                              | [backgrounds/](../src/display/backgrounds/)                                                        |
| Story copy and sequence                                | [terminal/](../src/story/terminal/)                                                                |
| Arcade tutorial wording and modes                      | [registry.ts](../src/games/registry.ts)                                                            |
| Audio routing and browser unlock                       | [SynthAudio.ts](../src/audio/SynthAudio.ts), [QuantumBoxApp.ts](../src/app/QuantumBoxApp.ts)       |

The visible UI uses a 320×180 integer raster with three colours and binary
alpha. Semantic HTML owns input and accessibility underneath. A button painted
on the canvas still needs a real focusable control. Use ENTER / A for menu
selection and SPACE / A for Player A's gameplay action.

Do not fix clipped bitmap copy by changing only the browser font: the raster
glyph measure and DOM layout must agree. Keep terminal actions in their shared
footer. Verify short and long pages, focus in both Settings columns, and
controller-only initials entry.

### Cabinet renderers

| Cabinet  | Render owner                                                                                          | Current visual contract                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Qong     | [QongView.ts](../src/display/views/QongView.ts)                                                       | Compact score/header and open field; reference pause box.                                                    |
| SkiPixl  | [SkiPixlView.ts](../src/display/views/SkiPixlView.ts)                                                 | Trail lines strengthen when accelerating; no floating forward pixels.                                        |
| Quantman | [QuantmanSyntheticView.ts](../src/display/views/QuantmanSyntheticView.ts)                             | Shared Hold/Invert cone; no target square; solid brown changed walls.                                        |
| Fluxball | [FluxballView.ts](../src/display/views/FluxballView.ts)                                               | Ball attached to the carrier's hand; public rule-change prompt.                                              |
| Quarry   | [QuagView.ts](../src/display/views/QuagView.ts), [presentation.ts](../src/games/quag/presentation.ts) | A–D hunt rows at top, unboxed birds, open wrap without chevrons, top notices, one brief remeasurement pulse. |

All five use the pause helper in PixelHud. Quarry also replaces its HUD with
opening, round-break and final-result notices; do not put these back in the
field. Its remeasurement flash accompanies a local selection from recorded data,
not a live provider call.

Sprites are loaded through [CanonicalSpriteRaster.ts](../src/display/CanonicalSpriteRaster.ts)
and [QGraphCabinetSpriteRaster.ts](../src/display/QGraphCabinetSpriteRaster.ts).
Read [source lineage](source-lineage.md) and the
[visual contract](visual-reference-contract.md) before editing assets. Hash-bound
provider returns and source manifests are evidence; do not overwrite them as a
shortcut to a new visual.

## AI means local game policies

The opponents are deterministic local policies, not language models, remote
agents, or online learning services. No AI API key is needed to play or develop
them. Stored quantum results provide game conditions; they do not implement the
opponents. Shared observation/belief/decision types live in
[agents/contracts.ts](../src/agents/contracts.ts).

| System                   | Decision owner                                                               | What to change and what it may see                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Qong CPU                 | [QongCpuPolicy.ts](../src/games/qong/QongCpuPolicy.ts)                       | Goal-event belief updates, defend/concede choice and aiming offset. Uses public ball/paddle state and observed goals, not the unrevealed polarity.           |
| Fluxball CPU             | [FluxballCpuPolicy.ts](../src/games/fluxball/FluxballCpuPolicy.ts)           | Decision cadence, probing, learned action/interaction/goal beliefs, pursuit and support. Input is a public sport snapshot; do not pass hidden sampled rules. |
| Quarry CPU               | [QuagCpuPolicy.ts](../src/games/quag/QuagCpuPolicy.ts)                       | Target distance, intercept offsets, flap cadence and patrol destinations. Sees current players, outgoing targets and arena; respects wrap and grace.         |
| Quantman ghosts          | [GhostPolicy.ts](../src/games/quantmanSynthetic/game/GhostPolicy.ts)         | Role targets, shortest open paths, frightened behavior and deterministic fallback. Sees current maze/player state, not future sampled mazes.                 |
| SkiPixl evaluation pilot | [SkiPixlPublicPolicy.ts](../src/games/skipixl/SkiPixlPublicPolicy.ts)        | Navigability evaluation from the same forward observation window; not an opponent or an autopilot for the human.                                             |
| Quantman collector       | [CollectorPolicy.ts](../src/games/quantmanSynthetic/game/CollectorPolicy.ts) | Evaluation/test driver, separate from the player-controlled game and ghost policy.                                                                           |

For policy integration, inspect the matching session:
[QongSession.ts](../src/games/qong/QongSession.ts),
[FluxballSession.ts](../src/games/fluxball/FluxballSession.ts),
[QuagSession.ts](../src/games/quag/QuagSession.ts), or
[QuantmanSession.ts](../src/games/quantmanSynthetic/game/QuantmanSession.ts).
Sessions decide when policies run and apply their actions. Runtime classes
connect those sessions to input and rendering. Change policy tuning before
changing physics to compensate for an opponent's behavior.

Keep seeded behavior reproducible. Preserve each observation boundary: making a
CPU stronger by handing it hidden rules changes the game contract. Test equal
public observations against different hidden states where that boundary matters.
Historical names such as quag and quantmanSynthetic identify current production
code; older similarly named adapters are not the default editing target.

## Validate a change

- For visuals: start with [cabinetPauseRendering.test.ts](../tests/unit/cabinetPauseRendering.test.ts),
  [bitmapDomText.test.ts](../tests/unit/bitmapDomText.test.ts) and
  [nativePixelRaster.test.ts](../tests/unit/nativePixelRaster.test.ts).
- For policies: start with [agent.test.ts](../tests/unit/agent.test.ts),
  [fluxball.test.ts](../tests/unit/fluxball.test.ts),
  [quarryMechanics.test.ts](../tests/unit/quarryMechanics.test.ts) and
  [quantmanSynthetic.test.ts](../tests/unit/quantmanSynthetic.test.ts).
- Run the relevant tests, then the release checks in [Contributing](../CONTRIBUTING.md).
  A clean typecheck is not a visual or game-feel test.
- Play the changed cabinet in Story and Arcade where available. Inspect its
  opening, live action, pause, result and return path. For CPU changes, compare
  several fixed seeds and both solo/multiplayer formats; record capture/goal
  patterns and failure cases rather than judging one lucky run.

See [deployment](deployment.md) before publishing. Public main deploys Pages;
internal QA fixtures, screenshots, acquisition state and credentials do not
belong in that source tree.
