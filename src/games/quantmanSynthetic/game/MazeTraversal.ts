import { RoomGraph } from "../labyrinth/RoomGraph";
import { DIRECTION_VECTORS, type DirectionName } from "../labyrinth/types";

export const GHOST_HOME_ROOMS = Object.freeze([44, 45, 54, 55] as const);
export const GHOST_HOME_EXIT_ROOM = 35;
export const TUNNEL_ROW = 5;

const GHOST_HOME_SET: ReadonlySet<number> = new Set(GHOST_HOME_ROOMS);

export function isGhostHomeRoom(room: number): boolean {
  return GHOST_HOME_SET.has(room);
}

export function edgeTouchesGhostHome(
  graph: RoomGraph,
  edgeIndex: number,
): boolean {
  const edge = graph.edges[edgeIndex];
  if (!edge) throw new Error(`Unknown edge ${edgeIndex}.`);
  return isGhostHomeRoom(edge.a) || isGhostHomeRoom(edge.b);
}

export function tunnelDestination(
  graph: RoomGraph,
  room: number,
  direction: DirectionName,
): number | null {
  const coordinate = graph.coordinate(room);
  if (coordinate.row !== TUNNEL_ROW) return null;
  if (coordinate.col === 0 && direction === "left")
    return graph.index({ row: TUNNEL_ROW, col: graph.width - 1 });
  if (coordinate.col === graph.width - 1 && direction === "right")
    return graph.index({ row: TUNNEL_ROW, col: 0 });
  return null;
}

export function traversableNeighbours(
  graph: RoomGraph,
  wallMask: string,
  room: number,
): readonly number[] {
  return Object.freeze(
    (Object.keys(DIRECTION_VECTORS) as DirectionName[])
      .map((direction) => {
        const adjacent = graph.neighbour(room, direction);
        if (adjacent === null) return tunnelDestination(graph, room, direction);
        if (isGhostHomeRoom(adjacent)) return null;
        const edge = graph.edgeBetween(room, adjacent);
        return edge && !graph.isWall(wallMask, edge.index) ? adjacent : null;
      })
      .filter((candidate): candidate is number => candidate !== null),
  );
}

export function traversalDirection(
  graph: RoomGraph,
  from: number,
  to: number,
): DirectionName | null {
  for (const direction of Object.keys(DIRECTION_VECTORS) as DirectionName[]) {
    if (
      graph.neighbour(from, direction) === to ||
      tunnelDestination(graph, from, direction) === to
    )
      return direction;
  }
  return null;
}
