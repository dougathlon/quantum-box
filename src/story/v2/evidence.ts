import type { RunContext } from "../../core/run";
import { isStoryV2StageId } from "./registry";
import {
  STORY_V2_PRESENTATION_EVIDENCE_VERSION,
  type StoryV2PresentationEvidence,
  type StoryV2PresentationEvidenceDetail,
  type StoryV2StageId,
} from "./types";

export type { StoryV2PresentationEvidence } from "./types";

const SHA256 = /^[0-9a-f]{64}$/;

export interface StoryV2EvidenceBinding {
  readonly stageId: StoryV2StageId;
  readonly run: RunContext;
  readonly activeTick: number;
  readonly evidenceSha256: string;
}

export function createStoryV2PresentationEvidence(
  binding: StoryV2EvidenceBinding,
  detail: StoryV2PresentationEvidenceDetail,
): StoryV2PresentationEvidence {
  return validateStoryV2PresentationEvidence(
    {
      schemaVersion: STORY_V2_PRESENTATION_EVIDENCE_VERSION,
      completeness: "bound",
      identity: {
        runId: binding.run.runId,
        stageId: binding.stageId,
        rulesVersion: binding.run.rulesVersion,
        runSeed: binding.run.runSeed,
        activeTick: binding.activeTick,
        qualificationEvidenceSha256: binding.evidenceSha256,
        pack: { ...binding.run.pack },
      },
      detail,
      limitations: [],
    },
    binding,
  );
}

export function createLegacyStoryV2PresentationEvidence(
  binding: StoryV2EvidenceBinding,
): StoryV2PresentationEvidence {
  return validateStoryV2PresentationEvidence(
    {
      schemaVersion: STORY_V2_PRESENTATION_EVIDENCE_VERSION,
      completeness: "legacy-identity-only",
      identity: {
        runId: binding.run.runId,
        stageId: binding.stageId,
        rulesVersion: binding.run.rulesVersion,
        runSeed: binding.run.runSeed,
        activeTick: binding.activeTick,
        qualificationEvidenceSha256: binding.evidenceSha256,
        pack: { ...binding.run.pack },
      },
      detail: null,
      limitations: [
        "This pending transition predates Story presentation receipts. Run identity is retained, but no stage-specific provider evidence is inferred.",
      ],
    },
    binding,
  );
}

export function validateStoryV2PresentationEvidence(
  value: unknown,
  binding?: StoryV2EvidenceBinding,
): StoryV2PresentationEvidence {
  const record = requireRecord(value, "Story presentation evidence");
  if (
    record["schemaVersion"] !== STORY_V2_PRESENTATION_EVIDENCE_VERSION ||
    (record["completeness"] !== "bound" &&
      record["completeness"] !== "legacy-identity-only")
  ) {
    throw new Error("Story presentation evidence has an unknown schema.");
  }
  const identity = validateIdentity(record["identity"]);
  const limitations = requireStringArray(
    record["limitations"],
    "Story presentation evidence limitations",
  );
  const completeness = record["completeness"];
  const detail =
    completeness === "bound"
      ? validateDetail(record["detail"], identity.stageId, identity)
      : null;
  if (
    completeness === "legacy-identity-only" &&
    (record["detail"] !== null || limitations.length === 0)
  ) {
    throw new Error(
      "Legacy Story presentation evidence must remain explicitly incomplete.",
    );
  }
  if (binding) assertBinding(identity, binding);
  return deepFreeze({
    schemaVersion: STORY_V2_PRESENTATION_EVIDENCE_VERSION,
    completeness,
    identity,
    detail,
    limitations,
  } as StoryV2PresentationEvidence);
}

function validateIdentity(value: unknown) {
  const record = requireRecord(value, "Story presentation evidence identity");
  const stageId = record["stageId"];
  if (!isStoryV2StageId(stageId)) {
    throw new Error("Story presentation evidence has an unknown stage.");
  }
  const pack = requireRecord(record["pack"], "Story presentation pack");
  const contentSha256 = requireHash(
    pack["contentSha256"],
    "Story presentation pack hash",
  );
  const qualificationEvidenceSha256 = requireHash(
    record["qualificationEvidenceSha256"],
    "Story presentation qualification hash",
  );
  const runSeed = requireInteger(
    record["runSeed"],
    "Story presentation run seed",
    0xffff_ffff,
  );
  const activeTick = requireInteger(
    record["activeTick"],
    "Story presentation active tick",
  );
  return deepFreeze({
    runId: requireString(record["runId"], "Story presentation run ID"),
    stageId,
    rulesVersion: requireString(
      record["rulesVersion"],
      "Story presentation rules version",
    ),
    runSeed,
    activeTick,
    qualificationEvidenceSha256,
    pack: {
      packId: requireString(pack["packId"], "Story presentation pack ID"),
      contentSha256,
      schemaVersion: requireString(
        pack["schemaVersion"],
        "Story presentation pack schema",
      ),
      source: requireString(pack["source"], "Story presentation pack source"),
    },
  });
}

