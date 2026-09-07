import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import fixtureSchema from "../../schemas/fluxball-fixture-bank-v1.schema.json";
import {
  CONTEXTS,
  OUTCOME_ORDER,
  type ContextDistributions,
  type DensityMatrix,
  type FixtureBank,
  type ProbabilityVector,
} from "./types";

const PROBABILITY_TOLERANCE = 1e-9;
const DIAGNOSTIC_TOLERANCE = 1e-8;
const PSD_TOLERANCE = 1e-8;

type PauliSymbol = "I" | "X" | "Y" | "Z";

interface ComplexNumber {
  readonly real: number;
  readonly imaginary: number;
}

const PAULI_EXPECTATION_KEYS = [
  "IX",
  "IY",
  "IZ",
  "XI",
  "XX",
  "XY",
  "XZ",
  "YI",
  "YX",
  "YY",
  "YZ",
  "ZI",
  "ZX",
  "ZY",
  "ZZ",
] as const;

const PAULI_MATRICES: Readonly<
  Record<PauliSymbol, readonly (readonly ComplexNumber[])[]>
> = {
  I: [
    [
      { real: 1, imaginary: 0 },
      { real: 0, imaginary: 0 },
    ],
    [
      { real: 0, imaginary: 0 },
      { real: 1, imaginary: 0 },
    ],
  ],
  X: [
    [
      { real: 0, imaginary: 0 },
      { real: 1, imaginary: 0 },
    ],
    [
      { real: 1, imaginary: 0 },
      { real: 0, imaginary: 0 },
    ],
  ],
  Y: [
    [
      { real: 0, imaginary: 0 },
      { real: 0, imaginary: -1 },
    ],
    [
      { real: 0, imaginary: 1 },
      { real: 0, imaginary: 0 },
    ],
  ],
  Z: [
    [
      { real: 1, imaginary: 0 },
      { real: 0, imaginary: 0 },
    ],
    [
      { real: 0, imaginary: 0 },
      { real: -1, imaginary: 0 },
    ],
  ],
};

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile<FixtureBank>(fixtureSchema);

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

