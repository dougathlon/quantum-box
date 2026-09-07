import type { FrozenPackIdentity } from "../core/run";

export const ARCADE_RECORD_LIMIT = 5;
export const ARCADE_RECORDS_SCHEMA_VERSION =
  "quantum-box-arcade-records-v2" as const;
const LEGACY_ARCADE_RECORDS_SCHEMA_VERSION =
  "quantum-box-arcade-records-v1" as const;
export const ORIGINAL_QUANTMAN_TOPOLOGY_ID =
  "quantman-maze-original-v1" as const;
export const ORIGINAL_QUANTMAN_TOPOLOGY_LABEL = "ORIGINAL" as const;
export const ORIGINAL_QUANTMAN_TOPOLOGY_SHA256 =
  "0d63ffbd489385cebb77300a61b47b4ca6029a96260e826209bb0b322ae0faee" as const;
export const SKIPIXL_ARCADE_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const QUANTMAN_ARCADE_MECHANICS = [
  "stabilize-gaze",
  "inverse-gaze",
] as const;

export type SkiPixlArcadeDifficulty =
  (typeof SKIPIXL_ARCADE_DIFFICULTIES)[number];
export type QuantmanArcadeMechanic = (typeof QUANTMAN_ARCADE_MECHANICS)[number];

interface ArcadeRecordIdentity {
  readonly runId: string;
  readonly initials: string;
  readonly rulesVersion: string;
  readonly pack: FrozenPackIdentity;
  readonly recordedSequence: number;
}

export interface SkiPixlArcadeRecord extends ArcadeRecordIdentity {
  readonly kind: "skipixl";
  readonly difficulty: SkiPixlArcadeDifficulty;
  readonly officialTimeMs: number;
  readonly missedGates: number;
  readonly collisions: number;
}

export interface QuantmanArcadeRecord extends ArcadeRecordIdentity {
  readonly kind: "quantman";
  readonly mechanic: QuantmanArcadeMechanic;
  readonly topologyId: string;
  readonly topologyLabel: string;
  readonly authoredTopologySha256: string;
  readonly score: number;
  readonly outcome: "won" | "lost";
  readonly remainingLives: number;
  readonly activeTicks: number;
}

export interface ArcadeRecords {
  readonly schemaVersion: typeof ARCADE_RECORDS_SCHEMA_VERSION;
  readonly nextSequence: number;
  readonly skipixl: Readonly<
    Record<SkiPixlArcadeDifficulty, readonly SkiPixlArcadeRecord[]>
  >;
  readonly quantman: Readonly<
    Record<
      QuantmanArcadeMechanic,
      Readonly<Record<string, readonly QuantmanArcadeRecord[]>>
    >
  >;
}

export type PendingSkiPixlArcadeRecord = Omit<
  SkiPixlArcadeRecord,
  "initials" | "recordedSequence"
>;
export type PendingQuantmanArcadeRecord = Omit<
  QuantmanArcadeRecord,
  "initials" | "recordedSequence"
>;

export function createEmptyArcadeRecords(): ArcadeRecords {
  return deepFreeze({
    schemaVersion: ARCADE_RECORDS_SCHEMA_VERSION,
    nextSequence: 1,
    skipixl: { easy: [], medium: [], hard: [] },
    quantman: { "stabilize-gaze": {}, "inverse-gaze": {} },
  });
}

export function wouldPlaceSkiPixlRecord(
  records: ArcadeRecords,
  candidate: PendingSkiPixlArcadeRecord,
): boolean {
  const placeholder = completeSkiPixlRecord(
    candidate,
    "---",
    records.nextSequence,
  );
  return wouldPlace(
    records.skipixl[candidate.difficulty],
    placeholder,
    compareSkiPixl,
  );
}

export function wouldPlaceQuantmanRecord(
  records: ArcadeRecords,
  candidate: PendingQuantmanArcadeRecord,
): boolean {
  const placeholder = completeQuantmanRecord(
    candidate,
    "---",
    records.nextSequence,
  );
  return wouldPlace(
    quantmanArcadeBoard(records, candidate.mechanic, candidate.topologyId),
    placeholder,
    compareQuantman,
  );
}

