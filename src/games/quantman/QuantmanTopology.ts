import { deriveSeed, type Uint32Seed } from "../../core/determinism";
import type {
  QuantmanCell,
  QuantmanDirection,
  QuantmanLabyrinthState,
  QuantmanPackPayload,
  QuantmanTopologyDoor,
} from "./types";

export interface QuantmanTopologySelection {
  readonly state: QuantmanLabyrinthState;
  readonly heldDoorId: string;
  readonly changedDoorIds: readonly string[];
  readonly observedDoorIds: readonly string[];
  readonly compatibleStateCount: number;
}

export function initialQuantmanTopologyState(
  payload: QuantmanPackPayload,
  runSeed: Uint32Seed,
): QuantmanLabyrinthState {
  const states = payload.labyrinthEnsemble.states;
  const index =
    deriveSeed(runSeed, "quantman:initial-topology") % states.length;
  const state = states[index];
  if (!state) throw new Error("Quantman Labyrinth ensemble is empty.");
  return state;
}

export function observeQuantmanTopology(
  payload: QuantmanPackPayload,
  current: QuantmanLabyrinthState,
  playerCell: QuantmanCell,
  occupiedDoorIds: ReadonlySet<string>,
  runSeed: Uint32Seed,
  observationCount: number,
  facing?: QuantmanDirection,
): QuantmanTopologySelection {
  const selection = tryObserveQuantmanTopology(
    payload,
    current,
    playerCell,
    occupiedDoorIds,
    runSeed,
    observationCount,
    facing,
  );
  if (!selection) {
    throw new Error("Quantman has no compatible changed topology state.");
  }
  return selection;
}

export function tryObserveQuantmanTopology(
  payload: QuantmanPackPayload,
  current: QuantmanLabyrinthState,
  playerCell: QuantmanCell,
  occupiedDoorIds: ReadonlySet<string>,
  runSeed: Uint32Seed,
  observationCount: number,
  facing?: QuantmanDirection,
): QuantmanTopologySelection | null {
  const nearest = focusedQuantmanDoor(
    payload.topologyDoors,
    playerCell,
    facing,
  );
  const pinned = new Set(occupiedDoorIds);
  pinned.add(nearest.doorId);

  const candidates = compatibleStates(payload, current, pinned);
  if (candidates.length === 0) return null;
  const scored = candidates.map((state) => ({
    state,
    changedDoorIds: changedQuantmanDoorIds(
      payload.topologyDoors,
      current,
      state,
    ),
  }));
  const maximumChange = Math.max(
    ...scored.map((candidate) => candidate.changedDoorIds.length),
  );
  const materiallyDifferent = scored.filter(
    (candidate) => candidate.changedDoorIds.length === maximumChange,
  );
  const selectedIndex =
    deriveSeed(runSeed, `quantman:observation:${observationCount}`) %
    materiallyDifferent.length;
  const selected = materiallyDifferent[selectedIndex];
  if (!selected || selected.changedDoorIds.length === 0) return null;
  return Object.freeze({
    state: selected.state,
    heldDoorId: nearest.doorId,
    changedDoorIds: Object.freeze([...selected.changedDoorIds]),
    observedDoorIds: Object.freeze([...pinned].sort()),
    compatibleStateCount: candidates.length,
  });
}

export function quantmanTopologyRows(
  payload: QuantmanPackPayload,
  state: QuantmanLabyrinthState,
): readonly string[] {
  const rows = payload.rows.map((row) => [...row]);
  for (const door of payload.topologyDoors) {
    if (quantmanDoorIsOpen(state, door)) rows[door.row]![door.col] = ".";
  }
  return Object.freeze(rows.map((row) => row.join("")));
}

export function quantmanOpenDoorIds(
  payload: QuantmanPackPayload,
  state: QuantmanLabyrinthState,
): readonly string[] {
  return Object.freeze(
    payload.topologyDoors
      .filter((door) => quantmanDoorIsOpen(state, door))
      .map((door) => door.doorId),
  );
}

export function quantmanDoorIsOpen(
  state: QuantmanLabyrinthState,
  door: QuantmanTopologyDoor,
): boolean {
  const [left, right] = door.sourceRooms;
  return state.bitstring[left] === state.bitstring[right];
}

function compatibleStates(
  payload: QuantmanPackPayload,
  current: QuantmanLabyrinthState,
  pinnedDoorIds: ReadonlySet<string>,
): readonly QuantmanLabyrinthState[] {
  return payload.labyrinthEnsemble.states.filter(
    (candidate) =>
      candidate.stateId !== current.stateId &&
      payload.topologyDoors.every(
        (door) =>
          !pinnedDoorIds.has(door.doorId) ||
          quantmanDoorIsOpen(candidate, door) ===
            quantmanDoorIsOpen(current, door),
      ),
  );
}

export function changedQuantmanDoorIds(
  doors: readonly QuantmanTopologyDoor[],
  current: QuantmanLabyrinthState,
  candidate: QuantmanLabyrinthState,
): readonly string[] {
  return doors
    .filter(
      (door) =>
        quantmanDoorIsOpen(current, door) !==
        quantmanDoorIsOpen(candidate, door),
    )
    .map((door) => door.doorId);
}

export function focusedQuantmanDoor(
  doors: readonly QuantmanTopologyDoor[],
  playerCell: QuantmanCell,
  facing?: QuantmanDirection,
): QuantmanTopologyDoor {
  const focused = [...doors].sort((left, right) => {
    const leftFacingScore = facingScore(left, playerCell, facing);
    const rightFacingScore = facingScore(right, playerCell, facing);
    const leftDistance =
      Math.abs(left.row - playerCell.row) + Math.abs(left.col - playerCell.col);
    const rightDistance =
      Math.abs(right.row - playerCell.row) +
      Math.abs(right.col - playerCell.col);
    return (
      leftFacingScore - rightFacingScore ||
      leftDistance - rightDistance ||
      left.doorId.localeCompare(right.doorId)
    );
  })[0];
  if (!focused)
    throw new Error("Quantman requires a topology door to observe.");
  return focused;
}

function facingScore(
  door: QuantmanTopologyDoor,
  playerCell: QuantmanCell,
  facing?: QuantmanDirection,
): number {
  if (!facing || (facing.x === 0 && facing.y === 0)) return 0;
  const deltaX = door.col - playerCell.col;
  const deltaY = door.row - playerCell.row;
  const forward = deltaX * facing.x + deltaY * facing.y;
  const lateral = Math.abs(deltaX * facing.y - deltaY * facing.x);
  const rayRank = forward >= 0 && lateral === 0 ? 0 : forward >= 0 ? 1 : 2;
  return rayRank * 10_000 + lateral * 100 + Math.max(0, forward);
}
