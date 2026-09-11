import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  QUANTMAN_SYNTHETIC_FIXTURE,
  QUANTMAN_SYNTHETIC_FIXTURE_BYTES_SHA256,
  QUANTMAN_SYNTHETIC_FIXTURE_CONTENT_SHA256,
  QUANTMAN_SYNTHETIC_FIXTURE_IDENTITY,
  QUANTMAN_SYNTHETIC_NO_INPUT,
  QUANTMAN_SYNTHETIC_RULES_VERSION,
  QuantmanSyntheticRuntime,
  QuantmanSyntheticSession,
  runQuantmanSyntheticReplay,
  type QuantmanSyntheticInput,
  type QuantmanSyntheticMechanic,
} from "../../src/games/quantmanSynthetic";
import { TUNING } from "../../src/games/quantmanSynthetic/config";
import { directionBetween } from "../../src/games/quantmanSynthetic/game/GhostPolicy";
import { TopologyBank } from "../../src/games/quantmanSynthetic/labyrinth/TopologyBank";

describe("Quantman synthetic fixture boundary", () => {
  it("pins the exact local synthetic control without a Moth or QPU claim", async () => {
    const bytes = await readFile(
      new URL(
        "../../src/games/quantmanSynthetic/data/quantman-labyrinth-synthetic-10x10-v1.json",
        import.meta.url,
      ),
    );
    const bank = new TopologyBank(
      new QuantmanSyntheticSession(QUANTMAN_SYNTHETIC_FIXTURE, 1).graph,
      QUANTMAN_SYNTHETIC_FIXTURE,
    );

    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      QUANTMAN_SYNTHETIC_FIXTURE_BYTES_SHA256,
    );
    expect(QUANTMAN_SYNTHETIC_FIXTURE).toMatchObject({
      fixtureId: "quantman-labyrinth-synthetic-10x10-v1",
      width: 10,
      height: 10,
      contentSha256: QUANTMAN_SYNTHETIC_FIXTURE_CONTENT_SHA256,
      provenance: {
        sourceType: "synthetic",
        label: "SYNTHETIC 10×10 LABYRINTH CONTROL — NO QPU DATA",
      },
    });
    expect(QUANTMAN_SYNTHETIC_FIXTURE.records).toHaveLength(512);
    expect(bank.topologies).toHaveLength(256);
    expect(bank.effectiveShots).toBe(5636);
    expect(QUANTMAN_SYNTHETIC_FIXTURE_IDENTITY).toMatchObject({
      classification: "local-synthetic-control",
      provider: null,
      backend: null,
      jobId: null,
      qpu: false,
      sourceCommit: "d4dd14befae9e1f4c4a1dbac159c8391a94ae435",
    });
  });
});

describe.each(["stabilize-gaze", "inverse-gaze"] as const)(
  "Quantman %s session",
  (mechanic) => {
    it("requires the complete playable screen to clear and emits exact score evidence", () => {
      const startRoom = 95;
      const allExceptStartAndOne = Array.from(
        { length: 100 },
        (_, room) => room,
      ).filter((room) => room !== startRoom && room !== 94);
      const incomplete = new QuantmanSyntheticSession(
        QUANTMAN_SYNTHETIC_FIXTURE,
        31,
        {
          mechanic,
          ghostsEnabled: false,
          playerStartRoom: startRoom,
          initialCollectedRooms: allExceptStartAndOne,
        },
      ).step({ direction: null, start: true });

      expect(incomplete.phase).toBe("active");
      expect(incomplete.remainingCollectibles).toBe(1);
      expect(incomplete.completion).toBeNull();

      const allExceptStart = Array.from(
        { length: 100 },
        (_, room) => room,
      ).filter((room) => room !== startRoom);
      const cleared = new QuantmanSyntheticSession(
        QUANTMAN_SYNTHETIC_FIXTURE,
        31,
        {
          mechanic,
          ghostsEnabled: false,
          playerStartRoom: startRoom,
          initialCollectedRooms: allExceptStart,
        },
      ).step({ direction: null, start: true });

      expect(cleared.phase).toBe("won");
      expect(cleared.lives).toBe(4);
      expect(cleared.remainingCollectibles).toBe(0);
      expect(cleared.score).toBe(10 + 1_000 + 3 * 500);
      expect(cleared.completion).toEqual({
        outcome: "LEVEL_CLEARED",
        runSeed: 31,
        score: 2_510,
        remainingLives: 4,
        simulationTicks: 1,
        fixtureId: QUANTMAN_SYNTHETIC_FIXTURE.fixtureId,
        fixtureSha256: QUANTMAN_SYNTHETIC_FIXTURE_CONTENT_SHA256,
        mechanic,
      });
    });

    it("replays semantic input into an identical renderer-neutral snapshot", () => {
      const runtime = new QuantmanSyntheticRuntime({
        playMode: "arcade",
        runSeed: 37,
        mechanic,
      });
      for (let tick = 0; tick < 480; tick += 1) {
        runtime.step(patternInput(tick));
      }

      const tape = runtime.replayTape();
      expect(tape).toMatchObject({
        rulesVersion: QUANTMAN_SYNTHETIC_RULES_VERSION,
        playMode: "arcade",
        runSeed: 37,
        mechanic,
        fixtureId: QUANTMAN_SYNTHETIC_FIXTURE.fixtureId,
      });
      expect(runQuantmanSyntheticReplay(tape)).toEqual(runtime.snapshot());
    });
  },
);