function validateDetail(
  value: unknown,
  stageId: StoryV2StageId,
  identity: ReturnType<typeof validateIdentity>,
): StoryV2PresentationEvidenceDetail {
  const record = requireRecord(value, "Story presentation detail");
  const expectedKind = detailKindForStage(stageId);
  if (record["kind"] !== expectedKind) {
    throw new Error(
      `Story presentation detail ${String(record["kind"])} does not match ${stageId}.`,
    );
  }
  switch (expectedKind) {
    case "qong":
      validateQongDetail(record);
      break;
    case "skipixl":
      validateSkiPixlDetail(record);
      break;
    case "fluxball":
      validateFluxballDetail(record);
      break;
    case "quantman":
      validateQuantmanDetail(record);
      break;
    case "quarry":
      validateQuarryDetail(record, identity);
      break;
  }
  return deepFreeze(
    cloneJson(record) as unknown as StoryV2PresentationEvidenceDetail,
  );
}

function validateQongDetail(record: Record<string, unknown>): void {
  if (record["sourceStatus"] !== "recorded-moth-qpu") {
    throw new Error(
      "Qong presentation evidence must identify recorded Moth QPU data.",
    );
  }
  const selector = requireRecord(record["selector"], "Qong selector evidence");
  requireString(selector["selectorPackId"], "Qong selector pack ID");
  requireHash(selector["selectorContentSha256"], "Qong selector hash");
  requireTuple(selector["bitIndices"], 2, "Qong selector bit indices").forEach(
    (value) => requireInteger(value, "Qong selector bit index"),
  );
  requireTuple(selector["bits"], 2, "Qong selector bits").forEach((value) => {
    if (value !== 0 && value !== 1)
      throw new Error("Qong selector bit is invalid.");
  });
  requireInteger(selector["selectedPackIndex"], "Qong selected pack index");
  requireString(selector["selectedPackId"], "Qong selected pack ID");
  requireHash(selector["selectedPackContentSha256"], "Qong selected pack hash");
  const result = requireRecord(record["storedResult"], "Qong stored result");
  requireInteger(result["rallyNumber"], "Qong rally number");
  if (result["bit"] !== 0 && result["bit"] !== 1) {
    throw new Error("Qong result bit is invalid.");
  }
  if (result["outcome"] !== "heads" && result["outcome"] !== "tails") {
    throw new Error("Qong result outcome is invalid.");
  }
  if (result["mappedGoal"] !== "OPPOSITE" && result["mappedGoal"] !== "OWN") {
    throw new Error("Qong result mapping is invalid.");
  }
  for (const key of ["mothJobId", "hardwareJobId", "backendName"] as const) {
    requireString(result[key], `Qong result ${key}`);
  }
  requireHash(result["rawResultSha256"], "Qong raw result hash");
  if (record["finalCourt"] !== undefined) {
    const court = requireRecord(record["finalCourt"], "Qong final court");
    for (const key of [
      "tick",
      "rallyNumber",
      "totalRallies",
      "leftScore",
      "rightScore",
      "observationsRemaining",
    ] as const) {
      requireInteger(court[key], `Qong final court ${key}`);
    }
    if (
      !["unresolved", "measuring", "resolved"].includes(
        String(court["measurementState"]),
      ) ||
      !["unresolved", "opposite", "own"].includes(String(court["goalRule"])) ||
      (court["winner"] !== null &&
        court["winner"] !== "left" &&
        court["winner"] !== "right")
    ) {
      throw new Error("Qong final court state is invalid.");
    }
    const ball = requireRecord(court["ball"], "Qong final court ball");
    requireFinite(ball["x"], "Qong final court ball x");
    requireFinite(ball["y"], "Qong final court ball y");
    requireFinite(court["leftPaddleY"], "Qong final court left paddle");
    requireFinite(court["rightPaddleY"], "Qong final court right paddle");
  }
}

