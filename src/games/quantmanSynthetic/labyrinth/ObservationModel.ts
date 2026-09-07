import { TUNING } from "../config";
import { RoomGraph } from "./RoomGraph";
import {
  DIRECTION_VECTORS,
  type DirectionName,
  type EdgeConstraint,
} from "./types";

export function observedEdgeIndices(
  graph: RoomGraph,
  roomIndex: number,
  facing: DirectionName,
  rangeRooms = TUNING.observationRangeRooms,
  coneWidthDoubled = TUNING.observationConeWidthDoubled,
): readonly number[] {
  const room = graph.coordinate(roomIndex);
  const originX = room.col * 2;
  const originY = room.row * 2;
  const vector = DIRECTION_VECTORS[facing];
  return Object.freeze(
    graph.edges
      .filter((edge) => {
        const dx = edge.midpointDoubled.x - originX;
        const dy = edge.midpointDoubled.y - originY;
        const forward = dx * vector.col + dy * vector.row;
        const lateral = Math.abs(dx * vector.row - dy * vector.col);
        return (
          forward > 0 &&
          forward <= rangeRooms * 2 &&
          lateral <= coneWidthDoubled
        );
      })
      .map((edge) => edge.index),
  );
}

export function focusedEdgeIndex(
  graph: RoomGraph,
  roomIndex: number,
  facing: DirectionName,
  excludedEdgeIndex: number | null = null,
): number | null {
  let cursor = roomIndex;
  for (
    let distance = 0;
    distance < TUNING.observationRangeRooms;
    distance += 1
  ) {
    const neighbour = graph.neighbour(cursor, facing);
    if (neighbour === null) return null;
    const edge = graph.edgeBetween(cursor, neighbour);
    if (!edge) return null;
    if (edge.index !== excludedEdgeIndex) return edge.index;
    cursor = neighbour;
  }
  return null;
}

export function observedConstraints(
  wallMask: string,
  edgeIndices: readonly number[],
): readonly EdgeConstraint[] {
  return Object.freeze(
    edgeIndices.map((edgeIndex) => {
      const value = wallMask[edgeIndex];
      if (value !== "0" && value !== "1")
        throw new Error(
          `Observed edge ${edgeIndex} is outside the topology mask.`,
        );
      return Object.freeze({ edgeIndex, wall: value === "1" });
    }),
  );
}
