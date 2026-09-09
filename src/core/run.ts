import { asUint32Seed, fnv1a32, type Uint32Seed } from "./determinism";
import type { ArcadeCabinetId, StoryRunStageId } from "../games/registry";

export type PlayMode = "story" | "arcade";

export interface FrozenPackIdentity {
  readonly packId: string;
  readonly contentSha256: string;
  readonly schemaVersion: string;
  readonly source: string;
}

export interface FrozenPackSelectionReceipt {
  readonly schemaVersion: string;
  readonly bankId: string;
  readonly bankContentSha256: string;
  readonly selectorPackId: string;
  readonly selectorContentSha256: string;
  readonly selectionMethod: string;
  readonly selectorCursorBefore: number;
  readonly selectorCursorAfter: number;
  readonly selectorCycle: number;
  readonly selectorCycleAfter: number;
  readonly selectorBitIndices: readonly [number, number];
  readonly selectorBits: readonly [0 | 1, 0 | 1];
  readonly selectedPackIndex: number;
  readonly selectedPackId: string;
  readonly selectedPackContentSha256: string;
  readonly reusedSelectorBits: boolean;
}

export interface RunContext {
  readonly runId: string;
  readonly gameId: ArcadeCabinetId;
  readonly storyStage: StoryRunStageId | null;
  readonly playMode: PlayMode;
  readonly rulesVersion: string;
  readonly runSeed: Uint32Seed;
  readonly pack: FrozenPackIdentity;
  readonly packSelection: FrozenPackSelectionReceipt | null;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function createRunContext(input: {
  readonly gameId: ArcadeCabinetId;
  readonly storyStage?: StoryRunStageId | null;
  readonly playMode: PlayMode;
  readonly rulesVersion: string;
  readonly runSeed: number;
  readonly pack: FrozenPackIdentity;
  readonly packSelection?: FrozenPackSelectionReceipt | null;
}): RunContext {
  if (!input.rulesVersion || !input.pack.packId || !input.pack.schemaVersion) {
    throw new Error(
      "Complete rules and pack identity are required before RUN_STARTED.",
    );
  }
  if (!SHA256_PATTERN.test(input.pack.contentSha256)) {
    throw new Error("A lowercase fixture content SHA-256 is required.");
  }
  const runSeed = asUint32Seed(input.runSeed);
  const storyStage = input.storyStage ?? null;
  if (input.playMode === "story" && storyStage === null) {
    throw new Error("Story play requires an explicit story stage.");
  }
  if (input.playMode === "arcade" && storyStage !== null) {
    throw new Error("Arcade runs cannot carry Story authority.");
  }
  const packSelection = validatePackSelection(input.packSelection ?? null);
  if (
    input.gameId === "qong" &&
    input.playMode === "story" &&
    (input.pack.source !== "moth-api-qpu" || packSelection === null)
  ) {
    throw new Error(
      "Qong Story requires a frozen Moth QPU pack selection receipt.",
    );
  }
  if (input.gameId !== "qong" && packSelection !== null) {
    throw new Error("Only Qong currently accepts a pack-selection receipt.");
  }
  if (
    packSelection !== null &&
    (packSelection.selectedPackId !== input.pack.packId ||
      packSelection.selectedPackContentSha256 !== input.pack.contentSha256)
  ) {
    throw new Error(
      "Pack-selection receipt does not identify the frozen pack.",
    );
  }
  const replayIdentity = [
    input.gameId,
    input.playMode,
    storyStage ?? "none",
    input.rulesVersion,
    input.pack.contentSha256,
    packSelection?.bankContentSha256 ?? "no-bank",
    packSelection?.selectorContentSha256 ?? "no-selector",
    packSelection?.selectorCycle ?? "no-cycle",
    packSelection?.selectorCursorBefore ?? "no-cursor",
    runSeed,
  ].join(":");
  return deepFreeze({
    runId: `run-${fnv1a32(replayIdentity).toString(16).padStart(8, "0")}`,
    gameId: input.gameId,
    storyStage,
    playMode: input.playMode,
    rulesVersion: input.rulesVersion,
    runSeed,
    pack: { ...input.pack },
    packSelection,
  });
}

function validatePackSelection(
  input: FrozenPackSelectionReceipt | null,
): FrozenPackSelectionReceipt | null {
  if (input === null) return null;
  for (const [label, value] of [
    ["bank content", input.bankContentSha256],
    ["selector content", input.selectorContentSha256],
    ["selected pack content", input.selectedPackContentSha256],
  ] as const) {
    if (!SHA256_PATTERN.test(value)) {
      throw new Error(`Pack-selection ${label} SHA-256 is invalid.`);
    }
  }
  if (
    !input.schemaVersion ||
    !input.bankId ||
    !input.selectorPackId ||
    !input.selectionMethod ||
    !input.selectedPackId
  ) {
    throw new Error("Pack-selection receipt identity is incomplete.");
  }
  for (const value of [
    input.selectorCursorBefore,
    input.selectorCursorAfter,
    input.selectorCycle,
    input.selectorCycleAfter,
    input.selectedPackIndex,
    ...input.selectorBitIndices,
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("Pack-selection receipt contains an invalid integer.");
    }
  }
  if (
    input.selectorBits.length !== 2 ||
    input.selectorBits.some((bit) => bit !== 0 && bit !== 1)
  ) {
    throw new Error("Pack-selection receipt requires exactly two bits.");
  }
  return deepFreeze({
    ...input,
    selectorBitIndices: [...input.selectorBitIndices] as [number, number],
    selectorBits: [...input.selectorBits] as [0 | 1, 0 | 1],
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