describe("Quantman synthetic mechanics", () => {
  it("stabilizes the directional observation on each 200 ms boundary", () => {
    const session = new QuantmanSyntheticSession(
      QUANTMAN_SYNTHETIC_FIXTURE,
      11,
      { mechanic: "stabilize-gaze", ghostsEnabled: false },
    );
    session.step({ direction: null, start: true });
    for (let tick = 1; tick < TUNING.topologyPeriodTicks; tick += 1) {
      session.step(QUANTMAN_SYNTHETIC_NO_INPUT);
    }

    const transition = session.topologyTransitions()[0];
    expect(transition).toBeDefined();
    expect(transition).toMatchObject({
      activeTick: TUNING.topologyPeriodTicks,
      mechanic: "stabilize-gaze",
      targetEdgeIndex: null,
    });
    expect(transition!.observedEdgeIndices.length).toBeGreaterThan(0);
    expect(
      transition!.observedEdgeIndices.every(
        (edge) => !transition!.changedEdgeIndices.includes(edge),
      ),
    ).toBe(true);
  });

  it("inverse gaze flips the focused parity through another complete topology", () => {
    const probe = new QuantmanSyntheticSession(QUANTMAN_SYNTHETIC_FIXTURE, 6, {
      mechanic: "inverse-gaze",
      ghostsEnabled: false,
      initialTopologyIndex: 0,
    });
    const initial = probe.bank.topologies[0]!;
    const wall = probe.graph.edges.find((edge) =>
      probe.graph.isWall(initial.wallMask, edge.index),
    )!;
    const direction = directionBetween(probe.graph, wall.a, wall.b)!;
    const session = new QuantmanSyntheticSession(
      QUANTMAN_SYNTHETIC_FIXTURE,
      6,
      {
        mechanic: "inverse-gaze",
        ghostsEnabled: false,
        initialTopologyIndex: 0,
        playerStartRoom: wall.a,
      },
    );
    for (let tick = 0; tick < TUNING.topologyPeriodTicks; tick += 1) {
      session.step({ direction, start: true });
    }

    const snapshot = session.snapshot();
    const transition = session.topologyTransitions()[0];
    expect(transition).toMatchObject({
      mechanic: "inverse-gaze",
      targetEdgeIndex: wall.index,
      targetFromWall: true,
      targetToWall: false,
    });
    expect(snapshot.topologyWallMask[wall.index]).toBe("0");
    expect(snapshot.interventionCount).toBe(1);
    expect(
      session.bank.topologies.some(
        (topology) => topology.wallMask === snapshot.topologyWallMask,
      ),
    ).toBe(true);
  });

  it("exposes terminal loss without persistence or renderer state", () => {
    const session = new QuantmanSyntheticSession(
      QUANTMAN_SYNTHETIC_FIXTURE,
      29,
      {
        mechanic: "stabilize-gaze",
        playerStartRoom: 44,
        ghostStartRooms: [44, 9, 90, 99],
        ghostReleaseTicks: [0, 60, 120, 180],
        initialTopologyIndex: 0,
        startingLives: 1,
      },
    );

    const lost = session.step({ direction: null, start: true });
    expect(lost).toMatchObject({
      phase: "lost",
      lives: 0,
      score: 0,
      activeTick: 1,
      completion: null,
    });
    expect(lost).not.toHaveProperty("highScore");
    expect(lost).not.toHaveProperty("renderer");
  });

  it("rejects a replay whose fixture identity was altered", () => {
    const runtime = new QuantmanSyntheticRuntime({
      playMode: "story",
      runSeed: 71,
      mechanic: "stabilize-gaze",
    });
    runtime.step({ direction: null, start: true });
    const altered = {
      ...runtime.replayTape(),
      fixtureContentSha256: "f".repeat(64),
    } as ReturnType<QuantmanSyntheticRuntime["replayTape"]>;

    expect(() => runQuantmanSyntheticReplay(altered)).toThrow(
      "replay identity does not match",
    );
  });
});

function patternInput(tick: number): QuantmanSyntheticInput {
  if (tick === 0) return Object.freeze({ direction: null, start: true });
  const directions = ["right", "down", "left", "up"] as const;
  return Object.freeze({
    direction: directions[Math.floor(tick / 90) % directions.length] ?? null,
    start: false,
  });
}

void ("stabilize-gaze" satisfies QuantmanSyntheticMechanic);
