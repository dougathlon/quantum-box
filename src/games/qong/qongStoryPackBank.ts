import installedBankArtifact from "./packs/qong-story-pack-bank-v1.json";

import { canonicalJson, sha256CanonicalJson } from "../../core/canonicalJson";
import { asUint32Seed, deriveSeed } from "../../core/determinism";
import type { FrozenPackSelectionReceipt } from "../../core/run";
import { PACK_SCHEMA_VERSION, type CommittedPack } from "../../packs/types";
import {
  QONG_RULES_VERSION,
  QONG_TOTAL_RALLIES,
  type QongPackPayload,
  type QongPolarity,
} from "./types";

export const QONG_PLAY_PACK_SCHEMA_VERSION = "quantum-box-qong-play-pack-v1";
export const QONG_SELECTOR_PACK_SCHEMA_VERSION =
  "quantum-box-qong-selector-pack-v1";
export const QONG_STORY_BANK_SCHEMA_VERSION = "quantum-box-qong-story-bank-v1";
export const QONG_SELECTION_RECEIPT_SCHEMA_VERSION =
  "quantum-box-qong-selection-receipt-v1";
export const QONG_PLAY_PACK_COUNT = 4;
export const QONG_MIN_SELECTOR_BITS = 44;
export const QONG_AUTHORIZED_PREFLIGHT_SCHEMA_VERSION =
  "quantum-box-qong-showcase-preflight-v2";
export const QONG_AUTHORIZED_PREFLIGHT_CONTENT_SHA256 =
  "7e49214d4fe79d56648999a646ef458bfb7c2df02d98a6dcaa693c3fa89c4e14";
export const QONG_AUTHORIZED_CONTRACT_RECORD_SHA256 =
  "64f1d0a85820a1804d28800a8a08de2871bfcefb8932388094ab57bc01275fdb";
export const QONG_AUTHORIZED_API_SPEC_SHA256 =
  "de1a2956b0751079ae98627ffd1b40b0bf967ba9998f6db1551c7473d4455a8d";
export const QONG_AUTHORIZED_CONTRACT_OBSERVED_AT = "2026-08-31T15:56:01Z";
export const QONG_AUTHORIZED_SHOWCASE_URL =
  "https://platform.mothquantum.com/engines/showcase/coin-toss";
export const QONG_AUTHORIZED_PROCESS_ENDPOINT =
  "https://api.mothquantum.com/api/v1/engines/coin-toss-v1/process";
export const QONG_AUTHORIZED_TERMINAL_STATUS_SCHEMA =
  "https://api.mothquantum.com/schemas/JobStatusOutputBody.json";
export const QONG_AUTHORIZED_BACKEND_POLICY = "provider-selected-per-job-v1";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export type QongCoinOutcome = "heads" | "tails";
export type QongSelectorBit = 0 | 1;

interface QongCoinJobEvidenceBase {
  readonly itemId: string;
  readonly mothJobId: string;
  readonly hardwareJobId: string;
  readonly backendName: string;
  readonly executionMode: "qpu";
  readonly shots: number;
  readonly heads: number;
  readonly tails: number;
  readonly outcome: QongCoinOutcome;
  readonly requestSha256: string;
  readonly rawResultSha256: string;
}

export interface QongCoinJobEvidenceV1 extends QongCoinJobEvidenceBase {}

export interface QongCoinJobEvidenceV2 extends QongCoinJobEvidenceBase {
  readonly sequenceOrdinal: number;
  readonly submittedAt: string;
  readonly providerUpdatedAt: string;
  readonly terminalObservedAt: string;
  readonly retrievedAt: string;
  readonly terminalStatusSha256: string;
  readonly providerRecordSha256: string;
}

export type QongCoinJobEvidence = QongCoinJobEvidenceV1 | QongCoinJobEvidenceV2;

export interface QongCoinRequestBody {
  readonly params: Readonly<{
    readonly mode: "qpu";
    readonly shots: 1;
  }>;
}

export interface QongFirstRallyPostselection {
  readonly strategy: "first-four-tails-in-32-candidate-pool-v1";
  readonly candidatePoolSize: 32;
  readonly selectedCandidateItemId: string;
  readonly selectedCandidateOrdinal: number;
  readonly selectedTailRank: number;
  readonly preflightContentSha256: string;
  readonly candidatePoolCaptureSetSha256: string;
}

interface QongQpuProvenanceBase<TJob extends QongCoinJobEvidence> {
  readonly acquisitionClass: "moth-acquired";
  readonly acquiredAt: string;
  readonly resultContract: "single-formatted-outcome-per-job-v1";
  readonly jobs: readonly TJob[];
}

interface QongEngineProvenanceBase<TJob extends QongCoinJobEvidence>
  extends QongQpuProvenanceBase<TJob> {
  readonly engineUpdatedAt: string;
  readonly canonicalEngineRecordSha256: string;
  readonly apiSpecificationCanonicalSha256: string;
}

export interface QongQpuProvenanceV1
  extends QongEngineProvenanceBase<QongCoinJobEvidenceV1> {
  readonly adapterVersion: "qong-coin-bank-adapter-v1";
}

export interface QongQpuProvenanceV2
  extends QongEngineProvenanceBase<QongCoinJobEvidenceV2> {
  readonly adapterVersion: "qong-coin-bank-adapter-v2";
  readonly requestBody: QongCoinRequestBody;
  readonly requestBodySha256: string;
  readonly postselection: QongFirstRallyPostselection | null;
}

export interface QongQpuProvenanceV3
  extends QongQpuProvenanceBase<QongCoinJobEvidenceV2> {
  readonly adapterVersion: "qong-coin-bank-adapter-v3";
  readonly contractSource: "authenticated-moth-showcase-v1";
  readonly contractObservedAt: string;
  readonly canonicalEngineRecordSha256: string;
  readonly canonicalContractRecordSha256: string;
  readonly apiSpecificationCanonicalSha256: string;
  readonly requestBody: QongCoinRequestBody;
  readonly requestBodySha256: string;
  readonly postselection: QongFirstRallyPostselection | null;
}

export interface QongQpuProvenanceV4
  extends QongQpuProvenanceBase<QongCoinJobEvidenceV2> {
  readonly adapterVersion: "qong-coin-bank-adapter-v4";
  readonly contractSource: "authenticated-moth-showcase-v1";
  readonly contractObservedAt: string;
  readonly canonicalEngineRecordSha256: string;
  readonly canonicalContractRecordSha256: string;
  readonly apiSpecificationCanonicalSha256: string;
  readonly backendPolicy: "provider-selected-per-job-v1";
  readonly requestBody: QongCoinRequestBody;
  readonly requestBodySha256: string;
  readonly postselection: QongFirstRallyPostselection | null;
}

export interface QongSelectorBlockerRecord {
  readonly itemId: string;
  readonly mothJobId: string;
  readonly terminalStatusSha256: string;
  readonly providerErrorSha256: string;
  readonly errorType: "unavailable";
  readonly errorRetryable: false;
}

export interface QongSelectorCompletion {
  readonly schemaVersion: "quantum-box-qong-selector-completion-v1";
  readonly strategy: "largest-even-prefix-before-nonretryable-provider-blocker-v1";
  readonly authorizedSelectorBitCount: 64;
  readonly installedSelectorBitCount: 44;
  readonly lastIncludedItemId: "s044";
  readonly unpairedCaptureItemId: "s045";
  readonly unpairedCaptureContentSha256: string;
  readonly blockedItems: readonly QongSelectorBlockerRecord[];
  readonly unattemptedItemIds: readonly string[];
  readonly ledgerPayloadSha256: string;
  readonly ledgerByteSha256: string;
  readonly stoppedMutationAtUtc: string;
  readonly contentSha256: string;
}

