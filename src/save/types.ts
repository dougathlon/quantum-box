import {
  STORY_SEQUENCE,
  isArcadeCabinetId,
  type ArcadeCabinetId,
  type LegacyStoryStageId,
  type StoryChapterId,
  type StoryStageId,
} from "../games/registry";
import { canonicalJson } from "../core/canonicalJson";
import {
  validateQongSelectionReceipt,
  type QongPackSelectionReceipt,
} from "../games/qong/qongStoryPackBank";
import {
  SKIPIXL_EARLIEST_RULES_VERSION,
  type SkiPixlCutId,
} from "../games/skipixl/types";
import {
  validateTutorialRecoveryRecords,
  type TutorialRecoveryRecords,
} from "../tutorials/recovery";
import {
  DEFAULT_KEYBOARD_BINDINGS,
  validateKeyboardBindings,
  type KeyboardBindings,
} from "../input/KeyboardBindings";
import {
  BACKGROUND_PROGRAMME_IDS,
  DEFAULT_BACKGROUND_PROGRAMME_ID,
  type BackgroundProgrammeId,
} from "../display/backgrounds/BackgroundProgramme";
import {
  createEmptyArcadeRecords,
  normalizeInitials,
  validateArcadeRecords,
  type ArcadeRecords,
} from "./ArcadeRecords";
import {
  createRunContext,
  type FrozenPackIdentity,
  type FrozenPackSelectionReceipt,
  type RunContext,
} from "../core/run";
import { STORY_NODES, STORY_OPENING_NODE_ID } from "../story/terminal";
import type { StoryOutcome } from "../story/terminal";

export const SAVE_SCHEMA_VERSION = "quantum-box-save-v6";
export const V5_SAVE_SCHEMA_VERSION = "quantum-box-save-v5";
export const PREVIOUS_SAVE_SCHEMA_VERSION = "quantum-box-save-v4";
export const LEGACY_SAVE_SCHEMA_VERSION = "quantum-box-save-v3";
export const EARLIEST_SAVE_SCHEMA_VERSION = "quantum-box-save-v2";
export const INITIAL_SAVE_SCHEMA_VERSION = "quantum-box-save-v1";
export const DEFAULT_SOUND_VOLUME = 0.35;
export type StoryProgress = StoryStageId | "complete";

export interface QuantumBoxSettings {
  readonly reducedMotion: boolean;
  readonly crtFlicker: boolean;
  readonly soundMuted: boolean;
  readonly soundVolume: number;
  readonly keyboardBindings: KeyboardBindings;
  readonly backgroundProgrammeId: BackgroundProgrammeId;
  readonly arcadeInitials: string;
}

export type StoryNarrativeBeatKind = "interlude" | "debrief" | "finale";
export type PendingStoryNarrativeBeat = never;

export interface QuantumBoxSave {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly story: {
    /** Canonical v6 continuation point, persisted before every transition. */
    readonly currentNodeId: string;
    readonly storyCompleted: boolean;
    readonly experiencedStages: readonly StoryStageId[];
    readonly clearedStages: readonly StoryStageId[];
    readonly transcriptSeen: readonly StoryChapterId[];
    readonly lastOutcomes: Readonly<
      Partial<Record<StoryStageId, StoryOutcome>>
    >;
    /** Compatibility projection for older UI/test consumers. */
    readonly currentStage: StoryProgress;
    readonly completedStages: readonly StoryStageId[];
    readonly attempts: Readonly<Partial<Record<StoryStageId, number>>>;
    readonly qongSelector: {
      readonly cursor: number;
      readonly cycle: number;
      readonly recoveredSelection: QongPackSelectionReceipt | null;
    };
    readonly skipixlCuts: SkiPixlStoryCutState;
    readonly tutorialRecoveries: TutorialRecoveryRecords;
    readonly pendingNarrativeBeat: null;
    /** Exact qualified runs retained after a genuine Story clear. */
    readonly qualifiedRuns: Readonly<Partial<Record<StoryStageId, RunContext>>>;
    /** One-shot explanations shown after the first complete Story loss. */
    readonly firstLossExplanations: Readonly<{
      readonly qong: boolean;
      readonly quantman: boolean;
      /** Retained only for save-v5 compatibility. */
      readonly fluxball: boolean;
    }>;
    /** Parsed v5 state retained without changing any historical hashes. */
    readonly legacyV5: Readonly<Record<string, unknown>> | null;
  };
  readonly settings: QuantumBoxSettings;
  readonly arcadeRecords: ArcadeRecords;
}

export interface SkiPixlStoryPassReceipt {
  readonly cutId: SkiPixlCutId;
  readonly tripletId: string;
  readonly packId: string;
  readonly contentSha256: string;
  readonly runId: string;
  readonly elapsedSeconds: number;
  readonly collisionCount: number;
}

export interface SkiPixlStoryAttemptReceipt {
  readonly stageId: "skipixl-feasible" | "skipixl-overloaded";
  readonly cutId: SkiPixlCutId;
  readonly tripletId: string;
  readonly packId: string;
  readonly contentSha256: string;
  readonly runId: string;
  readonly qualified: boolean;
  readonly elapsedSeconds: number;
  readonly collisionCount: number;
  readonly gateCount: number;
  readonly passedGateCount: number;
  readonly missedGateCount: number;
  readonly courseReceiptSchemaVersion:
    | "skipixl-course-receipt-v7"
    | "skipixl-course-receipt-v8";
  readonly bankId: string;
  readonly bankContentSha256: string;
  readonly decoderVersion: string;
  readonly segments: readonly Readonly<{
    order: number;
    segmentId: string;
    sourceSha256: string;
    returnedValuesSha256: string;
    mothJobId: string;
    ibmJobId: string;
  }>[];
}

