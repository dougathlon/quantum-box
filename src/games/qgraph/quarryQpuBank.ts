import installedBankArtifact from "./packs/quarry-qgraph-ibm-fez-bank-v2.json";

import { sha256CanonicalJson } from "../../core/canonicalJson";
import { asUint32Seed, deriveSeed } from "../../core/determinism";
import {
  qgraphPackHashMaterial,
  validateQGraphCabinetPack,
  type QGraphCabinetPack,
  type QpuQGraphProvenance,
} from "./QGraphPack";

export const QUARRY_QPU_BANK_SCHEMA = "quantum-box-quarry-qpu-bank-v2" as const;
export const QUARRY_QPU_SELECTION_METHOD =
  "run-seed-uniform-24-pack-v2" as const;
export const QUARRY_QPU_BIT_ORDER =
  "A>B,A>C,A>D,B>A,B>C,B>D,C>A,C>B,C>D,D>A,D>B,D>C";

export const QUARRY_RECIPE_FAMILIES = [
  "all-opposed",
  "all-equal",
  "front-opposed-back-equal",
  "front-equal-back-opposed",
  "alternating-a",
  "alternating-b",
] as const;
export type QuarryRecipeFamily = (typeof QUARRY_RECIPE_FAMILIES)[number];
export type QuarryRealizationId = "r1" | "r2" | "r3" | "r4";
export type QuarrySourceBankVersion = "v1" | "v2";

export interface QuarryQpuSourceBank {
  readonly bankId:
    | "quarry-qgraph-ibm-fez-bank-v1"
    | "quarry-qgraph-ibm-fez-bank-v2-tranche";
  readonly campaignId:
    | "quarry-qgraph-qpu-bank-v1"
    | "quarry-qgraph-qpu-bank-v2";
  readonly sourceBankVersion: QuarrySourceBankVersion;
  readonly captureCount: number;
  readonly captureSetSha256: string;
  readonly compiledBankContentSha256: string;
}

export interface QuarryQpuPackIndexEntry {
  readonly packId: string;
  readonly packContentSha256: string;
  readonly sourceCampaignId: QuarryQpuSourceBank["campaignId"];
  readonly sourceBankVersion: QuarrySourceBankVersion;
  readonly recipeFamily: QuarryRecipeFamily;
  readonly realizationId: QuarryRealizationId;
  readonly redactedRequestSha256: string;
  readonly captureContentSha256: string;
}

export interface QuarryQpuBank {
  readonly schemaVersion: typeof QUARRY_QPU_BANK_SCHEMA;
  readonly bankId: string;
  readonly selectionMethod: typeof QUARRY_QPU_SELECTION_METHOD;
  readonly sourceBanks: readonly QuarryQpuSourceBank[];
  readonly packIndex: readonly QuarryQpuPackIndexEntry[];
  readonly packs: readonly QGraphCabinetPack[];
  readonly contentSha256: string;
}

export interface QuarryQpuPackSelection {
  readonly pack: QGraphCabinetPack;
  readonly indexEntry: QuarryQpuPackIndexEntry;
  readonly sourceBank: QuarryQpuSourceBank;
  readonly selectedPackIndex: number;
  readonly bankId: string;
  readonly bankContentSha256: string;
  readonly selectionMethod: typeof QUARRY_QPU_SELECTION_METHOD;
}

export class QuarryQpuBankUnavailableError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "QuarryQpuBankUnavailableError";
  }
}

export async function loadInstalledQuarryQpuBank(): Promise<QuarryQpuBank> {
  return validateQuarryQpuBank(installedBankArtifact);
}

export function selectQuarryQpuPack(
  bank: QuarryQpuBank,
  runSeed: number,
): QuarryQpuPackSelection {
  if (bank.packs.length === 0) {
    throw new QuarryQpuBankUnavailableError(
      "The installed Quarry QPU bank contains no playable records.",
    );
  }
  const index =
    deriveSeed(asUint32Seed(runSeed), "quarry:qpu-bank-selector-v2") %
    bank.packs.length;
  const pack = bank.packs[index];
  const indexEntry = bank.packIndex[index];
  const sourceBank = bank.sourceBanks.find(
    (source) => source.campaignId === indexEntry?.sourceCampaignId,
  );
  if (!pack || !indexEntry || !sourceBank) {
    throw new QuarryQpuBankUnavailableError(
      "The Quarry QPU selector resolved outside the installed bank.",
    );
  }
  return deepFreeze({
    pack,
    indexEntry,
    sourceBank,
    selectedPackIndex: index,
    bankId: bank.bankId,
    bankContentSha256: bank.contentSha256,
    selectionMethod: bank.selectionMethod,
  });
}

