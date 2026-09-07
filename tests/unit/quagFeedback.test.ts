import { describe, expect, it } from "vitest";

import { createRunContext } from "../../src/core/run";
import { QUAG_SYNTHETIC_QGRAPH_PACK } from "../../src/games/qgraph/quarrySyntheticPack";
import {
  createQuagFeedbackCursor,
  quagCompletionCue,
  routeQuagFeedback,
} from "../../src/games/quag/QuagFeedback";
import {
  QUAG_KNOCKOUT_TICKS,
  QUAG_RESPAWN_GRACE_TICKS,
  QuagSession,
} from "../../src/games/quag/QuagSession";
import {
  QUAG_RULES_VERSION,
  QUAG_SUBPIXELS,
  type QuagEvent,
  type QuagInput,
  type QuagSnapshot,
} from "../../src/games/quag/types";

const NEUTRAL = Object.freeze({
  horizontal: 0,
  flapPressed: false,
}) satisfies QuagInput;

describe("Quarry public feedback routing", () => {
  it("derives Player A flap feedback without modifying simulation events", () => {
    const quag = session({
      x: 320,
      y: 180,
      grounded: false,
      graceTicks: 30,
    });
    const before = quag.snapshot();
    const input = { horizontal: 0, flapPressed: true } as const;
    const after = quag.step(input);
    const route = routeQuagFeedback(
      createQuagFeedbackCursor(before),
      after,
      input,
    );

    expect(after.eventsThisTick).toEqual([]);
    expect(route.events).toEqual([{ type: "flap", tick: 1, playerId: "A" }]);
  });

  it("routes movement feedback for every local human without sonifying CPUs", () => {
    const quag = new QuagSession(context(70), QUAG_SYNTHETIC_QGRAPH_PACK, {
      cpuEnabled: false,
      readyTicks: 0,
      humanPlayerIds: ["A", "B", "C", "D"],
      arenaId: "quarry-aerial-arena-v1",
      players: [
        { id: "A", x: 80, y: 120, grounded: false },
        { id: "B", x: 240, y: 120, grounded: false },
        { id: "C", x: 400, y: 120, grounded: false },
        { id: "D", x: 560, y: 120, grounded: false },
      ],
    });
    const before = quag.snapshot();
    const input = {
      horizontal: 0,
      flapPressed: false,
      players: {
        A: { horizontal: 0, flapPressed: true },
        B: { horizontal: 0, flapPressed: true },
        C: { horizontal: 0, flapPressed: true },
        D: { horizontal: 0, flapPressed: true },
      },
    } as const satisfies QuagInput;
    const after = quag.step(input);

    expect(
      routeQuagFeedback(createQuagFeedbackCursor(before), after, input).events,
    ).toEqual([
      { type: "flap", tick: 1, playerId: "A" },
      { type: "flap", tick: 1, playerId: "B" },
      { type: "flap", tick: 1, playerId: "C" },
      { type: "flap", tick: 1, playerId: "D" },
    ]);
  });

  it("derives Player A landing and wrap feedback from public movement", () => {
    const landingSession = session({
      x: 100,
      y: 249.5,
      grounded: false,
      graceTicks: 30,
    });
    const beforeLanding = landingSession.snapshot();
    const landed = landingSession.step(NEUTRAL);
    expect(
      routeQuagFeedback(
        createQuagFeedbackCursor(beforeLanding),
        landed,
        NEUTRAL,
      ).events.map((event) => event.type),
    ).toEqual(["land"]);

    const wrappingSession = session({
      x: 4,
      y: 100,
      velocityXSubpixels: -96,
      grounded: false,
      graceTicks: 30,
    });
    const beforeWrap = wrappingSession.snapshot();
    const wrapInput = { horizontal: -1, flapPressed: false } as const;
    const wrapped = wrappingSession.step(wrapInput);
    expect(
      routeQuagFeedback(
        createQuagFeedbackCursor(beforeWrap),
        wrapped,
        wrapInput,
      ).events.map((event) => event.type),
    ).toEqual(["wrap"]);
    expect(wrapped.eventsThisTick).toEqual([]);
  });

  it("routes existing public graph and capture events once", () => {
    const quag = session({
      x: 320,
      y: 180,
      grounded: false,
      graceTicks: 30,
    });
    const initial = quag.snapshot();
    const frame = feedbackFrame(initial, [
      event(1, "GRAPH_SHIFT"),
      event(2, "CAPTURE"),
      event(3, "ROUND_COMPLETE"),
    ]);
    const first = routeQuagFeedback(
      createQuagFeedbackCursor(initial),
      frame,
      NEUTRAL,
    );
    const repeated = routeQuagFeedback(first.cursor, frame, NEUTRAL);

    expect(first.events.map((candidate) => candidate.type)).toEqual([
      "graph-shift",
      "capture",
    ]);
    expect(first.cursor.lastEventId).toBe(3);
    expect(repeated.events).toEqual([]);
  });

  it("does not infer a flap when a cooldown rejects the input", () => {
    const quag = session({
      x: 320,
      y: 180,
      grounded: false,
      graceTicks: 30,
    });
    const input = { horizontal: 0, flapPressed: true } as const;
    const first = quag.step(input);
    const cursor = createQuagFeedbackCursor(first);
    const rejected = quag.step(input);

    expect(routeQuagFeedback(cursor, rejected, input).events).toEqual([]);
  });

  it("routes a flap accepted on the cooldown-expiry tick", () => {
    const quag = session({
      x: 320,
      y: 180,
      grounded: false,
      graceTicks: 30,
    });
    const flap = { horizontal: 0, flapPressed: true } as const;
    quag.step(flap);
    quag.step(NEUTRAL);
    quag.step(NEUTRAL);
    const beforeExpiry = quag.step(NEUTRAL);
    expect(
      beforeExpiry.players.find(({ id }) => id === "A")?.flapCooldownTicks,
    ).toBe(1);

    const accepted = quag.step(flap);
    expect(
      routeQuagFeedback(
        createQuagFeedbackCursor(beforeExpiry),
        accepted,
        flap,
      ).events.map((event) => event.type),
    ).toEqual(["flap"]);
  });

  it("removes a caught duck, respawns it at another safe perch, and grants grace", () => {
    const quag = new QuagSession(context(72), QUAG_SYNTHETIC_QGRAPH_PACK, {
      cpuEnabled: false,
      readyTicks: 0,
      arenaId: "quarry-aerial-arena-v1",
      initialBitstring: "100000000000",
      players: [
        {
          id: "A",
          x: 100,
          y: 100,
          grounded: false,
          graceTicks: 0,
        },
        { id: "B", x: 100, y: 112, grounded: false, graceTicks: 0 },
        { id: "C", x: 350, y: 80, grounded: false, graceTicks: 30 },
        { id: "D", x: 550, y: 280, grounded: false, graceTicks: 30 },
      ],
    });
    const beforeCatch = quag.snapshot();
    const caught = quag.step(NEUTRAL);

    expect(caught.players.every(({ respawns }) => respawns === 0)).toBe(true);
    expect(caught.players.find(({ id }) => id === "B")?.knockedOutTicks).toBe(
      QUAG_KNOCKOUT_TICKS,
    );
    expect(
      routeQuagFeedback(
        createQuagFeedbackCursor(beforeCatch),
        caught,
        NEUTRAL,
      ).events.map((event) => event.type),
    ).toEqual(["capture"]);

    let respawned = caught;
    for (let tick = 0; tick < QUAG_KNOCKOUT_TICKS; tick += 1) {
      respawned = quag.step(NEUTRAL);
    }
    expect(respawned.graphPhase).toBe(caught.graphPhase);
    const caughtB = caught.players.find(({ id }) => id === "B")!;
    const respawnedB = respawned.players.find(({ id }) => id === "B")!;
    expect(respawnedB).toMatchObject({
      knockedOutTicks: 0,
      graceTicks: QUAG_RESPAWN_GRACE_TICKS,
      respawns: 1,
    });
    expect([respawnedB.xSubpixels, respawnedB.ySubpixels]).not.toEqual([
      caughtB.xSubpixels,
      caughtB.ySubpixels,
    ]);
    expect([
      respawnedB.xSubpixels / QUAG_SUBPIXELS,
      respawnedB.ySubpixels / QUAG_SUBPIXELS,
    ]).not.toEqual([548, 250]);
  });

  it("prevents a respawn-grace duck from being caught on contact", () => {
    const quag = new QuagSession(context(74), QUAG_SYNTHETIC_QGRAPH_PACK, {
      cpuEnabled: false,
      readyTicks: 0,
      arenaId: "quarry-aerial-arena-v1",
      initialBitstring: "100000000000",
      players: [
        { id: "A", x: 100, y: 100, grounded: false, graceTicks: 0 },
        { id: "B", x: 100, y: 112, grounded: false, graceTicks: 2 },
        { id: "C", x: 350, y: 80, grounded: false, graceTicks: 30 },
        { id: "D", x: 550, y: 280, grounded: false, graceTicks: 30 },
      ],
    });

    const protectedStep = quag.step(NEUTRAL);

    expect(protectedStep.metrics.captures).toBe(0);
    expect(protectedStep.players.find(({ id }) => id === "A")?.score).toBe(0);
    expect(protectedStep.players.find(({ id }) => id === "B")?.graceTicks).toBe(
      1,
    );
  });

  it("retains movement feedback on the final simulation tick", () => {
    const quag = new QuagSession(context(73), QUAG_SYNTHETIC_QGRAPH_PACK, {
      cpuEnabled: false,
      readyTicks: 0,
      roundTicks: 1,
      totalRounds: 1,
      players: [{ id: "A", x: 320, y: 180, grounded: false, graceTicks: 30 }],
    });
    const beforeFinalTick = quag.snapshot();
    const flap = { horizontal: 0, flapPressed: true } as const;
    const completed = quag.step(flap);

    expect(completed.phase).toBe("complete");
    expect(
      routeQuagFeedback(
        createQuagFeedbackCursor(beforeFinalTick),
        completed,
        flap,
      ).events.map((event) => event.type),
    ).toContain("flap");
  });

  it("distinguishes a human win, a tie, and a human loss", () => {
    expect(quagCompletionCue({ winnerIds: ["B"], humanPlayerIds: ["B"] })).toBe(
      "quag-match-win",
    );
    expect(
      quagCompletionCue({
        winnerIds: ["A", "B"],
        humanPlayerIds: ["A", "B"],
      }),
    ).toBe("quag-match-draw");
    expect(
      quagCompletionCue({ winnerIds: ["C"], humanPlayerIds: ["A", "B"] }),
    ).toBe("quag-match-loss");
  });
});

