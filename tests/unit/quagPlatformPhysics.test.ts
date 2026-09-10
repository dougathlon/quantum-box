import { describe, expect, it } from "vitest";

import { createRunContext } from "../../src/core/run";
import { QUAG_SYNTHETIC_QGRAPH_PACK } from "../../src/games/qgraph/quarrySyntheticPack";
import {
  QUAG_CEILING_REBOUND_SPEED,
  QuagSession,
  type QuagScenario,
} from "../../src/games/quag/QuagSession";
import {
  QUAG_RULES_VERSION,
  QUAG_SUBPIXELS,
  type QuagInput,
} from "../../src/games/quag/types";

import { quagHudModel } from "../../src/games/quag/presentation";

const NEUTRAL = Object.freeze({
  horizontal: 0,
  flapPressed: false,
}) satisfies QuagInput;

function context(seed: number) {
  return createRunContext({
    gameId: "quarry",
    playMode: "arcade",
    rulesVersion: QUAG_RULES_VERSION,
    runSeed: seed,
    pack: {
      packId: QUAG_SYNTHETIC_QGRAPH_PACK.packId,
      contentSha256: QUAG_SYNTHETIC_QGRAPH_PACK.contentSha256,
      schemaVersion: QUAG_SYNTHETIC_QGRAPH_PACK.schemaVersion,
      source: QUAG_SYNTHETIC_QGRAPH_PACK.sourceClassification,
    },
  });
}

function playersWithA(
  player: Omit<NonNullable<QuagScenario["players"]>[number], "id">,
): NonNullable<QuagScenario["players"]> {
  return [
    { id: "A", ...player },
    { id: "B", x: 548, y: 250, grounded: true, graceTicks: 30 },
    { id: "C", x: 174, y: 182, grounded: true, graceTicks: 30 },
    { id: "D", x: 466, y: 182, grounded: true, graceTicks: 30 },
  ];
}

function playerA(session: QuagSession) {
  return session.snapshot().players.find((player) => player.id === "A")!;
}

