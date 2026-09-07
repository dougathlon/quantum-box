import type { QongMeasurementState, QongPhase, QongSnapshot } from "./types";

export type QongFeedbackEvent =
  | "paddle-contact"
  | "wall-contact"
  | "measurement-start"
  | "goal-resolution";

export interface QongFeedbackFrame {
  readonly phase: QongPhase;
  readonly rallyNumber: number;
  readonly measurementState: QongMeasurementState;
  readonly ball: Readonly<{ x: number; y: number }>;
  readonly goalResolved: boolean;
}

export interface QongFeedbackCursor {
  readonly earlier: QongFeedbackFrame | null;
  readonly previous: QongFeedbackFrame;
}

export interface QongFeedbackRoute {
  readonly cursor: QongFeedbackCursor;
  readonly events: readonly QongFeedbackEvent[];
}

export function qongFeedbackFrame(snapshot: QongSnapshot): QongFeedbackFrame {
  return Object.freeze({
    phase: snapshot.phase,
    rallyNumber: snapshot.rallyNumber,
    measurementState: snapshot.measurementState,
    ball: Object.freeze({ x: snapshot.ball.x, y: snapshot.ball.y }),
    goalResolved: snapshot.rallyReveal !== null,
  });
}

export function createQongFeedbackCursor(
  initial: QongFeedbackFrame,
): QongFeedbackCursor {
  return Object.freeze({ earlier: null, previous: initial });
}

/**
 * Routes only information already visible in the public Qong snapshot. Contact
 * direction changes are observed one fixed tick after the physical collision;
 * no polarity, provider record, or CPU-private state enters this contract.
 */
export function routeQongFeedback(
  cursor: QongFeedbackCursor,
  current: QongFeedbackFrame,
): QongFeedbackRoute {
  const events: QongFeedbackEvent[] = [];
  const previous = cursor.previous;
  const earlier = cursor.earlier;

  if (earlier && framesShareActiveRally(earlier, previous, current)) {
    const previousDx = previous.ball.x - earlier.ball.x;
    const currentDx = current.ball.x - previous.ball.x;
    const previousDy = previous.ball.y - earlier.ball.y;
    const currentDy = current.ball.y - previous.ball.y;
    if (reversed(previousDx, currentDx)) {
      events.push("paddle-contact");
    } else if (reversed(previousDy, currentDy)) {
      // An angled paddle deflection may reverse both axes. The horizontal
      // reversal identifies that contact; do not double-report a wall strike.
      events.push("wall-contact");
    }
  }

  if (
    previous.measurementState !== "measuring" &&
    current.measurementState === "measuring"
  ) {
    events.push("measurement-start");
  }
  if (!previous.goalResolved && current.goalResolved) {
    events.push("goal-resolution");
  }

  return Object.freeze({
    cursor: Object.freeze({ earlier: previous, previous: current }),
    events: Object.freeze(events),
  });
}

function framesShareActiveRally(
  earlier: QongFeedbackFrame,
  previous: QongFeedbackFrame,
  current: QongFeedbackFrame,
): boolean {
  return (
    earlier.phase === "active" &&
    previous.phase === "active" &&
    current.phase === "active" &&
    earlier.rallyNumber === previous.rallyNumber &&
    previous.rallyNumber === current.rallyNumber
  );
}

function reversed(previousDelta: number, currentDelta: number): boolean {
  return (
    previousDelta !== 0 &&
    currentDelta !== 0 &&
    Math.sign(previousDelta) !== Math.sign(currentDelta)
  );
}
