import { quagArenaById } from "./QuagArena";
import {
  QUAG_SUBPIXELS,
  type QuagInput,
  type QuagPlayerControl,
  type QuagPlayerId,
  type QuagPlayerSnapshot,
  type QuagSnapshot,
} from "./types";

export type QuagFeedbackEvent =
  | Readonly<{
      type: "flap" | "land" | "wrap";
      tick: number;
      playerId: QuagPlayerId;
    }>
  | Readonly<{
      type: "capture" | "graph-shift";
      eventId: number;
      tick: number;
      playerIds: readonly QuagPlayerSnapshot["id"][];
    }>;

export interface QuagFeedbackCursor {
  readonly lastEventId: number;
  readonly lastTick: number;
  readonly phase: QuagSnapshot["phase"];
  readonly players: Readonly<
    Record<
      QuagPlayerId,
      Readonly<{
        grounded: boolean;
        flapCooldownTicks: number;
      }>
    >
  >;
}

export interface QuagFeedbackRoute {
  readonly cursor: QuagFeedbackCursor;
  readonly events: readonly QuagFeedbackEvent[];
}

export type QuagCompletionCue =
  | "quag-match-win"
  | "quag-match-draw"
  | "quag-match-loss";

export function quagCompletionCue(
  snapshot: Pick<QuagSnapshot, "winnerIds" | "humanPlayerIds">,
): QuagCompletionCue {
  if (snapshot.winnerIds.length !== 1) return "quag-match-draw";
  return snapshot.humanPlayerIds.includes(snapshot.winnerIds[0]!)
    ? "quag-match-win"
    : "quag-match-loss";
}

export function createQuagFeedbackCursor(
  initial: QuagSnapshot,
): QuagFeedbackCursor {
  return Object.freeze({
    lastEventId: 0,
    lastTick: initial.tick,
    phase: initial.phase,
    players: feedbackPlayerStates(initial),
  });
}

/**
 * Routes public, presentation-only feedback without adding events to Quag's
 * authoritative simulation or replay state. Local-human movement is sonified;
 * capture and graph changes come from the existing public event log.
 */
export function routeQuagFeedback(
  cursor: QuagFeedbackCursor,
  snapshot: QuagSnapshot,
  input: QuagInput,
): QuagFeedbackRoute {
  const events: QuagFeedbackEvent[] = [];
  const newStep = snapshot.tick > cursor.lastTick;
  let lastEventId = cursor.lastEventId;

  const publicEvents = snapshot.eventsThisTick.filter((event) => {
    if (event.eventId <= cursor.lastEventId) return false;
    lastEventId = Math.max(lastEventId, event.eventId);
    return event.type === "CAPTURE" || event.type === "GRAPH_SHIFT";
  });

  for (const event of publicEvents) {
    if (event.type !== "GRAPH_SHIFT") continue;
    events.push(
      Object.freeze({
        type: "graph-shift",
        eventId: event.eventId,
        tick: event.tick,
        playerIds: Object.freeze([...event.playerIds]),
      }),
    );
  }

  if (newStep && cursor.phase === "active") {
    const arena = quagArenaById(snapshot.arenaId);
    const wrapThreshold = ((arena.right - arena.left) * QUAG_SUBPIXELS) / 2;
    for (const playerId of snapshot.humanPlayerIds) {
      const current = player(snapshot, playerId);
      const previous = cursor.players[playerId];
      const control = inputForPlayer(input, playerId);
      if (
        control.flapPressed &&
        current.flapCooldownTicks > previous.flapCooldownTicks
      ) {
        events.push(movementEvent("flap", snapshot.tick, playerId));
      }
      if (!previous.grounded && current.grounded) {
        events.push(movementEvent("land", snapshot.tick, playerId));
      }
      if (
        Math.abs(current.xSubpixels - current.previousXSubpixels) >
        wrapThreshold
      ) {
        events.push(movementEvent("wrap", snapshot.tick, playerId));
      }
    }
  }

  for (const event of publicEvents) {
    if (event.type !== "CAPTURE") continue;
    events.push(
      Object.freeze({
        type: "capture",
        eventId: event.eventId,
        tick: event.tick,
        playerIds: Object.freeze([...event.playerIds]),
      }),
    );
  }

  return Object.freeze({
    cursor: Object.freeze({
      lastEventId,
      lastTick: snapshot.tick,
      phase: snapshot.phase,
      players: feedbackPlayerStates(snapshot),
    }),
    events: Object.freeze(events),
  });
}

function player(
  snapshot: QuagSnapshot,
  playerId: QuagPlayerId,
): QuagPlayerSnapshot {
  const result = snapshot.players.find(
    (candidate) => candidate.id === playerId,
  );
  if (!result)
    throw new Error(`Quarry public snapshot has no Player ${playerId}.`);
  return result;
}

function movementEvent(
  type: "flap" | "land" | "wrap",
  tick: number,
  playerId: QuagPlayerId,
): QuagFeedbackEvent {
  return Object.freeze({ type, tick, playerId });
}

function feedbackPlayerStates(
  snapshot: QuagSnapshot,
): QuagFeedbackCursor["players"] {
  return Object.freeze(
    Object.fromEntries(
      snapshot.players.map((candidate) => [
        candidate.id,
        Object.freeze({
          grounded: candidate.grounded,
          flapCooldownTicks: candidate.flapCooldownTicks,
        }),
      ]),
    ) as Record<
      QuagPlayerId,
      Readonly<{ grounded: boolean; flapCooldownTicks: number }>
    >,
  );
}

function inputForPlayer(
  input: QuagInput,
  playerId: QuagPlayerId,
): QuagPlayerControl {
  return (
    input.players?.[playerId] ??
    (playerId === "A"
      ? Object.freeze({
          horizontal: input.horizontal,
          flapPressed: input.flapPressed,
        })
      : NEUTRAL_CONTROL)
  );
}

const NEUTRAL_CONTROL: QuagPlayerControl = Object.freeze({
  horizontal: 0,
  flapPressed: false,
});
