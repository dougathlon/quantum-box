import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createRunContext } from "../../src/core/run";
import {
  CAPABLE_PUBLIC_POLICY_TUNING,
  FluxballCpuPolicy,
} from "../../src/games/fluxball/FluxballCpuPolicy";
import {
  assessFluxballStorySeed,
  FLUXBALL_STORY_CERTIFIED_SEEDS,
  isCertifiedFluxballStorySeed,
  selectFluxballStorySeed,
} from "../../src/games/fluxball/FluxballStorySeed";
import {
  FluxballSession,
  createPublicSportSnapshot,
} from "../../src/games/fluxball/FluxballSession";
import {
  FLUXBALL_FOUR_CONTROL_PACK,
  FLUXBALL_PLAYABLE_RULE_BANK,
  FLUXBALL_TWO_CONTROL_PACK,
} from "../../src/games/fluxball/fluxballControlPacks";
import {
  buildFluxballRuleSchedule,
  sampleFluxballRules,
  validateRuleBank,
} from "../../src/games/fluxball/FluxballRuleBank";
import { interpretRoundRules } from "../../src/games/fluxball/standalone/rules/interpretRoundRules";
import { sampleRoundRules } from "../../src/games/fluxball/standalone/rules/sampleRoundRules";
import { FLUXBALL_FIXTURE_CATALOG } from "../../src/games/fluxball/fluxballControlPacks";
import { SportSimulation } from "../../src/games/fluxball/standalone/simulation";
import type { InterpretedRoundRules } from "../../src/games/fluxball/standalone/rules/types";
import { TUNING } from "../../src/games/fluxball/standalone/config/tuning";
import type { FluxballPublicSportSnapshot } from "../../src/games/fluxball/types";
import {
  FLUXBALL_LEGACY_RULES_VERSION,
  FLUXBALL_RULES_VERSION,
} from "../../src/games/fluxball/types";
import { FLUXBALL_V2_BALL } from "../../src/display/PixelSprites";
import type { PlayerId } from "../../src/games/fluxball/standalone/modes";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE = fileURLToPath(
  new URL("../../../fluxball-browser", import.meta.url),
);

describe("Fluxball source preservation", () => {
  it("binds the playable pack to the complete generated QPU bank bytes", () => {
    expect(
      sha256(
        `${ROOT}/src/games/fluxball/data/fluxball-qgraph-rule-bank-v1.json`,
      ),
    ).toBe(FLUXBALL_PLAYABLE_RULE_BANK.contentSha256);
  });

  it("keeps both committed local-Aer fixture files byte-identical", () => {
    expect(
      sha256(`${ROOT}/src/games/fluxball/standalone/data/fluxball-aer-v1.json`),
    ).toBe("af91a70fc633ef4808e658268309ad67d7b808b1d10d77e5e36fcf35090feedb");
    expect(
      sha256(
        `${ROOT}/src/games/fluxball/standalone/data/fluxball-aer-four-qubit-hybrid-v1.json`,
      ),
    ).toBe("ba9afa9d257d9a2f6e11d1b23cb3a21bf1a10f87e2c9ea6d54cde92873fe0db3");
    if (existsSync(SOURCE)) {
      expect(
        readFileSync(
          `${ROOT}/src/games/fluxball/standalone/data/fluxball-aer-v1.json`,
        ),
      ).toEqual(readFileSync(`${SOURCE}/fixtures/fluxball-aer-v1.json`));
      expect(
        readFileSync(
          `${ROOT}/src/games/fluxball/standalone/data/fluxball-aer-four-qubit-hybrid-v1.json`,
        ),
      ).toEqual(
        readFileSync(
          `${SOURCE}/fixtures/fluxball-aer-four-qubit-hybrid-v1.json`,
        ),
      );
    }
  });

  it("retains the exact four-player Moth QGraph result bytes", () => {
    expect(
      sha256(
        `${ROOT}/compiler/quantum_box_moth/evidence/fluxball-graph-v1-qpu-ea99a27a-result.json`,
      ),
    ).toBe("6fbf3208175e6ded7248e633caa881420896c66a4abd7293161c0c6176098baa");
  });

  it("keeps the rule sampler, interpreter, scoring, and RNG source byte-identical", () => {
    const expectedHashes = {
      "rules/rng.ts":
        "ea76f96ebda1cceda4a6b58b9685c4a4d63d3a1dc586f1b1be3155cb5b9205f2",
      "rules/sampleRoundRules.ts":
        "46953ba95881eec485c88360edab42d1b591a155881ff6014be55dae66574cbe",
      "rules/interpretRoundRules.ts":
        "1db0210daad7f172e719ce7d7fb9089846f32d2e19ffb398540318a3ad5fe1d5",
      "simulation/scoring.ts":
        "d612a500d765ebf2a387c3faead54a5f0485848adfd049b178e47446b55e8837",
      "fixtures/FixtureCatalog.ts":
        "08da0aa2f4796fde8e6052c59b29a3d0bf17ce70607eb747b4c7a44f5208b821",
      "fixtures/FixtureResolver.ts":
        "d2565dd63ba4f9186e3de71251e31ff0221a7ce1ebd6ee55025aeccbdf9f2f14",
    } as const;
    for (const [relative, expectedHash] of Object.entries(expectedHashes)) {
      const localPath = `${ROOT}/src/games/fluxball/standalone/${relative}`;
      expect(sha256(localPath)).toBe(expectedHash);
      if (!existsSync(SOURCE)) continue;
      expect(readFileSync(localPath)).toEqual(
        readFileSync(`${SOURCE}/src/${relative}`),
      );
    }
  });
});

