import { sha256CanonicalJson } from "../../src/core/canonicalJson";
import { PACK_SCHEMA_VERSION } from "../../src/packs/types";
import {
  QONG_PLAY_PACK_SCHEMA_VERSION,
  QONG_SELECTOR_PACK_SCHEMA_VERSION,
  QONG_STORY_BANK_SCHEMA_VERSION,
  QONG_AUTHORIZED_API_SPEC_SHA256,
  QONG_AUTHORIZED_BACKEND_POLICY,
  QONG_AUTHORIZED_CONTRACT_OBSERVED_AT,
  QONG_AUTHORIZED_CONTRACT_RECORD_SHA256,
  QONG_AUTHORIZED_PREFLIGHT_CONTENT_SHA256,
  QONG_AUTHORIZED_PREFLIGHT_SCHEMA_VERSION,
  QONG_AUTHORIZED_PROCESS_ENDPOINT,
  QONG_AUTHORIZED_SHOWCASE_URL,
  QONG_AUTHORIZED_TERMINAL_STATUS_SCHEMA,
  type QongCoinJobEvidenceV2,
  type QongCoinOutcome,
  type QongQpuProvenanceV5,
  type QongSelectorBit,
  type QongPackSelectionReceipt,
} from "../../src/games/qong/qongStoryPackBank";
import { QONG_RULES_VERSION } from "../../src/games/qong/types";

const REQUEST_BODY = { params: { mode: "qpu", shots: 1 } } as const;

export const TEST_QONG_PACK_ID = "qong-test-qpu-play-selected";
export const TEST_QONG_PACK_HASH = "d".repeat(64);
export const TEST_QONG_SELECTION: QongPackSelectionReceipt = Object.freeze({
  schemaVersion: "quantum-box-qong-selection-receipt-v1",
  bankId: "qong-test-qpu-bank-selected",
  bankContentSha256: "a".repeat(64),
  selectorPackId: "qong-test-qpu-selector-selected",
  selectorContentSha256: "b".repeat(64),
  selectionMethod: "two-recorded-bits-to-four-pack-index-v1",
  selectorCursorBefore: 0,
  selectorCursorAfter: 2,
  selectorCycle: 0,
  selectorCycleAfter: 0,
  selectorBitIndices: [0, 1] as const,
  selectorBits: [0, 0] as const,
  selectedPackIndex: 0,
  selectedPackId: TEST_QONG_PACK_ID,
  selectedPackContentSha256: TEST_QONG_PACK_HASH,
  reusedSelectorBits: false,
});

export async function createTestQongStoryBank(): Promise<unknown> {
  const requestBodySha256 = await sha256CanonicalJson(REQUEST_BODY);
  const playPacks = [];
  for (let packIndex = 0; packIndex < 4; packIndex += 1) {
    const outcomes = Array.from(
      { length: 7 },
      (_, index): QongCoinOutcome =>
        index === 0
          ? "tails"
          : (packIndex + index) % 2 === 0
            ? "heads"
            : "tails",
    );
    const minute = String(packIndex).padStart(2, "0");
    const timestamps = testTimestamps(minute);
    const jobs = await Promise.all(
      outcomes.map((outcome, index) =>
        testJob(
          `r${String(index + 1).padStart(2, "0")}`,
          index,
          outcome,
          packIndex * 7 + index,
          requestBodySha256,
          timestamps,
        ),
      ),
    );
    const provenance = testProvenance(
      jobs,
      timestamps.retrievedAt,
      requestBodySha256,
      {
        strategy: "first-four-tails-in-32-candidate-pool-v1",
        candidatePoolSize: 32,
        selectedCandidateItemId: `f${String(packIndex * 2 + 2).padStart(3, "0")}`,
        selectedCandidateOrdinal: packIndex * 2 + 1,
        selectedTailRank: packIndex,
        preflightContentSha256: QONG_AUTHORIZED_PREFLIGHT_CONTENT_SHA256,
        candidatePoolCaptureSetSha256: "f".repeat(64),
      },
    );
    const polarities = outcomes.map((outcome) =>
      outcome === "heads" ? "direct" : "invert",
    );
    const hashMaterial = {
      schemaVersion: PACK_SCHEMA_VERSION,
      packSchemaVersion: QONG_PLAY_PACK_SCHEMA_VERSION,
      packId: `qong-test-qpu-play-${packIndex + 1}`,
      gameId: "qong",
      engineId: "coin-toss-v1",
      source: "moth-api-qpu",
      rulesVersion: QONG_RULES_VERSION,
      warnings: ["TEST FIXTURE ONLY · no provider claim."],
      payload: {
        directProbability:
          outcomes.filter((outcome) => outcome === "heads").length / 7,
        rallyPolarities: polarities,
      },
      qpuProvenance: provenance,
    } as const;
    playPacks.push({
      ...hashMaterial,
      contentSha256: await sha256CanonicalJson(hashMaterial),
      mothEvidence: null,
    });
  }

  const bits = Array.from(
    { length: 64 },
    (_, index): QongSelectorBit =>
      (Math.floor(index / 2) + index) % 2 === 0 ? 0 : 1,
  );
  // The first four pairs deliberately cover all four unbiased mappings.
  bits.splice(0, 8, 0, 0, 0, 1, 1, 0, 1, 1);
  const selectorTimestamps = testTimestamps("10");
  const selectorJobs = await Promise.all(
    bits.map((bit, index) =>
      testJob(
        `s${String(index + 1).padStart(3, "0")}`,
        index,
        bit === 0 ? "heads" : "tails",
        100 + index,
        requestBodySha256,
        selectorTimestamps,
      ),
    ),
  );
  const selectorProvenance = testProvenance(
    selectorJobs,
    selectorTimestamps.retrievedAt,
    requestBodySha256,
    null,
  );
  const selectorHashMaterial = {
    schemaVersion: QONG_SELECTOR_PACK_SCHEMA_VERSION,
    packId: "qong-test-qpu-selector-1",
    engineId: "coin-toss-v1",
    source: "moth-api-qpu",
    acquisitionClass: "moth-acquired",
    mapping: "heads-0-tails-1-v1",
    bits,
    qpuProvenance: selectorProvenance,
  } as const;
  const selectorPack = {
    ...selectorHashMaterial,
    contentSha256: await sha256CanonicalJson(selectorHashMaterial),
  };
  const bankHashMaterial = {
    schemaVersion: QONG_STORY_BANK_SCHEMA_VERSION,
    bankId: "qong-test-qpu-bank-1",
    selectionMethod: "two-recorded-bits-to-four-pack-index-v1",
    playPackContentSha256: playPacks.map((pack) => pack.contentSha256),
    selectorPackContentSha256: selectorPack.contentSha256,
  } as const;
  return {
    schemaVersion: QONG_STORY_BANK_SCHEMA_VERSION,
    bankId: bankHashMaterial.bankId,
    contentSha256: await sha256CanonicalJson(bankHashMaterial),
    selectionMethod: bankHashMaterial.selectionMethod,
    playPacks,
    selectorPack,
  };
}

