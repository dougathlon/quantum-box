import { describe, expect, it } from "vitest";

import type {
  AgentDecision,
  AgentObservation,
  AgentPolicy,
} from "../../src/agents/contracts";
import { createRunContext, type RunContext } from "../../src/core/run";
import {
  createQongCpuBelief,
  reviseQongCpuBelief,
  type QongCpuAction,
  type QongCpuHypothesis,
} from "../../src/games/qong/QongCpuPolicy";
import {
  QONG_MEASUREMENT_TICKS,
  QongSession,
} from "../../src/games/qong/QongSession";
import {
  QONG_STORY_MIN_DIRECTIONAL_RALLIES,
  qualifiesQongStory,
} from "../../src/games/qong/storyQualification";
import {
  QONG_RULES_VERSION,
  QONG_TOTAL_RALLIES,
  type QongGoalEvent,
  type QongInput,
  type QongPublicState,
  type QongSnapshot,
} from "../../src/games/qong/types";

const NEUTRAL: QongInput = {
  leftAxis: 0,
  rightAxis: 0,
  observePressed: false,
};

function context(seed = 7): RunContext {
  return createRunContext({
    gameId: "qong",
    playMode: "arcade",
    rulesVersion: QONG_RULES_VERSION,
    runSeed: seed,
    pack: {
      packId: "qong-synthetic-control-v1",
      contentSha256: "a".repeat(64),
      schemaVersion: "quantum-box-pack-v1",
      source: "synthetic-control",
    },
  });
}

function storyContext(seed = 7): RunContext {
  return createRunContext({
    gameId: "qong",
    storyStage: "qong",
    playMode: "story",
    rulesVersion: QONG_RULES_VERSION,
    runSeed: seed,
    pack: {
      packId: "qong-story-qpu-v1",
      contentSha256: "b".repeat(64),
      schemaVersion: "quantum-box-pack-v1",
      source: "moth-api-qpu",
    },
    packSelection: {
      schemaVersion: "quantum-box-qong-selection-receipt-v1",
      bankId: "qong-story-bank-v1",
      bankContentSha256: "c".repeat(64),
      selectorPackId: "qong-selector-v1",
      selectorContentSha256: "d".repeat(64),
      selectionMethod: "two-recorded-bits-to-four-pack-index-v1",
      selectorCursorBefore: 0,
      selectorCursorAfter: 2,
      selectorCycle: 0,
      selectorCycleAfter: 0,
      selectorBitIndices: [0, 1],
      selectorBits: [0, 0],
      selectedPackIndex: 0,
      selectedPackId: "qong-story-qpu-v1",
      selectedPackContentSha256: "b".repeat(64),
      reusedSelectorBits: false,
    },
  });
}

function forceFirstGoal(session: QongSession): QongSnapshot {
  let snapshot = session.snapshot();
  for (let tick = 0; tick < 600 && snapshot.phase === "active"; tick += 1) {
    snapshot = session.step({
      leftAxis: -1,
      rightAxis: 1,
      observePressed: false,
    });
  }
  return snapshot;
}

function dodgeInput(snapshot: QongSnapshot): QongInput {
  const away = (ballY: number, paddleY: number): -1 | 1 =>
    ballY < paddleY ? 1 : -1;
  return {
    leftAxis: away(snapshot.ball.y, snapshot.leftPaddleY),
    rightAxis: away(snapshot.ball.y, snapshot.rightPaddleY),
    observePressed: false,
  };
}