describe("Quantum Box Fluxball round contract", () => {
  it("takes three deterministic draws from the eligible QPU distribution and hides authority until reveal", () => {
    const session = twoPlayerSession();
    const active = session.snapshot();
    expect(active.phase).toBe("active");
    expect(active.reveal).toBeNull();
    expect(active.sport?.roundTicks).toBe(800);
    expect(JSON.stringify(active.sport)).not.toMatch(
      /fixture|distribution|outcome|DIRECT|INVERTED|CARRY|STRIKE|OPPOSITE|OWN/,
    );

    const revealed = advanceToReveal(session);
    expect(revealed.phase).toBe("reveal");
    expect(revealed.reveal?.trace.samplingMethod).toBe(
      "three-weighted-draws-from-one-joint-distribution",
    );
    expect(revealed.reveal?.trace.acquisitionSource).toBe("moth-qgraph-qpu");
    expect(revealed.reveal?.trace.sourceMeasurementBasis).toBe("computational");
    expect(revealed.reveal?.trace.providerProvenance).toMatchObject({
      backendName: "ibm_fez",
      activePlayNetwork: false,
    });
    expect(revealed.reveal?.trace.providerProvenance?.mothJobId).toBeTruthy();
    expect(revealed.reveal?.trace.providerProvenance?.ibmJobId).toBeTruthy();
    expect(revealed.reveal?.epochs).toHaveLength(1);
    expect(
      Object.values(revealed.reveal?.trace.axes ?? {}).map(
        (axis) => axis.drawIndex,
      ),
    ).toEqual([0, 1, 2]);
  });

  it("freezes deterministic two- and three-state schedules from paired acquisition buckets", () => {
    const oneHuman = buildFluxballRuleSchedule({
      catalog: FLUXBALL_FIXTURE_CATALOG,
      competitorCount: 2,
      runSeed: 31,
      gameplayRoundNumber: 2,
      stateCount: 2,
    });
    const twoHumans = buildFluxballRuleSchedule({
      catalog: FLUXBALL_FIXTURE_CATALOG,
      competitorCount: 4,
      runSeed: 31,
      gameplayRoundNumber: 2,
      stateCount: 3,
    });
    expect(oneHuman.map((state) => state.sourceRoundBuckets)).toEqual([
      [3, 4],
      [3, 4],
    ]);
    expect(twoHumans.map((state) => state.sourceRoundBuckets)).toEqual([
      [3, 4],
      [3, 4],
      [3, 4],
    ]);
    expect(new Set(twoHumans.map((state) => state.trace.fixtureId)).size).toBe(
      3,
    );
    expect(
      buildFluxballRuleSchedule({
        catalog: FLUXBALL_FIXTURE_CATALOG,
        competitorCount: 4,
        runSeed: 31,
        gameplayRoundNumber: 2,
        stateCount: 3,
      }),
    ).toEqual(twoHumans);
    expect(
      twoHumans.every(
        (state) => state.trace.providerProvenance?.activePlayNetwork === false,
      ),
    ).toBe(true);
  });

  it("uses captured QPU distributions across all eight acquisition buckets", () => {
    for (const competitorCount of [2, 4] as const) {
      for (let roundNumber = 1; roundNumber <= 8; roundNumber += 1) {
        const trace = sampleFluxballRules({
          catalog: FLUXBALL_FIXTURE_CATALOG,
          competitorCount,
          runSeed: 0,
          roundNumber,
        });
        expect(trace.acquisitionSource).toBe("moth-qgraph-qpu");
        expect(trace.sourceResolution?.fallbackReasons).toEqual([]);
        expect(trace.providerProvenance?.activePlayNetwork).toBe(false);
      }
    }
  });

  it("uses the committed four-qubit IBM Fez result for four-player round one", () => {
    const roundOne = sampleFluxballRules({
      catalog: FLUXBALL_FIXTURE_CATALOG,
      competitorCount: 4,
      runSeed: 0,
      roundNumber: 1,
    });
    const roundTwo = sampleFluxballRules({
      catalog: FLUXBALL_FIXTURE_CATALOG,
      competitorCount: 4,
      runSeed: 0,
      roundNumber: 2,
    });
    expect(roundOne.acquisitionSource).toBe("moth-qgraph-qpu");
    expect(roundOne.fixtureId).toBe(
      "graph-v1-ibm-fez-4p-ab-cd-equal-equal-r1-ea99a27a",
    );
    expect(roundOne.shotsPerCircuit).toBe(4096);
    expect(roundOne.providerProvenance).toMatchObject({
      backendName: "ibm_fez",
      mothJobId: "ea99a27a-3d00-4b66-b335-ce2f97293478",
      ibmJobId: "dabp67p6e67c73a1n73g",
      captureMethod: "committed-api-result",
      rawResultSha256:
        "d900d6c1f71b89b997d05dcf73f1633865f015dc008aca12057a43e2d445f96b",
      playerOrder: ["A", "B", "C", "D"],
      activePlayNetwork: false,
    });
    expect(roundOne.axes.X.distribution.outcomeOrder).toHaveLength(16);
    expect(roundTwo.acquisitionSource).toBe("moth-qgraph-qpu");
  });

  it("rejects credentials from a bank and continues with the local control", () => {
    const trace = sampleFluxballRules({
      catalog: FLUXBALL_FIXTURE_CATALOG,
      competitorCount: 2,
      runSeed: 0,
      roundNumber: 1,
      ruleBank: {
        schemaVersion: "fluxball-qgraph-rule-bank-v1",
        bankId: "unsafe",
        qpu_token: "must-not-be-stored",
        records: [],
      },
    });
    expect(trace.acquisitionSource).toBe("finite-shot-aer");
    expect(trace.sourceResolution?.fallbackReasons.join(" ")).toMatch(
      /must not contain QPU credentials/,
    );
    expect(trace.sourceResolution?.fallbackReasons.join(" ")).not.toContain(
      "must-not-be-stored",
    );
    expect(() =>
      validateRuleBank({
        schemaVersion: "fluxball-qgraph-rule-bank-v1",
        bankId: "unsafe",
        qpu_instance: "must-not-be-stored",
        records: [],
      }),
    ).toThrow(/must not contain QPU credentials/);
  });

  it("keeps a deterministic classical source as the last playable fallback", () => {
    const trace = sampleFluxballRules({
      catalog: {
        sample: () => {
          throw new Error("control unavailable for test");
        },
      } as unknown as typeof FLUXBALL_FIXTURE_CATALOG,
      competitorCount: 4,
      runSeed: 17,
      roundNumber: 3,
      ruleBank: {
        schemaVersion: "fluxball-qgraph-rule-bank-v1",
        bankId: "empty-valid-bank",
        selectionPolicy:
          "qpu-then-moth-emulator-then-local-aer-then-deterministic-classical",
        fallbackPacks: {
          "2": {
            packId: FLUXBALL_TWO_CONTROL_PACK.packId,
            contentSha256: FLUXBALL_TWO_CONTROL_PACK.contentSha256,
          },
          "4": {
            packId: FLUXBALL_FOUR_CONTROL_PACK.packId,
            contentSha256: FLUXBALL_FOUR_CONTROL_PACK.contentSha256,
          },
        },
        records: [],
      },
    });
    expect(trace.acquisitionSource).toBe("deterministic-classical-fallback");
    expect(trace.shotsPerCircuit).toBe(0);
    expect(trace.sourceMeasurementBasis).toBe("classical");
    expect(trace.sourceResolution?.fallbackReasons.join(" ")).toMatch(
      /control unavailable for test/,
    );
    expect(trace.activePlayerIds).toEqual(["A", "B", "C", "D"]);
  });

  it("runs one four-round 2P match at forty seconds per round", () => {
    const session = twoPlayerSession();
    expect(session.snapshot().sport?.roundTicks).toBe(800);
    for (let round = 1; round <= 4; round += 1) {
      const reveal = advanceToReveal(session);
      expect(reveal.roundNumber).toBe(round);
      expect(reveal.phase).toBe("reveal");
      const next = session.continueAfterReveal();
      expect(next.phase).toBe(round === 4 ? "complete" : "active");
    }
  });

  it("runs one four-round 4P match at forty seconds per round", () => {
    const session = fourPlayerSession();
    expect(session.snapshot().sport?.roundTicks).toBe(800);
    for (let round = 1; round <= 4; round += 1) {
      const reveal = advanceToReveal(session);
      expect(reveal.roundNumber).toBe(round);
      expect(reveal.phase).toBe("reveal");
      const next = session.continueAfterReveal();
      expect(next.phase).toBe(round === 4 ? "complete" : "active");
    }
  });

  it("awards one match point for an outright round win and resets goals", () => {
    const session = twoPlayerSession();
    forceSessionScore(session, { A: 5, B: 1 });
    const result = finishCurrentRound(session);
    expect(result.roundGoals).toEqual({ A: 5, B: 1 });
    expect(result.roundWins).toEqual({ A: 1, B: 0 });
    expect(result.reveal).toMatchObject({
      roundWinnerIds: ["A"],
      roundGoals: { A: 5, B: 1 },
      roundWinsBefore: { A: 0, B: 0 },
      roundWinsAfter: { A: 1, B: 0 },
    });
    const next = session.continueAfterReveal();
    expect(next.roundGoals).toEqual({ A: 0, B: 0 });
    expect(next.roundWins).toEqual({ A: 1, B: 0 });
  });

  it("preserves a tied round as a draw without inventing a tie-break", () => {
    const session = twoPlayerSession();
    forceSessionScore(session, { A: 2, B: 2 });
    const result = finishCurrentRound(session);
    expect(result.reveal?.roundWinnerIds).toEqual([]);
    expect(result.roundWins).toEqual({ A: 0, B: 0 });
  });

  it("decides the match by rounds won rather than cumulative goals", () => {
    const session = twoPlayerSession();
    const roundScores = [
      { A: 99, B: 0 },
      { A: 0, B: 1 },
      { A: 0, B: 1 },
      { A: 0, B: 1 },
    ] as const;

    for (const [index, score] of roundScores.entries()) {
      forceSessionScore(session, score);
      const result = finishCurrentRound(session);
      expect(result.phase).toBe("reveal");
      const continued = session.continueAfterReveal();
      expect(continued.phase).toBe(index === 3 ? "complete" : "active");
    }

    expect(session.snapshot()).toMatchObject({
      roundWins: { A: 1, B: 3 },
      winnerIds: ["B"],
    });
  });

  it("preserves a final match tie in round wins", () => {
    const session = twoPlayerSession();
    const roundScores = [
      { A: 2, B: 0 },
      { A: 0, B: 3 },
      { A: 0, B: 0 },
      { A: 4, B: 4 },
    ] as const;

    for (const score of roundScores) {
      forceSessionScore(session, score);
      finishCurrentRound(session);
      session.continueAfterReveal();
    }

    expect(session.snapshot()).toMatchObject({
      phase: "complete",
      roundWins: { A: 1, B: 1 },
      winnerIds: ["A", "B"],
    });
  });

  it("replays the same human tape to the same full trace", () => {
    const first = twoPlayerSession(6);
    const second = twoPlayerSession(6);
    const inputs = Array.from({ length: 800 }, (_, tick) => ({
      players: {
        A: {
          up: tick % 80 < 20,
          down: tick % 80 >= 40 && tick % 80 < 60,
          left: tick % 120 >= 60,
          right: tick % 120 < 60,
        },
      },
      revealRequests:
        tick === 240 ? [{ playerId: "A" as const, capturedAtMs: 12_000 }] : [],
    }));
    for (const input of inputs) {
      first.step(input);
      second.step(input);
    }
    expect(second.snapshot()).toEqual(first.snapshot());
  });

  it("gives the round's one shared rule change to the first ordered human request", () => {
    const session = twoHumanSession("individual", 23);
    const before = session.snapshot();
    const after = session.step({
      players: {},
      revealRequests: [
        { playerId: "B", capturedAtMs: 500 },
        { playerId: "A", capturedAtMs: 500 },
      ],
    });
    expect(before.sport?.ruleStateIndex).toBe(0);
    expect(after.sport?.ruleStateIndex).toBe(1);
    expect(after.publicRuleChangeEvents.map((event) => event.playerId)).toEqual(
      ["A"],
    );
    expect(after.remainingRuleChanges).toBe(0);
    expect(JSON.stringify(after.publicRuleChangeEvents)).not.toMatch(
      /DIRECT|INVERTED|CARRY|STRIKE|OPPOSITE|OWN|stateIndex/,
    );
  });

  it("keeps both outgoing and incoming rules hidden when Global Fluxball changes", () => {
    const session = twoHumanSession("global", 9);
    const after = session.step({
      players: {},
      revealRequests: [{ playerId: "B", capturedAtMs: 12 }],
    });
    expect(after.sport?.ruleStateIndex).toBe(1);
    expect(after.publicRuleChangeEvents).toHaveLength(1);
    expect(after.publicRuleChangeEvents[0]?.playerId).toBe("B");
    expect(after.publicRuleChangeEvents[0]).toEqual({
      eventId: 1,
      roundNumber: 1,
      tick: 0,
      playerId: "B",
    });
    expect(JSON.stringify(after.publicRuleChangeEvents)).not.toMatch(
      /DIRECT|INVERTED|CARRY|STRIKE|OPPOSITE|OWN|rules/i,
    );
    expect(after.remainingRuleChanges).toBe(0);
  });

  it.each([
    [2, "global", ["A"]],
    [2, "individual", ["A", "B"]],
    [4, "global", ["A"]],
    [4, "individual", ["A", "B"]],
    [4, "global", ["A", "B", "C", "D"]],
    [4, "individual", ["A", "B", "C", "D"]],
  ] as const)(
    "supports one shared %iP %s rule change across the active human assignment",
    (competitorCount, ruleMode, humanPlayerIds) => {
      const session = arcadeSession(
        competitorCount,
        ruleMode,
        humanPlayerIds,
        41,
      );
      const requests = humanPlayerIds.map((playerId, index) => ({
        playerId,
        capturedAtMs: 10 + index,
      }));
      const shifted = session.step({ players: {}, revealRequests: requests });
      expect(shifted.sport?.ruleStateIndex).toBe(1);
      expect(
        shifted.publicRuleChangeEvents.map((event) => event.playerId),
      ).toEqual([humanPlayerIds[0]]);
      expect(shifted.remainingRuleChanges).toBe(0);
      const reveal = advanceToReveal(session);
      expect(reveal.reveal?.epochs).toHaveLength(2);
      expect(
        reveal.reveal?.epochs.every(
          (epoch) =>
            epoch.sourceRoundBuckets[0] === 1 &&
            epoch.sourceRoundBuckets[1] === 2,
        ),
      ).toBe(true);
      const nextRound = session.continueAfterReveal();
      expect(nextRound.remainingRuleChanges).toBe(1);
    },
  );

  it("awards every player through the heterogeneous 4P Individual rule split", () => {
    const rules = fourPlayerSplitRules();
    const leftGoal = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B", "C", "D"],
      rules,
    });
    sportInternals(leftGoal).ball = goalEntryBall("A");
    const leftPacket = leftGoal.step();
    expect(leftPacket.snapshot.latestGoal?.awards).toEqual({
      A: true,
      B: true,
      C: false,
      D: false,
    });

    const lowerGoal = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B", "C", "D"],
      rules,
    });
    sportInternals(lowerGoal).ball = goalEntryBall("D");
    const lowerPacket = lowerGoal.step();
    expect(lowerPacket.snapshot.latestGoal?.awards).toEqual({
      A: false,
      B: false,
      C: true,
      D: true,
    });
  });

  it.each(["A", "B", "C", "D"] as const)(
    "lets a four-player CARRY body score through its %s goal",
    (goalId) => {
      const sport = new SportSimulation({
        roundNumber: 1,
        activePlayerIds: ["A", "B", "C", "D"],
        rules: fourPlayerPurposeRules("OWN", "CARRY"),
      });
      const internals = sportInternals(sport);
      const player = internals.players[goalId]!;
      const entry = carriedGoalEntry(goalId);
      player.x = entry.playerX;
      player.y = entry.playerY;
      player.resolvedFacing = { ...entry.facing };
      internals.ball = { ...entry.ball, carrierId: goalId };

      const packet = sport.step();

      expect(packet.snapshot.latestGoal?.physicalGoal).toBe(goalId);
      expect(packet.snapshot.latestGoal?.awards[goalId]).toBe(true);
      expect(packet.snapshot.score[goalId]).toBe(1);
    },
  );

  it.each(["global", "individual"] as const)(
    "lets the active CPU create a physical goal in 2P %s play",
    (ruleMode) => {
      for (let seed = 0; seed < 8; seed += 1) {
        const session = arcadeSession(2, ruleMode, ["A"], seed);
        const reveal = advanceToReveal(session);
        expect(
          reveal.reveal?.goals.length,
          `${ruleMode} seed ${seed}`,
        ).toBeGreaterThan(0);
      }
    },
  );

  it.each(["A", "B", "C", "D"] as const)(
    "lets a diagonally approaching CARRY body score through its %s goal",
    (goalId) => {
      const sport = new SportSimulation({
        roundNumber: 1,
        activePlayerIds: ["A", "B", "C", "D"],
        rules: fourPlayerPurposeRules("OWN", "CARRY"),
      });
      const internals = sportInternals(sport);
      const player = internals.players[goalId]!;
      const entry = carriedGoalEntry(goalId);
      const diagonal = Math.SQRT1_2;
      const facing =
        goalId === "A"
          ? { x: -diagonal, y: diagonal }
          : goalId === "B"
            ? { x: diagonal, y: -diagonal }
            : goalId === "C"
              ? { x: diagonal, y: -diagonal }
              : { x: -diagonal, y: diagonal };
      player.x = entry.playerX;
      player.y = entry.playerY;
      player.resolvedFacing = facing;
      internals.ball = { ...entry.ball, carrierId: goalId };

      const packet = sport.step();

      expect(packet.snapshot.latestGoal?.physicalGoal).toBe(goalId);
      expect(packet.snapshot.latestGoal?.awards[goalId]).toBe(true);
    },
  );

  it("rejects malformed reveal timestamps without spending a token", () => {
    const session = twoPlayerSession(0);
    const snapshot = session.step({
      players: {},
      revealRequests: [{ playerId: "A", capturedAtMs: Number.NaN }],
    });
    expect(snapshot.remainingRuleChanges).toBe(1);
    expect(snapshot.sport?.ruleStateIndex).toBe(0);
    expect(snapshot.publicRuleChangeEvents).toHaveLength(0);
  });

  it("applies a reveal before an imminent goal is awarded", () => {
    const candidate = FLUXBALL_STORY_CERTIFIED_SEEDS[2].find((runSeed) => {
      const states = buildFluxballRuleSchedule({
        catalog: FLUXBALL_FIXTURE_CATALOG,
        competitorCount: 2,
        runSeed,
        gameplayRoundNumber: 1,
        stateCount: 2,
      });
      const first = states[0]
        ? interpretRoundRules(states[0].trace, "individual").players.A
        : null;
      const second = states[1]
        ? interpretRoundRules(states[1].trace, "individual").players.A
        : null;
      return first?.purpose !== second?.purpose;
    });
    expect(candidate).toBeDefined();
    const runSeed = candidate ?? 0;
    const states = buildFluxballRuleSchedule({
      catalog: FLUXBALL_FIXTURE_CATALOG,
      competitorCount: 2,
      runSeed,
      gameplayRoundNumber: 1,
      stateCount: 2,
    });
    const incoming = interpretRoundRules(states[1]!.trace, "individual");
    const session = twoPlayerSession(runSeed);
    forceSessionBall(session, {
      x: 6,
      y: 230,
      vx: -250,
      vy: 0,
      carrierId: null,
    });
    const after = session.step({
      players: {},
      revealRequests: [{ playerId: "A", capturedAtMs: 1 }],
    });
    const playerA = incoming.players.A;
    if (!playerA) throw new Error("Incoming state lost Player A.");
    expect(after.sport?.latestGoal?.ruleStateIndex).toBe(1);
    expect(after.sport?.latestGoal?.awardedPlayerIds.includes("A")).toBe(
      playerA.purpose === "OWN",
    );
  });

  it("rejects reveal requests during goal staging without spending a token", () => {
    const session = twoPlayerSession(0);
    forceSessionBall(session, {
      x: 6,
      y: 230,
      vx: -250,
      vy: 0,
      carrierId: null,
    });
    const goal = session.step({ players: {} });
    expect(goal.sport?.goalFreezeTicksRemaining).toBe(5);
    const staged = session.step({
      players: {},
      revealRequests: [{ playerId: "A", capturedAtMs: 2 }],
    });
    expect(staged.remainingRuleChanges).toBe(1);
    expect(staged.sport?.ruleStateIndex).toBe(0);
    expect(staged.publicRuleChangeEvents).toHaveLength(0);
  });

  it("accounts for every gameplay tick under exactly one immutable epoch", () => {
    const session = twoPlayerSession(0);
    session.step({
      players: {},
      revealRequests: [{ playerId: "A", capturedAtMs: 1 }],
    });
    const revealed = advanceToReveal(session);
    const epochs = revealed.reveal?.epochs ?? [];
    expect(epochs).toHaveLength(2);
    expect(
      epochs.reduce(
        (total, epoch) => total + (epoch.endTickExclusive - epoch.startTick),
        0,
      ),
    ).toBe(revealed.sport?.roundTicks);
    expect(Object.isFrozen(epochs)).toBe(true);
  });
});