function validateSkiPixlDetail(record: Record<string, unknown>): void {
  if (record["sourceStatus"] !== "recorded-moth-platform-qpu-capture") {
    throw new Error(
      "SkiPixl presentation evidence has the wrong source class.",
    );
  }
  requireString(record["tripletId"], "SkiPixl triplet ID");
  if (!["P90", "P84", "P78"].includes(String(record["cutId"]))) {
    throw new Error("SkiPixl presentation evidence has an invalid cut.");
  }
  requireString(record["decoderVersion"], "SkiPixl decoder version");
  requireString(record["bankId"], "SkiPixl bank ID");
  requireHash(record["bankContentSha256"], "SkiPixl bank hash");
  requireFinite(record["selectionThreshold"], "SkiPixl selection threshold");
  if (record["attempt"] !== undefined) {
    const attempt = requireRecord(record["attempt"], "SkiPixl attempt outcome");
    if (typeof attempt["qualified"] !== "boolean") {
      throw new Error("SkiPixl attempt qualification is invalid.");
    }
    const elapsedSeconds = requireFinite(
      attempt["elapsedSeconds"],
      "SkiPixl attempt elapsed seconds",
    );
    if (elapsedSeconds < 0) {
      throw new Error("SkiPixl attempt elapsed seconds are invalid.");
    }
    const collisionCount = requireInteger(
      attempt["collisionCount"],
      "SkiPixl attempt collision count",
    );
    const gateCount = requireInteger(
      attempt["gateCount"],
      "SkiPixl attempt gate count",
    );
    const passedGateCount = requireInteger(
      attempt["passedGateCount"],
      "SkiPixl attempt passed gate count",
    );
    const missedGateCount = requireInteger(
      attempt["missedGateCount"],
      "SkiPixl attempt missed gate count",
    );
    if (
      collisionCount < 0 ||
      gateCount < 0 ||
      passedGateCount < 0 ||
      missedGateCount < 0 ||
      passedGateCount + missedGateCount !== gateCount
    ) {
      throw new Error("SkiPixl attempt counts are inconsistent.");
    }
  }
  const segments = requireArray(record["segments"], "SkiPixl segments");
  if (segments.length !== 3)
    throw new Error("SkiPixl evidence requires three segments.");
  for (const value of segments) {
    const segment = requireRecord(value, "SkiPixl segment evidence");
    requireString(segment["segmentId"], "SkiPixl segment ID");
    requireHash(segment["sourceSha256"], "SkiPixl source hash");
    requireHash(segment["returnedValuesSha256"], "SkiPixl return hash");
    requireString(segment["mothJobId"], "SkiPixl Moth job ID");
    requireString(segment["ibmJobId"], "SkiPixl IBM job ID");
  }
  const example = requireRecord(
    record["mappedExample"],
    "SkiPixl mapped example",
  );
  requireString(example["segmentId"], "SkiPixl example segment");
  requireInteger(example["cellIndex"], "SkiPixl example cell");
  requireFinite(example["residual"], "SkiPixl example residual");
  if (example["kind"] !== "tree" && example["kind"] !== "rock") {
    throw new Error("SkiPixl example obstacle kind is invalid.");
  }
  requireString(example["obstacleId"], "SkiPixl example obstacle ID");
  requireFinite(example["x"], "SkiPixl example x");
  requireFinite(example["distance"], "SkiPixl example distance");
  if (example["gateId"] !== null) {
    requireString(example["gateId"], "SkiPixl example gate ID");
  }
}

