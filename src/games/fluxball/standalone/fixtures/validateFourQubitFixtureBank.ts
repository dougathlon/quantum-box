import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import fixtureSchema from "../../schemas/fluxball-four-qubit-fixture-bank-v1.schema.json" with { type: "json" };
import type { Context } from "./types";
import type {
  FourContextDistributions,
  FourCountVector,
  FourOutcome,
  FourProbabilityVector,
  FourQubitFixtureBank,
} from "./fourQubitTypes";
import { sha256Hex } from "./validateFixtureBank";

export const FOUR_OUTCOME_ORDER = [
  "++++",
  "+++-",
  "++-+",
  "++--",
  "+-++",
  "+-+-",
  "+--+",
  "+---",
  "-+++",
  "-++-",
  "-+-+",
  "-+--",
  "--++",
  "--+-",
  "---+",
  "----",
] as const satisfies readonly FourOutcome[];

const CONTEXTS = ["X", "Y", "Z"] as const satisfies readonly Context[];
const TOLERANCE = 1e-9;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile<FourQubitFixtureBank>(fixtureSchema);

function fail(message: string): never {
  throw new Error(`Invalid Fluxball four-qubit fixture bank: ${message}`);
}

function assertClose(actual: number, expected: number, label: string): void {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > TOLERANCE) {
    fail(`${label} is ${actual}; expected ${expected}.`);
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, sortJson(nested)]),
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function probabilitySum(probabilities: FourProbabilityVector): number {
  return FOUR_OUTCOME_ORDER.reduce(
    (sum, outcome) => sum + probabilities[outcome],
    0,
  );
}

function countSum(counts: FourCountVector): number {
  return FOUR_OUTCOME_ORDER.reduce((sum, outcome) => sum + counts[outcome], 0);
}

function productOfMarginals(
  probabilities: FourProbabilityVector,
): Record<FourOutcome, number> {
  const plus = [0, 1, 2, 3].map((index) =>
    FOUR_OUTCOME_ORDER.reduce(
      (sum, outcome) =>
        sum + (outcome[index] === "+" ? probabilities[outcome] : 0),
      0,
    ),
  );
  return Object.fromEntries(
    FOUR_OUTCOME_ORDER.map((outcome) => [
      outcome,
      [...outcome].reduce(
        (product, sign, index) =>
          product *
          (sign === "+" ? (plus[index] ?? 0) : 1 - (plus[index] ?? 0)),
        1,
      ),
    ]),
  ) as Record<FourOutcome, number>;
}

function totalVariation(
  left: FourProbabilityVector,
  right: FourProbabilityVector,
): number {
  return (
    FOUR_OUTCOME_ORDER.reduce(
      (sum, outcome) => sum + Math.abs(left[outcome] - right[outcome]),
      0,
    ) / 2
  );
}

function parityPlus(probabilities: FourProbabilityVector): number {
  return FOUR_OUTCOME_ORDER.reduce(
    (sum, outcome) =>
      (outcome.match(/-/g)?.length ?? 0) % 2 === 0
        ? sum + probabilities[outcome]
        : sum,
    0,
  );
}

function assertCircuitHash(
  serialization: string,
  expectedHash: string,
  label: string,
): void {
  const observed = sha256Hex(serialization);
  if (observed !== expectedHash) {
    fail(`${label} SHA-256 is ${observed}; expected ${expectedHash}.`);
  }
}

function assertDistribution(
  probabilities: FourProbabilityVector,
  label: string,
): void {
  assertClose(probabilitySum(probabilities), 1, `${label} probability sum`);
  for (const outcome of FOUR_OUTCOME_ORDER) {
    const value = probabilities[outcome];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      fail(`${label}/${outcome} probability is invalid.`);
    }
  }
}

