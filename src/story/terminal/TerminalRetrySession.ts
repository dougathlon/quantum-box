import type { StoryChapterId, StoryStageId } from "../../games/registry";
import {
  branchStoryOutcome,
  chapterStages,
  earliestUnclearedStage,
  storyNode,
  storyStageIntroNodeId,
  storyTerminalPage,
} from "./content";
import type { StoryNode, StoryOutcome, StoryTerminalActionId } from "./types";

/** A chapter-local replay cursor. Only validated game results are persisted by the app. */
export class TerminalRetrySession {
  private nodeId: string | null;
  private readonly failedStages = new Set<StoryStageId>();
  private failureResponse = false;

  public constructor(
    public readonly chapterId: StoryChapterId,
    clearedStages: readonly StoryStageId[],
  ) {
    const stage = earliestUnclearedStage(chapterId, clearedStages);
    this.nodeId = stage === null ? null : storyStageIntroNodeId(stage);
  }

  public currentNode(clearedStages: readonly StoryStageId[]): StoryNode | null {
    while (this.nodeId !== null) {
      const node = storyNode(this.nodeId);
      if (node.kind === "completion") break;
      if ("pageId" in node) {
        if (storyTerminalPage(node.pageId).chapterId !== this.chapterId) break;
        return node;
      }
      if (node.kind === "game-launch") {
        if (!chapterStages(this.chapterId).includes(node.stageId)) break;
        if (!clearedStages.includes(node.stageId)) return node;
        const branch = storyNode(node.outcomeNodeId);
        if (branch.kind !== "outcome-branch")
          throw new Error("Terminal replay has an invalid outcome branch.");
        this.nodeId = branch.branches.won;
        continue;
      }
      throw new Error("Terminal replay reached an unresolved outcome.");
    }
    this.nodeId = null;
    return null;
  }

  public advance(action: StoryTerminalActionId): void {
    if (this.nodeId === null) return;
    const node = storyNode(this.nodeId);
    if (!("pageId" in node))
      throw new Error("Terminal replay is not displaying a Story page.");
    const page = storyTerminalPage(node.pageId);
    const target = node.transitions[action];
    if (!target || !page.actions.some((candidate) => candidate.id === action))
      throw new Error(
        `Terminal action ${action} is not available on ${node.id}.`,
      );
    this.nodeId = this.failureResponse && action === "continue" ? null : target;
    this.failureResponse = false;
  }

  public recordOutcome(stage: StoryStageId, outcome: StoryOutcome): void {
    const launch = this.nodeId === null ? null : storyNode(this.nodeId);
    if (launch?.kind !== "game-launch" || launch.stageId !== stage)
      throw new Error("Terminal outcome does not match its active stage.");
    const branch = storyNode(launch.outcomeNodeId);
    if (branch.kind !== "outcome-branch" || branch.stageId !== stage)
      throw new Error("Terminal replay has an invalid outcome branch.");
    this.nodeId = branchStoryOutcome(
      branch,
      outcome,
      this.failedStages.has(stage),
    );
    this.failureResponse = outcome === "lost" || outcome === "failed";
    if (this.failureResponse) this.failedStages.add(stage);
  }
}