export interface SkiPixlStoryCutState {
  readonly currentCut: SkiPixlCutId;
  readonly tripletCursor: number;
  readonly tripletId: string | null;
  readonly successfulPasses: readonly SkiPixlStoryPassReceipt[];
  /** Every completed Story descent, including an unsuccessful return. */
  readonly completedAttempts: readonly SkiPixlStoryAttemptReceipt[];
}

export function createDefaultSave(): QuantumBoxSave {
  return deepFreeze({
    schemaVersion: SAVE_SCHEMA_VERSION,
    story: {
      currentNodeId: STORY_OPENING_NODE_ID,
      storyCompleted: false,
      experiencedStages: [],
      clearedStages: [],
      transcriptSeen: [],
      lastOutcomes: {},
      currentStage: "qong",
      completedStages: [],
      attempts: {},
      qongSelector: {
        cursor: 0,
        cycle: 0,
        recoveredSelection: null,
      },
      skipixlCuts: defaultSkiPixlCutState(),
      tutorialRecoveries: {},
      pendingNarrativeBeat: null,
      qualifiedRuns: {},
      firstLossExplanations: {
        qong: false,
        quantman: false,
        fluxball: false,
      },
      legacyV5: null,
    },
    settings: {
      reducedMotion: false,
      crtFlicker: true,
      soundMuted: false,
      soundVolume: DEFAULT_SOUND_VOLUME,
      keyboardBindings: DEFAULT_KEYBOARD_BINDINGS,
      backgroundProgrammeId: DEFAULT_BACKGROUND_PROGRAMME_ID,
      arcadeInitials: "YOU",
    },
    arcadeRecords: createEmptyArcadeRecords(),
  });
}

export function validateSave(input: unknown): QuantumBoxSave {
  const candidate = migrateSaveIfNeeded(input);
  if (
    !isRecord(candidate) ||
    candidate["schemaVersion"] !== SAVE_SCHEMA_VERSION
  ) {
    throw new Error("Unknown Quantum Box save schema.");
  }
  const story = candidate["story"];
  const settings = candidate["settings"];
  if (!isRecord(story) || !isRecord(settings)) {
    throw new Error("Quantum Box save is incomplete.");
  }
  const rawCurrentNodeId = story["currentNodeId"];
  const storyCompleted = story["storyCompleted"];
  if (typeof storyCompleted !== "boolean") {
    throw new Error("Quantum Box save completion state is invalid.");
  }
  const experiencedStages = requireUniqueArray(
    story["experiencedStages"],
    isStoryStage,
    "experienced stages",
  );
  const clearedStages = requireUniqueArray(
    story["clearedStages"],
    isStoryStage,
    "cleared stages",
  );
  if (clearedStages.some((stage) => !experiencedStages.includes(stage))) {
    throw new Error("A cleared Story stage must also be experienced.");
  }
  const currentStage = earliestUnclearedStoryStage(clearedStages);
  const currentNodeId = validateStoryNodeId(
    rawCurrentNodeId,
    nodeForStage(currentStage),
  );
  const transcriptSeen = requireUniqueArray(
    story["transcriptSeen"],
    isStoryChapter,
    "seen transcripts",
  );
  const lastOutcomes = validateLastOutcomes(story["lastOutcomes"]);
  const completedStages = clearedStages;
  const attempts = story["attempts"];
  if (!isRecord(attempts))
    throw new Error("Quantum Box save attempts are invalid.");
  const normalizedAttempts: Partial<Record<StoryStageId, number>> = {};
  for (const [stage, count] of Object.entries(attempts)) {
    if (
      !isStoryStage(stage) ||
      !Number.isSafeInteger(count) ||
      Number(count) < 0
    ) {
      throw new Error("Quantum Box save contains an invalid attempt count.");
    }
    normalizedAttempts[stage] = Number(count);
  }
  const qongSelectorValue = story["qongSelector"];
  const qongSelector =
    qongSelectorValue === undefined
      ? { cursor: 0, cycle: 0, recoveredSelection: null }
      : validateQongSelectorState(qongSelectorValue);
  const skipixlCuts = validateSkiPixlCutState(story["skipixlCuts"]);
  const tutorialRecoveries = validateTutorialRecoveryRecords(
    story["tutorialRecoveries"] ?? {},
  );
  const qualifiedRuns = validateQualifiedStoryRuns(
    story["qualifiedRuns"] ?? {},
    clearedStages,
  );
  const firstLossExplanations = validateFirstLossExplanations(
    story["firstLossExplanations"],
  );
  const qongRecovery = tutorialRecoveries.qong;
  if (
    qongRecovery !== undefined &&
    (qongSelector.recoveredSelection === null ||
      canonicalJson(qongRecovery.run.packSelection) !==
        canonicalJson(qongSelector.recoveredSelection) ||
      qongSelector.cursor !==
        qongSelector.recoveredSelection.selectorCursorAfter ||
      qongSelector.cycle !== qongSelector.recoveredSelection.selectorCycleAfter)
  ) {
    throw new Error(
      "Qong tutorial recovery does not match its consumed selector receipt and saved position.",
    );
  }
  const legacyV5Value = story["legacyV5"] ?? null;
  if (legacyV5Value !== null && !isRecord(legacyV5Value)) {
    throw new Error("Quantum Box legacy v5 evidence is invalid.");
  }
  const legacyV5 =
    legacyV5Value === null ? null : cloneJsonRecord(legacyV5Value);
  for (const key of ["reducedMotion", "crtFlicker", "soundMuted"] as const) {
    if (typeof settings[key] !== "boolean") {
      throw new Error(`Quantum Box save setting ${key} is invalid.`);
    }
  }
  const reducedMotion = settings["reducedMotion"] as boolean;
  const crtFlicker = settings["crtFlicker"] as boolean;
  const soundMuted = settings["soundMuted"] as boolean;
  const soundVolumeValue = settings["soundVolume"];
  if (
    soundVolumeValue !== undefined &&
    (typeof soundVolumeValue !== "number" ||
      !Number.isFinite(soundVolumeValue) ||
      soundVolumeValue < 0 ||
      soundVolumeValue > 1)
  ) {
    throw new Error("Quantum Box save setting soundVolume is invalid.");
  }
  // V1 saves created before independent volume existed migrate in place.
  const soundVolume =
    soundVolumeValue === undefined ? DEFAULT_SOUND_VOLUME : soundVolumeValue;
  const keyboardBindings = validateKeyboardBindings(
    settings["keyboardBindings"] ?? DEFAULT_KEYBOARD_BINDINGS,
  );
  const backgroundProgrammeId = validateBackgroundProgrammeId(
    settings["backgroundProgrammeId"] ?? DEFAULT_BACKGROUND_PROGRAMME_ID,
  );
  const arcadeInitials = normalizeInitials(
    typeof settings["arcadeInitials"] === "string"
      ? settings["arcadeInitials"]
      : "YOU",
  );
  const arcadeRecords = validateArcadeRecords(candidate["arcadeRecords"]);
  return deepFreeze({
    schemaVersion: SAVE_SCHEMA_VERSION,
    story: {
      currentNodeId,
      storyCompleted,
      experiencedStages,
      clearedStages,
      transcriptSeen,
      lastOutcomes,
      currentStage,
      completedStages,
      attempts: normalizedAttempts,
      qongSelector,
      skipixlCuts,
      tutorialRecoveries,
      pendingNarrativeBeat: null,
      qualifiedRuns,
      firstLossExplanations,
      legacyV5,
    },
    settings: {
      reducedMotion,
      crtFlicker,
      soundMuted,
      soundVolume,
      keyboardBindings,
      backgroundProgrammeId,
      arcadeInitials,
    },
    arcadeRecords,
  });
}