export interface QongQpuProvenanceV5
  extends QongQpuProvenanceBase<QongCoinJobEvidenceV2> {
  readonly adapterVersion: "qong-coin-bank-adapter-v5";
  readonly contractSource: "authenticated-moth-showcase-v1";
  readonly contractObservedAt: string;
  readonly canonicalEngineRecordSha256: string;
  readonly canonicalContractRecordSha256: string;
  readonly apiSpecificationCanonicalSha256: typeof QONG_AUTHORIZED_API_SPEC_SHA256;
  readonly preflightSchemaVersion: typeof QONG_AUTHORIZED_PREFLIGHT_SCHEMA_VERSION;
  readonly preflightContentSha256: typeof QONG_AUTHORIZED_PREFLIGHT_CONTENT_SHA256;
  readonly backendPolicy: typeof QONG_AUTHORIZED_BACKEND_POLICY;
  readonly showcaseUrl: typeof QONG_AUTHORIZED_SHOWCASE_URL;
  readonly processEndpoint: typeof QONG_AUTHORIZED_PROCESS_ENDPOINT;
  readonly terminalStatusSchema: typeof QONG_AUTHORIZED_TERMINAL_STATUS_SCHEMA;
  readonly priceDisplay: "not-displayed";
  readonly requestBody: QongCoinRequestBody;
  readonly requestBodySha256: string;
  readonly postselection: QongFirstRallyPostselection | null;
  readonly selectorCompletion: QongSelectorCompletion | null;
}

export type QongQpuProvenance =
  | QongQpuProvenanceV1
  | QongQpuProvenanceV2
  | QongQpuProvenanceV3
  | QongQpuProvenanceV4
  | QongQpuProvenanceV5;

export interface QongQpuPlayPack extends CommittedPack<QongPackPayload> {
  readonly packSchemaVersion: typeof QONG_PLAY_PACK_SCHEMA_VERSION;
  readonly source: "moth-api-qpu";
  readonly qpuProvenance: QongQpuProvenance;
}

export interface QongSelectorPack {
  readonly schemaVersion: typeof QONG_SELECTOR_PACK_SCHEMA_VERSION;
  readonly packId: string;
  readonly engineId: "coin-toss-v1";
  readonly source: "moth-api-qpu";
  readonly acquisitionClass: "moth-acquired";
  readonly contentSha256: string;
  readonly mapping: "heads-0-tails-1-v1";
  readonly bits: readonly QongSelectorBit[];
  readonly qpuProvenance: QongQpuProvenance;
}

export interface QongStoryPackBank {
  readonly schemaVersion: typeof QONG_STORY_BANK_SCHEMA_VERSION;
  readonly bankId: string;
  readonly contentSha256: string;
  readonly selectionMethod: "two-recorded-bits-to-four-pack-index-v1";
  readonly playPacks: readonly QongQpuPlayPack[];
  readonly selectorPack: QongSelectorPack;
}

export interface QongSelectorPosition {
  readonly cursor: number;
  readonly cycle: number;
}

export interface QongPackSelectionReceipt extends FrozenPackSelectionReceipt {
  readonly schemaVersion: typeof QONG_SELECTION_RECEIPT_SCHEMA_VERSION;
  readonly bankId: string;
  readonly bankContentSha256: string;
  readonly selectorPackId: string;
  readonly selectorContentSha256: string;
  readonly selectionMethod: "two-recorded-bits-to-four-pack-index-v1";
  readonly selectorCursorBefore: number;
  readonly selectorCursorAfter: number;
  readonly selectorCycle: number;
  readonly selectorCycleAfter: number;
  readonly selectorBitIndices: readonly [number, number];
  readonly selectorBits: readonly [QongSelectorBit, QongSelectorBit];
  readonly selectedPackIndex: number;
  readonly selectedPackId: string;
  readonly selectedPackContentSha256: string;
  readonly reusedSelectorBits: boolean;
}

export interface QongStoryPackSelection {
  readonly pack: QongQpuPlayPack;
  readonly receipt: QongPackSelectionReceipt;
}

export interface QongRecoveryAuthorityReference {
  readonly rulesVersion: string;
  readonly pack: Readonly<{
    readonly packId: string;
    readonly contentSha256: string;
    readonly schemaVersion: string;
    readonly source: string;
  }>;
  readonly packSelection: unknown;
  readonly firstResult: unknown;
}

export class QongStoryBankUnavailableError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "QongStoryBankUnavailableError";
  }
}

export async function loadInstalledQongStoryBank(): Promise<QongStoryPackBank> {
  const bank = await validateQongStoryPackBank(installedBankArtifact);
  const provenances = [
    ...bank.playPacks.map((pack) => pack.qpuProvenance),
    bank.selectorPack.qpuProvenance,
  ];
  if (
    provenances.some(
      (provenance) => provenance.adapterVersion !== "qong-coin-bank-adapter-v5",
    )
  ) {
    throw new QongStoryBankUnavailableError(
      "Installed Qong Story data lacks the exact authorized preflight and provider-selection contract.",
    );
  }
  return bank;
}

/**
 * Rejects a persisted Qong recovery unless its immutable identifiers and first
 * recorded result point into the bank shipped with this exact application.
 * This synchronous boundary is used while loading save data; the asynchronous
 * validator below additionally re-hashes the full provider record graph before
 * replay begins.
 */
export function requireInstalledQongRecoveryReference(
  reference: QongRecoveryAuthorityReference,
): void {
  requireQongRecoveryReferenceInBankArtifact(reference, installedBankArtifact);
}

export function requireQongRecoveryReferenceInBankArtifact(
  reference: QongRecoveryAuthorityReference,
  bankArtifact: unknown,
): void {
  const installed = requireRecord(bankArtifact, "Installed Qong Story bank");
  if (installed["schemaVersion"] === "quantum-box-qong-bank-unavailable-v1") {
    throw new QongStoryBankUnavailableError(
      requireString(installed["reason"], "Qong Story bank reason"),
    );
  }
  const receipt = validateQongSelectionReceipt(reference.packSelection);
  const playPacks = installed["playPacks"];
  const selector = requireRecord(
    installed["selectorPack"],
    "Installed Qong selector pack",
  );
  if (
    installed["schemaVersion"] !== QONG_STORY_BANK_SCHEMA_VERSION ||
    installed["bankId"] !== receipt.bankId ||
    installed["contentSha256"] !== receipt.bankContentSha256 ||
    installed["selectionMethod"] !== receipt.selectionMethod ||
    !Array.isArray(playPacks) ||
    playPacks.length !== QONG_PLAY_PACK_COUNT ||
    selector["packId"] !== receipt.selectorPackId ||
    selector["contentSha256"] !== receipt.selectorContentSha256 ||
    !Array.isArray(selector["bits"])
  ) {
    throw new Error(
      "Qong recovery does not reference the installed Story bank authority.",
    );
  }
  const selected = requireRecord(
    playPacks[receipt.selectedPackIndex],
    "Installed Qong selected play pack",
  );
  const selectorBits = selector["bits"];
  if (
    reference.pack.packId !== receipt.selectedPackId ||
    reference.pack.contentSha256 !== receipt.selectedPackContentSha256 ||
    reference.pack.source !== "moth-api-qpu" ||
    selected["packId"] !== receipt.selectedPackId ||
    selected["contentSha256"] !== receipt.selectedPackContentSha256 ||
    selected["schemaVersion"] !== reference.pack.schemaVersion ||
    selected["source"] !== reference.pack.source ||
    selected["rulesVersion"] !== reference.rulesVersion ||
    selectorBits[receipt.selectorBitIndices[0]] !== receipt.selectorBits[0] ||
    selectorBits[receipt.selectorBitIndices[1]] !== receipt.selectorBits[1]
  ) {
    throw new Error(
      "Qong recovery pack selection is absent from the installed Story bank.",
    );
  }
  const provenance = requireRecord(
    selected["qpuProvenance"],
    "Installed Qong play-pack provenance",
  );
  const jobs = provenance["jobs"];
  if (!Array.isArray(jobs) || jobs.length !== QONG_TOTAL_RALLIES) {
    throw new Error("Installed Qong recovery provenance is incomplete.");
  }
  requireMatchingRecoveryResult(
    requireRecord(reference.firstResult, "Qong recovery first result"),
    requireRecord(jobs[0], "Installed Qong first provider job"),
  );
}

