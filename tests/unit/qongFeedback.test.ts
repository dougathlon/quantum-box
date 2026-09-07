import { describe, expect, it } from "vitest";

import { createRunContext } from "../../src/core/run";
import {
  createQongFeedbackCursor,
  qongFeedbackFrame,
  routeQongFeedback,
  type QongFeedbackCursor,
  type QongFeedbackEvent,
  type QongFeedbackFrame,
} from "../../src/games/qong/QongFeedback";
import { QongSession } from "../../src/games/qong/QongSession";
import { QONG_RULES_VERSION } from "../../src/games/qong/types";

describe("Qong public feedback routing", () => {
  it("distinguishes paddle and wall reversals without geometry constants", () => {
    let cursor = createQongFeedbackCursor(frame(100, 100));
    let route = routeQongFeedback(cursor, frame(90, 95));
    cursor = route.cursor;
    expect(route.events).toEqual([]);

    route = routeQongFeedback(cursor, frame(92, 90));
    cursor = route.cursor;
    expect(route.events).toEqual(["paddle-contact"]);

    route = routeQongFeedback(cursor, frame(94, 93));
    expect(route.events).toEqual(["wall-contact"]);
  });

  it("treats a two-axis reversal as one angled paddle contact", () => {
    let cursor = createQongFeedbackCursor(frame(100, 100));
    let route = routeQongFeedback(cursor, frame(90, 95));
    cursor = route.cursor;

    route = routeQongFeedback(cursor, frame(92, 101));

    expect(route.events).toEqual(["paddle-contact"]);
  });

  it("announces measurement and resolution once without exposing the rule", () => {
    let cursor = createQongFeedbackCursor(frame(100, 100));
    const measuring = frame(98, 99, {
      measurementState: "measuring",
    });
    let route = routeQongFeedback(cursor, measuring);
    cursor = route.cursor;
    expect(route.events).toEqual(["measurement-start"]);

    route = routeQongFeedback(cursor, measuring);
    cursor = route.cursor;
    expect(route.events).toEqual([]);

    const resolved = frame(98, 99, {
      measurementState: "resolved",
      goalResolved: true,
      phase: "between-rallies",
    });
    route = routeQongFeedback(cursor, resolved);
    cursor = route.cursor;
    expect(route.events).toEqual(["goal-resolution"]);
    expect(routeQongFeedback(cursor, resolved).events).toEqual([]);
    expect(JSON.stringify(route.events)).not.toMatch(
      /direct|invert|opposite|own|polarity|winner|provider/i,
    );
  });

  it("does not mistake a new-rally reset for a contact", () => {
    let cursor = createQongFeedbackCursor(frame(610, 200));
    let route = routeQongFeedback(
      cursor,
      frame(615, 205, { phase: "between-rallies" }),
    );
    cursor = route.cursor;
    route = routeQongFeedback(cursor, frame(320, 186, { rallyNumber: 2 }));
    cursor = route.cursor;
    route = routeQongFeedback(cursor, frame(317, 184, { rallyNumber: 2 }));
    expect(route.events).toEqual([]);
  });

  it("routes an actual deterministic session trace identically on replay", () => {
    const trace = qongTrace();
    const live = routeTrace(trace);
    const replay = routeTrace(trace);

    expect(replay).toEqual(live);
    expect(live).toContain("paddle-contact");
    expect(live).toContain("wall-contact");
    expect(live).toContain("measurement-start");
    expect(live).toContain("goal-resolution");
  });
});

function routeTrace(
  frames: readonly QongFeedbackFrame[],
): readonly QongFeedbackEvent[] {
  let cursor: QongFeedbackCursor = createQongFeedbackCursor(frames[0]!);
  const events: QongFeedbackEvent[] = [];
  for (const current of frames.slice(1)) {
    const route = routeQongFeedback(cursor, current);
    cursor = route.cursor;
    events.push(...route.events);
  }
  return events;
}

function qongTrace(): readonly QongFeedbackFrame[] {
  const session = new QongSession(
    createRunContext({
      gameId: "qong",
      playMode: "arcade",
      rulesVersion: QONG_RULES_VERSION,
      runSeed: 41,
      pack: {
        packId: "qong-feedback-test",
        contentSha256: "f".repeat(64),
        schemaVersion: "quantum-box-pack-v1",
        source: "synthetic-control",
      },
    }),
    { directProbability: 1 },
    "local",
  );
  const frames = [qongFeedbackFrame(session.snapshot())];
  let observed = false;
  for (let tick = 0; tick < 2_400; tick += 1) {
    const snapshot = session.snapshot();
    const avoidLeft = snapshot.ball.y < snapshot.leftPaddleY ? 1 : -1;
    const avoidRight = snapshot.ball.y < snapshot.rightPaddleY ? 1 : -1;
    const next = session.step({
      leftAxis: tick < 500 ? 0 : avoidLeft,
      rightAxis: tick < 500 ? 0 : avoidRight,
      observePressed: !observed && tick === 450,
    });
    observed ||= tick === 450;
    frames.push(qongFeedbackFrame(next));
    if (next.rallyReveal) break;
  }
  return frames;
}

function frame(
  x: number,
  y: number,
  overrides: Partial<QongFeedbackFrame> = {},
): QongFeedbackFrame {
  return Object.freeze({
    phase: overrides.phase ?? "active",
    rallyNumber: overrides.rallyNumber ?? 1,
    measurementState: overrides.measurementState ?? "unresolved",
    ball: Object.freeze({ x, y }),
    goalResolved: overrides.goalResolved ?? false,
  });
}
