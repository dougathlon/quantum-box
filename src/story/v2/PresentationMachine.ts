import { storyV2PresentationFlow } from "./flows";
import { isStoryV2StageId, storyV2Stage } from "./registry";
import {
  STORY_V2_VERSION,
  type StoryV2DispatchResult,
  type StoryV2PresentationFlow,
  type StoryV2PresentationEvidence,
  type StoryV2PresentationSnapshot,
  type StoryV2ResumeToken,
  type StoryV2StageId,
} from "./types";

export type StoryV2PresentationAction = "continue";

export function parseStoryV2ResumeToken(value: unknown): StoryV2ResumeToken {
  if (!isRecord(value)) {
    throw new Error("Story presentation resume token must be an object.");
  }
  const stageId = value["stageId"];
  if (!isStoryV2StageId(stageId)) {
    throw new Error("Story presentation resume token has an unknown stage.");
  }
  const flow = storyV2PresentationFlow(
    storyV2Stage(stageId).presentationFlowId,
  );
  if (
    value["schemaVersion"] !== STORY_V2_VERSION ||
    value["flowId"] !== flow.id ||
    typeof value["beatId"] !== "string" ||
    !flow.beats.some((beat) => beat.id === value["beatId"])
  ) {
    throw new Error(
      "Story presentation resume token is not valid for its stage.",
    );
  }
  return Object.freeze({
    schemaVersion: STORY_V2_VERSION,
    stageId,
    flowId: flow.id,
    beatId: value["beatId"],
  });
}

export class StoryV2PresentationMachine {
  private readonly flow: StoryV2PresentationFlow;
  private readonly evidence: StoryV2PresentationEvidence | null;
  private beatIndex: number;
  private completed = false;

  public constructor(
    stageId: StoryV2StageId,
    resumeToken: StoryV2ResumeToken | null = null,
    evidence: StoryV2PresentationEvidence | null = null,
  ) {
    const stage = storyV2Stage(stageId);
    this.flow = storyV2PresentationFlow(stage.presentationFlowId);
    if (this.flow.stageId !== stageId) {
      throw new Error(
        `Story flow ${this.flow.id} does not own stage ${stageId}.`,
      );
    }
    this.beatIndex = resumeToken
      ? this.validateResumeToken(stageId, resumeToken)
      : 0;
    if (evidence !== null && evidence.identity.stageId !== stageId) {
      throw new Error(
        "Story presentation evidence identity does not match its stage.",
      );
    }
    this.evidence = evidence;
  }

  public snapshot(): StoryV2PresentationSnapshot {
    const stage = storyV2Stage(this.flow.stageId);
    const activeBeat = this.completed
      ? null
      : (this.flow.beats[this.beatIndex] ?? null);
    if (!this.completed && activeBeat === null) {
      throw new Error(
        `Story flow ${this.flow.id} has no beat ${this.beatIndex}.`,
      );
    }
    const resumeToken = activeBeat
      ? Object.freeze({
          schemaVersion: STORY_V2_VERSION,
          stageId: this.flow.stageId,
          flowId: this.flow.id,
          beatId: activeBeat.id,
        })
      : null;
    return deepFreeze({
      schemaVersion: STORY_V2_VERSION,
      stageId: this.flow.stageId,
      chapterId: stage.chapterId,
      flowId: this.flow.id,
      beat: activeBeat,
      beatIndex: this.beatIndex,
      beatCount: this.flow.beats.length,
      completed: this.completed,
      resumeToken,
      evidence: this.evidence,
    });
  }

  public dispatch(action: StoryV2PresentationAction): StoryV2DispatchResult {
    if (action !== "continue") {
      throw new Error(
        `Unsupported Story presentation action: ${String(action)}`,
      );
    }
    if (this.completed) {
      return deepFreeze({ snapshot: this.snapshot(), completion: null });
    }
    if (this.beatIndex < this.flow.beats.length - 1) {
      this.beatIndex += 1;
      return deepFreeze({ snapshot: this.snapshot(), completion: null });
    }
    this.completed = true;
    return deepFreeze({
      snapshot: this.snapshot(),
      completion: this.flow.completion,
    });
  }

  private validateResumeToken(
    stageId: StoryV2StageId,
    token: StoryV2ResumeToken,
  ): number {
    if (
      token.schemaVersion !== STORY_V2_VERSION ||
      token.stageId !== stageId ||
      token.flowId !== this.flow.id
    ) {
      throw new Error(
        "Story presentation resume token identity does not match.",
      );
    }
    const beatIndex = this.flow.beats.findIndex(
      (candidate) => candidate.id === token.beatId,
    );
    if (beatIndex < 0) {
      throw new Error(
        `Story presentation resume beat is not in ${this.flow.id}.`,
      );
    }
    return beatIndex;
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
