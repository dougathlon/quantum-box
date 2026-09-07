import { RoomGraph } from "../labyrinth/RoomGraph";
import type { DirectionName } from "../labyrinth/types";
import { traversableNeighbours, traversalDirection } from "./MazeTraversal";
import type { GhostRole } from "./types";

export interface GhostPublicObservation {
  readonly ownRoom: number;
  readonly playerRoom: number;
  readonly playerFacing: DirectionName;
  readonly currentWallMask: string;
  readonly activeTick: number;
  readonly frightened: boolean;
}

export interface GhostDecision {
  readonly targetRoom: number;
  readonly nextRoom: number;
  readonly edgeIndex: number | null;
  readonly edgeWasOpen: boolean;
}

export function decideGhostStep(
  graph: RoomGraph,
  role: GhostRole,
  ghostIndex: number,
  observation: GhostPublicObservation,
): GhostDecision {
  const targetRoom = ghostTarget(graph, role, ghostIndex, observation);
  const pathStep = firstOpenPathStep(
    graph,
    observation.currentWallMask,
    observation.ownRoom,
    targetRoom,
  );
  const legal = traversableNeighbours(
    graph,
    observation.currentWallMask,
    observation.ownRoom,
  );
  const nextRoom =
    pathStep ??
    deterministicFallback(
      legal,
      observation.activeTick,
      ghostIndex,
      observation.ownRoom,
    );
  const edge =
    nextRoom === observation.ownRoom
      ? null
      : graph.edgeBetween(observation.ownRoom, nextRoom);
  return Object.freeze({
    targetRoom,
    nextRoom,
    edgeIndex: edge?.index ?? null,
    edgeWasOpen:
      edge === null || !graph.isWall(observation.currentWallMask, edge.index),
  });
}

export function firstOpenPathStep(
  graph: RoomGraph,
  wallMask: string,
  start: number,
  target: number,
): number | null {
  if (start === target) return start;
  const queue = [start];
  const previous = new Map<number, number | null>([[start, null]]);
  while (queue.length > 0) {
    const room = queue.shift();
    if (room === undefined) break;
    for (const next of traversableNeighbours(graph, wallMask, room)) {
      if (previous.has(next)) continue;
      previous.set(next, room);
      if (next === target) {
        let cursor = target;
        let parent = previous.get(cursor);
        while (parent !== null && parent !== undefined && parent !== start) {
          cursor = parent;
          parent = previous.get(cursor);
        }
        return cursor;
      }
      queue.push(next);
    }
  }
  return null;
}

export function reachableRooms(
  graph: RoomGraph,
  wallMask: string,
  start: number,
): ReadonlySet<number> {
  const reached = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const room = queue.shift();
    if (room === undefined) break;
    for (const next of traversableNeighbours(graph, wallMask, room)) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

function ghostTarget(
  graph: RoomGraph,
  role: GhostRole,
  ghostIndex: number,
  observation: GhostPublicObservation,
): number {
  if (observation.frightened) {
    const player = graph.coordinate(observation.playerRoom);
    const corners = [
      0,
      graph.width - 1,
      graph.roomCount - 1,
      graph.roomCount - graph.width,
    ];
    return corners
      .map((room) => ({
        room,
        distance: manhattan(graph.coordinate(room), player),
      }))
      .sort(
        (left, right) =>
          right.distance - left.distance || left.room - right.room,
      )[0]!.room;
  }
  if (role === "direct") return observation.playerRoom;
  if (role === "ambush")
    return project(graph, observation.playerRoom, observation.playerFacing, 2);
  if (role === "flank") {
    const flank: DirectionName =
      observation.playerFacing === "up"
        ? "right"
        : observation.playerFacing === "right"
          ? "down"
          : observation.playerFacing === "down"
            ? "left"
            : "up";
    return project(
      graph,
      project(graph, observation.playerRoom, observation.playerFacing, 1),
      flank,
      2,
    );
  }
  const own = graph.coordinate(observation.ownRoom);
  const player = graph.coordinate(observation.playerRoom);
  if (manhattan(own, player) > 5) return observation.playerRoom;
  return (
    [0, graph.width - 1, graph.roomCount - 1, graph.roomCount - graph.width][
      ghostIndex
    ] ?? 0
  );
}

function project(
  graph: RoomGraph,
  start: number,
  direction: DirectionName,
  distance: number,
): number {
  let room = start;
  for (let step = 0; step < distance; step += 1) {
    const next = graph.neighbour(room, direction);
    if (next === null) break;
    room = next;
  }
  return room;
}

function deterministicFallback(
  legal: readonly number[],
  activeTick: number,
  ghostIndex: number,
  ownRoom: number,
): number {
  if (legal.length === 0) return ownRoom;
  const ordered = [...legal].sort((left, right) => left - right);
  return (
    ordered[(Math.floor(activeTick / 12) + ghostIndex) % ordered.length] ??
    ownRoom
  );
}

function manhattan(
  left: Readonly<{ row: number; col: number }>,
  right: Readonly<{ row: number; col: number }>,
): number {
  return Math.abs(left.row - right.row) + Math.abs(left.col - right.col);
}

export function directionBetween(
  graph: RoomGraph,
  from: number,
  to: number,
): DirectionName | null {
  return traversalDirection(graph, from, to);
}
