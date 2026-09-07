import { describe, expect, it } from "vitest";

import { createRunContext } from "../../src/core/run";
import {
  SKIPIXL_CONTROL_PACKS,
  type SkiPixlCommittedPack,
} from "../../src/games/skipixl/SkiPixlCourseAdapter";
import { createSkiPixlCourseChallengeEvidence } from "../../src/games/skipixl/SkiPixlChallenge";
import {
  observeSkiPixl,
  type SkiPixlPublicObservation,
} from "../../src/games/skipixl/SkiPixlObservation";
import { SkiPixlSession } from "../../src/games/skipixl/SkiPixlSession";
import { skiPixlLookaheadInput } from "../../src/games/skipixl/SkiPixlPublicPolicy";
import type {
  SkiPixlInput,
  SkiPixlPackPayload,
  SkiPixlSnapshot,
} from "../../src/games/skipixl/types";

type SkiPixlPolicy = (observation: SkiPixlPublicObservation) => SkiPixlInput;

interface PolicyRun {
  readonly packId: string;
  readonly completed: boolean;
  readonly qualified: boolean;
  readonly elapsedSeconds: number;
  readonly collisionCount: number;
  readonly snapshot: SkiPixlSnapshot;
  readonly inputs: readonly SkiPixlInput[];
}

interface PolicySummary {
  readonly successCount: number;
  readonly minimumSeconds: number;
  readonly medianSeconds: number;
  readonly maximumSeconds: number;
  readonly minimumCollisions: number;
  readonly maximumCollisions: number;
}

const NEUTRAL_INPUT: SkiPixlInput = Object.freeze({
  steer: 0,
  throttle: 0,
});

function straightPolicy(): SkiPixlInput {
  return NEUTRAL_INPUT;
}

function simpleReactivePolicy(
  observation: SkiPixlPublicObservation,
): SkiPixlInput {
  if (observation.knockdownTicksRemaining > 0) return NEUTRAL_INPUT;
  const threat = observation.visibleObstacles.find(
    (obstacle) =>
      obstacle.relativeDistance <= 70 &&
      Math.abs(obstacle.x - observation.skierX) <= 34,
  );
  if (!threat) return NEUTRAL_INPUT;
  const desiredAngle = threat.x < observation.skierX ? 1 : -1;
  return steerToward(observation.steeringAngle, desiredAngle);
}

function referencePlanningPolicy(
  observation: SkiPixlPublicObservation,
): SkiPixlInput {
  return skiPixlLookaheadInput(observation);
}

function steerToward(currentAngle: number, desiredAngle: number): SkiPixlInput {
  return {
    steer:
      desiredAngle === currentAngle ? 0 : desiredAngle < currentAngle ? -1 : 1,
    throttle: 0,
  };
}

function runPolicy(
  pack: SkiPixlCommittedPack,
  policy: SkiPixlPolicy,
): PolicyRun {
  const session = new SkiPixlSession(contextFor(pack), pack.payload);
  const inputs: SkiPixlInput[] = [];
  let snapshot = session.snapshot();
  for (let tick = 0; tick < 8_000 && snapshot.phase !== "complete"; tick += 1) {
    const input = policy(observeSkiPixl(pack.payload, snapshot));
    inputs.push(input);
    snapshot = session.step(input);
  }
  return Object.freeze({
    packId: pack.packId,
    completed: snapshot.phase === "complete",
    qualified: snapshot.storyQualified,
    elapsedSeconds: snapshot.elapsedSeconds,
    collisionCount: snapshot.collisions.length,
    snapshot,
    inputs: Object.freeze(inputs.map((input) => Object.freeze({ ...input }))),
  });
}

function contextFor(pack: SkiPixlCommittedPack) {
  return createRunContext({
    gameId: "skipixl",
    playMode: "arcade",
    rulesVersion: pack.rulesVersion,
    runSeed: 7_393,
    pack: {
      packId: pack.packId,
      contentSha256: pack.contentSha256,
      schemaVersion: pack.schemaVersion,
      source: pack.source,
    },
  });
}