function validateCrossFields(bank: FourQubitFixtureBank): void {
  const fixture = bank.fixtures[bank.defaultFixtureId];
  const acquisition = fixture.acquisition;
  if (bank.model.initialCircuit.sha256 !== fixture.circuit.sha256) {
    fail("model and fixture circuit hashes differ.");
  }
  assertCircuitHash(
    fixture.circuit.serialization,
    fixture.circuit.sha256,
    "preparation circuit",
  );
  if (bank.model.qubitMap.map((entry) => entry.playerId).join("") !== "ABCD") {
    fail("qubit map does not preserve A/B/C/D order.");
  }
  if (bank.model.qubitMap.map((entry) => entry.qubit).join("") !== "0123") {
    fail("qubit map does not preserve q0/q1/q2/q3 order.");
  }
  if (
    acquisition.totalShots !==
      acquisition.characterizationCircuitCount * acquisition.shotsPerCircuit ||
    bank.costEstimate.totalShots !== acquisition.totalShots ||
    bank.costEstimate.shotsPerCircuit !== acquisition.shotsPerCircuit
  ) {
    fail("acquisition and cost totals disagree.");
  }
  acquisition.logicalMeasurementCircuitQasm.forEach((qasm, index) => {
    assertCircuitHash(
      qasm,
      acquisition.logicalMeasurementCircuitSha256[index] ?? "",
      `logical characterization circuit ${index}`,
    );
    if (!qasm.includes("creg c0[4];")) {
      fail(`logical characterization circuit ${index} is not canonical.`);
    }
  });
  acquisition.transpiledAerCircuitQasm.forEach((qasm, index) => {
    assertCircuitHash(
      qasm,
      acquisition.transpiledAerCircuitSha256[index] ?? "",
      `transpiled characterization circuit ${index}`,
    );
    if (!qasm.includes("creg c0[4];")) {
      fail(`transpiled characterization circuit ${index} is not canonical.`);
    }
  });
  if (
    sha256Hex(stableJson(acquisition.rawCounts)) !== acquisition.rawCountsSha256
  ) {
    fail("raw count digest does not match the retained count records.");
  }

  const allFinite: number[] = [];
  for (const context of CONTEXTS) {
    const counts = acquisition.rawCounts[context];
    const finite = fixture.distributions[context];
    const exact = fixture.exactStateDiagnostic.distributions[context];
    const control = fixture.productMarginalsControl[context];
    if (countSum(counts) !== acquisition.shotsPerCircuit) {
      fail(`${context} counts do not sum to the shot count.`);
    }
    assertDistribution(finite, `${context} finite`);
    assertDistribution(exact, `${context} exact`);
    assertDistribution(control, `${context} product control`);
    const expectedControl = productOfMarginals(finite);
    for (const outcome of FOUR_OUTCOME_ORDER) {
      if (counts[outcome] <= 0) fail(`${context}/${outcome} was not observed.`);
      assertClose(
        finite[outcome],
        counts[outcome] / acquisition.shotsPerCircuit,
        `${context}/${outcome} count-derived probability`,
      );
      assertClose(
        control[outcome],
        expectedControl[outcome],
        `${context}/${outcome} product control`,
      );
      allFinite.push(finite[outcome]);
    }
    assertClose(
      bank.calibration.finiteParityPlusProbability[context],
      parityPlus(finite),
      `${context} parity-plus calibration`,
    );
    assertClose(
      bank.calibration.finiteProductMarginalsTotalVariation[context],
      totalVariation(finite, control),
      `${context} product-control total variation`,
    );
    assertClose(
      bank.calibration.finiteVsExactTotalVariation[context],
      totalVariation(finite, exact),
      `${context} exact total variation`,
    );
    const playerIds = ["A", "B", "C", "D"] as const;
    playerIds.forEach((playerId, index) => {
      const marginal = FOUR_OUTCOME_ORDER.reduce(
        (sum, outcome) => sum + (outcome[index] === "+" ? finite[outcome] : 0),
        0,
      );
      assertClose(
        bank.calibration.finitePlayerPlusMarginals[context][playerId],
        marginal,
        `${context}/${playerId} plus marginal`,
      );
    });
  }
  assertClose(
    bank.calibration.finiteMinimumOutcomeProbability,
    Math.min(...allFinite),
    "finite minimum probability",
  );
  assertClose(
    bank.calibration.finiteMaximumOutcomeProbability,
    Math.max(...allFinite),
    "finite maximum probability",
  );
}

export function validateFourQubitFixtureBank(
  input: unknown,
): FourQubitFixtureBank {
  if (!validateSchema(input)) {
    const details = validateSchema.errors
      ?.map(
        (error) =>
          `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
      )
      .join("; ");
    fail(details || "schema validation failed.");
  }
  const bank = input as FourQubitFixtureBank;
  validateCrossFields(bank);
  return bank;
}

export function fourProductMarginals(
  distributions: FourContextDistributions,
): FourContextDistributions {
  return Object.freeze({
    X: Object.freeze(productOfMarginals(distributions.X)),
    Y: Object.freeze(productOfMarginals(distributions.Y)),
    Z: Object.freeze(productOfMarginals(distributions.Z)),
  });
}
