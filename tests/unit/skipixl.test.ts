import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  sha256CanonicalJson,
} from "../../src/core/canonicalJson";
import { createRunContext, type RunContext } from "../../src/core/run";
import {
  createSkiPixlDesignerEvidence,
  findInstalledSkiPixlPack,
  installedSkiPixlBank,
  selectArcadeSkiPixlCuts,
  selectArcadeSkiPixlPack,
  selectStorySkiPixlPack,
  SKIPIXL_CONTROL_PACKS,
  type SkiPixlCommittedPack,
} from "../../src/games/skipixl/SkiPixlCourseAdapter";
import { skiPixlCollisionClearance } from "../../src/games/skipixl/SkiPixlChallenge";
import { SkiPixlSession } from "../../src/games/skipixl/SkiPixlSession";
import {
  observeSkiPixl,
  type SkiPixlPublicObservation,
} from "../../src/games/skipixl/SkiPixlObservation";
import type {
  SkiPixlInput,
  SkiPixlPackPayload,
  SkiPixlSnapshot,
} from "../../src/games/skipixl/types";
import { SKIPIXL_READY_TICKS } from "../../src/games/skipixl/types";

function context(pack: SkiPixlCommittedPack, seed = 17): RunContext {
  return createRunContext({
    gameId: "skipixl",
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
}

function autopilotInput(observation: SkiPixlPublicObservation): SkiPixlInput {
  if (observation.knockdownTicksRemaining > 0) {
    return { steer: 0, throttle: 0 };
  }
  const threat = observation.visibleObstacles.find(
    (obstacle) =>
      obstacle.relativeDistance <= 190 &&
      Math.abs(obstacle.x - observation.skierX) <=
        skiPixlCollisionClearance(obstacle.kind) + 8,
  );
  const desiredAngle = threat ? (threat.x < observation.skierX ? 1 : -1) : 0;
  return {
    steer:
      desiredAngle === observation.steeringAngle
        ? 0
        : desiredAngle < observation.steeringAngle
          ? -1
          : 1,
    throttle: 0,
  };
}

function complete(
  pack: SkiPixlCommittedPack,
  inputFor: (snapshot: SkiPixlSnapshot) => SkiPixlInput,
  seed = 17,
): { snapshot: SkiPixlSnapshot; inputs: readonly SkiPixlInput[] } {
  const session = new SkiPixlSession(context(pack, seed), pack.payload);
  const inputs: SkiPixlInput[] = [];
  let snapshot = session.snapshot();
  for (
    let tick = 0;
    tick < 10_000 && snapshot.phase !== "complete";
    tick += 1
  ) {
    const input = inputFor(snapshot);
    inputs.push(input);
    snapshot = session.step(input);
  }
  return { snapshot, inputs };
}

function activate(session: SkiPixlSession): SkiPixlSnapshot {
  let snapshot = session.snapshot();
  for (let tick = 0; tick < SKIPIXL_READY_TICKS; tick += 1) {
    snapshot = session.step({ steer: 0, throttle: 0 });
  }
  return snapshot;
}

describe("SkiPixl QPixl course bank", () => {
  it("installs twenty immutable IBM Fez triplets with three nested residual cuts", () => {
    const bank = installedSkiPixlBank();
    expect(bank.bankId).toBe("qpixl-b3-segment-bank-v1");
    expect(bank.bankContentSha256).toBe(
      "f09d509dd4f6980c0ac5146466e32c736f0688d13156334216720fa52dc8bffb",
    );
    expect(bank.engineId).toBe("qpixl-v1");
    expect(bank.mode).toBe("qpu");
    expect(bank.backend).toBe("ibm_fez");
    expect(bank.segments).toHaveLength(20);
    expect(bank.schedules).toHaveLength(20);
    expect(SKIPIXL_CONTROL_PACKS).toHaveLength(60);

    SKIPIXL_CONTROL_PACKS.forEach((pack) => {
      expect(pack.source).toBe("moth-platform-qpu-capture");
      expect(pack.payload.obstacles.length).toBeGreaterThanOrEqual(120);
      expect(pack.payload.obstacles.length).toBeLessThanOrEqual(265);
      expect(pack.payload.receipt.schemaVersion).toBe(
        "skipixl-course-receipt-v8",
      );
      expect(pack.payload.receipt.segments).toHaveLength(3);
      expect(
        new Set(pack.payload.receipt.segments.map(({ segmentId }) => segmentId))
          .size,
      ).toBe(3);
      pack.payload.obstacles.forEach((obstacle) => {
        expect(Math.abs(obstacle.horizontalOffset ?? 0)).toBeLessThanOrEqual(9);
        expect(Math.abs(obstacle.downhillOffset ?? 0)).toBeLessThanOrEqual(35);
        expect(obstacle.distance).toBe(
          (obstacle.baseDistance ?? 0) + (obstacle.downhillOffset ?? 0),
        );
        expect(obstacle.absoluteResidual).toBeGreaterThanOrEqual(
          pack.payload.receipt.selectionThreshold,
        );
        expect(obstacle.kind).toBe(obstacle.residual >= 0 ? "tree" : "rock");
      });
      expect(
        pack.payload.receipt.treeObstacleCount +
          pack.payload.receipt.mogulObstacleCount,
      ).toBe(pack.payload.obstacles.length);
      expect([0.9, 0.84, 0.78]).toContain(
        pack.payload.receipt.selectionPercentile,
      );
      expect(pack.payload.receipt.selectionThreshold).toBeGreaterThan(0);
      expect(pack.payload.receipt.denseRowCount).toBeGreaterThan(0);
      expect(pack.payload.winSeconds).toBe(60);
      if (pack.payload.receipt.schemaVersion !== "skipixl-course-receipt-v8") {
        throw new Error("Current SkiPixl pack did not expose a v8 receipt.");
      }
      expect(pack.payload.difficulty).toBe(
        { P90: "easy", P84: "medium", P78: "hard" }[pack.payload.receipt.cutId],
      );
      expect(pack.payload.gates).toHaveLength(
        { P90: 0, P84: 8, P78: 12 }[pack.payload.receipt.cutId],
      );
      expect(pack.payload.receipt.gateCount).toBe(pack.payload.gates?.length);
      expect(pack.payload.rowSpacing).toBe(
        pack.payload.receipt.cutId === "P90" ? 47 : 63,
      );
      expect(pack.payload.courseLength).toBe(
        pack.payload.receipt.cutId === "P90" ? 2_867 : 3_843,
      );
      expect(pack.payload.receipt.courseLengthRule).toContain(
        pack.payload.receipt.cutId === "P90" ? "shorter hill" : "preserve",
      );
      pack.payload.gates?.forEach((gate) => {
        const source = pack.payload.obstacles.find(
          ({ obstacleId }) => obstacleId === gate.sourceObstacleId,
        );
        expect(source).toMatchObject({
          segmentId: gate.segmentId,
          cellIndex: gate.cellIndex,
          residual: gate.residual,
        });
        expect(gate.leftX).toBeLessThan(gate.centerX);
        expect(gate.centerX).toBeLessThan(gate.rightX);
        expect(gate.leftX).toBeGreaterThan(pack.payload.corridorMinX);
        expect(gate.rightX).toBeLessThan(pack.payload.corridorMaxX);
      });
    });
  });

  it("binds source pixels, returned values, bank core, and payloads to their hashes", async () => {
    const bank = installedSkiPixlBank();
    bank.segments.forEach((segment) => {
      expect(
        createHash("sha256")
          .update(Uint8Array.from(segment.sourcePixels))
          .digest("hex"),
      ).toBe(segment.sourcePixelSha256);
      expect(
        createHash("sha256")
          .update(canonicalJson(segment.returnedValues))
          .digest("hex"),
      ).toBe(segment.returnedValuesSha256);
    });
    for (const pack of SKIPIXL_CONTROL_PACKS) {
      expect(await sha256CanonicalJson(pack.payload)).toBe(pack.contentSha256);
    }
  });

  it("selects the bank cyclically for Story attempts and Arcade seeds", () => {
    expect(selectStorySkiPixlPack(20)).toBe(selectStorySkiPixlPack(0));
    expect(selectStorySkiPixlPack(39)).toBe(selectStorySkiPixlPack(19));
    expect(selectArcadeSkiPixlPack(40)).toBe(selectArcadeSkiPixlPack(0));
    const cuts = selectArcadeSkiPixlCuts(0);
    const p84Ids = new Set(
      cuts.packs.P84.payload.obstacles.map(({ obstacleId }) => obstacleId),
    );
    expect(
      cuts.packs.P90.payload.obstacles.every(({ obstacleId }) =>
        p84Ids.has(obstacleId),
      ),
    ).toBe(true);
  });

  it("retains the full-length v5 pack for saved replay compatibility", () => {
    const previous = findInstalledSkiPixlPack(
      "skipixl-b3-triplet-01-p90",
      "c3b86e5961122a5cd404acd6d963fd623e9c227d21bc51c82fbaadab7fc1bf8e",
    );
    expect(previous?.rulesVersion).toBe("skipixl-rules-v5");
    expect(previous?.payload.courseLength).toBe(4_270);
    expect(previous?.payload.receipt.schemaVersion).toBe(
      "skipixl-course-receipt-v5",
    );
  });

  it("retains the 75-second v6 Easy pack for saved replay compatibility", () => {
    const previous = findInstalledSkiPixlPack(
      "skipixl-b3-triplet-01-p90",
      "5f7e436fef4ade04a2e28408c44d6660147c6eb29c749bb27c05ea34ee7d96db",
    );
    expect(previous?.rulesVersion).toBe("skipixl-rules-v6");
    expect(previous?.payload.courseLength).toBe(2_867);
    expect(previous?.payload.winSeconds).toBe(75);
    expect(previous?.payload.receipt.schemaVersion).toBe(
      "skipixl-course-receipt-v6",
    );
  });

  it("provides distinct quantum-derived courses across the installed run bank", () => {
    expect(
      new Set(SKIPIXL_CONTROL_PACKS.map((pack) => pack.contentSha256)).size,
    ).toBe(SKIPIXL_CONTROL_PACKS.length);
    expect(
      new Set(
        SKIPIXL_CONTROL_PACKS.map((pack) =>
          pack.payload.obstacles
            .map((obstacle) => `${obstacle.column}:${obstacle.kind}`)
            .join("|"),
        ),
      ).size,
    ).toBeGreaterThan(1);
  });

  it("builds Designer rows from the exact submitted and returned QPixl cells", () => {
    const pack = selectStorySkiPixlPack(0);
    const bank = installedSkiPixlBank();
    const evidence = createSkiPixlDesignerEvidence(pack);
    expect(evidence.packId).toBe(pack.packId);
    expect(evidence.contentSha256).toBe(pack.contentSha256);
    expect(evidence.segments).toHaveLength(3);
    expect(evidence.sampledLocalRows).toEqual([0, 5, 10, 15, 19]);
    expect(evidence.obstacleCount).toBe(pack.payload.obstacles.length);
    expect(evidence.selectionPercentile).toBe(0.9);
    expect(evidence.selectionThreshold).toBe(
      pack.payload.receipt.selectionThreshold,
    );
    expect(evidence.difficultyScore).toBe(pack.payload.difficultyScore);
    expect(evidence.winSeconds).toBe(pack.payload.winSeconds);

    const sample = evidence.segments[0]![2]!;
    const segment = bank.segments.find(
      (candidate) => candidate.segmentId === sample.segmentId,
    )!;
    expect(sample.selectedHazards.length).toBeGreaterThan(0);
    for (const hazard of sample.selectedHazards) {
      const obstacle = pack.payload.obstacles.find(
        (candidate) => candidate.obstacleId === hazard.obstacleId,
      );
      expect(obstacle).toBeDefined();
      expect(hazard.column).toBe(obstacle?.column);
      expect(hazard.cellIndex).toBe(obstacle?.cellIndex);
      expect(hazard.sourceByte).toBe(segment.sourcePixels[hazard.cellIndex]);
      expect(hazard.returnedValue).toBe(
        segment.returnedValues[hazard.cellIndex],
      );
      expect(hazard.residual).toBeCloseTo(
        hazard.returnedValue - hazard.sourceByte / 255,
        12,
      );
    }
  });

  it("holds course state for the exact three-second ready window", () => {
    const pack = selectStorySkiPixlPack(0);
    const session = new SkiPixlSession(context(pack), pack.payload);
    let snapshot = session.snapshot();
    expect(snapshot.readyTicksRemaining).toBe(SKIPIXL_READY_TICKS);
    for (let tick = 1; tick < SKIPIXL_READY_TICKS; tick += 1) {
      snapshot = session.step({ steer: -1, throttle: 1 });
    }
    expect(snapshot.phase).toBe("ready");
    expect(snapshot.distance).toBe(0);
    expect(snapshot.skierX).toBe(320);
    expect(snapshot.steeringAngle).toBe(0);

    snapshot = session.step({ steer: -1, throttle: 1 });
    expect(snapshot.phase).toBe("active");
    expect(snapshot.distance).toBe(0);
  });

  it("accelerates with Down and returns deterministically to cruise on release", () => {
    const pack = selectStorySkiPixlPack(0);
    const clearPayload = {
      ...pack.payload,
      courseLength: 100_000,
      obstacles: [],
      gates: [],
    };
    const accelerating = new SkiPixlSession(context(pack), clearPayload);
    const cruising = new SkiPixlSession(context(pack), clearPayload);
    activate(accelerating);
    activate(cruising);

    for (let tick = 0; tick < 60; tick += 1) {
      accelerating.step({ steer: 0, throttle: 1 });
      cruising.step({ steer: 0, throttle: 0 });
    }
    expect(accelerating.snapshot().speed).toBe(92);
    expect(cruising.snapshot().speed).toBe(72);

    for (let tick = 0; tick < 30; tick += 1) {
      accelerating.step({ steer: 0, throttle: 0 });
    }
    expect(accelerating.snapshot().speed).toBeCloseTo(83, 8);
  });

  it("slows a traverse as repeated steering rotates the skis toward horizontal", () => {
    const pack = selectStorySkiPixlPack(1);
    const straight = new SkiPixlSession(context(pack), pack.payload);
    const traverse = new SkiPixlSession(context(pack), pack.payload);
    activate(straight);
    activate(traverse);

    for (let tick = 0; tick < 22; tick += 1) {
      traverse.step({ steer: -1, throttle: 0 });
      straight.step({ steer: 0, throttle: 0 });
    }
    expect(traverse.snapshot().steeringAngle).toBe(-3);

    const traverseDistance = traverse.snapshot().distance;
    for (let tick = 0; tick < 60; tick += 1) {
      traverse.step({ steer: 0, throttle: 0 });
      straight.step({ steer: 0, throttle: 0 });
    }
    expect(traverse.snapshot().distance).toBeGreaterThan(traverseDistance);
    expect(traverse.snapshot().lateralVelocity).toBe(0);
    expect(straight.snapshot().distance).toBeGreaterThan(traverseDistance);
    expect(straight.snapshot().distance).toBeGreaterThan(
      traverse.snapshot().distance,
    );
  });

  it("holds the skier visibly down after a collision while elapsed time continues", () => {
    const pack = selectStorySkiPixlPack(2);
    const collisionPayload: SkiPixlPackPayload = Object.freeze({
      ...pack.payload,
      courseLength: 240,
      obstacles: Object.freeze([
        Object.freeze({
          ...pack.payload.obstacles[0]!,
          obstacleId: "collision-test-tree",
          distance: 24,
          x: 320,
          kind: "tree" as const,
        }),
      ]),
    });
    const session = new SkiPixlSession(context(pack), collisionPayload);
    let snapshot = activate(session);
    while (snapshot.latestCollision === null && snapshot.elapsedTicks < 120) {
      snapshot = session.step({ steer: 0, throttle: 0 });
    }

    expect(snapshot.latestCollision?.obstacleId).toBe("collision-test-tree");
    expect(snapshot.knockdownTicksRemaining).toBeGreaterThan(0);
    const collisionDistance = snapshot.distance;
    const collisionElapsedTicks = snapshot.elapsedTicks;
    for (let tick = 0; tick < 10; tick += 1) {
      snapshot = session.step({ steer: 0, throttle: 0 });
    }
    expect(snapshot.distance).toBe(collisionDistance);
    expect(snapshot.elapsedTicks).toBe(collisionElapsedTicks + 10);
  });

  it("scores derived slalom gates without interrupting the descent", () => {
    const pack = selectStorySkiPixlPack(0, "P84");
    const sourceGate = pack.payload.gates?.[0];
    if (!sourceGate) throw new Error("Medium SkiPixl pack has no gate.");
    const passingPayload: SkiPixlPackPayload = Object.freeze({
      ...pack.payload,
      courseLength: 240,
      obstacles: Object.freeze([]),
      gates: Object.freeze([
        Object.freeze({
          ...sourceGate,
          gateId: "passing-gate",
          distance: 24,
          leftX: 280,
          centerX: 320,
          rightX: 360,
        }),
      ]),
    });
    const missingPayload: SkiPixlPackPayload = Object.freeze({
      ...passingPayload,
      gates: Object.freeze([
        Object.freeze({
          ...sourceGate,
          gateId: "missing-gate",
          distance: 24,
          leftX: 100,
          centerX: 120,
          rightX: 140,
        }),
      ]),
    });
    const passing = new SkiPixlSession(context(pack), passingPayload);
    const missing = new SkiPixlSession(context(pack), missingPayload);
    activate(passing);
    activate(missing);
    let passingSnapshot = passing.snapshot();
    let missingSnapshot = missing.snapshot();
    while (passingSnapshot.gatesResolved === 0) {
      passingSnapshot = passing.step({ steer: 0, throttle: 0 });
      missingSnapshot = missing.step({ steer: 0, throttle: 0 });
    }
    expect(passingSnapshot.gateResults).toEqual([
      expect.objectContaining({ gateId: "passing-gate", passed: true }),
    ]);
    expect(passingSnapshot.gatePenaltyTicks).toBe(0);
    expect(missingSnapshot.gateResults).toEqual([
      expect.objectContaining({ gateId: "missing-gate", passed: false }),
    ]);
    expect(missingSnapshot.gatePenaltyTicks).toBe(150);
    expect(
      missingSnapshot.elapsedSeconds - passingSnapshot.elapsedSeconds,
    ).toBe(2.5);
  });

  it("applies at most one knockdown when several hazards share a crossed row", () => {
    const pack = selectStorySkiPixlPack(2);
    const source = pack.payload.obstacles[0]!;
    const collisionPayload: SkiPixlPackPayload = Object.freeze({
      ...pack.payload,
      courseLength: 240,
      obstacles: Object.freeze([
        Object.freeze({
          ...source,
          obstacleId: "collision-row-left",
          distance: 24,
          x: 315,
          rowHazardIndex: 0,
          rowHazardCount: 2,
        }),
        Object.freeze({
          ...source,
          obstacleId: "collision-row-right",
          distance: 24,
          x: 325,
          rowHazardIndex: 1,
          rowHazardCount: 2,
        }),
      ]),
    });
    const session = new SkiPixlSession(context(pack), collisionPayload);
    let snapshot = activate(session);
    while (snapshot.latestCollision === null && snapshot.elapsedTicks < 120) {
      snapshot = session.step({ steer: 0, throttle: 0 });
    }

    expect(snapshot.obstaclesResolved).toBe(2);
    expect(snapshot.collisions).toHaveLength(1);
    expect(snapshot.latestCollision?.obstacleId).toBe("collision-row-left");
  });

  it("treats an exact course-limit descent as failure", () => {
    const pack = selectStorySkiPixlPack(3);
    const boundaryPayload: SkiPixlPackPayload = Object.freeze({
      ...pack.payload,
      // 3,600 fixed steps at 70 units/second accumulate a fractional floating
      // value just below 4,200, so this threshold completes on exactly tick
      // 3,600 without weakening the production comparison.
      courseLength: 4_199.9,
      cruiseSpeed: 70,
      minSpeed: 70,
      maxSpeed: 70,
      winSeconds: 60,
      obstacles: Object.freeze([]),
    });
    const session = new SkiPixlSession(context(pack), boundaryPayload);
    let snapshot = activate(session);
    while (snapshot.phase !== "complete" && snapshot.elapsedTicks <= 3_600) {
      snapshot = session.step({ steer: 0, throttle: 0 });
    }

    expect(snapshot.phase).toBe("complete");
    expect(snapshot.elapsedSeconds).toBe(60);
    expect(snapshot.storyQualified).toBe(false);
  });

  it("uses nested terrain cuts with one 60-second qualification limit", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const cuts = selectArcadeSkiPixlCuts(seed);
      const p90 = new Set(
        cuts.packs.P90.payload.obstacles.map(({ obstacleId }) => obstacleId),
      );
      const p84 = new Set(
        cuts.packs.P84.payload.obstacles.map(({ obstacleId }) => obstacleId),
      );
      const p78 = new Set(
        cuts.packs.P78.payload.obstacles.map(({ obstacleId }) => obstacleId),
      );
      expect(p90.size).toBe(120);
      expect(p84.size).toBe(192);
      expect(p78.size).toBeGreaterThanOrEqual(264);
      expect([...p90].every((id) => p84.has(id))).toBe(true);
      expect([...p84].every((id) => p78.has(id))).toBe(true);
      expect(
        [cuts.packs.P90, cuts.packs.P84, cuts.packs.P78].map(
          (pack) => pack.payload.winSeconds,
        ),
      ).toEqual([60, 60, 60]);
    }
  });

  it("replays a complete descent exactly from its semantic input tape", () => {
    const pack = selectStorySkiPixlPack(7);
    const original = complete(
      pack,
      (state) => autopilotInput(observeSkiPixl(pack.payload, state)),
      4_019,
    );
    const replay = new SkiPixlSession(context(pack, 4_019), pack.payload);
    original.inputs.forEach((input) => replay.step(input));
    expect(replay.snapshot()).toEqual(original.snapshot);
  });
});