export function findInstalledQuarryQpuPack(
  bank: QuarryQpuBank,
  packId: string,
  contentSha256: string,
): QuarryQpuPackSelection | null {
  const selectedPackIndex = bank.packs.findIndex(
    (pack) => pack.packId === packId && pack.contentSha256 === contentSha256,
  );
  if (selectedPackIndex < 0) return null;
  const pack = bank.packs[selectedPackIndex];
  const indexEntry = bank.packIndex[selectedPackIndex];
  const sourceBank = bank.sourceBanks.find(
    (source) => source.campaignId === indexEntry?.sourceCampaignId,
  );
  if (!pack || !indexEntry || !sourceBank) return null;
  return deepFreeze({
    pack,
    indexEntry,
    sourceBank,
    selectedPackIndex,
    bankId: bank.bankId,
    bankContentSha256: bank.contentSha256,
    selectionMethod: bank.selectionMethod,
  });
}

export async function validateQuarryQpuBank(
  input: unknown,
): Promise<QuarryQpuBank> {
  if (!isRecord(input)) {
    throw new QuarryQpuBankUnavailableError(
      "The installed Quarry QPU bank is not an object.",
    );
  }
  if (
    input["schemaVersion"] !== QUARRY_QPU_BANK_SCHEMA ||
    input["selectionMethod"] !== QUARRY_QPU_SELECTION_METHOD
  ) {
    throw new QuarryQpuBankUnavailableError(
      "The installed Quarry QPU bank contract is unsupported.",
    );
  }
  const bankId = requiredString(input["bankId"], "bankId");
  const contentSha256 = requiredHash(input["contentSha256"], "contentSha256");
  const sourceBanks = validateSourceBanks(input["sourceBanks"]);
  const packIndex = validatePackIndex(input["packIndex"]);
  const rawPacks = input["packs"];
  if (!Array.isArray(rawPacks) || rawPacks.length !== 24) {
    throw new QuarryQpuBankUnavailableError(
      "The installed Quarry QPU bank must contain exactly 24 packs.",
    );
  }
  const packs: QGraphCabinetPack[] = [];
  for (const rawPack of rawPacks) {
    const pack = validateQGraphCabinetPack(rawPack);
    if (
      pack.sourceClassification !== "moth-qgraph-qpu" ||
      pack.provenance.kind !== "qpu-record" ||
      pack.qubitCount !== 12 ||
      pack.bitOrdering !== QUARRY_QPU_BIT_ORDER ||
      pack.frames.length !== 7
    ) {
      throw new QuarryQpuBankUnavailableError(
        `Quarry pack ${pack.packId} is not a seven-phase, twelve-bit QPU record.`,
      );
    }
    await validatePackIntegrity(pack);
    packs.push(pack);
  }
  if (new Set(packs.map((pack) => pack.packId)).size !== packs.length) {
    throw new QuarryQpuBankUnavailableError(
      "The installed Quarry QPU bank repeats a pack ID.",
    );
  }
  await validateCorpusShape(sourceBanks, packIndex, packs);
  const bank = {
    schemaVersion: QUARRY_QPU_BANK_SCHEMA,
    bankId,
    selectionMethod: QUARRY_QPU_SELECTION_METHOD,
    sourceBanks,
    packIndex,
    packs,
    contentSha256,
  } as const;
  const material = {
    schemaVersion: bank.schemaVersion,
    bankId: bank.bankId,
    selectionMethod: bank.selectionMethod,
    sourceBanks: bank.sourceBanks,
    packIndex: bank.packIndex,
    packs: bank.packs,
  };
  if ((await sha256CanonicalJson(material)) !== contentSha256) {
    throw new QuarryQpuBankUnavailableError(
      "The installed Quarry QPU bank content hash does not match.",
    );
  }
  return deepFreeze(bank);
}

