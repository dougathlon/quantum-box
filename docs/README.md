# Quantum Box documentation

This directory separates newcomer orientation, binding implementation
contracts, and game-specific design notes. Historical QA logs are retained in
private development history and are intentionally absent from the public source
snapshot.

## Start here

- [Project map](project-map.md) — product flow, code ownership, data flow, and
  common change locations
- [Current status](current-status.md) — what is shipped, what is provisional,
  and the next high-leverage work
- [Contributing](../CONTRIBUTING.md) — setup, invariants, checks, and pull-request
  expectations

## Binding contracts

- [Architecture](architecture.md) — runtime layers, determinism, saves, Story,
  and cabinet authority
- [Demo release contract](demo-release-contract.md) — current product and
  publication decisions
- [Acceptance matrix](acceptance-matrix.md) — requirements and the evidence each
  one needs
- [Source lineage](source-lineage.md) — precise origin and transformation of
  hardware data, controls, and runtime assets
- [Critical play trace](critical-play-trace.md) — how each quantum-derived input
  becomes a player-visible mechanic

## Visual and interaction contracts

- [Visual reference contract](visual-reference-contract.md) — palette, scale,
  asset authority, and review gates
- [Design system](design-system-v1.md) — layout, typography, controls, HUD, and
  audio grammar

## Game-specific design

- [Qong unresolved rule state](design/qong-unresolved-rule-state.md)
- [Fluxball rule model](design/fluxball-rule-model.md)
- [Fluxball copy compression candidates](design/fluxball-copy-compression-candidates.md)

When documents disagree, the current demo release contract supersedes older
design notes, and executable tests decide implementation behavior. A passing
test still does not establish player comprehension or visual acceptance.