/** Full installed-bank validation required immediately before replay. */
export async function validateInstalledQongRecoveryAuthority(
  reference: QongRecoveryAuthorityReference,
): Promise<void> {
  requireInstalledQongRecoveryReference(reference);
  const bank = await loadInstalledQongStoryBank();
  const receipt = validateQongSelectionReceipt(reference.packSelection);
  const selected = selectQongStoryPack(bank, {
    cursor: receipt.selectorCursorBefore,
    cycle: receipt.selectorCycle,
  });
  if (canonicalJson(selected.receipt) !== canonicalJson(receipt)) {
    throw new Error(
      "Qong recovery receipt cannot be reproduced from the installed selector.",
    );
  }
}

export async function validateQongStoryPackBank(
  input: unknown,
): Promise<QongStoryPackBank> {
  const bankRecord = requireRecord(input, "Qong Story bank");
  if (bankRecord["schemaVersion"] === "quantum-box-qong-bank-unavailable-v1") {
    throw new QongStoryBankUnavailableError(
      requireString(bankRecord["reason"], "Qong Story bank reason"),
    );
  }
  requireExactKeys(
    bankRecord,
    [
      "schemaVersion",
      "bankId",
      "contentSha256",
      "selectionMethod",
      "playPacks",
      "selectorPack",
    ],
    "Qong Story bank",
  );
  if (bankRecord["schemaVersion"] !== QONG_STORY_BANK_SCHEMA_VERSION) {
    throw new Error("Unknown Qong Story bank schema.");
  }
  const bankId = requireString(bankRecord["bankId"], "Qong Story bank ID");
  const contentSha256 = requireSha256(
    bankRecord["contentSha256"],
    "Qong Story bank content hash",
  );
  if (
    bankRecord["selectionMethod"] !== "two-recorded-bits-to-four-pack-index-v1"
  ) {
    throw new Error("Qong Story bank selection method is unsupported.");
  }
  if (
    !Array.isArray(bankRecord["playPacks"]) ||
    bankRecord["playPacks"].length !== QONG_PLAY_PACK_COUNT
  ) {
    throw new Error("Qong Story bank requires exactly four play packs.");
  }
  const playPacks = await Promise.all(
    bankRecord["playPacks"].map((pack, index) => validatePlayPack(pack, index)),
  );
  const selectorPack = await validateSelectorPack(bankRecord["selectorPack"]);
  validateBankPostselection(playPacks, selectorPack);
  requireUnique(
    playPacks.map((pack) => pack.packId),
    "Qong play-pack IDs",
  );
  requireUnique(
    playPacks.map((pack) => pack.contentSha256),
    "Qong play-pack content hashes",
  );
  const jobs = [
    ...playPacks.flatMap((pack) => pack.qpuProvenance.jobs),
    ...selectorPack.qpuProvenance.jobs,
  ];
  requireUnique(
    jobs.map((job) => job.mothJobId),
    "Qong Moth job IDs",
  );
  requireUnique(
    jobs.map((job) => job.hardwareJobId),
    "Qong hardware job IDs",
  );
  requireUnique(
    jobs.map((job) => job.rawResultSha256),
    "Qong raw-result hashes",
  );
  const expectedBankHash = await sha256CanonicalJson({
    schemaVersion: QONG_STORY_BANK_SCHEMA_VERSION,
    bankId,
    selectionMethod: "two-recorded-bits-to-four-pack-index-v1",
    playPackContentSha256: playPacks.map((pack) => pack.contentSha256),
    selectorPackContentSha256: selectorPack.contentSha256,
  });
  if (contentSha256 !== expectedBankHash) {
    throw new Error("Qong Story bank content hash does not match its packs.");
  }
  return deepFreeze({
    schemaVersion: QONG_STORY_BANK_SCHEMA_VERSION,
    bankId,
    contentSha256,
    selectionMethod: "two-recorded-bits-to-four-pack-index-v1",
    playPacks,
    selectorPack,
  });
}

export function selectQongStoryPack(
  bank: QongStoryPackBank,
  position: QongSelectorPosition,
): QongStoryPackSelection {
  if (
    !Number.isSafeInteger(position.cursor) ||
    position.cursor < 0 ||
    position.cursor >= bank.selectorPack.bits.length ||
    position.cursor % 2 !== 0
  ) {
    throw new Error("Qong selector cursor must identify an even bit pair.");
  }
  if (!Number.isSafeInteger(position.cycle) || position.cycle < 0) {
    throw new Error("Qong selector cycle must be a non-negative integer.");
  }
  const firstIndex = position.cursor;
  const secondIndex = firstIndex + 1;
  const first = bank.selectorPack.bits[firstIndex];
  const second = bank.selectorPack.bits[secondIndex];
  if (first === undefined || second === undefined) {
    throw new Error("Qong selector pack ended inside a bit pair.");
  }
  const selectedPackIndex = first * 2 + second;
  const pack = bank.playPacks[selectedPackIndex];
  if (!pack) throw new Error("Qong selector resolved an absent play pack.");
  const exhausted = secondIndex + 1 >= bank.selectorPack.bits.length;
  const nextCursor = exhausted ? 0 : secondIndex + 1;
  const nextCycle = exhausted ? position.cycle + 1 : position.cycle;
  const receipt: QongPackSelectionReceipt = {
    schemaVersion: QONG_SELECTION_RECEIPT_SCHEMA_VERSION,
    bankId: bank.bankId,
    bankContentSha256: bank.contentSha256,
    selectorPackId: bank.selectorPack.packId,
    selectorContentSha256: bank.selectorPack.contentSha256,
    selectionMethod: bank.selectionMethod,
    selectorCursorBefore: position.cursor,
    selectorCursorAfter: nextCursor,
    selectorCycle: position.cycle,
    selectorCycleAfter: nextCycle,
    selectorBitIndices: [firstIndex, secondIndex],
    selectorBits: [first, second],
    selectedPackIndex,
    selectedPackId: pack.packId,
    selectedPackContentSha256: pack.contentSha256,
    reusedSelectorBits: position.cycle > 0,
  };
  return deepFreeze({ pack, receipt });
}

/**
 * Arcade uses the same authenticated play packs and recorded selector bits as
 * Story, but it must not mutate Story's persisted selector cursor. A run seed
 * therefore chooses one immutable selector-bit pair for the entire match.
 */
export function selectQongArcadePack(
  bank: QongStoryPackBank,
  runSeed: number,
): QongStoryPackSelection {
  const pairCount = Math.floor(bank.selectorPack.bits.length / 2);
  if (pairCount < 1) {
    throw new Error(
      "Qong Arcade requires at least one recorded selector pair.",
    );
  }
  const pairIndex =
    deriveSeed(asUint32Seed(runSeed), "qong:arcade-qpu-selector") % pairCount;
  return selectQongStoryPack(bank, { cursor: pairIndex * 2, cycle: 0 });
}

