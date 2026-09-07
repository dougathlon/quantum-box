import type { FrozenPackIdentity } from "../../core/run";

export const STORY_V2_VERSION = "quantum-box-story-v2" as const;
export const STORY_V2_PRESENTATION_EVIDENCE_VERSION =
  "quantum-box-story-presentation-evidence-v1" as const;

export type StoryV2ChapterId =
  | "qong"
  | "skipixl"
  | "fluxball"
  | "quantman"
  | "quarry";

export type StoryV2StageId =
  | "qong"
  | "skipixl-medium"
  | "skipixl"
  | "fluxball-two"
  | "fluxball-four"
  | "quantman-stabilize"
  | "quantman"
  | "quarry";

export type StoryV2RuntimeGameId =
  | "qong"
  | "skipixl"
  | "fluxball"
  | "quantman"
  | "quarry";

export type StoryV2Qualification =
  | "match-win"
  | "descent-finish"
  | "screen-clear"
  | "unique-score-leader";

export interface StoryV2LaunchDescriptor {
  readonly runtimeGameId: StoryV2RuntimeGameId;
  readonly arcadeMode: string;
}

export interface StoryV2StageDefinition {
  readonly id: StoryV2StageId;
  readonly ordinal: number;
  readonly chapterId: StoryV2ChapterId;
  readonly chapterStep: number;
  readonly chapterStepCount: number;
  readonly title: string;
  readonly launch: StoryV2LaunchDescriptor;
  readonly qualification: StoryV2Qualification;
  readonly presentationFlowId: StoryV2PresentationFlowId;
}

export interface StoryV2ChapterDefinition {
  readonly id: StoryV2ChapterId;
  readonly ordinal: number;
  readonly title: string;
  readonly stageIds: readonly StoryV2StageId[];
  readonly workshopEngineId:
    | "coin-toss-v1"
    | "qpixl-v1"
    | "graph-v1"
    | "labyrinth-v1";
}

export type StoryV2PresentationFlowId =
  | "qong-den"
  | "skipixl-medium-handoff"
  | "skipixl-cabin"
  | "fluxball-two-handoff"
  | "fluxball-office"
  | "quantman-stabilize-handoff"
  | "quantman-ghost-den"
  | "quarry-finale";

export type StoryV2BeatKind =
  | "morph"
  | "walk"
  | "explore"
  | "dialogue"
  | "door"
  | "dismount"
  | "transport"
  | "terminal"
  | "workshop";

export type StoryV2AssetCue =
  | "professor-idle"
  | "professor-walk"
  | "professor-talk"
  | "professor-open-door"
  | "professor-point"
  | "qong-paddle-to-professor"
  | "qong-paddle-to-player-c"
  | "quantman-ghost-c-to-professor"
  | "quarry-duck-d-to-professor"
  | "player-c-front-idle";

export interface StoryV2PresentationBeat {
  readonly id: string;
  readonly kind: StoryV2BeatKind;
  readonly speaker: "THE DESIGNER" | null;
  readonly lines: readonly string[];
  readonly assetCue: StoryV2AssetCue | null;
  readonly terminalPageId: string | null;
  readonly prompt: "SPACE · CONTINUE";
}

export type StoryV2PresentationCompletion =
  | Readonly<{
      kind: "launch-stage";
      completedStageId: StoryV2StageId;
      nextStageId: StoryV2StageId;
    }>
  | Readonly<{
      kind: "return-to-menu";
      completedStageId: StoryV2StageId;
      completedChapterId: StoryV2ChapterId;
      workshopEngineId:
        | "coin-toss-v1"
        | "qpixl-v1"
        | "graph-v1"
        | "labyrinth-v1";
    }>
  | Readonly<{
      kind: "complete-story";
      completedStageId: "quarry";
      completedChapterId: "quarry";
      workshopEngineId: "graph-v1";
      unlockExternalLinkId: "moth-platform";
    }>;

export interface StoryV2PresentationFlow {
  readonly id: StoryV2PresentationFlowId;
  readonly stageId: StoryV2StageId;
  readonly beats: readonly StoryV2PresentationBeat[];
  readonly completion: StoryV2PresentationCompletion;
}

