import { Mulberry32, asUint32Seed, deriveSeed } from "../../core/determinism";

export const QGRAPH_CABINET_PACK_SCHEMA =
  "quantum-box-qgraph-cabinet-pack-v1" as const;
export const QGRAPH_FRAME_SCHEMA = "qgraph-whole-register-frame-v1" as const;

export type QGraphSourceClassification = "synthetic-model" | "moth-qgraph-qpu";

export interface WeightedWholeRegisterMeasurement {
  readonly bitstring: string;
  readonly weight: number;
}

export interface QGraphFrame {
  readonly schemaVersion: typeof QGRAPH_FRAME_SCHEMA;
  readonly frameId: string;
  readonly sequenceIndex: number;
  readonly measurements: readonly WeightedWholeRegisterMeasurement[];
}

export interface SyntheticQGraphProvenance {
  readonly kind: "synthetic-model";
  readonly modelId: string;
  readonly generatorVersion: string;
  readonly claimBoundary: string;
  readonly providerExecution: false;
}

export interface QpuQGraphProvenance {
  readonly kind: "qpu-record";
  readonly engineId: "graph-v1";
  readonly mothJobId: string;
  readonly hardwareJobId: string;
  readonly backendName: string;
  readonly rawResultSha256: string;
  readonly distributionProjection: "provider-returned-top-outcomes-v1";
  readonly requestedShots: number;
  readonly returnedShotCount: number;
  readonly returnedProbabilityMass: number;
  readonly returnedMeasurementCount: number;
  readonly providerExecution: true;
}

export interface QGraphCabinetPack {
  readonly schemaVersion: typeof QGRAPH_CABINET_PACK_SCHEMA;
  readonly packId: string;
  readonly contentSha256: string;
  readonly sourceClassification: QGraphSourceClassification;
  readonly provenance: SyntheticQGraphProvenance | QpuQGraphProvenance;
  readonly graphSchemaVersion: "graph-v1-measurement-distribution";
  readonly qubitCount: number;
  readonly bitOrdering: string;
  readonly relationshipInterpretation: string;
  readonly replay: Readonly<{
    algorithm: "mulberry32-v1";
    seedNamespace: string;
    wholeRegisterSampling: true;
  }>;
  readonly frames: readonly QGraphFrame[];
}

const SHA256 = /^[0-9a-f]{64}$/;
const CREDENTIAL_FIELD =
  /(?:api|access|auth|bearer|ibm|moth|qpu)[_-]?(?:key|token|secret|password|instance)$/i;

export function validateQGraphCabinetPack(input: unknown): QGraphCabinetPack {
  if (!isRecord(input)) throw new Error("QGraph pack must be an object.");
  if (containsCredentialField(input)) {
    throw new Error("QGraph packs must not contain provider credentials.");
  }
  if (input["schemaVersion"] !== QGRAPH_CABINET_PACK_SCHEMA) {
    throw new Error("QGraph pack schemaVersion is unsupported.");
  }
  const packId = requiredString(input["packId"], "packId");
  const contentSha256 = requiredString(input["contentSha256"], "contentSha256");
  if (!SHA256.test(contentSha256)) {
    throw new Error("QGraph pack contentSha256 is invalid.");
  }
  const qubitCount = input["qubitCount"];
  if (!Number.isInteger(qubitCount) || (qubitCount as number) < 1) {
    throw new Error("QGraph pack qubitCount must be a positive integer.");
  }
  if (input["graphSchemaVersion"] !== "graph-v1-measurement-distribution") {
    throw new Error("QGraph measurement-distribution schema is unsupported.");
  }
  const sourceClassification = validateSourceClassification(
    input["sourceClassification"],
  );
  const provenance = validateProvenance(
    sourceClassification,
    input["provenance"],
  );
  const replayInput = input["replay"];
  if (
    !isRecord(replayInput) ||
    replayInput["algorithm"] !== "mulberry32-v1" ||
    replayInput["wholeRegisterSampling"] !== true
  ) {
    throw new Error("QGraph replay metadata is incomplete.");
  }
  const framesInput = input["frames"];
  if (!Array.isArray(framesInput) || framesInput.length === 0) {
    throw new Error("QGraph pack requires at least one graph frame.");
  }
  const frames = framesInput.map((frame, index) =>
    validateFrame(frame, index, qubitCount as number),
  );
  if (new Set(frames.map((frame) => frame.frameId)).size !== frames.length) {
    throw new Error("QGraph frame IDs must be unique.");
  }
  return deepFreeze({
    schemaVersion: QGRAPH_CABINET_PACK_SCHEMA,
    packId,
    contentSha256,
    sourceClassification,
    provenance,
    graphSchemaVersion: "graph-v1-measurement-distribution",
    qubitCount: qubitCount as number,
    bitOrdering: requiredString(input["bitOrdering"], "bitOrdering"),
    relationshipInterpretation: requiredString(
      input["relationshipInterpretation"],
      "relationshipInterpretation",
    ),
    replay: {
      algorithm: "mulberry32-v1",
      seedNamespace: requiredString(
        replayInput["seedNamespace"],
        "replay.seedNamespace",
      ),
      wholeRegisterSampling: true,
    },
    frames,
  });
}

