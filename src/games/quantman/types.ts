export const QUANTMAN_RULES_VERSION = "quantman-rules-v3";
export const QUANTMAN_TOPOLOGY_CHANGE_LIMIT = null;
export const QUANTMAN_SCORING = Object.freeze({
  pellet: 10,
  powerPellet: 50,
  pursuer: 200,
  observedRoute: 250,
  mazeWin: 500,
  remainingLife: 100,
});

export type QuantmanTone = "orange" | "avocado" | "blue" | "cream";
export type QuantmanPursuerRole = "direct" | "ambush" | "flank" | "wander";
export type QuantmanPhase = "active" | "won" | "lost";
export type QuantmanPursuerMode =
  | "patrol"
  | "chase"
  | "investigate"
  | "hesitate"
  | "frightened"
  | "returning";

export interface QuantmanCell {
  readonly row: number;
  readonly col: number;
}

export interface QuantmanFragment extends QuantmanCell {
  readonly fragmentId: string;
  readonly kind: "pellet" | "power";
}

export interface QuantmanTopologyDoor {
  readonly doorId: string;
  readonly row: number;
  readonly col: number;
  readonly orientation: "horizontal" | "vertical";
  readonly sourceRooms: readonly [number, number];
}

export interface QuantmanPursuerDefinition extends QuantmanCell {
  readonly pursuerId: string;
  readonly role: QuantmanPursuerRole;
  readonly speed: number;
  readonly basePerceptionTiles: number;
  readonly decisionIntervalTicks: number;
  readonly hesitationTicks: number;
  readonly tone: QuantmanTone;
  readonly patrol: readonly QuantmanCell[];
}

export interface QuantmanLabyrinthBlueprint {
  readonly gridRows: number;
  readonly gridCols: number;
  readonly numQubits: number;
  readonly roomOrder: "row-major";
  readonly couplingMap: readonly (readonly [number, number])[];
}

export interface QuantmanLabyrinthState {
  readonly stateId: string;
  readonly bitstring: string;
  readonly count: number;
  readonly logicalStateSha256: string;
}

export interface QuantmanLabyrinthAcquisition {
  readonly engineId: "labyrinth-v1";
  readonly engineUpdatedAt: string;
  readonly engineCanonicalSha256: string;
  readonly apiSpecificationCanonicalSha256: string;
  readonly jobIdentitySha256: string;
  readonly rawResultSha256: string;
  readonly requestSha256: string;
  readonly normalizedCountsSha256: string;
  readonly mode: "remote-simulator";
  readonly backend: "aer";
  readonly mothApi: true;
  readonly remoteService: true;
  readonly qpu: false;
  readonly requestedShots: number;
  readonly effectiveShots: number;
  readonly submittedAtUtc: string;
  readonly terminalObservedAtUtc: string;
  readonly retrievedAtUtc: string;
  readonly terminalStatus: "completed";
}

export interface QuantmanLabyrinthEnsemble {
  readonly schemaVersion: "quantum-rat-race-fixture-v2";
  readonly fixtureId: string;
  readonly fixtureSha256: string;
  readonly provenanceSha256: string;
  readonly sourceClassification: "moth-derived-preview";
  readonly rows: 4;
  readonly columns: 5;
  readonly numQubits: 20;
  readonly roomNumbering: "row-major";
  readonly bitstringOrder: "qubit-0-leftmost";
  readonly requestedShots: 128;
  readonly effectiveShots: 128;
  readonly countSum: 128;
  readonly decoder: Readonly<{
    id: "moth-labyrinth-zz-parity-v1";
    version: "1";
  }>;
  readonly couplingMap: readonly Readonly<{ a: number; b: number }>[];
  readonly states: readonly QuantmanLabyrinthState[];
  readonly acquisition: QuantmanLabyrinthAcquisition;
  readonly warnings: readonly string[];
}

export interface QuantmanPackPayload {
  readonly mazeId: string;
  readonly mazeLabel: string;
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly originX: number;
  readonly originY: number;
  readonly rows: readonly string[];
  readonly playerStart: QuantmanCell;
  readonly exit: QuantmanCell;
  readonly requiredFragments: number;
  readonly startingLives: number;
  readonly timeLimitSeconds: number;
  readonly playerSpeed: number;
  readonly fragments: readonly QuantmanFragment[];
  readonly tunnelRows: readonly number[];
  readonly labyrinthBlueprint: QuantmanLabyrinthBlueprint;
  readonly topologyDoors: readonly QuantmanTopologyDoor[];
  readonly labyrinthEnsemble: QuantmanLabyrinthEnsemble;
  readonly pursuers: readonly QuantmanPursuerDefinition[];
  readonly visualSeed: number;
}

export interface QuantmanInput {
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
  readonly observe: boolean;
}

export interface QuantmanDirection {
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
}

