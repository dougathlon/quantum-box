import legacyCatalogRecord from "./data/skipixl-chaos-schedules-v1.json" with { type: "json" };
import priorResidualCutCatalogRecord from "./data/skipixl-residual-cuts-v4.json" with { type: "json" };
import earlierResidualCutCatalogRecord from "./data/skipixl-residual-cuts-v5.json" with { type: "json" };
import v6ResidualCutCatalogRecord from "./data/skipixl-residual-cuts-v6.json" with { type: "json" };
import previousResidualCutCatalogRecord from "./data/skipixl-residual-cuts-v7.json" with { type: "json" };
import v8ResidualCutCatalogRecord from "./data/skipixl-residual-cuts-v8.json" with { type: "json" };
import residualCutCatalogRecord from "./data/skipixl-residual-cuts-v9.json" with { type: "json" };
import segmentBankRecord from "./data/qpixl-b3-segments-v1.json" with { type: "json" };
import { canonicalJson } from "../../core/canonicalJson";
import { PACK_SCHEMA_VERSION, type CommittedPack } from "../../packs/types";
import { validateCommittedPack } from "../../packs/validatePack";
import { SKIPIXL_CHALLENGE_PROFILE } from "./SkiPixlChallenge";
import {
  SKIPIXL_LEGACY_RULES_VERSION,
  SKIPIXL_PREVIOUS_RULES_VERSION,
  SKIPIXL_PRIOR_RULES_VERSION,
  SKIPIXL_RULES_VERSION,
  SKIPIXL_V5_RULES_VERSION,
  SKIPIXL_V6_RULES_VERSION,
  SKIPIXL_V8_RULES_VERSION,
  type SkiPixlCourseReceipt,
  type SkiPixlCutId,
  type SkiPixlDesignerEvidence,
  type SkiPixlDesignerHazardEvidence,
  type SkiPixlDesignerRowEvidence,
  type SkiPixlDifficulty,
  type SkiPixlGate,
  type SkiPixlObstacle,
  type SkiPixlObstacleKind,
  type SkiPixlPackPayload,
  type SkiPixlSegmentReceipt,
} from "./types";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const EXPECTED_BANK_SHA256 =
  "f09d509dd4f6980c0ac5146466e32c736f0688d13156334216720fa52dc8bffb";
const CAPTURE_BANK_DECODER_VERSION = "skipixl-segment-ranked-residual-v3";
const LEGACY_DECODER_VERSION = "skipixl-bank-percentile-chaos-v4";
export const SKIPIXL_DECODER_VERSION =
  "skipixl-triplet-residual-slalom-v9" as const;
const V8_DECODER_VERSION = "skipixl-triplet-residual-slalom-v8" as const;
const PREVIOUS_DECODER_VERSION = "skipixl-triplet-residual-slalom-v7" as const;
const V6_DECODER_VERSION = "skipixl-triplet-residual-slalom-v6" as const;
const EARLIER_DECODER_VERSION = "skipixl-triplet-residual-slalom-v5" as const;
const PRIOR_DECODER_VERSION = "skipixl-triplet-residual-cuts-v4" as const;
export const SKIPIXL_CUTS = Object.freeze([
  Object.freeze({ cutId: "P90" as const, percentile: 0.9 }),
  Object.freeze({ cutId: "P84" as const, percentile: 0.84 }),
  Object.freeze({ cutId: "P78" as const, percentile: 0.78 }),
]);
const CORRIDOR_MIN_X = 96;
const CORRIDOR_MAX_X = 544;
const ROW_SPACING = 70;
const EASY_ROW_SPACING = 47;
const CURRENT_ADVANCED_ROW_SPACING = 63;
const TARGET_SECONDS = 60;
const PREVIOUS_TARGET_SECONDS = 75;
const DENSE_ROW_HAZARD_COUNT = 8;
const GATE_COUNTS: Readonly<Record<SkiPixlCutId, number>> = Object.freeze({
  P90: 0,
  P84: 8,
  P78: 12,
});
const GATE_HALF_WIDTHS: Readonly<Record<SkiPixlCutId, number>> = Object.freeze({
  P90: 0,
  P84: 72,
  P78: 54,
});
const DESIGNER_SAMPLE_ROWS = Object.freeze([0, 5, 10, 15, 19] as const);

interface SegmentRecord extends SkiPixlSegmentReceipt {
  readonly sourcePixels: readonly number[];
  readonly returnedValues: readonly number[];
}

interface ScheduleRecord {
  readonly scheduleId: string;
  readonly segmentIndexes: readonly [number, number, number];
  readonly contentSha256: string;
}

interface SegmentBank {
  readonly bankId: string;
  readonly bankContentSha256: string;
  readonly engineId: "qpixl-v1";
  readonly mode: "qpu";
  readonly backend: "ibm_fez";
  readonly captureClassification: string;
  readonly segments: readonly SegmentRecord[];
  readonly schedules: readonly ScheduleRecord[];
}

interface CatalogEntry {
  readonly scheduleId: string;
  readonly cutId: SkiPixlCutId;
  readonly selectionPercentile: number;
  readonly selectionThreshold: number;
  readonly contentSha256: string;
  readonly obstacleCount: number;
  readonly gateCount?: number;
  readonly treeObstacleCount: number;
  readonly mogulObstacleCount: number;
  readonly denseRowCount: number;
  readonly saturatedRowCount: number;
  readonly difficultyScore: number;
  readonly winSeconds: number;
  readonly parSeconds: number;
}

interface ResidualCutCatalog {
  readonly schemaVersion: "skipixl-residual-cut-catalog-v1";
  readonly decoderVersion: string;
  readonly sourceBankContentSha256: string;
  readonly cuts: readonly Readonly<{
    cutId: SkiPixlCutId;
    percentile: number;
  }>[];
  readonly schedules: readonly CatalogEntry[];
}

interface LegacyCatalogEntry
  extends Omit<
    CatalogEntry,
    "cutId" | "selectionPercentile" | "selectionThreshold"
  > {}

interface LegacyCatalog {
  readonly selectionPercentile: number;
  readonly selectionThreshold: number;
  readonly schedules: readonly LegacyCatalogEntry[];
}

interface DecodedCourse {
  readonly obstacles: readonly SkiPixlObstacle[];
  readonly obstacleCount: number;
  readonly treeObstacleCount: number;
  readonly mogulObstacleCount: number;
  readonly denseRowCount: number;
  readonly saturatedRowCount: number;
  readonly difficultyScore: number;
}

export interface SkiPixlCutSet {
  readonly tripletId: string;
  readonly packs: Readonly<Record<SkiPixlCutId, SkiPixlCommittedPack>>;
}

export type SkiPixlCommittedPack = CommittedPack<SkiPixlPackPayload>;

const SEGMENT_BANK = validateSegmentBank(segmentBankRecord as unknown);
const CUT_CATALOG = validateCutCatalog(
  residualCutCatalogRecord as unknown,
  SKIPIXL_DECODER_VERSION,
);
const V8_CUT_CATALOG = validateCutCatalog(
  v8ResidualCutCatalogRecord as unknown,
  V8_DECODER_VERSION,
);
const PREVIOUS_CUT_CATALOG = validateCutCatalog(
  previousResidualCutCatalogRecord as unknown,
  PREVIOUS_DECODER_VERSION,
);
const V6_CUT_CATALOG = validateCutCatalog(
  v6ResidualCutCatalogRecord as unknown,
  V6_DECODER_VERSION,
);
const EARLIER_CUT_CATALOG = validateCutCatalog(
  earlierResidualCutCatalogRecord as unknown,
  EARLIER_DECODER_VERSION,
);
const PRIOR_CUT_CATALOG = validateCutCatalog(
  priorResidualCutCatalogRecord as unknown,
  PRIOR_DECODER_VERSION,
);
const LEGACY_CATALOG = legacyCatalogRecord as unknown as LegacyCatalog;
const COURSE_SETS = deepFreeze(
  SEGMENT_BANK.schedules.map((schedule) => buildCutSet(schedule)),
);
const V8_COURSE_SETS = deepFreeze(SEGMENT_BANK.schedules.map(buildV8CutSet));
const PREVIOUS_COURSE_SETS = deepFreeze(
  SEGMENT_BANK.schedules.map((schedule) => buildPreviousCutSet(schedule)),
);
const V6_COURSE_SETS = deepFreeze(
  SEGMENT_BANK.schedules.map((schedule) => buildV6CutSet(schedule)),
);
const EARLIER_COURSE_SETS = deepFreeze(
  SEGMENT_BANK.schedules.map((schedule) => buildEarlierCutSet(schedule)),
);
const PRIOR_COURSE_SETS = deepFreeze(
  SEGMENT_BANK.schedules.map((schedule) => buildPriorCutSet(schedule)),
);
export const SKIPIXL_CONTROL_PACKS: readonly SkiPixlCommittedPack[] =
  Object.freeze(
    COURSE_SETS.flatMap((set) =>
      SKIPIXL_CUTS.map(({ cutId }) => set.packs[cutId]),
    ),
  );
const LEGACY_CONTROL_PACKS = Object.freeze(
  SEGMENT_BANK.schedules.map(buildLegacyCommittedPack),
);

export function selectArcadeSkiPixlCuts(runSeed: number): SkiPixlCutSet {
  return selectCutSet(runSeed, "Arcade run seed");
}

export function selectStorySkiPixlPack(
  priorAttempts: number,
  cutId: SkiPixlCutId = "P90",
  tripletId?: string,
): SkiPixlCommittedPack {
  const set = tripletId
    ? COURSE_SETS.find((candidate) => candidate.tripletId === tripletId)
    : selectCutSet(priorAttempts, "Story attempt");
  if (!set) throw new Error(`SkiPixl cannot find triplet ${tripletId}.`);
  return set.packs[cutId];
}

export function selectArcadeSkiPixlPack(runSeed: number): SkiPixlCommittedPack {
  return selectArcadeSkiPixlCuts(runSeed).packs.P90;
}

