# Quantum Box visual reference contract

**Status:** binding, revised 2026-09-09

**Shipping manifest:** `src/assets/canonical-runtime-assets-v2/manifests/shipped-runtime-handoff.json`

Recovered mockups and the full canonical archive remain historical direction.
The shipping manifest is the production authority. It contains 31 byte-identical
runtime PNGs and produces 52 ordered frames. Its SHA-256 is
`51311236eaaec3cc6627ae987c94891a7d043043e630ffb8765a2bc64e3cd83e`.
The underlying immutable archive handoff is pinned by that manifest but is not
eagerly imported.

## Pixel contract

- Logical resolution is exactly `320×180`.
- Palette is `#2B1C14`, `#564330`, and `#D6BD8B`.
- Sprite transparency is binary: alpha 0 or 255, with no hidden RGB.
- Scaling is integer nearest-neighbour.
- Public drawing inputs and final sprite anchors use whole logical pixels.
- Curves, circles, ellipses, diagonals, dashes, and effects are deliberate
  raster geometry rather than antialiased browser/Phaser paths.
- Background evidence, local authored sprites, UI, and composites retain
  separate provenance.

## Surface map

| Surface  | Production authority                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Opening  | Selected Brown Box background programme plus local bitmap `QUANTUM BOX` and `PRESS START`; no photograph                  |
| Home     | Four bitmap rows: Story, Arcade, Terminal, Settings                                                                       |
| Story    | Terminal pages only; no chapter selector or physical characters/rooms                                                     |
| Arcade   | Five-cabinet index followed by a terminal-style trial sheet                                                               |
| Terminal | Five transcript/retry rows and terminal transcript pages                                                                  |
| Qong     | Canonical paddles plus raster ball, court, and HUD                                                                        |
| SkiPixl  | Approved steering/fall family plus raster terrain and gates                                                               |
| Quantman | Approved angular player/ghost family plus continuous raster maze rails                                                    |
| Fluxball | Classic-derived role silhouettes; held-ball hand pose; no beam                                                            |
| Quarry   | Directional ducks, raster arenas, top hunt relationships and notices, brief remeasurement pulse, knockout and grace blink |
| Settings | Sectioned semantic form whose complete visible geometry is bitmap-projected                                               |

Physical Designer/player/morph/room assets and Enclose are excluded from the
shipping manifest and production bundle. Their old source provenance may remain
in private history but does not authorize a public runtime import.

## Review gate

1. inspect native `320×180` output;
2. inspect nearest-neighbour 2×, 3×, 4×, and 6× crops;
3. inspect a served `1280×720` desktop view;
4. capture moving frames, not only idle states;
5. audit exact palette, binary alpha, asset hashes, and fractional placement;
6. distinguish provider returns, local derivatives, composites, and screenshots;
7. report human visual acceptance separately from automated uniformity.
