import { describe, expect, it } from "vitest";

import {
  createFluxballFeedbackCursor,
  routeFluxballFeedback,
  type FluxballFeedbackEvent,
  type FluxballFeedbackFrame,
} from "../../src/games/fluxball/FluxballFeedback";
import type { PlayerId } from "../../src/games/fluxball/standalone/modes";

describe("Fluxball public audio feedback routing", () => {
  it("routes every fixed-step contact once, including catch-up steps", () => {
    const frames = [
      frame({
        contact: contact(1, "possession", 1),
      }),
      frame({
        contact: contact(1, "possession", 1),
      }),
      frame({
        contact: contact(2, "steal", 4),
      }),
      frame({
        contact: contact(3, "strike", 5),
      }),
      frame({
        contact: contact(3, "strike", 5),
      }),
    ];

    expect(routeSequence(frames)).toEqual([
      expect.objectContaining({
        type: "contact",
        eventId: 1,
        consequence: "possession",
      }),
      expect.objectContaining({
        type: "contact",
        eventId: 2,
        consequence: "steal",
      }),
      expect.objectContaining({
        type: "contact",
        eventId: 3,
        consequence: "strike",
      }),
    ]);
  });

  it("distinguishes scored and unawarded physical goals", () => {
    expect(
      routeSequence([
        frame({ goal: goal(1, ["A"], 8) }),
        frame({ goal: goal(2, [], 12) }),
      ]),
    ).toEqual([
      expect.objectContaining({
        type: "goal",
        eventId: 1,
        outcome: "scored",
        awardedPlayerIds: ["A"],
      }),
      expect.objectContaining({
        type: "goal",
        eventId: 2,
        outcome: "unawarded",
        awardedPlayerIds: [],
      }),
    ]);
  });

  it("keeps rule shift and round-end feedback distinct and ordered", () => {
    const routed = routeSequence([
      frame({
        phase: "reveal",
        ruleChanges: [ruleChange(7, 799, "B")],
        roundWinnerIds: ["A"],
      }),
    ]);

    expect(routed).toEqual([
      {
        type: "rule-shift",
        eventId: 7,
        roundNumber: 1,
        tick: 799,
        playerId: "B",
      },
      {
        type: "round-end",
        roundNumber: 1,
        outcome: "winner",
        winnerId: "A",
      },
    ]);
  });

  it("reports a round draw and never repeats it on a retained frame", () => {
    const ended = frame({ phase: "reveal", roundWinnerIds: [] });
    let cursor = createFluxballFeedbackCursor();
    const first = routeFluxballFeedback(cursor, ended);
    cursor = first.cursor;
    const repeated = routeFluxballFeedback(cursor, ended);

    expect(first.events).toEqual([
      {
        type: "round-end",
        roundNumber: 1,
        outcome: "draw",
        winnerId: null,
      },
    ]);
    expect(repeated.events).toEqual([]);
  });

  it("replays the same public frames into the same feedback sequence", () => {
    const frames = [
      frame({ contact: contact(1, "dislodge", 3) }),
      frame({ ruleChanges: [ruleChange(1, 4, "A")] }),
      frame({ goal: goal(2, ["A", "B"], 11) }),
      frame({ phase: "reveal", roundWinnerIds: ["B"] }),
    ];

    const live = routeSequence(frames);
    const replay = routeSequence(frames);

    expect(replay).toEqual(live);
    expect(JSON.stringify(live)).not.toMatch(
      /rules|trace|fixture|provider|qgraph|interactionRule/i,
    );
  });

  it("routes all unseen public rule changes without revealing their states", () => {
    const routed = routeSequence([
      frame({
        ruleChanges: [ruleChange(1, 4, "A"), ruleChange(2, 5, "B")],
      }),
    ]);

    expect(routed).toEqual([
      expect.objectContaining({
        type: "rule-shift",
        eventId: 1,
        playerId: "A",
      }),
      expect.objectContaining({
        type: "rule-shift",
        eventId: 2,
        playerId: "B",
      }),
    ]);
  });
});

function routeSequence(
  frames: readonly FluxballFeedbackFrame[],
): readonly FluxballFeedbackEvent[] {
  let cursor = createFluxballFeedbackCursor();
  const events: FluxballFeedbackEvent[] = [];
  for (const current of frames) {
    const routed = routeFluxballFeedback(cursor, current);
    cursor = routed.cursor;
    events.push(...routed.events);
  }
  return events;
}

function frame({
  phase = "active",
  contact: latestContact = null,
  goal: latestGoal = null,
  ruleChanges = [],
  roundWinnerIds = [],
}: Readonly<{
  phase?: FluxballFeedbackFrame["phase"];
  contact?: NonNullable<FluxballFeedbackFrame["sport"]>["latestContact"];
  goal?: NonNullable<FluxballFeedbackFrame["sport"]>["latestGoal"];
  ruleChanges?: FluxballFeedbackFrame["publicRuleChangeEvents"];
  roundWinnerIds?: readonly PlayerId[];
}> = {}): FluxballFeedbackFrame {
  return Object.freeze({
    phase,
    roundNumber: 1,
    sport: Object.freeze({ latestContact, latestGoal }),
    publicRuleChangeEvents: Object.freeze([...ruleChanges]),
    reveal:
      phase === "reveal"
        ? Object.freeze({ roundWinnerIds: Object.freeze([...roundWinnerIds]) })
        : null,
  });
}

function contact(
  eventId: number,
  consequence: "possession" | "steal" | "strike" | "dislodge",
  tick: number,
): NonNullable<FluxballFeedbackFrame["sport"]>["latestContact"] {
  return Object.freeze({
    eventId,
    roundNumber: 1,
    tick,
    ruleStateIndex: 0,
    playerId: "A",
    previousCarrierId: null,
    consequence,
  });
}

function goal(
  eventId: number,
  awardedPlayerIds: readonly PlayerId[],
  tick: number,
): NonNullable<FluxballFeedbackFrame["sport"]>["latestGoal"] {
  return Object.freeze({
    eventId,
    roundNumber: 1,
    tick,
    ruleStateIndex: 0,
    physicalGoal: "B",
    awardedPlayerIds: Object.freeze([...awardedPlayerIds]),
    scoreAfter: Object.freeze({ A: 0, B: 0 }),
  });
}

function ruleChange(
  eventId: number,
  tick: number,
  playerId: PlayerId,
): FluxballFeedbackFrame["publicRuleChangeEvents"][number] {
  return Object.freeze({
    eventId,
    roundNumber: 1,
    tick,
    playerId,
  });
}