describe("Qong unresolved rule state", () => {
  it("resolves an unresolved crossing and its point as one staged event", () => {
    const session = new QongSession(
      context(3),
      { directProbability: 1 },
      "local",
    );
    let snapshot = session.snapshot();
    for (
      let tick = 0;
      tick < 600 && snapshot.measurementState !== "measuring";
      tick += 1
    ) {
      snapshot = session.step({
        leftAxis: -1,
        rightAxis: 1,
        observePressed: false,
      });
    }

    expect(snapshot.measurementState).toBe("measuring");
    expect(snapshot.goalRule).toBe("unresolved");
    expect(snapshot.leftScore + snapshot.rightScore).toBe(0);
    expect(snapshot.rallyReveal).toBeNull();

    for (let tick = 0; tick < QONG_MEASUREMENT_TICKS; tick += 1) {
      snapshot = session.step(NEUTRAL);
    }

    expect(snapshot.measurementState).toBe("resolved");
    expect(snapshot.goalRule).toBe("opposite");
    expect(snapshot.leftScore + snapshot.rightScore).toBe(1);
    expect(snapshot.rallyReveal).not.toBeNull();
  });

  it("awards the opposite side under Direct", () => {
    const result = forceFirstGoal(
      new QongSession(context(), { directProbability: 1 }, "local"),
    );

    expect(result.rallyReveal).toEqual({
      polarity: "direct",
      goalSide: "left",
      pointWinner: "right",
    });
  });

  it("awards the goal owner under Invert", () => {
    const result = forceFirstGoal(
      new QongSession(context(), { directProbability: 0 }, "local"),
    );

    expect(result.rallyReveal).toEqual({
      polarity: "invert",
      goalSide: "left",
      pointWinner: "left",
    });
  });

  it("runs exactly seven rallies and cannot tie", () => {
    const session = new QongSession(
      context(18),
      { directProbability: 0.5 },
      "local",
    );
    let snapshot = session.snapshot();
    for (
      let tick = 0;
      tick < 12_000 && snapshot.phase !== "complete";
      tick += 1
    ) {
      snapshot = session.step(dodgeInput(snapshot));
    }

    expect(snapshot.phase).toBe("complete");
    expect(snapshot.rallyNumber).toBe(QONG_TOTAL_RALLIES);
    expect(snapshot.leftScore + snapshot.rightScore).toBe(QONG_TOTAL_RALLIES);
    expect(snapshot.leftScore).not.toBe(snapshot.rightScore);
    expect(snapshot.winner).not.toBeNull();
  });

  it("uses an acquired ordered seven-rally sequence without consuming it by completion order", () => {
    const direct = forceFirstGoal(
      new QongSession(
        context(55),
        {
          directProbability: 0,
          rallyPolarities: [
            "direct",
            "invert",
            "direct",
            "invert",
            "direct",
            "invert",
            "direct",
          ],
        },
        "local",
      ),
    );

    expect(direct.rallyReveal?.polarity).toBe("direct");
  });

  it("rejects incomplete acquired rally sequences", () => {
    expect(
      () =>
        new QongSession(
          context(56),
          {
            directProbability: 0.5,
            rallyPolarities: ["direct"],
          },
          "local",
        ),
    ).toThrow(/exactly seven/);
  });

  it("fails closed unless a Story pack begins with an acquired invert polarity", () => {
    expect(
      () =>
        new QongSession(
          storyContext(56),
          {
            directProbability: 1,
            rallyPolarities: Array.from(
              { length: QONG_TOTAL_RALLIES },
              () => "direct" as const,
            ),
          },
          "cpu",
        ),
    ).toThrow(/first polarity is invert/);
  });

  it("begins each Story round unresolved and accepts one of three observations", () => {
    const session = new QongSession(
      storyContext(57),
      {
        directProbability: 0,
        rallyPolarities: Array.from(
          { length: QONG_TOTAL_RALLIES },
          () => "invert" as const,
        ),
      },
      "cpu",
    );

    expect(session.snapshot().measurementState).toBe("unresolved");
    let snapshot = forceFirstGoal(session);
    expect(snapshot.rallyReveal?.polarity).toBe("invert");
    while (snapshot.phase === "between-rallies")
      snapshot = session.step(NEUTRAL);
    expect(snapshot.rallyNumber).toBe(2);
    expect(snapshot.measurementState).toBe("unresolved");
    expect(snapshot.goalRule).toBe("unresolved");

    snapshot = session.step({ ...NEUTRAL, observePressed: true });
    expect(snapshot.measurementState).toBe("measuring");
    expect(snapshot.goalRule).toBe("unresolved");
    expect(snapshot.observationsRemaining).toBe(2);
    for (let tick = 0; tick < QONG_MEASUREMENT_TICKS; tick += 1) {
      snapshot = session.step(NEUTRAL);
    }
    expect(snapshot.measurementState).toBe("resolved");
    expect(snapshot.goalRule).toBe("own");
  });

  it("spends at most one observation on an unresolved round", () => {
    const session = new QongSession(
      context(44),
      { directProbability: 0.5 },
      "local",
    );

    expect(
      session.step({ ...NEUTRAL, observePressed: true }).observationsRemaining,
    ).toBe(2);
    expect(
      session.step({ ...NEUTRAL, observePressed: true }).observationsRemaining,
    ).toBe(2);
    expect(session.snapshot().measurementState).toBe("measuring");
  });

  it("replays identically from fixture hash, seed, rules, and semantic inputs", () => {
    const first = new QongSession(
      context(1234),
      { directProbability: 0.5 },
      "local",
    );
    const second = new QongSession(
      context(1234),
      { directProbability: 0.5 },
      "local",
    );

    for (let tick = 0; tick < 500; tick += 1) {
      const input: QongInput = {
        leftAxis: tick % 50 < 20 ? -1 : 1,
        rightAxis: tick % 70 < 35 ? 1 : -1,
        observePressed: tick === 30 || tick === 220,
      };
      expect(first.step(input)).toEqual(second.step(input));
    }
  });

  it("reproduces the complete seven-rally trace from its semantic input tape", () => {
    const original = new QongSession(
      context(8_041),
      { directProbability: 0.5 },
      "local",
    );
    const inputs: QongInput[] = [];
    const trace: QongSnapshot[] = [];
    let snapshot = original.snapshot();
    for (
      let tick = 0;
      tick < 12_000 && snapshot.phase !== "complete";
      tick += 1
    ) {
      const input = dodgeInput(snapshot);
      inputs.push(input);
      snapshot = original.step(input);
      trace.push(snapshot);
    }
    expect(snapshot.phase).toBe("complete");

    const replay = new QongSession(
      context(8_041),
      { directProbability: 0.5 },
      "local",
    );
    inputs.forEach((input, index) => {
      expect(replay.step(input)).toEqual(trace[index]);
    });
    expect(replay.snapshot()).toEqual(snapshot);
  });
});

