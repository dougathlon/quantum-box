import type { Page } from "@playwright/test";

export interface SkiPixlSteeringTransition {
  readonly atMs: number;
  readonly steer: -1 | 0 | 1;
}

export interface SkiPixlBrowserPlan {
  readonly packId: string;
  readonly packContentSha256: string;
  readonly packSource: string;
  readonly courseLabel: string;
  readonly runSeed: number;
  readonly transitions: readonly SkiPixlSteeringTransition[];
  readonly durationMs: number;
  readonly expected: Readonly<{
    elapsedSeconds: number;
    collisions: number;
    missedGates: number;
    gateCount: number;
    targetSeconds: number;
    completedUnderLimit: boolean;
  }>;
}

/**
 * Produces a public-observation-only reference tape inside the same Vite-served
 * module graph as the app. The browser still receives ordinary keyboard events
 * and the production SkiPixlRuntime performs every fixed simulation step.
 */
export async function createArcadeSkiPixlBrowserPlan(
  page: Page,
  runSeed: number,
): Promise<SkiPixlBrowserPlan> {
  return page.evaluate(async (seed) => {
    const paths = {
      run: "/src/core/run.ts",
      adapter: "/src/games/skipixl/SkiPixlCourseAdapter.ts",
      observation: "/src/games/skipixl/SkiPixlObservation.ts",
      policy: "/src/games/skipixl/SkiPixlPublicPolicy.ts",
      session: "/src/games/skipixl/SkiPixlSession.ts",
    } as const;
    const [
      runModule,
      adapterModule,
      observationModule,
      policyModule,
      sessionModule,
    ] = await Promise.all([
      import(paths.run),
      import(paths.adapter),
      import(paths.observation),
      import(paths.policy),
      import(paths.session),
    ]);
    const pack = adapterModule.selectArcadeSkiPixlPack(seed);
    const context = runModule.createRunContext({
      gameId: "skipixl",
      storyStage: null,
      playMode: "arcade",
      rulesVersion: pack.rulesVersion,
      runSeed: seed,
      pack: {
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.source,
      },
    });
    const session = new sessionModule.SkiPixlSession(context, pack.payload);
    const transitions: SkiPixlSteeringTransition[] = [];
    const fixedStepMs = 1_000 / 60;
    let snapshot = session.snapshot();
    let previousSteer: -1 | 0 | 1 = 0;
    let ticks = 0;
    for (; ticks < 8_000 && snapshot.phase !== "complete"; ticks += 1) {
      const observation = observationModule.observeSkiPixl(
        pack.payload,
        snapshot,
      );
      const input = policyModule.skiPixlLookaheadInput(observation);
      const steer = input.steer;
      if (steer !== previousSteer) {
        transitions.push(
          Object.freeze({
            // Deliver just before the corresponding fixed step, independent of
            // the particular rAF phase used by headless Chromium.
            atMs: Math.max(0, (ticks - 0.25) * fixedStepMs),
            steer,
          }),
        );
        previousSteer = steer;
      }
      snapshot = session.step(input);
    }
    if (snapshot.phase !== "complete" || !snapshot.storyQualified) {
      throw new Error(
        `SkiPixl Arcade browser plan no longer completes cleanly: phase=${snapshot.phase} ` +
          `time=${snapshot.elapsedSeconds.toFixed(2)} ` +
          `collisions=${snapshot.collisions.length}.`,
      );
    }
    if (previousSteer !== 0) {
      transitions.push(Object.freeze({ atMs: ticks * fixedStepMs, steer: 0 }));
    }
    return Object.freeze({
      packId: pack.packId,
      packContentSha256: pack.contentSha256,
      packSource: pack.source,
      courseLabel: pack.payload.courseLabel,
      runSeed: seed,
      transitions: Object.freeze(transitions),
      durationMs: (ticks + 8) * fixedStepMs,
      expected: Object.freeze({
        elapsedSeconds: snapshot.elapsedSeconds,
        gateCount: snapshot.gateResults.length,
        collisions: snapshot.collisions.length,
        missedGates: snapshot.gateResults.filter(
          (gate: { readonly passed: boolean }) => !gate.passed,
        ).length,
        targetSeconds: snapshot.targetSeconds,
        completedUnderLimit: snapshot.storyQualified,
      }),
    });
  }, runSeed);
}
