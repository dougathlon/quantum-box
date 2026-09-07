import { RoomGraph } from "./RoomGraph";
import type { LabyrinthAdmissibilityIndex, LabyrinthRawRecord } from "./types";

export const QUANTMAN_ADMISSIBILITY_SCHEMA =
  "quantman-admissibility-index-v1" as const;
export const QUANTMAN_ADMISSIBILITY_FILTER_ID =
  "quantman-demo-playability-v1" as const;

const PLAYER_START = 95;
const GHOST_RELEASE = 35;
const GHOST_HOME_ROOMS = Object.freeze([44, 45, 54, 55] as const);
const WALL_PASS_ROOMS = Object.freeze([0, 9, 90, 99] as const);
const MIN_PLAYER_COMPONENT = 12;
const MIN_GHOST_RELEASE_COMPONENT = 4;
const MAX_ISOLATED_PLAYABLE_ROOMS = 10;

export function deriveQuantmanAdmissibilityIndex(
  records: readonly LabyrinthRawRecord[],
  width: number,
  height: number,
): LabyrinthAdmissibilityIndex {
  if (width !== 10 || height !== 10) {
    throw new Error("Quantman admissibility requires a 10×10 fixture.");
  }
  const graph = new RoomGraph(width, height);
  const home = new Set<number>(GHOST_HOME_ROOMS);
  const playableRooms = Array.from(
    { length: graph.roomCount },
    (_, room) => room,
  ).filter((room) => !home.has(room));
  const playableEdges = graph.edges.filter(
    (edge) => !home.has(edge.a) && !home.has(edge.b),
  );
  const admittedRecordIndices: number[] = [];
  const admittedOpenEdges = new Set<number>();
  const edgeValues = playableEdges.map(() => new Set<0 | 1>());

  records.forEach((record, recordIndex) => {
    const openEdgeIndices = new Set(
      playableEdges
        .filter((edge) => record.bitstring[edge.a] === record.bitstring[edge.b])
        .map((edge) => edge.index),
    );
    const adjacency = adjacencyFor(
      playableRooms,
      playableEdges,
      openEdgeIndices,
    );
    const playerComponent = component(adjacency, PLAYER_START);
    const releaseComponent = component(adjacency, GHOST_RELEASE);
    const isolatedRoomCount = playableRooms.filter(
      (room) => adjacency.get(room)?.size === 0,
    ).length;
    if (
      playerComponent.size < MIN_PLAYER_COMPONENT ||
      !WALL_PASS_ROOMS.some((room) => playerComponent.has(room)) ||
      releaseComponent.size < MIN_GHOST_RELEASE_COMPONENT ||
      isolatedRoomCount > MAX_ISOLATED_PLAYABLE_ROOMS ||
      openEdgeIndices.size === 0 ||
      openEdgeIndices.size === playableEdges.length
    ) {
      return;
    }
    admittedRecordIndices.push(recordIndex);
    playableEdges.forEach((edge, playableEdgeIndex) => {
      const open = openEdgeIndices.has(edge.index);
      edgeValues[playableEdgeIndex]?.add(open ? 0 : 1);
      if (open) admittedOpenEdges.add(edge.index);
    });
  });

  const unionAdjacency = adjacencyFor(
    playableRooms,
    playableEdges,
    admittedOpenEdges,
  );
  const ensembleReachableRoomCount =
    admittedRecordIndices.length > 0
      ? component(unionAdjacency, PLAYER_START).size
      : 0;
  const ensembleVariableEdgeCount = edgeValues.filter(
    (values) => values.size === 2,
  ).length;
  const returnedWeight = records.reduce(
    (sum, record) => sum + record.weight,
    0,
  );
  const admittedWeight = admittedRecordIndices.reduce(
    (sum, index) => sum + (records[index]?.weight ?? 0),
    0,
  );
  const runtimeEligible =
    admittedRecordIndices.length > 0 &&
    ensembleReachableRoomCount === playableRooms.length &&
    ensembleVariableEdgeCount === playableEdges.length;

  return deepFreeze({
    schemaVersion: QUANTMAN_ADMISSIBILITY_SCHEMA,
    filterId: QUANTMAN_ADMISSIBILITY_FILTER_ID,
    runtimeEligible,
    criteria: {
      playerStartRoom: PLAYER_START,
      minimumPlayerComponentRooms: MIN_PLAYER_COMPONENT,
      wallPassRooms: WALL_PASS_ROOMS,
      ghostReleaseRoom: GHOST_RELEASE,
      minimumGhostReleaseComponentRooms: MIN_GHOST_RELEASE_COMPONENT,
      ghostHomeRooms: GHOST_HOME_ROOMS,
      maximumIsolatedPlayableRooms: MAX_ISOLATED_PLAYABLE_ROOMS,
      requireOpenAndClosedPlayableEdges: true,
      requireFullEnsembleRoomCoverage: true,
      requireEveryPlayableEdgeVariable: true,
    },
    admittedRecordIndices,
    summary: {
      returnedRecordCount: records.length,
      returnedWeight,
      admittedRecordCount: admittedRecordIndices.length,
      admittedWeight,
      excludedRecordCount: records.length - admittedRecordIndices.length,
      excludedWeight: returnedWeight - admittedWeight,
      playableRoomCount: playableRooms.length,
      playableEdgeCount: playableEdges.length,
      ensembleReachableRoomCount,
      ensembleVariableEdgeCount,
    },
  });
}

export function validateQuantmanAdmissibilityIndex(
  value: unknown,
  records: readonly LabyrinthRawRecord[],
  width: number,
  height: number,
): LabyrinthAdmissibilityIndex {
  const expected = deriveQuantmanAdmissibilityIndex(records, width, height);
  if (!structurallyEqual(value, expected)) {
    throw new Error(
      "Quantman admissibility index does not match the intact returned records.",
    );
  }
  return value as LabyrinthAdmissibilityIndex;
}

function adjacencyFor(
  playableRooms: readonly number[],
  playableEdges: readonly Readonly<{ index: number; a: number; b: number }>[],
  openEdgeIndices: ReadonlySet<number>,
): Map<number, Set<number>> {
  const adjacency = new Map(
    playableRooms.map((room) => [room, new Set<number>()] as const),
  );
  for (const edge of playableEdges) {
    if (!openEdgeIndices.has(edge.index)) continue;
    adjacency.get(edge.a)?.add(edge.b);
    adjacency.get(edge.b)?.add(edge.a);
  }
  // The side tunnel is fixed local game geometry, not a measured wall.
  adjacency.get(50)?.add(59);
  adjacency.get(59)?.add(50);
  return adjacency;
}

function component(
  adjacency: ReadonlyMap<number, ReadonlySet<number>>,
  start: number,
): Set<number> {
  const visited = new Set([start]);
  const pending = [start];
  while (pending.length > 0) {
    const room = pending.pop();
    if (room === undefined) break;
    for (const neighbour of adjacency.get(room) ?? []) {
      if (visited.has(neighbour)) continue;
      visited.add(neighbour);
      pending.push(neighbour);
    }
  }
  return visited;
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => structurallyEqual(item, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && structurallyEqual(left[key], right[key]),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