function sweep(policy: SkiPixlPolicy): readonly PolicyRun[] {
  return Object.freeze(
    SKIPIXL_CONTROL_PACKS.map((pack) => runPolicy(pack, policy)),
  );
}

function report(name: string, runs: readonly PolicyRun[]): void {
  const result = summarize(runs);
  const gateMisses = runs.map(
    ({ snapshot }) =>
      snapshot.gateResults.filter(({ passed }) => !passed).length,
  );
  const failedIds = runs
    .filter((run) => !run.qualified)
    .map((run) => run.packId)
    .join(",");
  console.info(
    `SKIPIXL_POLICY ${name} success=${result.successCount}/${runs.length} ` +
      `time=${result.minimumSeconds.toFixed(2)}..${result.maximumSeconds.toFixed(2)} ` +
      `median=${result.medianSeconds.toFixed(2)} ` +
      `collisions=${result.minimumCollisions}..${result.maximumCollisions} ` +
      `gateMisses=${Math.min(...gateMisses)}..${Math.max(...gateMisses)} ` +
      `failed=${failedIds || "none"}`,
  );
}

function summarize(runs: readonly PolicyRun[]): PolicySummary {
  const elapsed = runs.map((run) => run.elapsedSeconds).sort((a, b) => a - b);
  const collisions = runs.map((run) => run.collisionCount);
  return Object.freeze({
    successCount: runs.filter((run) => run.qualified).length,
    minimumSeconds: elapsed[0] ?? Number.NaN,
    medianSeconds: median(elapsed),
    maximumSeconds: elapsed.at(-1) ?? Number.NaN,
    minimumCollisions: Math.min(...collisions),
    maximumCollisions: Math.max(...collisions),
  });
}

function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

