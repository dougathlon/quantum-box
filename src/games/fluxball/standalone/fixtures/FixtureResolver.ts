import {
  OUTCOME_ORDER,
  type Context,
  type DistributionSource,
  type FixtureBank,
  type FixtureRecord,
  type OutcomeKey,
  type ProbabilityVector,
  type ResolvedDistribution,
} from "./types";
import { validateFixtureBank } from "./validateFixtureBank";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function cloneFixtureBank(bank: FixtureBank): FixtureBank {
  return structuredClone(bank);
}

export function selectOutcome(
  probabilities: ProbabilityVector,
  draw: number,
): OutcomeKey {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
    throw new RangeError(
      `Probability draw must be in [0, 1); received ${draw}.`,
    );
  }
  const total = OUTCOME_ORDER.reduce(
    (sum, outcome) => sum + probabilities[outcome],
    0,
  );
  if (Math.abs(total - 1) > 1e-9) {
    throw new RangeError(
      `Probability vector must sum to 1; received ${total}.`,
    );
  }
  let cumulative = 0;
  for (const outcome of OUTCOME_ORDER) {
    cumulative += probabilities[outcome];
    if (draw < cumulative) {
      return outcome;
    }
  }
  return "mm";
}

export class FixtureResolver {
  readonly #bank: FixtureBank;

  public constructor(input: unknown) {
    const validated = validateFixtureBank(input);
    this.#bank = deepFreeze(cloneFixtureBank(validated));
  }

  public getBank(): FixtureBank {
    return this.#bank;
  }

  public getDefaultFixtureId(): FixtureRecord["fixtureId"] {
    return this.#bank.defaultFixtureId;
  }

  public getFixture(fixtureId: string): FixtureRecord {
    if (fixtureId !== this.#bank.defaultFixtureId) {
      throw new Error(`Unknown Fluxball fixture ${JSON.stringify(fixtureId)}.`);
    }
    return this.#bank.fixtures[this.#bank.defaultFixtureId];
  }

  public getDistribution(
    fixtureId: string,
    context: Context,
    source: DistributionSource = "fitted",
  ): ResolvedDistribution {
    const fixture = this.getFixture(fixtureId);
    const probabilities =
      source === "fitted"
        ? fixture.pair.distributions[context]
        : fixture.pair.productMarginalsControl[context];
    return Object.freeze({
      fixtureBankId: this.#bank.fixtureBankId,
      fixtureId: fixture.fixtureId,
      context,
      source,
      acquisitionSource: this.#bank.acquisitionSource,
      shotsPerCircuit: fixture.acquisition.shotsPerCircuit,
      probabilities,
    });
  }
}
