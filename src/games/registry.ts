/**
 * Formula ids remain the four engine families recovered in the Workshop.
 * Quarry deliberately reuses the QGraph formula rather than inventing a fifth
 * engine record.
 */
export const GAME_IDS = ["qong", "skipixl", "fluxball", "quantman"] as const;
export type GameId = (typeof GAME_IDS)[number];

/** Player-facing cabinets included in production navigation. */
export const ARCADE_CABINET_IDS = [
  "qong",
  "skipixl",
  "fluxball",
  "quantman",
  "quarry",
] as const;
export type ShippedArcadeCabinetId = (typeof ARCADE_CABINET_IDS)[number];

/** Old replay/source artifacts retain their original type-level identifiers. */
export type LegacyArcadeCabinetId = "quag" | "enclose";
export type ArcadeCabinetId = ShippedArcadeCabinetId | LegacyArcadeCabinetId;

export const STORY_SEQUENCE = [
  "qong",
  "skipixl-medium",
  "skipixl",
  "fluxball-two",
  "fluxball-four",
  "quantman-stabilize",
  "quantman",
  "quarry",
] as const;
export type StoryStageId = (typeof STORY_SEQUENCE)[number];

export const STORY_CHAPTER_IDS = [
  "qong",
  "skipixl",
  "fluxball",
  "quantman",
  "quarry",
] as const;
export type StoryChapterId = (typeof STORY_CHAPTER_IDS)[number];

export interface GameDefinition {
  readonly id: GameId;
  readonly title: string;
  readonly model: string;
  readonly engineId: string;
  readonly formulaTitle: string;
  readonly archiveGlyph: string;
  readonly storyStages: readonly StoryStageId[];
  readonly arcadeModes: readonly string[];
}

export const GAME_DEFINITIONS = Object.freeze({
  qong: {
    id: "qong",
    title: "QONG",
    model: "QB-01",
    engineId: "coin-toss-v1",
    formulaTitle: "RULE STATE",
    archiveGlyph: "●│●",
    storyStages: ["qong"],
    arcadeModes: ["HUMAN / CPU", "LOCAL TWO PLAYER"],
  },
  skipixl: {
    id: "skipixl",
    title: "SKIPIXL",
    model: "QB-02",
    engineId: "qpixl-v1",
    formulaTitle: "RESIDUAL DESCENT",
    archiveGlyph: "╲◇╱",
    storyStages: ["skipixl-medium", "skipixl"],
    arcadeModes: ["EASY", "MEDIUM", "HARD"],
  },
  fluxball: {
    id: "fluxball",
    title: "FLUXBALL",
    model: "QB-03",
    engineId: "graph-v1",
    formulaTitle: "RELATIONAL RULEFIELD",
    archiveGlyph: "◇—◇",
    storyStages: ["fluxball-two", "fluxball-four"],
    arcadeModes: [
      "2 PLAYER / GLOBAL",
      "2 PLAYER / INDIVIDUAL",
      "4 PLAYER / GLOBAL",
      "4 PLAYER / INDIVIDUAL",
    ],
  },
  quantman: {
    id: "quantman",
    title: "QUANTMAN",
    model: "QB-04",
    engineId: "labyrinth-v1",
    formulaTitle: "CORRELATED MAZE",
    archiveGlyph: "▦●",
    storyStages: ["quantman-stabilize", "quantman"],
    arcadeModes: ["STABILIZE GAZE", "INVERSE GAZE"],
  },
} as const satisfies Readonly<Record<GameId, GameDefinition>>);

export interface ArcadeCabinetDefinition {
  readonly id: ArcadeCabinetId;
  readonly title: string;
  readonly model: string;
  readonly engineId: string;
  readonly archiveGlyph: string;
  readonly arcadeModes: readonly string[];
  readonly sourceLabel: string;
  readonly bitmapSourceLabel: string;
}

