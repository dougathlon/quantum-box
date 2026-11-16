import { describe, expect, it } from "vitest";
import { createRunContext } from "../../src/core/run";
import { FluxballCpuPolicy } from "../../src/games/fluxball/FluxballCpuPolicy";
import { FluxballSession } from "../../src/games/fluxball/FluxballSession";
import { FLUXBALL_PLAYABLE_RULE_BANK as bank } from "../../src/games/fluxball/fluxballControlPacks";
import {
  FLUXBALL_RULES_VERSION,
  type FluxballPublicSportSnapshot,
} from "../../src/games/fluxball/types";

function fourPlayerSplitSession(seed: number) {
  return new FluxballSession(
    createRunContext({
      gameId: "fluxball",
      storyStage: null,
      playMode: "arcade",
      rulesVersion: FLUXBALL_RULES_VERSION,
      runSeed: seed,
      pack: {
        packId: bank.packId,
        contentSha256: bank.contentSha256,
        schemaVersion: bank.schemaVersion,
        source: bank.source,
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

function blockedObservation(
  tick: number,
  boundary: boolean,
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
        x: 700,
        y: 300,
        rawFacing: { x: 0, y: 0 },
        resolvedMotion: { x: 0, y: 0 },
      },
      B: {
        id: "B",
        x: boundary ? 24 : 200,
        y: boundary ? 436 : 100,
        rawFacing: { x: 0, y: 0 },
        resolvedMotion: { x: 0, y: 0 },
      },
    },
    ball: { x: 400, y: 230, vx: 0, vy: 0, carrierId: null },
    score: { A: 0, B: 0 },
    latestGoal: null,
    latestContact: null,
  };
}

describe("Fluxball boundary recovery", () => {
  it.each([
    [7, 2],
    [14, 3],
  ])(
    "escapes the reproduced Split boundary deadlock in seed %i round %i",
    (seed, targetRound) => {
      const game = fourPlayerSplitSession(seed!);
      for (let round = 1; round < targetRound!; round++) {
        for (
          let step = 0;
          game.snapshot().phase === "active" && step < 1600;
          step++
        )
          game.step({ players: {} });
        expect(game.snapshot().phase).toBe("reveal");
        game.continueAfterReveal();
      }
      const ids = ["B", "C", "D"] as const;
      const stationary = { B: 0, C: 0, D: 0 };
      const maximum = { B: 0, C: 0, D: 0 };
      let previous = game.snapshot();
      let changed = false;
      const movementBefore: Record<string, string> = {};
      for (let step = 0; previous.phase === "active" && step < 1600; step++) {
        const before = previous.sport!;
        const request =
          !changed &&
          before.roundTick >= 300 &&
          before.goalFreezeTicksRemaining === 0;
        if (request) {
          changed = true;
          for (const id of ids)
            movementBefore[id] = previous.cpuBeliefs[id]!.action.value;
        }
        const next = game.step({
          players: {},
          revealRequests: request
            ? [{ playerId: "A", capturedAtMs: step * 50 }]
            : [],
        });
        const after = next.sport!;
        const live =
          before.goalFreezeTicksRemaining === 0 &&
          after.goalFreezeTicksRemaining === 0 &&
          before.latestGoal?.eventId === after.latestGoal?.eventId;
        for (const id of ids) {
          const a = before.players[id]!,
            b = after.players[id]!;
          stationary[id] =
            live && Math.hypot(b.x - a.x, b.y - a.y) < 0.15
              ? stationary[id] + 1
              : 0;
          maximum[id] = Math.max(maximum[id], stationary[id]);
        }
        previous = next;
      }
      expect(changed).toBe(true);
      expect(previous.phase).toBe(targetRound === 3 ? "complete" : "reveal");
      for (const id of ids) {
        // The regression was a 21–25 second stop, not ordinary brief contact.
        expect(maximum[id] / 20, `${id} stationary seconds`).toBeLessThan(4);
        expect(movementBefore[id]).not.toBe("UNKNOWN");
        expect(previous.cpuBeliefs[id]!.action.value).not.toBe(
          movementBefore[id],
        );
      }
      expect(
        previous.reveal!.goals.some(
          (goal) =>
            goal.ruleStateIndex === 1 &&
            goal.awardedPlayerIds.some((id) =>
              ids.includes(id as (typeof ids)[number]),
            ),
        ),
      ).toBe(true);
    },
  );

  it("tests blocked boundary input at normal cadence without treating it as inversion evidence", () => {
    const cpu = new FluxballCpuPolicy("B", 31);
    let lastInput = "";
    let probes = 0;
    for (let tick = 0; tick < 90; tick++) {
      const decision = cpu.decide(blockedObservation(tick, true));
      const input = JSON.stringify(decision.rawInput);
      if (lastInput && input !== lastInput) expect(tick % 3).toBe(0);
      if (decision.reason === "recover-blocked-motion") probes++;
      expect(cpu.snapshotBelief().action.value).toBe("UNKNOWN");
      lastInput = input;
    }
    expect(probes).toBeGreaterThan(0);
  });

  it("does not apply boundary recovery to a motionless player away from the walls", () => {
    const cpu = new FluxballCpuPolicy("B", 31);
    for (let tick = 0; tick < 90; tick++) {
      expect(cpu.decide(blockedObservation(tick, false)).reason).not.toBe(
        "recover-blocked-motion",
      );
      expect(cpu.snapshotBelief().action.value).toBe("UNKNOWN");
    }
  });
});
