# Quantum Box documentation

These documents separate newcomer orientation, binding implementation
contracts, game-specific design, and historical evidence. Start with the first
three links; consult source lineage before changing quantum-derived data.

## Start here

- [Project map](project-map.md) — product flow, code ownership, and common
  change locations
- [Current status](current-status.md) — implemented behavior, limitations, and
  next work
- [Contributing](../CONTRIBUTING.md) — setup, invariants, checks, and review

- [Editing visuals and AI](editing-visuals-and-ai.md) — exact renderer, layout,
  policy and test entry points

## Binding contracts

- [Architecture](architecture.md) — runtime layers, determinism, persistence,
  and authority boundaries
- [Terminal Story](story-terminal.md) — graph, copy authority, typing, archive,
  and outcome semantics
- [Audio](audio.md) — cue routing, transport, loop provenance, and verification
- [Demo release](demo-release-contract.md) — current product decisions
- [Deployment](deployment.md) — sanitized publication and stable Pages URL
- [Source lineage](source-lineage.md) — origins, immutable returns, transforms,
  and caveats
- [Acceptance matrix](acceptance-matrix.md) — requirements and evidence status
- [Critical play trace](critical-play-trace.md) — quantum input to mechanic

## Visual and game contracts

- [Visual reference](visual-reference-contract.md) — palette, pixel grid, and
  asset authority
- [Design system](design-system-v1.md) — layout, type, controls, and HUD grammar
- [Qong rule state](design/qong-unresolved-rule-state.md)
- [Fluxball rule model](design/fluxball-rule-model.md)

Documents under `docs/qa/` are dated historical evidence, not current product
authority. When a historical note conflicts with a binding contract or current
test, the current contract and implementation win. A passing test still does
not establish player comprehension, visual acceptance, or listening approval.