function session(
  playerA: Readonly<{
    x: number;
    y: number;
    velocityXSubpixels?: number;
    grounded: boolean;
    graceTicks: number;
  }>,
): QuagSession {
  return new QuagSession(context(71), QUAG_SYNTHETIC_QGRAPH_PACK, {
    cpuEnabled: false,
    readyTicks: 0,
    arenaId: "quarry-aerial-arena-v1",
    players: [
      { id: "A", ...playerA },
      { id: "B", x: 548, y: 250, grounded: true, graceTicks: 30 },
      { id: "C", x: 174, y: 182, grounded: true, graceTicks: 30 },
      { id: "D", x: 466, y: 182, grounded: true, graceTicks: 30 },
    ],
  });
}

function feedbackFrame(
  source: QuagSnapshot,
  eventsThisTick: readonly QuagEvent[],
): QuagSnapshot {
  return Object.freeze({
    ...source,
    tick: source.tick + 1,
    eventsThisTick: Object.freeze([...eventsThisTick]),
  });
}

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

function event(eventId: number, type: QuagEvent["type"]): QuagEvent {
  return Object.freeze({
    eventId,
    tick: eventId,
    type,
    detail: type,
    captureEdges: Object.freeze([]),
    playerIds: Object.freeze(["A"] as const),
  });
}