function migrateSaveIfNeeded(input: unknown): unknown {
  if (!isRecord(input)) return input;
  if (input["schemaVersion"] === INITIAL_SAVE_SCHEMA_VERSION) {
    return migrateV5Save(migrateV4Save(migrateLegacySave(input)));
  }
  if (input["schemaVersion"] === EARLIEST_SAVE_SCHEMA_VERSION) {
    return migrateV5Save(migrateV4Save(migratePreviousSave(input)));
  }
  if (input["schemaVersion"] === LEGACY_SAVE_SCHEMA_VERSION) {
    return migrateV5Save(
      migrateV4Save(demoteLegacySkiPixlAuthority(migrateV3Save(input))),
    );
  }
  if (input["schemaVersion"] === PREVIOUS_SAVE_SCHEMA_VERSION) {
    return migrateV5Save(migrateV4Save(demoteLegacySkiPixlAuthority(input)));
  }
  if (input["schemaVersion"] === V5_SAVE_SCHEMA_VERSION)
    return migrateV5Save(input);
  return input;
}

function migrateV5Save(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const story = input["story"];
  const settings = input["settings"];
  if (!isRecord(story) || !isRecord(settings)) {
    throw new Error("Quantum Box v5 save is incomplete.");
  }
  const oldCompleted = stringArray(story["completedStages"]);
  const oldAttempts = isRecord(story["attempts"]) ? story["attempts"] : {};
  const successfulPasses = isRecord(story["skipixlCuts"])
    ? story["skipixlCuts"]["successfulPasses"]
    : [];
  const passIds = Array.isArray(successfulPasses)
    ? successfulPasses.flatMap((candidate) =>
        isRecord(candidate) && typeof candidate["cutId"] === "string"
          ? [candidate["cutId"]]
          : [],
      )
    : [];
  const qualifiedRuns = isRecord(story["qualifiedRuns"])
    ? story["qualifiedRuns"]
    : {};
  const experiencedStages: StoryStageId[] = [];
  const clearedStages: StoryStageId[] = [];
  const attempts: Partial<Record<StoryStageId, number>> = {};
  const migratedRuns: Partial<Record<StoryStageId, unknown>> = {};
  const include = (
    stage: StoryStageId,
    experienced: boolean,
    cleared: boolean,
    oldStage: LegacyStoryStageId,
  ): void => {
    if (experienced) experiencedStages.push(stage);
    if (cleared) clearedStages.push(stage);
    const oldCount = oldAttempts[oldStage];
    if (Number.isSafeInteger(oldCount) && Number(oldCount) >= 0)
      attempts[stage] = Number(oldCount);
    if (
      cleared &&
      oldStage === stage &&
      qualifiedRuns[oldStage] !== undefined
    ) {
      migratedRuns[stage] = qualifiedRuns[oldStage];
    }
  };
  const oldCurrent = story["currentStage"];
  const reached = (oldStage: LegacyStoryStageId): boolean => {
    const index = [
      "qong",
      "skipixl-medium",
      "skipixl",
      "fluxball-two",
      "fluxball-four",
      "quantman-stabilize",
      "quantman",
      "quarry",
    ].indexOf(String(oldCurrent));
    const stageIndex = [
      "qong",
      "skipixl-medium",
      "skipixl",
      "fluxball-two",
      "fluxball-four",
      "quantman-stabilize",
      "quantman",
      "quarry",
    ].indexOf(oldStage);
    return (
      oldCurrent === "complete" ||
      oldCompleted.includes(oldStage) ||
      index >= stageIndex
    );
  };
  const qongClear = oldCompleted.includes("qong");
  include("qong", reached("qong"), qongClear, "qong");
  const feasibleClear = passIds.includes("P84") || passIds.includes("P78");
  include(
    "skipixl-feasible",
    reached("skipixl-medium"),
    feasibleClear,
    "skipixl-medium",
  );
  const overloadedClear = passIds.includes("P78");
  include("skipixl-overloaded", reached("skipixl"), overloadedClear, "skipixl");
  const quantmanClear = oldCompleted.includes("quantman-stabilize");
  include(
    "quantman-hold",
    reached("quantman-stabilize"),
    quantmanClear,
    "quantman-stabilize",
  );
  const globalClear = oldCompleted.includes("fluxball-two");
  include(
    "fluxball-global",
    reached("fluxball-two"),
    globalClear,
    "fluxball-two",
  );
  // A v5 4P Individual result is preserved below, but cannot prove the new
  // 2P Individual requirement.
  include(
    "fluxball-individual",
    reached("fluxball-four"),
    false,
    "fluxball-four",
  );
  const quarryClear = oldCompleted.includes("quarry");
  include("quarry", reached("quarry"), quarryClear, "quarry");

  const earliestStage = earliestUnclearedStoryStage(clearedStages);
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    story: {
      currentNodeId: nodeForStage(earliestStage),
      storyCompleted: false,
      experiencedStages,
      clearedStages,
      transcriptSeen: [],
      lastOutcomes: {},
      currentStage: earliestStage,
      completedStages: clearedStages,
      attempts,
      qongSelector: story["qongSelector"] ?? {
        cursor: 0,
        cycle: 0,
        recoveredSelection: null,
      },
      skipixlCuts: migrateSkiPixlCutsToV6(story["skipixlCuts"]),
      tutorialRecoveries: story["tutorialRecoveries"] ?? {},
      pendingNarrativeBeat: null,
      qualifiedRuns: migratedRuns,
      firstLossExplanations: story["firstLossExplanations"] ?? {
        qong: false,
        quantman: false,
        fluxball: false,
      },
      legacyV5: cloneJsonRecord(story),
    },
    settings,
    arcadeRecords: input["arcadeRecords"] ?? createEmptyArcadeRecords(),
  };
}

