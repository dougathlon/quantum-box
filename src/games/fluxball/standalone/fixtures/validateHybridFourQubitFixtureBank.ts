import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import twoQubitSchema from "../../schemas/fluxball-fixture-bank-v1.schema.json";
import legacyFourQubitSchema from "../../schemas/fluxball-four-qubit-fixture-bank-v1.schema.json";
import hybridSchema from "../../schemas/fluxball-four-qubit-hybrid-fixture-bank-v1.schema.json";
import type { Context, ProbabilityVector } from "./types";
import {
  FOUR_OUTCOME_ORDER,
  fourProductMarginals,
} from "./validateFourQubitFixtureBank";
import type { FourCountVector, FourProbabilityVector } from "./fourQubitTypes";
import {
  HYBRID_EDGE_IDS,
  HYBRID_MEASUREMENT_SETTINGS,
  type HybridEdgeId,
  type HybridFourQubitFixtureBank,
} from "./hybridFourQubitTypes";
import {
  assertDensityMatrix,
  assertDistributionExpectationConsistency,
  assertProbabilityVector,
  pairTotalVariation,
  sha256Hex,
} from "./validateFixtureBank";

const CONTEXTS = ["X", "Y", "Z"] as const satisfies readonly Context[];
const TOLERANCE = 1e-8;
const EDGE_SPEC = {
  "A-C": { edge: [0, 2], players: ["A", "C"], matrix: "q2-tensor-q0" },
  "A-D": { edge: [0, 3], players: ["A", "D"], matrix: "q3-tensor-q0" },
  "B-C": { edge: [1, 2], players: ["B", "C"], matrix: "q2-tensor-q1" },
  "B-D": { edge: [1, 3], players: ["B", "D"], matrix: "q3-tensor-q1" },
} as const satisfies Readonly<
  Record<
    HybridEdgeId,
    {
      readonly edge: readonly [number, number];
      readonly players: readonly ["A" | "B", "C" | "D"];
      readonly matrix: string;
    }
  >
>;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(twoQubitSchema);
ajv.addSchema(legacyFourQubitSchema);
const validateSchema = ajv.compile<HybridFourQubitFixtureBank>(hybridSchema);

function fail(message: string): never {
  throw new Error(
    `Invalid Fluxball hybrid four-qubit fixture bank: ${message}`,
  );
}