export function sha256Hex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const paddedView = new DataView(padded.buffer);
  paddedView.setUint32(
    paddedLength - 8,
    Math.floor(bitLength / 0x1_0000_0000),
    false,
  );
  paddedView.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = paddedView.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const word15 = words[index - 15] ?? 0;
      const word2 = words[index - 2] ?? 0;
      const sigma0 =
        rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const sigma1 =
        rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      words[index] =
        ((words[index - 16] ?? 0) +
          sigma0 +
          (words[index - 7] ?? 0) +
          sigma1) >>>
        0;
    }

    let [a, b, c, d, e, f, g, h] = hash as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 =
        (h +
          sum1 +
          choose +
          (SHA256_ROUND_CONSTANTS[index] ?? 0) +
          (words[index] ?? 0)) >>>
        0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = ((hash[0] ?? 0) + a) >>> 0;
    hash[1] = ((hash[1] ?? 0) + b) >>> 0;
    hash[2] = ((hash[2] ?? 0) + c) >>> 0;
    hash[3] = ((hash[3] ?? 0) + d) >>> 0;
    hash[4] = ((hash[4] ?? 0) + e) >>> 0;
    hash[5] = ((hash[5] ?? 0) + f) >>> 0;
    hash[6] = ((hash[6] ?? 0) + g) >>> 0;
    hash[7] = ((hash[7] ?? 0) + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function fail(message: string): never {
  throw new Error(`Invalid Fluxball fixture bank: ${message}`);
}

function assertClose(actual: number, expected: number, label: string): void {
  if (
    !Number.isFinite(actual) ||
    !Number.isFinite(expected) ||
    Math.abs(actual - expected) > DIAGNOSTIC_TOLERANCE
  ) {
    fail(`${label} is ${actual}; expected ${expected}.`);
  }
}

function addComplex(left: ComplexNumber, right: ComplexNumber): ComplexNumber {
  return {
    real: left.real + right.real,
    imaginary: left.imaginary + right.imaginary,
  };
}

function subtractComplex(
  left: ComplexNumber,
  right: ComplexNumber,
): ComplexNumber {
  return {
    real: left.real - right.real,
    imaginary: left.imaginary - right.imaginary,
  };
}

function multiplyComplex(
  left: ComplexNumber,
  right: ComplexNumber,
): ComplexNumber {
  return {
    real: left.real * right.real - left.imaginary * right.imaginary,
    imaginary: left.real * right.imaginary + left.imaginary * right.real,
  };
}

function conjugateComplex(value: ComplexNumber): ComplexNumber {
  return { real: value.real, imaginary: -value.imaginary };
}

function complexMagnitude(value: ComplexNumber): number {
  return Math.hypot(value.real, value.imaginary);
}

function complexMagnitudeSquared(value: ComplexNumber): number {
  return value.real * value.real + value.imaginary * value.imaginary;
}

function densityEntry(
  matrix: DensityMatrix,
  row: number,
  column: number,
): ComplexNumber {
  const value = matrix[row]?.[column];
  if (value === undefined) {
    return fail(`density matrix entry [${row},${column}] is absent.`);
  }
  return { real: value[0], imaginary: value[1] };
}

function complexMatrixEntry(
  matrix: readonly (readonly ComplexNumber[])[],
  row: number,
  column: number,
  label: string,
): ComplexNumber {
  const value = matrix[row]?.[column];
  if (value === undefined) {
    return fail(`${label} matrix entry [${row},${column}] is absent.`);
  }
  return value;
}

function assertPositiveSemidefinite(matrix: DensityMatrix): void {
  const lower: ComplexNumber[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => ({ real: 0, imaginary: 0 })),
  );
  for (let column = 0; column < 4; column += 1) {
    let diagonal = densityEntry(matrix, column, column).real;
    for (let prior = 0; prior < column; prior += 1) {
      diagonal -= complexMagnitudeSquared(
        complexMatrixEntry(lower, column, prior, "Cholesky"),
      );
    }
    if (diagonal < -PSD_TOLERANCE) {
      fail(`density matrix is not positive semidefinite at pivot ${column}.`);
    }
    if (diagonal <= PSD_TOLERANCE) {
      for (let row = column + 1; row < 4; row += 1) {
        let residual = densityEntry(matrix, row, column);
        for (let prior = 0; prior < column; prior += 1) {
          residual = subtractComplex(
            residual,
            multiplyComplex(
              complexMatrixEntry(lower, row, prior, "Cholesky"),
              conjugateComplex(
                complexMatrixEntry(lower, column, prior, "Cholesky"),
              ),
            ),
          );
        }
        if (complexMagnitude(residual) > PSD_TOLERANCE) {
          fail(
            `density matrix is not positive semidefinite at zero pivot ${column}.`,
          );
        }
      }
      continue;
    }
    const pivot = Math.sqrt(diagonal);
    const diagonalRow = lower[column];
    if (diagonalRow === undefined) {
      fail(`Cholesky row ${column} is absent.`);
    }
    diagonalRow[column] = { real: pivot, imaginary: 0 };
    for (let row = column + 1; row < 4; row += 1) {
      let residual = densityEntry(matrix, row, column);
      for (let prior = 0; prior < column; prior += 1) {
        residual = subtractComplex(
          residual,
          multiplyComplex(
            complexMatrixEntry(lower, row, prior, "Cholesky"),
            conjugateComplex(
              complexMatrixEntry(lower, column, prior, "Cholesky"),
            ),
          ),
        );
      }
      const targetRow = lower[row];
      if (targetRow === undefined) {
        fail(`Cholesky row ${row} is absent.`);
      }
      targetRow[column] = {
        real: residual.real / pivot,
        imaginary: residual.imaginary / pivot,
      };
    }
  }
}

function pauliEntry(
  symbol: PauliSymbol,
  row: number,
  column: number,
): ComplexNumber {
  return complexMatrixEntry(PAULI_MATRICES[symbol], row, column, symbol);
}

function tensorPauliEntry(
  loSymbol: PauliSymbol,
  hiSymbol: PauliSymbol,
  row: number,
  column: number,
): ComplexNumber {
  const hiRow = Math.floor(row / 2);
  const loRow = row % 2;
  const hiColumn = Math.floor(column / 2);
  const loColumn = column % 2;
  return multiplyComplex(
    pauliEntry(hiSymbol, hiRow, hiColumn),
    pauliEntry(loSymbol, loRow, loColumn),
  );
}

function matrixPauliExpectation(
  matrix: DensityMatrix,
  loSymbol: PauliSymbol,
  hiSymbol: PauliSymbol,
): ComplexNumber {
  let result: ComplexNumber = { real: 0, imaginary: 0 };
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      result = addComplex(
        result,
        multiplyComplex(
          densityEntry(matrix, row, column),
          tensorPauliEntry(loSymbol, hiSymbol, column, row),
        ),
      );
    }
  }
  return result;
}