describe("Quarry fixed-point platform physics", () => {
  it("applies acceleration, reversal, flap impulse, gravity, and cooldown in fixed units", () => {
    const session = new QuagSession(context(401), QUAG_SYNTHETIC_QGRAPH_PACK, {
      cpuEnabled: false,
      readyTicks: 0,
      arenaId: "quarry-aerial-arena-v1",
      players: playersWithA({
        x: 320,
        y: 180,
        velocityXSubpixels: 0,
        velocityYSubpixels: 0,
        facing: 1,
        grounded: false,
        graceTicks: 0,
      }),
    });

    const accelerated = session.step({ horizontal: 1, flapPressed: true });
    expect(
      accelerated.players.find((player) => player.id === "A"),
    ).toMatchObject({
      previousXSubpixels: 320 * QUAG_SUBPIXELS,
      previousYSubpixels: 180 * QUAG_SUBPIXELS,
      xSubpixels: 320 * QUAG_SUBPIXELS + 12,
      ySubpixels: 180 * QUAG_SUBPIXELS - 86,
      velocityXSubpixels: 12,
      velocityYSubpixels: -86,
      facing: 1,
      grounded: false,
      flapCooldownTicks: 4,
      movementSequence: 1,
    });
    expect(accelerated.metrics).toMatchObject({ flaps: 1, airborneTicks: 1 });

    const reversed = session.step({ horizontal: -1, flapPressed: true });
    expect(reversed.players.find((player) => player.id === "A")).toMatchObject({
      xSubpixels: 320 * QUAG_SUBPIXELS + 4,
      ySubpixels: 180 * QUAG_SUBPIXELS - 162,
      velocityXSubpixels: -8,
      velocityYSubpixels: -76,
      facing: -1,
      grounded: false,
      flapCooldownTicks: 3,
      movementSequence: 2,
    });
    expect(reversed.metrics).toMatchObject({ flaps: 1, airborneTicks: 2 });
  });

  it("lands on the first crossed platform top without sinking through it", () => {
    const session = new QuagSession(context(402), QUAG_SYNTHETIC_QGRAPH_PACK, {
      cpuEnabled: false,
      readyTicks: 0,
      arenaId: "quarry-aerial-arena-v1",
      players: playersWithA({
        x: 100,
        y: 249.5,
        velocityYSubpixels: 0,
        grounded: false,
        graceTicks: 0,
      }),
    });

    const snapshot = session.step(NEUTRAL);
    expect(playerA(session)).toMatchObject({
      previousYSubpixels: 249.5 * QUAG_SUBPIXELS,
      ySubpixels: 250 * QUAG_SUBPIXELS,
      velocityYSubpixels: 0,
      grounded: true,
    });
    expect(snapshot.metrics.landings).toBe(1);
  });

  it("rebounds from the ceiling instead of pinning every height contest there", () => {
    const session = new QuagSession(context(4021), QUAG_SYNTHETIC_QGRAPH_PACK, {
      cpuEnabled: false,
      readyTicks: 0,
      arenaId: "quarry-aerial-arena-v1",
      players: playersWithA({
        x: 320,
        y: 64,
        velocityYSubpixels: -128,
        grounded: false,
        graceTicks: 0,
      }),
    });

    session.step(NEUTRAL);
    expect(playerA(session)).toMatchObject({
      ySubpixels: 64 * QUAG_SUBPIXELS,
      velocityYSubpixels: QUAG_CEILING_REBOUND_SPEED,
      grounded: false,
    });
  });

  it("wraps the complete body across the horizontal arena seam", () => {
    const session = new QuagSession(context(403), QUAG_SYNTHETIC_QGRAPH_PACK, {
      cpuEnabled: false,
      readyTicks: 0,
      arenaId: "quarry-aerial-arena-v1",
      players: playersWithA({
        x: 4,
        y: 100,
        velocityXSubpixels: -96,
        velocityYSubpixels: 0,
        facing: -1,
        grounded: false,
        graceTicks: 0,
      }),
    });

    const snapshot = session.step({ horizontal: -1, flapPressed: false });
    expect(playerA(session)).toMatchObject({
      previousXSubpixels: 4 * QUAG_SUBPIXELS,
      xSubpixels: 630 * QUAG_SUBPIXELS,
      velocityXSubpixels: -96,
      velocityYSubpixels: 10,
      grounded: false,
    });
    expect(snapshot.metrics.wraps).toBe(1);
  });

  it.each([4, 636])(
    "lands safely when the body is exactly tangent to the arena seam at x=%i",
    (x) => {
      const session = new QuagSession(
        context(404 + x),
        QUAG_SYNTHETIC_QGRAPH_PACK,
        {
          cpuEnabled: false,
          readyTicks: 0,
          arenaId: "quarry-aerial-arena-v1",
          players: playersWithA({
            x,
            y: 307.5,
            velocityXSubpixels: 0,
            velocityYSubpixels: 0,
            grounded: false,
            graceTicks: 0,
          }),
        },
      );

      for (let tick = 0; tick < 4; tick += 1) session.step(NEUTRAL);
      expect(playerA(session)).toMatchObject({
        xSubpixels: x * QUAG_SUBPIXELS,
        ySubpixels: 308 * QUAG_SUBPIXELS,
        velocityYSubpixels: 0,
        grounded: true,
      });
    },
  );
});

it("shows current-round points separately from match wins", () => {
  const session = new QuagSession(context(70), QUAG_SYNTHETIC_QGRAPH_PACK, {
    cpuEnabled: false,
    readyTicks: 0,
    roundTicks: 1,
    totalRounds: 2,
    roundBreakTicks: 0,
    players: playersWithA({
      x: 92,
      y: 250,
      score: 99,
      roundScore: 3,
      roundWins: 1,
    }),
  });
  expect(quagHudModel(session.snapshot(), false).score).toBe(
    "POINTS A03 B00 C00 D00 · WINS A1 B0 C0 D0",
  );
  session.step(NEUTRAL);
  expect(quagHudModel(session.snapshot(), false).score).toBe(
    "POINTS A00 B00 C00 D00 · WINS A2 B0 C0 D0",
  );
});
