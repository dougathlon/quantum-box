import type { Page } from "@playwright/test";

/**
 * Builds a valid SkiPixl recovery record from an actual completed session over
 * the installed QPixl pack, then opens it only through the development replay
 * entry point. It does not seed post-Qong Story progress.
 */
export async function openSkiPixlSavedReplay(page: Page): Promise<unknown> {
  await page.locator("#quantum-box-canvas canvas").waitFor({
    state: "attached",
  });
  return page.evaluate(async () => {
    const paths = {
      run: "/src/core/run.ts",
      adapter: "/src/games/skipixl/SkiPixlCourseAdapter.ts",
      observation: "/src/games/skipixl/SkiPixlObservation.ts",
      policy: "/src/games/skipixl/SkiPixlPublicPolicy.ts",
      session: "/src/games/skipixl/SkiPixlSession.ts",
      lodge: "/src/tutorials/skiPixlLodge.ts",
      recovery: "/src/tutorials/recovery.ts",
    } as const;
    const [
      runModule,
      adapterModule,
      observationModule,
      policyModule,
      sessionModule,
      lodgeModule,
      recoveryModule,
    ] = await Promise.all([
      import(paths.run),
      import(paths.adapter),
      import(paths.observation),
      import(paths.policy),
      import(paths.session),
      import(paths.lodge),
      import(paths.recovery),
    ]);

    const pack = adapterModule.selectStorySkiPixlPack(0);
    const context = runModule.createRunContext({
      gameId: "skipixl",
      storyStage: "skipixl",
      playMode: "story",
      rulesVersion: pack.rulesVersion,
      runSeed: 23,
      pack: {
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.source,
      },
    });
    const session = new sessionModule.SkiPixlSession(context, pack.payload);
    let snapshot = session.snapshot();
    for (
      let tick = 0;
      tick < 8_000 && snapshot.phase !== "complete";
      tick += 1
    ) {
      const observation = observationModule.observeSkiPixl(
        pack.payload,
        snapshot,
      );
      snapshot = session.step(policyModule.skiPixlLookaheadInput(observation));
    }
    if (snapshot.phase !== "complete" || !snapshot.storyQualified) {
      throw new Error(
        `SkiPixl recovery source run failed: phase=${snapshot.phase} ` +
          `qualified=${String(snapshot.storyQualified)} ` +
          `collisions=${snapshot.collisions.length}.`,
      );
    }
    const gate = lodgeModule.adaptSkiPixlLodgeEvidence({
      origin: "completed-story-run",
      context,
      snapshot,
      evidence: adapterModule.createSkiPixlDesignerEvidence(pack),
      payload: pack.payload,
    });
    const record = recoveryModule.createTutorialRecoveryRecord(
      "skipixl",
      context,
      gate,
    );
    if (JSON.stringify(record).includes("development-fixture")) {
      throw new Error("Saved replay record contains development evidence.");
    }
    const legacyApi = window.__QUANTUM_BOX_TEST__ as
      | (typeof window.__QUANTUM_BOX_TEST__ & {
          openTutorialReplayForQa(record: unknown): Promise<void>;
        })
      | undefined;
    const open = legacyApi?.openTutorialReplayForQa;
    if (!open) throw new Error("Saved replay QA entry point is unavailable.");
    window.__QUANTUM_BOX_TEST__?.enterInternal();
    await open(record);
    return record;
  });
}
