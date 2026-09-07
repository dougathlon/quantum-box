import type { RunContext } from "../core/run";
import type {
  SkiPixlDesignerEvidence,
  SkiPixlDesignerHazardEvidence,
  SkiPixlDesignerRowEvidence,
  SkiPixlObstacle,
  SkiPixlPackPayload,
  SkiPixlSnapshot,
} from "../games/skipixl/types";
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
  requireFinite,
  requireStoryRunContext,
  type TutorialAdapterBaseInput,
} from "./evidence";

export interface SkiPixlGridEvidence {
  readonly gridIndex: number;
  readonly segmentId: string;
  readonly row: SkiPixlDesignerRowEvidence;
  readonly reading: SkiPixlDesignerHazardEvidence;
  readonly obstacle: SkiPixlObstacle;
}

export interface SkiPixlLodgeEvidence {
  readonly packId: string;
  readonly decoderVersion: string;
  readonly grids: readonly SkiPixlGridEvidence[];
}

export interface SkiPixlLodgeAdapterInput extends TutorialAdapterBaseInput {
  readonly context: RunContext;
  readonly snapshot: SkiPixlSnapshot;
  readonly evidence: SkiPixlDesignerEvidence;
  readonly payload: SkiPixlPackPayload;
}

export interface SkiPixlObstacleLink {
  readonly gridIndex: number;
  readonly segmentId: string;
  readonly obstacleId: string;
  readonly courseRow: number;
  readonly column: number;
  readonly residual: number;
}

export interface SkiPixlLodgeMechanism {
  readonly inspectedGridIndexes: readonly number[];
  readonly selectedGridIndex: number | null;
  readonly linkedGridIndexes: readonly number[];
  readonly links: readonly SkiPixlObstacleLink[];
  readonly lastReading: SkiPixlGridEvidence | null;
  readonly operationPerformed: boolean;
}

export const SKIPIXL_LODGE_DEFINITION: TutorialWorldDefinition = deepFreeze({
  worldId: "skipixl-lodge",
  title: "SkiPixl Lodge",
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
    initialRole: "designer-wizard",
    finalRole: "designer-wizard",
    morphSteps: 0,
  },
  interactionZones: [
    { zoneId: "designer", label: "Designer", tiles: [{ row: 1, col: 5 }] },
    { zoneId: "grid-0", label: "QPixl grid 1", tiles: [{ row: 3, col: 2 }] },
    { zoneId: "grid-1", label: "QPixl grid 2", tiles: [{ row: 3, col: 5 }] },
    { zoneId: "grid-2", label: "QPixl grid 3", tiles: [{ row: 3, col: 8 }] },
    {
      zoneId: "obstacle-0",
      label: "Mountain obstacle 1",
      tiles: [{ row: 5, col: 2 }],
    },
    {
      zoneId: "obstacle-1",
      label: "Mountain obstacle 2",
      tiles: [{ row: 5, col: 5 }],
    },
    {
      zoneId: "obstacle-2",
      label: "Mountain obstacle 3",
      tiles: [{ row: 5, col: 8 }],
    },
  ],
  dialogue: [
    "Each wall grid preserves submitted pixels beside returned QPixl values.",
    "Inspect all three, then carry one selected residual to its exact course obstacle.",
  ],
});

const INITIAL_MECHANISM: SkiPixlLodgeMechanism = deepFreeze({
  inspectedGridIndexes: [],
  selectedGridIndex: null,
  linkedGridIndexes: [],
  links: [],
  lastReading: null,
  operationPerformed: false,
});