export function assertDensityMatrix(
  matrix: DensityMatrix,
  expectations: Readonly<Record<string, number>>,
): void {
  let trace: ComplexNumber = { real: 0, imaginary: 0 };
  for (let row = 0; row < 4; row += 1) {
    trace = addComplex(trace, densityEntry(matrix, row, row));
    for (let column = 0; column < 4; column += 1) {
      const value = densityEntry(matrix, row, column);
      const conjugatePartner = conjugateComplex(
        densityEntry(matrix, column, row),
      );
      if (
        complexMagnitude(subtractComplex(value, conjugatePartner)) >
        DIAGNOSTIC_TOLERANCE
      ) {
        fail(`density matrix is not Hermitian at [${row},${column}].`);
      }
    }
  }
  assertClose(trace.real, 1, "density matrix trace real component");
  assertClose(trace.imaginary, 0, "density matrix trace imaginary component");
  assertPositiveSemidefinite(matrix);

  for (const key of PAULI_EXPECTATION_KEYS) {
    const loSymbol = key[0] as PauliSymbol;
    const hiSymbol = key[1] as PauliSymbol;
    const computed = matrixPauliExpectation(matrix, loSymbol, hiSymbol);
    assertClose(
      computed.real,
      expectations[key] ?? Number.NaN,
      `density matrix ${key} expectation`,
    );
    assertClose(
      computed.imaginary,
      0,
      `density matrix ${key} imaginary expectation`,
    );
  }
}

export function assertProbabilityVector(
  vector: ProbabilityVector,
  label: string,
): void {
  const total = OUTCOME_ORDER.reduce(
    (sum, outcome) => sum + vector[outcome],
    0,
  );
  if (Math.abs(total - 1) > PROBABILITY_TOLERANCE) {
    fail(`${label} probabilities sum to ${total}, not 1.`);
  }
}

function expectedPauliValues(vector: ProbabilityVector): {
  readonly playerA: number;
  readonly playerB: number;
  readonly correlation: number;
} {
  return {
    playerA: vector.pp + vector.pm - vector.mp - vector.mm,
    playerB: vector.pp - vector.pm + vector.mp - vector.mm,
    correlation: vector.pp - vector.pm - vector.mp + vector.mm,
  };
}

export function assertDistributionExpectationConsistency(
  distributions: ContextDistributions,
  expectations: Readonly<Record<string, number>>,
  label: string,
): void {
  for (const context of CONTEXTS) {
    const expected = expectedPauliValues(distributions[context]);
    assertClose(
      expectations[`${context}I`] ?? Number.NaN,
      expected.playerA,
      `${label} ${context}I`,
    );
    assertClose(
      expectations[`I${context}`] ?? Number.NaN,
      expected.playerB,
      `${label} I${context}`,
    );
    assertClose(
      expectations[`${context}${context}`] ?? Number.NaN,
      expected.correlation,
      `${label} ${context}${context}`,
    );
  }
}

export function pairTotalVariation(
  left: ProbabilityVector,
  right: ProbabilityVector,
): number {
  return (
    OUTCOME_ORDER.reduce(
      (sum, outcome) => sum + Math.abs(left[outcome] - right[outcome]),
      0,
    ) / 2
  );
}

function assertCircuitPreimageHashes(
  qasmPreimages: readonly string[],
  hashes: readonly string[],
  label: string,
): void {
  for (let index = 0; index < qasmPreimages.length; index += 1) {
    const qasm = qasmPreimages[index];
    const expectedHash = hashes[index];
    if (qasm === undefined || expectedHash === undefined) {
      fail(`${label} circuit record ${index} is incomplete.`);
    }
    const declarations = qasm.match(
      /^creg [A-Za-z_][A-Za-z0-9_]*\[[0-9]+\];$/gm,
    );
    if (
      declarations === null ||
      declarations.length !== 1 ||
      declarations[0] !== "creg c0[2];"
    ) {
      fail(`${label} circuit ${index} does not use canonical creg c0[2].`);
    }
    const computedHash = sha256Hex(qasm);
    if (computedHash !== expectedHash) {
      fail(
        `${label} circuit ${index} hashes to ${computedHash}, not ${expectedHash}.`,
      );
    }
  }
}