export interface StoryV2ResumeToken {
  readonly schemaVersion: typeof STORY_V2_VERSION;
  readonly stageId: StoryV2StageId;
  readonly flowId: StoryV2PresentationFlowId;
  readonly beatId: string;
}

export type StoryV2PresentationEvidenceSource =
  | "recorded-moth-qpu"
  | "recorded-moth-platform-qpu-capture"
  | "local-synthetic-control";

export interface StoryV2PresentationEvidenceIdentity {
  readonly runId: string;
  readonly stageId: StoryV2StageId;
  readonly rulesVersion: string;
  readonly runSeed: number;
  readonly activeTick: number;
  readonly qualificationEvidenceSha256: string;
  readonly pack: FrozenPackIdentity;
}

export interface StoryV2QongEvidenceDetail {
  readonly kind: "qong";
  readonly sourceStatus: "recorded-moth-qpu";
  readonly selector: Readonly<{
    selectorPackId: string;
    selectorContentSha256: string;
    bitIndices: readonly [number, number];
    bits: readonly [0 | 1, 0 | 1];
    selectedPackIndex: number;
    selectedPackId: string;
    selectedPackContentSha256: string;
  }>;
  readonly storedResult: Readonly<{
    rallyNumber: number;
    bit: 0 | 1;
    outcome: "heads" | "tails";
    mappedGoal: "OPPOSITE" | "OWN";
    mothJobId: string;
    hardwareJobId: string;
    backendName: string;
    rawResultSha256: string;
  }>;
  /** Exact frozen court needed to resume the in-world transition after reload. */
  readonly finalCourt?: Readonly<{
    tick: number;
    rallyNumber: number;
    totalRallies: number;
    leftScore: number;
    rightScore: number;
    observationsRemaining: number;
    measurementState: "unresolved" | "measuring" | "resolved";
    goalRule: "unresolved" | "opposite" | "own";
    ball: Readonly<{ x: number; y: number }>;
    leftPaddleY: number;
    rightPaddleY: number;
    winner: "left" | "right" | null;
  }>;
}

export interface StoryV2SkiPixlEvidenceDetail {
  readonly kind: "skipixl";
  readonly sourceStatus: "recorded-moth-platform-qpu-capture";
  readonly tripletId: string;
  readonly cutId: "P90" | "P84" | "P78";
  readonly decoderVersion: string;
  readonly bankId: string;
  readonly bankContentSha256: string;
  readonly selectionThreshold: number;
  /** Absent only on pending presentation evidence saved before this release. */
  readonly attempt?: Readonly<{
    qualified: boolean;
    elapsedSeconds: number;
    collisionCount: number;
    gateCount: number;
    passedGateCount: number;
    missedGateCount: number;
  }>;
  readonly segments: readonly Readonly<{
    segmentId: string;
    sourceSha256: string;
    returnedValuesSha256: string;
    mothJobId: string;
    ibmJobId: string;
  }>[];
  readonly mappedExample: Readonly<{
    segmentId: string;
    cellIndex: number;
    residual: number;
    kind: "tree" | "rock";
    obstacleId: string;
    x: number;
    distance: number;
    gateId: string | null;
  }>;
}

export interface StoryV2FluxballEvidenceDetail {
  readonly kind: "fluxball";
  readonly sourceStatus: "recorded-moth-qpu" | "local-synthetic-control";
  readonly ruleMode: "global" | "individual";
  readonly fixtureBankId: string;
  readonly fixtureId: string;
  readonly acquisitionSource: string;
  readonly roundNumber: number;
  readonly stateIndex: number;
  readonly sourceRoundBuckets: readonly [number, number];
  readonly provider: Readonly<{
    mothJobId: string;
    ibmJobId: string | null;
    backendName: string | null;
    rawResultSha256: string | null;
  }> | null;
  readonly mappedAxes: readonly Readonly<{
    dimension: "ACTION" | "INTERACTION" | "PURPOSE";
    outcome: string;
    playerRules: readonly string[];
  }>[];
}

