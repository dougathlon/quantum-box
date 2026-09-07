import { quantmanDoorIsOpen, quantmanTopologyRows } from "./QuantmanTopology";
import {
  type QuantmanCell,
  type QuantmanLabyrinthState,
  type QuantmanPackPayload,
  type QuantmanPlayerTraversalTrace,
  type QuantmanPursuerResponseTrace,
  type QuantmanSnapshot,
  type QuantmanTopologyTransitionTrace,
} from "./types";

export interface QuantmanRouteEvidence {
  readonly start: QuantmanCell;
  readonly target: QuantmanCell;
  readonly beforePath: readonly QuantmanCell[] | null;
  readonly afterPath: readonly QuantmanCell[] | null;
  readonly beforeLength: number | null;
  readonly afterLength: number | null;
  readonly lengthDelta: number | null;
  readonly firstStepChanged: boolean;
  readonly affectedAfterRouteDoorIds: readonly string[];
}

export interface QuantmanTopologyRoomEvidence {
  readonly beforeStateId: string;
  readonly afterStateId: string;
  readonly heldDoorId: string;
  readonly heldDoorPreserved: boolean;
  readonly changedDoorIds: readonly string[];
  readonly openedDoorIds: readonly string[];
  readonly closedDoorIds: readonly string[];
  readonly beforeNavigable: boolean;
  readonly afterNavigable: boolean;
  readonly playerRoute: QuantmanRouteEvidence;
  readonly pursuerRoute: QuantmanRouteEvidence;
}

export interface QuantmanPlayedTransitionEvidence {
  readonly transition: QuantmanTopologyTransitionTrace;
  readonly heldDoorPreserved: boolean;
  readonly playerTraversal: readonly QuantmanPlayerTraversalTrace[];
  readonly pursuerResponses: readonly QuantmanPursuerResponseTrace[];
  readonly exploited: boolean;
}

export interface QuantmanTopologyTutorialEvidence {
  readonly source: "Moth remote Aer";
  readonly qpuEvidence: false;
  readonly initialObservationBudget: null;
  readonly observationsUsed: number;
  readonly observationsRemaining: null;
  readonly transitions: readonly QuantmanPlayedTransitionEvidence[];
}

export function createQuantmanTopologyRoomEvidence(
  payload: QuantmanPackPayload,
  before: QuantmanLabyrinthState,
  after: QuantmanLabyrinthState,
  heldDoorId: string,
  playerRoute: Readonly<{
    start: QuantmanCell;
    target: QuantmanCell;
  }>,
  pursuerRoute: Readonly<{
    start: QuantmanCell;
    target: QuantmanCell;
  }>,
): QuantmanTopologyRoomEvidence {
  const heldDoor = requiredDoor(payload, heldDoorId);
  const changedDoors = payload.topologyDoors.filter(
    (door) =>
      quantmanDoorIsOpen(before, door) !== quantmanDoorIsOpen(after, door),
  );
  const beforeRows = quantmanTopologyRows(payload, before);
  const afterRows = quantmanTopologyRows(payload, after);
  return deepFreeze({
    beforeStateId: before.stateId,
    afterStateId: after.stateId,
    heldDoorId,
    heldDoorPreserved:
      quantmanDoorIsOpen(before, heldDoor) ===
      quantmanDoorIsOpen(after, heldDoor),
    changedDoorIds: changedDoors.map((door) => door.doorId),
    openedDoorIds: changedDoors
      .filter((door) => quantmanDoorIsOpen(after, door))
      .map((door) => door.doorId),
    closedDoorIds: changedDoors
      .filter((door) => !quantmanDoorIsOpen(after, door))
      .map((door) => door.doorId),
    beforeNavigable: quantmanTopologyStateIsNavigable(payload, before),
    afterNavigable: quantmanTopologyStateIsNavigable(payload, after),
    playerRoute: compareRoutes(
      payload,
      beforeRows,
      afterRows,
      playerRoute.start,
      playerRoute.target,
      changedDoors.map((door) => door.doorId),
    ),
    pursuerRoute: compareRoutes(
      payload,
      beforeRows,
      afterRows,
      pursuerRoute.start,
      pursuerRoute.target,
      changedDoors.map((door) => door.doorId),
    ),
  });
}

