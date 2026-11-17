import { describe, it, expect } from "vitest";
import { createRunContext } from "../../src/core/run";
import { QuagSession } from "../../src/games/quag/QuagSession";
import { QuagCpuPolicy } from "../../src/games/quag/QuagCpuPolicy";
import { QUAG_SYNTHETIC_QGRAPH_PACK as quarryPack } from "../../src/games/qgraph/quarrySyntheticPack";
import { QUAG_RULES_VERSION, QUAG_SUBPIXELS } from "../../src/games/quag/types";
import {
  FluxballCpuPolicy,
  ARCADE_CPU_TUNING,
} from "../../src/games/fluxball/FluxballCpuPolicy";
import { FluxballSession } from "../../src/games/fluxball/FluxballSession";
import { FLUXBALL_PLAYABLE_RULE_BANK as fluxPack } from "../../src/games/fluxball/fluxballControlPacks";
import { FLUXBALL_RULES_VERSION } from "../../src/games/fluxball/types";
import { SportSimulation } from "../../src/games/fluxball/standalone/simulation";
import type { PlayerId } from "../../src/games/fluxball/standalone/modes";

const neutral = { horizontal: 0, flapPressed: false } as const;
const ids = ["A", "B", "C", "D"] as const;
function quarryContext() {
  return createRunContext({
    gameId: "quarry",
    playMode: "arcade",
    rulesVersion: QUAG_RULES_VERSION,
    runSeed: 912,
    pack: {
      packId: quarryPack.packId,
      contentSha256: quarryPack.contentSha256,
      schemaVersion: quarryPack.schemaVersion,
      source: quarryPack.sourceClassification,
    },
  });
}
function fluxSession(
  count: 2 | 4,
  mode: "global" | "individual",
  seed: number,
) {
  return new FluxballSession(
    createRunContext({
      gameId: "fluxball",
      playMode: "arcade",
      rulesVersion: FLUXBALL_RULES_VERSION,
      runSeed: seed,
      pack: {
        packId: fluxPack.packId,
        contentSha256: fluxPack.contentSha256,
        schemaVersion: fluxPack.schemaVersion,
        source: fluxPack.source,
      },
    }),
    {
      competitorCount: count,
      ruleMode: mode,
      roundSeconds: 40,
      humanPlayerIds: count === 4 ? ids : ["A", "B"],
    },
  );
}

