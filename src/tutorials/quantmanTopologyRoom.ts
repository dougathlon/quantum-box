import type { RunContext } from "../core/run";
import type { QuantmanTopologyTutorialEvidence } from "../games/quantman/QuantmanTopologyEvidence";
import type {
  QuantmanPackPayload,
  QuantmanPursuerResponseTrace,
  QuantmanSnapshot,
} from "../games/quantman/types";
import {
  CONTINUE_ACTION,
  deepFreeze,
  INTERACT_ACTION,
  moveActions,
  SpatialTutorialMachine,
  unavailableTutorialEvidence,
  type SpatialTutorialConfig,
  type TutorialAction,
  type TutorialEvidenceGate,
  type TutorialInteractionResult,
  type TutorialWorldDefinition,
} from "./contracts";
import {
  adaptTutorialEvidence,
  requireNonEmptyString,
  requireSha256,
  requireStoryRunContext,
  type TutorialAdapterBaseInput,
} from "./evidence";

export interface QuantmanTopologyRoomEvidence {
  readonly packId: string;
  readonly fixtureId: string;
  readonly rawResultSha256: string;
  readonly observationsUsed: number;
  readonly doors: readonly QuantmanPlayedDoorEvidence[];
}

export interface QuantmanTopologyRoomAdapterInput
  extends TutorialAdapterBaseInput {
  readonly context: RunContext;
  readonly snapshot: QuantmanSnapshot;
  readonly payload: QuantmanPackPayload;
  readonly evidence: QuantmanTopologyTutorialEvidence;
}

export interface QuantmanPlayedDoorEvidence {
  readonly observationIndex: number;
  readonly doorId: string;
  readonly sourceRooms: readonly [number, number];
  readonly beforeStateId: string;
  readonly beforeBitstring: string;
  readonly beforeDoorOpen: boolean;
  readonly afterStateId: string;
  readonly afterBitstring: string;
  readonly afterDoorOpen: boolean;
  readonly changedDoorIds: readonly string[];
  readonly compatibleStateCount: number;
  readonly traversedDoorIds: readonly string[];
  readonly pursuerResponses: readonly QuantmanPursuerResponseTrace[];
  readonly exploited: boolean;
}

export interface QuantmanTopologyObservation {
  readonly heldDoorId: string;
  readonly heldDoorOpen: boolean;
  readonly beforeStateId: string;
  readonly afterStateId: string;
  readonly changedDoorIds: readonly string[];
  readonly compatibleStateCount: number;
}

export interface QuantmanTopologyRoomMechanism {
  readonly inspectedDoorIndexes: readonly number[];
  readonly heldDoorIndex: number | null;
  readonly observation: QuantmanTopologyObservation | null;
  readonly changedRouteInspected: boolean;
  readonly operationPerformed: boolean;
}

export const QUANTMAN_TOPOLOGY_ROOM_DEFINITION: TutorialWorldDefinition =
  deepFreeze({
    worldId: "quantman-topology-room",
    title: "Quantman Topology Room",
    collisionRows: [
      "###########",
      "#.........#",
      "#.##...##.#",
      "#.........#",
      "#...#.#...#",
      "#.........#",
      "#.##...##.#",
      "#.........#",
      "###########",
    ],
    playerStart: { row: 7, col: 5 },
    playerRole: "player-candidate-c",
    designer: {
      approachZoneId: "designer",
      initialRole: "quantman-candidate-c-ghost",
      finalRole: "designer-wizard",
      morphSteps: 3,
    },
    interactionZones: [
      { zoneId: "designer", label: "Designer", tiles: [{ row: 1, col: 5 }] },
      {
        zoneId: "door-0",
        label: "Topology door 1",
        tiles: [{ row: 3, col: 2 }],
      },
      {
        zoneId: "door-1",
        label: "Topology door 2",
        tiles: [{ row: 3, col: 5 }],
      },
      {
        zoneId: "door-2",
        label: "Topology door 3",
        tiles: [{ row: 3, col: 8 }],
      },
      {
        zoneId: "observation-console",
        label: "Observation console",
        tiles: [{ row: 5, col: 5 }],
      },
      {
        zoneId: "changed-route",
        label: "Changed route viewer",
        tiles: [{ row: 5, col: 8 }],
      },
    ],
    dialogue: [
      "A local door can be held while a whole recorded Labyrinth state changes.",
      "Inspect the doors, hold one, trigger observation, then verify a route that changed elsewhere.",
    ],
  });