export const ARCADE_CABINET_DEFINITIONS = Object.freeze({
  qong: {
    ...GAME_DEFINITIONS.qong,
    sourceLabel: "MOTH COIN TOSS QPU BANK",
    bitmapSourceLabel: "QB-01 QPU COIN",
  },
  skipixl: {
    ...GAME_DEFINITIONS.skipixl,
    sourceLabel: "IBM FEZ QPIXL PACK",
    bitmapSourceLabel: "QB-02 IBM QPIXL",
  },
  fluxball: {
    ...GAME_DEFINITIONS.fluxball,
    sourceLabel: "QPU-FIRST RULE BANK",
    bitmapSourceLabel: "QB-03 QPU RULES",
  },
  quantman: {
    ...GAME_DEFINITIONS.quantman,
    sourceLabel: "IBM FEZ LABYRINTH BANK",
    bitmapSourceLabel: "QB-04 QPU MAZE",
  },
  quarry: {
    id: "quarry",
    title: "QUARRY",
    model: "QB-05",
    engineId: "graph-v1",
    archiveGlyph: "↗◇↙",
    arcadeModes: ["1 PLAYER", "2 PLAYER", "3 PLAYER", "4 PLAYER"],
    sourceLabel: "IBM FEZ QGRAPH BANK",
    bitmapSourceLabel: "QB-05 QPU QGRAPH",
  },
} as const satisfies Readonly<
  Record<ShippedArcadeCabinetId, ArcadeCabinetDefinition>
>);

export interface StoryChapterDefinition {
  readonly id: StoryChapterId;
  readonly title: string;
  readonly model: string;
  readonly storyStages: readonly StoryStageId[];
}

export const STORY_CHAPTER_DEFINITIONS = Object.freeze({
  qong: {
    id: "qong",
    title: "QONG",
    model: "QB-01",
    storyStages: ["qong"],
  },
  skipixl: {
    id: "skipixl",
    title: "SKIPIXL",
    model: "QB-02",
    storyStages: ["skipixl-medium", "skipixl"],
  },
  fluxball: {
    id: "fluxball",
    title: "FLUXBALL",
    model: "QB-03",
    storyStages: ["fluxball-two", "fluxball-four"],
  },
  quantman: {
    id: "quantman",
    title: "QUANTMAN",
    model: "QB-04",
    storyStages: ["quantman-stabilize", "quantman"],
  },
  quarry: {
    id: "quarry",
    title: "QUARRY",
    model: "QB-05",
    storyStages: ["quarry"],
  },
} as const satisfies Readonly<Record<StoryChapterId, StoryChapterDefinition>>);

export function isArcadeCabinetId(value: unknown): value is ArcadeCabinetId {
  // Persisted records accept bounded legacy slugs so retired identifiers can
  // survive migration without joining the shipped navigation registry.
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(value);
}

export function isShippedArcadeCabinetId(
  value: unknown,
): value is ShippedArcadeCabinetId {
  return (ARCADE_CABINET_IDS as readonly unknown[]).includes(value);
}

export function chapterForStoryStage(
  stage: StoryStageId,
): StoryChapterDefinition {
  const chapter = Object.values(STORY_CHAPTER_DEFINITIONS).find((candidate) =>
    (candidate.storyStages as readonly StoryStageId[]).includes(stage),
  );
  if (!chapter) {
    throw new Error(`No Quantum Box chapter owns Story stage ${stage}.`);
  }
  return chapter;
}

/** Returns the Workshop formula family explained by a Story stage. */
export function gameForStoryStage(stage: StoryStageId): GameDefinition {
  if (stage === "quarry") return GAME_DEFINITIONS.fluxball;
  const game = Object.values(GAME_DEFINITIONS).find((candidate) =>
    (candidate.storyStages as readonly StoryStageId[]).includes(stage),
  );
  if (!game) {
    throw new Error(`No Quantum Box formula owns Story stage ${stage}.`);
  }
  return game;
}

export function nextStoryStage(stage: StoryStageId): StoryStageId | "complete" {
  const index = STORY_SEQUENCE.indexOf(stage);
  return STORY_SEQUENCE[index + 1] ?? "complete";
}