export interface StoryV2QuantmanEvidenceDetail {
  readonly kind: "quantman";
  readonly sourceStatus: "recorded-moth-qpu";
  readonly mechanic: "stabilize-gaze" | "inverse-gaze";
  /** Optional only so already-persisted v5 evidence remains readable. */
  readonly bank?: Readonly<{
    schemaVersion: "quantum-box-quantman-qpu-bank-v3";
    bankId: string;
    selectionMethod: "topology-sequence-and-seeded-capture-v3";
    contentSha256: string;
  }>;
  /** Optional only so already-persisted v5 evidence remains readable. */
  readonly topology?: Readonly<{
    topologyId: string;
    label: string;
    authoredTopologySha256: string;
    captureCount: number;
  }>;
  readonly fixtureId: string;
  readonly fixtureContentSha256: string;
  readonly provider: Readonly<{
    engineId: "labyrinth-v1";
    mothJobId: string;
    hardwareJobId: string;
    backendName: string;
    rawResultSha256: string;
    redactedRequestSha256: string;
    captureContentSha256: string;
    requestedShots: number;
    returnedMeasurementCount: number;
  }>;
  readonly filtering: Readonly<{
    filterId: string;
    admittedRecordCount: number;
    admittedWeight: number;
    excludedRecordCount: number;
    excludedWeight: number;
  }>;
  readonly bitParityExample: Readonly<{
    recordIndex: number;
    roomA: number;
    roomB: number;
    bitA: 0 | 1;
    bitB: 0 | 1;
    equalParity: boolean;
    passage: "OPEN" | "WALL";
  }>;
}

export interface StoryV2QuarryEvidenceDetail {
  readonly kind: "quarry";
  readonly sourceStatus: "recorded-moth-qpu";
  readonly arenaId: string;
  readonly remeasurementIntervalTicks: number;
  readonly bitOrdering: string;
  readonly sampledSchedule: readonly Readonly<{
    phase: number;
    frameId: string;
    bitstring: string;
    directedRelations: readonly string[];
  }>[];
  readonly relationExample: Readonly<{
    phase: number;
    frameId: string;
    edge: string;
  }>;
  readonly provider: Readonly<{
    /** Added by the 24-pack corpus; absent only in retained pre-corpus evidence. */
    selectedPackId?: string;
    selectedPackContentSha256?: string;
    selectedPackIndex?: number;
    recipeFamily?: string;
    realizationId?: string;
    sourceBankId?: string;
    sourceBankContentSha256?: string;
    sourceCampaignId?: string;
    sourceBankVersion?: string;
    redactedRequestSha256?: string;
    captureContentSha256?: string;
    mothJobId: string;
    hardwareJobId: string;
    backendName: string;
    rawResultSha256: string;
    requestedShots: number;
    returnedShotCount: number;
    returnedMeasurementCount: number;
    returnedProbabilityMass: number;
    distributionProjection: "provider-returned-top-outcomes-v1";
  }>;
  readonly claimBoundary: string;
}

export type StoryV2PresentationEvidenceDetail =
  | StoryV2QongEvidenceDetail
  | StoryV2SkiPixlEvidenceDetail
  | StoryV2FluxballEvidenceDetail
  | StoryV2QuantmanEvidenceDetail
  | StoryV2QuarryEvidenceDetail;

/**
 * Frozen at qualification time and saved with the pending narrative beat.
 * Legacy pending beats retain run identity but never gain invented provider data.
 */
export interface StoryV2PresentationEvidence {
  readonly schemaVersion: typeof STORY_V2_PRESENTATION_EVIDENCE_VERSION;
  readonly completeness: "bound" | "legacy-identity-only";
  readonly identity: StoryV2PresentationEvidenceIdentity;
  readonly detail: StoryV2PresentationEvidenceDetail | null;
  readonly limitations: readonly string[];
}

export interface StoryV2PresentationSnapshot {
  readonly schemaVersion: typeof STORY_V2_VERSION;
  readonly stageId: StoryV2StageId;
  readonly chapterId: StoryV2ChapterId;
  readonly flowId: StoryV2PresentationFlowId;
  readonly beat: StoryV2PresentationBeat | null;
  readonly beatIndex: number;
  readonly beatCount: number;
  readonly completed: boolean;
  readonly resumeToken: StoryV2ResumeToken | null;
  readonly evidence: StoryV2PresentationEvidence | null;
}

export interface StoryV2DispatchResult {
  readonly snapshot: StoryV2PresentationSnapshot;
  readonly completion: StoryV2PresentationCompletion | null;
}
