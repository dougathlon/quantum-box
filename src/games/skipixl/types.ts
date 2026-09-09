export const SKIPIXL_RULES_VERSION = "skipixl-rules-v8";
export const SKIPIXL_PREVIOUS_RULES_VERSION = "skipixl-rules-v7";
export const SKIPIXL_V6_RULES_VERSION = "skipixl-rules-v6";
export const SKIPIXL_V5_RULES_VERSION = "skipixl-rules-v5";
export const SKIPIXL_PRIOR_RULES_VERSION = "skipixl-rules-v4";
export const SKIPIXL_LEGACY_RULES_VERSION = "skipixl-rules-v3";
export const SKIPIXL_EARLIEST_RULES_VERSION = "skipixl-rules-v2";
export const SKIPIXL_READY_TICKS = 3 * 60;

export type SkiPixlObstacleKind = "tree" | "rock";
export type SkiPixlPhase = "ready" | "active" | "complete";
export type SkiPixlSteeringAngle = -3 | -2 | -1 | 0 | 1 | 2 | 3;
export type SkiPixlCutId = "P90" | "P84" | "P78";
export type SkiPixlDifficulty = "easy" | "medium" | "hard";

export interface SkiPixlGate {
  readonly gateId: string;
  readonly distance: number;
  readonly centerX: number;
  readonly leftX: number;
  readonly rightX: number;
  readonly sourceObstacleId: string;
  readonly segmentId: string;
  readonly cellIndex: number;
  readonly residual: number;
}

export interface SkiPixlGateResult {
  readonly gateId: string;
  readonly passed: boolean;
  readonly skierX: number;
  readonly penaltyTicks: number;
}

export interface SkiPixlCourseReceiptV5 {
  readonly schemaVersion: "skipixl-course-receipt-v5";
  readonly bankId: string;
  readonly bankContentSha256: string;
  readonly decoderVersion: string;
  readonly tripletId: string;
  readonly cutId: SkiPixlCutId;
  readonly difficulty: SkiPixlDifficulty;
  readonly residualDefinition: string;
  readonly rowSelection: string;
  readonly kindMapping: string;
  readonly spatialOffsetRule: string;
  readonly gateRule: string;
  readonly selectionPercentile: number;
  readonly selectionThreshold: number;
  readonly obstacleCount: number;
  readonly gateCount: number;
  readonly treeObstacleCount: number;
  readonly mogulObstacleCount: number;
  readonly denseRowCount: number;
  readonly saturatedRowCount: number;
  readonly difficultyScore: number;
  readonly timeRule: string;
  readonly segments: readonly SkiPixlSegmentReceipt[];
}

export interface SkiPixlCourseReceiptV6
  extends Omit<SkiPixlCourseReceiptV5, "schemaVersion"> {
  readonly schemaVersion: "skipixl-course-receipt-v6";
  readonly courseLengthRule: string;
}

export interface SkiPixlCourseReceiptV7
  extends Omit<SkiPixlCourseReceiptV6, "schemaVersion"> {
  readonly schemaVersion: "skipixl-course-receipt-v7";
}

export interface SkiPixlCourseReceiptV8
  extends Omit<SkiPixlCourseReceiptV7, "schemaVersion"> {
  readonly schemaVersion: "skipixl-course-receipt-v8";
}

export interface SkiPixlSegmentReceipt {
  readonly order: number;
  readonly segmentId: string;
  readonly sourceIdentity: string;
  readonly sourceSha256: string;
  readonly sourcePixelSha256: string;
  readonly mothJobId: string;
  readonly ibmJobId: string;
  readonly resultArtifactSha256: string;
  readonly returnedValuesSha256: string;
}

export interface SkiPixlCourseReceiptV4 {
  readonly schemaVersion: "skipixl-course-receipt-v4";
  readonly bankId: string;
  readonly bankContentSha256: string;
  readonly decoderVersion: string;
  readonly tripletId: string;
  readonly cutId: SkiPixlCutId;
  readonly residualDefinition: string;
  readonly rowSelection: string;
  readonly kindMapping: string;
  readonly spatialOffsetRule: string;
  readonly selectionPercentile: number;
  readonly selectionThreshold: number;
  readonly obstacleCount: number;
  readonly treeObstacleCount: number;
  readonly mogulObstacleCount: number;
  readonly denseRowCount: number;
  readonly saturatedRowCount: number;
  readonly difficultyScore: number;
  readonly timeRule: string;
  readonly segments: readonly SkiPixlSegmentReceipt[];
}

export interface SkiPixlCourseReceiptV3 {
  readonly schemaVersion: "skipixl-course-receipt-v3";
  readonly bankId: string;
  readonly bankContentSha256: string;
  readonly decoderVersion: string;
  readonly residualDefinition: string;
  readonly rowSelection: string;
  readonly kindMapping: string;
  readonly selectionPercentile: number;
  readonly selectionThreshold: number;
  readonly obstacleCount: number;
  readonly treeObstacleCount: number;
  readonly mogulObstacleCount: number;
  readonly denseRowCount: number;
  readonly saturatedRowCount: number;
  readonly difficultyScore: number;
  readonly timeRule: string;
  readonly segments: readonly SkiPixlSegmentReceipt[];
}