const INITIAL_MECHANISM: QuantmanTopologyRoomMechanism = deepFreeze({
  inspectedDoorIndexes: [],
  heldDoorIndex: null,
  observation: null,
  changedRouteInspected: false,
  operationPerformed: false,
});

export function adaptQuantmanTopologyRoomEvidence(
  input: QuantmanTopologyRoomAdapterInput | null,
): TutorialEvidenceGate<QuantmanTopologyRoomEvidence> {
  return adaptTutorialEvidence(
    "quantman-topology-room",
    input,
    "VALIDATED QUANTMAN STORY RUN · MOTH REMOTE AER",
    () => {
      if (input === null) throw new Error("Quantman Story evidence is absent.");
      const { context, snapshot, payload, evidence } = input;
      requireStoryRunContext(
        context,
        "quantman",
        context.pack.packId,
        context.pack.contentSha256,
      );
      if (
        snapshot.phase !== "won" ||
        !snapshot.storyQualified ||
        snapshot.observationCount < 1 ||
        context.pack.source !== "moth-api-emulator" ||
        evidence.source !== "Moth remote Aer" ||
        evidence.qpuEvidence ||
        evidence.observationsUsed !== snapshot.observationCount ||
        evidence.observationsRemaining !== snapshot.observationsRemaining ||
        evidence.transitions.length < 1
      ) {
        throw new Error(
          "Quantman tutorial requires a qualified observed Moth remote-Aer Story run.",
        );
      }
      const fixture = payload.labyrinthEnsemble;
      requireNonEmptyString(fixture.fixtureId, "Quantman fixture ID");
      requireSha256(
        fixture.acquisition.rawResultSha256,
        "Quantman raw-result hash",
      );
      const doors = evidence.transitions.slice(0, 3).map((played, index) => {
        const transition = played.transition;
        const matchingSnapshotTransition = snapshot.topologyTransitions.find(
          (candidate) =>
            candidate.observationIndex === transition.observationIndex,
        );
        const heldDoor = payload.topologyDoors.find(
          (candidate) => candidate.doorId === transition.heldDoorId,
        );
        const before = fixture.states.find(
          (candidate) => candidate.stateId === transition.beforeStateId,
        );
        const after = fixture.states.find(
          (candidate) => candidate.stateId === transition.afterStateId,
        );
        requireNonEmptyString(
          transition.heldDoorId,
          `Quantman door ${index + 1} ID`,
        );
        if (
          !matchingSnapshotTransition ||
          !heldDoor ||
          !before ||
          !after ||
          JSON.stringify(matchingSnapshotTransition) !==
            JSON.stringify(transition) ||
          transition.beforeStateId === transition.afterStateId ||
          !played.heldDoorPreserved ||
          transition.changedDoorIds.length === 0 ||
          transition.changedDoorIds.includes(transition.heldDoorId) ||
          transition.compatibleStateCount < 1
        ) {
          throw new Error(
            `Quantman observation ${index + 1} is not the played held-door transition.`,
          );
        }
        if (played.exploited !== played.playerTraversal.length > 0) {
          throw new Error(
            `Quantman observation ${index + 1} has inconsistent traversal evidence.`,
          );
        }
        return deepFreeze({
          observationIndex: transition.observationIndex,
          doorId: transition.heldDoorId,
          sourceRooms: heldDoor.sourceRooms,
          beforeStateId: transition.beforeStateId,
          beforeBitstring: before.bitstring,
          beforeDoorOpen: transition.heldDoorOpen,
          afterStateId: transition.afterStateId,
          afterBitstring: after.bitstring,
          afterDoorOpen: transition.heldDoorOpen,
          changedDoorIds: [...transition.changedDoorIds],
          compatibleStateCount: transition.compatibleStateCount,
          traversedDoorIds: played.playerTraversal
            .map((entry) => entry.doorId)
            .filter((doorId): doorId is string => doorId !== null),
          pursuerResponses: [...played.pursuerResponses],
          exploited: played.exploited,
        });
      });
      if (!doors.some((door) => door.exploited)) {
        throw new Error(
          "Quantman tutorial requires the observation-opened route actually traversed in play.",
        );
      }
      return deepFreeze({
        packId: context.pack.packId,
        fixtureId: fixture.fixtureId,
        rawResultSha256: fixture.acquisition.rawResultSha256,
        observationsUsed: evidence.observationsUsed,
        doors,
      });
    },
  );
}