describe("Fluxball v2 response and collision feel", () => {
  it("gives visible first-tick response, accelerates, releases, reverses, and normalizes diagonals", () => {
    const rules = directStrikeRules();
    const rightward = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B"],
      rules,
    });
    const startX = rightward.getSnapshot().players.A?.x ?? 0;
    let packet = rightward.step({
      A: { up: false, down: false, left: false, right: true },
    });
    expect(packet.snapshot.players.A?.resolvedMotion.x).toBeCloseTo(60);
    expect(packet.snapshot.players.A?.x).toBeCloseTo(startX + 3);
    packet = rightward.step({
      A: { up: false, down: false, left: false, right: true },
    });
    expect(packet.snapshot.players.A?.resolvedMotion.x).toBeCloseTo(84);
    packet = rightward.step({
      A: { up: false, down: false, left: true, right: false },
    });
    expect(packet.snapshot.players.A?.resolvedMotion.x).toBeCloseTo(36);
    packet = rightward.step({
      A: { up: false, down: false, left: true, right: false },
    });
    expect(packet.snapshot.players.A?.resolvedMotion.x).toBeCloseTo(-12);
    packet = rightward.step({ A: neutralPlayerInput() });
    expect(packet.snapshot.players.A?.resolvedMotion.x).toBeCloseTo(0);

    const diagonal = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B"],
      rules,
    }).step({
      A: { up: true, down: false, left: false, right: true },
    }).snapshot.players.A?.resolvedMotion;
    expect(Math.hypot(diagonal?.x ?? 0, diagonal?.y ?? 0)).toBeCloseTo(60);
  });

  it("removes wall-normal velocity and damps player collision normals", () => {
    const sport = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B"],
      rules: directStrikeRules(),
    });
    const internals = sportInternals(sport);
    internals.players.A!.x = TUNING.courtWidth - TUNING.courtPadding;
    internals.players.A!.resolvedMotion = { x: 100, y: 0 };
    let packet = sport.step({
      A: { up: false, down: false, left: false, right: true },
    });
    expect(packet.snapshot.players.A?.resolvedMotion.x).toBe(0);

    internals.players.A!.x = 390;
    internals.players.B!.x = 410;
    internals.players.A!.y = internals.players.B!.y = 230;
    internals.players.A!.resolvedMotion = { x: 100, y: 0 };
    internals.players.B!.resolvedMotion = { x: -100, y: 0 };
    packet = sport.step({ A: neutralPlayerInput(), B: neutralPlayerInput() });
    const a = packet.snapshot.players.A!;
    const b = packet.snapshot.players.B!;
    expect(b.x - a.x).toBeGreaterThanOrEqual(TUNING.playerRadius * 2 - 0.001);
    expect(a.resolvedMotion.x - b.resolvedMotion.x).toBeLessThan(128);
  });

  it("gives a kicked-out carrier the same contact cooldown as the challenger", () => {
    const sport = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B"],
      rules: carryVersusStrikeRules(),
    });
    const internals = sportInternals(sport);
    internals.players.A!.x = 400;
    internals.players.A!.y = 230;
    internals.players.B!.x = 440;
    internals.players.B!.y = 230;
    internals.players.B!.resolvedFacing = { x: -1, y: 0 };
    internals.players.B!.resolvedMotion = { x: -80, y: 0 };
    internals.ball = { x: 425, y: 230, vx: 0, vy: 0, carrierId: "A" };

    let packet = sport.step();

    expect(packet.snapshot.latestContact).toMatchObject({
      playerId: "B",
      previousCarrierId: "A",
      consequence: "dislodge",
    });
    expect(internals.players.A?.lastContactTick).toBe(1);
    expect(internals.players.B?.lastContactTick).toBe(1);

    packet = sport.step();
    expect(packet.snapshot.latestContact?.playerId).toBe("B");
    expect(packet.snapshot.ball.carrierId).toBeNull();
  });

  it("sweeps fast ball contacts and goals, then performs one five-tick staged reset", () => {
    const sport = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B"],
      rules: directStrikeRules(),
    });
    const internals = sportInternals(sport);
    internals.players.A!.x = 200;
    internals.players.A!.y = 230;
    internals.ball = { x: 170, y: 230, vx: 1_000, vy: 0, carrierId: null };
    let packet = sport.step({ A: neutralPlayerInput() });
    expect(packet.snapshot.latestContact?.playerId).toBe("A");

    internals.ball = { x: 20, y: 230, vx: -1_000, vy: 0, carrierId: null };
    packet = sport.step({ A: neutralPlayerInput() });
    expect(packet.snapshot.latestGoal?.physicalGoal).toBe("A");
    expect(packet.snapshot.goalFreezeTicksRemaining).toBe(5);
    const scoringTick = packet.snapshot.roundTick;
    const scoringBallX = packet.snapshot.ball.x;
    for (let index = 0; index < 4; index += 1) {
      packet = sport.step({ A: neutralPlayerInput() });
      expect(packet.snapshot.roundTick).toBe(scoringTick);
      expect(packet.snapshot.ball.x).toBe(scoringBallX);
    }
    packet = sport.step({ A: neutralPlayerInput() });
    expect(packet.snapshot.goalFreezeTicksRemaining).toBe(0);
    expect(packet.snapshot.ball.x).toBe(TUNING.courtWidth / 2);
  });

  it.each([
    ["A", { x: 20, y: 230, vx: -1_000, vy: 0 }],
    ["B", { x: 780, y: 230, vx: 1_000, vy: 0 }],
    ["C", { x: 400, y: 20, vx: 0, vy: -1_000 }],
    ["D", { x: 400, y: 440, vx: 0, vy: 1_000 }],
  ] as const)(
    "detects the four-player %s goal and awards its OWN side",
    (goalId, ball) => {
      const sport = new SportSimulation({
        roundNumber: 1,
        activePlayerIds: ["A", "B", "C", "D"],
        rules: fourPlayerPurposeRules("OWN"),
      });
      sportInternals(sport).ball = { ...ball, carrierId: null };

      const packet = sport.step();

      expect(packet.snapshot.latestGoal?.physicalGoal).toBe(goalId);
      expect(packet.snapshot.latestGoal?.awards[goalId]).toBe(true);
      expect(packet.snapshot.score[goalId]).toBe(1);
      for (const otherId of ["A", "B", "C", "D"] as const) {
        if (otherId !== goalId) expect(packet.snapshot.score[otherId]).toBe(0);
      }
    },
  );

  it("gives the north and south goals a proportional four-player aperture", () => {
    const within = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B", "C", "D"],
      rules: fourPlayerPurposeRules("OWN"),
    });
    sportInternals(within).ball = {
      x: TUNING.courtWidth / 2 + TUNING.horizontalGoalHalfWidth - 1,
      y: 20,
      vx: 0,
      vy: -1_000,
      carrierId: null,
    };
    expect(within.step().snapshot.latestGoal?.physicalGoal).toBe("C");

    const outside = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B", "C", "D"],
      rules: fourPlayerPurposeRules("OWN"),
    });
    sportInternals(outside).ball = {
      x: TUNING.courtWidth / 2 + TUNING.horizontalGoalHalfWidth + 1,
      y: 20,
      vx: 0,
      vy: -1_000,
      carrierId: null,
    };
    expect(outside.step().snapshot.latestGoal).toBeNull();
  });

  it.each([
    ["A", "B"],
    ["B", "A"],
    ["C", "D"],
    ["D", "C"],
  ] as const)(
    "maps four-player OPPOSITE scoring through physical goal %s to Player %s",
    (goalId, winnerId) => {
      const sport = new SportSimulation({
        roundNumber: 1,
        activePlayerIds: ["A", "B", "C", "D"],
        rules: fourPlayerPurposeRules("OPPOSITE"),
      });
      sportInternals(sport).ball = goalEntryBall(goalId);

      const packet = sport.step();

      expect(packet.snapshot.latestGoal?.physicalGoal).toBe(goalId);
      expect(packet.snapshot.latestGoal?.awards[winnerId]).toBe(true);
      expect(packet.snapshot.score[winnerId]).toBe(1);
    },
  );

  it.each(["A", "B", "C", "D"] as const)(
    "awards Player %s the four-player round win when they are the unique goal leader",
    (winnerId) => {
      const session = arcadeSession(4, "individual", ["A"], 41);
      forceSessionScore(session, {
        A: winnerId === "A" ? 2 : 0,
        B: winnerId === "B" ? 2 : 0,
        C: winnerId === "C" ? 2 : 0,
        D: winnerId === "D" ? 2 : 0,
      });

      const result = finishCurrentRound(session);

      expect(result.reveal?.roundWinnerIds).toEqual([winnerId]);
      expect(result.roundWins[winnerId]).toBe(1);
    },
  );

  it("uses an 8 by 8 binary-alpha Brown Box ball mask", () => {
    expect(FLUXBALL_V2_BALL).toHaveLength(8);
    expect(FLUXBALL_V2_BALL.every((row) => row.length === 8)).toBe(true);
    expect(new Set(FLUXBALL_V2_BALL.join(""))).toEqual(new Set([".", "C"]));
  });
});