describe("Qong Story qualification", () => {
  function completionEvidence(
    humanObservationsUsed: number,
    directionalRallyNumbers: readonly number[],
    winner: "left" | "right" = "left",
  ): QongSnapshot {
    return {
      winner,
      storyEvidence: { humanObservationsUsed, directionalRallyNumbers },
    } as unknown as QongSnapshot;
  }

  it("rejects a passive or observation-only winning trace", () => {
    expect(
      qualifiesQongStory(
        completionEvidence(0, []),
        Array.from({ length: 300 }, () => NEUTRAL),
      ),
    ).toBe(false);
    expect(
      qualifiesQongStory(
        completionEvidence(1, []),
        Array.from({ length: 300 }, (_, index) => ({
          ...NEUTRAL,
          observePressed: index === 1,
        })),
      ),
    ).toBe(false);
  });

  it("rejects blind alternating movement without an accepted observation", () => {
    const blindMovement = Array.from(
      { length: 600 },
      (_, index): QongInput => ({
        leftAxis: index % 2 === 0 ? -1 : 1,
        rightAxis: 0,
        observePressed: false,
      }),
    );
    expect(
      qualifiesQongStory(completionEvidence(0, [1, 2, 3]), blindMovement),
    ).toBe(false);
  });

  it("requires directional engagement across distinct rallies", () => {
    expect(
      qualifiesQongStory(completionEvidence(1, [2]), [
        { ...NEUTRAL, leftAxis: -1, observePressed: true },
      ]),
    ).toBe(false);
  });

  it("accepts a human victory with an observation and engagement in three rounds", () => {
    const engagedRallies = Array.from(
      { length: QONG_STORY_MIN_DIRECTIONAL_RALLIES },
      (_, index) => index * 2 + 1,
    );
    expect(qualifiesQongStory(completionEvidence(1, engagedRallies), [])).toBe(
      true,
    );
    expect(
      qualifiesQongStory(completionEvidence(1, engagedRallies, "right"), []),
    ).toBe(false);
  });

  it("records accepted observations and distinct engaged rounds as immutable public evidence", () => {
    const session = new QongSession(
      context(19),
      { directProbability: 0.5 },
      "cpu",
    );
    let snapshot = session.step({
      leftAxis: -1,
      rightAxis: 0,
      observePressed: true,
    });
    snapshot = session.step({
      leftAxis: 1,
      rightAxis: 0,
      observePressed: true,
    });

    expect(snapshot.storyEvidence).toEqual({
      humanObservationsUsed: 1,
      directionalRallyNumbers: [1],
    });
    expect(Object.isFrozen(snapshot.storyEvidence)).toBe(true);
    expect(
      Object.isFrozen(snapshot.storyEvidence.directionalRallyNumbers),
    ).toBe(true);
  });

  it("never admits a passive trace across one hundred Story seeds", () => {
    let admitted = 0;
    for (let seed = 0; seed < 100; seed += 1) {
      const session = new QongSession(
        context(seed),
        { directProbability: 0.5 },
        "cpu",
      );
      const recording: QongInput[] = [];
      let snapshot = session.snapshot();
      for (
        let tick = 0;
        tick < 12_000 && snapshot.phase !== "complete";
        tick += 1
      ) {
        recording.push(NEUTRAL);
        snapshot = session.step(NEUTRAL);
      }
      if (qualifiesQongStory(snapshot, recording)) admitted += 1;
    }
    expect(admitted).toBe(0);
  });
});