function testProvenance(
  jobs: readonly QongCoinJobEvidenceV2[],
  acquiredAt: string,
  requestBodySha256: string,
  postselection: QongQpuProvenanceV5["postselection"],
): QongQpuProvenanceV5 {
  return {
    acquisitionClass: "moth-acquired",
    contractSource: "authenticated-moth-showcase-v1",
    contractObservedAt: QONG_AUTHORIZED_CONTRACT_OBSERVED_AT,
    canonicalEngineRecordSha256: QONG_AUTHORIZED_CONTRACT_RECORD_SHA256,
    canonicalContractRecordSha256: QONG_AUTHORIZED_CONTRACT_RECORD_SHA256,
    apiSpecificationCanonicalSha256: QONG_AUTHORIZED_API_SPEC_SHA256,
    preflightSchemaVersion: QONG_AUTHORIZED_PREFLIGHT_SCHEMA_VERSION,
    preflightContentSha256: QONG_AUTHORIZED_PREFLIGHT_CONTENT_SHA256,
    backendPolicy: QONG_AUTHORIZED_BACKEND_POLICY,
    showcaseUrl: QONG_AUTHORIZED_SHOWCASE_URL,
    processEndpoint: QONG_AUTHORIZED_PROCESS_ENDPOINT,
    terminalStatusSchema: QONG_AUTHORIZED_TERMINAL_STATUS_SCHEMA,
    priceDisplay: "not-displayed",
    acquiredAt,
    adapterVersion: "qong-coin-bank-adapter-v5",
    resultContract: "single-formatted-outcome-per-job-v1",
    requestBody: REQUEST_BODY,
    requestBodySha256,
    postselection,
    selectorCompletion: null,
    jobs,
  };
}

async function testJob(
  itemId: string,
  sequenceOrdinal: number,
  outcome: QongCoinOutcome,
  uniqueIndex: number,
  requestSha256: string,
  timestamps: ReturnType<typeof testTimestamps>,
): Promise<QongCoinJobEvidenceV2> {
  const material = {
    itemId,
    sequenceOrdinal,
    mothJobId: `test-moth-job-${String(uniqueIndex).padStart(3, "0")}`,
    hardwareJobId: `test-hardware-job-${String(uniqueIndex).padStart(3, "0")}`,
    backendName: "test_qpu",
    executionMode: "qpu",
    ...timestamps,
    shots: 1,
    heads: outcome === "heads" ? 1 : 0,
    tails: outcome === "tails" ? 1 : 0,
    outcome,
    requestSha256,
    terminalStatusSha256: uniqueHash(1_000 + uniqueIndex),
    rawResultSha256: uniqueHash(uniqueIndex),
  } as const;
  return {
    ...material,
    providerRecordSha256: await sha256CanonicalJson(material),
  };
}

function testTimestamps(minute: string) {
  return {
    submittedAt: `2026-08-31T16:${minute}:00Z`,
    providerUpdatedAt: `2026-08-31T16:${minute}:01Z`,
    terminalObservedAt: `2026-08-31T16:${minute}:02Z`,
    retrievedAt: `2026-08-31T16:${minute}:03Z`,
  } as const;
}

function uniqueHash(index: number): string {
  return index.toString(16).padStart(64, "0");
}