export function sampleWholeRegisterFrame(
  pack: QGraphCabinetPack,
  frameIndex: number,
  runSeed: number,
): Readonly<{
  frame: QGraphFrame;
  bitstring: string;
  draw: number;
}> {
  const frame =
    pack.frames[
      ((frameIndex % pack.frames.length) + pack.frames.length) %
        pack.frames.length
    ];
  if (!frame) throw new Error("QGraph pack contains no sampleable frame.");
  const seed = deriveSeed(
    asUint32Seed(runSeed >>> 0),
    `${pack.replay.seedNamespace}:${frame.sequenceIndex}`,
  );
  const draw = new Mulberry32(seed).next();
  const total = frame.measurements.reduce(
    (sum, measurement) => sum + measurement.weight,
    0,
  );
  let cursor = draw * total;
  for (const measurement of frame.measurements) {
    cursor -= measurement.weight;
    if (cursor < 0)
      return deepFreeze({ frame, bitstring: measurement.bitstring, draw });
  }
  const last = frame.measurements.at(-1);
  if (!last) throw new Error("QGraph frame contains no measurements.");
  return deepFreeze({ frame, bitstring: last.bitstring, draw });
}

export function qgraphPackHashMaterial(
  pack: QGraphCabinetPack,
): Omit<QGraphCabinetPack, "contentSha256"> {
  const { contentSha256: _contentSha256, ...material } = pack;
  return material;
}