function validateSourceBanks(input: unknown): readonly QuarryQpuSourceBank[] {
  if (!Array.isArray(input) || input.length !== 2) {
    throw new QuarryQpuBankUnavailableError(
      "The installed Quarry QPU bank requires two source tranches.",
    );
  }
  const sourceBanks = input.map((raw, index): QuarryQpuSourceBank => {
    if (!isRecord(raw)) {
      throw new QuarryQpuBankUnavailableError(
        `The Quarry source bank at index ${index} is invalid.`,
      );
    }
    const sourceBankVersion = raw["sourceBankVersion"];
    const campaignId = raw["campaignId"];
    const bankId = raw["bankId"];
    const expectedBankId =
      sourceBankVersion === "v1"
        ? "quarry-qgraph-ibm-fez-bank-v1"
        : "quarry-qgraph-ibm-fez-bank-v2-tranche";
    if (
      (sourceBankVersion !== "v1" && sourceBankVersion !== "v2") ||
      campaignId !== `quarry-qgraph-qpu-bank-${sourceBankVersion}` ||
      bankId !== expectedBankId
    ) {
      throw new QuarryQpuBankUnavailableError(
        `The Quarry source bank at index ${index} has inconsistent identity.`,
      );
    }
    return deepFreeze({
      bankId: bankId as QuarryQpuSourceBank["bankId"],
      campaignId: campaignId as QuarryQpuSourceBank["campaignId"],
      sourceBankVersion,
      captureCount: requiredPositiveInteger(
        raw["captureCount"],
        `sourceBanks[${index}].captureCount`,
      ),
      captureSetSha256: requiredHash(
        raw["captureSetSha256"],
        `sourceBanks[${index}].captureSetSha256`,
      ),
      compiledBankContentSha256: requiredHash(
        raw["compiledBankContentSha256"],
        `sourceBanks[${index}].compiledBankContentSha256`,
      ),
    });
  });
  return deepFreeze(sourceBanks);
}

function validatePackIndex(input: unknown): readonly QuarryQpuPackIndexEntry[] {
  if (!Array.isArray(input) || input.length !== 24) {
    throw new QuarryQpuBankUnavailableError(
      "The Quarry QPU pack index must contain exactly 24 entries.",
    );
  }
  const entries = input.map((raw, index): QuarryQpuPackIndexEntry => {
    if (!isRecord(raw)) {
      throw new QuarryQpuBankUnavailableError(
        `The Quarry pack index at ${index} is invalid.`,
      );
    }
    const sourceBankVersion = raw["sourceBankVersion"];
    const sourceCampaignId = raw["sourceCampaignId"];
    const recipeFamily = raw["recipeFamily"];
    const realizationId = raw["realizationId"];
    if (
      (sourceBankVersion !== "v1" && sourceBankVersion !== "v2") ||
      sourceCampaignId !== `quarry-qgraph-qpu-bank-${sourceBankVersion}` ||
      !QUARRY_RECIPE_FAMILIES.includes(recipeFamily as QuarryRecipeFamily) ||
      !["r1", "r2", "r3", "r4"].includes(String(realizationId))
    ) {
      throw new QuarryQpuBankUnavailableError(
        `The Quarry pack index at ${index} has invalid source or recipe identity.`,
      );
    }
    return deepFreeze({
      packId: requiredString(raw["packId"], `packIndex[${index}].packId`),
      packContentSha256: requiredHash(
        raw["packContentSha256"],
        `packIndex[${index}].packContentSha256`,
      ),
      sourceCampaignId:
        sourceCampaignId as QuarryQpuPackIndexEntry["sourceCampaignId"],
      sourceBankVersion,
      recipeFamily: recipeFamily as QuarryRecipeFamily,
      realizationId: realizationId as QuarryRealizationId,
      redactedRequestSha256: requiredHash(
        raw["redactedRequestSha256"],
        `packIndex[${index}].redactedRequestSha256`,
      ),
      captureContentSha256: requiredHash(
        raw["captureContentSha256"],
        `packIndex[${index}].captureContentSha256`,
      ),
    });
  });
  return deepFreeze(entries);
}