export function recordSkiPixlArcadeResult(
  records: ArcadeRecords,
  candidate: PendingSkiPixlArcadeRecord,
  initials: string,
): ArcadeRecords {
  const validated = validateArcadeRecords(records);
  const entry = completeSkiPixlRecord(
    candidate,
    normalizeInitials(initials),
    validated.nextSequence,
  );
  return deepFreeze({
    ...validated,
    nextSequence: validated.nextSequence + 1,
    skipixl: {
      ...validated.skipixl,
      [entry.difficulty]: insertRanked(
        validated.skipixl[entry.difficulty],
        entry,
        compareSkiPixl,
      ),
    },
  });
}

export function recordQuantmanArcadeResult(
  records: ArcadeRecords,
  candidate: PendingQuantmanArcadeRecord,
  initials: string,
): ArcadeRecords {
  const validated = validateArcadeRecords(records);
  const entry = completeQuantmanRecord(
    candidate,
    normalizeInitials(initials),
    validated.nextSequence,
  );
  return deepFreeze({
    ...validated,
    nextSequence: validated.nextSequence + 1,
    quantman: {
      ...validated.quantman,
      [entry.mechanic]: {
        ...validated.quantman[entry.mechanic],
        [entry.topologyId]: insertRanked(
          quantmanArcadeBoard(validated, entry.mechanic, entry.topologyId),
          entry,
          compareQuantman,
        ),
      },
    },
  });
}

export function validateArcadeRecords(value: unknown): ArcadeRecords {
  if (value === undefined) return createEmptyArcadeRecords();
  if (
    !isRecord(value) ||
    (value["schemaVersion"] !== undefined &&
      value["schemaVersion"] !== ARCADE_RECORDS_SCHEMA_VERSION &&
      value["schemaVersion"] !== LEGACY_ARCADE_RECORDS_SCHEMA_VERSION) ||
    !positiveInteger(value["nextSequence"])
  ) {
    throw new Error("Quantum Box Arcade records are invalid.");
  }
  const skipixl = value["skipixl"];
  const quantman = value["quantman"];
  if (!isRecord(skipixl) || !isRecord(quantman)) {
    throw new Error("Quantum Box Arcade record boards are incomplete.");
  }
  const validatedSkiPixl = Object.fromEntries(
    SKIPIXL_ARCADE_DIFFICULTIES.map((difficulty) => [
      difficulty,
      validateBoard(
        skipixl[difficulty],
        (entry) => validateSkiPixlEntry(entry, difficulty),
        compareSkiPixl,
      ),
    ]),
  ) as Record<SkiPixlArcadeDifficulty, readonly SkiPixlArcadeRecord[]>;
  const quantmanIsLegacy = QUANTMAN_ARCADE_MECHANICS.every((mechanic) =>
    Array.isArray(quantman[mechanic]),
  );
  const validatedQuantman = Object.fromEntries(
    QUANTMAN_ARCADE_MECHANICS.map((mechanic) => {
      const rawMechanic = quantman[mechanic];
      if (quantmanIsLegacy) {
        const board = validateBoard(
          rawMechanic,
          (entry) => validateLegacyQuantmanEntry(entry, mechanic),
          compareQuantman,
        );
        return [
          mechanic,
          board.length > 0 ? { [ORIGINAL_QUANTMAN_TOPOLOGY_ID]: board } : {},
        ];
      }
      if (!isRecord(rawMechanic)) {
        throw new Error(`Quantum Box Quantman ${mechanic} boards are invalid.`);
      }
      return [
        mechanic,
        Object.freeze(
          Object.fromEntries(
            Object.entries(rawMechanic).map(([topologyId, board]) => [
              topologyId,
              validateBoard(
                board,
                (entry) => validateQuantmanEntry(entry, mechanic, topologyId),
                compareQuantman,
              ),
            ]),
          ),
        ),
      ];
    }),
  ) as Record<
    QuantmanArcadeMechanic,
    Readonly<Record<string, readonly QuantmanArcadeRecord[]>>
  >;
  const entries = [
    ...Object.values(validatedSkiPixl).flat(),
    ...Object.values(validatedQuantman).flatMap((boards) =>
      Object.values(boards).flat(),
    ),
  ];
  const sequences = entries.map((entry) => entry.recordedSequence);
  if (
    new Set(sequences).size !== sequences.length ||
    sequences.some((sequence) => sequence >= Number(value["nextSequence"]))
  ) {
    throw new Error("Quantum Box Arcade record sequence is invalid.");
  }
  return deepFreeze({
    schemaVersion: ARCADE_RECORDS_SCHEMA_VERSION,
    nextSequence: Number(value["nextSequence"]),
    skipixl: validatedSkiPixl,
    quantman: validatedQuantman,
  });
}