describe("Qong CPU information boundary", () => {
  it("exposes only the CPU's own evidence and last rationale to the development audit", () => {
    const session = new QongSession(
      context(15),
      { directProbability: 0.5 },
      "cpu",
    );
    session.step({ leftAxis: 0, rightAxis: 0, observePressed: false });

    const audit = session.developerAudit();
    expect(audit.belief.hypotheses).toEqual({
      directEvidence: 1,
      invertEvidence: 1,
      repeatEvidence: 1,
      flipEvidence: 1,
      lastObservedPolarity: null,
    });
    expect(audit.lastDecision?.rationaleCode).toMatch(/^qong-public-/);
    expect(audit).not.toHaveProperty("currentPolarity");
    expect(audit).not.toHaveProperty("ruleRandom");
    expect(Object.isFrozen(audit)).toBe(true);
  });

  it("passes no selected polarity to the CPU policy", () => {
    let captured: AgentObservation<QongPublicState, QongGoalEvent> | null =
      null;
    const policy: AgentPolicy<
      QongPublicState,
      QongGoalEvent,
      QongCpuHypothesis,
      QongCpuAction
    > = {
      decide(
        observation,
        belief,
      ): AgentDecision<QongCpuAction, QongCpuHypothesis> {
        captured = observation;
        return {
          action: { axis: 0, strategy: "defend" },
          nextBelief: belief,
          rationaleCode: "test-public-only",
        };
      },
    };
    const session = new QongSession(
      context(),
      { directProbability: 0 },
      "cpu",
      policy,
    );

    session.step(NEUTRAL);

    expect(captured).not.toBeNull();
    expect(JSON.stringify(captured)).not.toContain("polarity");
    expect(JSON.stringify(captured)).not.toContain("directProbability");
  });

  it("revises its distribution belief only from the public goal and award", () => {
    const initial = createQongCpuBelief();
    const direct = reviseQongCpuBelief(initial, {
      kind: "goal",
      rallyNumber: 1,
      goalSide: "left",
      pointWinner: "right",
    });
    const invert = reviseQongCpuBelief(direct, {
      kind: "goal",
      rallyNumber: 2,
      goalSide: "right",
      pointWinner: "right",
    });

    expect(direct.hypotheses).toEqual({
      directEvidence: 2,
      invertEvidence: 1,
      repeatEvidence: 1,
      flipEvidence: 1,
      lastObservedPolarity: "direct",
    });
    expect(invert.hypotheses).toEqual({
      directEvidence: 2,
      invertEvidence: 2,
      repeatEvidence: 1,
      flipEvidence: 2,
      lastObservedPolarity: "invert",
    });
    expect(invert.revision).toBe(2);
  });

  it("has no private observation request or hidden-rule reveal channel", () => {
    const publicOnly: AgentPolicy<
      QongPublicState,
      QongGoalEvent,
      QongCpuHypothesis,
      QongCpuAction
    > = {
      decide(_observation, belief) {
        return {
          action: { axis: 0, strategy: "defend" },
          nextBelief: belief,
          rationaleCode: "test-public-only",
        };
      },
    };
    const session = new QongSession(
      context(90),
      { directProbability: 0.5 },
      "cpu",
      publicOnly,
    );
    let snapshot = session.snapshot();
    for (
      let tick = 0;
      tick < 12_000 && snapshot.phase !== "complete";
      tick += 1
    ) {
      snapshot = session.step(dodgeInput(snapshot));
    }

    expect(snapshot).not.toHaveProperty("cpuObservationsRemaining");
    expect(session.developerAudit().lastDecision?.action).toEqual({
      axis: 0,
      strategy: "defend",
    });
    expect(session.developerAudit().belief.hypotheses).not.toHaveProperty(
      "observedPolarity",
    );
  });

  it("is fallible but beatable by a simple observation-aware public-state policy", () => {
    let humanWins = 0;
    const attempts = 40;
    for (let seed = 0; seed < attempts; seed += 1) {
      const session = new QongSession(
        context(seed),
        { directProbability: 0.5 },
        "cpu",
      );
      let snapshot = session.snapshot();
      let observedRally = 0;
      let observationRequested = false;
      let strategy: "defend" | "concede" = "defend";
      for (
        let tick = 0;
        tick < 12_000 && snapshot.phase !== "complete";
        tick += 1
      ) {
        if (snapshot.rallyNumber !== observedRally) {
          observedRally = snapshot.rallyNumber;
          observationRequested = false;
          strategy = snapshot.rallyNumber % 2 === 1 ? "defend" : "concede";
        }
        const shouldObserve =
          snapshot.phase === "active" &&
          snapshot.observationsRemaining > 0 &&
          snapshot.measurementState === "unresolved" &&
          !observationRequested;
        if (shouldObserve) observationRequested = true;
        if (snapshot.measurementState === "resolved")
          strategy = snapshot.goalRule === "opposite" ? "defend" : "concede";
        const error = snapshot.ball.y - snapshot.leftPaddleY;
        const defendAxis: -1 | 0 | 1 =
          Math.abs(error) < 7 ? 0 : error < 0 ? -1 : 1;
        const concedeAxis: -1 | 1 =
          snapshot.ball.y < snapshot.leftPaddleY ? 1 : -1;
        snapshot = session.step({
          leftAxis: strategy === "defend" ? defendAxis : concedeAxis,
          rightAxis: 0,
          observePressed: shouldObserve,
        });
      }
      if (snapshot.winner === "left") humanWins += 1;
    }

    expect(humanWins).toBeGreaterThanOrEqual(10);
    expect(humanWins).toBeLessThanOrEqual(30);
  });
});
