import { describe, expect, it } from "vitest";

import { createRunContext, type RunContext } from "../../src/core/run";
import { QuantmanPursuerPolicy } from "../../src/games/quantman/QuantmanPursuerPolicy";
import {
  pointCell,
  QuantmanSession,
} from "../../src/games/quantman/QuantmanSession";
import { quantmanTopologyStateIsNavigable } from "../../src/games/quantman/QuantmanTopologyEvidence";
import { QUANTMAN_CONTROL_PACK } from "../../src/games/quantman/quantmanControlPack";
import type {
  QuantmanInput,
  QuantmanPackPayload,
  QuantmanPursuerRole,
} from "../../src/games/quantman/types";

describe("Quantman maze-chase recovery", () => {
  it("holds the READY state until the player supplies movement", () => {
    const session = new QuantmanSession(
      context(7),
      QUANTMAN_CONTROL_PACK.payload,
    );
    let snapshot = session.snapshot();
    for (let tick = 0; tick < 600; tick += 1) {
      snapshot = session.step({ x: 0, y: 0, observe: false });
    }
    expect(snapshot).toMatchObject({
      started: false,
      secondsRemaining: 180,
      lives: 3,
      fragmentsCollected: 0,
    });
    expect(
      snapshot.pursuers.every((pursuer) => pursuer.mode === "patrol"),
    ).toBe(true);
  });

  it("installs a dense original board, four distinct pursuers, power pellets, and paired tunnels", () => {
    const payload = QUANTMAN_CONTROL_PACK.payload;
    expect(payload.fragments.length).toBeGreaterThan(120);
    expect(
      payload.fragments.filter((fragment) => fragment.kind === "power"),
    ).toHaveLength(4);
    expect(payload.tunnelRows).toEqual([7]);
    expect(payload.pursuers.map((pursuer) => pursuer.role)).toEqual([
      "direct",
      "ambush",
      "flank",
      "wander",
    ]);
    expect(
      payload.labyrinthEnsemble.states.every((state) =>
        quantmanTopologyStateIsNavigable(payload, state),
      ),
    ).toBe(true);
    expect(payload.labyrinthEnsemble.acquisition).toMatchObject({
      mode: "remote-simulator",
      backend: "aer",
      qpu: false,
    });
  });

  it("changes topology on every accepted facing turn with no three-turn cap", () => {
    const payload = withoutPursuers();
    const first = new QuantmanSession(context(8_104), payload);
    const second = new QuantmanSession(context(8_104), payload);
    const tape: QuantmanInput[] = [{ x: 1, y: 0, observe: false }];
    for (let turn = 0; turn < 8; turn += 1) {
      tape.push({ x: turn % 2 === 0 ? -1 : 1, y: 0, observe: false });
    }
    let firstSnapshot = first.snapshot();
    let secondSnapshot = second.snapshot();
    for (const input of tape) {
      firstSnapshot = first.step(input);
      secondSnapshot = second.step(input);
      expect(secondSnapshot).toEqual(firstSnapshot);
    }

    expect(firstSnapshot.observationCount).toBe(8);
    expect(firstSnapshot.observationsRemaining).toBeNull();
    expect(firstSnapshot.topologyTransitions).toHaveLength(8);
    expect(
      firstSnapshot.topologyTransitions.every(
        (transition) =>
          transition.beforeStateId !== transition.afterStateId &&
          !transition.changedDoorIds.includes(transition.heldDoorId),
      ),
    ).toBe(true);
  });

  it("does not mutate topology for a blocked direction that never becomes the facing", () => {
    const session = new QuantmanSession(context(55), withoutPursuers());
    const before = session.snapshot();
    const after = session.step({ x: 0, y: -1, observe: false });
    expect(after.player).toEqual(before.player);
    expect(after.observationCount).toBe(0);
    expect(after.topologyStateId).toBe(before.topologyStateId);
  });

  it("wraps Quantman through the paired side tunnel", () => {
    const base = withoutPursuers();
    const payload: QuantmanPackPayload = {
      ...base,
      playerStart: Object.freeze({ row: 7, col: 0 }),
    };
    const session = new QuantmanSession(context(89), payload);
    session.step({ x: -1, y: 0, observe: false });
    const wrapped = session.step({ x: -1, y: 0, observe: false });
    expect(pointCell(payload, wrapped.player.x, wrapped.player.y)).toEqual({
      row: 7,
      col: 20,
    });
  });

  it("starts a power window and turns contact into an escalating pursuer score", () => {
    const base = QUANTMAN_CONTROL_PACK.payload;
    const power = base.fragments.find((fragment) => fragment.kind === "power");
    const pursuer = base.pursuers[0];
    if (!power || !pursuer)
      throw new Error("Quantman power test fixture is incomplete.");
    const payload: QuantmanPackPayload = {
      ...base,
      playerStart: Object.freeze({ row: power.row, col: power.col }),
      pursuers: [Object.freeze({ ...pursuer, row: power.row, col: power.col })],
    };
    const session = new QuantmanSession(context(101), payload);
    let snapshot = session.step({ x: -1, y: 0, observe: false });
    expect(snapshot.frightenedTicks).toBeGreaterThan(0);
    expect(snapshot.score).toBe(50);
    for (let tick = 0; tick < 260; tick += 1) {
      snapshot = session.step({ x: 0, y: 0, observe: false });
      if (snapshot.latestEvent?.type === "PURSUER_EATEN") break;
    }
    expect(snapshot.latestEvent?.type).toBe("PURSUER_EATEN");
    expect(snapshot.score).toBe(250);
    expect(snapshot.pursuers[0]).toMatchObject({
      mode: "returning",
      respawnTicks: expect.any(Number),
    });
  });

  it("gives all four pursuer roles materially different public-maze targets", () => {
    const payload = QUANTMAN_CONTROL_PACK.payload;
    const observation = {
      tick: 120,
      pursuerId: "TEST",
      ownCell: { row: 7, col: 8 },
      visiblePlayerCell: { row: 3, col: 10 },
      playerFacing: { x: 1, y: 0 },
      exitCell: payload.exit,
      exitUnlocked: false,
      rows: payload.rows,
      patrol: payload.pursuers[0]!.patrol,
    } as const;
    const roles: readonly QuantmanPursuerRole[] = [
      "direct",
      "ambush",
      "flank",
      "wander",
    ];
    const targets = roles.map(
      (role) =>
        new QuantmanPursuerPolicy("TEST", 17, 0, role).decide(observation)
          .targetCell,
    );
    expect(
      new Set(targets.map((cell) => `${cell.row}:${cell.col}`)).size,
    ).toBeGreaterThanOrEqual(3);
  });
});

function context(seed: number): RunContext {
  return createRunContext({
    gameId: "quantman",
    playMode: "arcade",
    storyStage: null,
    rulesVersion: QUANTMAN_CONTROL_PACK.rulesVersion,
    runSeed: seed,
    pack: {
      packId: QUANTMAN_CONTROL_PACK.packId,
      contentSha256: QUANTMAN_CONTROL_PACK.contentSha256,
      schemaVersion: QUANTMAN_CONTROL_PACK.schemaVersion,
      source: QUANTMAN_CONTROL_PACK.source,
    },
  });
}

function withoutPursuers(): QuantmanPackPayload {
  return {
    ...QUANTMAN_CONTROL_PACK.payload,
    pursuers: Object.freeze([]),
  };
}
