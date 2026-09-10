import type { DirectionName } from "../labyrinth/types";

export type SessionPhase = "ready" | "active" | "won" | "lost";
export type CollectibleKind = "pellet" | "wall-pass" | "ghost-eat";
export type GhostRole = "direct" | "ambush" | "flank" | "distance";
export type GhostMode = "chase" | "frightened" | "respawning" | "waiting";
export type MazeMechanic = "inverse-gaze" | "stabilize-gaze";
export type GazeStatus =
  | "charging"
  | "applied"
  | "deferred"
  | "perimeter"
  | "stabilizing";

export interface SemanticInput {
  readonly direction: DirectionName | null;
  readonly start: boolean;
}

export interface Collectible {
  readonly room: number;
  readonly kind: CollectibleKind;
}

export interface ActorSnapshot {
  readonly room: number;
  readonly nextRoom: number | null;
  readonly progress: number;
  readonly row: number;
  readonly col: number;
  readonly facing: DirectionName;
  readonly movementDirection: DirectionName | null;
  readonly crossingEdgeIndex: number | null;
}

export interface GhostSnapshot extends ActorSnapshot {
  readonly id: string;
  readonly role: GhostRole;
  readonly mode: GhostMode;
  readonly respawnTicks: number;
  readonly decisions: number;
  readonly edgesCrossed: number;
  readonly lastTargetRoom: number;
  readonly lastDecisionEdgeWasOpen: boolean;
}

export interface TopologyTransition {
  readonly activeTick: number;
  readonly mechanic: MazeMechanic;
  readonly fromId: string;
  readonly toId: string;
  readonly compatibleCount: number;
  readonly observedEdgeIndices: readonly number[];
  readonly heldEdgeIndices: readonly number[];
  readonly changedEdgeIndices: readonly number[];
  readonly targetEdgeIndex: number | null;
  readonly targetFromWall: boolean | null;
  readonly targetToWall: boolean | null;
}

export interface CompletionRecord {
  readonly outcome: "LEVEL_CLEARED";
  readonly runSeed: number;
  readonly score: number;
  readonly remainingLives: number;
  readonly simulationTicks: number;
  readonly fixtureId: string;
  readonly fixtureSha256: string;
  readonly mechanic: MazeMechanic;
}

export interface SessionSnapshot {
  readonly phase: SessionPhase;
  readonly mechanic: MazeMechanic;
  readonly runSeed: number;
  readonly tick: number;
  readonly activeTick: number;
  readonly score: number;
  readonly lives: number;
  readonly player: ActorSnapshot;
  readonly ghosts: readonly GhostSnapshot[];
  readonly wallPassTicks: number;
  readonly ghostEatTicks: number;
  readonly ghostCombo: number;
  readonly collectedRooms: readonly number[];
  readonly remainingCollectibles: number;
  readonly collectibleKinds: readonly CollectibleKind[];
  readonly topologyId: string;
  readonly topologyBankSize: number;
  readonly topologyWallMask: string;
  readonly topologyBitstring: string;
  readonly topologyTicks: number;
  readonly topologyHistory: readonly string[];
  readonly rngState: number;
  readonly compatibleCount: number;
  readonly observedEdgeIndices: readonly number[];
  readonly heldEdgeIndices: readonly number[];
  readonly changedEdgeIndices: readonly number[];
  readonly gazeTargetEdgeIndex: number | null;
  readonly gazeTargetFromWall: boolean | null;
  readonly gazeTargetToWall: boolean | null;
  readonly gazeDwellTicks: number;
  readonly gazeStatus: GazeStatus;
  readonly interventionCount: number;
  readonly invariantFailureCount: number;
  readonly diagnostics: readonly string[];
  readonly ghostDecisions: number;
  readonly ghostEdgesCrossed: number;
  readonly powersCollected: Readonly<Record<"wall-pass" | "ghost-eat", number>>;
  readonly ghostsEaten: number;
  readonly completion: CompletionRecord | null;
}

export interface SessionOptions {
  readonly mechanic?: MazeMechanic;
  readonly ghostsEnabled?: boolean;
  readonly playerStartRoom?: number;
  readonly ghostStartRooms?: readonly [number, number, number, number];
  readonly ghostReleaseTicks?: readonly [number, number, number, number];
  readonly initialTopologyIndex?: number;
  readonly initialCollectedRooms?: readonly number[];
  readonly collectibleKinds?: readonly CollectibleKind[];
  readonly startingLives?: number | undefined;
  readonly startingScore?: number | undefined;
}

export const NO_INPUT: SemanticInput = Object.freeze({
  direction: null,
  start: false,
});