export function adaptSkiPixlLodgeEvidence(
  input: SkiPixlLodgeAdapterInput | null,
): TutorialEvidenceGate<SkiPixlLodgeEvidence> {
  return adaptTutorialEvidence(
    "skipixl-lodge",
    input,
    "VALIDATED QPIXL STORY RUN · IBM FEZ CAPTURE",
    () => {
      if (input === null) throw new Error("SkiPixl Story evidence is absent.");
      const { context, snapshot, evidence, payload } = input;
      requireStoryRunContext(
        context,
        "skipixl",
        evidence.packId,
        evidence.contentSha256,
      );
      if (
        snapshot.phase !== "complete" ||
        !snapshot.storyQualified ||
        evidence.source !== "moth-platform-qpu-capture" ||
        context.pack.source !== evidence.source
      ) {
        throw new Error(
          "SkiPixl tutorial requires a qualified completed QPixl Story run.",
        );
      }
      if (
        payload.courseId !== evidence.packId ||
        payload.decoderVersion !== evidence.decoderVersion ||
        snapshot.receipt.bankContentSha256 !==
          payload.receipt.bankContentSha256 ||
        snapshot.receipt.decoderVersion !== evidence.decoderVersion ||
        evidence.segments.length !== 3 ||
        evidence.selectionThreshold !== payload.receipt.selectionThreshold ||
        evidence.obstacleCount !== payload.obstacles.length ||
        evidence.difficultyScore !== payload.difficultyScore ||
        evidence.winSeconds !== payload.winSeconds
      ) {
        throw new Error("SkiPixl grid evidence does not match the run course.");
      }
      const grids = evidence.segments.map((rows, gridIndex) => {
        const row = rows[2];
        if (!row || row.segmentOrder !== gridIndex) {
          throw new Error(
            `SkiPixl grid ${gridIndex + 1} lacks its sample row.`,
          );
        }
        const reading = strongestHazard(row);
        if (!reading) {
          throw new Error(
            `SkiPixl grid ${gridIndex + 1} sample row has no selected hazard.`,
          );
        }
        const obstacle = payload.obstacles.find(
          (candidate) => candidate.obstacleId === reading.obstacleId,
        );
        if (
          !obstacle ||
          obstacle.segmentId !== row.segmentId ||
          obstacle.row !== row.courseRow ||
          obstacle.column !== reading.column ||
          obstacle.cellIndex !== reading.cellIndex ||
          obstacle.kind !== reading.kind
        ) {
          throw new Error(
            `SkiPixl grid ${gridIndex + 1} does not bind its actual obstacle.`,
          );
        }
        for (const [label, value] of [
          ["source value", reading.sourceValue],
          ["returned value", reading.returnedValue],
          ["residual", reading.residual],
          ["absolute residual", reading.absoluteResidual],
        ] as const) {
          requireFinite(value, `SkiPixl ${label}`);
        }
        const expectedResidual =
          reading.returnedValue - reading.sourceByte / 255;
        if (
          Math.abs(reading.sourceValue - reading.sourceByte / 255) > 1e-12 ||
          Math.abs(reading.residual - expectedResidual) > 1e-12 ||
          Math.abs(reading.absoluteResidual - Math.abs(reading.residual)) >
            1e-12 ||
          reading.absoluteResidual < row.selectionThreshold
        ) {
          throw new Error(
            `SkiPixl grid ${gridIndex + 1} residual arithmetic is inconsistent.`,
          );
        }
        return deepFreeze({
          gridIndex,
          segmentId: row.segmentId,
          row,
          reading,
          obstacle,
        });
      });
      return deepFreeze({
        packId: evidence.packId,
        decoderVersion: evidence.decoderVersion,
        grids,
      });
    },
  );
}

export function createSkiPixlLodge(
  evidence: TutorialEvidenceGate<SkiPixlLodgeEvidence> = unavailableTutorialEvidence(
    "SkiPixl Lodge requires a qualified run and exact QPixl course evidence.",
  ),
): SpatialTutorialMachine<SkiPixlLodgeMechanism, SkiPixlLodgeEvidence> {
  return new SpatialTutorialMachine({
    definition: SKIPIXL_LODGE_DEFINITION,
    evidence,
    initialMechanism: INITIAL_MECHANISM,
    interact: skiPixlInteraction,
  });
}

export const SKIPIXL_LODGE_COMPLETION_SCRIPT: readonly TutorialAction[] =
  deepFreeze([
    ...moveActions("up", 6),
    INTERACT_ACTION,
    CONTINUE_ACTION,
    CONTINUE_ACTION,
    ...moveActions("down", 2),
    ...moveActions("left", 3),
    INTERACT_ACTION,
    ...moveActions("right", 3),
    INTERACT_ACTION,
    ...moveActions("right", 3),
    INTERACT_ACTION,
    ...moveActions("left", 6),
    INTERACT_ACTION,
    ...moveActions("down", 2),
    INTERACT_ACTION,
    ...moveActions("up", 2),
    ...moveActions("right", 3),
    INTERACT_ACTION,
    ...moveActions("down", 2),
    INTERACT_ACTION,
    ...moveActions("up", 2),
    ...moveActions("right", 3),
    INTERACT_ACTION,
    ...moveActions("down", 2),
    INTERACT_ACTION,
    ...moveActions("up", 2),
    ...moveActions("left", 3),
    ...moveActions("up", 2),
    INTERACT_ACTION,
  ]);