function assertDerivedValues(bank: FixtureBank): void {
  const fixture = bank.fixtures[bank.defaultFixtureId];
  const { acquisition } = fixture;
  const expectedShots =
    acquisition.tomographyCircuitCount * acquisition.shotsPerCircuit;
  if (acquisition.totalShots !== expectedShots) {
    fail(
      `acquisition.totalShots is ${acquisition.totalShots}; expected ${expectedShots}.`,
    );
  }
  if (
    bank.costEstimate.shotsPerCircuit !== acquisition.shotsPerCircuit ||
    bank.costEstimate.totalShots !== acquisition.totalShots
  ) {
    fail("costEstimate does not match the fixture acquisition record.");
  }
  if (new Set(acquisition.logicalMeasurementCircuitSha256).size !== 9) {
    fail("logical tomography circuit hashes are not nine distinct identities.");
  }
  if (new Set(acquisition.transpiledAerCircuitSha256).size !== 9) {
    fail(
      "transpiled tomography circuit hashes are not nine distinct identities.",
    );
  }
  assertCircuitPreimageHashes(
    acquisition.logicalMeasurementCircuitQasm,
    acquisition.logicalMeasurementCircuitSha256,
    "logical tomography",
  );
  assertCircuitPreimageHashes(
    acquisition.transpiledAerCircuitQasm,
    acquisition.transpiledAerCircuitSha256,
    "transpiled tomography",
  );

  const initialCircuit = bank.model.initialCircuit;
  if (
    initialCircuit.serialization !== fixture.circuit.serialization ||
    initialCircuit.sha256 !== fixture.circuit.sha256
  ) {
    fail("model and fixture circuit identities disagree.");
  }
  const computedCircuitHash = sha256Hex(fixture.circuit.serialization);
  if (computedCircuitHash !== fixture.circuit.sha256) {
    fail(
      `circuit serialization hashes to ${computedCircuitHash}, not ${fixture.circuit.sha256}.`,
    );
  }

  const quantumGraphSource = bank.provenance.verifiedSources.quantumgraph;
  const fitterSource = bank.provenance.verifiedSources["pairwise-tomography"];
  if (
    quantumGraphSource.commit !== bank.provenance.quantumGraphCommit ||
    quantumGraphSource.requestedRevision !== quantumGraphSource.commit ||
    fitterSource.commit !== bank.provenance.pairwiseTomographyCommit ||
    fitterSource.requestedRevision !== fitterSource.commit
  ) {
    fail("verified VCS source records disagree with the reviewed revisions.");
  }

  const allFiniteProbabilities: number[] = [];
  let maxFitTotalVariation = 0;
  assertDensityMatrix(
    fixture.pair.densityMatrix,
    fixture.pair.pauliExpectations,
  );
  for (const context of CONTEXTS) {
    const finite = fixture.pair.distributions[context];
    const product = fixture.pair.productMarginalsControl[context];
    const exact = fixture.exactStateDiagnostic.pair.distributions[context];
    assertProbabilityVector(finite, `finite ${context}`);
    assertProbabilityVector(product, `product-control ${context}`);
    assertProbabilityVector(exact, `exact diagnostic ${context}`);
    allFiniteProbabilities.push(
      ...OUTCOME_ORDER.map((outcome) => finite[outcome]),
    );
    assertClose(
      bank.calibration.finiteSameParityProbability[context],
      finite.pp + finite.mm,
      `calibration ${context} SAME parity`,
    );
    assertClose(
      bank.calibration.finiteProductMarginalsTotalVariation[context],
      pairTotalVariation(finite, product),
      `calibration ${context} product-control total variation`,
    );
    maxFitTotalVariation = Math.max(
      maxFitTotalVariation,
      pairTotalVariation(finite, exact),
    );
  }
  assertDistributionExpectationConsistency(
    fixture.pair.distributions,
    fixture.pair.pauliExpectations,
    "finite",
  );
  assertDistributionExpectationConsistency(
    fixture.exactStateDiagnostic.pair.distributions,
    fixture.exactStateDiagnostic.pair.pauliExpectations,
    "exact diagnostic",
  );
  assertClose(
    fixture.derivation.maxFiniteVsExactTotalVariation,
    maxFitTotalVariation,
    "max finite-vs-exact total variation",
  );
  assertClose(
    bank.calibration.finiteMinimumOutcomeProbability,
    Math.min(...allFiniteProbabilities),
    "finite minimum outcome probability",
  );
  assertClose(
    bank.calibration.finiteMaximumOutcomeProbability,
    Math.max(...allFiniteProbabilities),
    "finite maximum outcome probability",
  );
}

export function validateFixtureBank(input: unknown): FixtureBank {
  if (!validateSchema(input)) {
    const details = ajv.errorsText(validateSchema.errors, { separator: "; " });
    fail(details);
  }
  assertDerivedValues(input);
  return input;
}

export function isFixtureBank(input: unknown): input is FixtureBank {
  try {
    validateFixtureBank(input);
    return true;
  } catch {
    return false;
  }
}
