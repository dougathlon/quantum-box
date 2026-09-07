import type {
  StoryV2ChapterDefinition,
  StoryV2ChapterId,
  StoryV2StageDefinition,
  StoryV2StageId,
} from "./types";

export const STORY_V2_STAGE_SEQUENCE = Object.freeze([
  "qong",
  "skipixl-medium",
  "skipixl",
  "fluxball-two",
  "fluxball-four",
  "quantman-stabilize",
  "quantman",
  "quarry",
] as const satisfies readonly StoryV2StageId[]);

export const STORY_V2_CHAPTER_SEQUENCE = Object.freeze([
  "qong",
  "skipixl",
  "fluxball",
  "quantman",
  "quarry",
] as const satisfies readonly StoryV2ChapterId[]);

export const STORY_V2_STAGES = deepFreeze({
  qong: {
    id: "qong",
    ordinal: 1,
    chapterId: "qong",
    chapterStep: 1,
    chapterStepCount: 1,
    title: "QONG",
    launch: { runtimeGameId: "qong", arcadeMode: "HUMAN / CPU" },
    qualification: "match-win",
    presentationFlowId: "qong-den",
  },
  "skipixl-medium": {
    id: "skipixl-medium",
    ordinal: 2,
    chapterId: "skipixl",
    chapterStep: 1,
    chapterStepCount: 2,
    title: "SKIPIXL · MEDIUM",
    launch: { runtimeGameId: "skipixl", arcadeMode: "MEDIUM" },
    qualification: "descent-finish",
    presentationFlowId: "skipixl-medium-handoff",
  },
  skipixl: {
    id: "skipixl",
    ordinal: 3,
    chapterId: "skipixl",
    chapterStep: 2,
    chapterStepCount: 2,
    title: "SKIPIXL · HARD",
    launch: { runtimeGameId: "skipixl", arcadeMode: "HARD" },
    qualification: "descent-finish",
    presentationFlowId: "skipixl-cabin",
  },
  "fluxball-two": {
    id: "fluxball-two",
    ordinal: 4,
    chapterId: "fluxball",
    chapterStep: 1,
    chapterStepCount: 2,
    title: "FLUXBALL · 2P",
    launch: { runtimeGameId: "fluxball", arcadeMode: "2 PLAYER / GLOBAL" },
    qualification: "match-win",
    presentationFlowId: "fluxball-two-handoff",
  },
  "fluxball-four": {
    id: "fluxball-four",
    ordinal: 5,
    chapterId: "fluxball",
    chapterStep: 2,
    chapterStepCount: 2,
    title: "FLUXBALL · 4P",
    launch: {
      runtimeGameId: "fluxball",
      arcadeMode: "4 PLAYER / INDIVIDUAL",
    },
    qualification: "match-win",
    presentationFlowId: "fluxball-office",
  },
  "quantman-stabilize": {
    id: "quantman-stabilize",
    ordinal: 6,
    chapterId: "quantman",
    chapterStep: 1,
    chapterStepCount: 2,
    title: "QUANTMAN · STABILIZE GAZE",
    launch: { runtimeGameId: "quantman", arcadeMode: "STABILIZE GAZE" },
    qualification: "screen-clear",
    presentationFlowId: "quantman-stabilize-handoff",
  },
  quantman: {
    id: "quantman",
    ordinal: 7,
    chapterId: "quantman",
    chapterStep: 2,
    chapterStepCount: 2,
    title: "QUANTMAN · INVERSE GAZE",
    launch: { runtimeGameId: "quantman", arcadeMode: "INVERSE GAZE" },
    qualification: "screen-clear",
    presentationFlowId: "quantman-ghost-den",
  },
  quarry: {
    id: "quarry",
    ordinal: 8,
    chapterId: "quarry",
    chapterStep: 1,
    chapterStepCount: 1,
    title: "QUARRY",
    launch: { runtimeGameId: "quarry", arcadeMode: "PLAYER / CPU" },
    qualification: "unique-score-leader",
    presentationFlowId: "quarry-finale",
  },
} as const satisfies Readonly<Record<StoryV2StageId, StoryV2StageDefinition>>);

export const STORY_V2_CHAPTERS = deepFreeze({
  qong: {
    id: "qong",
    ordinal: 1,
    title: "QONG",
    stageIds: ["qong"],
    workshopEngineId: "coin-toss-v1",
  },
  skipixl: {
    id: "skipixl",
    ordinal: 2,
    title: "SKIPIXL",
    stageIds: ["skipixl-medium", "skipixl"],
    workshopEngineId: "qpixl-v1",
  },
  fluxball: {
    id: "fluxball",
    ordinal: 3,
    title: "FLUXBALL",
    stageIds: ["fluxball-two", "fluxball-four"],
    workshopEngineId: "graph-v1",
  },
  quantman: {
    id: "quantman",
    ordinal: 4,
    title: "QUANTMAN",
    stageIds: ["quantman-stabilize", "quantman"],
    workshopEngineId: "labyrinth-v1",
  },
  quarry: {
    id: "quarry",
    ordinal: 5,
    title: "QUARRY",
    stageIds: ["quarry"],
    workshopEngineId: "graph-v1",
  },
} as const satisfies Readonly<
  Record<StoryV2ChapterId, StoryV2ChapterDefinition>
>);

export function isStoryV2StageId(value: unknown): value is StoryV2StageId {
  return (STORY_V2_STAGE_SEQUENCE as readonly unknown[]).includes(value);
}

export function storyV2Stage(stageId: StoryV2StageId): StoryV2StageDefinition {
  return STORY_V2_STAGES[stageId];
}

export function storyV2Chapter(
  chapterId: StoryV2ChapterId,
): StoryV2ChapterDefinition {
  return STORY_V2_CHAPTERS[chapterId];
}

export function nextStoryV2Stage(
  stageId: StoryV2StageId,
): StoryV2StageId | "complete" {
  const index = STORY_V2_STAGE_SEQUENCE.indexOf(stageId);
  return STORY_V2_STAGE_SEQUENCE[index + 1] ?? "complete";
}

export function storyV2ChapterProgress(
  chapterId: StoryV2ChapterId,
  completedStageIds: readonly StoryV2StageId[],
): Readonly<{ completed: number; total: number }> {
  const chapter = storyV2Chapter(chapterId);
  const completed = chapter.stageIds.filter((stageId) =>
    completedStageIds.includes(stageId),
  ).length;
  return Object.freeze({ completed, total: chapter.stageIds.length });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