export function findInstalledSkiPixlPack(
  packId: string,
  contentSha256: string,
): SkiPixlCommittedPack | undefined {
  return [
    ...SKIPIXL_CONTROL_PACKS,
    ...V8_COURSE_SETS.flatMap((set) =>
      SKIPIXL_CUTS.map(({ cutId }) => set.packs[cutId]),
    ),
    ...PREVIOUS_COURSE_SETS.flatMap((set) =>
      SKIPIXL_CUTS.map(({ cutId }) => set.packs[cutId]),
    ),
    ...V6_COURSE_SETS.flatMap((set) =>
      SKIPIXL_CUTS.map(({ cutId }) => set.packs[cutId]),
    ),
    ...EARLIER_COURSE_SETS.flatMap((set) =>
      SKIPIXL_CUTS.map(({ cutId }) => set.packs[cutId]),
    ),
    ...PRIOR_COURSE_SETS.flatMap((set) =>
      SKIPIXL_CUTS.map(({ cutId }) => set.packs[cutId]),
    ),
    ...LEGACY_CONTROL_PACKS,
  ].find(
    (candidate) =>
      candidate.packId === packId && candidate.contentSha256 === contentSha256,
  );
}

export function decodeSkiPixlCourse(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId = "P90",
): SkiPixlPackPayload {
  const segments = scheduleSegments(schedule);
  const cut = SKIPIXL_CUTS.find((candidate) => candidate.cutId === cutId);
  if (!cut) throw new Error(`Unknown SkiPixl residual cut ${cutId}.`);
  const threshold = tripletThreshold(segments, cut.percentile);
  const rowSpacing = rowSpacingForCut(cutId);
  const courseLength = courseLengthForSpacing(rowSpacing);
  const decoded = decodeObstacles(segments, threshold, cutId, "v7", rowSpacing);
  const difficulty = difficultyForCut(cutId);
  const gates = decodeGates(decoded.obstacles, cutId, courseLength, true);
  const targetSeconds = targetSecondsForCut(cutId);
  const receipt = Object.freeze({
    schemaVersion: "skipixl-course-receipt-v9",
    bankId: SEGMENT_BANK.bankId,
    bankContentSha256: SEGMENT_BANK.bankContentSha256,
    decoderVersion: SKIPIXL_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    difficulty,
    residualDefinition: "returnedValue - submittedGrayscaleByte / 255",
    rowSelection: `select cells at or above this triplet's ${cutId} absolute-residual threshold; exact ties remain selected`,
    kindMapping:
      "positive or zero residual -> tree; negative residual -> mogul",
    spatialOffsetRule: `left/right neighbouring residual difference offsets x by at most 9 pixels; quantized cell and neighbouring residuals place each selected hazard across its complete ${rowSpacing}-unit source-row interval`,
    courseLengthRule:
      cutId === "P90"
        ? "Easy compresses all sixty QPixl-derived rows to 47 distance units per row for a shorter hill"
        : "Medium and Hard preserve all sixty QPixl-derived rows at 63 distance units per row for the common 60-second trial",
    gateRule:
      cutId === "P90"
        ? "4 slalom gates select QPixl obstacle anchors across the course; 180-pixel openings; a miss adds 2.5 seconds"
        : `${GATE_COUNTS[cutId]} slalom gates select QPixl obstacle anchors across the course; ${GATE_HALF_WIDTHS[cutId] * 2}-pixel openings; a miss adds 2.5 seconds`,
    selectionPercentile: cut.percentile,
    selectionThreshold: threshold,
    obstacleCount: decoded.obstacleCount,
    gateCount: gates.length,
    treeObstacleCount: decoded.treeObstacleCount,
    mogulObstacleCount: decoded.mogulObstacleCount,
    denseRowCount: decoded.denseRowCount,
    saturatedRowCount: decoded.saturatedRowCount,
    difficultyScore: decoded.difficultyScore,
    timeRule: "fixed 60-second qualification limit for every residual cut",
    segments: Object.freeze(
      segments.map((segment, order) => segmentReceipt(segment, order)),
    ),
  }) satisfies SkiPixlCourseReceipt;
  return deepFreeze({
    courseId: `${schedule.scheduleId}-${cutId.toLowerCase()}`,
    courseLabel: `${difficulty.toUpperCase()} / ${schedule.scheduleId.split("-").at(-1)?.toUpperCase() ?? "RUN"}`,
    decoderVersion: SKIPIXL_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    difficulty,
    courseLength,
    corridorMinX: CORRIDOR_MIN_X,
    corridorMaxX: CORRIDOR_MAX_X,
    cruiseSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.cruise,
    minSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.minimum,
    maxSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.maximum,
    parSeconds: 65,
    winSeconds: targetSeconds,
    difficultyScore: decoded.difficultyScore,
    rowSpacing,
    obstacles: decoded.obstacles,
    gates,
    receipt,
  });
}

function decodeV8Course(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId = "P90",
): SkiPixlPackPayload {
  const segments = scheduleSegments(schedule);
  const cut = SKIPIXL_CUTS.find((candidate) => candidate.cutId === cutId);
  if (!cut) throw new Error(`Unknown SkiPixl residual cut ${cutId}.`);
  const threshold = tripletThreshold(segments, cut.percentile);
  const rowSpacing = rowSpacingForCut(cutId);
  const courseLength = courseLengthForSpacing(rowSpacing);
  const decoded = decodeObstacles(segments, threshold, cutId, "v7", rowSpacing);
  const difficulty = difficultyForCut(cutId);
  const gates = decodeGates(decoded.obstacles, cutId, courseLength);
  const targetSeconds = targetSecondsForCut(cutId);
  const receipt = Object.freeze({
    schemaVersion: "skipixl-course-receipt-v8",
    bankId: SEGMENT_BANK.bankId,
    bankContentSha256: SEGMENT_BANK.bankContentSha256,
    decoderVersion: V8_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    difficulty,
    residualDefinition: "returnedValue - submittedGrayscaleByte / 255",
    rowSelection: `select cells at or above this triplet's ${cutId} absolute-residual threshold; exact ties remain selected`,
    kindMapping:
      "positive or zero residual -> tree; negative residual -> mogul",
    spatialOffsetRule: `left/right neighbouring residual difference offsets x by at most 9 pixels; quantized cell and neighbouring residuals place each selected hazard across its complete ${rowSpacing}-unit source-row interval`,
    courseLengthRule:
      cutId === "P90"
        ? "Easy compresses all sixty QPixl-derived rows to 47 distance units per row for a shorter hill"
        : "Medium and Hard preserve all sixty QPixl-derived rows at 63 distance units per row for the common 60-second trial",
    gateRule:
      cutId === "P90"
        ? "Easy is a gate-free downhill descent"
        : `${GATE_COUNTS[cutId]} slalom gates select QPixl obstacle anchors across the course; ${GATE_HALF_WIDTHS[cutId] * 2}-pixel openings; a miss adds 2.5 seconds`,
    selectionPercentile: cut.percentile,
    selectionThreshold: threshold,
    obstacleCount: decoded.obstacleCount,
    gateCount: gates.length,
    treeObstacleCount: decoded.treeObstacleCount,
    mogulObstacleCount: decoded.mogulObstacleCount,
    denseRowCount: decoded.denseRowCount,
    saturatedRowCount: decoded.saturatedRowCount,
    difficultyScore: decoded.difficultyScore,
    timeRule: "fixed 60-second qualification limit for every residual cut",
    segments: Object.freeze(
      segments.map((segment, order) => segmentReceipt(segment, order)),
    ),
  }) satisfies SkiPixlCourseReceipt;
  return deepFreeze({
    courseId: `${schedule.scheduleId}-${cutId.toLowerCase()}`,
    courseLabel: `${difficulty.toUpperCase()} / ${schedule.scheduleId.split("-").at(-1)?.toUpperCase() ?? "RUN"}`,
    decoderVersion: V8_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    difficulty,
    courseLength,
    corridorMinX: CORRIDOR_MIN_X,
    corridorMaxX: CORRIDOR_MAX_X,
    cruiseSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.cruise,
    minSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.minimum,
    maxSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.maximum,
    parSeconds: 65,
    winSeconds: targetSeconds,
    difficultyScore: decoded.difficultyScore,
    rowSpacing,
    obstacles: decoded.obstacles,
    gates,
    receipt,
  });
}