describe("release CPU balance and navigation", () => {
  it.each([["A"], ["A", "B"]] as const)(
    "leaves a blocking ledge with human seats %j",
    (...humans) => {
      const session = new QuagSession(quarryContext(), quarryPack, {
        readyTicks: 0,
        roundTicks: 240,
        totalRounds: 1,
        humanPlayerIds: humans,
        initialBitstring: "000000100000",
        arenaId: "quarry-aerial-arena-v1",
        players: [
          { id: "A", x: 174, y: 250, grounded: true },
          { id: "B", x: 500, y: 308, grounded: true },
          { id: "C", x: 174, y: 182, grounded: true },
          { id: "D", x: 588, y: 308, grounded: true },
        ],
      });
      let leftLedge = false,
        descended = false;
      for (let tick = 0; tick < 160; tick++) {
        const c = session.step(neutral).players.find((p) => p.id === "C")!;
        leftLedge ||= Math.abs(c.xSubpixels / 16 - 174) > 90;
        descended ||= c.ySubpixels / 16 > 210;
      }
      expect(leftLedge).toBe(true);
      expect(descended).toBe(true);
    },
  );
  it("retains the old Quarry policy for recorded v7 runs", () => {
    const session = new QuagSession(
      { ...quarryContext(), rulesVersion: "quarry-rules-v7" },
      quarryPack,
      {
        readyTicks: 0,
        roundTicks: 220,
        totalRounds: 1,
        initialBitstring: "000000100000",
        arenaId: "quarry-aerial-arena-v1",
        players: [
          { id: "A", x: 174, y: 250, grounded: true },
          { id: "B", x: 500, y: 308, grounded: true },
          { id: "C", x: 174, y: 182, grounded: true },
          { id: "D", x: 588, y: 308, grounded: true },
        ],
      },
    );
    for (let t = 0; t < 200; t++) session.step(neutral);
    const c = session.snapshot().players.find((p) => p.id === "C")!;
    expect([c.xSubpixels / 16, c.ySubpixels / 16]).toEqual([174, 182]);
  });
  it("flees a visible hunter without prey and changes safe perches over time", () => {
    const base = new QuagSession(quarryContext(), quarryPack, {
      readyTicks: 0,
    }).snapshot();
    const players = base.players.map((p) => ({
      ...p,
      xSubpixels: (p.id === "C" ? 320 : p.id === "A" ? 280 : 580) * 16,
      ySubpixels: 220 * 16,
    }));
    const observation = {
      playerId: "C" as const,
      tick: 0,
      graphPhase: 0,
      players,
      outgoingTargets: [],
      incomingHunters: ["A"] as const,
      policySeed: 0,
    };
    expect(new QuagCpuPolicy().decide(observation).horizontal).toBe(1);
    const otherSide = players.map((p) =>
      p.id === "A" ? { ...p, xSubpixels: 360 * 16 } : p,
    );
    expect(
      new QuagCpuPolicy().decide({ ...observation, players: otherSide })
        .horizontal,
    ).toBe(-1);
    const policy = new QuagCpuPolicy();
    const directions = new Set(
      Array.from(
        { length: 7 },
        (_, i) =>
          policy.decide({ ...observation, tick: i * 80, incomingHunters: [] })
            .horizontal,
      ),
    );
    expect(directions.has(-1)).toBe(true);
    expect(directions.has(1)).toBe(true);
  });
  it("holds a pursuit decision briefly then responds to changed visible prey", () => {
    const base = new QuagSession(quarryContext(), quarryPack, {
      readyTicks: 0,
    }).snapshot();
    const players = base.players.map((p) => ({
      ...p,
      xSubpixels: (p.id === "C" ? 320 : 200) * 16,
      ySubpixels: 220 * 16,
      grounded: false,
    }));
    const observation = {
      playerId: "C" as const,
      tick: 0,
      graphPhase: 0,
      players,
      outgoingTargets: ["A"] as const,
      incomingHunters: [],
      policySeed: 0,
    };
    const policy = new QuagCpuPolicy();
    expect(policy.decide(observation).horizontal).toBe(-1);
    const moved = players.map((p) =>
      p.id === "A" ? { ...p, xSubpixels: 420 * 16 } : p,
    );
    expect(
      policy.decide({ ...observation, tick: 1, players: moved }).horizontal,
    ).toBe(-1);
    expect(
      policy.decide({ ...observation, tick: 4, players: moved }).horizontal,
    ).toBe(1);
  });
  it("starts all four seats equally far away and preserves two-player/legacy starts", () => {
    const rule = {
      action: "DIRECT",
      interaction: "CARRY",
      purpose: "OPPOSITE",
    } as const;
    const rules = {
      mode: "global",
      activePlayerIds: ids,
      players: Object.fromEntries(ids.map((id) => [id, rule])),
      global: rule,
      parityByAxis: { X: "+", Y: "+", Z: "+" },
    } as const;
    const arrivals = [];
    for (const id of ids) {
      const sport = new SportSimulation({
        roundNumber: 1,
        activePlayerIds: ids,
        rules,
        fairFourPlayerSeed: 7,
      });
      const start = sport.getSnapshot().players[id]!;
      expect(Math.hypot(start.x - 400, start.y - 230)).toBeCloseTo(128.8);
      for (let tick = 1; tick < 100; tick++) {
        const s = sport.getSnapshot(),
          p = s.players[id]!;
        sport.step({
          [id]: {
            left: s.ball.x < p.x - 1,
            right: s.ball.x > p.x + 1,
            up: s.ball.y < p.y - 1,
            down: s.ball.y > p.y + 1,
          },
        });
        if (sport.getSnapshot().latestContact?.playerId === id) {
          arrivals.push(tick);
          break;
        }
      }
    }
    expect(arrivals).toHaveLength(4);
    expect(new Set(arrivals).size).toBe(1);
    for (const activePlayerIds of [ids, ["A", "B"] as const]) {
      const old = new SportSimulation({
        roundNumber: 1,
        activePlayerIds,
        rules,
      });
      expect(old.getSnapshot().players.A!.x).toBe(176);
    }
    const two = new SportSimulation({
      roundNumber: 1,
      activePlayerIds: ["A", "B"],
      rules,
      fairFourPlayerSeed: 7,
    });
    expect(two.getSnapshot().players.A!.x).toBe(176);
  });
  it("resolves simultaneous opposing contacts in four-way rounds reproducibly without a fixed seat winner", () => {
    const rule = {
      action: "DIRECT",
      interaction: "CARRY",
      purpose: "OPPOSITE",
    } as const;
    const rules = {
      mode: "global",
      activePlayerIds: ids,
      players: Object.fromEntries(ids.map((id) => [id, rule])),
      global: rule,
      parityByAxis: { X: "+", Y: "+", Z: "+" },
    } as const;
    const contact = (seed: number, axis: readonly PlayerId[]) => {
      const sport = new SportSimulation({
        roundNumber: 1,
        activePlayerIds: ids,
        rules,
        fairFourPlayerSeed: seed,
      });
      for (let t = 0; t < 400; t++) {
        const s = sport.getSnapshot();
        sport.step(
          Object.fromEntries(
            axis.map((id) => {
              const p = s.players[id]!;
              return [
                id,
                {
                  left: p.x > s.ball.x + 1,
                  right: p.x < s.ball.x - 1,
                  up: p.y > s.ball.y + 1,
                  down: p.y < s.ball.y - 1,
                },
              ];
            }),
          ),
        );
        if (sport.getSnapshot().latestContact)
          return sport.getSnapshot().latestContact!.playerId;
      }
      throw Error("No opening contact");
    };
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    for (const axis of [
      ["A", "B"],
      ["C", "D"],
    ] as const)
      for (let seed = 0; seed < 128; seed++) {
        const id = contact(seed, axis);
        expect(contact(seed, axis)).toBe(id);
        counts[id]++;
      }
    for (const count of Object.values(counts))
      expect(count).toBeGreaterThan(15);
  });
});