describe("Fluxball CPU information boundary", () => {
  it("projects a sport snapshot without PlayerRules or hidden goal mappings", () => {
    const trace = sampleRoundRules({
      catalog: FLUXBALL_FIXTURE_CATALOG,
      competitorCount: 2,
      runSeed: 19,
      roundNumber: 1,
    });
    const sport = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B"],
      rules: interpretRoundRules(trace, "individual"),
    });
    const publicSnapshot = createPublicSportSnapshot(sport.getSnapshot());
    expect(JSON.stringify(publicSnapshot)).not.toMatch(
      /rules|purposeByPlayer|scoringGoalByPlayer|interactionRule/,
    );
  });

  it("learns ACTION from observed motion rather than selected rules", () => {
    const policy = new FluxballCpuPolicy("B", 31);
    const before = publicObservation(0, 620, 230);
    const decision = policy.decide(before);
    const rawX =
      Number(decision.rawInput.right) - Number(decision.rawInput.left);
    const rawY = Number(decision.rawInput.down) - Number(decision.rawInput.up);
    const after = publicObservation(1, 620 + rawX * 4, 230 + rawY * 4);
    policy.decide(after);
    expect(policy.snapshotBelief().action.value).toBe("DIRECT");
    expect(policy.snapshotBelief().action.confidence).toBeGreaterThan(0.9);
  });

  it.each(["A", "B", "C", "D"] as const)(
    "aims a carrier beyond learned physical goal %s using public outcomes only",
    (playerId) => {
      const policy = new FluxballCpuPolicy(
        playerId,
        31,
        CAPABLE_PUBLIC_POLICY_TUNING,
        [playerId],
      );
      const before = fourPlayerPublicObservation(30, playerId);
      const probe = policy.decide(before);
      const commanded = {
        x: Number(probe.rawInput.right) - Number(probe.rawInput.left),
        y: Number(probe.rawInput.down) - Number(probe.rawInput.up),
      };
      const learned = withPublicPlayer(
        before,
        playerId,
        {
          x: before.players[playerId]!.x + commanded.x * 4,
          y: before.players[playerId]!.y + commanded.y * 4,
        },
        {
          roundTick: 31,
          ballCarrierId: playerId,
          latestGoal: {
            eventId: 1,
            roundNumber: 1,
            tick: 30,
            ruleStateIndex: 0,
            physicalGoal: playerId,
            awardedPlayerIds: [playerId],
            scoreAfter: { A: 0, B: 0, C: 0, D: 0, [playerId]: 1 },
          },
        },
      );
      policy.decide(learned);
      const decision = policy.decide({
        ...learned,
        tick: 32,
        roundTick: 32,
        latestGoal: null,
      });

      expect(decision.reason).toBe("carry-to-believed-goal");
      if (playerId === "A") expect(decision.target.x).toBeLessThan(0);
      if (playerId === "B")
        expect(decision.target.x).toBeGreaterThan(learned.court.width);
      if (playerId === "C") expect(decision.target.y).toBeLessThan(0);
      if (playerId === "D")
        expect(decision.target.y).toBeGreaterThan(learned.court.height);
    },
  );

  it("rejects uncertified Story schedules and selects locally before play", () => {
    const rejected = Array.from({ length: 4_096 }, (_, runSeed) =>
      assessFluxballStorySeed(runSeed, 4),
    ).find((assessment) => !assessment.admitted);
    expect(rejected).toBeDefined();
    if (!rejected) throw new Error("Expected one inadmissible 4P schedule.");
    expect(rejected.separatingRounds.length).toBeLessThan(2);
    expect(() => legacyFourPlayerStorySession(rejected.runSeed)).toThrow(
      /uncertified seed/,
    );
    expect(() => twoPlayerSession(8)).toThrow(/uncertified seed/);

    const selected = selectFluxballStorySeed(1, 4);
    expect(selected.requestedRunSeed).toBe(1);
    expect(selected.selectedRunSeed).toBe(1);
    expect(selected.poolIndex).toBe(1);
    expect(selected.assessment.admitted).toBe(true);
    expect(selected.assessment.runSeed).toBe(selected.selectedRunSeed);
  });

  it("selects only certified seeds in a broad deterministic sweep", () => {
    for (const competitorCount of [2, 4] as const) {
      for (
        let candidateRunSeed = 0;
        candidateRunSeed < 4_096;
        candidateRunSeed += 1
      ) {
        const selection = selectFluxballStorySeed(
          candidateRunSeed,
          competitorCount,
        );
        expect(
          isCertifiedFluxballStorySeed(
            selection.selectedRunSeed,
            competitorCount,
          ),
        ).toBe(true);
        expect(
          assessFluxballStorySeed(selection.selectedRunSeed, competitorCount)
            .admitted,
        ).toBe(true);
      }
    }
  }, 30_000);
});