export function validateSkiPixlPayload(value: unknown): SkiPixlPackPayload {
  if (!isRecord(value)) throw new Error("SkiPixl payload must be an object.");
  const payload = value as unknown as SkiPixlPackPayload;
  if (payload.receipt?.schemaVersion === "skipixl-course-receipt-v3") {
    return validateLegacySkiPixlPayload(payload);
  }
  if (payload.receipt?.schemaVersion === "skipixl-course-receipt-v4") {
    return validatePriorSkiPixlPayload(payload);
  }
  if (payload.receipt?.schemaVersion === "skipixl-course-receipt-v5") {
    return validateV5SkiPixlPayload(payload);
  }
  if (payload.receipt?.schemaVersion === "skipixl-course-receipt-v6") {
    return validateV6SkiPixlPayload(payload);
  }
  if (payload.receipt?.schemaVersion === "skipixl-course-receipt-v7") {
    return validatePreviousSkiPixlPayload(payload);
  }
  if (payload.receipt?.schemaVersion === "skipixl-course-receipt-v8")
    return validateV8SkiPixlPayload(payload);
  const expectedRowSpacing = isCutId(payload.cutId)
    ? rowSpacingForCut(payload.cutId)
    : Number.NaN;
  if (
    typeof payload.courseId !== "string" ||
    typeof payload.courseLabel !== "string" ||
    payload.decoderVersion !== SKIPIXL_DECODER_VERSION ||
    !isCutId(payload.cutId) ||
    typeof payload.tripletId !== "string" ||
    payload.receipt.schemaVersion !== "skipixl-course-receipt-v9" ||
    typeof payload.receipt.courseLengthRule !== "string" ||
    payload.receipt.cutId !== payload.cutId ||
    payload.receipt.tripletId !== payload.tripletId ||
    payload.receipt.difficulty !== payload.difficulty ||
    payload.courseLength !== courseLengthForSpacing(expectedRowSpacing) ||
    payload.corridorMinX !== CORRIDOR_MIN_X ||
    payload.corridorMaxX !== CORRIDOR_MAX_X ||
    payload.winSeconds !== targetSecondsForCut(payload.cutId) ||
    payload.cruiseSpeed !== 72 ||
    payload.maxSpeed !== 92 ||
    payload.parSeconds !== 65 ||
    payload.rowSpacing !== expectedRowSpacing ||
    payload.receipt.bankContentSha256 !== EXPECTED_BANK_SHA256 ||
    !Array.isArray(payload.obstacles) ||
    !Array.isArray(payload.gates) ||
    payload.gates.length !==
      (payload.cutId === "P90" ? 4 : GATE_COUNTS[payload.cutId]) ||
    payload.receipt.gateCount !== payload.gates.length ||
    !Array.isArray(payload.receipt.segments) ||
    payload.receipt.segments.length !== 3
  ) {
    throw new Error(
      "SkiPixl payload violates the residual-slalom v9 contract.",
    );
  }
  validateV6Obstacles(payload);
  validateV6Gates(payload);
  return deepFreeze(payload);
}

export function validateV8SkiPixlPayload(value: unknown): SkiPixlPackPayload {
  if (!isRecord(value)) throw new Error("Invalid SkiPixl v8 payload");
  const payload = value as unknown as SkiPixlPackPayload;
  const expectedRowSpacing = isCutId(payload.cutId)
    ? rowSpacingForCut(payload.cutId)
    : Number.NaN;
  if (
    typeof payload.courseId !== "string" ||
    typeof payload.courseLabel !== "string" ||
    payload.decoderVersion !== V8_DECODER_VERSION ||
    !isCutId(payload.cutId) ||
    typeof payload.tripletId !== "string" ||
    payload.receipt.schemaVersion !== "skipixl-course-receipt-v8" ||
    typeof payload.receipt.courseLengthRule !== "string" ||
    payload.receipt.cutId !== payload.cutId ||
    payload.receipt.tripletId !== payload.tripletId ||
    payload.receipt.difficulty !== payload.difficulty ||
    payload.courseLength !== courseLengthForSpacing(expectedRowSpacing) ||
    payload.corridorMinX !== CORRIDOR_MIN_X ||
    payload.corridorMaxX !== CORRIDOR_MAX_X ||
    payload.winSeconds !== targetSecondsForCut(payload.cutId) ||
    payload.cruiseSpeed !== 72 ||
    payload.maxSpeed !== 92 ||
    payload.parSeconds !== 65 ||
    payload.rowSpacing !== expectedRowSpacing ||
    payload.receipt.bankContentSha256 !== EXPECTED_BANK_SHA256 ||
    !Array.isArray(payload.obstacles) ||
    !Array.isArray(payload.gates) ||
    payload.gates.length !== GATE_COUNTS[payload.cutId] ||
    payload.receipt.gateCount !== payload.gates.length ||
    !Array.isArray(payload.receipt.segments) ||
    payload.receipt.segments.length !== 3
  ) {
    throw new Error(
      "SkiPixl payload violates the residual-slalom v8 contract.",
    );
  }
  validateV6Obstacles(payload);
  validateV6Gates(payload);
  return deepFreeze(payload);
}

export function validatePreviousSkiPixlPayload(
  value: unknown,
): SkiPixlPackPayload {
  if (!isRecord(value)) throw new Error("Previous SkiPixl payload is invalid.");
  const payload = value as unknown as SkiPixlPackPayload;
  if (
    payload.decoderVersion !== PREVIOUS_DECODER_VERSION ||
    payload.receipt?.schemaVersion !== "skipixl-course-receipt-v7" ||
    payload.receipt.bankContentSha256 !== EXPECTED_BANK_SHA256 ||
    !isCutId(payload.cutId) ||
    payload.courseLength !==
      courseLengthForSpacing(legacyRowSpacingForCut(payload.cutId)) ||
    payload.rowSpacing !== legacyRowSpacingForCut(payload.cutId) ||
    payload.winSeconds !== previousTargetSecondsForCut(payload.cutId) ||
    payload.maxSpeed !== 78 ||
    !Array.isArray(payload.obstacles) ||
    !Array.isArray(payload.gates) ||
    !Array.isArray(payload.receipt.segments) ||
    payload.receipt.segments.length !== 3
  ) {
    throw new Error("Previous SkiPixl v7 payload is invalid.");
  }
  validateV6Obstacles(payload);
  validateV6Gates(payload);
  return deepFreeze(payload);
}

export function validateV6SkiPixlPayload(value: unknown): SkiPixlPackPayload {
  if (!isRecord(value)) throw new Error("SkiPixl v6 payload is invalid.");
  const payload = value as unknown as SkiPixlPackPayload;
  if (
    payload.decoderVersion !== V6_DECODER_VERSION ||
    payload.receipt?.schemaVersion !== "skipixl-course-receipt-v6" ||
    payload.receipt.bankContentSha256 !== EXPECTED_BANK_SHA256 ||
    !isCutId(payload.cutId) ||
    payload.courseLength !==
      courseLengthForSpacing(legacyRowSpacingForCut(payload.cutId)) ||
    payload.rowSpacing !== legacyRowSpacingForCut(payload.cutId) ||
    payload.winSeconds !== PREVIOUS_TARGET_SECONDS ||
    !Array.isArray(payload.obstacles) ||
    !Array.isArray(payload.gates) ||
    !Array.isArray(payload.receipt.segments) ||
    payload.receipt.segments.length !== 3
  ) {
    throw new Error("SkiPixl v6 payload is invalid.");
  }
  validateV6Obstacles(payload);
  validateV6Gates(payload);
  return deepFreeze(payload);
}

export function validateV5SkiPixlPayload(value: unknown): SkiPixlPackPayload {
  if (!isRecord(value)) throw new Error("SkiPixl v5 payload is invalid.");
  const payload = value as unknown as SkiPixlPackPayload;
  if (
    payload.decoderVersion !== EARLIER_DECODER_VERSION ||
    payload.receipt?.schemaVersion !== "skipixl-course-receipt-v5" ||
    payload.receipt.bankContentSha256 !== EXPECTED_BANK_SHA256 ||
    !isCutId(payload.cutId) ||
    payload.courseLength !== courseLengthForSpacing(ROW_SPACING) ||
    payload.rowSpacing !== ROW_SPACING ||
    payload.winSeconds !== PREVIOUS_TARGET_SECONDS ||
    !Array.isArray(payload.obstacles) ||
    !Array.isArray(payload.gates) ||
    !Array.isArray(payload.receipt.segments) ||
    payload.receipt.segments.length !== 3
  ) {
    throw new Error("SkiPixl v5 payload is invalid.");
  }
  validateV5Obstacles(payload);
  validateV5Gates(payload);
  return deepFreeze(payload);
}

export function validatePriorSkiPixlPayload(
  value: unknown,
): SkiPixlPackPayload {
  if (!isRecord(value)) throw new Error("Prior SkiPixl payload is invalid.");
  const payload = value as unknown as SkiPixlPackPayload;
  if (
    payload.decoderVersion !== PRIOR_DECODER_VERSION ||
    payload.receipt?.schemaVersion !== "skipixl-course-receipt-v4" ||
    payload.receipt.bankContentSha256 !== EXPECTED_BANK_SHA256 ||
    !isCutId(payload.cutId) ||
    !Array.isArray(payload.obstacles) ||
    !Array.isArray(payload.receipt.segments) ||
    payload.receipt.segments.length !== 3
  ) {
    throw new Error("Prior SkiPixl v4 payload is invalid.");
  }
  validateV4Obstacles(payload);
  return deepFreeze(payload);
}

export function validateLegacySkiPixlPayload(
  value: unknown,
): SkiPixlPackPayload {
  if (!isRecord(value)) throw new Error("Legacy SkiPixl payload is invalid.");
  const payload = value as unknown as SkiPixlPackPayload;
  if (
    payload.decoderVersion !== LEGACY_DECODER_VERSION ||
    payload.receipt?.schemaVersion !== "skipixl-course-receipt-v3" ||
    payload.receipt.bankContentSha256 !== EXPECTED_BANK_SHA256 ||
    !Array.isArray(payload.obstacles) ||
    !Array.isArray(payload.receipt.segments) ||
    payload.receipt.segments.length !== 3
  ) {
    throw new Error("Legacy SkiPixl v3 payload is invalid.");
  }
  return deepFreeze(payload);
}

export function installedSkiPixlBank(): SegmentBank {
  return SEGMENT_BANK;
}

export function createSkiPixlDesignerEvidence(
  pack: SkiPixlCommittedPack,
): SkiPixlDesignerEvidence {
  const segments = pack.payload.receipt.segments.map((receipt) => {
    const segment = SEGMENT_BANK.segments.find(
      (candidate) => candidate.segmentId === receipt.segmentId,
    );
    if (!segment)
      throw new Error(
        `SkiPixl Designer evidence cannot find ${receipt.segmentId}.`,
      );
    return Object.freeze(
      DESIGNER_SAMPLE_ROWS.map((localRow) =>
        designerRowEvidence(pack, segment, receipt.order, localRow),
      ),
    );
  });
  return deepFreeze({
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    source: "moth-platform-qpu-capture",
    decoderVersion: pack.payload.decoderVersion,
    tripletId: pack.payload.tripletId ?? pack.payload.courseId,
    cutId: pack.payload.cutId ?? "P78",
    selectionPercentile: pack.payload.receipt.selectionPercentile,
    selectionThreshold: pack.payload.receipt.selectionThreshold,
    obstacleCount: pack.payload.receipt.obstacleCount,
    treeObstacleCount: pack.payload.receipt.treeObstacleCount,
    mogulObstacleCount: pack.payload.receipt.mogulObstacleCount,
    denseRowCount: pack.payload.receipt.denseRowCount,
    saturatedRowCount: pack.payload.receipt.saturatedRowCount,
    difficultyScore: pack.payload.receipt.difficultyScore,
    winSeconds: pack.payload.winSeconds,
    sampledLocalRows: [...DESIGNER_SAMPLE_ROWS],
    segments,
  });
}