function validateFluxballDetail(record: Record<string, unknown>): void {
  if (
    !["recorded-moth-qpu", "local-synthetic-control"].includes(
      String(record["sourceStatus"]),
    ) ||
    (record["ruleMode"] !== "global" && record["ruleMode"] !== "individual")
  ) {
    throw new Error(
      "Fluxball presentation evidence has an invalid source or mode.",
    );
  }
  requireString(record["fixtureBankId"], "Fluxball bank ID");
  requireString(record["fixtureId"], "Fluxball fixture ID");
  requireString(record["acquisitionSource"], "Fluxball acquisition source");
  requireInteger(record["roundNumber"], "Fluxball round number");
  requireInteger(record["stateIndex"], "Fluxball state index");
  requireTuple(
    record["sourceRoundBuckets"],
    2,
    "Fluxball source buckets",
  ).forEach((value) => requireInteger(value, "Fluxball source bucket"));
  if (record["provider"] !== null) {
    const provider = requireRecord(
      record["provider"],
      "Fluxball provider evidence",
    );
    requireString(provider["mothJobId"], "Fluxball Moth job ID");
    for (const key of ["ibmJobId", "backendName"] as const) {
      if (provider[key] !== null)
        requireString(provider[key], `Fluxball ${key}`);
    }
    if (provider["rawResultSha256"] !== null) {
      requireHash(provider["rawResultSha256"], "Fluxball raw result hash");
    }
  } else if (record["sourceStatus"] === "recorded-moth-qpu") {
    throw new Error(
      "Recorded-QPU Fluxball evidence requires provider identity.",
    );
  }
  const axes = requireArray(record["mappedAxes"], "Fluxball mapped axes");
  if (axes.length !== 3)
    throw new Error("Fluxball evidence requires three mapped axes.");
  for (const value of axes) {
    const axis = requireRecord(value, "Fluxball axis evidence");
    if (
      !["ACTION", "INTERACTION", "PURPOSE"].includes(String(axis["dimension"]))
    ) {
      throw new Error("Fluxball evidence has an invalid rule dimension.");
    }
    requireString(axis["outcome"], "Fluxball axis outcome");
    requireStringArray(axis["playerRules"], "Fluxball player rules");
  }
}

function validateQuantmanDetail(record: Record<string, unknown>): void {
  if (
    record["sourceStatus"] !== "recorded-moth-qpu" ||
    (record["mechanic"] !== "stabilize-gaze" &&
      record["mechanic"] !== "inverse-gaze")
  ) {
    throw new Error(
      "Quantman presentation evidence has an invalid source or mode.",
    );
  }
  requireString(record["fixtureId"], "Quantman fixture ID");
  requireHash(record["fixtureContentSha256"], "Quantman fixture content hash");
  const bankValue = record["bank"];
  const topologyValue = record["topology"];
  if ((bankValue === undefined) !== (topologyValue === undefined)) {
    throw new Error(
      "Quantman evidence must include bank and topology identity together.",
    );
  }
  if (bankValue !== undefined && topologyValue !== undefined) {
    const bank = requireRecord(bankValue, "Quantman bank identity");
    if (
      bank["schemaVersion"] !== "quantum-box-quantman-qpu-bank-v3" ||
      bank["selectionMethod"] !== "topology-sequence-and-seeded-capture-v3"
    ) {
      throw new Error("Quantman evidence has an invalid bank contract.");
    }
    requireString(bank["bankId"], "Quantman bank ID");
    requireHash(bank["contentSha256"], "Quantman bank content hash");
    const topology = requireRecord(topologyValue, "Quantman topology identity");
    requireString(topology["topologyId"], "Quantman topology ID");
    requireString(topology["label"], "Quantman topology label");
    requireHash(
      topology["authoredTopologySha256"],
      "Quantman authored topology hash",
    );
    requireInteger(topology["captureCount"], "Quantman topology capture count");
    if (Number(topology["captureCount"]) < 1) {
      throw new Error("Quantman topology capture count must be positive.");
    }
  }
  const provider = requireRecord(record["provider"], "Quantman provider");
  if (provider["engineId"] !== "labyrinth-v1") {
    throw new Error("Quantman evidence has an invalid engine.");
  }
  requireString(provider["mothJobId"], "Quantman Moth job ID");
  requireString(provider["hardwareJobId"], "Quantman hardware job ID");
  requireString(provider["backendName"], "Quantman backend");
  requireHash(provider["rawResultSha256"], "Quantman raw result hash");
  requireHash(
    provider["redactedRequestSha256"],
    "Quantman redacted request hash",
  );
  requireHash(provider["captureContentSha256"], "Quantman capture hash");
  requireInteger(provider["requestedShots"], "Quantman requested shots");
  requireInteger(
    provider["returnedMeasurementCount"],
    "Quantman returned measurement count",
  );
  const filtering = requireRecord(
    record["filtering"],
    "Quantman filtering evidence",
  );
  requireString(filtering["filterId"], "Quantman filter ID");
  for (const key of [
    "admittedRecordCount",
    "admittedWeight",
    "excludedRecordCount",
    "excludedWeight",
  ] as const) {
    requireInteger(filtering[key], `Quantman ${key}`);
  }
  const example = requireRecord(
    record["bitParityExample"],
    "Quantman parity example",
  );
  for (const key of ["recordIndex", "roomA", "roomB"] as const) {
    requireInteger(example[key], `Quantman ${key}`);
  }
  for (const key of ["bitA", "bitB"] as const) {
    if (example[key] !== 0 && example[key] !== 1) {
      throw new Error(`Quantman ${key} is invalid.`);
    }
  }
  if (typeof example["equalParity"] !== "boolean") {
    throw new Error("Quantman parity flag is invalid.");
  }
  if (example["passage"] !== "OPEN" && example["passage"] !== "WALL") {
    throw new Error("Quantman passage example is invalid.");
  }
}

