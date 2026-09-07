import type {
  SkiPixlObstacleKind,
  SkiPixlPackPayload,
  SkiPixlSegmentReceipt,
  SkiPixlSteeringAngle,
} from "./types";

export const SKIPIXL_CHALLENGE_PROFILE = deepFreeze({
  version: "skipixl-challenge-v5" as const,
  fixedStepHz: 60,
  steeringAngles: [-3, -2, -1, 0, 1, 2, 3] as const,
  speed: {
    cruise: 72,
    minimum: 56,
    maximum: 78,
  },
  lateral: {
    acceleration: 640,
    maximumSpeed: 128,
    releaseDeceleration: 800,
    reversalAcceleration: 960,
  },
  skierCollisionRadius: 9,
  obstacleCollisionRadii: {
    tree: 17,
    rock: 14,
  } satisfies Readonly<Record<SkiPixlObstacleKind, number>>,
  forwardMultipliers: {
    [-3]: 0.68,
    [-2]: 0.78,
    [-1]: 0.9,
    [0]: 1,
    [1]: 0.9,
    [2]: 0.78,
    [3]: 0.68,
  } satisfies Readonly<Record<SkiPixlSteeringAngle, number>>,
  collisionPenaltyTicks: {
    tree: 72,
    rock: 42,
  } satisfies Readonly<Record<SkiPixlObstacleKind, number>>,
  collisionIndicatorTicks: 72,
  gateMissPenaltyTicks: 150,
  gateIndicatorTicks: 90,
  downhillAccelerationPerSecond: 2.4,
  knockdownSpeedRecoveryPerSecond: 2.8,
});

export interface SkiPixlCourseChallengeEvidence {
  readonly courseId: string;
  readonly decoderVersion: string;
  readonly courseLength: number;
  readonly winSeconds: number;
  readonly difficultyScore: number;
  readonly rowSpacing: number;
  readonly obstacleCount: number;
  readonly treeCount: number;
  readonly mogulCount: number;
  readonly segmentCount: number;
  readonly segments: readonly SkiPixlSegmentReceipt[];
  readonly challengeProfile: typeof SKIPIXL_CHALLENGE_PROFILE;
}

export function skiPixlCollisionClearance(kind: SkiPixlObstacleKind): number {
  return (
    SKIPIXL_CHALLENGE_PROFILE.skierCollisionRadius +
    SKIPIXL_CHALLENGE_PROFILE.obstacleCollisionRadii[kind]
  );
}

export function createSkiPixlCourseChallengeEvidence(
  payload: SkiPixlPackPayload,
): SkiPixlCourseChallengeEvidence {
  const treeCount = payload.obstacles.filter(
    (obstacle) => obstacle.kind === "tree",
  ).length;
  return deepFreeze({
    courseId: payload.courseId,
    decoderVersion: payload.decoderVersion,
    courseLength: payload.courseLength,
    winSeconds: payload.winSeconds,
    difficultyScore: payload.difficultyScore,
    rowSpacing: payload.rowSpacing,
    obstacleCount: payload.obstacles.length,
    treeCount,
    mogulCount: payload.obstacles.length - treeCount,
    segmentCount: payload.receipt.segments.length,
    segments: payload.receipt.segments.map((segment) => ({ ...segment })),
    challengeProfile: SKIPIXL_CHALLENGE_PROFILE,
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