export type SkiPixlCourseReceipt =
  | SkiPixlCourseReceiptV8
  | SkiPixlCourseReceiptV7
  | SkiPixlCourseReceiptV6
  | SkiPixlCourseReceiptV5
  | SkiPixlCourseReceiptV4
  | SkiPixlCourseReceiptV3;

export interface SkiPixlObstacle {
  readonly obstacleId: string;
  readonly row: number;
  readonly distance: number;
  readonly baseDistance?: number;
  readonly downhillOffset?: number;
  readonly column: number;
  readonly x: number;
  readonly baseX?: number;
  readonly horizontalOffset?: number;
  readonly kind: SkiPixlObstacleKind;
  readonly segmentId: string;
  readonly cellIndex: number;
  readonly residual: number;
  readonly absoluteResidual: number;
  readonly offsetSourceCellIndexes?: readonly [number, number, number, number];
  readonly rowHazardIndex: number;
  readonly rowHazardCount: number;
}

export interface SkiPixlPackPayload {
  readonly courseId: string;
  readonly courseLabel: string;
  readonly decoderVersion: string;
  readonly tripletId?: string;
  readonly cutId?: SkiPixlCutId;
  readonly difficulty?: SkiPixlDifficulty;
  readonly courseLength: number;
  readonly corridorMinX: number;
  readonly corridorMaxX: number;
  readonly cruiseSpeed: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly parSeconds: number;
  readonly winSeconds: number;
  readonly difficultyScore: number;
  readonly rowSpacing: number;
  readonly obstacles: readonly SkiPixlObstacle[];
  readonly gates?: readonly SkiPixlGate[];
  readonly receipt: SkiPixlCourseReceipt;
}

export interface SkiPixlDesignerRowEvidence {
  readonly segmentOrder: number;
  readonly segmentId: string;
  readonly localRow: number;
  readonly courseRow: number;
  readonly selectionThreshold: number;
  readonly selectedHazards: readonly SkiPixlDesignerHazardEvidence[];
}

export interface SkiPixlDesignerHazardEvidence {
  readonly obstacleId: string;
  readonly column: number;
  readonly cellIndex: number;
  readonly sourceByte: number;
  readonly sourceValue: number;
  readonly returnedValue: number;
  readonly residual: number;
  readonly absoluteResidual: number;
  readonly kind: SkiPixlObstacleKind;
  readonly x: number;
  readonly distance: number;
  readonly horizontalOffset: number;
  readonly downhillOffset: number;
  readonly offsetSourceCellIndexes: readonly [number, number, number, number];
}

export interface SkiPixlDesignerEvidence {
  readonly packId: string;
  readonly contentSha256: string;
  readonly source: "moth-platform-qpu-capture";
  readonly decoderVersion: string;
  readonly tripletId: string;
  readonly cutId: SkiPixlCutId;
  readonly selectionPercentile: number;
  readonly selectionThreshold: number;
  readonly obstacleCount: number;
  readonly treeObstacleCount: number;
  readonly mogulObstacleCount: number;
  readonly denseRowCount: number;
  readonly saturatedRowCount: number;
  readonly difficultyScore: number;
  readonly winSeconds: number;
  readonly sampledLocalRows: readonly number[];
  readonly segments: readonly (readonly SkiPixlDesignerRowEvidence[])[];
}

export interface SkiPixlInput {
  readonly steer: -1 | 0 | 1;
  readonly throttle: -1 | 0 | 1;
}

export interface SkiPixlCollision {
  readonly obstacleId: string;
  readonly kind: SkiPixlObstacleKind;
  readonly skierX: number;
  readonly penaltyTicks: number;
}

export interface SkiPixlSnapshot {
  readonly phase: SkiPixlPhase;
  readonly tick: number;
  readonly readyTicksRemaining: number;
  readonly elapsedTicks: number;
  readonly elapsedSeconds: number;
  readonly targetSeconds: number;
  readonly secondsRemaining: number;
  readonly distance: number;
  readonly courseLength: number;
  readonly speed: number;
  readonly skierX: number;
  readonly lateralVelocity: number;
  readonly steeringAngle: SkiPixlSteeringAngle;
  readonly obstaclesResolved: number;
  readonly gatesResolved: number;
  readonly gatePenaltyTicks: number;
  readonly gateResults: readonly SkiPixlGateResult[];
  readonly latestGate: SkiPixlGateResult | null;
  readonly collisions: readonly SkiPixlCollision[];
  readonly latestCollision: SkiPixlCollision | null;
  readonly knockdownTicksRemaining: number;
  readonly storyQualified: boolean;
  readonly finishedUnderPar: boolean;
  readonly receipt: SkiPixlCourseReceipt;
}