function twoPlayerSession(seed = 0): FluxballSession {
  return new FluxballSession(
    createRunContext({
      gameId: "fluxball",
      storyStage: "fluxball-individual",
      playMode: "story",
      rulesVersion: FLUXBALL_RULES_VERSION,
      runSeed: seed,
      pack: {
        packId: FLUXBALL_PLAYABLE_RULE_BANK.packId,
        contentSha256: FLUXBALL_PLAYABLE_RULE_BANK.contentSha256,
        schemaVersion: FLUXBALL_PLAYABLE_RULE_BANK.schemaVersion,
        source: FLUXBALL_PLAYABLE_RULE_BANK.source,
      },
    }),
    {
      competitorCount: 2,
      ruleMode: "individual",
      roundSeconds: 40,
      humanPlayerIds: ["A"],
    },
  );
}

function fourPlayerSession(seed = 0): FluxballSession {
  return new FluxballSession(
    createRunContext({
      gameId: "fluxball",
      storyStage: null,
      playMode: "arcade",
      rulesVersion: FLUXBALL_RULES_VERSION,
      runSeed: seed,
      pack: {
        packId: FLUXBALL_PLAYABLE_RULE_BANK.packId,
        contentSha256: FLUXBALL_PLAYABLE_RULE_BANK.contentSha256,
        schemaVersion: FLUXBALL_PLAYABLE_RULE_BANK.schemaVersion,
        source: FLUXBALL_PLAYABLE_RULE_BANK.source,
      },
    }),
    {
      competitorCount: 4,
      ruleMode: "individual",
      roundSeconds: 40,
      humanPlayerIds: ["A"],
    },
  );
}

