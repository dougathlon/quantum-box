import type { RunContext } from "../../core/run";
import type { QuantmanCommittedPack } from "./quantmanControlPack";
import {
  observeQuantmanTopology,
  quantmanDoorIsOpen,
} from "./QuantmanTopology";
import type {
  QuantmanDesignerEvidence,
  QuantmanDesignerTransitionEvidence,
  QuantmanSnapshot,
} from "./types";

const DESIGNER_DOOR_COUNT = 5;

export function createQuantmanDesignerEvidence(
  pack: QuantmanCommittedPack,
  context: RunContext,
  snapshot: QuantmanSnapshot,
): QuantmanDesignerEvidence {
  if (
    context.gameId !== "quantman" ||
    context.pack.packId !== pack.packId ||
    context.pack.contentSha256 !== pack.contentSha256
  ) {
    throw new Error("Quantman Designer evidence does not match the run pack.");
  }
  if (!snapshot.storyQualified || snapshot.observationCount < 1) {
    throw new Error(
      "Quantman Designer evidence requires a qualified observed Story run.",
    );
  }
  const beforeState = pack.payload.labyrinthEnsemble.states.find(
    (state) => state.stateId === snapshot.topologyStateId,
  );
  if (!beforeState) {
    throw new Error(
      `Quantman Designer evidence cannot find ${snapshot.topologyStateId}.`,
    );
  }

  const transitions = pack.payload.topologyDoors
    .slice(0, DESIGNER_DOOR_COUNT)
    .map((door): QuantmanDesignerTransitionEvidence => {
      const selection = observeQuantmanTopology(
        pack.payload,
        beforeState,
        { row: door.row, col: door.col },
        new Set<string>(),
        context.runSeed,
        snapshot.observationCount,
      );
      return Object.freeze({
        doorId: door.doorId,
        sourceRooms: door.sourceRooms,
        beforeStateId: beforeState.stateId,
        beforeBitstring: beforeState.bitstring,
        beforeDoorOpen: quantmanDoorIsOpen(beforeState, door),
        afterStateId: selection.state.stateId,
        afterBitstring: selection.state.bitstring,
        afterDoorOpen: quantmanDoorIsOpen(selection.state, door),
        changedDoorIds: selection.changedDoorIds,
        compatibleStateCount: selection.compatibleStateCount,
      });
    });

  return deepFreeze({
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    source: "moth-api-emulator",
    fixtureId: pack.payload.labyrinthEnsemble.fixtureId,
    rawResultSha256: pack.payload.labyrinthEnsemble.acquisition.rawResultSha256,
    executionMode: "remote-simulator",
    backend: "aer",
    observationIndex: snapshot.observationCount,
    transitions,
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
