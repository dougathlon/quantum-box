# Quantum Box current status

**Snapshot:** 2026-09-07 public demo line

This file distinguishes shipped functionality from presentation that is still
provisional. The current GitHub Actions result on `main` is the authority for
whether the stable Pages URL contains the latest source commit.

## Implemented and release-gated

- Five shipped cabinets: Qong, SkiPixl, Fluxball, Quantman, and Quarry.
- Five visible Story chapters and eight ordered gameplay stages.
- One shared deterministic fixed-step runtime path for Story and Arcade.
- Hardware-backed runtime banks for all five games, selected before play with
  no browser-time provider call.
- Versioned saves, legacy migration, pending Story-beat recovery, and internal
  deterministic replay evidence.
- Four-player keyboard profiles and configurable bindings.
- SkiPixl and Quantman Arcade top-five boards with initials and immutable run,
  course, and pack provenance.
- Six selectable, provenance-labelled Brown Box background programs.
- A selectable five-record Workshop whose records unlock through Story.
- A pinned GitHub Actions gate that scans public source, executes browser
  journeys, builds the static artifact, and updates one stable Pages URL.

## Deliberately provisional

- **Later Story staging:** Qong and SkiPixl carry the bespoke spatial/cinematic
  direction. Fluxball, Quantman, and Quarry have complete navigable transitions
  and evidence binding, but their animation, spaces, dialogue, and pacing still
  need the same authored attention.
- **Workshop:** the five recovery records and gating work, but their information
  architecture, writing, and visual presentation remain an editorial/design
  project rather than a finished educational experience.
- **Game feel:** deterministic tests establish rules and reachability, not fun.
  Fluxball multiplayer CPU behavior and scoring feel, Quarry collision density,
  Quantman first-contact comprehension, and SkiPixl course variance still need
  repeated human play.
- **Input hardware:** keyboard and standard gamepad mappings exist, but physical
  controller, D-pad, multi-keyboard rollover, and exhibition-device testing are
  not complete.
- **Typography:** the current release makes a conservative title and spacing
  repair. A broader internal 7×9 heading experiment remains an option, not an
  approved redesign.
- **Cross-browser audio:** lifecycle and loop behavior have automated coverage,
  but long-session listening on the intended exhibition browsers remains a
  human acceptance task.

## Next work in priority order

1. Give Fluxball, Quantman, and Quarry bespoke in-world Story transitions that
   match the accepted Qong/SkiPixl spatial grammar.
2. Rewrite and stage the five Workshop records for progressive comprehension;
   keep audit-grade provenance available without leading with it.
3. Run structured human play sessions for every cabinet and tune only against
   observed problems, especially multiplayer Fluxball and Quarry.
4. Validate and polish controller/D-pad navigation and local multiplayer on the
   actual target hardware.
5. Decide whether to prototype the bounded 7×9 heading layer; do not replace the
   complete type system without screen-by-screen evidence.
6. Choose a project licence if collaboration should extend beyond invited pull
   requests and repository-local review.

## Known collaboration constraints

- The public repository intentionally omits private QA history, raw acquisition
  caches, operator-only notes, credentials, and retired Enclose code.
- Some historical names remain in source for compatibility. See
  [project-map.md](project-map.md) before renaming `quag` or
  `quantmanSynthetic`.
- Provider captures are evidence, not raw material for cleanup. New hardware
  acquisition is a separate explicitly authorized operation.
- No project licence is currently granted. Dependency licences do not license
  Quantum Box itself.

For requirement-level status, use the
[acceptance matrix](acceptance-matrix.md). For the exact boundary between
provider data and local game code, use [source lineage](source-lineage.md).