async function validateCorpusShape(
  sourceBanks: readonly QuarryQpuSourceBank[],
  packIndex: readonly QuarryQpuPackIndexEntry[],
  packs: readonly QGraphCabinetPack[],
): Promise<void> {
  const sourceCounts = new Map(
    sourceBanks.map((source) => [source.campaignId, source.captureCount]),
  );
  for (const source of sourceBanks) {
    const sourceIndexes = packIndex.flatMap((entry, index) =>
      entry.sourceCampaignId === source.campaignId ? [index] : [],
    );
    const sourceEntries = sourceIndexes.map((index) => packIndex[index]!);
    const sourcePacks = sourceIndexes.map((index) => packs[index]!);
    if (sourceEntries.length !== source.captureCount) {
      throw new QuarryQpuBankUnavailableError(
        `Quarry source ${source.campaignId} count does not match its index.`,
      );
    }
    if (
      (await sha256CanonicalJson(
        sourceEntries.map((entry) => entry.captureContentSha256),
      )) !== source.captureSetSha256
    ) {
      throw new QuarryQpuBankUnavailableError(
        `Quarry source ${source.campaignId} capture-set hash does not match.`,
      );
    }
    if (
      (await sha256CanonicalJson({
        schemaVersion: "quantum-box-quarry-qpu-bank-v1",
        bankId: source.bankId,
        selectionMethod: "run-seed-modulo-pack-count-v1",
        packs: sourcePacks,
      })) !== source.compiledBankContentSha256
    ) {
      throw new QuarryQpuBankUnavailableError(
        `Quarry source ${source.campaignId} compiled-bank hash does not match.`,
      );
    }
  }
  if (
    sourceCounts.get("quarry-qgraph-qpu-bank-v1") !== 6 ||
    sourceCounts.get("quarry-qgraph-qpu-bank-v2") !== 18
  ) {
    throw new QuarryQpuBankUnavailableError(
      "The Quarry corpus must preserve six original and eighteen second-tranche captures.",
    );
  }
  const identities = new Set<string>();
  const mothJobs = new Set<string>();
  const hardwareJobs = new Set<string>();
  const rawResults = new Set<string>();
  for (let index = 0; index < packs.length; index += 1) {
    const pack = packs[index];
    const entry = packIndex[index];
    if (
      !pack ||
      !entry ||
      pack.packId !== entry.packId ||
      pack.contentSha256 !== entry.packContentSha256
    ) {
      throw new QuarryQpuBankUnavailableError(
        `Quarry pack index ${index} does not identify its pack.`,
      );
    }
    const identity = `${entry.recipeFamily}:${entry.realizationId}`;
    if (identities.has(identity)) {
      throw new QuarryQpuBankUnavailableError(
        `The Quarry corpus repeats ${identity}.`,
      );
    }
    identities.add(identity);
    if (pack.provenance.kind !== "qpu-record") {
      throw new QuarryQpuBankUnavailableError(
        `Quarry pack ${pack.packId} is not a QPU record.`,
      );
    }
    for (const [set, value, label] of [
      [mothJobs, pack.provenance.mothJobId, "Moth job"],
      [hardwareJobs, pack.provenance.hardwareJobId, "hardware job"],
      [rawResults, pack.provenance.rawResultSha256, "raw result"],
    ] as const) {
      if (set.has(value)) {
        throw new QuarryQpuBankUnavailableError(
          `The Quarry corpus repeats a ${label} identity.`,
        );
      }
      set.add(value);
    }
  }
  const expectedIdentities = new Set(
    QUARRY_RECIPE_FAMILIES.flatMap((recipe) =>
      ["r1", "r2", "r3", "r4"].map((realization) => `${recipe}:${realization}`),
    ),
  );
  if (
    identities.size !== expectedIdentities.size ||
    [...expectedIdentities].some((identity) => !identities.has(identity))
  ) {
    throw new QuarryQpuBankUnavailableError(
      "The Quarry corpus does not contain four realizations of every recipe.",
    );
  }
}

async function validatePackIntegrity(pack: QGraphCabinetPack): Promise<void> {
  if (
    (await sha256CanonicalJson(qgraphPackHashMaterial(pack))) !==
    pack.contentSha256
  ) {
    throw new QuarryQpuBankUnavailableError(
      `Quarry pack ${pack.packId} content hash does not match.`,
    );
  }
  const provenance = pack.provenance as QpuQGraphProvenance;
  const firstFrame = pack.frames[0];
  if (!firstFrame) {
    throw new QuarryQpuBankUnavailableError(
      `Quarry pack ${pack.packId} contains no measurement frame.`,
    );
  }
  const returnedShotCount = firstFrame.measurements.reduce(
    (sum, measurement) => sum + measurement.weight,
    0,
  );
  if (
    pack.frames.some(
      (frame) =>
        JSON.stringify(frame.measurements) !==
        JSON.stringify(firstFrame.measurements),
    ) ||
    provenance.returnedMeasurementCount !== firstFrame.measurements.length ||
    provenance.returnedShotCount !== returnedShotCount ||
    Math.abs(
      provenance.returnedProbabilityMass -
        returnedShotCount / provenance.requestedShots,
    ) > 1e-9
  ) {
    throw new QuarryQpuBankUnavailableError(
      `Quarry pack ${pack.packId} projection metadata does not match its measurements.`,
    );
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new QuarryQpuBankUnavailableError(
      `The installed Quarry QPU bank ${label} is invalid.`,
    );
  }
  return value;
}

function requiredPositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new QuarryQpuBankUnavailableError(
      `The installed Quarry QPU bank ${label} is invalid.`,
    );
  }
  return value as number;
}

function requiredHash(value: unknown, label: string): string {
  const hash = requiredString(value, label);
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new QuarryQpuBankUnavailableError(
      `The installed Quarry QPU bank ${label} is not SHA-256.`,
    );
  }
  return hash;
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