function migrateV3Save(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const settings = input["settings"];
  const story = input["story"];
  if (!isRecord(settings)) {
    throw new Error("Previous Quantum Box save settings are incomplete.");
  }
  if (!isRecord(story)) {
    throw new Error("Previous Quantum Box save Story state is incomplete.");
  }
  return {
    ...input,
    schemaVersion: PREVIOUS_SAVE_SCHEMA_VERSION,
    story: {
      ...story,
      skipixlCuts: defaultSkiPixlCutState(),
    },
    settings: {
      ...settings,
      keyboardBindings: DEFAULT_KEYBOARD_BINDINGS,
    },
  };
}

function migrateV4Save(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const story = input["story"];
  const settings = input["settings"];
  if (!isRecord(story) || !isRecord(settings)) {
    throw new Error("Previous Quantum Box save is incomplete.");
  }
  const oldCompleted = Array.isArray(story["completedStages"])
    ? story["completedStages"].filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const oldCurrent = story["currentStage"];
  const passes = isRecord(story["skipixlCuts"])
    ? story["skipixlCuts"]["successfulPasses"]
    : [];
  const passIds = Array.isArray(passes)
    ? passes.flatMap((pass) =>
        isRecord(pass) && typeof pass["cutId"] === "string"
          ? [pass["cutId"]]
          : [],
      )
    : [];
  const migratedPasses = Array.isArray(passes)
    ? passes.filter(
        (pass) =>
          isRecord(pass) &&
          (pass["cutId"] === "P84" || pass["cutId"] === "P78"),
      )
    : [];
  const migratedTripletCursor =
    isRecord(story["skipixlCuts"]) &&
    Number.isSafeInteger(story["skipixlCuts"]["tripletCursor"]) &&
    Number(story["skipixlCuts"]["tripletCursor"]) >= 0
      ? Number(story["skipixlCuts"]["tripletCursor"])
      : 0;
  const migratedTripletId = migratedPasses.at(-1)?.["tripletId"];

  const qongComplete = oldCompleted.includes("qong");
  const oldSkiComplete = oldCompleted.includes("skipixl");
  const mediumComplete =
    oldSkiComplete ||
    (oldCurrent === "skipixl" &&
      (passIds.includes("P84") || passIds.includes("P78")));
  const hardComplete =
    oldSkiComplete || (oldCurrent === "skipixl" && passIds.includes("P78"));
  const fluxTwoComplete = oldCompleted.includes("fluxball-two");
  const fluxFourComplete = oldCompleted.includes("fluxball-four");

  const completedStages: string[] = [];
  for (const [stage, complete] of [
    ["qong", qongComplete],
    ["skipixl-medium", mediumComplete],
    ["skipixl", hardComplete],
    ["fluxball-two", fluxTwoComplete],
    ["fluxball-four", fluxFourComplete],
  ] as const) {
    if (!complete) break;
    completedStages.push(stage);
  }
  const currentStage =
    [
      "qong",
      "skipixl-medium",
      "skipixl",
      "fluxball-two",
      "fluxball-four",
      "quantman-stabilize",
      "quantman",
      "quarry",
    ][completedStages.length] ?? "complete";

  const oldAttempts = isRecord(story["attempts"]) ? story["attempts"] : {};
  const attempts: Record<string, unknown> = {};
  for (const stage of ["qong", "fluxball-two", "fluxball-four"] as const) {
    if (oldAttempts[stage] !== undefined) attempts[stage] = oldAttempts[stage];
  }
  if (oldAttempts["skipixl"] !== undefined) {
    attempts[mediumComplete ? "skipixl" : "skipixl-medium"] =
      oldAttempts["skipixl"];
  }
  if (oldAttempts["quantman"] !== undefined) {
    attempts["quantman-stabilize"] = oldAttempts["quantman"];
  }

  const recoveries = isRecord(story["tutorialRecoveries"])
    ? story["tutorialRecoveries"]
    : {};
  const { quantman: quantmanRecovery, ...retainedRecoveries } = recoveries;
  const recoveredFormulae = Array.isArray(story["recoveredFormulae"])
    ? story["recoveredFormulae"]
    : [];
  const priorInspectOnly = Array.isArray(story["inspectOnlyFormulae"])
    ? story["inspectOnlyFormulae"]
    : [];
  const quantmanWasRecovered =
    quantmanRecovery !== undefined || recoveredFormulae.includes("quantman");
  const nextRecoveredFormulae = quantmanWasRecovered
    ? [...new Set([...recoveredFormulae, "quantman"])]
    : recoveredFormulae;
  const inspectOnlyFormulae = quantmanWasRecovered
    ? [...new Set([...priorInspectOnly, "quantman"])]
    : priorInspectOnly;

  return {
    ...input,
    schemaVersion: V5_SAVE_SCHEMA_VERSION,
    story: {
      ...story,
      currentStage,
      completedStages,
      recoveredFormulae: nextRecoveredFormulae,
      inspectOnlyFormulae,
      debriefedFormulae: [],
      attempts,
      skipixlCuts: {
        currentCut: migratedPasses.some((pass) => pass["cutId"] === "P84")
          ? "P78"
          : "P84",
        tripletCursor: migratedTripletCursor,
        tripletId:
          typeof migratedTripletId === "string" ? migratedTripletId : null,
        successfulPasses: migratedPasses,
        completedAttempts: [],
      },
      tutorialRecoveries: retainedRecoveries,
      pendingNarrativeBeat: null,
      qualifiedRuns: {},
      firstLossExplanations: {
        qong: false,
        quantman: false,
        fluxball: false,
      },
    },
    settings: {
      ...settings,
      backgroundProgrammeId: DEFAULT_BACKGROUND_PROGRAMME_ID,
    },
    arcadeRecords: createEmptyArcadeRecords(),
  };
}