function assertClose(actual: number, expected: number, label: string): void {
  if (
    !Number.isFinite(actual) ||
    !Number.isFinite(expected) ||
    Math.abs(actual - expected) > TOLERANCE
  ) {
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

function countSum(counts: FourCountVector): number {
  return FOUR_OUTCOME_ORDER.reduce((sum, outcome) => sum + counts[outcome], 0);
}

function fourProbabilitySum(vector: FourProbabilityVector): number {
  return FOUR_OUTCOME_ORDER.reduce((sum, outcome) => sum + vector[outcome], 0);
}

function assertFourProbabilityVector(
  vector: FourProbabilityVector,
  label: string,
): void {
  assertClose(fourProbabilitySum(vector), 1, `${label} probability sum`);
  for (const outcome of FOUR_OUTCOME_ORDER) {
    const value = vector[outcome];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      fail(`${label}/${outcome} is not a probability.`);
    }
  }
}

function fourTotalVariation(
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

function parityPlus(vector: FourProbabilityVector): number {
  return FOUR_OUTCOME_ORDER.reduce(
    (sum, outcome) =>
      (outcome.match(/-/g)?.length ?? 0) % 2 === 0
        ? sum + vector[outcome]
        : sum,
    0,
  );
}

function pairProduct(vector: ProbabilityVector): ProbabilityVector {
  const firstPlus = vector.pp + vector.pm;
  const secondPlus = vector.pp + vector.mp;
  return {
    pp: firstPlus * secondPlus,
    pm: firstPlus * (1 - secondPlus),
    mp: (1 - firstPlus) * secondPlus,
    mm: (1 - firstPlus) * (1 - secondPlus),
  };
}

function fullMarginal(
  vector: FourProbabilityVector,
  edge: readonly [number, number],
): ProbabilityVector {
  const result = { pp: 0, pm: 0, mp: 0, mm: 0 };
  for (const outcome of FOUR_OUTCOME_ORDER) {
    const first = outcome[edge[0]];
    const second = outcome[edge[1]];
    const key =
      first === "+"
        ? second === "+"
          ? "pp"
          : "pm"
        : second === "+"
          ? "mp"
          : "mm";
    result[key] += vector[outcome];
  }
  return result;
}

function assertPairVectorClose(
  actual: ProbabilityVector,
  expected: ProbabilityVector,
  label: string,
): void {
  for (const outcome of ["pp", "pm", "mp", "mm"] as const) {
    assertClose(actual[outcome], expected[outcome], `${label}/${outcome}`);
  }
}

function assertCircuitPreimages(
  qasm: readonly string[],
  hashes: readonly string[],
  label: string,
): void {
  if (qasm.length !== 9 || hashes.length !== 9) {
    fail(`${label} does not retain nine complete circuit records.`);
  }
  qasm.forEach((preimage, index) => {
    if (!preimage.includes("creg c0[4];")) {
      fail(`${label} circuit ${index} is not canonical c0[4] QASM.`);
    }
    const observed = sha256Hex(preimage);
    if (observed !== hashes[index]) {
      fail(`${label} circuit ${index} SHA-256 does not match its preimage.`);
    }
  });
}

function validateCrossFields(bank: HybridFourQubitFixtureBank): void {
  const fixture = bank.fixtures[bank.defaultFixtureId];
  const acquisition = fixture.acquisition;
  if (
    fixture.circuit.sha256 !== bank.model.initialCircuit.sha256 ||
    fixture.circuit.serialization !== bank.model.initialCircuit.serialization
  ) {
    fail("model and fixture circuit identities differ.");
  }
  if (sha256Hex(fixture.circuit.serialization) !== fixture.circuit.sha256) {
    fail("preparation QASM does not match its SHA-256 identity.");
  }
  if (
    bank.model.qubitMap.map((entry) => entry.qubit).join("") !== "0123" ||
    bank.model.qubitMap.map((entry) => entry.playerId).join("") !== "ABCD"
  ) {
    fail("one-player/one-qubit A/B/C/D mapping is not canonical.");
  }
  const quantumGraph = bank.provenance.verifiedSources.quantumgraph;
  const pairwise = bank.provenance.verifiedSources["pairwise-tomography"];
  if (
    quantumGraph.commit !== bank.provenance.quantumGraphCommit ||
    quantumGraph.requestedRevision !== quantumGraph.commit ||
    pairwise.commit !== bank.provenance.pairwiseTomographyCommit ||
    pairwise.requestedRevision !== pairwise.commit
  ) {
    fail("verified source revisions disagree with the reviewed commits.");
  }
  if (
    acquisition.totalShots !==
      acquisition.characterizationCircuitCount * acquisition.shotsPerCircuit ||
    bank.costEstimate.totalShots !== acquisition.totalShots ||
    bank.costEstimate.shotsPerCircuit !== acquisition.shotsPerCircuit
  ) {
    fail("acquisition and cost totals disagree.");
  }
  assertCircuitPreimages(
    acquisition.logicalMeasurementCircuitQasm,
    acquisition.logicalMeasurementCircuitSha256,
    "logical tomography",
  );
  assertCircuitPreimages(
    acquisition.transpiledAerCircuitQasm,
    acquisition.transpiledAerCircuitSha256,
    "transpiled tomography",
  );
  if (
    sha256Hex(stableJson(acquisition.tomographyRawCounts)) !==
    acquisition.tomographyRawCountsSha256
  ) {
    fail("tomography raw-count digest does not match the retained counts.");
  }
  if (
    stableJson(Object.keys(acquisition.tomographyRawCounts)) !==
    stableJson(HYBRID_MEASUREMENT_SETTINGS)
  ) {
    fail(
      "tomography count records do not preserve the reviewed setting order.",
    );
  }
  for (const setting of HYBRID_MEASUREMENT_SETTINGS) {
    const counts = acquisition.tomographyRawCounts[setting];
    if (countSum(counts) !== acquisition.shotsPerCircuit) {
      fail(`${setting} counts do not sum to the shot count.`);
    }
  }

  const fullControls = fourProductMarginals(fixture.distributions);
  const allFinite: number[] = [];
  for (const context of CONTEXTS) {
    const setting = acquisition.uniformGameplaySettings[context];
    const retainedCounts = acquisition.fullRegisterRawCounts[context];
    if (
      stableJson(retainedCounts) !==
      stableJson(acquisition.tomographyRawCounts[setting])
    ) {
      fail(
        `${context} gameplay counts are not the retained ${setting} counts.`,
      );
    }
    const finite = fixture.distributions[context];
    const exact = fixture.exactStateDiagnostic.distributions[context];
    const control = fixture.productMarginalsControl[context];
    assertFourProbabilityVector(finite, `${context} joint finite`);
    assertFourProbabilityVector(exact, `${context} joint exact`);
    assertFourProbabilityVector(control, `${context} joint product control`);
    for (const outcome of FOUR_OUTCOME_ORDER) {
      if (retainedCounts[outcome] <= 0) {
        fail(`${context}/${outcome} was not observed in the gameplay setting.`);
      }
      assertClose(
        finite[outcome],
        retainedCounts[outcome] / acquisition.shotsPerCircuit,
        `${context}/${outcome} count-derived probability`,
      );
      assertClose(
        control[outcome],
        fullControls[context][outcome],
        `${context}/${outcome} product control`,
      );
      allFinite.push(finite[outcome]);
    }
    assertClose(
      bank.calibration.finiteParityPlusProbability[context],
      parityPlus(finite),
      `${context} joint parity-plus`,
    );
    assertClose(
      bank.calibration.finiteProductMarginalsTotalVariation[context],
      fourTotalVariation(finite, control),
      `${context} joint product-control TV`,
    );
    assertClose(
      bank.calibration.finiteVsExactTotalVariation[context],
      fourTotalVariation(finite, exact),
      `${context} joint finite/exact TV`,
    );
    (["A", "B", "C", "D"] as const).forEach((playerId, index) => {
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
    "joint minimum probability",
  );
  assertClose(
    bank.calibration.finiteMaximumOutcomeProbability,
    Math.max(...allFinite),
    "joint maximum probability",
  );

  let maximumExact = 0;
  let maximumMarginal = 0;
  for (const edgeId of HYBRID_EDGE_IDS) {
    const pair = fixture.pairs[edgeId];
    const exactPair = fixture.exactStateDiagnostic.pairs[edgeId];
    const expected = EDGE_SPEC[edgeId];
    if (
      stableJson(pair.canonicalEdge) !== stableJson(expected.edge) ||
      stableJson(pair.playerOrder) !== stableJson(expected.players) ||
      pair.edgeId !== edgeId ||
      pair.matrixOrder !== expected.matrix
    ) {
      fail(`${edgeId} identity or ordering metadata is inconsistent.`);
    }
    assertDensityMatrix(pair.densityMatrix, pair.pauliExpectations);
    assertDistributionExpectationConsistency(
      pair.distributions,
      pair.pauliExpectations,
      `${edgeId} finite`,
    );
    assertDistributionExpectationConsistency(
      exactPair.distributions,
      exactPair.pauliExpectations,
      `${edgeId} exact`,
    );
    const diagnostics = bank.calibration.edgeDiagnostics.byEdge[edgeId];
    for (const context of CONTEXTS) {
      assertProbabilityVector(
        pair.distributions[context],
        `${edgeId} ${context}`,
      );
      assertProbabilityVector(
        pair.productMarginalsControl[context],
        `${edgeId} ${context} product control`,
      );
      assertProbabilityVector(
        pair.fullRegisterMarginals[context],
        `${edgeId} ${context} full marginal`,
      );
      assertProbabilityVector(
        exactPair.distributions[context],
        `${edgeId} ${context} exact`,
      );
      const expectedProduct = pairProduct(pair.distributions[context]);
      const expectedMarginal = fullMarginal(
        fixture.distributions[context],
        expected.edge,
      );
      assertPairVectorClose(
        pair.productMarginalsControl[context],
        expectedProduct,
        `${edgeId} ${context} product control`,
      );
      assertPairVectorClose(
        pair.fullRegisterMarginals[context],
        expectedMarginal,
        `${edgeId} ${context} full-register marginal`,
      );
      const marginalTv = pairTotalVariation(
        pair.distributions[context],
        pair.fullRegisterMarginals[context],
      );
      const exactTv = pairTotalVariation(
        pair.distributions[context],
        exactPair.distributions[context],
      );
      const productTv = pairTotalVariation(
        pair.distributions[context],
        pair.productMarginalsControl[context],
      );
      assertClose(
        pair.finiteVsFullRegisterMarginalTotalVariation[context],
        marginalTv,
        `${edgeId} ${context} retained marginal TV`,
      );
      assertClose(
        diagnostics.finiteVsFullRegisterMarginalTotalVariation[context],
        marginalTv,
        `${edgeId} ${context} diagnostic marginal TV`,
      );
      assertClose(
        diagnostics.finiteVsExactTotalVariation[context],
        exactTv,
        `${edgeId} ${context} diagnostic exact TV`,
      );
      assertClose(
        diagnostics.finiteProductMarginalsTotalVariation[context],
        productTv,
        `${edgeId} ${context} diagnostic product TV`,
      );
      maximumMarginal = Math.max(maximumMarginal, marginalTv);
      maximumExact = Math.max(maximumExact, exactTv);
    }
  }
  assertClose(
    bank.calibration.edgeDiagnostics.maximumFiniteVsExactTotalVariation,
    maximumExact,
    "maximum edge finite/exact TV",
  );
  assertClose(
    bank.calibration.edgeDiagnostics
      .maximumFiniteVsFullRegisterMarginalTotalVariation,
    maximumMarginal,
    "maximum edge fit/full-marginal TV",
  );
  if (maximumExact > 0.08 || maximumMarginal > 0.08) {
    fail("edge consistency exceeds the reviewed 0.08 prototype bound.");
  }
}

export function validateHybridFourQubitFixtureBank(
  input: unknown,
): HybridFourQubitFixtureBank {
  if (!validateSchema(input)) {
    const details = validateSchema.errors
      ?.map(
        (error) =>
          `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
      )
      .join("; ");
    fail(details || "schema validation failed.");
  }
  validateCrossFields(input);
  return input;
}