export function validateQongSelectionReceipt(
  input: unknown,
): QongPackSelectionReceipt {
  const record = requireRecord(input, "Qong selection receipt");
  requireExactKeys(
    record,
    [
      "schemaVersion",
      "bankId",
      "bankContentSha256",
      "selectorPackId",
      "selectorContentSha256",
      "selectionMethod",
      "selectorCursorBefore",
      "selectorCursorAfter",
      "selectorCycle",
      "selectorCycleAfter",
      "selectorBitIndices",
      "selectorBits",
      "selectedPackIndex",
      "selectedPackId",
      "selectedPackContentSha256",
      "reusedSelectorBits",
    ],
    "Qong selection receipt",
  );
  if (record["schemaVersion"] !== QONG_SELECTION_RECEIPT_SCHEMA_VERSION) {
    throw new Error("Unknown Qong selection receipt schema.");
  }
  const cursorBefore = requireNonNegativeInteger(
    record["selectorCursorBefore"],
    "Qong selector cursor before",
  );
  const cursorAfter = requireNonNegativeInteger(
    record["selectorCursorAfter"],
    "Qong selector cursor after",
  );
  const cycle = requireNonNegativeInteger(
    record["selectorCycle"],
    "Qong selector cycle",
  );
  const cycleAfter = requireNonNegativeInteger(
    record["selectorCycleAfter"],
    "Qong selector cycle after",
  );
  const indices = requirePair(
    record["selectorBitIndices"],
    requireNonNegativeInteger,
    "Qong selector bit indices",
  );
  const bits = requirePair(
    record["selectorBits"],
    requireBit,
    "Qong selector bits",
  );
  const selectedPackIndex = requireNonNegativeInteger(
    record["selectedPackIndex"],
    "Qong selected pack index",
  );
  if (
    cursorBefore % 2 !== 0 ||
    indices[0] !== cursorBefore ||
    indices[1] !== cursorBefore + 1 ||
    selectedPackIndex !== bits[0] * 2 + bits[1] ||
    selectedPackIndex >= QONG_PLAY_PACK_COUNT ||
    (cursorAfter === 0
      ? cycleAfter !== cycle + 1
      : cycleAfter !== cycle || cursorAfter !== cursorBefore + 2)
  ) {
    throw new Error("Qong selection receipt has inconsistent selector state.");
  }
  if (record["reusedSelectorBits"] !== cycle > 0) {
    throw new Error("Qong selection receipt reuse flag is inconsistent.");
  }
  return deepFreeze({
    schemaVersion: QONG_SELECTION_RECEIPT_SCHEMA_VERSION,
    bankId: requireString(record["bankId"], "Qong bank ID"),
    bankContentSha256: requireSha256(
      record["bankContentSha256"],
      "Qong bank content hash",
    ),
    selectorPackId: requireString(
      record["selectorPackId"],
      "Qong selector-pack ID",
    ),
    selectorContentSha256: requireSha256(
      record["selectorContentSha256"],
      "Qong selector content hash",
    ),
    selectionMethod: requireLiteral(
      record["selectionMethod"],
      "two-recorded-bits-to-four-pack-index-v1",
      "Qong selection method",
    ),
    selectorCursorBefore: cursorBefore,
    selectorCursorAfter: cursorAfter,
    selectorCycle: cycle,
    selectorCycleAfter: cycleAfter,
    selectorBitIndices: indices,
    selectorBits: bits,
    selectedPackIndex,
    selectedPackId: requireString(
      record["selectedPackId"],
      "Qong selected pack ID",
    ),
    selectedPackContentSha256: requireSha256(
      record["selectedPackContentSha256"],
      "Qong selected pack content hash",
    ),
    reusedSelectorBits: record["reusedSelectorBits"] as boolean,
  });
}

async function validatePlayPack(
  input: unknown,
  packIndex: number,
): Promise<QongQpuPlayPack> {
  const record = requireRecord(input, `Qong play pack ${packIndex + 1}`);
  requireExactKeys(
    record,
    [
      "schemaVersion",
      "packSchemaVersion",
      "packId",
      "gameId",
      "engineId",
      "source",
      "contentSha256",
      "rulesVersion",
      "warnings",
      "mothEvidence",
      "payload",
      "qpuProvenance",
    ],
    `Qong play pack ${packIndex + 1}`,
  );
  if (
    record["schemaVersion"] !== PACK_SCHEMA_VERSION ||
    record["packSchemaVersion"] !== QONG_PLAY_PACK_SCHEMA_VERSION ||
    record["gameId"] !== "qong" ||
    record["engineId"] !== "coin-toss-v1" ||
    record["source"] !== "moth-api-qpu" ||
    record["rulesVersion"] !== QONG_RULES_VERSION
  ) {
    throw new Error(`Qong play pack ${packIndex + 1} has invalid identity.`);
  }
  if (record["mothEvidence"] !== null) {
    throw new Error(
      "Qong play packs use the multi-job qpuProvenance record, not single-job mothEvidence.",
    );
  }
  const packId = requireString(record["packId"], "Qong play-pack ID");
  const contentSha256 = requireSha256(
    record["contentSha256"],
    "Qong play-pack content hash",
  );
  const warnings = requireStringArray(
    record["warnings"],
    "Qong play-pack warnings",
  );
  const payload = validateQongQpuPayload(record["payload"]);
  if (payload.rallyPolarities?.[0] !== "invert") {
    throw new Error(
      `Qong play pack ${packIndex + 1} must begin with an acquired invert polarity.`,
    );
  }
  const provenance = await validateProvenance(
    record["qpuProvenance"],
    QONG_TOTAL_RALLIES,
    (index) => `r${String(index + 1).padStart(2, "0")}`,
    `Qong play pack ${packIndex + 1}`,
  );
  provenance.jobs.forEach((job, index) => {
    const expectedPolarity = outcomeToPolarity(job.outcome);
    if (payload.rallyPolarities?.[index] !== expectedPolarity) {
      throw new Error(
        `Qong play pack ${packIndex + 1} result ${job.itemId} does not match its rally polarity.`,
      );
    }
  });
  const expectedProbability =
    provenance.jobs.filter((job) => job.outcome === "heads").length /
    QONG_TOTAL_RALLIES;
  if (Math.abs(payload.directProbability - expectedProbability) > 1e-12) {
    throw new Error(
      `Qong play pack ${packIndex + 1} direct probability is inconsistent.`,
    );
  }
  const hashMaterial = {
    schemaVersion: PACK_SCHEMA_VERSION,
    packSchemaVersion: QONG_PLAY_PACK_SCHEMA_VERSION,
    packId,
    gameId: "qong",
    engineId: "coin-toss-v1",
    source: "moth-api-qpu",
    rulesVersion: QONG_RULES_VERSION,
    warnings,
    payload,
    qpuProvenance: provenance,
  } as const;
  if ((await sha256CanonicalJson(hashMaterial)) !== contentSha256) {
    throw new Error(`Qong play pack ${packIndex + 1} content hash mismatch.`);
  }
  return deepFreeze({
    ...hashMaterial,
    contentSha256,
    mothEvidence: null,
  });
}

