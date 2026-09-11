import type { StoryChapterId, StoryStageId } from "../../games/registry";

export type StoryTerminalActionId = "continue" | "play" | "retry";
export type StoryOutcome = "won" | "lost" | "finished" | "failed";

export interface StoryTerminalPage {
  readonly id: string;
  readonly chapterId: StoryChapterId | "intro";
  readonly header: readonly string[];
  readonly body: readonly string[];
  readonly actions: readonly Readonly<{
    id: StoryTerminalActionId;
    label: "CONTINUE" | "PLAY" | "RETRY" | "FINISH";
  }>[];
}

export type StoryNode =
  | Readonly<{
      id: string;
      kind: "terminal-page" | "loading-transition" | "placeholder";
      pageId: string;
      transitions: Readonly<Partial<Record<StoryTerminalActionId, string>>>;
    }>
  | Readonly<{
      id: string;
      kind: "game-launch";
      stageId: StoryStageId;
      outcomeNodeId: string;
    }>
  | Readonly<{
      id: string;
      kind: "outcome-branch";
      stageId: StoryStageId;
      branches: Readonly<{
        won: string;
        lost: string;
        firstLoss?: string;
      }>;
    }>
  | Readonly<{
      id: string;
      kind: "completion";
    }>;

export interface StoryTerminalView {
  readonly nodeId: string;
  readonly page: StoryTerminalPage;
  readonly transcript: boolean;
  readonly transcriptPosition?: Readonly<{
    index: number;
    count: number;
  }>;
}