function selectCutSet(value: number, label: string): SkiPixlCutSet {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} must be a non-negative integer.`);
  const set = COURSE_SETS[value % COURSE_SETS.length];
  if (!set) throw new Error("SkiPixl has no installed QPixl course sets.");
  return set;
}

function buildCutSet(schedule: ScheduleRecord): SkiPixlCutSet {
  const packs = Object.fromEntries(
    SKIPIXL_CUTS.map(({ cutId }) => [
      cutId,
      buildCommittedPack(schedule, cutId),
    ]),
  ) as Record<SkiPixlCutId, SkiPixlCommittedPack>;
  return deepFreeze({ tripletId: schedule.scheduleId, packs });
}

function buildV8CutSet(schedule: ScheduleRecord): SkiPixlCutSet {
  const packs = Object.fromEntries(
    SKIPIXL_CUTS.map(({ cutId }) => [
      cutId,
      buildV8CommittedPack(schedule, cutId),
    ]),
  ) as Record<SkiPixlCutId, SkiPixlCommittedPack>;
  return deepFreeze({ tripletId: schedule.scheduleId, packs });
}

function buildPreviousCutSet(schedule: ScheduleRecord): SkiPixlCutSet {
  const packs = Object.fromEntries(
    SKIPIXL_CUTS.map(({ cutId }) => [
      cutId,
      buildPreviousCommittedPack(schedule, cutId),
    ]),
  ) as Record<SkiPixlCutId, SkiPixlCommittedPack>;
  return deepFreeze({ tripletId: schedule.scheduleId, packs });
}

function buildV6CutSet(schedule: ScheduleRecord): SkiPixlCutSet {
  const packs = Object.fromEntries(
    SKIPIXL_CUTS.map(({ cutId }) => [
      cutId,
      buildV6CommittedPack(schedule, cutId),
    ]),
  ) as Record<SkiPixlCutId, SkiPixlCommittedPack>;
  return deepFreeze({ tripletId: schedule.scheduleId, packs });
}

function buildEarlierCutSet(schedule: ScheduleRecord): SkiPixlCutSet {
  const packs = Object.fromEntries(
    SKIPIXL_CUTS.map(({ cutId }) => [
      cutId,
      buildEarlierCommittedPack(schedule, cutId),
    ]),
  ) as Record<SkiPixlCutId, SkiPixlCommittedPack>;
  return deepFreeze({ tripletId: schedule.scheduleId, packs });
}

function buildPriorCutSet(schedule: ScheduleRecord): SkiPixlCutSet {
  const packs = Object.fromEntries(
    SKIPIXL_CUTS.map(({ cutId }) => [
      cutId,
      buildPriorCommittedPack(schedule, cutId),
    ]),
  ) as Record<SkiPixlCutId, SkiPixlCommittedPack>;
  return deepFreeze({ tripletId: schedule.scheduleId, packs });
}

function buildCommittedPack(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlCommittedPack {
  const catalog = CUT_CATALOG.schedules.find(
    (candidate) =>
      candidate.scheduleId === schedule.scheduleId && candidate.cutId === cutId,
  );
  if (!catalog)
    throw new Error(
      `SkiPixl cut catalog omits ${schedule.scheduleId} ${cutId}.`,
    );
  const payload = decodeSkiPixlCourse(schedule, cutId);
  assertCatalogMetrics(payload, catalog);
  return validateCommittedPack(
    {
      schemaVersion: PACK_SCHEMA_VERSION,
      packId: payload.courseId,
      gameId: "skipixl",
      engineId: "qpixl-v1",
      source: "moth-platform-qpu-capture",
      contentSha256: catalog.contentSha256,
      rulesVersion: SKIPIXL_RULES_VERSION,
      warnings: Object.freeze([
        "Built from completed IBM Fez QPixl provider UI payload captures, not direct HTTP response-body downloads.",
        "P90, P84, and P78 are nested local residual cuts of one recorded triplet, not separate QPU executions.",
        "Active play is deterministic and local; no Moth or IBM request occurs during the descent.",
      ]),
      mothEvidence: null,
      payload,
    },
    validateSkiPixlPayload,
  );
}

function buildV8CommittedPack(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlCommittedPack {
  const catalog = V8_CUT_CATALOG.schedules.find(
    (candidate) =>
      candidate.scheduleId === schedule.scheduleId && candidate.cutId === cutId,
  );
  if (!catalog)
    throw new Error(
      `SkiPixl cut catalog omits ${schedule.scheduleId} ${cutId}.`,
    );
  const payload = decodeV8Course(schedule, cutId);
  assertCatalogMetrics(payload, catalog);
  return validateCommittedPack(
    {
      schemaVersion: PACK_SCHEMA_VERSION,
      packId: payload.courseId,
      gameId: "skipixl",
      engineId: "qpixl-v1",
      source: "moth-platform-qpu-capture",
      contentSha256: catalog.contentSha256,
      rulesVersion: SKIPIXL_V8_RULES_VERSION,
      warnings: Object.freeze([
        "Built from completed IBM Fez QPixl provider UI payload captures, not direct HTTP response-body downloads.",
        "P90, P84, and P78 are nested local residual cuts of one recorded triplet, not separate QPU executions.",
        "Active play is deterministic and local; no Moth or IBM request occurs during the descent.",
      ]),
      mothEvidence: null,
      payload,
    },
    validateV8SkiPixlPayload,
  );
}

function buildPriorCommittedPack(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlCommittedPack {
  const catalog = PRIOR_CUT_CATALOG.schedules.find(
    (candidate) =>
      candidate.scheduleId === schedule.scheduleId && candidate.cutId === cutId,
  );
  if (!catalog)
    throw new Error(
      `Prior SkiPixl cut catalog omits ${schedule.scheduleId} ${cutId}.`,
    );
  const payload = decodePriorCourse(schedule, cutId);
  assertCatalogMetrics(payload, catalog);
  return validateCommittedPack(
    {
      schemaVersion: PACK_SCHEMA_VERSION,
      packId: payload.courseId,
      gameId: "skipixl",
      engineId: "qpixl-v1",
      source: "moth-platform-qpu-capture",
      contentSha256: catalog.contentSha256,
      rulesVersion: SKIPIXL_PRIOR_RULES_VERSION,
      warnings: Object.freeze([
        "Prior SkiPixl v4 residual-cut pack retained for deterministic save compatibility.",
      ]),
      mothEvidence: null,
      payload,
    },
    validatePriorSkiPixlPayload,
  );
}

function buildPreviousCommittedPack(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlCommittedPack {
  const catalog = PREVIOUS_CUT_CATALOG.schedules.find(
    (candidate) =>
      candidate.scheduleId === schedule.scheduleId && candidate.cutId === cutId,
  );
  if (!catalog)
    throw new Error(
      `Previous SkiPixl cut catalog omits ${schedule.scheduleId} ${cutId}.`,
    );
  const payload = decodeV7Course(schedule, cutId);
  assertCatalogMetrics(payload, catalog);
  return validateCommittedPack(
    {
      schemaVersion: PACK_SCHEMA_VERSION,
      packId: payload.courseId,
      gameId: "skipixl",
      engineId: "qpixl-v1",
      source: "moth-platform-qpu-capture",
      contentSha256: catalog.contentSha256,
      rulesVersion: SKIPIXL_PREVIOUS_RULES_VERSION,
      warnings: Object.freeze([
        "Previous SkiPixl v7 course packs retained for deterministic save compatibility.",
      ]),
      mothEvidence: null,
      payload,
    },
    validatePreviousSkiPixlPayload,
  );
}

function buildV6CommittedPack(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlCommittedPack {
  const catalog = V6_CUT_CATALOG.schedules.find(
    (candidate) =>
      candidate.scheduleId === schedule.scheduleId && candidate.cutId === cutId,
  );
  if (!catalog)
    throw new Error(
      `SkiPixl v6 catalog omits ${schedule.scheduleId} ${cutId}.`,
    );
  const payload = decodePreviousCourse(schedule, cutId);
  assertCatalogMetrics(payload, catalog);
  return validateCommittedPack(
    {
      schemaVersion: PACK_SCHEMA_VERSION,
      packId: payload.courseId,
      gameId: "skipixl",
      engineId: "qpixl-v1",
      source: "moth-platform-qpu-capture",
      contentSha256: catalog.contentSha256,
      rulesVersion: SKIPIXL_V6_RULES_VERSION,
      warnings: Object.freeze([
        "SkiPixl v6 short-Easy packs retained for deterministic save compatibility.",
      ]),
      mothEvidence: null,
      payload,
    },
    validateV6SkiPixlPayload,
  );
}

function buildEarlierCommittedPack(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlCommittedPack {
  const catalog = EARLIER_CUT_CATALOG.schedules.find(
    (candidate) =>
      candidate.scheduleId === schedule.scheduleId && candidate.cutId === cutId,
  );
  if (!catalog)
    throw new Error(
      `Earlier SkiPixl cut catalog omits ${schedule.scheduleId} ${cutId}.`,
    );
  const payload = decodeV5Course(schedule, cutId);
  assertCatalogMetrics(payload, catalog);
  return validateCommittedPack(
    {
      schemaVersion: PACK_SCHEMA_VERSION,
      packId: payload.courseId,
      gameId: "skipixl",
      engineId: "qpixl-v1",
      source: "moth-platform-qpu-capture",
      contentSha256: catalog.contentSha256,
      rulesVersion: SKIPIXL_V5_RULES_VERSION,
      warnings: Object.freeze([
        "Earlier SkiPixl v5 full-length packs retained for deterministic save compatibility.",
      ]),
      mothEvidence: null,
      payload,
    },
    validateV5SkiPixlPayload,
  );
}

function buildLegacyCommittedPack(
  schedule: ScheduleRecord,
): SkiPixlCommittedPack {
  const catalog = LEGACY_CATALOG.schedules.find(
    (candidate) => candidate.scheduleId === schedule.scheduleId,
  );
  if (!catalog)
    throw new Error(`Legacy SkiPixl catalog omits ${schedule.scheduleId}.`);
  const payload = decodeLegacyCourse(
    schedule,
    LEGACY_CATALOG.selectionThreshold,
  );
  if (canonicalJson(payload).length === 0)
    throw new Error("Legacy SkiPixl payload is empty.");
  return validateCommittedPack(
    {
      schemaVersion: PACK_SCHEMA_VERSION,
      packId: schedule.scheduleId,
      gameId: "skipixl",
      engineId: "qpixl-v1",
      source: "moth-platform-qpu-capture",
      contentSha256: catalog.contentSha256,
      rulesVersion: SKIPIXL_LEGACY_RULES_VERSION,
      warnings: Object.freeze([
        "Legacy SkiPixl v3 recovery pack retained for deterministic save compatibility.",
      ]),
      mothEvidence: null,
      payload,
    },
    validateLegacySkiPixlPayload,
  );
}

function scheduleSegments(schedule: ScheduleRecord): readonly SegmentRecord[] {
  const segments = schedule.segmentIndexes.map(
    (index) => SEGMENT_BANK.segments[index],
  );
  if (
    segments.some((segment) => segment === undefined) ||
    new Set(segments.map((segment) => segment?.segmentId)).size !== 3
  )
    throw new Error("SkiPixl course requires three distinct QPixl segments.");
  return segments as readonly SegmentRecord[];
}

function segmentResiduals(segment: SegmentRecord): readonly number[] {
  return segment.returnedValues.map((returned, index) => {
    const source = segment.sourcePixels[index];
    if (source === undefined)
      throw new Error(`${segment.segmentId} is missing source cell ${index}.`);
    return returned - source / 255;
  });
}

function tripletThreshold(
  segments: readonly SegmentRecord[],
  percentile: number,
): number {
  const magnitudes = segments
    .flatMap((segment) => segmentResiduals(segment).map(Math.abs))
    .sort((a, b) => a - b);
  const threshold = magnitudes[Math.floor(magnitudes.length * percentile)];
  if (threshold === undefined)
    throw new Error("SkiPixl could not derive its triplet cut.");
  return threshold;
}

function offsetSourceIndexes(
  cellIndex: number,
): readonly [number, number, number, number] {
  const row = Math.floor(cellIndex / 20);
  const column = cellIndex % 20;
  return [
    row * 20 + ((column + 19) % 20),
    row * 20 + ((column + 1) % 20),
    ((row + 19) % 20) * 20 + column,
    ((row + 1) % 20) * 20 + column,
  ];
}

function decodeObstacles(
  segments: readonly SegmentRecord[],
  threshold: number,
  cutId: SkiPixlCutId,
  spatialVersion: "v7" | "v6" | "v5" | "v4" = "v7",
  rowSpacing = ROW_SPACING,
): DecodedCourse {
  const obstacles: SkiPixlObstacle[] = [];
  const rows = Array.from({ length: 60 }, () => [] as SkiPixlObstacle[]);
  segments.forEach((segment, segmentOrder) => {
    const residuals = segmentResiduals(segment);
    for (let localRow = 0; localRow < 20; localRow += 1) {
      const rowStart = localRow * 20;
      const selected: SkiPixlObstacle[] = [];
      for (let column = 0; column < 20; column += 1) {
        const cellIndex = rowStart + column;
        const residual = residuals[cellIndex];
        if (residual === undefined || Math.abs(residual) < threshold) continue;
        const neighbours = offsetSourceIndexes(cellIndex);
        const [leftIndex, rightIndex, aboveIndex, belowIndex] = neighbours;
        const left = residuals[leftIndex] ?? 0;
        const right = residuals[rightIndex] ?? 0;
        const above = residuals[aboveIndex] ?? 0;
        const below = residuals[belowIndex] ?? 0;
        const horizontalOffset = Math.round(clamp((left - right) * 64, -9, 9));
        const downhillOffset =
          spatialVersion === "v7" ||
          spatialVersion === "v6" ||
          spatialVersion === "v5"
            ? qpixlDownhillOffset(
                cellIndex,
                residual,
                left,
                right,
                above,
                below,
                rowSpacing,
              )
            : Math.round(clamp((above + below) * 48, -22, 22));
        const row = segmentOrder * 20 + localRow;
        const baseX = 120 + column * 21;
        const baseDistance = rowSpacing + row * rowSpacing;
        selected.push(
          Object.freeze({
            obstacleId: `cell-row-${String(row + 1).padStart(2, "0")}-col-${String(column + 1).padStart(2, "0")}`,
            row,
            distance: baseDistance + downhillOffset,
            baseDistance,
            downhillOffset,
            column,
            x: Math.round(
              clamp(baseX + horizontalOffset, CORRIDOR_MIN_X, CORRIDOR_MAX_X),
            ),
            baseX,
            horizontalOffset,
            kind: residual >= 0 ? "tree" : "rock",
            segmentId: segment.segmentId,
            cellIndex,
            residual,
            absoluteResidual: Math.abs(residual),
            offsetSourceCellIndexes: neighbours,
            rowHazardIndex: 0,
            rowHazardCount: 0,
          }),
        );
      }
      selected.sort(
        (left, right) =>
          left.distance - right.distance || left.column - right.column,
      );
      selected.forEach((obstacle, rowHazardIndex) => {
        const complete = Object.freeze({
          ...obstacle,
          rowHazardIndex,
          rowHazardCount: selected.length,
        });
        obstacles.push(complete);
        rows[complete.row]?.push(complete);
      });
    }
  });
  obstacles.sort(
    (left, right) =>
      left.distance - right.distance ||
      left.x - right.x ||
      left.obstacleId.localeCompare(right.obstacleId),
  );
  return courseMetrics(obstacles, rows);
}

function decodeV7Course(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlPackPayload {
  const previous = decodePreviousCourse(schedule, cutId);
  if (previous.receipt.schemaVersion !== "skipixl-course-receipt-v6") {
    throw new Error("Previous SkiPixl decoder did not produce a v6 receipt.");
  }
  return deepFreeze({
    ...previous,
    decoderVersion: PREVIOUS_DECODER_VERSION,
    maxSpeed: 78,
    winSeconds: previousTargetSecondsForCut(cutId),
    receipt: {
      ...previous.receipt,
      schemaVersion: "skipixl-course-receipt-v7" as const,
      decoderVersion: PREVIOUS_DECODER_VERSION,
      timeRule:
        "60-second qualification limit for Easy; Medium and Hard retain 75 seconds",
    },
  });
}

function decodePreviousCourse(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlPackPayload {
  const segments = scheduleSegments(schedule);
  const cut = SKIPIXL_CUTS.find((candidate) => candidate.cutId === cutId);
  if (!cut) throw new Error(`Unknown previous SkiPixl cut ${cutId}.`);
  const threshold = tripletThreshold(segments, cut.percentile);
  const rowSpacing = legacyRowSpacingForCut(cutId);
  const decoded = decodeObstacles(segments, threshold, cutId, "v6", rowSpacing);
  const difficulty = difficultyForCut(cutId);
  const courseLength = courseLengthForSpacing(rowSpacing);
  const gates = decodeGates(decoded.obstacles, cutId, courseLength);
  const receipt = Object.freeze({
    schemaVersion: "skipixl-course-receipt-v6",
    bankId: SEGMENT_BANK.bankId,
    bankContentSha256: SEGMENT_BANK.bankContentSha256,
    decoderVersion: V6_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    difficulty,
    residualDefinition: "returnedValue - submittedGrayscaleByte / 255",
    rowSelection: `select cells at or above this triplet's ${cutId} absolute-residual threshold; exact ties remain selected`,
    kindMapping:
      "positive or zero residual -> tree; negative residual -> mogul",
    spatialOffsetRule: `left/right neighbouring residual difference offsets x by at most 9 pixels; quantized cell and neighbouring residuals place each selected hazard across its complete ${rowSpacing}-unit source-row interval`,
    courseLengthRule:
      cutId === "P90"
        ? "Easy compresses all sixty QPixl-derived rows to 47 distance units per row for a shorter hill"
        : "Medium and Hard retain all sixty QPixl-derived rows at 70 distance units per row",
    gateRule:
      cutId === "P90"
        ? "Easy is a gate-free downhill descent"
        : `${GATE_COUNTS[cutId]} slalom gates select QPixl obstacle anchors across the course; ${GATE_HALF_WIDTHS[cutId] * 2}-pixel openings; a miss adds 2.5 seconds`,
    selectionPercentile: cut.percentile,
    selectionThreshold: threshold,
    obstacleCount: decoded.obstacleCount,
    gateCount: gates.length,
    treeObstacleCount: decoded.treeObstacleCount,
    mogulObstacleCount: decoded.mogulObstacleCount,
    denseRowCount: decoded.denseRowCount,
    saturatedRowCount: decoded.saturatedRowCount,
    difficultyScore: decoded.difficultyScore,
    timeRule: "fixed 75-second qualification limit for every residual cut",
    segments: Object.freeze(
      segments.map((segment, order) => segmentReceipt(segment, order)),
    ),
  }) satisfies SkiPixlCourseReceipt;
  return deepFreeze({
    courseId: `${schedule.scheduleId}-${cutId.toLowerCase()}`,
    courseLabel: `${difficulty.toUpperCase()} / ${schedule.scheduleId.split("-").at(-1)?.toUpperCase() ?? "RUN"}`,
    decoderVersion: V6_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    difficulty,
    courseLength,
    corridorMinX: CORRIDOR_MIN_X,
    corridorMaxX: CORRIDOR_MAX_X,
    cruiseSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.cruise,
    minSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.minimum,
    maxSpeed: 78,
    parSeconds: 65,
    winSeconds: PREVIOUS_TARGET_SECONDS,
    difficultyScore: decoded.difficultyScore,
    rowSpacing,
    obstacles: decoded.obstacles,
    gates,
    receipt,
  });
}