describe("SkiPixl deterministic difficulty policy sweep", () => {
  it("separates no-look, simple reactive, and reference outcomes", () => {
    const straight = sweep(straightPolicy);
    const reactive = sweep(simpleReactivePolicy);
    const reference = sweep(referencePlanningPolicy);

    report("straight", straight);
    report("reactive", reactive);
    report("reference", reference);

    const straightSummary = summarize(straight);
    const reactiveSummary = summarize(reactive);
    const referenceSummary = summarize(reference);

    expect(straightSummary.successCount).toBeGreaterThan(0);
    expect(straightSummary.successCount).toBeLessThan(straight.length);
    expect(reactiveSummary.successCount).toBeGreaterThan(0);
    expect(reactiveSummary.successCount).toBeLessThan(reactive.length);
    expect(referenceSummary.successCount).toBeGreaterThan(
      reactiveSummary.successCount,
    );
    expect(reference.every((run) => run.completed)).toBe(true);
    expect(referenceSummary.minimumCollisions).toBe(0);
    expect(referenceSummary.maximumCollisions).toBeLessThanOrEqual(16);
    expect(referenceSummary.minimumSeconds).toBeGreaterThan(35);
    expect(
      reference
        .filter((run) => run.qualified)
        .every((run) => run.elapsedSeconds < run.snapshot.targetSeconds),
    ).toBe(true);
    const straightByCut = (["P90", "P84", "P78"] as const).map((cutId) =>
      straight.filter((run) => run.packId.endsWith(cutId.toLowerCase())),
    );
    expect(
      straightByCut[0]!.filter((run) => run.qualified).length,
    ).toBeGreaterThan(straightByCut[2]!.filter((run) => run.qualified).length);
    const referenceHard = reference.filter((run) => run.packId.endsWith("p78"));
    const referenceEasy = reference.filter((run) => run.packId.endsWith("p90"));
    expect(
      Math.min(...referenceEasy.map((run) => run.elapsedSeconds)),
    ).toBeGreaterThan(35);
    expect(
      Math.max(...referenceEasy.map((run) => run.elapsedSeconds)),
    ).toBeLessThan(55);
    expect(referenceHard.some((run) => run.qualified)).toBe(true);
    expect(referenceHard.some((run) => !run.qualified)).toBe(true);
  }, 30_000);

  it("repeats every reference sweep and semantic-input replay exactly", () => {
    const packs = [
      SKIPIXL_CONTROL_PACKS[0]!,
      SKIPIXL_CONTROL_PACKS[4]!,
      SKIPIXL_CONTROL_PACKS[8]!,
    ];
    const first = packs.map((pack) => runPolicy(pack, referencePlanningPolicy));
    const second = packs.map((pack) =>
      runPolicy(pack, referencePlanningPolicy),
    );

    expect(second.map((run) => run.snapshot)).toEqual(
      first.map((run) => run.snapshot),
    );
    first.forEach((run, index) => {
      const pack = packs[index]!;
      const replay = new SkiPixlSession(contextFor(pack), pack.payload);
      run.inputs.forEach((input) => replay.step(input));
      expect(replay.snapshot()).toEqual(run.snapshot);
    });
  });

  it("makes each knockdown a material time cost", () => {
    const pack = SKIPIXL_CONTROL_PACKS[0]!;
    const clearPayload: SkiPixlPackPayload = Object.freeze({
      ...pack.payload,
      courseLength: 800,
      obstacles: Object.freeze([]),
    });
    const treePayload: SkiPixlPackPayload = Object.freeze({
      ...clearPayload,
      obstacles: Object.freeze([
        Object.freeze({
          ...pack.payload.obstacles[0]!,
          obstacleId: "difficulty-tree",
          distance: 140,
          x: 320,
          kind: "tree" as const,
        }),
      ]),
    });
    const mogulPayload: SkiPixlPackPayload = Object.freeze({
      ...clearPayload,
      obstacles: Object.freeze([
        Object.freeze({
          ...pack.payload.obstacles[0]!,
          obstacleId: "difficulty-mogul",
          distance: 140,
          x: 320,
          kind: "rock" as const,
        }),
      ]),
    });

    const clear = completeNeutral(pack, clearPayload);
    const tree = completeNeutral(pack, treePayload);
    const mogul = completeNeutral(pack, mogulPayload);

    console.info(
      `SKIPIXL_COLLISION clear=${clear.elapsedSeconds.toFixed(2)} ` +
        `tree=${tree.elapsedSeconds.toFixed(2)} ` +
        `treeDelta=${(tree.elapsedSeconds - clear.elapsedSeconds).toFixed(2)} ` +
        `mogul=${mogul.elapsedSeconds.toFixed(2)} ` +
        `mogulDelta=${(mogul.elapsedSeconds - clear.elapsedSeconds).toFixed(2)}`,
    );

    expect(tree.collisions[0]?.penaltyTicks).toBe(72);
    expect(mogul.collisions[0]?.penaltyTicks).toBe(42);
    expect(tree.elapsedSeconds - clear.elapsedSeconds).toBeGreaterThan(1.2);
    expect(mogul.elapsedSeconds - clear.elapsedSeconds).toBeGreaterThan(0.7);
  });

  it("exposes frozen course and challenge evidence for the later lodge tutorial", () => {
    SKIPIXL_CONTROL_PACKS.forEach((pack) => {
      const evidence = createSkiPixlCourseChallengeEvidence(pack.payload);
      expect(evidence.courseId).toBe(pack.payload.courseId);
      expect(evidence.segmentCount).toBe(3);
      expect(evidence.segments).toEqual(pack.payload.receipt.segments);
      expect(evidence.obstacleCount).toBe(pack.payload.obstacles.length);
      expect(evidence.treeCount + evidence.mogulCount).toBe(
        pack.payload.obstacles.length,
      );
      expect(evidence.difficultyScore).toBe(pack.payload.difficultyScore);
      expect(evidence.winSeconds).toBe(pack.payload.winSeconds);
      expect(evidence.challengeProfile.version).toBe("skipixl-challenge-v5");
      expect(Object.isFrozen(evidence)).toBe(true);
    });
  });
});

function completeNeutral(
  pack: SkiPixlCommittedPack,
  payload: SkiPixlPackPayload,
): SkiPixlSnapshot {
  const session = new SkiPixlSession(contextFor(pack), payload);
  let snapshot = session.snapshot();
  for (let tick = 0; tick < 8_000 && snapshot.phase !== "complete"; tick += 1) {
    snapshot = session.step(NEUTRAL_INPUT);
  }
  return snapshot;
}
