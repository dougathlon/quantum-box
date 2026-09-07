export type DirectionName = "up" | "right" | "down" | "left";

export interface RoomCoordinate {
  readonly row: number;
  readonly col: number;
}

export interface DirectionVector {
  readonly row: -1 | 0 | 1;
  readonly col: -1 | 0 | 1;
}

export interface RoomEdge {
  readonly index: number;
  readonly id: string;
  readonly a: number;
  readonly b: number;
  readonly aCoordinate: RoomCoordinate;
  readonly bCoordinate: RoomCoordinate;
  readonly midpointDoubled: Readonly<{ x: number; y: number }>;
}

export interface LabyrinthRawRecord {
  readonly bitstring: string;
  readonly weight: number;
}

export interface LabyrinthProvenance {
  readonly sourceType: "synthetic" | "qpu";
  readonly label: string;
  readonly generatorOrProvider: string;
  readonly acquisitionOrGenerationDate: string;
  readonly engineId?: "labyrinth-v1";
  readonly backend?: string;
  readonly jobId?: string;
  readonly mothJobId?: string;
  readonly hardwareJobId?: string;
  readonly rawResultSha256?: string;
  readonly shots?: number;
  readonly limits: readonly string[];
}

export interface LabyrinthAdmissibilityCriteria {
  readonly playerStartRoom: 95;
  readonly minimumPlayerComponentRooms: 12;
  readonly wallPassRooms: readonly [0, 9, 90, 99];
  readonly ghostReleaseRoom: 35;
  readonly minimumGhostReleaseComponentRooms: 4;
  readonly ghostHomeRooms: readonly [44, 45, 54, 55];
  readonly maximumIsolatedPlayableRooms: 10;
  readonly requireOpenAndClosedPlayableEdges: true;
  readonly requireFullEnsembleRoomCoverage: true;
  readonly requireEveryPlayableEdgeVariable: true;
}

export interface LabyrinthAdmissibilitySummary {
  readonly returnedRecordCount: number;
  readonly returnedWeight: number;
  readonly admittedRecordCount: number;
  readonly admittedWeight: number;
  readonly excludedRecordCount: number;
  readonly excludedWeight: number;
  readonly playableRoomCount: number;
  readonly playableEdgeCount: number;
  readonly ensembleReachableRoomCount: number;
  readonly ensembleVariableEdgeCount: number;
}

export interface LabyrinthAdmissibilityIndex {
  readonly schemaVersion: "quantman-admissibility-index-v1";
  readonly filterId: "quantman-demo-playability-v1";
  readonly runtimeEligible: boolean;
  readonly criteria: LabyrinthAdmissibilityCriteria;
  readonly admittedRecordIndices: readonly number[];
  readonly summary: LabyrinthAdmissibilitySummary;
}

export interface LabyrinthFixture {
  readonly schemaVersion: "labyrinth-measurement-bank-v1";
  readonly fixtureId: string;
  readonly width: number;
  readonly height: number;
  readonly bitOrder: "row-major-room-index";
  readonly parityRule: "equal-open-unequal-wall";
  readonly contentSha256: string;
  readonly provenance: LabyrinthProvenance;
  readonly records: readonly LabyrinthRawRecord[];
}

export interface QuantmanQpuFixtureAuthority {
  readonly schemaVersion: "quantman-qpu-fixture-authority-v1";
  readonly fixtureId: string;
  readonly fixtureContentSha256: string;
  readonly campaignId: string;
  readonly targetId: string;
  readonly engineId: "labyrinth-v1";
  readonly engineCanonicalSha256: string;
  readonly engineUpdatedAt: string;
  readonly apiSpecification: Readonly<{
    version: string;
    canonicalSha256: string;
  }>;
  readonly mode: "qpu";
  readonly numQubits: 100;
  readonly gridSize: Readonly<{ rows: 10; cols: 10 }>;
  readonly bitOrder: "row-major-room-index";
  readonly backend: "ibm_fez";
  readonly mothJobId: string;
  readonly hardwareJobId: string;
  readonly submittedAt: string;
  readonly retrievedAtUtc: string;
  readonly providerUpdatedAt: string;
  readonly requestedShots: number;
  readonly returnedShots: number;
  readonly redactedRequest: Readonly<{
    params: Readonly<Record<string, unknown>>;
  }>;
  readonly redactedRequestSha256: string;
  readonly rawResultSha256: string;
  readonly captureContentSha256: string;
  readonly terminalObservedAtUtc: string;
  readonly terminalStatusSha256: string;
  readonly claimBoundary: string;
  readonly admissibility: LabyrinthAdmissibilityIndex;
  readonly contentSha256: string;
}

export interface QuantmanMazeTopology {
  readonly schemaVersion: "quantman-authored-maze-topology-v1";
  readonly topologyId: string;
  readonly label: string;
  readonly courseOrder: number;
  readonly gridSize: Readonly<{ rows: 10; cols: 10 }>;
  readonly numQubits: 100;
  readonly corridorCount: 99;
  readonly couplingMap: readonly (readonly [number, number])[];
  readonly authoredTopologySha256: string;
  readonly captureFixtureIds: readonly string[];
  readonly contentSha256: string;
}

export interface QuantmanQpuFixtureSelection {
  readonly bank: Readonly<{
    schemaVersion: "quantum-box-quantman-qpu-bank-v3";
    bankId: string;
    selectionMethod: "topology-sequence-and-seeded-capture-v3";
    contentSha256: string;
  }>;
  readonly topology: QuantmanMazeTopology;
  readonly fixture: LabyrinthFixture;
  readonly authority: QuantmanQpuFixtureAuthority;
}

export interface CompiledTopology {
  readonly id: string;
  readonly wallMask: string;
  readonly representativeBitstring: string;
  readonly weight: number;
  readonly rawRecordIndices: readonly number[];
}

export interface EdgeConstraint {
  readonly edgeIndex: number;
  readonly wall: boolean;
}

export const DIRECTION_VECTORS: Readonly<
  Record<DirectionName, DirectionVector>
> = Object.freeze({
  up: Object.freeze({ row: -1, col: 0 }),
  right: Object.freeze({ row: 0, col: 1 }),
  down: Object.freeze({ row: 1, col: 0 }),
  left: Object.freeze({ row: 0, col: -1 }),
});
