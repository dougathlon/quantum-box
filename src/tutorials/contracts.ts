export const TUTORIAL_SNAPSHOT_VERSION = "qbox-spatial-tutorial-v1";
export const DEVELOPMENT_FIXTURE_LABEL =
  "DEVELOPMENT FIXTURE · NO STORY PROGRESS";

export type TutorialWorldId =
  | "qong-workshop"
  | "skipixl-lodge"
  | "fluxball-clubhouse"
  | "quantman-topology-room";

export type TutorialPhase =
  | "approach"
  | "true-morph"
  | "dialogue"
  | "spatial-exploration"
  | "mechanism-interaction"
  | "demonstrated-understanding"
  | "completion";

export type TileDirection = "up" | "down" | "left" | "right";

export type TutorialAction =
  | Readonly<{ type: "move"; direction: TileDirection }>
  | Readonly<{ type: "interact" }>
  | Readonly<{ type: "continue" }>;

export interface TilePosition {
  readonly row: number;
  readonly col: number;
}

export interface TutorialInteractionZone {
  readonly zoneId: string;
  readonly label: string;
  readonly tiles: readonly TilePosition[];
}

export interface TutorialWorldDefinition {
  readonly worldId: TutorialWorldId;
  readonly title: string;
  readonly collisionRows: readonly string[];
  readonly playerStart: TilePosition;
  readonly playerRole: "player-candidate-c";
  readonly designer: Readonly<{
    approachZoneId: "designer";
    initialRole: string;
    finalRole: "designer-wizard";
    morphSteps: number;
  }>;
  readonly interactionZones: readonly TutorialInteractionZone[];
  readonly dialogue: readonly string[];
}

export type TutorialEvidenceStatus =
  | "validated-run"
  | "development-fixture"
  | "unavailable";

export interface TutorialEvidenceGate<T> {
  readonly status: TutorialEvidenceStatus;
  readonly label: string;
  readonly storyProgressEligible: boolean;
  readonly reason: string | null;
  readonly value: T | null;
}

export interface TutorialEvidenceSummary {
  readonly status: TutorialEvidenceStatus;
  readonly label: string;
  readonly storyProgressEligible: boolean;
  readonly reason: string | null;
}

export interface TutorialSnapshot<TMechanism> {
  readonly version: typeof TUTORIAL_SNAPSHOT_VERSION;
  readonly worldId: TutorialWorldId;
  readonly phase: TutorialPhase;
  readonly player: Readonly<{
    role: "player-candidate-c";
    tile: TilePosition;
    facing: TileDirection;
    lastMoveBlocked: boolean;
  }>;
  readonly designer: Readonly<{
    role: string;
    morph: Readonly<{
      fromRole: string;
      toRole: "designer-wizard";
      step: number;
      stepCount: number;
    }> | null;
  }>;
  readonly activeZoneId: string | null;
  readonly dialogue: Readonly<{
    line: string;
    lineNumber: number;
    lineCount: number;
  }> | null;
  readonly feedback: string | null;
  readonly visitedZoneIds: readonly string[];
  readonly evidence: TutorialEvidenceSummary;
  readonly mechanism: TMechanism;
  readonly completion: Readonly<{
    worldComplete: boolean;
    demonstratedUnderstanding: boolean;
    storyProgressGranted: boolean;
  }>;
}

export interface TutorialInteractionContext<TMechanism, TEvidence> {
  readonly phase: "spatial-exploration" | "mechanism-interaction";
  readonly zoneId: string;
  readonly mechanism: TMechanism;
  readonly evidence: TutorialEvidenceGate<TEvidence>;
}

export interface TutorialInteractionResult<TMechanism> {
  readonly mechanism: TMechanism;
  readonly nextPhase:
    | "spatial-exploration"
    | "mechanism-interaction"
    | "demonstrated-understanding";
  readonly feedback: string;
  readonly recordVisit: boolean;
}

export interface SpatialTutorialConfig<TMechanism, TEvidence> {
  readonly definition: TutorialWorldDefinition;
  readonly evidence: TutorialEvidenceGate<TEvidence>;
  readonly initialMechanism: TMechanism;
  readonly interact: (
    context: TutorialInteractionContext<TMechanism, TEvidence>,
  ) => TutorialInteractionResult<TMechanism>;
}

const MOVEMENT: Readonly<Record<TileDirection, TilePosition>> = Object.freeze({
  up: Object.freeze({ row: -1, col: 0 }),
  down: Object.freeze({ row: 1, col: 0 }),
  left: Object.freeze({ row: 0, col: -1 }),
  right: Object.freeze({ row: 0, col: 1 }),
});

export class SpatialTutorialMachine<TMechanism, TEvidence> {
  private phase: TutorialPhase = "approach";
  private player: TilePosition;
  private facing: TileDirection = "up";
  private lastMoveBlocked = false;
  private morphStep = 0;
  private dialogueIndex = 0;
  private feedback: string | null = null;
  private mechanism: TMechanism;
  private readonly visitedZoneIds = new Set<string>();