export function quantmanArcadeBoard(
  records: ArcadeRecords,
  mechanic: QuantmanArcadeMechanic,
  topologyId: string,
): readonly QuantmanArcadeRecord[] {
  return records.quantman[mechanic][topologyId] ?? Object.freeze([]);
}

export function quantmanArcadeOverallBoard(
  records: ArcadeRecords,
  mechanic: QuantmanArcadeMechanic,
): readonly QuantmanArcadeRecord[] {
  return Object.freeze(
    Object.values(records.quantman[mechanic])
      .flat()
      .sort(compareQuantman)
      .slice(0, ARCADE_RECORD_LIMIT),
  );
}

export function normalizeInitials(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3}$/.test(normalized)) {
    throw new Error(
      "Arcade initials must contain exactly three letters, digits, or dashes.",
    );
  }
  return normalized;
}

function completeSkiPixlRecord(
  candidate: PendingSkiPixlArcadeRecord,
  initials: string,
  recordedSequence: number,
): SkiPixlArcadeRecord {
  return validateSkiPixlEntry(
    { ...candidate, initials, recordedSequence },
    candidate.difficulty,
  );
}

function completeQuantmanRecord(
  candidate: PendingQuantmanArcadeRecord,
  initials: string,
  recordedSequence: number,
): QuantmanArcadeRecord {
  return validateQuantmanEntry(
    { ...candidate, initials, recordedSequence },
    candidate.mechanic,
    candidate.topologyId,
  );
}

function validateSkiPixlEntry(
  value: unknown,
  difficulty: SkiPixlArcadeDifficulty,
): SkiPixlArcadeRecord {
  if (
    !isRecord(value) ||
    value["kind"] !== "skipixl" ||
    value["difficulty"] !== difficulty ||
    !validIdentity(value) ||
    !positiveInteger(value["officialTimeMs"]) ||
    !nonNegativeInteger(value["missedGates"]) ||
    !nonNegativeInteger(value["collisions"])
  ) {
    throw new Error(`Quantum Box SkiPixl ${difficulty} record is invalid.`);
  }
  return Object.freeze({
    kind: "skipixl",
    difficulty,
    runId: String(value["runId"]),
    initials: normalizeInitials(String(value["initials"])),
    rulesVersion: String(value["rulesVersion"]),
    pack: validatePack(value["pack"]),
    recordedSequence: Number(value["recordedSequence"]),
    officialTimeMs: Number(value["officialTimeMs"]),
    missedGates: Number(value["missedGates"]),
    collisions: Number(value["collisions"]),
  });
}

function validateQuantmanEntry(
  value: unknown,
  mechanic: QuantmanArcadeMechanic,
  topologyId: string,
): QuantmanArcadeRecord {
  if (
    !isRecord(value) ||
    value["kind"] !== "quantman" ||
    value["mechanic"] !== mechanic ||
    value["topologyId"] !== topologyId ||
    typeof value["topologyLabel"] !== "string" ||
    value["topologyLabel"].length === 0 ||
    typeof value["authoredTopologySha256"] !== "string" ||
    !/^[0-9a-f]{64}$/.test(value["authoredTopologySha256"]) ||
    !validIdentity(value) ||
    (value["outcome"] !== "won" && value["outcome"] !== "lost") ||
    !nonNegativeInteger(value["score"]) ||
    !nonNegativeInteger(value["remainingLives"]) ||
    !nonNegativeInteger(value["activeTicks"])
  ) {
    throw new Error(`Quantum Box Quantman ${mechanic} record is invalid.`);
  }
  return Object.freeze({
    kind: "quantman",
    mechanic,
    topologyId,
    topologyLabel: String(value["topologyLabel"]),
    authoredTopologySha256: String(value["authoredTopologySha256"]),
    runId: String(value["runId"]),
    initials: normalizeInitials(String(value["initials"])),
    rulesVersion: String(value["rulesVersion"]),
    pack: validatePack(value["pack"]),
    recordedSequence: Number(value["recordedSequence"]),
    score: Number(value["score"]),
    outcome: value["outcome"],
    remainingLives: Number(value["remainingLives"]),
    activeTicks: Number(value["activeTicks"]),
  });
}