async function validateSelectorPack(input: unknown): Promise<QongSelectorPack> {
  const record = requireRecord(input, "Qong selector pack");
  requireExactKeys(
    record,
    [
      "schemaVersion",
      "packId",
      "engineId",
      "source",
      "acquisitionClass",
      "contentSha256",
      "mapping",
      "bits",
      "qpuProvenance",
    ],
    "Qong selector pack",
  );
  if (
    record["schemaVersion"] !== QONG_SELECTOR_PACK_SCHEMA_VERSION ||
    record["engineId"] !== "coin-toss-v1" ||
    record["source"] !== "moth-api-qpu" ||
    record["acquisitionClass"] !== "moth-acquired" ||
    record["mapping"] !== "heads-0-tails-1-v1"
  ) {
    throw new Error("Qong selector pack identity is invalid.");
  }
  const packId = requireString(record["packId"], "Qong selector-pack ID");
  const contentSha256 = requireSha256(
    record["contentSha256"],
    "Qong selector-pack content hash",
  );
  if (
    !Array.isArray(record["bits"]) ||
    record["bits"].length < QONG_MIN_SELECTOR_BITS ||
    record["bits"].length % 2 !== 0
  ) {
    throw new Error(
      `Qong selector pack requires an even bank of at least ${QONG_MIN_SELECTOR_BITS} bits.`,
    );
  }
  const bits = record["bits"].map((bit, index) =>
    requireBit(bit, `Qong selector bit ${index + 1}`),
  );
  const provenance = await validateProvenance(
    record["qpuProvenance"],
    bits.length,
    (index) => `s${String(index + 1).padStart(3, "0")}`,
    "Qong selector pack",
  );
  provenance.jobs.forEach((job, index) => {
    const expectedBit = job.outcome === "heads" ? 0 : 1;
    if (bits[index] !== expectedBit) {
      throw new Error(
        `Qong selector result ${job.itemId} does not match its stored bit.`,
      );
    }
  });
  const hashMaterial = {
    schemaVersion: QONG_SELECTOR_PACK_SCHEMA_VERSION,
    packId,
    engineId: "coin-toss-v1",
    source: "moth-api-qpu",
    acquisitionClass: "moth-acquired",
    mapping: "heads-0-tails-1-v1",
    bits,
    qpuProvenance: provenance,
  } as const;
  if ((await sha256CanonicalJson(hashMaterial)) !== contentSha256) {
    throw new Error("Qong selector-pack content hash mismatch.");
  }
  return deepFreeze({ ...hashMaterial, contentSha256 });
}

function validateQongQpuPayload(input: unknown): QongPackPayload {
  const record = requireRecord(input, "Qong play-pack payload");
  requireExactKeys(
    record,
    ["directProbability", "rallyPolarities"],
    "Qong play-pack payload",
  );
  const directProbability = record["directProbability"];
  if (
    typeof directProbability !== "number" ||
    !Number.isFinite(directProbability) ||
    directProbability < 0 ||
    directProbability > 1
  ) {
    throw new Error("Qong play-pack direct probability is invalid.");
  }
  if (
    !Array.isArray(record["rallyPolarities"]) ||
    record["rallyPolarities"].length !== QONG_TOTAL_RALLIES
  ) {
    throw new Error("Qong play pack requires exactly seven polarities.");
  }
  const rallyPolarities = record["rallyPolarities"].map((value, index) => {
    if (value !== "direct" && value !== "invert") {
      throw new Error(`Qong rally polarity ${index + 1} is invalid.`);
    }
    return value;
  });
  return deepFreeze({ directProbability, rallyPolarities });
}

async function validateProvenance(
  input: unknown,
  jobCount: number,
  itemIdFor: (index: number) => string,
  label: string,
): Promise<QongQpuProvenance> {
  const record = requireRecord(input, `${label} provenance`);
  const adapterVersion = record["adapterVersion"];
  const commonKeys = [
    "acquisitionClass",
    "acquiredAt",
    "adapterVersion",
    "resultContract",
    "jobs",
  ];
  const engineKeys = [
    "engineUpdatedAt",
    "canonicalEngineRecordSha256",
    "apiSpecificationCanonicalSha256",
  ];
  const modernKeys = ["requestBody", "requestBodySha256", "postselection"];
  requireExactKeys(
    record,
    adapterVersion === "qong-coin-bank-adapter-v2"
      ? [...commonKeys, ...engineKeys, ...modernKeys]
      : adapterVersion === "qong-coin-bank-adapter-v3" ||
          adapterVersion === "qong-coin-bank-adapter-v4" ||
          adapterVersion === "qong-coin-bank-adapter-v5"
        ? [
            ...commonKeys,
            "contractSource",
            "contractObservedAt",
            "canonicalEngineRecordSha256",
            "canonicalContractRecordSha256",
            "apiSpecificationCanonicalSha256",
            ...(adapterVersion === "qong-coin-bank-adapter-v4"
              ? ["backendPolicy"]
              : adapterVersion === "qong-coin-bank-adapter-v5"
                ? [
                    "preflightSchemaVersion",
                    "preflightContentSha256",
                    "backendPolicy",
                    "showcaseUrl",
                    "processEndpoint",
                    "terminalStatusSchema",
                    "priceDisplay",
                    "selectorCompletion",
                  ]
                : []),
            ...modernKeys,
          ]
        : [...commonKeys, ...engineKeys],
    `${label} provenance`,
  );
  if (
    record["acquisitionClass"] !== "moth-acquired" ||
    (adapterVersion !== "qong-coin-bank-adapter-v1" &&
      adapterVersion !== "qong-coin-bank-adapter-v2" &&
      adapterVersion !== "qong-coin-bank-adapter-v3" &&
      adapterVersion !== "qong-coin-bank-adapter-v4" &&
      adapterVersion !== "qong-coin-bank-adapter-v5") ||
    record["resultContract"] !== "single-formatted-outcome-per-job-v1" ||
    !Array.isArray(record["jobs"]) ||
    record["jobs"].length !== jobCount
  ) {
    throw new Error(`${label} provenance is incomplete.`);
  }
  const common = {
    acquisitionClass: "moth-acquired",
    acquiredAt: requireUtc(record["acquiredAt"], `${label} acquisition time`),
    resultContract: "single-formatted-outcome-per-job-v1",
  } as const;
  if (adapterVersion === "qong-coin-bank-adapter-v1") {
    const jobs = record["jobs"].map((job, index) =>
      validateCoinJobV1(job, itemIdFor(index), `${label} job ${index + 1}`),
    );
    return deepFreeze({
      ...common,
      engineUpdatedAt: requireUtc(
        record["engineUpdatedAt"],
        `${label} engine update time`,
      ),
      canonicalEngineRecordSha256: requireSha256(
        record["canonicalEngineRecordSha256"],
        `${label} engine record hash`,
      ),
      apiSpecificationCanonicalSha256: requireSha256(
        record["apiSpecificationCanonicalSha256"],
        `${label} API specification hash`,
      ),
      adapterVersion: "qong-coin-bank-adapter-v1",
      jobs,
    });
  }
  const requestBody = validateRequestBody(record["requestBody"], label);
  const requestBodySha256 = requireSha256(
    record["requestBodySha256"],
    `${label} request-body hash`,
  );
  if ((await sha256CanonicalJson(requestBody)) !== requestBodySha256) {
    throw new Error(`${label} request-body hash does not match its bytes.`);
  }
  const jobs = await Promise.all(
    record["jobs"].map((job, index) =>
      validateCoinJobV2(
        job,
        itemIdFor(index),
        index,
        requestBodySha256,
        `${label} job ${index + 1}`,
      ),
    ),
  );
  const latestRetrieval = Math.max(
    ...jobs.map((job) => Date.parse(job.retrievedAt)),
  );
  if (Date.parse(common.acquiredAt) !== latestRetrieval) {
    throw new Error(`${label} acquisition time is not its latest retrieval.`);
  }
  const postselection =
    record["postselection"] === null
      ? null
      : validatePostselection(record["postselection"], label);
  if (
    adapterVersion === "qong-coin-bank-adapter-v3" ||
    adapterVersion === "qong-coin-bank-adapter-v4" ||
    adapterVersion === "qong-coin-bank-adapter-v5"
  ) {
    const canonicalEngineRecordSha256 = requireSha256(
      record["canonicalEngineRecordSha256"],
      `${label} engine-contract compatibility hash`,
    );
    const canonicalContractRecordSha256 = requireSha256(
      record["canonicalContractRecordSha256"],
      `${label} contract record hash`,
    );
    if (canonicalEngineRecordSha256 !== canonicalContractRecordSha256) {
      throw new Error(`${label} contract-record hash aliases disagree.`);
    }
    const showcase = {
      ...common,
      adapterVersion,
      contractSource: requireLiteral(
        record["contractSource"],
        "authenticated-moth-showcase-v1",
        `${label} contract source`,
      ),
      contractObservedAt: requireUtc(
        record["contractObservedAt"],
        `${label} contract observation time`,
      ),
      canonicalEngineRecordSha256,
      canonicalContractRecordSha256,
      apiSpecificationCanonicalSha256: requireSha256(
        record["apiSpecificationCanonicalSha256"],
        `${label} API specification hash`,
      ),
      requestBody,
      requestBodySha256,
      postselection,
      jobs,
    };
    if (adapterVersion === "qong-coin-bank-adapter-v5") {
      const exactContractHash = requireLiteral(
        canonicalContractRecordSha256,
        QONG_AUTHORIZED_CONTRACT_RECORD_SHA256,
        `${label} authorized contract record hash`,
      );
      if (canonicalEngineRecordSha256 !== exactContractHash) {
        throw new Error(`${label} authorized contract hash aliases disagree.`);
      }
      return deepFreeze({
        ...showcase,
        adapterVersion: "qong-coin-bank-adapter-v5",
        contractObservedAt: requireLiteral(
          showcase.contractObservedAt,
          QONG_AUTHORIZED_CONTRACT_OBSERVED_AT,
          `${label} authorized contract observation time`,
        ),
        canonicalEngineRecordSha256: exactContractHash,
        canonicalContractRecordSha256: exactContractHash,
        apiSpecificationCanonicalSha256: requireLiteral(
          showcase.apiSpecificationCanonicalSha256,
          QONG_AUTHORIZED_API_SPEC_SHA256,
          `${label} authorized API specification hash`,
        ),
        preflightSchemaVersion: requireLiteral(
          record["preflightSchemaVersion"],
          QONG_AUTHORIZED_PREFLIGHT_SCHEMA_VERSION,
          `${label} preflight schema`,
        ),
        preflightContentSha256: requireLiteral(
          record["preflightContentSha256"],
          QONG_AUTHORIZED_PREFLIGHT_CONTENT_SHA256,
          `${label} authorized preflight hash`,
        ),
        backendPolicy: requireLiteral(
          record["backendPolicy"],
          QONG_AUTHORIZED_BACKEND_POLICY,
          `${label} authorized backend policy`,
        ),
        showcaseUrl: requireLiteral(
          record["showcaseUrl"],
          QONG_AUTHORIZED_SHOWCASE_URL,
          `${label} authorized showcase URL`,
        ),
        processEndpoint: requireLiteral(
          record["processEndpoint"],
          QONG_AUTHORIZED_PROCESS_ENDPOINT,
          `${label} authorized process endpoint`,
        ),
        terminalStatusSchema: requireLiteral(
          record["terminalStatusSchema"],
          QONG_AUTHORIZED_TERMINAL_STATUS_SCHEMA,
          `${label} authorized terminal-status schema`,
        ),
        priceDisplay: requireLiteral(
          record["priceDisplay"],
          "not-displayed",
          `${label} authorized price display`,
        ),
        selectorCompletion: await validateSelectorCompletion(
          record["selectorCompletion"],
          jobCount,
          label,
        ),
      });
    }
    if (adapterVersion === "qong-coin-bank-adapter-v4") {
      return deepFreeze({
        ...showcase,
        adapterVersion: "qong-coin-bank-adapter-v4",
        backendPolicy: requireLiteral(
          record["backendPolicy"],
          "provider-selected-per-job-v1",
          `${label} backend policy`,
        ),
      });
    }
    return deepFreeze({
      ...showcase,
      adapterVersion: "qong-coin-bank-adapter-v3",
    });
  }
  return deepFreeze({
    ...common,
    engineUpdatedAt: requireUtc(
      record["engineUpdatedAt"],
      `${label} engine update time`,
    ),
    canonicalEngineRecordSha256: requireSha256(
      record["canonicalEngineRecordSha256"],
      `${label} engine record hash`,
    ),
    apiSpecificationCanonicalSha256: requireSha256(
      record["apiSpecificationCanonicalSha256"],
      `${label} API specification hash`,
    ),
    adapterVersion: "qong-coin-bank-adapter-v2",
    requestBody,
    requestBodySha256,
    postselection,
    jobs,
  });
}