function skiPixlInteraction(
  context: Parameters<
    SpatialTutorialConfig<
      SkiPixlLodgeMechanism,
      SkiPixlLodgeEvidence
    >["interact"]
  >[0],
): TutorialInteractionResult<SkiPixlLodgeMechanism> {
  const evidence = context.evidence.value;
  if (evidence === null) {
    return {
      mechanism: context.mechanism,
      nextPhase: context.phase,
      feedback:
        context.evidence.reason ?? "Exact SkiPixl run evidence is unavailable.",
      recordVisit: false,
    };
  }
  const gridIndex = zoneIndex(context.zoneId, "grid-");
  if (gridIndex !== null) {
    const grid = evidence.grids[gridIndex];
    if (!grid) {
      return unchanged(context, "That QPixl grid has no bound run evidence.");
    }
    const inspected = addIndex(
      context.mechanism.inspectedGridIndexes,
      gridIndex,
    );
    const mechanism = deepFreeze({
      ...context.mechanism,
      inspectedGridIndexes: inspected,
      selectedGridIndex: gridIndex,
      lastReading: grid,
    });
    return {
      mechanism,
      nextPhase:
        inspected.length === 3 && context.phase === "spatial-exploration"
          ? "mechanism-interaction"
          : context.phase,
      feedback: `Grid ${gridIndex + 1}: ${grid.row.selectedHazards.length} cells cross ${grid.row.selectionThreshold.toFixed(3)}. Strongest: source ${grid.reading.sourceValue.toFixed(3)}, return ${grid.reading.returnedValue.toFixed(3)}, residual ${signed(grid.reading.residual)}, column ${grid.reading.column + 1}.`,
      recordVisit: true,
    };
  }
  const obstacleIndex = zoneIndex(context.zoneId, "obstacle-");
  if (obstacleIndex !== null) {
    if (
      context.phase !== "mechanism-interaction" ||
      context.mechanism.selectedGridIndex === null
    ) {
      return unchanged(context, "Select a grid reading before an obstacle.");
    }
    if (context.mechanism.selectedGridIndex !== obstacleIndex) {
      return unchanged(
        context,
        `That reading belongs to mountain obstacle ${context.mechanism.selectedGridIndex + 1}.`,
      );
    }
    const grid = evidence.grids[obstacleIndex]!;
    const linked = addIndex(context.mechanism.linkedGridIndexes, obstacleIndex);
    const links = context.mechanism.links.some(
      (link) => link.gridIndex === obstacleIndex,
    )
      ? context.mechanism.links
      : [
          ...context.mechanism.links,
          deepFreeze({
            gridIndex: obstacleIndex,
            segmentId: grid.segmentId,
            obstacleId: grid.obstacle.obstacleId,
            courseRow: grid.row.courseRow,
            column: grid.reading.column,
            residual: grid.reading.residual,
          }),
        ];
    const mechanism = deepFreeze({
      ...context.mechanism,
      selectedGridIndex: null,
      linkedGridIndexes: linked,
      links,
      operationPerformed: linked.length === 3,
    });
    return {
      mechanism,
      nextPhase:
        linked.length === 3
          ? "demonstrated-understanding"
          : "mechanism-interaction",
      feedback: `${grid.obstacle.obstacleId} receives grid ${obstacleIndex + 1}'s residual at course row ${grid.row.courseRow + 1}.`,
      recordVisit: true,
    };
  }
  return unchanged(context, "This lodge station has no QPixl operation.");
}

function unchanged(
  context: Parameters<
    SpatialTutorialConfig<
      SkiPixlLodgeMechanism,
      SkiPixlLodgeEvidence
    >["interact"]
  >[0],
  feedback: string,
): TutorialInteractionResult<SkiPixlLodgeMechanism> {
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

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function strongestHazard(
  row: SkiPixlDesignerRowEvidence,
): SkiPixlDesignerHazardEvidence | null {
  return (
    row.selectedHazards.reduce<SkiPixlDesignerHazardEvidence | null>(
      (strongest, hazard) =>
        strongest === null ||
        hazard.absoluteResidual > strongest.absoluteResidual
          ? hazard
          : strongest,
      null,
    ) ?? null
  );
}
