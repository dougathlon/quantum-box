# Quantum Box current status

**Status date:** 2026-10-22. Unified desktop/mobile release candidate.

**Product URL:** <https://dougathlon.github.io/quantum-box/>

## Implemented

- All five cabinets, approved complete Story copy, selectable Retry/Continue after failures, Terminal transcripts and the all-five-clears Postscript gate.
- Desktop Brown Box pixel presentation, keyboard rebinding, controller setup and one or two human players. Four-competitor CPU formats remain available.
- Automatic portrait touch presentation on the same entry URL. Mobile has one human player, a contextual thumb control (or Quantman swipes), readable HUDs, persistent Back/navigation and explicit scroll affordances.
- Qong's fresh independent rally guess and 250 ms response to a public reveal; three shared human observations per match.
- Independent Fluxball CPU beliefs learned from public movement, contact and goals. Purposeful shot preparation corrects the reproduced harmful-shot loops. One shared human rule change per round.
- Quantman GAME OVER, eligible high-score entry, ghost tunnel slowdown and den release, one life per cleared maze, and consistent Hold/Invert sound triggers.
- SkiPixl and Quantman top-five score/time boards with initials and exact run/course provenance.
- Fail-closed saved evidence, bounded legacy migration, typed authority mismatches and telemetry isolated from gameplay.
- Unchanged hardware-backed banks for Qong Coin Toss, SkiPixl QPixl, Quantman Labyrinth, Fluxball QGraph and Quarry QGraph. Active gameplay makes no provider requests.
- Quantman's full measured bank is downloaded on first use and passes the existing validation before a run begins. Other games and menus do not download it.

## Verification and limits

Use [Contributing](../CONTRIBUTING.md) for the complete release gate and [deployment](deployment.md) for actual publication verification. A local build, collected test list or prepared commit is not a verified Pages deployment.

Physical-phone acceptance remains outstanding: thumb feel, sustained performance, thermal/battery behavior and listening on phone speakers require a real device. Browser emulation and Simulator evidence must be reported separately. Some managed macOS environments block native Playwright Chromium launch; the Linux workflow executes those journeys before deployment.

The gameplay policies are explained in [NPC behavior](npc-behavior.md). `quag` and `quantmanSynthetic` remain compatibility names, and historic schemas remain to preserve saves and provenance. Excluded retired implementations and local review artifacts are documented in [Contributing](../CONTRIBUTING.md).

No general open-source project licence has been granted. Provider-returned assets and provenance are immutable; tests and packaging do not authorize new provider runs or altered hardware artifacts.