it.each([2, 4] as const)(
  "eases %i-seat carrier tracking while holding a purposeful decision",
  (count) => {
    const session = fluxSession(count, "global", 12);
    const base = session.snapshot().sport!;
    const obs = {
      ...base,
      ball: { ...base.ball, carrierId: "A" as const },
      players: {
        ...base.players,
        A: {
          ...base.players.A!,
          x: 400,
          y: 200,
          resolvedMotion: { x: 100, y: 0 },
        },
      },
    };
    const cpu = new FluxballCpuPolicy("B", 7, ARCADE_CPU_TUNING);
    const first = cpu.decide(obs);
    expect(first.reason).toBe("challenge-carrier");
    expect(first.target.x).toBe(count === 2 ? 425 : 415);
    const interval = count === 2 ? 4 : 7;
    const moved = {
      ...obs,
      players: { ...obs.players, A: { ...obs.players.A, y: 300 } },
    };
    expect(
      cpu.decide({ ...moved, roundTick: interval - 1, tick: interval - 1 }),
    ).toEqual(first);
    expect(
      cpu.decide({ ...moved, roundTick: interval, tick: interval }).target.y,
    ).toBe(300);
  },
);

it("restores equal-radius spawns after a four-way goal", () => {
  const rule = {
    action: "DIRECT",
    interaction: "CARRY",
    purpose: "OPPOSITE",
  } as const;
  const rules = {
    mode: "global",
    activePlayerIds: ids,
    players: Object.fromEntries(ids.map((id) => [id, rule])),
    global: rule,
    parityByAxis: { X: "+", Y: "+", Z: "+" },
  } as const;
  const sport = new SportSimulation({
    roundNumber: 1,
    activePlayerIds: ids,
    rules,
    fairFourPlayerSeed: 4,
  });
  const internal = sport as unknown as {
    ball: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      carrierId: PlayerId | null;
    };
  };
  internal.ball = { x: 790, y: 230, vx: 100, vy: 0, carrierId: null };
  sport.step();
  expect(sport.getSnapshot().latestGoal).not.toBeNull();
  for (
    let t = 0;
    t < 100 && sport.getSnapshot().goalFreezeTicksRemaining > 0;
    t++
  )
    sport.step();
  for (const p of Object.values(sport.getSnapshot().players))
    expect(Math.hypot(p!.x - 400, p!.y - 230)).toBeCloseTo(128.8);
});
