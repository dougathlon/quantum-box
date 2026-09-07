import type { CompetitorCount } from "../modes";
import type { FourOutcome } from "./fourQubitTypes";
import { FixtureResolver } from "./FixtureResolver";
import type { HybridFourQubitFixtureBank } from "./hybridFourQubitTypes";
import type { Context, FixtureBank } from "./types";
import { FOUR_OUTCOME_ORDER } from "./validateFourQubitFixtureBank";
import { validateHybridFourQubitFixtureBank } from "./validateHybridFourQubitFixtureBank";

export type SignedOutcome = "++" | "+-" | "-+" | "--" | FourOutcome;

export interface RuleDistribution {
  readonly competitorCount: CompetitorCount;
  readonly fixtureBankId: string;
  readonly fixtureId: string;
  readonly context: Context;
  readonly acquisitionSource: "finite-shot-aer";
  readonly shotsPerCircuit: number;
  readonly outcomeOrder: readonly SignedOutcome[];
  readonly probabilities: Readonly<Partial<Record<SignedOutcome, number>>>;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function selectFromDistribution(
  distribution: RuleDistribution,
  draw: number,
): SignedOutcome {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
    throw new RangeError(
      `Probability draw must be in [0, 1); received ${draw}.`,
    );
  }
  let cumulative = 0;
  for (const outcome of distribution.outcomeOrder) {
    const probability = distribution.probabilities[outcome];
    if (probability === undefined) {
      throw new Error(`Rule distribution is missing outcome ${outcome}.`);
    }
    cumulative += probability;
    if (draw < cumulative) return outcome;
  }
  const fallback = distribution.outcomeOrder.at(-1);
  if (!fallback) throw new Error("Rule distribution has no outcomes.");
  return fallback;
}

export class FixtureCatalog {
  readonly #two: FixtureResolver;
  readonly #four: HybridFourQubitFixtureBank;

  public constructor(twoQubitInput: unknown, fourQubitInput: unknown) {
    this.#two = new FixtureResolver(twoQubitInput);
    this.#four = deepFreeze(
      structuredClone(validateHybridFourQubitFixtureBank(fourQubitInput)),
    );
  }

  public getTwoQubitBank(): FixtureBank {
    return this.#two.getBank();
  }

  public getFourQubitBank(): HybridFourQubitFixtureBank {
    return this.#four;
  }

  public getDistribution(
    competitorCount: CompetitorCount,
    context: Context,
  ): RuleDistribution {
    if (competitorCount === 2) {
      const resolved = this.#two.getDistribution(
        this.#two.getDefaultFixtureId(),
        context,
      );
      return deepFreeze({
        competitorCount,
        fixtureBankId: resolved.fixtureBankId,
        fixtureId: resolved.fixtureId,
        context,
        acquisitionSource: resolved.acquisitionSource,
        shotsPerCircuit: resolved.shotsPerCircuit,
        outcomeOrder: ["++", "+-", "-+", "--"],
        probabilities: {
          "++": resolved.probabilities.pp,
          "+-": resolved.probabilities.pm,
          "-+": resolved.probabilities.mp,
          "--": resolved.probabilities.mm,
        },
      });
    }
    const fixture = this.#four.fixtures[this.#four.defaultFixtureId];
    return deepFreeze({
      competitorCount,
      fixtureBankId: this.#four.fixtureBankId,
      fixtureId: fixture.fixtureId,
      context,
      acquisitionSource: this.#four.acquisitionSource,
      shotsPerCircuit: fixture.acquisition.shotsPerCircuit,
      outcomeOrder: [...FOUR_OUTCOME_ORDER],
      probabilities: { ...fixture.distributions[context] },
    });
  }

  public sample(
    competitorCount: CompetitorCount,
    context: Context,
    draw: number,
  ): {
    readonly distribution: RuleDistribution;
    readonly outcome: SignedOutcome;
  } {
    const distribution = this.getDistribution(competitorCount, context);
    return deepFreeze({
      distribution,
      outcome: selectFromDistribution(distribution, draw),
    });
  }
}
