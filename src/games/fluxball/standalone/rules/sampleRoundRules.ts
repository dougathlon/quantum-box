import { type FixtureCatalog } from "../fixtures";
import type { Context } from "../fixtures/types";
import {
  activePlayerIdsFor,
  type ActivePlayerMap,
  type CompetitorCount,
  type PlayerId,
} from "../modes";
import { DeterministicRng, mixSeed, RNG_ALGORITHM } from "./rng";
import type {
  AxisSample,
  GlobalParity,
  RoundRuleTrace,
  RuleDimension,
  Sign,
} from "./types";

const RULE_SEED_DOMAIN = 0x464c_5558;
const ROUND_SEED_DOMAIN = 0x5255_4c45;

const AXES = [
  { context: "X", dimension: "ACTION", drawIndex: 0 },
  { context: "Y", dimension: "INTERACTION", drawIndex: 1 },
  { context: "Z", dimension: "PURPOSE", drawIndex: 2 },
] as const satisfies readonly {
  readonly context: Context;
  readonly dimension: RuleDimension;
  readonly drawIndex: 0 | 1 | 2;
}[];

export interface SampleRoundRulesOptions {
  readonly catalog: FixtureCatalog;
  readonly competitorCount: CompetitorCount;
  readonly runSeed: number;
  readonly roundNumber: number;
}

export function deriveRuleSeed(runSeed: number, roundNumber: number): number {
  if (!Number.isInteger(runSeed) || runSeed < 0 || runSeed > 0xffff_ffff) {
    throw new RangeError(
      `runSeed must be an unsigned 32-bit integer; received ${runSeed}.`,
    );
  }
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > 8) {
    throw new RangeError(
      `roundNumber must be an integer from 1 through 8; received ${roundNumber}.`,
    );
  }
  return mixSeed(
    mixSeed(runSeed, RULE_SEED_DOMAIN),
    mixSeed(roundNumber, ROUND_SEED_DOMAIN),
  );
}

function signsForOutcome(
  outcome: string,
  activePlayerIds: readonly PlayerId[],
): ActivePlayerMap<Sign> {
  if (outcome.length !== activePlayerIds.length) {
    throw new Error(
      `Outcome ${outcome} does not match ${activePlayerIds.length} active players.`,
    );
  }
  const signs: Partial<Record<PlayerId, Sign>> = {};
  activePlayerIds.forEach((playerId, index) => {
    const sign = outcome[index];
    if (sign !== "+" && sign !== "-") {
      throw new Error(
        `Outcome ${outcome} has an invalid sign at index ${index}.`,
      );
    }
    signs[playerId] = sign;
  });
  return Object.freeze(signs);
}

function globalParity(outcome: string): GlobalParity {
  return (outcome.match(/-/g)?.length ?? 0) % 2 === 0 ? "+" : "-";
}

export function sampleRoundRules({
  catalog,
  competitorCount,
  runSeed,
  roundNumber,
}: SampleRoundRulesOptions): RoundRuleTrace {
  const ruleSeed = deriveRuleSeed(runSeed, roundNumber);
  const rng = new DeterministicRng(ruleSeed);
  const activePlayerIds = activePlayerIdsFor(competitorCount);
  const samples = AXES.map(({ context, dimension, drawIndex }) => {
    const prngDraw = rng.next();
    const sampled = catalog.sample(competitorCount, context, prngDraw);
    return Object.freeze({
      context,
      dimension,
      distribution: sampled.distribution,
      drawIndex,
      prngDraw,
      outcome: sampled.outcome,
      signs: signsForOutcome(sampled.outcome, activePlayerIds),
      globalParity: globalParity(sampled.outcome),
    });
  });
  const [action, interaction, purpose] = samples;
  if (
    action === undefined ||
    interaction === undefined ||
    purpose === undefined ||
    rng.drawCount !== 3
  ) {
    throw new Error(
      "Fluxball rule sampling did not produce exactly three recorded draws.",
    );
  }
  const distribution = action.distribution;
  return Object.freeze({
    roundNumber,
    runSeed,
    ruleSeed,
    rngAlgorithm: RNG_ALGORITHM,
    samplingMethod: "three-separate-classical-draws",
    competitorCount,
    activePlayerIds: Object.freeze([...activePlayerIds]),
    fixtureBankId: distribution.fixtureBankId,
    fixtureId: distribution.fixtureId,
    acquisitionSource: distribution.acquisitionSource,
    shotsPerCircuit: distribution.shotsPerCircuit,
    axes: Object.freeze({
      X: action as AxisSample<"X", "ACTION">,
      Y: interaction as AxisSample<"Y", "INTERACTION">,
      Z: purpose as AxisSample<"Z", "PURPOSE">,
    }),
  });
}