function legacyFourPlayerStorySession(seed = 0): FluxballSession {
  return new FluxballSession(
    createRunContext({
      gameId: "fluxball",
      storyStage: "fluxball-four",
      playMode: "story",
      rulesVersion: FLUXBALL_LEGACY_RULES_VERSION,
      runSeed: seed,
      pack: {
        packId: FLUXBALL_PLAYABLE_RULE_BANK.packId,
        contentSha256: FLUXBALL_PLAYABLE_RULE_BANK.contentSha256,
        schemaVersion: FLUXBALL_PLAYABLE_RULE_BANK.schemaVersion,
        source: FLUXBALL_PLAYABLE_RULE_BANK.source,
      },
    }),
    {
      competitorCount: 4,
      ruleMode: "individual",
      roundSeconds: 60,
      humanPlayerIds: ["A"],
    },
  );
}

function twoHumanSession(
  ruleMode: "global" | "individual",
  seed: number,
): FluxballSession {
  return new FluxballSession(
    createRunContext({
      gameId: "fluxball",
      storyStage: null,
      playMode: "arcade",
      rulesVersion: FLUXBALL_RULES_VERSION,
      runSeed: seed,
      pack: {
        packId: FLUXBALL_PLAYABLE_RULE_BANK.packId,
        contentSha256: FLUXBALL_PLAYABLE_RULE_BANK.contentSha256,
        schemaVersion: FLUXBALL_PLAYABLE_RULE_BANK.schemaVersion,
        source: FLUXBALL_PLAYABLE_RULE_BANK.source,
      },
    }),
    {
      competitorCount: 2,
      ruleMode,
      roundSeconds: 40,
      humanPlayerIds: ["A", "B"],
    },
  );
}

