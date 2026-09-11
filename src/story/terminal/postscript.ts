import { STORY_SEQUENCE, type StoryStageId } from "../../games/registry";

/** All required stages must have recorded clears; reaching END DEMO is not a win. */
export function postscriptUnlocked(
  clearedStages: readonly StoryStageId[],
): boolean {
  return STORY_SEQUENCE.every((stage) => clearedStages.includes(stage));
}

export function gatedStoryNode(
  nodeId: string,
  clearedStages: readonly StoryStageId[],
): string {
  return nodeId.startsWith("postscript-") && !postscriptUnlocked(clearedStages)
    ? "story-complete"
    : nodeId;
}

export const POSTSCRIPT_MOTH_URL = "https://mothquantum.com/";