function validateProvenance(
  source: QGraphSourceClassification,
  input: unknown,
): SyntheticQGraphProvenance | QpuQGraphProvenance {
  if (!isRecord(input)) throw new Error("QGraph provenance must be an object.");
  if (source === "synthetic-model") {
    if (
      input["kind"] !== "synthetic-model" ||
      input["providerExecution"] !== false
    ) {
      throw new Error(
        "Synthetic QGraph provenance cannot represent QPU output.",
      );
    }
    for (const forbidden of [
      "engineId",
      "mothJobId",
      "hardwareJobId",
      "backendName",
      "rawResultSha256",
    ]) {
      if (forbidden in input) {
        throw new Error(`Synthetic QGraph provenance forbids ${forbidden}.`);
      }
    }
    return deepFreeze({
      kind: "synthetic-model",
      modelId: requiredString(input["modelId"], "provenance.modelId"),
      generatorVersion: requiredString(
        input["generatorVersion"],
        "provenance.generatorVersion",
      ),
      claimBoundary: requiredString(
        input["claimBoundary"],
        "provenance.claimBoundary",
      ),
      providerExecution: false,
    });
  }
  if (source !== "moth-qgraph-qpu") {
    throw new Error("QGraph sourceClassification is unsupported.");
  }
  if (input["kind"] !== "qpu-record" || input["providerExecution"] !== true) {
    throw new Error("QPU QGraph provenance requires a provider record.");
  }
  const rawResultSha256 = requiredString(
    input["rawResultSha256"],
    "provenance.rawResultSha256",
  );
  if (!SHA256.test(rawResultSha256)) {
    throw new Error("QPU QGraph raw result hash is invalid.");
  }
  if (input["engineId"] !== "graph-v1") {
    throw new Error("QPU QGraph provenance requires graph-v1.");
  }
  return deepFreeze({
    kind: "qpu-record",
    engineId: "graph-v1",
    mothJobId: requiredString(input["mothJobId"], "provenance.mothJobId"),
    hardwareJobId: requiredString(
      input["hardwareJobId"],
      "provenance.hardwareJobId",
    ),
    backendName: requiredString(input["backendName"], "provenance.backendName"),
    rawResultSha256,
    distributionProjection: requiredLiteral(
      input["distributionProjection"],
      "provider-returned-top-outcomes-v1",
      "provenance.distributionProjection",
    ),
    requestedShots: requiredPositiveInteger(
      input["requestedShots"],
      "provenance.requestedShots",
    ),
    returnedShotCount: requiredPositiveInteger(
      input["returnedShotCount"],
      "provenance.returnedShotCount",
    ),
    returnedProbabilityMass: requiredProbability(
      input["returnedProbabilityMass"],
      "provenance.returnedProbabilityMass",
    ),
    returnedMeasurementCount: requiredPositiveInteger(
      input["returnedMeasurementCount"],
      "provenance.returnedMeasurementCount",
    ),
    providerExecution: true,
  });
}

function validateSourceClassification(
  value: unknown,
): QGraphSourceClassification {
  if (value !== "synthetic-model" && value !== "moth-qgraph-qpu") {
    throw new Error("QGraph sourceClassification is unsupported.");
  }
  return value;
}

function validateFrame(
  input: unknown,
  index: number,
  qubitCount: number,
): QGraphFrame {
  const label = `frames[${index}]`;
  if (!isRecord(input) || input["schemaVersion"] !== QGRAPH_FRAME_SCHEMA) {
    throw new Error(`${label} is not a whole-register frame.`);
  }
  if (input["sequenceIndex"] !== index) {
    throw new Error(`${label}.sequenceIndex must match frame order.`);
  }
  const raw = input["measurements"];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${label} requires weighted measurements.`);
  }
  const measurements = raw.map((measurement, measurementIndex) => {
    if (!isRecord(measurement)) {
      throw new Error(`${label}.measurements[${measurementIndex}] is invalid.`);
    }
    const bitstring = requiredString(
      measurement["bitstring"],
      `${label}.measurements[${measurementIndex}].bitstring`,
    );
    if (!new RegExp(`^[01]{${qubitCount}}$`).test(bitstring)) {
      throw new Error(`${label} contains a non-${qubitCount}-bit measurement.`);
    }
    const weight = measurement["weight"];
    if (!Number.isSafeInteger(weight) || (weight as number) <= 0) {
      throw new Error(`${label} contains a non-positive measurement weight.`);
    }
    return deepFreeze({ bitstring, weight: weight as number });
  });
  if (
    new Set(measurements.map((entry) => entry.bitstring)).size !==
    measurements.length
  ) {
    throw new Error(`${label} repeats a whole-register bitstring.`);
  }
  return deepFreeze({
    schemaVersion: QGRAPH_FRAME_SCHEMA,
    frameId: requiredString(input["frameId"], `${label}.frameId`),
    sequenceIndex: index,
    measurements,
  });
}

function containsCredentialField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsCredentialField);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, child]) =>
      CREDENTIAL_FIELD.test(key) || containsCredentialField(child),
  );
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requiredLiteral<T extends string>(
  value: unknown,
  expected: T,
  label: string,
): T {
  if (value !== expected) throw new Error(`${label} is unsupported.`);
  return expected;
}

function requiredPositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value as number;
}

function requiredProbability(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 1
  ) {
    throw new Error(`${label} must be in (0, 1].`);
  }
  return value;
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