function validateQuarryDetail(
  record: Record<string, unknown>,
  identity: ReturnType<typeof validateIdentity>,
): void {
  if (record["sourceStatus"] !== "recorded-moth-qpu") {
    throw new Error(
      "Quarry presentation evidence requires a recorded QPU source.",
    );
  }
  requireString(record["arenaId"], "Quarry arena ID");
  requireInteger(record["remeasurementIntervalTicks"], "Quarry interval");
  requireString(record["bitOrdering"], "Quarry bit ordering");
  requireString(record["claimBoundary"], "Quarry claim boundary");
  const schedule = requireArray(record["sampledSchedule"], "Quarry schedule");
  if (schedule.length === 0)
    throw new Error("Quarry evidence requires a schedule.");
  for (const value of schedule) {
    const phase = requireRecord(value, "Quarry schedule phase");
    requireInteger(phase["phase"], "Quarry phase number");
    requireString(phase["frameId"], "Quarry frame ID");
    const bitstring = requireString(phase["bitstring"], "Quarry bitstring");
    if (/[^01]/u.test(bitstring))
      throw new Error("Quarry bitstring is invalid.");
    requireStringArray(phase["directedRelations"], "Quarry directed relations");
  }
  const example = requireRecord(
    record["relationExample"],
    "Quarry relation example",
  );
  requireInteger(example["phase"], "Quarry example phase");
  requireString(example["frameId"], "Quarry example frame");
  if (
    !/^[A-D]>[A-D]$/.test(requireString(example["edge"], "Quarry example edge"))
  ) {
    throw new Error("Quarry relation example is invalid.");
  }
  const provider = requireRecord(record["provider"], "Quarry provider");
  const corpusFields = [
    "selectedPackId",
    "selectedPackContentSha256",
    "selectedPackIndex",
    "recipeFamily",
    "realizationId",
    "sourceBankId",
    "sourceBankContentSha256",
    "sourceCampaignId",
    "sourceBankVersion",
    "redactedRequestSha256",
    "captureContentSha256",
  ] as const;
  const presentCorpusFields = corpusFields.filter(
    (field) => provider[field] !== undefined,
  );
  if (
    presentCorpusFields.length > 0 &&
    presentCorpusFields.length !== corpusFields.length
  ) {
    throw new Error("Quarry corpus provenance is incomplete.");
  }
  if (presentCorpusFields.length === corpusFields.length) {
    const selectedPackId = requireString(
      provider["selectedPackId"],
      "Quarry selected pack ID",
    );
    const selectedPackContentSha256 = requireHash(
      provider["selectedPackContentSha256"],
      "Quarry selected pack hash",
    );
    requireInteger(
      provider["selectedPackIndex"],
      "Quarry selected pack index",
      23,
    );
    if (
      selectedPackId !== identity.pack.packId ||
      selectedPackContentSha256 !== identity.pack.contentSha256
    ) {
      throw new Error("Quarry corpus selection does not match its run pack.");
    }
    const recipeFamily = requireString(
      provider["recipeFamily"],
      "Quarry recipe family",
    );
    if (
      ![
        "all-opposed",
        "all-equal",
        "front-opposed-back-equal",
        "front-equal-back-opposed",
        "alternating-a",
        "alternating-b",
      ].includes(recipeFamily)
    ) {
      throw new Error("Quarry recipe family is invalid.");
    }
    if (
      !/^r[1-4]$/.test(
        requireString(provider["realizationId"], "Quarry realization ID"),
      )
    ) {
      throw new Error("Quarry realization ID is invalid.");
    }
    const sourceBankId = requireString(
      provider["sourceBankId"],
      "Quarry source bank ID",
    );
    requireHash(provider["sourceBankContentSha256"], "Quarry source bank hash");
    const sourceCampaignId = requireString(
      provider["sourceCampaignId"],
      "Quarry source campaign ID",
    );
    const sourceBankVersion = requireString(
      provider["sourceBankVersion"],
      "Quarry source bank version",
    );
    const expectedSourceBankId =
      sourceBankVersion === "v1"
        ? "quarry-qgraph-ibm-fez-bank-v1"
        : "quarry-qgraph-ibm-fez-bank-v2-tranche";
    if (
      !/^v[12]$/.test(sourceBankVersion) ||
      sourceCampaignId !== `quarry-qgraph-qpu-bank-${sourceBankVersion}` ||
      sourceBankId !== expectedSourceBankId
    ) {
      throw new Error("Quarry source bank version is invalid.");
    }
    requireHash(
      provider["redactedRequestSha256"],
      "Quarry redacted request hash",
    );
    requireHash(
      provider["captureContentSha256"],
      "Quarry capture content hash",
    );
  }
  requireString(provider["mothJobId"], "Quarry Moth job ID");
  requireString(provider["hardwareJobId"], "Quarry hardware job ID");
  if (
    requireString(provider["backendName"], "Quarry backend") !== "ibm_fez" ||
    identity.pack.source !== "moth-qgraph-qpu"
  ) {
    throw new Error("Quarry evidence does not identify IBM Fez QPU authority.");
  }
  requireHash(provider["rawResultSha256"], "Quarry raw result hash");
  requireInteger(provider["requestedShots"], "Quarry requested shots");
  requireInteger(provider["returnedShotCount"], "Quarry returned shots");
  requireInteger(
    provider["returnedMeasurementCount"],
    "Quarry returned measurements",
  );
  const probabilityMass = provider["returnedProbabilityMass"];
  if (
    typeof probabilityMass !== "number" ||
    !Number.isFinite(probabilityMass) ||
    probabilityMass <= 0 ||
    probabilityMass > 1
  ) {
    throw new Error("Quarry returned probability mass is invalid.");
  }
  if (
    provider["distributionProjection"] !== "provider-returned-top-outcomes-v1"
  ) {
    throw new Error("Quarry distribution projection is unsupported.");
  }
}