function validateRequestBody(
  input: unknown,
  label: string,
): QongCoinRequestBody {
  const record = requireRecord(input, `${label} request body`);
  requireExactKeys(record, ["params"], `${label} request body`);
  const params = requireRecord(record["params"], `${label} request params`);
  requireExactKeys(params, ["mode", "shots"], `${label} request params`);
  if (params["mode"] !== "qpu" || params["shots"] !== 1) {
    throw new Error(
      `${label} request body is not the exact one-shot QPU request.`,
    );
  }
  return deepFreeze({ params: { mode: "qpu", shots: 1 } });
}

async function validateSelectorCompletion(
  input: unknown,
  jobCount: number,
  label: string,
): Promise<QongSelectorCompletion | null> {
  if (input === null) {
    if (jobCount === 44) {
      throw new Error(`${label} lacks its blocked selector-prefix seal.`);
    }
    if (jobCount !== 7 && jobCount !== 64) {
      throw new Error(`${label} has an unauthorized selector-result count.`);
    }
    return null;
  }
  if (jobCount !== 44) {
    throw new Error(`${label} has an unexpected selector-completion seal.`);
  }
  const record = requireRecord(input, `${label} selector completion`);
  requireExactKeys(
    record,
    [
      "schemaVersion",
      "strategy",
      "authorizedSelectorBitCount",
      "installedSelectorBitCount",
      "lastIncludedItemId",
      "unpairedCaptureItemId",
      "unpairedCaptureContentSha256",
      "blockedItems",
      "unattemptedItemIds",
      "ledgerPayloadSha256",
      "ledgerByteSha256",
      "stoppedMutationAtUtc",
      "contentSha256",
    ],
    `${label} selector completion`,
  );
  const expectedBlockedItems = [
    {
      itemId: "s046",
      mothJobId: "b369f536-a8d6-4dad-87a4-9e1f249982b6",
      terminalStatusSha256:
        "55a0969e2127ccbf513e895d513d7f8043c786fbb8241f56ccde5c8da9513886",
      providerErrorSha256:
        "bc9e8e9f12447815cc71c8fe6d42c79c365089c3eb66b560c56e600ecdbfe2f1",
      errorType: "unavailable" as const,
      errorRetryable: false as const,
    },
    {
      itemId: "s047",
      mothJobId: "fab73234-1d9b-4c4e-aeec-f7db4096280a",
      terminalStatusSha256:
        "feccdacaaccda0176d88a57ffc5d6258287e78c505cbbc34f37d858e94a9e0a3",
      providerErrorSha256:
        "1081f1e6a011ed29a9b4ce03fdef51f0b363e5a8ccb9ce7a99627da6685647c0",
      errorType: "unavailable" as const,
      errorRetryable: false as const,
    },
    {
      itemId: "s048",
      mothJobId: "5db15d9c-840d-4d5c-8fbb-2ca25003b607",
      terminalStatusSha256:
        "dc5addef79515e62aef407ff8dfa1cce092c886a60f24ff306535910a4d0b13e",
      providerErrorSha256:
        "1081f1e6a011ed29a9b4ce03fdef51f0b363e5a8ccb9ce7a99627da6685647c0",
      errorType: "unavailable" as const,
      errorRetryable: false as const,
    },
    {
      itemId: "s049",
      mothJobId: "0eb6d3a9-d8bf-4dc0-a1bb-0c4696356591",
      terminalStatusSha256:
        "6c1e99f323fbfd921f5a928304863dacf2248adc40e73316f05067c50de307ce",
      providerErrorSha256:
        "1081f1e6a011ed29a9b4ce03fdef51f0b363e5a8ccb9ce7a99627da6685647c0",
      errorType: "unavailable" as const,
      errorRetryable: false as const,
    },
  ];
  if (
    (await sha256CanonicalJson(record["blockedItems"])) !==
    (await sha256CanonicalJson(expectedBlockedItems))
  ) {
    throw new Error(
      `${label} selector blockers do not match the sealed ledger.`,
    );
  }
  const expectedUnattempted = Array.from(
    { length: 15 },
    (_, index) => `s${String(index + 50).padStart(3, "0")}`,
  );
  if (
    JSON.stringify(record["unattemptedItemIds"]) !==
    JSON.stringify(expectedUnattempted)
  ) {
    throw new Error(
      `${label} selector suffix does not match the sealed ledger.`,
    );
  }
  const material = {
    schemaVersion: requireLiteral(
      record["schemaVersion"],
      "quantum-box-qong-selector-completion-v1",
      `${label} selector-completion schema`,
    ),
    strategy: requireLiteral(
      record["strategy"],
      "largest-even-prefix-before-nonretryable-provider-blocker-v1",
      `${label} selector-completion strategy`,
    ),
    authorizedSelectorBitCount: requireLiteral(
      record["authorizedSelectorBitCount"],
      64,
      `${label} authorized selector count`,
    ),
    installedSelectorBitCount: requireLiteral(
      record["installedSelectorBitCount"],
      44,
      `${label} installed selector count`,
    ),
    lastIncludedItemId: requireLiteral(
      record["lastIncludedItemId"],
      "s044",
      `${label} last included selector`,
    ),
    unpairedCaptureItemId: requireLiteral(
      record["unpairedCaptureItemId"],
      "s045",
      `${label} unpaired selector capture`,
    ),
    unpairedCaptureContentSha256: requireLiteral(
      record["unpairedCaptureContentSha256"],
      "7f86f50f7caf6d76cc7a5f279d6cd0f97c2877e91ad53d985ac5c63d814314c9",
      `${label} unpaired selector capture hash`,
    ),
    blockedItems: expectedBlockedItems,
    unattemptedItemIds: expectedUnattempted,
    ledgerPayloadSha256: requireLiteral(
      record["ledgerPayloadSha256"],
      "5093a4e7a1c706eb8d8db075b75f5586e57a81d08294ac3f391ab3ba9f754b83",
      `${label} sealed ledger payload hash`,
    ),
    ledgerByteSha256: requireLiteral(
      record["ledgerByteSha256"],
      "76788b85f98484e80e81c56036cdd35cabbc1e1441950d3a400a10132cba2e09",
      `${label} sealed ledger byte hash`,
    ),
    stoppedMutationAtUtc: requireLiteral(
      record["stoppedMutationAtUtc"],
      "2026-08-31T18:49:18.116Z",
      `${label} provider stop time`,
    ),
  } as const;
  const contentSha256 = requireSha256(
    record["contentSha256"],
    `${label} selector-completion content hash`,
  );
  if ((await sha256CanonicalJson(material)) !== contentSha256) {
    throw new Error(`${label} selector-completion hash does not match.`);
  }
  return deepFreeze({ ...material, contentSha256 });
}