export function createQuantmanTopologyTutorialEvidence(
  payload: QuantmanPackPayload,
  snapshot: QuantmanSnapshot,
): QuantmanTopologyTutorialEvidence {
  const transitions = snapshot.topologyTransitions.map((transition) => {
    const before = requiredState(payload, transition.beforeStateId);
    const after = requiredState(payload, transition.afterStateId);
    const heldDoor = requiredDoor(payload, transition.heldDoorId);
    const playerTraversal = snapshot.playerTraversal.filter(
      (traversal) =>
        traversal.exploitedObservationIndex === transition.observationIndex,
    );
    return {
      transition,
      heldDoorPreserved:
        quantmanDoorIsOpen(before, heldDoor) ===
        quantmanDoorIsOpen(after, heldDoor),
      playerTraversal,
      pursuerResponses: snapshot.pursuerResponses.filter(
        (response) => response.observationIndex === transition.observationIndex,
      ),
      exploited: playerTraversal.length > 0,
    };
  });
  return deepFreeze({
    source: "Moth remote Aer",
    qpuEvidence: false,
    initialObservationBudget: null,
    observationsUsed: snapshot.observationCount,
    observationsRemaining: snapshot.observationsRemaining,
    transitions,
  });
}

export function quantmanTopologyStateIsNavigable(
  payload: QuantmanPackPayload,
  state: QuantmanLabyrinthState,
): boolean {
  const rows = quantmanTopologyRows(payload, state);
  const requiredCells = [
    payload.exit,
    ...payload.fragments,
    ...payload.pursuers.flatMap((pursuer) => [pursuer, ...pursuer.patrol]),
  ];
  return requiredCells.every(
    (cell) => shortestQuantmanPath(rows, payload.playerStart, cell) !== null,
  );
}

export function shortestQuantmanPath(
  rows: readonly string[],
  start: QuantmanCell,
  target: QuantmanCell,
): readonly QuantmanCell[] | null {
  if (rows[start.row]?.[start.col] !== ".") return null;
  if (rows[target.row]?.[target.col] !== ".") return null;
  const queue: QuantmanCell[] = [{ ...start }];
  const previous = new Map<string, QuantmanCell | null>([
    [cellKey(start), null],
  ]);
  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell) continue;
    if (sameCell(cell, target)) {
      const path: QuantmanCell[] = [];
      let cursor: QuantmanCell | null = cell;
      while (cursor) {
        path.unshift(Object.freeze({ ...cursor }));
        cursor = previous.get(cellKey(cursor)) ?? null;
      }
      return Object.freeze(path);
    }
    for (const next of neighbours(rows, cell)) {
      if (previous.has(cellKey(next))) continue;
      previous.set(cellKey(next), cell);
      queue.push(next);
    }
  }
  return null;
}

function compareRoutes(
  payload: QuantmanPackPayload,
  beforeRows: readonly string[],
  afterRows: readonly string[],
  start: QuantmanCell,
  target: QuantmanCell,
  changedDoorIds: readonly string[],
): QuantmanRouteEvidence {
  const beforePath = shortestQuantmanPath(beforeRows, start, target);
  const afterPath = shortestQuantmanPath(afterRows, start, target);
  const beforeLength = pathLength(beforePath);
  const afterLength = pathLength(afterPath);
  const changedDoorCells = new Map(
    payload.topologyDoors
      .filter((door) => changedDoorIds.includes(door.doorId))
      .map((door) => [cellKey(door), door.doorId]),
  );
  return {
    start: Object.freeze({ ...start }),
    target: Object.freeze({ ...target }),
    beforePath,
    afterPath,
    beforeLength,
    afterLength,
    lengthDelta:
      beforeLength === null || afterLength === null
        ? null
        : afterLength - beforeLength,
    firstStepChanged:
      cellKey(beforePath?.[1] ?? start) !== cellKey(afterPath?.[1] ?? start),
    affectedAfterRouteDoorIds: Object.freeze(
      [
        ...new Set(
          (afterPath ?? [])
            .map((cell) => changedDoorCells.get(cellKey(cell)))
            .filter((doorId): doorId is string => doorId !== undefined),
        ),
      ].sort(),
    ),
  };
}

function pathLength(path: readonly QuantmanCell[] | null): number | null {
  return path === null ? null : Math.max(0, path.length - 1);
}

function neighbours(
  rows: readonly string[],
  cell: QuantmanCell,
): readonly QuantmanCell[] {
  return (
    [
      { row: cell.row - 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col + 1 },
    ] as const
  ).filter((next) => rows[next.row]?.[next.col] === ".");
}

function requiredDoor(payload: QuantmanPackPayload, doorId: string) {
  const door = payload.topologyDoors.find(
    (candidate) => candidate.doorId === doorId,
  );
  if (!door) throw new Error(`Unknown Quantman topology door ${doorId}.`);
  return door;
}

function requiredState(payload: QuantmanPackPayload, stateId: string) {
  const state = payload.labyrinthEnsemble.states.find(
    (candidate) => candidate.stateId === stateId,
  );
  if (!state) throw new Error(`Unknown Quantman topology state ${stateId}.`);
  return state;
}

function sameCell(left: QuantmanCell, right: QuantmanCell): boolean {
  return left.row === right.row && left.col === right.col;
}

function cellKey(cell: QuantmanCell): string {
  return `${cell.row}:${cell.col}`;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