function assertBinding(
  identity: ReturnType<typeof validateIdentity>,
  binding: StoryV2EvidenceBinding,
): void {
  if (
    identity.stageId !== binding.stageId ||
    identity.runId !== binding.run.runId ||
    identity.rulesVersion !== binding.run.rulesVersion ||
    identity.runSeed !== binding.run.runSeed ||
    identity.activeTick !== binding.activeTick ||
    identity.qualificationEvidenceSha256 !== binding.evidenceSha256 ||
    identity.pack.packId !== binding.run.pack.packId ||
    identity.pack.contentSha256 !== binding.run.pack.contentSha256 ||
    identity.pack.schemaVersion !== binding.run.pack.schemaVersion ||
    identity.pack.source !== binding.run.pack.source
  ) {
    throw new Error(
      "Story presentation evidence does not match its qualified run.",
    );
  }
}

function detailKindForStage(stageId: StoryV2StageId) {
  if (stageId === "qong") return "qong" as const;
  if (stageId === "skipixl-medium" || stageId === "skipixl") {
    return "skipixl" as const;
  }
  if (stageId === "fluxball-two" || stageId === "fluxball-four") {
    return "fluxball" as const;
  }
  if (stageId === "quantman-stabilize" || stageId === "quantman") {
    return "quantman" as const;
  }
  return "quarry" as const;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function requireTuple(
  value: unknown,
  length: number,
  label: string,
): unknown[] {
  const result = requireArray(value, label);
  if (result.length !== length)
    throw new Error(`${label} has the wrong length.`);
  return result;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireStringArray(value: unknown, label: string): readonly string[] {
  return Object.freeze(
    requireArray(value, label).map((item) => requireString(item, label)),
  );
}

function requireHash(value: unknown, label: string): string {
  const result = requireString(value, label);
  if (!SHA256.test(result)) throw new Error(`${label} must be a SHA-256.`);
  return result;
}

function requireInteger(
  value: unknown,
  label: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0 ||
    Number(value) > maximum
  ) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

function requireFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite.`);
  }
  return value;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