export interface QuantmanActorSnapshot {
  readonly x: number;
  readonly y: number;
  readonly facingX: -1 | 0 | 1;
  readonly facingY: -1 | 0 | 1;
}

export interface QuantmanPursuerSnapshot extends QuantmanActorSnapshot {
  readonly pursuerId: string;
  readonly role: QuantmanPursuerRole;
  readonly tone: QuantmanTone;
  readonly mode: QuantmanPursuerMode;
  readonly respawnTicks: number;
}

export interface QuantmanEvent {
  readonly eventId: number;
  readonly tick: number;
  readonly type:
    | "FRAGMENT_COLLECTED"
    | "POWER_PELLET_COLLECTED"
    | "PURSUER_EATEN"
    | "EXIT_UNLOCKED"
    | "EXIT_LOCKED"
    | "TOPOLOGY_OBSERVED"
    | "OBSERVATION_EMPTY"
    | "OBSERVATION_BLOCKED"
    | "ROUTE_EXPLOITED"
    | "PLAYER_CAUGHT"
    | "MAZE_WON"
    | "MAZE_LOST";
  readonly detail: string;
}

export interface QuantmanTopologyTransitionTrace {
  readonly observationIndex: number;
  readonly tick: number;
  readonly beforeStateId: string;
  readonly afterStateId: string;
  readonly heldDoorId: string;
  readonly heldDoorOpen: boolean;
  readonly changedDoorIds: readonly string[];
  readonly openedDoorIds: readonly string[];
  readonly closedDoorIds: readonly string[];
  readonly compatibleStateCount: number;
}

export interface QuantmanPlayerTraversalTrace {
  readonly traversalIndex: number;
  readonly tick: number;
  readonly kind: "move" | "respawn";
  readonly fromCell: QuantmanCell;
  readonly toCell: QuantmanCell;
  readonly topologyStateId: string;
  readonly doorId: string | null;
  readonly exploitedObservationIndex: number | null;
}

export interface QuantmanPursuerResponseTrace {
  readonly observationIndex: number;
  readonly tick: number;
  readonly topologyStateId: string;
  readonly pursuerId: string;
  readonly ownCell: QuantmanCell;
  readonly previousNextCell: QuantmanCell;
  readonly nextCell: QuantmanCell;
  readonly targetCell: QuantmanCell;
  readonly mode: QuantmanPursuerMode;
}

export interface QuantmanSnapshot {
  readonly phase: QuantmanPhase;
  readonly started: boolean;
  readonly tick: number;
  readonly secondsRemaining: number;
  readonly lives: number;
  readonly score: number;
  readonly player: QuantmanActorSnapshot;
  readonly pursuers: readonly QuantmanPursuerSnapshot[];
  readonly collectedFragmentIds: readonly string[];
  readonly fragmentsCollected: number;
  readonly totalFragments: number;
  readonly requiredFragments: number;
  readonly exitUnlocked: boolean;
  readonly invulnerableTicks: number;
  readonly currentRows: readonly string[];
  readonly topologyStateId: string;
  readonly observationCount: number;
  readonly observationsRemaining: null;
  readonly lastTopologyChangeCount: number;
  readonly frightenedTicks: number;
  readonly pursuerCombo: number;
  readonly openDoorIds: readonly string[];
  readonly observedDoorIds: readonly string[];
  readonly focusedDoorId: string;
  readonly focusedDoorOpen: boolean;
  readonly bufferedDirection: QuantmanDirection | null;
  readonly topologyTransitions: readonly QuantmanTopologyTransitionTrace[];
  readonly playerTraversal: readonly QuantmanPlayerTraversalTrace[];
  readonly pursuerResponses: readonly QuantmanPursuerResponseTrace[];
  readonly exploitedObservationIndices: readonly number[];
  readonly latestEvent: QuantmanEvent | null;
  readonly storyQualified: boolean;
}

export interface QuantmanDesignerTransitionEvidence {
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
}

export interface QuantmanDesignerEvidence {
  readonly packId: string;
  readonly contentSha256: string;
  readonly source: "moth-api-emulator";
  readonly fixtureId: string;
  readonly rawResultSha256: string;
  readonly executionMode: "remote-simulator";
  readonly backend: "aer";
  readonly observationIndex: number;
  readonly transitions: readonly QuantmanDesignerTransitionEvidence[];
}

export interface QuantmanPursuerObservation {
  readonly tick: number;
  readonly pursuerId: string;
  readonly ownCell: QuantmanCell;
  readonly visiblePlayerCell: QuantmanCell | null;
  readonly playerFacing: QuantmanDirection;
  readonly exitCell: QuantmanCell;
  readonly exitUnlocked: boolean;
  readonly rows: readonly string[];
  readonly patrol: readonly QuantmanCell[];
}

export interface QuantmanPursuerDecision {
  readonly mode: QuantmanPursuerMode;
  readonly nextCell: QuantmanCell;
  readonly targetCell: QuantmanCell;
  readonly playerVisible: boolean;
}
