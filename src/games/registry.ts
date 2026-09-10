/**
 * Engine-family ids remain four because Fluxball and Quarry both use QGraph.
 * The Terminal archive nevertheless exposes five distinct game programs.
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
  "skipixl-feasible",
  "skipixl-overloaded",
  "quantman-hold",
  "fluxball-global",
  "fluxball-individual",
  "quarry",
] as const;
export type StoryStageId = (typeof STORY_SEQUENCE)[number];

/**
 * V5 run evidence retains these identifiers verbatim. They remain accepted by
 * the replay/migration boundary, but are never emitted by the v6 Story.
 */
export const LEGACY_STORY_SEQUENCE = [
  "qong",
  "skipixl-medium",
  "skipixl",
  "fluxball-two",
  "fluxball-four",
  "quantman-stabilize",
  "quantman",
  "quarry",
] as const;
export type LegacyStoryStageId = (typeof LEGACY_STORY_SEQUENCE)[number];
export type StoryRunStageId = StoryStageId | LegacyStoryStageId;

export const STORY_CHAPTER_IDS = [
  "qong",
  "skipixl",
  "quantman",
  "fluxball",
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
    storyStages: ["skipixl-feasible", "skipixl-overloaded"],
    arcadeModes: ["EASY", "MEDIUM", "HARD"],
  },
  quantman: {
    id: "quantman",
    title: "QUANTMAN",
    model: "QB-03",
    engineId: "labyrinth-v1",
    formulaTitle: "CORRELATED MAZE",
    archiveGlyph: "▦●",
    storyStages: ["quantman-hold"],
    arcadeModes: ["HOLD", "INVERT"],
  },
  fluxball: {
    id: "fluxball",
    title: "FLUXBALL",
    model: "QB-04",
    engineId: "graph-v1",
    formulaTitle: "RELATIONAL RULEFIELD",
    archiveGlyph: "◇—◇",
    storyStages: ["fluxball-global", "fluxball-individual"],
    arcadeModes: [
      "2 PLAYER / GLOBAL",
      "2 PLAYER / INDIVIDUAL",
      "4 PLAYER / GLOBAL",
      "4 PLAYER / INDIVIDUAL",
    ],
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
  readonly brief: ArcadeCabinetBrief;
}

/**
 * Player-facing cabinet notes use the terse grammar of a laboratory trial:
 * one premise, one objective, one governing condition, and the controls.
 * Provider provenance remains in the source record instead of competing with
 * first-play comprehension here.
 */
export interface ArcadeCabinetBrief {
  readonly premise: string;
  readonly object: string;
  readonly condition: string;
  readonly controls: string;
}

export const ARCADE_CABINET_DEFINITIONS = Object.freeze({
  qong: {
    ...GAME_DEFINITIONS.qong,
    sourceLabel: "MOTH COIN TOSS QPU BANK",
    bitmapSourceLabel: "QB-01 QPU COIN",
    brief: {
      premise: "A PADDLE MATCH WHOSE GOAL RULE IS UNRESOLVED.",
      object: "WIN AT LEAST FOUR OF SEVEN ROUNDS.",
      condition:
        "A LINE CROSSING COUNTS AT THE FAR GOAL OR YOUR OWN. OBSERVE EARLY, OR LET THE CROSSING RESOLVE IT.",
      controls: "P1 W / S. P2 UP / DOWN. SPACE / A OBSERVES.",
    },
  },
  skipixl: {
    ...GAME_DEFINITIONS.skipixl,
    sourceLabel: "IBM FEZ QPIXL PACK",
    bitmapSourceLabel: "QB-02 IBM QPIXL",
    brief: {
      premise: "A DOWNHILL COURSE CUT FROM A RECORDED QPIXL FIELD.",
      object: "REACH THE FINISH BEFORE THE LIMIT.",
      condition: "PASS BETWEEN THE GATE FLAGS. MISSES AND COLLISIONS ADD TIME.",
      controls: "LEFT / RIGHT CARVES. DOWN ACCELERATES. RELEASE TO CENTRE.",
    },
  },
  fluxball: {
    ...GAME_DEFINITIONS.fluxball,
    sourceLabel: "QPU-FIRST RULE BANK",
    bitmapSourceLabel: "QB-04 QPU RULES",
    brief: {
      premise: "THREE ROUNDS OF BALL PLAY. THE RULES MAY CHANGE.",
      object: "LEAD ON ROUND WINS AFTER THREE ROUNDS.",
      condition:
        "SHARED USES ONE RULE SET. SPLIT GIVES EACH PLAYER THEIR OWN. CHANGE RULES ONCE PER ROUND.",
      controls: "MOVE WITH PLAYER KEYS OR STICK. SPACE / A CHANGES RULES.",
    },
  },
  quantman: {
    ...GAME_DEFINITIONS.quantman,
    sourceLabel: "IBM FEZ LABYRINTH BANK",
    bitmapSourceLabel: "QB-03 QPU MAZE",
    brief: {
      premise: "A MAZE THAT CHANGES WITH THE DIRECTION YOU LOOK.",
      object: "CLEAR EVERY FRAGMENT BEFORE YOUR LIVES ARE SPENT.",
      condition:
        "HOLD KEEPS THE PASSAGE YOU FACE. INVERT FLIPS IT AFTER A STEADY LOOK.",
      controls: "MOVE WITH DIRECTION KEYS. THE GAZE FOLLOWS YOUR FACING.",
    },
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
    brief: {
      premise: "AN AERIAL HUNT. WHO HUNTS WHOM CHANGES WITH THE CLOCK.",
      object: "WIN ROUNDS BY MAKING THE MOST CATCHES.",
      condition:
        "READ YOUR HUNTS AT THE TOP AND STRIKE FROM ABOVE. CAUGHT DUCKS RETURN ELSEWHERE; RELATIONS CHANGE ON THE TIMER.",
      controls: "LEFT / RIGHT MOVES. YOUR ACTION KEY FLAPS.",
    },
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
    storyStages: ["skipixl-feasible", "skipixl-overloaded"],
  },
  fluxball: {
    id: "fluxball",
    title: "FLUXBALL",
    model: "QB-04",
    storyStages: ["fluxball-global", "fluxball-individual"],
  },
  quantman: {
    id: "quantman",
    title: "QUANTMAN",
    model: "QB-03",
    storyStages: ["quantman-hold"],
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