export function createQuantmanTopologyRoom(
  evidence: TutorialEvidenceGate<QuantmanTopologyRoomEvidence> = unavailableTutorialEvidence(
    "Quantman Topology Room requires a qualified observed run transition.",
  ),
): SpatialTutorialMachine<
  QuantmanTopologyRoomMechanism,
  QuantmanTopologyRoomEvidence
> {
  return new SpatialTutorialMachine({
    definition: QUANTMAN_TOPOLOGY_ROOM_DEFINITION,
    evidence,
    initialMechanism: INITIAL_MECHANISM,
    interact: quantmanInteraction,
  });
}

export const QUANTMAN_TOPOLOGY_ROOM_COMPLETION_SCRIPT: readonly TutorialAction[] =
  quantmanTopologyRoomCompletionScript(3);

export function quantmanTopologyRoomCompletionScript(
  stationCount: number,
): readonly TutorialAction[] {
  if (
    !Number.isSafeInteger(stationCount) ||
    stationCount < 1 ||
    stationCount > 3
  ) {
    throw new Error(
      "Quantman tutorial requires one to three played observation stations.",
    );
  }
  const inspectStations: TutorialAction[] = [
    ...moveActions("down", 2),
    ...moveActions("left", 3),
    INTERACT_ACTION,
  ];
  for (let index = 1; index < stationCount; index += 1) {
    inspectStations.push(...moveActions("right", 3), INTERACT_ACTION);
  }
  inspectStations.push(INTERACT_ACTION);
  const currentColumn = 2 + (stationCount - 1) * 3;
  const toObservation = 5 - currentColumn;
  return deepFreeze([
    ...moveActions("up", 6),
    INTERACT_ACTION,
    CONTINUE_ACTION,
    CONTINUE_ACTION,
    CONTINUE_ACTION,
    CONTINUE_ACTION,
    CONTINUE_ACTION,
    ...inspectStations,
    ...moveActions("down", 2),
    ...moveActions(
      toObservation < 0 ? "left" : "right",
      Math.abs(toObservation),
    ),
    INTERACT_ACTION,
    ...moveActions("right", 3),
    INTERACT_ACTION,
    ...moveActions("up", 2),
    ...moveActions("left", 3),
    ...moveActions("up", 2),
    INTERACT_ACTION,
  ]);
}

