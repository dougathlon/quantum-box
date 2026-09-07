import { FLUXBALL_FIXTURE_CATALOG } from "./fluxballControlPacks";
import { buildFluxballRuleSchedule } from "./FluxballRuleBank";
import { interpretRoundRules } from "./standalone/rules/interpretRoundRules";
import { scoringGoalFor } from "./standalone/simulation";
import { FLUXBALL_TOTAL_ROUNDS } from "./types";

const MIN_SEPARATING_ROUNDS = 2;

export const FLUXBALL_STORY_CERTIFIED_SEEDS = deepFreeze({
  2: [0, 1, 2, 3, 4, 5, 6],
  4: [0, 1, 2, 3, 4, 5, 6],
} as const satisfies Readonly<Record<2 | 4, readonly number[]>>);

export interface FluxballStorySeedAssessment {
  readonly runSeed: number;
  readonly competitorCount: 2 | 4;
  readonly admitted: boolean;
  readonly separatingRounds: readonly number[];
}

export interface FluxballStorySeedSelection {
  readonly requestedRunSeed: number;
  readonly selectedRunSeed: number;
  readonly poolIndex: number;
  readonly assessment: FluxballStorySeedAssessment;
}

export function assessFluxballStorySeed(
  runSeed: number,
  competitorCount: 2 | 4,
): FluxballStorySeedAssessment {
  assertUint32(runSeed);
  const separatingRounds: number[] = [];
  for (
    let roundNumber = 1;
    roundNumber <= FLUXBALL_TOTAL_ROUNDS;
    roundNumber += 1
  ) {
    const schedule = buildFluxballRuleSchedule({
      catalog: FLUXBALL_FIXTURE_CATALOG,
      competitorCount,
      runSeed,
      gameplayRoundNumber: roundNumber,
      stateCount: 2,
    });
    const separatesAtLeastOnce = schedule.some(({ trace }) => {
      const rules = interpretRoundRules(trace, "individual");
      const playerA = rules.players.A;
      const playerB = rules.players.B;
      if (!playerA || !playerB) {
        throw new Error(
          "Fluxball Story seed assessment requires Players A and B.",
        );
      }
      return (
        scoringGoalFor("A", playerA.purpose) !==
        scoringGoalFor("B", playerB.purpose)
      );
    });
    if (separatesAtLeastOnce) separatingRounds.push(roundNumber);
  }
  return deepFreeze({
    runSeed,
    competitorCount,
    admitted: separatingRounds.length >= MIN_SEPARATING_ROUNDS,
    separatingRounds,
  });
}

export function selectFluxballStorySeed(
  requestedRunSeed: number,
  competitorCount: 2 | 4,
): FluxballStorySeedSelection {
  assertUint32(requestedRunSeed);
  const pool = FLUXBALL_STORY_CERTIFIED_SEEDS[competitorCount];
  const poolIndex = requestedRunSeed % pool.length;
  const selectedRunSeed = pool[poolIndex];
  if (selectedRunSeed === undefined) {
    throw new Error("Fluxball Story seed pool selection failed.");
  }
  const assessment = assessFluxballStorySeed(selectedRunSeed, competitorCount);
  if (!assessment.admitted) {
    throw new Error(
      `Certified Fluxball ${competitorCount}P Story seed ${selectedRunSeed} failed structural admission.`,
    );
  }
  return deepFreeze({
    requestedRunSeed,
    selectedRunSeed,
    poolIndex,
    assessment,
  });
}

export function isCertifiedFluxballStorySeed(
  runSeed: number,
  competitorCount: 2 | 4,
): boolean {
  assertUint32(runSeed);
  return FLUXBALL_STORY_CERTIFIED_SEEDS[competitorCount].some(
    (certifiedSeed) => certifiedSeed === runSeed,
  );
}

function assertUint32(runSeed: number): void {
  if (!Number.isInteger(runSeed) || runSeed < 0 || runSeed > 0xffff_ffff) {
    throw new RangeError(
      `runSeed must be an unsigned 32-bit integer; received ${runSeed}.`,
    );
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