  public constructor(
    private readonly config: SpatialTutorialConfig<TMechanism, TEvidence>,
  ) {
    validateDefinition(config.definition);
    this.player = { ...config.definition.playerStart };
    this.mechanism = config.initialMechanism;
  }

  public dispatch(action: TutorialAction): TutorialSnapshot<TMechanism> {
    if (this.phase === "completion") return this.snapshot();
    switch (action.type) {
      case "move":
        this.move(action.direction);
        break;
      case "continue":
        this.continueSequence();
        break;
      case "interact":
        this.interact();
        break;
    }
    return this.snapshot();
  }

  public snapshot(): TutorialSnapshot<TMechanism> {
    const definition = this.config.definition;
    const activeZoneId = zoneAt(definition, this.player)?.zoneId ?? null;
    const morph =
      this.phase === "true-morph"
        ? {
            fromRole: definition.designer.initialRole,
            toRole: definition.designer.finalRole,
            step: this.morphStep,
            stepCount: definition.designer.morphSteps,
          }
        : null;
    const designerRole =
      phaseRank(this.phase) >= phaseRank("dialogue")
        ? definition.designer.finalRole
        : definition.designer.initialRole;
    const dialogue =
      this.phase === "dialogue"
        ? {
            line: definition.dialogue[this.dialogueIndex]!,
            lineNumber: this.dialogueIndex + 1,
            lineCount: definition.dialogue.length,
          }
        : null;
    const demonstrated =
      phaseRank(this.phase) >= phaseRank("demonstrated-understanding");
    const complete = this.phase === "completion";
    return deepFreeze({
      version: TUTORIAL_SNAPSHOT_VERSION,
      worldId: definition.worldId,
      phase: this.phase,
      player: {
        role: definition.playerRole,
        tile: { ...this.player },
        facing: this.facing,
        lastMoveBlocked: this.lastMoveBlocked,
      },
      designer: { role: designerRole, morph },
      activeZoneId,
      dialogue,
      feedback: this.feedback,
      visitedZoneIds: [...this.visitedZoneIds].sort(),
      evidence: {
        status: this.config.evidence.status,
        label: this.config.evidence.label,
        storyProgressEligible: this.config.evidence.storyProgressEligible,
        reason: this.config.evidence.reason,
      },
      mechanism: this.mechanism,
      completion: {
        worldComplete: complete,
        demonstratedUnderstanding: demonstrated,
        storyProgressGranted:
          complete && this.config.evidence.storyProgressEligible,
      },
    });
  }

  private move(direction: TileDirection): void {
    if (!phaseAllowsMovement(this.phase)) return;
    this.facing = direction;
    const delta = MOVEMENT[direction];
    const next = {
      row: this.player.row + delta.row,
      col: this.player.col + delta.col,
    };
    if (!isWalkable(this.config.definition, next)) {
      this.lastMoveBlocked = true;
      return;
    }
    this.player = next;
    this.lastMoveBlocked = false;
  }

  private continueSequence(): void {
    if (this.phase === "true-morph") {
      this.morphStep += 1;
      if (this.morphStep >= this.config.definition.designer.morphSteps) {
        this.phase = "dialogue";
      }
      return;
    }
    if (this.phase !== "dialogue") return;
    if (this.dialogueIndex < this.config.definition.dialogue.length - 1) {
      this.dialogueIndex += 1;
    } else {
      this.phase = "spatial-exploration";
    }
  }

  private interact(): void {
    const zone = zoneAt(this.config.definition, this.player);
    if (!zone) {
      this.feedback = "Nothing here responds.";
      return;
    }
    if (this.phase === "approach") {
      if (zone.zoneId !== this.config.definition.designer.approachZoneId) {
        this.feedback = "Find the figure waiting in the room.";
        return;
      }
      this.feedback = null;
      this.phase =
        this.config.definition.designer.morphSteps > 0
          ? "true-morph"
          : "dialogue";
      return;
    }
    if (this.phase === "demonstrated-understanding") {
      if (zone.zoneId === this.config.definition.designer.approachZoneId) {
        this.phase = "completion";
        this.feedback = this.config.evidence.storyProgressEligible
          ? "Understanding recorded for Story progress."
          : `${this.config.evidence.label}; world completion recorded without Story progress.`;
      }
      return;
    }
    if (
      this.phase !== "spatial-exploration" &&
      this.phase !== "mechanism-interaction"
    ) {
      return;
    }
    const result = this.config.interact({
      phase: this.phase,
      zoneId: zone.zoneId,
      mechanism: this.mechanism,
      evidence: this.config.evidence,
    });
    if (!isAllowedPhaseTransition(this.phase, result.nextPhase)) {
      throw new Error(
        `Tutorial interaction cannot move from ${this.phase} to ${result.nextPhase}.`,
      );
    }
    this.mechanism = result.mechanism;
    this.phase = result.nextPhase;
    this.feedback = result.feedback;
    if (result.recordVisit) this.visitedZoneIds.add(zone.zoneId);
  }
}