function arcadeSession(
  competitorCount: 2 | 4,
  ruleMode: "global" | "individual",
  humanPlayerIds: readonly PlayerId[],
  seed: number,
): FluxballSession {
  return new FluxballSession(
    createRunContext({
      gameId: "fluxball",
      storyStage: null,
      playMode: "arcade",
      rulesVersion: FLUXBALL_RULES_VERSION,
      runSeed: seed,
      pack: {
        packId: FLUXBALL_PLAYABLE_RULE_BANK.packId,
        contentSha256: FLUXBALL_PLAYABLE_RULE_BANK.contentSha256,
        schemaVersion: FLUXBALL_PLAYABLE_RULE_BANK.schemaVersion,
        source: FLUXBALL_PLAYABLE_RULE_BANK.source,
      },
    }),
    {
      competitorCount,
      ruleMode,
      roundSeconds: 40,
      humanPlayerIds,
    },
  );
}

function advanceTicks(session: FluxballSession, count: number) {
  let snapshot = session.snapshot();
  for (let tick = 0; tick < count; tick += 1) {
    snapshot = session.step({ players: {} });
  }
  return snapshot;
}

function advanceToReveal(session: FluxballSession) {
  let snapshot = session.snapshot();
  let safety = (snapshot.sport?.roundTicks ?? 0) + 1_000;
  while (snapshot.phase === "active" && safety > 0) {
    snapshot = session.step({ players: {} });
    safety -= 1;
  }
  if (safety <= 0)
    throw new Error("Fluxball round did not end within safety bound.");
  return snapshot;
}

function publicObservation(
  tick: number,
  playerX: number,
  playerY: number,
): FluxballPublicSportSnapshot {
  return {
    roundNumber: 1,
    tick,
    roundTick: tick,
    roundTicks: 800,
    secondsRemaining: 40 - tick / 20,
    ruleStateIndex: 0,
    goalFreezeTicksRemaining: 0,
    activePlayerIds: ["A", "B"],
    court: {
      width: 800,
      height: 460,
      goalHalfExtent: 72,
      horizontalGoalHalfExtent: 120,
    },
    players: {
      A: {
        id: "A",
        x: 176,
        y: 230,
        rawFacing: { x: 1, y: 0 },
        resolvedMotion: { x: 0, y: 0 },
      },
      B: {
        id: "B",
        x: playerX,
        y: playerY,
        rawFacing: { x: -1, y: 0 },
        resolvedMotion: { x: 0, y: 0 },
      },
    },
    ball: { x: 400, y: 230, vx: 0, vy: 0, carrierId: null },
    score: { A: 0, B: 0 },
    latestGoal: null,
    latestContact: null,
  };
}

function fourPlayerPublicObservation(
  tick: number,
  carrierId: PlayerId,
): FluxballPublicSportSnapshot {
  const twoPlayer = publicObservation(tick, 624, 230);
  return {
    ...twoPlayer,
    activePlayerIds: ["A", "B", "C", "D"],
    players: {
      ...twoPlayer.players,
      C: {
        id: "C",
        x: 400,
        y: 101,
        rawFacing: { x: 0, y: 1 },
        resolvedMotion: { x: 0, y: 0 },
      },
      D: {
        id: "D",
        x: 400,
        y: 359,
        rawFacing: { x: 0, y: -1 },
        resolvedMotion: { x: 0, y: 0 },
      },
    },
    ball: {
      ...twoPlayer.ball,
      carrierId,
    },
    score: { A: 0, B: 0, C: 0, D: 0 },
  };
}