function validatePostselection(
  input: unknown,
  label: string,
): QongFirstRallyPostselection {
  const record = requireRecord(input, `${label} postselection`);
  requireExactKeys(
    record,
    [
      "strategy",
      "candidatePoolSize",
      "selectedCandidateItemId",
      "selectedCandidateOrdinal",
      "selectedTailRank",
      "preflightContentSha256",
      "candidatePoolCaptureSetSha256",
    ],
    `${label} postselection`,
  );
  if (
    record["strategy"] !== "first-four-tails-in-32-candidate-pool-v1" ||
    record["candidatePoolSize"] !== 32
  ) {
    throw new Error(`${label} postselection strategy is unsupported.`);
  }
  const selectedCandidateOrdinal = requireNonNegativeInteger(
    record["selectedCandidateOrdinal"],
    `${label} selected candidate ordinal`,
  );
  const selectedTailRank = requireNonNegativeInteger(
    record["selectedTailRank"],
    `${label} selected tail rank`,
  );
  const selectedCandidateItemId = requireString(
    record["selectedCandidateItemId"],
    `${label} selected candidate ID`,
  );
  if (
    selectedCandidateOrdinal >= 32 ||
    selectedCandidateItemId !==
      `f${String(selectedCandidateOrdinal + 1).padStart(3, "0")}`
  ) {
    throw new Error(`${label} selected candidate identity is inconsistent.`);
  }
  return deepFreeze({
    strategy: "first-four-tails-in-32-candidate-pool-v1",
    candidatePoolSize: 32,
    selectedCandidateItemId,
    selectedCandidateOrdinal,
    selectedTailRank,
    preflightContentSha256: requireSha256(
      record["preflightContentSha256"],
      `${label} preflight content hash`,
    ),
    candidatePoolCaptureSetSha256: requireSha256(
      record["candidatePoolCaptureSetSha256"],
      `${label} candidate-pool capture-set hash`,
    ),
  });
}

function validateBankPostselection(
  playPacks: readonly QongQpuPlayPack[],
  selectorPack: QongSelectorPack,
): void {
  const provenances = [
    ...playPacks.map((pack) => pack.qpuProvenance),
    selectorPack.qpuProvenance,
  ];
  const versions = new Set(
    provenances.map((provenance) => provenance.adapterVersion),
  );
  if (versions.size !== 1) {
    throw new Error("Qong bank cannot mix acquisition adapter versions.");
  }
  if (!versions.has("qong-coin-bank-adapter-v5")) {
    throw new Error(
      "Qong bank lacks the exact authorized preflight and backend-selection policy.",
    );
  }
  const modernVersion = "qong-coin-bank-adapter-v5" as const;
  if (
    selectorPack.qpuProvenance.adapterVersion !== modernVersion ||
    selectorPack.qpuProvenance.postselection !== null
  ) {
    throw new Error("Qong selector provenance must not use postselection.");
  }
  const selections = playPacks.map((pack, index) => {
    const provenance = pack.qpuProvenance;
    if (
      provenance.adapterVersion !== modernVersion ||
      provenance.postselection === null
    ) {
      throw new Error(
        `Qong play pack ${index + 1} lacks postselection evidence.`,
      );
    }
    if (provenance.postselection.selectedTailRank !== index) {
      throw new Error(`Qong play pack ${index + 1} has the wrong tail rank.`);
    }
    return provenance.postselection;
  });
  requireUnique(
    selections.map((selection) => selection.selectedCandidateItemId),
    "Qong selected first-rally candidate IDs",
  );
  if (
    new Set(selections.map((selection) => selection.selectedCandidateOrdinal))
      .size !== selections.length
  ) {
    throw new Error(
      "Qong selected first-rally candidate ordinals must be unique.",
    );
  }
  const preflightHashes = new Set(
    selections.map((selection) => selection.preflightContentSha256),
  );
  if (preflightHashes.size !== 1) {
    throw new Error("Qong play packs do not share one bounded preflight.");
  }
  if (!preflightHashes.has(QONG_AUTHORIZED_PREFLIGHT_CONTENT_SHA256)) {
    throw new Error("Qong play packs do not match the authorized preflight.");
  }
  const candidatePoolHashes = new Set(
    selections.map((selection) => selection.candidatePoolCaptureSetSha256),
  );
  if (candidatePoolHashes.size !== 1) {
    throw new Error(
      "Qong play packs do not share one candidate-pool capture set.",
    );
  }
}