export function validatedTutorialEvidence<T>(
  label: string,
  value: T,
): TutorialEvidenceGate<T> {
  return deepFreeze({
    status: "validated-run",
    label,
    storyProgressEligible: true,
    reason: null,
    value,
  });
}

export function developmentTutorialEvidence<T>(
  value: T,
): TutorialEvidenceGate<T> {
  return deepFreeze({
    status: "development-fixture",
    label: DEVELOPMENT_FIXTURE_LABEL,
    storyProgressEligible: false,
    reason: null,
    value,
  });
}

export function unavailableTutorialEvidence<T>(
  reason: string,
): TutorialEvidenceGate<T> {
  return deepFreeze({
    status: "unavailable",
    label: "REQUIRED RUN EVIDENCE UNAVAILABLE",
    storyProgressEligible: false,
    reason,
    value: null,
  });
}

export function moveActions(
  direction: TileDirection,
  count: number,
): readonly TutorialAction[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Tutorial move count must be a non-negative integer.");
  }
  return Object.freeze(
    Array.from({ length: count }, () =>
      Object.freeze({ type: "move", direction } as const),
    ),
  );
}

export const INTERACT_ACTION: TutorialAction = Object.freeze({
  type: "interact",
});
export const CONTINUE_ACTION: TutorialAction = Object.freeze({
  type: "continue",
});

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function validateDefinition(definition: TutorialWorldDefinition): void {
  const width = definition.collisionRows[0]?.length ?? 0;
  if (
    width === 0 ||
    definition.collisionRows.some(
      (row) => row.length !== width || /[^.#]/.test(row),
    )
  ) {
    throw new Error(`${definition.worldId} has an invalid collision map.`);
  }
  if (definition.playerRole !== "player-candidate-c") {
    throw new Error("Tutorial control belongs to Player Candidate C.");
  }
  if (!isWalkable(definition, definition.playerStart)) {
    throw new Error(`${definition.worldId} player start is blocked.`);
  }
  if (definition.dialogue.length === 0) {
    throw new Error(
      `${definition.worldId} requires concise in-world dialogue.`,
    );
  }
  if (
    !Number.isSafeInteger(definition.designer.morphSteps) ||
    definition.designer.morphSteps < 0
  ) {
    throw new Error(`${definition.worldId} has an invalid morph step count.`);
  }
  const ids = new Set<string>();
  const tiles = new Set<string>();
  for (const zone of definition.interactionZones) {
    if (ids.has(zone.zoneId) || zone.tiles.length === 0) {
      throw new Error(`${definition.worldId} has an invalid interaction zone.`);
    }
    ids.add(zone.zoneId);
    for (const tile of zone.tiles) {
      const key = tileKey(tile);
      if (!isWalkable(definition, tile) || tiles.has(key)) {
        throw new Error(
          `${definition.worldId} interaction tile ${key} is blocked or reused.`,
        );
      }
      tiles.add(key);
    }
  }
  if (!ids.has(definition.designer.approachZoneId)) {
    throw new Error(`${definition.worldId} is missing the Designer zone.`);
  }
}

function zoneAt(
  definition: TutorialWorldDefinition,
  tile: TilePosition,
): TutorialInteractionZone | null {
  return (
    definition.interactionZones.find((zone) =>
      zone.tiles.some(
        (candidate) => candidate.row === tile.row && candidate.col === tile.col,
      ),
    ) ?? null
  );
}

function isWalkable(
  definition: TutorialWorldDefinition,
  tile: TilePosition,
): boolean {
  return definition.collisionRows[tile.row]?.[tile.col] === ".";
}

function phaseAllowsMovement(phase: TutorialPhase): boolean {
  return (
    phase === "approach" ||
    phase === "spatial-exploration" ||
    phase === "mechanism-interaction" ||
    phase === "demonstrated-understanding"
  );
}

function isAllowedPhaseTransition(
  current: "spatial-exploration" | "mechanism-interaction",
  next:
    | "spatial-exploration"
    | "mechanism-interaction"
    | "demonstrated-understanding",
): boolean {
  return (
    current === next ||
    (current === "spatial-exploration" && next === "mechanism-interaction") ||
    (current === "mechanism-interaction" &&
      next === "demonstrated-understanding")
  );
}

function phaseRank(phase: TutorialPhase): number {
  return [
    "approach",
    "true-morph",
    "dialogue",
    "spatial-exploration",
    "mechanism-interaction",
    "demonstrated-understanding",
    "completion",
  ].indexOf(phase);
}

function tileKey(tile: TilePosition): string {
  return `${tile.row}:${tile.col}`;
}
