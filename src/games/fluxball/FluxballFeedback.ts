import type { PlayerId } from "./standalone/modes";
import type {
  FluxballPhase,
  FluxballPublicContact,
  FluxballPublicGoal,
  FluxballPublicRuleChangeEvent,
} from "./types";

export type FluxballFeedbackEvent =
  | Readonly<{
      type: "contact";
      eventId: number;
      roundNumber: number;
      tick: number;
      playerId: PlayerId;
      consequence: FluxballPublicContact["consequence"];
    }>
  | Readonly<{
      type: "goal";
      eventId: number;
      roundNumber: number;
      tick: number;
      outcome: "scored" | "unawarded";
      awardedPlayerIds: readonly PlayerId[];
    }>
  | Readonly<{
      type: "rule-shift";
      eventId: number;
      roundNumber: number;
      tick: number;
      playerId: PlayerId;
    }>
  | Readonly<{
      type: "round-end";
      roundNumber: number;
      outcome: "winner" | "draw";
      winnerId: PlayerId | null;
    }>;

/**
 * This is deliberately narrower than FluxballSnapshot. Audio may react only to
 * consequences already exposed through play, never to hidden player rules,
 * QGraph traces, provider records, or CPU beliefs.
 */
export interface FluxballFeedbackFrame {
  readonly phase: FluxballPhase;
  readonly roundNumber: number;
  readonly sport: Readonly<{
    readonly latestContact: FluxballPublicContact | null;
    readonly latestGoal: FluxballPublicGoal | null;
  }> | null;
  readonly publicRuleChangeEvents: readonly FluxballPublicRuleChangeEvent[];
  readonly reveal: Readonly<{
    readonly roundWinnerIds: readonly PlayerId[];
  }> | null;
}

export interface FluxballFeedbackCursor {
  readonly previousPhase: FluxballPhase;
  readonly lastContactKey: string;
  readonly lastGoalKey: string;
  readonly lastRuleChangeKey: string;
}

export interface FluxballFeedbackRoute {
  readonly cursor: FluxballFeedbackCursor;
  readonly events: readonly FluxballFeedbackEvent[];
}

export function createFluxballFeedbackCursor(): FluxballFeedbackCursor {
  return Object.freeze({
    previousPhase: "active",
    lastContactKey: "",
    lastGoalKey: "",
    lastRuleChangeKey: "",
  });
}

export function routeFluxballFeedback(
  previous: FluxballFeedbackCursor,
  frame: FluxballFeedbackFrame,
): FluxballFeedbackRoute {
  const events: FluxballFeedbackEvent[] = [];
  let lastContactKey = previous.lastContactKey;
  let lastGoalKey = previous.lastGoalKey;
  let lastRuleChangeKey = previous.lastRuleChangeKey;

  const unseenRuleChanges = unseenRuleChangeEvents(
    frame.publicRuleChangeEvents,
    lastRuleChangeKey,
  );
  for (const event of unseenRuleChanges) {
    events.push(
      Object.freeze({
        type: "rule-shift",
        eventId: event.eventId,
        roundNumber: event.roundNumber,
        tick: event.tick,
        playerId: event.playerId,
      }),
    );
    lastRuleChangeKey = eventKey(event);
  }

  const contact = frame.sport?.latestContact;
  const contactKey = contact ? eventKey(contact) : "";
  if (contact && contactKey !== lastContactKey) {
    lastContactKey = contactKey;
    events.push(
      Object.freeze({
        type: "contact",
        eventId: contact.eventId,
        roundNumber: contact.roundNumber,
        tick: contact.tick,
        playerId: contact.playerId,
        consequence: contact.consequence,
      }),
    );
  }

  const goal = frame.sport?.latestGoal;
  const goalKey = goal ? eventKey(goal) : "";
  if (goal && goalKey !== lastGoalKey) {
    lastGoalKey = goalKey;
    const awardedPlayerIds = Object.freeze([...goal.awardedPlayerIds]);
    events.push(
      Object.freeze({
        type: "goal",
        eventId: goal.eventId,
        roundNumber: goal.roundNumber,
        tick: goal.tick,
        outcome: awardedPlayerIds.length > 0 ? "scored" : "unawarded",
        awardedPlayerIds,
      }),
    );
  }

  if (frame.phase === "reveal" && previous.previousPhase === "active") {
    const winnerId = frame.reveal?.roundWinnerIds[0] ?? null;
    events.push(
      Object.freeze({
        type: "round-end",
        roundNumber: frame.roundNumber,
        outcome: winnerId ? "winner" : "draw",
        winnerId,
      }),
    );
  }

  return Object.freeze({
    cursor: Object.freeze({
      previousPhase: frame.phase,
      lastContactKey,
      lastGoalKey,
      lastRuleChangeKey,
    }),
    events: Object.freeze(events),
  });
}

function unseenRuleChangeEvents(
  events: readonly FluxballPublicRuleChangeEvent[],
  lastKey: string,
): readonly FluxballPublicRuleChangeEvent[] {
  if (events.length === 0) return [];
  const previousIndex = events.findIndex(
    (event) => eventKey(event) === lastKey,
  );
  return previousIndex < 0 ? events : events.slice(previousIndex + 1);
}

function eventKey(event: {
  readonly roundNumber: number;
  readonly eventId: number;
}): string {
  return `${event.roundNumber}:${event.eventId}`;
}