function decodeV5Course(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlPackPayload {
  const segments = scheduleSegments(schedule);
  const cut = SKIPIXL_CUTS.find((candidate) => candidate.cutId === cutId);
  if (!cut) throw new Error(`Unknown v5 SkiPixl cut ${cutId}.`);
  const threshold = tripletThreshold(segments, cut.percentile);
  const decoded = decodeObstacles(
    segments,
    threshold,
    cutId,
    "v5",
    ROW_SPACING,
  );
  const difficulty = difficultyForCut(cutId);
  const courseLength = courseLengthForSpacing(ROW_SPACING);
  const gates = decodeGates(decoded.obstacles, cutId, courseLength);
  const receipt = Object.freeze({
    schemaVersion: "skipixl-course-receipt-v5",
    bankId: SEGMENT_BANK.bankId,
    bankContentSha256: SEGMENT_BANK.bankContentSha256,
    decoderVersion: EARLIER_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    difficulty,
    residualDefinition: "returnedValue - submittedGrayscaleByte / 255",
    rowSelection: `select cells at or above this triplet's ${cutId} absolute-residual threshold; exact ties remain selected`,
    kindMapping:
      "positive or zero residual -> tree; negative residual -> mogul",
    spatialOffsetRule:
      "left/right neighbouring residual difference offsets x by at most 9 pixels; quantized cell and neighbouring residuals place each selected hazard across its complete 70-unit source-row interval",
    gateRule:
      cutId === "P90"
        ? "Easy is a gate-free downhill descent"
        : `${GATE_COUNTS[cutId]} slalom gates select QPixl obstacle anchors across the course; ${GATE_HALF_WIDTHS[cutId] * 2}-pixel openings; a miss adds 2.5 seconds`,
    selectionPercentile: cut.percentile,
    selectionThreshold: threshold,
    obstacleCount: decoded.obstacleCount,
    gateCount: gates.length,
    treeObstacleCount: decoded.treeObstacleCount,
    mogulObstacleCount: decoded.mogulObstacleCount,
    denseRowCount: decoded.denseRowCount,
    saturatedRowCount: decoded.saturatedRowCount,
    difficultyScore: decoded.difficultyScore,
    timeRule: "fixed 75-second qualification limit for every residual cut",
    segments: Object.freeze(
      segments.map((segment, order) => segmentReceipt(segment, order)),
    ),
  }) satisfies SkiPixlCourseReceipt;
  return deepFreeze({
    courseId: `${schedule.scheduleId}-${cutId.toLowerCase()}`,
    courseLabel: `${difficulty.toUpperCase()} / ${schedule.scheduleId.split("-").at(-1)?.toUpperCase() ?? "RUN"}`,
    decoderVersion: EARLIER_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    difficulty,
    courseLength,
    corridorMinX: CORRIDOR_MIN_X,
    corridorMaxX: CORRIDOR_MAX_X,
    cruiseSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.cruise,
    minSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.minimum,
    maxSpeed: 78,
    parSeconds: 65,
    winSeconds: PREVIOUS_TARGET_SECONDS,
    difficultyScore: decoded.difficultyScore,
    rowSpacing: ROW_SPACING,
    obstacles: decoded.obstacles,
    gates,
    receipt,
  });
}

function decodePriorCourse(
  schedule: ScheduleRecord,
  cutId: SkiPixlCutId,
): SkiPixlPackPayload {
  const segments = scheduleSegments(schedule);
  const cut = SKIPIXL_CUTS.find((candidate) => candidate.cutId === cutId);
  if (!cut) throw new Error(`Unknown prior SkiPixl residual cut ${cutId}.`);
  const threshold = tripletThreshold(segments, cut.percentile);
  const decoded = decodeObstacles(segments, threshold, cutId, "v4");
  const receipt = Object.freeze({
    schemaVersion: "skipixl-course-receipt-v4",
    bankId: SEGMENT_BANK.bankId,
    bankContentSha256: SEGMENT_BANK.bankContentSha256,
    decoderVersion: PRIOR_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    residualDefinition: "returnedValue - submittedGrayscaleByte / 255",
    rowSelection: `select cells at or above this triplet's ${cutId} absolute-residual threshold; exact ties remain selected`,
    kindMapping:
      "positive or zero residual -> tree; negative residual -> mogul",
    spatialOffsetRule:
      "left/right neighbouring residual difference offsets x by at most 9 pixels; above/below sum offsets distance by at most 22 pixels",
    selectionPercentile: cut.percentile,
    selectionThreshold: threshold,
    obstacleCount: decoded.obstacleCount,
    treeObstacleCount: decoded.treeObstacleCount,
    mogulObstacleCount: decoded.mogulObstacleCount,
    denseRowCount: decoded.denseRowCount,
    saturatedRowCount: decoded.saturatedRowCount,
    difficultyScore: decoded.difficultyScore,
    timeRule: "fixed 75-second qualification limit for every residual cut",
    segments: Object.freeze(
      segments.map((segment, order) => segmentReceipt(segment, order)),
    ),
  }) satisfies SkiPixlCourseReceipt;
  return deepFreeze({
    courseId: `${schedule.scheduleId}-${cutId.toLowerCase()}`,
    courseLabel: `${cutId} / ${schedule.scheduleId.split("-").at(-1)?.toUpperCase() ?? "RUN"}`,
    decoderVersion: PRIOR_DECODER_VERSION,
    tripletId: schedule.scheduleId,
    cutId,
    courseLength: courseLengthForSpacing(ROW_SPACING),
    corridorMinX: CORRIDOR_MIN_X,
    corridorMaxX: CORRIDOR_MAX_X,
    cruiseSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.cruise,
    minSpeed: SKIPIXL_CHALLENGE_PROFILE.speed.minimum,
    maxSpeed: 78,
    parSeconds: 65,
    winSeconds: PREVIOUS_TARGET_SECONDS,
    difficultyScore: decoded.difficultyScore,
    rowSpacing: ROW_SPACING,
    obstacles: decoded.obstacles,
    receipt,
  });
}

function qpixlDownhillOffset(
  cellIndex: number,
  residual: number,
  left: number,
  right: number,
  above: number,
  below: number,
  rowSpacing = ROW_SPACING,
): number {
  const values = [residual, left, right, above, below];
  const coefficients = [
    2_654_435_761, 2_246_822_519, 3_266_489_917, 668_265_263, 374_761_393,
  ];
  let phase = Math.imul(cellIndex + 1, 1_597_334_677) >>> 0;
  values.forEach((value, index) => {
    const quantized = Math.round((value + 1) * 1_000_000);
    phase = (phase + Math.imul(quantized, coefficients[index] ?? 1)) >>> 0;
    phase = Math.imul(phase ^ (phase >>> 16), 2_246_822_519) >>> 0;
  });
  return (phase % rowSpacing) - Math.floor(rowSpacing / 2);
}

function decodeGates(
  obstacles: readonly SkiPixlObstacle[],
  cutId: SkiPixlCutId,
  courseLength: number,
  easyGates = false,
): readonly SkiPixlGate[] {
  const gateCount = cutId === "P90" && easyGates ? 4 : GATE_COUNTS[cutId];
  if (gateCount === 0) return Object.freeze([]);
  const halfWidth = cutId === "P90" && easyGates ? 90 : GATE_HALF_WIDTHS[cutId];
  const gates = Array.from({ length: gateCount }, (_, index) => {
    const targetDistance = (courseLength * (index + 1)) / (gateCount + 1);
    const anchor = [...obstacles].sort(
      (left, right) =>
        Math.abs(left.distance - targetDistance) -
          Math.abs(right.distance - targetDistance) ||
        right.absoluteResidual - left.absoluteResidual ||
        left.obstacleId.localeCompare(right.obstacleId),
    )[0];
    if (!anchor)
      throw new Error(`SkiPixl ${cutId} cannot derive gate ${index + 1}.`);
    const minimumCenter = CORRIDOR_MIN_X + halfWidth + 8;
    const maximumCenter = CORRIDOR_MAX_X - halfWidth - 8;
    const centerX = Math.round(clamp(anchor.x, minimumCenter, maximumCenter));
    return Object.freeze({
      gateId: `gate-${String(index + 1).padStart(2, "0")}`,
      distance: Math.round(targetDistance),
      centerX,
      leftX: centerX - halfWidth,
      rightX: centerX + halfWidth,
      sourceObstacleId: anchor.obstacleId,
      segmentId: anchor.segmentId,
      cellIndex: anchor.cellIndex,
      residual: anchor.residual,
    });
  });
  gates.sort((left, right) => left.distance - right.distance);
  return Object.freeze(gates);
}

function difficultyForCut(cutId: SkiPixlCutId): SkiPixlDifficulty {
  if (cutId === "P90") return "easy";
  if (cutId === "P84") return "medium";
  return "hard";
}

function rowSpacingForCut(cutId: SkiPixlCutId): number {
  return cutId === "P90" ? EASY_ROW_SPACING : CURRENT_ADVANCED_ROW_SPACING;
}

function legacyRowSpacingForCut(cutId: SkiPixlCutId): number {
  return cutId === "P90" ? EASY_ROW_SPACING : ROW_SPACING;
}

function targetSecondsForCut(_cutId: SkiPixlCutId): number {
  return TARGET_SECONDS;
}

function previousTargetSecondsForCut(cutId: SkiPixlCutId): number {
  return cutId === "P90" ? 60 : PREVIOUS_TARGET_SECONDS;
}

function courseLengthForSpacing(rowSpacing: number): number {
  return rowSpacing * 61;
}

function decodeLegacyCourse(
  schedule: ScheduleRecord,
  threshold: number,
): SkiPixlPackPayload {
  const segments = scheduleSegments(schedule);
  const obstacles: SkiPixlObstacle[] = [];
  segments.forEach((segment, segmentOrder) => {
    for (let localRow = 0; localRow < 20; localRow += 1) {
      const selected: SkiPixlObstacle[] = [];
      for (let column = 0; column < 20; column += 1) {
        const cellIndex = localRow * 20 + column;
        const source = segment.sourcePixels[cellIndex];
        const returned = segment.returnedValues[cellIndex];
        if (source === undefined || returned === undefined) continue;
        const residual = returned - source / 255;
        if (Math.abs(residual) < threshold) continue;
        const row = segmentOrder * 20 + localRow;
        selected.push({
          obstacleId: `row-${String(row + 1).padStart(2, "0")}-col-${String(column + 1).padStart(2, "0")}`,
          row,
          distance: ROW_SPACING + row * ROW_SPACING,
          column,
          x: 120 + column * 21,
          kind: residual >= 0 ? "tree" : "rock",
          segmentId: segment.segmentId,
          cellIndex,
          residual,
          absoluteResidual: Math.abs(residual),
          rowHazardIndex: selected.length,
          rowHazardCount: 0,
        });
      }
      selected.forEach((obstacle) =>
        obstacles.push(
          Object.freeze({ ...obstacle, rowHazardCount: selected.length }),
        ),
      );
    }
  });
  const rows = Array.from({ length: 60 }, () => [] as SkiPixlObstacle[]);
  obstacles.forEach((obstacle) => rows[obstacle.row]?.push(obstacle));
  const metrics = courseMetrics(obstacles, rows);
  const catalog = LEGACY_CATALOG.schedules.find(
    (candidate) => candidate.scheduleId === schedule.scheduleId,
  );
  const receipt: SkiPixlCourseReceipt = Object.freeze({
    schemaVersion: "skipixl-course-receipt-v3",
    bankId: SEGMENT_BANK.bankId,
    bankContentSha256: SEGMENT_BANK.bankContentSha256,
    decoderVersion: LEGACY_DECODER_VERSION,
    residualDefinition: "returnedValue - submittedGrayscaleByte / 255",
    rowSelection:
      "select every cell whose absolute residual reaches the bank-wide 72nd-percentile threshold; exact threshold ties remain selected",
    kindMapping:
      "positive or zero residual -> tree; negative residual -> mogul",
    selectionPercentile: LEGACY_CATALOG.selectionPercentile,
    selectionThreshold: threshold,
    ...metrics,
    timeRule:
      "78 + round((difficultyScore - 360) / 9), clamped to 78..100 seconds",
    segments: segments.map(segmentReceipt),
  });
  return deepFreeze({
    courseId: schedule.scheduleId,
    courseLabel: `B3 / ${schedule.scheduleId.split("-").at(-1)?.toUpperCase() ?? "RUN"}`,
    decoderVersion: LEGACY_DECODER_VERSION,
    courseLength: courseLengthForSpacing(ROW_SPACING),
    corridorMinX: CORRIDOR_MIN_X,
    corridorMaxX: CORRIDOR_MAX_X,
    cruiseSpeed: 72,
    minSpeed: 56,
    maxSpeed: 78,
    parSeconds: catalog?.parSeconds ?? 70,
    winSeconds: catalog?.winSeconds ?? 80,
    difficultyScore: metrics.difficultyScore,
    rowSpacing: ROW_SPACING,
    obstacles,
    receipt,
  });
}

function courseMetrics(
  obstacles: readonly SkiPixlObstacle[],
  rows: readonly (readonly SkiPixlObstacle[])[],
): DecodedCourse {
  const treeObstacleCount = obstacles.filter(
    (obstacle) => obstacle.kind === "tree",
  ).length;
  const denseRowCount = rows.filter(
    (row) => row.length >= DENSE_ROW_HAZARD_COUNT,
  ).length;
  const saturatedRowCount = rows.filter(rowIsSaturated).length;
  const obstacleCount = obstacles.length;
  return Object.freeze({
    obstacles: Object.freeze([...obstacles]),
    obstacleCount,
    treeObstacleCount,
    mogulObstacleCount: obstacleCount - treeObstacleCount,
    denseRowCount,
    saturatedRowCount,
    difficultyScore: obstacleCount + denseRowCount * 4 + saturatedRowCount * 12,
  });
}

function rowIsSaturated(row: readonly SkiPixlObstacle[]): boolean {
  const usableMinimum =
    CORRIDOR_MIN_X + SKIPIXL_CHALLENGE_PROFILE.skierCollisionRadius;
  const usableMaximum =
    CORRIDOR_MAX_X - SKIPIXL_CHALLENGE_PROFILE.skierCollisionRadius;
  const intervals = row
    .map((obstacle) => {
      const radius =
        SKIPIXL_CHALLENGE_PROFILE.skierCollisionRadius +
        SKIPIXL_CHALLENGE_PROFILE.obstacleCollisionRadii[obstacle.kind];
      return [
        Math.max(usableMinimum, obstacle.x - radius),
        Math.min(usableMaximum, obstacle.x + radius),
      ] as const;
    })
    .filter(([start, end]) => start <= end)
    .sort(([left], [right]) => left - right);
  if (intervals.length === 0 || (intervals[0]?.[0] ?? Infinity) > usableMinimum)
    return false;
  let coveredUntil = intervals[0]?.[1] ?? usableMinimum;
  for (const [start, end] of intervals.slice(1)) {
    if (start > coveredUntil) return false;
    coveredUntil = Math.max(coveredUntil, end);
  }
  return coveredUntil >= usableMaximum;
}

function validateV4Obstacles(
  payload: SkiPixlPackPayload,
  rowSpacing = ROW_SPACING,
): void {
  const cut = SKIPIXL_CUTS.find(
    (candidate) => candidate.cutId === payload.cutId,
  );
  if (!cut || payload.receipt.selectionPercentile !== cut.percentile)
    throw new Error("SkiPixl cut percentile is inconsistent.");
  payload.obstacles.forEach((obstacle, index) => {
    const prior = payload.obstacles[index - 1];
    if (
      obstacle.absoluteResidual < payload.receipt.selectionThreshold ||
      obstacle.kind !== (obstacle.residual >= 0 ? "tree" : "rock") ||
      obstacle.baseDistance !== rowSpacing + obstacle.row * rowSpacing ||
      obstacle.distance !==
        obstacle.baseDistance + (obstacle.downhillOffset ?? NaN) ||
      obstacle.baseX !== 120 + obstacle.column * 21 ||
      obstacle.x !==
        Math.round(
          clamp(
            obstacle.baseX + (obstacle.horizontalOffset ?? NaN),
            CORRIDOR_MIN_X,
            CORRIDOR_MAX_X,
          ),
        ) ||
      obstacle.offsetSourceCellIndexes?.length !== 4 ||
      (prior !== undefined &&
        (obstacle.distance < prior.distance ||
          (obstacle.distance === prior.distance && obstacle.x < prior.x)))
    )
      throw new Error(`SkiPixl v4 obstacle ${index} is invalid.`);
  });
  const rows = Array.from({ length: 60 }, () => [] as SkiPixlObstacle[]);
  payload.obstacles.forEach((obstacle) => rows[obstacle.row]?.push(obstacle));
  const metrics = courseMetrics(payload.obstacles, rows);
  for (const key of [
    "obstacleCount",
    "treeObstacleCount",
    "mogulObstacleCount",
    "denseRowCount",
    "saturatedRowCount",
    "difficultyScore",
  ] as const) {
    if (payload.receipt[key] !== metrics[key])
      throw new Error(`SkiPixl v4 ${key} drifted.`);
  }
}

function validateV5Obstacles(
  payload: SkiPixlPackPayload,
  rowSpacing = ROW_SPACING,
): void {
  validateV4Obstacles(payload, rowSpacing);
  payload.obstacles.forEach((obstacle, index) => {
    const segment = SEGMENT_BANK.segments.find(
      (candidate) => candidate.segmentId === obstacle.segmentId,
    );
    if (!segment)
      throw new Error(`SkiPixl v5 obstacle ${index} lost its source segment.`);
    const residuals = segmentResiduals(segment);
    const [leftIndex, rightIndex, aboveIndex, belowIndex] = offsetSourceIndexes(
      obstacle.cellIndex,
    );
    const expectedOffset = qpixlDownhillOffset(
      obstacle.cellIndex,
      obstacle.residual,
      residuals[leftIndex] ?? 0,
      residuals[rightIndex] ?? 0,
      residuals[aboveIndex] ?? 0,
      residuals[belowIndex] ?? 0,
      rowSpacing,
    );
    if (obstacle.downhillOffset !== expectedOffset)
      throw new Error(`SkiPixl v5 obstacle ${index} spatial phase drifted.`);
  });
}

function validateV6Obstacles(payload: SkiPixlPackPayload): void {
  validateV5Obstacles(payload, payload.rowSpacing);
}

function validateV5Gates(payload: SkiPixlPackPayload): void {
  if (!isCutId(payload.cutId) || !Array.isArray(payload.gates))
    throw new Error("SkiPixl v5 gates are incomplete.");
  const expected = decodeGates(
    payload.obstacles,
    payload.cutId,
    payload.courseLength,
    payload.receipt.schemaVersion === "skipixl-course-receipt-v9",
  );
  if (canonicalJson(payload.gates) !== canonicalJson(expected))
    throw new Error("SkiPixl v5 QPixl-derived gates drifted.");
}

function validateV6Gates(payload: SkiPixlPackPayload): void {
  validateV5Gates(payload);
}

function designerRowEvidence(
  pack: SkiPixlCommittedPack,
  segment: SegmentRecord,
  segmentOrder: number,
  localRow: number,
): SkiPixlDesignerRowEvidence {
  const courseRow = segmentOrder * 20 + localRow;
  return Object.freeze({
    segmentOrder,
    segmentId: segment.segmentId,
    localRow,
    courseRow,
    selectionThreshold: pack.payload.receipt.selectionThreshold,
    selectedHazards: Object.freeze(
      pack.payload.obstacles
        .filter((obstacle) => obstacle.row === courseRow)
        .map((obstacle) => designerHazardEvidence(segment, obstacle)),
    ),
  });
}

function designerHazardEvidence(
  segment: SegmentRecord,
  obstacle: SkiPixlObstacle,
): SkiPixlDesignerHazardEvidence {
  const sourceByte = segment.sourcePixels[obstacle.cellIndex];
  const returnedValue = segment.returnedValues[obstacle.cellIndex];
  if (sourceByte === undefined || returnedValue === undefined)
    throw new Error(
      `SkiPixl evidence is missing ${segment.segmentId} cell ${obstacle.cellIndex}.`,
    );
  return Object.freeze({
    obstacleId: obstacle.obstacleId,
    column: obstacle.column,
    cellIndex: obstacle.cellIndex,
    sourceByte,
    sourceValue: sourceByte / 255,
    returnedValue,
    residual: obstacle.residual,
    absoluteResidual: obstacle.absoluteResidual,
    kind: obstacle.kind,
    x: obstacle.x,
    distance: obstacle.distance,
    horizontalOffset: obstacle.horizontalOffset ?? 0,
    downhillOffset: obstacle.downhillOffset ?? 0,
    offsetSourceCellIndexes:
      obstacle.offsetSourceCellIndexes ??
      ([
        obstacle.cellIndex,
        obstacle.cellIndex,
        obstacle.cellIndex,
        obstacle.cellIndex,
      ] as const),
  });
}

function segmentReceipt(
  segment: SegmentRecord,
  order = segment.order,
): SkiPixlSegmentReceipt {
  return Object.freeze({
    order,
    segmentId: segment.segmentId,
    sourceIdentity: segment.sourceIdentity,
    sourceSha256: segment.sourceSha256,
    sourcePixelSha256: segment.sourcePixelSha256,
    mothJobId: segment.mothJobId,
    ibmJobId: segment.ibmJobId,
    resultArtifactSha256: segment.resultArtifactSha256,
    returnedValuesSha256: segment.returnedValuesSha256,
  });
}

function assertCatalogMetrics(
  payload: SkiPixlPackPayload,
  catalog: CatalogEntry,
): void {
  for (const key of [
    "obstacleCount",
    "treeObstacleCount",
    "mogulObstacleCount",
    "denseRowCount",
    "saturatedRowCount",
    "difficultyScore",
  ] as const) {
    if (payload.receipt[key] !== catalog[key])
      throw new Error(`${payload.courseId} ${key} drifted from its catalog.`);
  }
  if (
    catalog.gateCount !== undefined &&
    (payload.receipt.schemaVersion === "skipixl-course-receipt-v5" ||
      payload.receipt.schemaVersion === "skipixl-course-receipt-v6" ||
      payload.receipt.schemaVersion === "skipixl-course-receipt-v7" ||
      payload.receipt.schemaVersion === "skipixl-course-receipt-v8" ||
      payload.receipt.schemaVersion === "skipixl-course-receipt-v9") &&
    payload.receipt.gateCount !== catalog.gateCount
  )
    throw new Error(`${payload.courseId} gateCount drifted from its catalog.`);
  if (
    payload.receipt.selectionThreshold !== catalog.selectionThreshold ||
    payload.winSeconds !== catalog.winSeconds ||
    payload.parSeconds !== catalog.parSeconds
  )
    throw new Error(`${payload.courseId} cut identity drifted.`);
}

function validateCutCatalog(
  value: unknown,
  decoderVersion: string,
): ResidualCutCatalog {
  if (
    !isRecord(value) ||
    value["schemaVersion"] !== "skipixl-residual-cut-catalog-v1" ||
    value["decoderVersion"] !== decoderVersion ||
    value["sourceBankContentSha256"] !== EXPECTED_BANK_SHA256 ||
    !Array.isArray(value["cuts"]) ||
    !Array.isArray(value["schedules"])
  )
    throw new Error("SkiPixl residual-cut catalog identity is invalid.");
  const schedules = value["schedules"].map((entry, index) => {
    if (
      !isRecord(entry) ||
      typeof entry["scheduleId"] !== "string" ||
      !isCutId(entry["cutId"]) ||
      typeof entry["contentSha256"] !== "string" ||
      !SHA256_PATTERN.test(entry["contentSha256"])
    )
      throw new Error(
        `SkiPixl residual-cut catalog entry ${index} is invalid.`,
      );
    return entry as unknown as CatalogEntry;
  });
  if (schedules.length !== SEGMENT_BANK.schedules.length * SKIPIXL_CUTS.length)
    throw new Error("SkiPixl residual-cut catalog is incomplete.");
  return deepFreeze({
    schemaVersion: "skipixl-residual-cut-catalog-v1",
    decoderVersion,
    sourceBankContentSha256: EXPECTED_BANK_SHA256,
    cuts: value["cuts"] as unknown as ResidualCutCatalog["cuts"],
    schedules,
  });
}

function validateSegmentBank(value: unknown): SegmentBank {
  if (
    !isRecord(value) ||
    value["schemaVersion"] !== "skipixl-qpixl-segment-bank-v1" ||
    value["bankId"] !== "qpixl-b3-segment-bank-v1" ||
    value["bankContentSha256"] !== EXPECTED_BANK_SHA256 ||
    value["engineId"] !== "qpixl-v1" ||
    value["mode"] !== "qpu" ||
    value["backend"] !== "ibm_fez" ||
    value["decoderVersion"] !== CAPTURE_BANK_DECODER_VERSION
  )
    throw new Error("SkiPixl segment bank identity is invalid.");
  if (
    !Array.isArray(value["segments"]) ||
    !Array.isArray(value["schedules"]) ||
    value["segments"].length !== 20 ||
    value["schedules"].length !== 20
  )
    throw new Error("SkiPixl requires twenty segments and schedules.");
  const segments = value["segments"].map(validateSegment);
  const schedules = value["schedules"].map((schedule, index) =>
    validateSchedule(schedule, index, segments.length),
  );
  return deepFreeze({
    bankId: value["bankId"] as string,
    bankContentSha256: value["bankContentSha256"] as string,
    engineId: "qpixl-v1",
    mode: "qpu",
    backend: "ibm_fez",
    captureClassification: String(
      value["captureClassification"] ?? "provider-ui-capture",
    ),
    segments,
    schedules,
  });
}

function validateSegment(value: unknown, index: number): SegmentRecord {
  if (!isRecord(value)) throw new Error(`SkiPixl segment ${index} is invalid.`);
  const sourcePixels = value["sourcePixels"];
  const returnedValues = value["returnedValues"];
  if (
    !Array.isArray(sourcePixels) ||
    sourcePixels.length !== 400 ||
    !Array.isArray(returnedValues) ||
    returnedValues.length !== 400
  )
    throw new Error(`SkiPixl segment ${index} values are invalid.`);
  for (const key of [
    "sourceSha256",
    "sourcePixelSha256",
    "resultArtifactSha256",
    "returnedValuesSha256",
  ] as const)
    if (typeof value[key] !== "string" || !SHA256_PATTERN.test(value[key]))
      throw new Error(`SkiPixl segment ${index} ${key} is invalid.`);
  for (const key of [
    "segmentId",
    "sourceIdentity",
    "mothJobId",
    "ibmJobId",
  ] as const)
    if (typeof value[key] !== "string" || value[key].length === 0)
      throw new Error(`SkiPixl segment ${index} ${key} is invalid.`);
  return deepFreeze({
    order: index,
    segmentId: value["segmentId"] as string,
    sourceIdentity: value["sourceIdentity"] as string,
    sourceSha256: value["sourceSha256"] as string,
    sourcePixelSha256: value["sourcePixelSha256"] as string,
    mothJobId: value["mothJobId"] as string,
    ibmJobId: value["ibmJobId"] as string,
    resultArtifactSha256: value["resultArtifactSha256"] as string,
    returnedValuesSha256: value["returnedValuesSha256"] as string,
    sourcePixels: [...sourcePixels] as number[],
    returnedValues: [...returnedValues] as number[],
  });
}

function validateSchedule(
  value: unknown,
  index: number,
  segmentCount: number,
): ScheduleRecord {
  if (!isRecord(value))
    throw new Error(`SkiPixl schedule ${index} is invalid.`);
  const indexes = value["segmentIndexes"];
  if (
    typeof value["scheduleId"] !== "string" ||
    typeof value["contentSha256"] !== "string" ||
    !SHA256_PATTERN.test(value["contentSha256"]) ||
    !Array.isArray(indexes) ||
    indexes.length !== 3 ||
    indexes.some(
      (item) =>
        !Number.isSafeInteger(item) ||
        Number(item) < 0 ||
        Number(item) >= segmentCount,
    ) ||
    new Set(indexes).size !== 3
  )
    throw new Error(`SkiPixl schedule ${index} violates the triplet contract.`);
  return Object.freeze({
    scheduleId: value["scheduleId"],
    segmentIndexes: [...indexes] as [number, number, number],
    contentSha256: value["contentSha256"],
  });
}

function isCutId(value: unknown): value is SkiPixlCutId {
  return value === "P90" || value === "P84" || value === "P78";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