const LEGACY_JOB_KEYS = [
  "itemId",
  "mothJobId",
  "hardwareJobId",
  "backendName",
  "executionMode",
  "shots",
  "heads",
  "tails",
  "outcome",
  "requestSha256",
  "rawResultSha256",
] as const;

function validateCoinJobV1(
  input: unknown,
  expectedItemId: string,
  label: string,
): QongCoinJobEvidenceV1 {
  const record = requireRecord(input, label);
  requireExactKeys(record, LEGACY_JOB_KEYS, label);
  return validateCoinJobBase(record, expectedItemId, label);
}

async function validateCoinJobV2(
  input: unknown,
  expectedItemId: string,
  expectedOrdinal: number,
  expectedRequestSha256: string,
  label: string,
): Promise<QongCoinJobEvidenceV2> {
  const record = requireRecord(input, label);
  requireExactKeys(
    record,
    [
      ...LEGACY_JOB_KEYS,
      "sequenceOrdinal",
      "submittedAt",
      "providerUpdatedAt",
      "terminalObservedAt",
      "retrievedAt",
      "terminalStatusSha256",
      "providerRecordSha256",
    ],
    label,
  );
  const base = validateCoinJobBase(record, expectedItemId, label);
  const sequenceOrdinal = requireNonNegativeInteger(
    record["sequenceOrdinal"],
    `${label} sequence ordinal`,
  );
  if (sequenceOrdinal !== expectedOrdinal) {
    throw new Error(`${label} sequence ordinal does not match array order.`);
  }
  if (base.requestSha256 !== expectedRequestSha256) {
    throw new Error(
      `${label} request hash does not match its provenance request.`,
    );
  }
  const submittedAt = requireUtc(
    record["submittedAt"],
    `${label} submission time`,
  );
  const providerUpdatedAt = requireUtc(
    record["providerUpdatedAt"],
    `${label} provider update time`,
  );
  const terminalObservedAt = requireUtc(
    record["terminalObservedAt"],
    `${label} terminal observation time`,
  );
  const retrievedAt = requireUtc(
    record["retrievedAt"],
    `${label} retrieval time`,
  );
  if (
    Date.parse(submittedAt) > Date.parse(providerUpdatedAt) ||
    Date.parse(providerUpdatedAt) > Date.parse(terminalObservedAt) ||
    Date.parse(terminalObservedAt) > Date.parse(retrievedAt)
  ) {
    throw new Error(`${label} timestamps are not chronologically ordered.`);
  }
  const material = {
    itemId: base.itemId,
    sequenceOrdinal,
    mothJobId: base.mothJobId,
    hardwareJobId: base.hardwareJobId,
    backendName: base.backendName,
    executionMode: base.executionMode,
    submittedAt,
    providerUpdatedAt,
    terminalObservedAt,
    retrievedAt,
    shots: base.shots,
    heads: base.heads,
    tails: base.tails,
    outcome: base.outcome,
    requestSha256: base.requestSha256,
    terminalStatusSha256: requireSha256(
      record["terminalStatusSha256"],
      `${label} terminal-status hash`,
    ),
    rawResultSha256: base.rawResultSha256,
  } as const;
  const providerRecordSha256 = requireSha256(
    record["providerRecordSha256"],
    `${label} provider-record hash`,
  );
  if ((await sha256CanonicalJson(material)) !== providerRecordSha256) {
    throw new Error(
      `${label} provider-record hash does not match its evidence.`,
    );
  }
  return deepFreeze({ ...material, providerRecordSha256 });
}

function validateCoinJobBase(
  record: Record<string, unknown>,
  expectedItemId: string,
  label: string,
): QongCoinJobEvidenceBase {
  if (record["itemId"] !== expectedItemId) {
    throw new Error(`${label} must use stable item ID ${expectedItemId}.`);
  }
  if (record["executionMode"] !== "qpu") {
    throw new Error(`${label} is not a QPU result.`);
  }
  const shots = requirePositiveInteger(record["shots"], `${label} shots`);
  const heads = requireNonNegativeInteger(record["heads"], `${label} heads`);
  const tails = requireNonNegativeInteger(record["tails"], `${label} tails`);
  if (heads + tails !== shots || heads === tails) {
    throw new Error(`${label} counts do not identify one formatted outcome.`);
  }
  const outcome = record["outcome"];
  if (
    (outcome !== "heads" && outcome !== "tails") ||
    (outcome === "heads" ? heads <= tails : tails <= heads)
  ) {
    throw new Error(`${label} formatted outcome disagrees with its counts.`);
  }
  return deepFreeze({
    itemId: expectedItemId,
    mothJobId: requireString(record["mothJobId"], `${label} Moth job ID`),
    hardwareJobId: requireString(
      record["hardwareJobId"],
      `${label} hardware job ID`,
    ),
    backendName: requireString(record["backendName"], `${label} backend`),
    executionMode: "qpu",
    shots,
    heads,
    tails,
    outcome,
    requestSha256: requireSha256(
      record["requestSha256"],
      `${label} request hash`,
    ),
    rawResultSha256: requireSha256(
      record["rawResultSha256"],
      `${label} result hash`,
    ),
  });
}

function outcomeToPolarity(outcome: QongCoinOutcome): QongPolarity {
  return outcome === "heads" ? "direct" : "invert";
}

function requireMatchingRecoveryResult(
  result: Record<string, unknown>,
  providerJob: Record<string, unknown>,
): void {
  const outcome = providerJob["outcome"];
  if (outcome !== "heads" && outcome !== "tails") {
    throw new Error("Installed Qong first provider outcome is invalid.");
  }
  const expectedBit = outcome === "heads" ? 0 : 1;
  const expectedRule = outcomeToPolarity(outcome);
  if (
    result["rallyId"] !== providerJob["itemId"] ||
    result["outcome"] !== outcome ||
    result["bit"] !== expectedBit ||
    result["rule"] !== expectedRule ||
    result["mothJobId"] !== providerJob["mothJobId"] ||
    result["hardwareJobId"] !== providerJob["hardwareJobId"] ||
    result["backendName"] !== providerJob["backendName"] ||
    result["shots"] !== providerJob["shots"] ||
    result["heads"] !== providerJob["heads"] ||
    result["tails"] !== providerJob["tails"]
  ) {
    throw new Error(
      "Qong recovery result is not an immutable installed provider record.",
    );
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new Error(`${label} contains missing or unknown fields.`);
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a string array.`);
  }
  return deepFreeze([...value]) as readonly string[];
}

function requireSha256(value: unknown, label: string): string {
  const text = requireString(value, label);
  if (!SHA256_PATTERN.test(text)) throw new Error(`${label} is invalid.`);
  return text;
}

function requireUtc(value: unknown, label: string): string {
  const text = requireString(value, label);
  if (!ISO_UTC_PATTERN.test(text) || !Number.isFinite(Date.parse(text))) {
    throw new Error(`${label} must be an ISO UTC timestamp.`);
  }
  return text;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

function requirePositiveInteger(value: unknown, label: string): number {
  const number = requireNonNegativeInteger(value, label);
  if (number === 0) throw new Error(`${label} must be positive.`);
  return number;
}

function requireBit(value: unknown, label: string): QongSelectorBit {
  if (value !== 0 && value !== 1) throw new Error(`${label} must be 0 or 1.`);
  return value;
}

function requireLiteral<T extends string | number>(
  value: unknown,
  expected: T,
  label: string,
): T {
  if (value !== expected) throw new Error(`${label} is unsupported.`);
  return expected;
}

function requirePair<T>(
  value: unknown,
  validate: (item: unknown, label: string) => T,
  label: string,
): readonly [T, T] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`${label} must contain exactly two values.`);
  }
  return deepFreeze([
    validate(value[0], `${label} first value`),
    validate(value[1], `${label} second value`),
  ]);
}

function requireUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must be unique.`);
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