function demoteLegacySkiPixlAuthority(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const story = input["story"];
  if (!isRecord(story)) return input;
  const recoveries = story["tutorialRecoveries"];
  if (!isRecord(recoveries)) return input;
  const skiPixlRecovery = recoveries["skipixl"];
  if (!isRecord(skiPixlRecovery)) return input;
  const run = skiPixlRecovery["run"];
  if (
    !isRecord(run) ||
    run["rulesVersion"] !== SKIPIXL_EARLIEST_RULES_VERSION
  ) {
    return input;
  }

  const completedStages = Array.isArray(story["completedStages"])
    ? story["completedStages"]
    : [];
  const qongCompleted = completedStages.includes("qong");
  const recoveredFormulae = Array.isArray(story["recoveredFormulae"])
    ? story["recoveredFormulae"]
    : [];
  const priorInspectOnly = Array.isArray(story["inspectOnlyFormulae"])
    ? story["inspectOnlyFormulae"]
    : [];
  const retainedRecoveries =
    qongCompleted && recoveries["qong"] ? { qong: recoveries["qong"] } : {};
  const inspectOnlyFormulae = [
    ...new Set(
      [...priorInspectOnly, ...recoveredFormulae].filter(
        (gameId) => gameId !== "qong" || !qongCompleted,
      ),
    ),
  ];

  return {
    ...input,
    story: {
      ...story,
      currentStage: qongCompleted ? "skipixl" : "qong",
      completedStages: qongCompleted ? ["qong"] : [],
      inspectOnlyFormulae,
      debriefedFormulae: [],
      tutorialRecoveries: retainedRecoveries,
      qongSelector: qongCompleted
        ? story["qongSelector"]
        : { cursor: 0, cycle: 0, recoveredSelection: null },
    },
  };
}

function migrateLegacySave(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const story = input["story"];
  if (!isRecord(story))
    throw new Error("Legacy Quantum Box save is incomplete.");
  const attempts = story["attempts"];
  const inspectOnlyFormulae = migrateLegacyFormulae(story["recoveredFormulae"]);
  const migratedAttempts: Record<string, unknown> = {};
  if (isRecord(attempts)) {
    for (const [stage, count] of Object.entries(attempts)) {
      migratedAttempts[stage === "skiblur" ? "skipixl" : stage] = count;
    }
  }
  return {
    ...input,
    schemaVersion: PREVIOUS_SAVE_SCHEMA_VERSION,
    story: {
      currentStage: "qong",
      completedStages: [],
      recoveredFormulae: inspectOnlyFormulae,
      inspectOnlyFormulae,
      attempts: migratedAttempts,
      qongSelector: {
        cursor: 0,
        cycle: 0,
        recoveredSelection: null,
      },
      skipixlCuts: defaultSkiPixlCutState(),
      tutorialRecoveries: {},
    },
  };
}