function withPublicPlayer(
  observation: FluxballPublicSportSnapshot,
  playerId: PlayerId,
  position: Readonly<{ x: number; y: number }>,
  changes: Readonly<{
    roundTick: number;
    ballCarrierId: PlayerId;
    latestGoal: FluxballPublicSportSnapshot["latestGoal"];
  }>,
): FluxballPublicSportSnapshot {
  const player = observation.players[playerId];
  if (!player) throw new Error(`Missing public Player ${playerId}.`);
  return {
    ...observation,
    tick: changes.roundTick,
    roundTick: changes.roundTick,
    players: {
      ...observation.players,
      [playerId]: {
        ...player,
        ...position,
        resolvedMotion: {
          x: position.x - player.x,
          y: position.y - player.y,
        },
      },
    },
    ball: { ...observation.ball, carrierId: changes.ballCarrierId },
    latestGoal: changes.latestGoal,
  };
}

function directStrikeRules(): InterpretedRoundRules {
  const playerRules = Object.freeze({
    action: "DIRECT" as const,
    interaction: "STRIKE" as const,
    purpose: "OWN" as const,
  });
  return Object.freeze({
    mode: "individual" as const,
    activePlayerIds: Object.freeze(["A", "B"] as const),
    players: Object.freeze({ A: playerRules, B: playerRules }),
    global: null,
    parityByAxis: Object.freeze({ X: "+", Y: "+", Z: "+" } as const),
  });
}

function carryVersusStrikeRules(): InterpretedRoundRules {
  return Object.freeze({
    mode: "individual" as const,
    activePlayerIds: Object.freeze(["A", "B"] as const),
    players: Object.freeze({
      A: Object.freeze({
        action: "DIRECT" as const,
        interaction: "CARRY" as const,
        purpose: "OWN" as const,
      }),
      B: Object.freeze({
        action: "DIRECT" as const,
        interaction: "STRIKE" as const,
        purpose: "OWN" as const,
      }),
    }),
    global: null,
    parityByAxis: Object.freeze({ X: "+", Y: "+", Z: "+" } as const),
  });
}

function fourPlayerPurposeRules(
  purpose: "OWN" | "OPPOSITE",
  interaction: "CARRY" | "STRIKE" = "STRIKE",
): InterpretedRoundRules {
  const playerRules = Object.freeze({
    action: "DIRECT" as const,
    interaction,
    purpose,
  });
  return Object.freeze({
    mode: "global" as const,
    activePlayerIds: Object.freeze(["A", "B", "C", "D"] as const),
    players: Object.freeze({
      A: playerRules,
      B: playerRules,
      C: playerRules,
      D: playerRules,
    }),
    global: playerRules,
    parityByAxis: Object.freeze({ X: "+", Y: "+", Z: "+" } as const),
  });
}

function fourPlayerSplitRules(): InterpretedRoundRules {
  const rulesFor = (purpose: "OWN" | "OPPOSITE") =>
    Object.freeze({
      action: "DIRECT" as const,
      interaction: "STRIKE" as const,
      purpose,
    });
  return Object.freeze({
    mode: "individual" as const,
    activePlayerIds: Object.freeze(["A", "B", "C", "D"] as const),
    players: Object.freeze({
      A: rulesFor("OWN"),
      B: rulesFor("OPPOSITE"),
      C: rulesFor("OPPOSITE"),
      D: rulesFor("OWN"),
    }),
    global: null,
    parityByAxis: Object.freeze({ X: "+", Y: "+", Z: "+" } as const),
  });
}

function carriedGoalEntry(goalId: PlayerId): Readonly<{
  playerX: number;
  playerY: number;
  facing: Readonly<{ x: number; y: number }>;
  ball: Omit<MutableSportInternals["ball"], "carrierId">;
}> {
  switch (goalId) {
    case "A":
      return {
        playerX: TUNING.courtPadding,
        playerY: 230,
        facing: { x: -1, y: 0 },
        ball: { x: 6, y: 230, vx: 0, vy: 0 },
      };
    case "B":
      return {
        playerX: TUNING.courtWidth - TUNING.courtPadding,
        playerY: 230,
        facing: { x: 1, y: 0 },
        ball: { x: TUNING.courtWidth - 6, y: 230, vx: 0, vy: 0 },
      };
    case "C":
      return {
        playerX: 400,
        playerY: TUNING.courtPadding,
        facing: { x: 0, y: -1 },
        ball: { x: 400, y: 6, vx: 0, vy: 0 },
      };
    case "D":
      return {
        playerX: 400,
        playerY: TUNING.courtHeight - TUNING.courtPadding,
        facing: { x: 0, y: 1 },
        ball: {
          x: 400,
          y: TUNING.courtHeight - 6,
          vx: 0,
          vy: 0,
        },
      };
  }
}

function goalEntryBall(goalId: PlayerId): MutableSportInternals["ball"] {
  switch (goalId) {
    case "A":
      return { x: 20, y: 230, vx: -1_000, vy: 0, carrierId: null };
    case "B":
      return { x: 780, y: 230, vx: 1_000, vy: 0, carrierId: null };
    case "C":
      return { x: 400, y: 20, vx: 0, vy: -1_000, carrierId: null };
    case "D":
      return { x: 400, y: 440, vx: 0, vy: 1_000, carrierId: null };
  }
}

function neutralPlayerInput() {
  return { up: false, down: false, left: false, right: false };
}

interface MutableSportInternals {
  players: Partial<
    Record<
      "A" | "B" | "C" | "D",
      {
        x: number;
        y: number;
        resolvedMotion: { x: number; y: number };
        resolvedFacing: { x: number; y: number };
        lastContactTick: number;
      }
    >
  >;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    carrierId: "A" | "B" | "C" | "D" | null;
  };
  score: Partial<Record<"A" | "B" | "C" | "D", number>>;
  roundTick: number;
}

function sportInternals(sport: SportSimulation): MutableSportInternals {
  return sport as unknown as MutableSportInternals;
}

function forceSessionBall(
  session: FluxballSession,
  ball: MutableSportInternals["ball"],
): void {
  const target = session as unknown as { sport: SportSimulation };
  sportInternals(target.sport).ball = { ...ball };
}

function forceSessionScore(
  session: FluxballSession,
  score: MutableSportInternals["score"],
): void {
  const target = session as unknown as { sport: SportSimulation };
  sportInternals(target.sport).score = { ...score };
}

function finishCurrentRound(session: FluxballSession) {
  const target = session as unknown as { sport: SportSimulation };
  const internals = sportInternals(target.sport);
  const roundTicks = target.sport.getSnapshot().roundTicks;
  internals.roundTick = roundTicks - 1;
  internals.ball = { x: 400, y: 230, vx: 0, vy: 0, carrierId: null };
  return session.step({ players: {} });
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
