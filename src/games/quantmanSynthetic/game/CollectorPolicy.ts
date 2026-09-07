import { TUNING } from "../config";
import { RoomGraph } from "../labyrinth/RoomGraph";
import type { DirectionName } from "../labyrinth/types";
import { directionBetween } from "./GhostPolicy";
import { traversableNeighbours } from "./MazeTraversal";
import type { SemanticInput, SessionSnapshot } from "./types";

const FACINGS: readonly DirectionName[] = Object.freeze([
  "up",
  "right",
  "down",
  "left",
]);

export function collectorInput(
  graph: RoomGraph,
  snapshot: SessionSnapshot,
): SemanticInput {
  if (snapshot.phase === "ready")
    return Object.freeze({ direction: null, start: true });
  if (snapshot.phase !== "active")
    return Object.freeze({ direction: null, start: false });
  if (snapshot.player.nextRoom !== null) {
    return Object.freeze({
      direction: snapshot.player.movementDirection,
      start: false,
    });
  }
  const remaining = new Set<number>();
  for (let room = 0; room < graph.roomCount; room += 1) {
    if (!snapshot.collectedRooms.includes(room)) remaining.add(room);
  }
  const openStep = firstStepToNearest(
    graph,
    snapshot.topologyWallMask,
    snapshot.player.room,
    remaining,
  );
  if (openStep !== null) {
    return Object.freeze({
      direction: directionBetween(graph, snapshot.player.room, openStep),
      start: false,
    });
  }
  const target = [...remaining]
    .map((room) => ({
      room,
      distance: manhattan(graph, snapshot.player.room, room),
    }))
    .sort(
      (left, right) => left.distance - right.distance || left.room - right.room,
    )[0]?.room;
  if (target !== undefined && snapshot.wallPassTicks > 0) {
    return Object.freeze({
      direction: directionToward(graph, snapshot.player.room, target),
      start: false,
    });
  }
  const facing =
    FACINGS[
      Math.floor(
        snapshot.activeTick /
          (snapshot.mechanic === "inverse-gaze"
            ? TUNING.topologyPeriodTicks * 2
            : TUNING.topologyPeriodTicks),
      ) % FACINGS.length
    ] ?? "right";
  return Object.freeze({ direction: facing, start: false });
}

export function firstStepToNearest(
  graph: RoomGraph,
  wallMask: string,
  start: number,
  targets: ReadonlySet<number>,
): number | null {
  const queue = [start];
  const previous = new Map<number, number | null>([[start, null]]);
  let found: number | null = targets.has(start) ? start : null;
  while (queue.length > 0 && found === null) {
    const room = queue.shift();
    if (room === undefined) break;
    for (const next of traversableNeighbours(graph, wallMask, room)) {
      if (previous.has(next)) continue;
      previous.set(next, room);
      if (targets.has(next)) {
        found = next;
        break;
      }
      queue.push(next);
    }
  }
  if (found === null || found === start) return null;
  let cursor = found;
  let parent = previous.get(cursor);
  while (parent !== null && parent !== undefined && parent !== start) {
    cursor = parent;
    parent = previous.get(cursor);
  }
  return cursor;
}

function directionToward(
  graph: RoomGraph,
  from: number,
  to: number,
): DirectionName {
  const source = graph.coordinate(from);
  const target = graph.coordinate(to);
  if (Math.abs(target.col - source.col) >= Math.abs(target.row - source.row)) {
    if (target.col !== source.col)
      return target.col < source.col ? "left" : "right";
  }
  return target.row < source.row ? "up" : "down";
}

function manhattan(graph: RoomGraph, left: number, right: number): number {
  const a = graph.coordinate(left);
  const b = graph.coordinate(right);
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}