function migratePreviousSave(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const story = input["story"];
  if (!isRecord(story)) {
    throw new Error("Previous Quantum Box save is incomplete.");
  }
  const inspectOnlyFormulae = migrateLegacyFormulae(story["recoveredFormulae"]);
  return {
    ...input,
    schemaVersion: PREVIOUS_SAVE_SCHEMA_VERSION,
    story: {
      currentStage: "qong",
      completedStages: [],
      recoveredFormulae: inspectOnlyFormulae,
      inspectOnlyFormulae,
      attempts: story["attempts"],
      qongSelector: {
        cursor: 0,
        cycle: 0,
        recoveredSelection: null,
      },
      skipixlCuts: defaultSkiPixlCutState(),
      // V2 had no normalized tutorial evidence. Preserve settings and attempt
      // counts, but never convert unverifiable progress into v3 authority.
      tutorialRecoveries: {},
    },
  };
}

function migrateLegacyFormulae(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((gameId) => (gameId === "skiblur" ? "skipixl" : gameId));
}

function validateQongSelectorState(value: unknown): {
  readonly cursor: number;
  readonly cycle: number;
  readonly recoveredSelection: QongPackSelectionReceipt | null;
} {
  if (!isRecord(value)) {
    throw new Error("Quantum Box save Qong selector state is invalid.");
  }
  const cursor = value["cursor"];
  const cycle = value["cycle"];
  if (
    !Number.isSafeInteger(cursor) ||
    Number(cursor) < 0 ||
    Number(cursor) % 2 !== 0 ||
    !Number.isSafeInteger(cycle) ||
    Number(cycle) < 0
  ) {
    throw new Error("Quantum Box save Qong selector position is invalid.");
  }
  const recovered = value["recoveredSelection"];
  return deepFreeze({
    cursor: Number(cursor),
    cycle: Number(cycle),
    recoveredSelection:
      recovered === null || recovered === undefined
        ? null
        : validateQongSelectionReceipt(recovered),
  });
}

function defaultSkiPixlCutState(): SkiPixlStoryCutState {
  return deepFreeze({
    currentCut: "P84",
    tripletCursor: 0,
    tripletId: null,
    successfulPasses: [],
    completedAttempts: [],
  });
}

function validateSkiPixlCutState(value: unknown): SkiPixlStoryCutState {
  if (value === undefined) return defaultSkiPixlCutState();
  if (!isRecord(value)) {
    throw new Error("Quantum Box save SkiPixl cut state is invalid.");
  }
  const currentCut = value["currentCut"];
  const tripletCursor = value["tripletCursor"];
  const tripletId = value["tripletId"];
  const passes = value["successfulPasses"];
  const attempts = value["completedAttempts"] ?? [];
  if (
    !isSkiPixlCutId(currentCut) ||
    !Number.isSafeInteger(tripletCursor) ||
    Number(tripletCursor) < 0 ||
    (tripletId !== null && typeof tripletId !== "string") ||
    !Array.isArray(passes) ||
    passes.length > 3 ||
    !Array.isArray(attempts) ||
    attempts.length > 128
  ) {
    throw new Error("Quantum Box save SkiPixl cut state is invalid.");
  }
  const successfulPasses = passes.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`Quantum Box SkiPixl pass ${index + 1} is invalid.`);
    }
    const cutId = candidate["cutId"];
    if (
      !isSkiPixlCutId(cutId) ||
      typeof candidate["tripletId"] !== "string" ||
      typeof candidate["packId"] !== "string" ||
      typeof candidate["contentSha256"] !== "string" ||
      !/^[0-9a-f]{64}$/.test(candidate["contentSha256"]) ||
      typeof candidate["runId"] !== "string" ||
      typeof candidate["elapsedSeconds"] !== "number" ||
      !Number.isFinite(candidate["elapsedSeconds"]) ||
      typeof candidate["collisionCount"] !== "number" ||
      !Number.isSafeInteger(candidate["collisionCount"]) ||
      Number(candidate["collisionCount"]) < 0
    ) {
      throw new Error(`Quantum Box SkiPixl pass ${index + 1} is invalid.`);
    }
    return Object.freeze({
      cutId,
      tripletId: candidate["tripletId"],
      packId: candidate["packId"],
      contentSha256: candidate["contentSha256"],
      runId: candidate["runId"],
      elapsedSeconds: candidate["elapsedSeconds"],
      collisionCount: candidate["collisionCount"],
    });
  });
  const expectedCuts =
    successfulPasses[0]?.cutId === "P90"
      ? (["P90", "P84", "P78"] as const)
      : (["P84", "P78"] as const);
  const expectedCurrentCut =
    successfulPasses.length === 0 && currentCut === "P90"
      ? "P90"
      : expectedCuts[
          Math.min(successfulPasses.length, expectedCuts.length - 1)
        ];
  if (
    successfulPasses.some(
      (pass, index) => pass.cutId !== expectedCuts[index],
    ) ||
    currentCut !== expectedCurrentCut
  ) {
    throw new Error("Quantum Box SkiPixl pass sequence is inconsistent.");
  }
  const completedAttempts = attempts.map((candidate, index) =>
    validateSkiPixlAttemptReceipt(candidate, index),
  );
  return deepFreeze({
    currentCut,
    tripletCursor: Number(tripletCursor),
    tripletId,
    successfulPasses,
    completedAttempts,
  });
}

