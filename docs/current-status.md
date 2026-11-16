# Quantum Box current status

**Status date:** 2026-11-15. Desktop-only local release candidate; publication is verified separately.

**Product URL:** <https://dougathlon.github.io/quantum-box/>

## Implemented

- All five cabinets and approved complete Story copy. Successful Story outcomes offer Continue only. Qong and Quantman require Retry after the first completed loss in a playthrough; later losses, and losses in the other games, offer Retry/Continue. New Story resets first-loss routing while retaining earned results.
- Reaching the narrative ending opens both Postscript pages without a win gate. Terminal offers Read for fully cleared chapters and Retry for encountered, unfinished chapters. Read follows the authored success transcript; Retry begins at the introduction for the earliest uncleared stage and leaves the main Story cursor unchanged. Read history, narrative access, and gameplay wins remain distinct.
- Desktop Brown Box pixel presentation, keyboard rebinding, controller setup and one or two human players. Four-competitor CPU formats remain available.
- Mobile presentation, touch input, automatic switching and mobile-only fixtures are retired from the active release.
- Qong's fresh independent rally guess and 250 ms response to a public reveal; three shared human observations per match.
- Independent Fluxball CPU beliefs learned from public movement, contact and goals. Purposeful shot preparation corrects the reproduced harmful-shot loops. Bounded boundary recovery prevents reproduced post-inversion wall deadlocks without treating collisions as rule evidence. One shared human rule change per round. The final round opens results automatically with its rule history retained; intermediate rounds retain the reveal and Next Round step.
- Quarry v7 awards one round win to every tied leader above the remaining players. Partial match ties are shared wins; all-player ties remain draws. Historical v4/v5 replay scoring and exact qualified run identities remain supported.
- Quantman GAME OVER, eligible high-score entry, ghost tunnel slowdown and den release, one life per cleared maze, and consistent Hold/Invert sound triggers.
- SkiPixl and Quantman top-five score/time boards with initials and exact run/course provenance.
- Fail-closed saved evidence, bounded legacy migration, typed authority mismatches and telemetry isolated from gameplay.
- Unchanged hardware-backed banks for Qong Coin Toss, SkiPixl QPixl, Quantman Labyrinth, Fluxball QGraph and Quarry QGraph. Active gameplay makes no provider requests.
- Quantman's full measured bank is downloaded on first use and passes the existing validation before a run begins. Other games and menus do not download it.

## Verification and limits

Use [Contributing](../CONTRIBUTING.md) for the complete release gate and [deployment](deployment.md) for actual publication verification. A local build, collected test list or prepared commit is not a verified Pages deployment.

Physical-controller feel and human listening remain separate from automated checks. The desktop browser matrix covers Chromium, WebKit and Firefox; report any unavailable engine or host-policy launch failure explicitly. A collected browser suite does not establish execution.

The gameplay policies are explained in [NPC behavior](npc-behavior.md). `quag` and `quantmanSynthetic` remain compatibility names, and historic schemas remain to preserve saves and provenance. Excluded retired implementations and local review artifacts are documented in [Contributing](../CONTRIBUTING.md).

No general open-source project licence has been granted. Provider-returned assets and provenance are immutable; tests and packaging do not authorize new provider runs or altered hardware artifacts.

Quarry round breaks last three seconds in new v7 runs. Older v4/v5/v6 runs retain their two-second timing; v6 shared-win scoring is preserved. Qualifying SkiPixl/Quantman Arcade results offer Continue into initials entry; cleared Arcade Quantman mazes offer Next Maze only.