function validateLegacyQuantmanEntry(
  value: unknown,
  mechanic: QuantmanArcadeMechanic,
): QuantmanArcadeRecord {
  if (!isRecord(value)) {
    throw new Error(`Quantum Box Quantman ${mechanic} record is invalid.`);
  }
  return validateQuantmanEntry(
    {
      ...value,
      topologyId: ORIGINAL_QUANTMAN_TOPOLOGY_ID,
      topologyLabel: ORIGINAL_QUANTMAN_TOPOLOGY_LABEL,
      authoredTopologySha256: ORIGINAL_QUANTMAN_TOPOLOGY_SHA256,
    },
    mechanic,
    ORIGINAL_QUANTMAN_TOPOLOGY_ID,
  );
}

function validIdentity(value: Record<string, unknown>): boolean {
  return (
    typeof value["runId"] === "string" &&
    value["runId"].length > 0 &&
    typeof value["rulesVersion"] === "string" &&
    value["rulesVersion"].length > 0 &&
    typeof value["initials"] === "string" &&
    /^[A-Z0-9-]{3}$/.test(value["initials"]) &&
    positiveInteger(value["recordedSequence"]) &&
    validPack(value["pack"])
  );
}

function validatePack(value: unknown): FrozenPackIdentity {
  if (!validPack(value)) throw new Error("Arcade record pack is invalid.");
  return Object.freeze({
    packId: value.packId,
    contentSha256: value.contentSha256,
    schemaVersion: value.schemaVersion,
    source: value.source,
  });
}

function validPack(value: unknown): value is FrozenPackIdentity {
  return (
    isRecord(value) &&
    typeof value["packId"] === "string" &&
    value["packId"].length > 0 &&
    typeof value["contentSha256"] === "string" &&
    /^[0-9a-f]{64}$/.test(value["contentSha256"]) &&
    typeof value["schemaVersion"] === "string" &&
    value["schemaVersion"].length > 0 &&
    typeof value["source"] === "string" &&
    value["source"].length > 0
  );
}

function validateBoard<T>(
  value: unknown,
  validate: (entry: unknown) => T,
  compare: (left: T, right: T) => number,
): readonly T[] {
  if (!Array.isArray(value) || value.length > ARCADE_RECORD_LIMIT) {
    throw new Error("Quantum Box Arcade record board is invalid.");
  }
  const entries = value.map(validate);
  if (
    entries.some(
      (entry, index) => index > 0 && compare(entries[index - 1]!, entry) > 0,
    )
  ) {
    throw new Error("Quantum Box Arcade record board is not ranked.");
  }
  return Object.freeze(entries);
}

function insertRanked<T>(
  entries: readonly T[],
  candidate: T,
  compare: (left: T, right: T) => number,
): readonly T[] {
  return Object.freeze(
    [...entries, candidate].sort(compare).slice(0, ARCADE_RECORD_LIMIT),
  );
}

function wouldPlace<T>(
  entries: readonly T[],
  candidate: T,
  compare: (left: T, right: T) => number,
): boolean {
  return (
    entries.length < ARCADE_RECORD_LIMIT ||
    compare(candidate, entries[entries.length - 1]!) < 0
  );
}

function compareSkiPixl(
  left: SkiPixlArcadeRecord,
  right: SkiPixlArcadeRecord,
): number {
  return (
    left.officialTimeMs - right.officialTimeMs ||
    left.missedGates - right.missedGates ||
    left.collisions - right.collisions ||
    left.recordedSequence - right.recordedSequence ||
    left.runId.localeCompare(right.runId)
  );
}

function compareQuantman(
  left: QuantmanArcadeRecord,
  right: QuantmanArcadeRecord,
): number {
  return (
    right.score - left.score ||
    Number(right.outcome === "won") - Number(left.outcome === "won") ||
    right.remainingLives - left.remainingLives ||
    left.activeTicks - right.activeTicks ||
    left.recordedSequence - right.recordedSequence ||
    left.runId.localeCompare(right.runId)
  );
}

function positiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function nonNegativeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0;
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