function validateSkiPixlAttemptReceipt(
  value: unknown,
  index: number,
): SkiPixlStoryAttemptReceipt {
  if (!isRecord(value)) {
    throw new Error(`Quantum Box SkiPixl attempt ${index + 1} is invalid.`);
  }
  const stageId = value["stageId"];
  const cutId = value["cutId"];
  const elapsedSeconds = value["elapsedSeconds"];
  const collisionCount = value["collisionCount"];
  const gateCount = value["gateCount"];
  const passedGateCount = value["passedGateCount"];
  const missedGateCount = value["missedGateCount"];
  const segments = value["segments"];
  if (
    (stageId !== "skipixl-feasible" && stageId !== "skipixl-overloaded") ||
    !isSkiPixlCutId(cutId) ||
    (stageId === "skipixl-feasible" ? cutId !== "P84" : cutId !== "P78") ||
    typeof value["tripletId"] !== "string" ||
    typeof value["packId"] !== "string" ||
    typeof value["contentSha256"] !== "string" ||
    !/^[0-9a-f]{64}$/.test(value["contentSha256"]) ||
    typeof value["runId"] !== "string" ||
    typeof value["qualified"] !== "boolean" ||
    typeof elapsedSeconds !== "number" ||
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < 0 ||
    !Number.isSafeInteger(collisionCount) ||
    Number(collisionCount) < 0 ||
    !Number.isSafeInteger(gateCount) ||
    Number(gateCount) < 0 ||
    !Number.isSafeInteger(passedGateCount) ||
    Number(passedGateCount) < 0 ||
    !Number.isSafeInteger(missedGateCount) ||
    Number(missedGateCount) < 0 ||
    Number(passedGateCount) + Number(missedGateCount) !== Number(gateCount) ||
    (value["courseReceiptSchemaVersion"] !== "skipixl-course-receipt-v7" &&
      value["courseReceiptSchemaVersion"] !== "skipixl-course-receipt-v8") ||
    typeof value["bankId"] !== "string" ||
    typeof value["bankContentSha256"] !== "string" ||
    !/^[0-9a-f]{64}$/.test(value["bankContentSha256"]) ||
    typeof value["decoderVersion"] !== "string" ||
    !Array.isArray(segments) ||
    segments.length !== 3
  ) {
    throw new Error(`Quantum Box SkiPixl attempt ${index + 1} is invalid.`);
  }
  const validatedSegments = segments.map((candidate, segmentIndex) => {
    if (
      !isRecord(candidate) ||
      candidate["order"] !== segmentIndex ||
      typeof candidate["segmentId"] !== "string" ||
      typeof candidate["sourceSha256"] !== "string" ||
      !/^[0-9a-f]{64}$/.test(candidate["sourceSha256"]) ||
      typeof candidate["returnedValuesSha256"] !== "string" ||
      !/^[0-9a-f]{64}$/.test(candidate["returnedValuesSha256"]) ||
      typeof candidate["mothJobId"] !== "string" ||
      typeof candidate["ibmJobId"] !== "string"
    ) {
      throw new Error(
        `Quantum Box SkiPixl attempt ${index + 1} segment ${segmentIndex + 1} is invalid.`,
      );
    }
    return Object.freeze({
      order: segmentIndex,
      segmentId: candidate["segmentId"],
      sourceSha256: candidate["sourceSha256"],
      returnedValuesSha256: candidate["returnedValuesSha256"],
      mothJobId: candidate["mothJobId"],
      ibmJobId: candidate["ibmJobId"],
    });
  });
  return deepFreeze({
    stageId,
    cutId,
    tripletId: value["tripletId"],
    packId: value["packId"],
    contentSha256: value["contentSha256"],
    runId: value["runId"],
    qualified: value["qualified"],
    elapsedSeconds,
    collisionCount: Number(collisionCount),
    gateCount: Number(gateCount),
    passedGateCount: Number(passedGateCount),
    missedGateCount: Number(missedGateCount),
    courseReceiptSchemaVersion: value["courseReceiptSchemaVersion"],
    bankId: value["bankId"],
    bankContentSha256: value["bankContentSha256"],
    decoderVersion: value["decoderVersion"],
    segments: validatedSegments,
  });
}

function migrateSkiPixlCutsToV6(value: unknown): unknown {
  if (!isRecord(value)) return defaultSkiPixlCutState();
  const attempts = Array.isArray(value["completedAttempts"])
    ? value["completedAttempts"].map((candidate) => {
        if (!isRecord(candidate)) return candidate;
        const stageId = candidate["stageId"];
        return {
          ...candidate,
          stageId:
            stageId === "skipixl-medium"
              ? "skipixl-feasible"
              : stageId === "skipixl"
                ? "skipixl-overloaded"
                : stageId,
        };
      })
    : [];
  return {
    ...value,
    completedAttempts: attempts,
  };
}

function validateQualifiedStoryRuns(
  value: unknown,
  completedStages: readonly StoryStageId[],
): Readonly<Partial<Record<StoryStageId, RunContext>>> {
  if (!isRecord(value)) {
    throw new Error("Quantum Box qualified Story runs are invalid.");
  }
  const result: Partial<Record<StoryStageId, RunContext>> = {};
  for (const [stage, candidate] of Object.entries(value)) {
    if (!isStoryStage(stage) || !completedStages.includes(stage)) {
      throw new Error(
        "Quantum Box qualified Story run does not match completed progress.",
      );
    }
    const run = validateQualifiedStoryRun(candidate, stage);
    const expectedGameId = gameIdForStoryStage(stage);
    if (run.gameId !== expectedGameId) {
      throw new Error(
        "Quantum Box qualified Story run identifies the wrong cabinet.",
      );
    }
    result[stage] = run;
  }
  return deepFreeze(result);
}