function quantmanInteraction(
  context: Parameters<
    SpatialTutorialConfig<
      QuantmanTopologyRoomMechanism,
      QuantmanTopologyRoomEvidence
    >["interact"]
  >[0],
): TutorialInteractionResult<QuantmanTopologyRoomMechanism> {
  const evidence = context.evidence.value;
  if (evidence === null) {
    return unchanged(
      context,
      context.evidence.reason ?? "Quantman run evidence is unavailable.",
    );
  }
  const doorIndex = zoneIndex(context.zoneId, "door-");
  if (doorIndex !== null) {
    const transition = evidence.doors[doorIndex];
    if (!transition) return unchanged(context, "That topology door is absent.");
    if (
      context.phase === "spatial-exploration" &&
      context.mechanism.inspectedDoorIndexes.length === evidence.doors.length
    ) {
      return {
        mechanism: deepFreeze({
          ...context.mechanism,
          heldDoorIndex: doorIndex,
        }),
        nextPhase: "mechanism-interaction",
        feedback: `${transition.doorId} held ${transition.beforeDoorOpen ? "open" : "closed"}. Trigger observation at the console.`,
        recordVisit: true,
      };
    }
    const inspected = addIndex(
      context.mechanism.inspectedDoorIndexes,
      doorIndex,
    );
    const [left, right] = transition.sourceRooms;
    return {
      mechanism: deepFreeze({
        ...context.mechanism,
        inspectedDoorIndexes: inspected,
      }),
      nextPhase: context.phase,
      feedback: `${transition.doorId}: q${left}=${transition.beforeBitstring[left]} and q${right}=${transition.beforeBitstring[right]} hold it ${transition.beforeDoorOpen ? "open" : "closed"}.`,
      recordVisit: true,
    };
  }
  if (context.zoneId === "observation-console") {
    const heldDoorIndex = context.mechanism.heldDoorIndex;
    const transition =
      heldDoorIndex === null ? null : evidence.doors[heldDoorIndex];
    if (context.phase !== "mechanism-interaction" || !transition) {
      return unchanged(context, "Hold one inspected door before observation.");
    }
    const observation = deepFreeze({
      heldDoorId: transition.doorId,
      heldDoorOpen: transition.afterDoorOpen,
      beforeStateId: transition.beforeStateId,
      afterStateId: transition.afterStateId,
      changedDoorIds: [...transition.changedDoorIds],
      compatibleStateCount: transition.compatibleStateCount,
    });
    return {
      mechanism: deepFreeze({
        ...context.mechanism,
        observation,
      }),
      nextPhase: "mechanism-interaction",
      feedback: `${observation.heldDoorId} held while ${observation.changedDoorIds.length} other routes changed from ${observation.beforeStateId} to ${observation.afterStateId}.`,
      recordVisit: true,
    };
  }
  if (context.zoneId === "changed-route") {
    const observation = context.mechanism.observation;
    if (!observation) {
      return unchanged(
        context,
        "Observe the held topology before inspecting a changed route.",
      );
    }
    const mechanism = deepFreeze({
      ...context.mechanism,
      changedRouteInspected: true,
      operationPerformed: true,
    });
    return {
      mechanism,
      nextPhase: "demonstrated-understanding",
      feedback: transitionRouteFeedback(evidence, observation),
      recordVisit: true,
    };
  }
  return unchanged(context, "This topology-room station has no operation.");
}

function transitionRouteFeedback(
  evidence: QuantmanTopologyRoomEvidence,
  observation: QuantmanTopologyObservation,
): string {
  const transition = evidence.doors.find(
    (candidate) => candidate.doorId === observation.heldDoorId,
  );
  if (!transition) {
    return `Changed route ${observation.changedDoorIds[0]} verified; ${observation.heldDoorId} remained ${observation.heldDoorOpen ? "open" : "closed"}.`;
  }
  const traversed =
    transition.traversedDoorIds[0] ?? observation.changedDoorIds[0];
  const pursuit = transition.pursuerResponses.length;
  return `Played route ${traversed} verified after observation ${transition.observationIndex}; ${observation.heldDoorId} remained ${observation.heldDoorOpen ? "open" : "closed"} and ${pursuit} pursuer response${pursuit === 1 ? "" : "s"} was recorded.`;
}

function unchanged(
  context: Parameters<
    SpatialTutorialConfig<
      QuantmanTopologyRoomMechanism,
      QuantmanTopologyRoomEvidence
    >["interact"]
  >[0],
  feedback: string,
): TutorialInteractionResult<QuantmanTopologyRoomMechanism> {
  return {
    mechanism: context.mechanism,
    nextPhase: context.phase,
    feedback,
    recordVisit: false,
  };
}

function addIndex(values: readonly number[], value: number): readonly number[] {
  return values.includes(value)
    ? values
    : Object.freeze([...values, value].sort((left, right) => left - right));
}

function zoneIndex(zoneId: string, prefix: string): number | null {
  if (!zoneId.startsWith(prefix)) return null;
  const value = Number(zoneId.slice(prefix.length));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