function validateFirstLossExplanations(
  value: unknown,
): QuantumBoxSave["story"]["firstLossExplanations"] {
  if (value === undefined) {
    return deepFreeze({ qong: false, quantman: false, fluxball: false });
  }
  if (
    !isRecord(value) ||
    typeof value["qong"] !== "boolean" ||
    typeof value["fluxball"] !== "boolean"
  ) {
    throw new Error("Quantum Box first-loss explanation state is invalid.");
  }
  return deepFreeze({
    qong: value["qong"],
    quantman:
      typeof value["quantman"] === "boolean" ? value["quantman"] : false,
    fluxball: value["fluxball"],
  });
}

function isSkiPixlCutId(value: unknown): value is SkiPixlCutId {
  return value === "P90" || value === "P84" || value === "P78";
}

function validateBackgroundProgrammeId(value: unknown): BackgroundProgrammeId {
  if (
    typeof value !== "string" ||
    !(BACKGROUND_PROGRAMME_IDS as readonly string[]).includes(value)
  ) {
    return DEFAULT_BACKGROUND_PROGRAMME_ID;
  }
  return value as BackgroundProgrammeId;
}

function validateQualifiedStoryRun(
  value: unknown,
  stage: StoryStageId,
): RunContext {
  if (
    !isRecord(value) ||
    typeof value["runId"] !== "string" ||
    !isArcadeCabinetId(value["gameId"]) ||
    value["storyStage"] !== stage ||
    value["playMode"] !== "story" ||
    typeof value["rulesVersion"] !== "string" ||
    !Number.isSafeInteger(value["runSeed"]) ||
    Number(value["runSeed"]) < 0 ||
    Number(value["runSeed"]) > 0xffff_ffff ||
    !isFrozenPackIdentity(value["pack"]) ||
    (value["packSelection"] !== null && !isRecord(value["packSelection"]))
  ) {
    throw new Error("Quantum Box pending Story run is invalid.");
  }
  const rebuilt = createRunContext({
    gameId: value["gameId"] as ArcadeCabinetId,
    storyStage: stage,
    playMode: "story",
    rulesVersion: value["rulesVersion"],
    runSeed: Number(value["runSeed"]),
    pack: value["pack"] as unknown as FrozenPackIdentity,
    packSelection: value["packSelection"] as FrozenPackSelectionReceipt | null,
  });
  if (
    rebuilt.runId !== value["runId"] ||
    canonicalJson(rebuilt) !== canonicalJson(value)
  ) {
    throw new Error("Quantum Box pending Story run identity is inconsistent.");
  }
  return rebuilt;
}

function isFrozenPackIdentity(value: unknown): boolean {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStoryStage(value: unknown): value is StoryStageId {
  return (
    typeof value === "string" && STORY_SEQUENCE.includes(value as StoryStageId)
  );
}

function isStoryChapter(value: unknown): value is StoryChapterId {
  return (
    value === "qong" ||
    value === "skipixl" ||
    value === "quantman" ||
    value === "fluxball" ||
    value === "quarry"
  );
}

function validateStoryNodeId(
  value: unknown,
  fallback = STORY_OPENING_NODE_ID,
): string {
  return typeof value === "string" && STORY_NODES[value] ? value : fallback;
}

function validateLastOutcomes(
  value: unknown,
): Readonly<Partial<Record<StoryStageId, StoryOutcome>>> {
  if (!isRecord(value))
    throw new Error("Quantum Box Story outcomes are invalid.");
  const result: Partial<Record<StoryStageId, StoryOutcome>> = {};
  for (const [stage, outcome] of Object.entries(value)) {
    if (
      !isStoryStage(stage) ||
      (outcome !== "won" &&
        outcome !== "lost" &&
        outcome !== "finished" &&
        outcome !== "failed")
    ) {
      throw new Error("Quantum Box Story contains an invalid outcome.");
    }
    result[stage] = outcome;
  }
  return deepFreeze(result);
}

function earliestUnclearedStoryStage(
  clearedStages: readonly StoryStageId[],
): StoryProgress {
  return (
    STORY_SEQUENCE.find((stage) => !clearedStages.includes(stage)) ?? "complete"
  );
}

function gameIdForStoryStage(stage: StoryStageId): ArcadeCabinetId {
  if (stage === "qong") return "qong";
  if (stage === "skipixl-feasible" || stage === "skipixl-overloaded")
    return "skipixl";
  if (stage === "quantman-hold") return "quantman";
  if (stage === "fluxball-global" || stage === "fluxball-individual")
    return "fluxball";
  return "quarry";
}

function nodeForStage(stage: StoryProgress): string {
  switch (stage) {
    case "qong":
      return "qong-intro";
    case "skipixl-feasible":
      return "skipixl-intro";
    case "skipixl-overloaded":
      return "skipixl-overloaded-intro";
    case "quantman-hold":
      return "quantman-intro";
    case "fluxball-global":
      return "fluxball-global-pre";
    case "fluxball-individual":
      return "fluxball-individual-pre";
    case "quarry":
      return "quarry-pre";
    case "complete":
      return "story-complete";
  }
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter(
        (candidate): candidate is string => typeof candidate === "string",
      )
    : [];
}

function cloneJsonRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function requireUniqueArray<T extends string>(
  value: unknown,
  predicate: (item: unknown) => item is T,
  label: string,
): readonly T[] {
  if (!Array.isArray(value) || value.some((item) => !predicate(item))) {
    throw new Error(`Quantum Box save ${label} are invalid.`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`Quantum Box save ${label} contain duplicates.`);
  }
  return Object.freeze([...value]) as readonly T[];
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
