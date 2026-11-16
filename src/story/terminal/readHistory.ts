import type { StoryChapterId } from "../../games/registry";
import {
  STORY_NODES,
  STORY_OPENING_NODE_ID,
  STORY_TERMINAL_PAGES,
} from "./content";

/** Retain the order actually read, including only the encountered outcome branches. */
export function readTranscriptPageIds(
  chapterId: StoryChapterId,
  readPageIds: readonly string[],
): readonly string[] {
  return readPageIds.filter((id) => {
    const page = STORY_TERMINAL_PAGES[id];
    return (
      page?.chapterId === chapterId ||
      (chapterId === "qong" && page?.chapterId === "intro")
    );
  });
}

/** Old saves have a cursor, not a page ledger. Recover only unavoidable prior pages. */
export function inferLegacyReadPageIds(
  currentNodeId: string,
): readonly string[] {
  if (!Object.hasOwn(STORY_NODES, currentNodeId)) return [];
  // This persisted alias renders the same page as the canonical node.
  if (currentNodeId === "quantman-explain-4")
    currentNodeId = "quantman-explain-5";
  const reachesCursor = (excluded: string | null): boolean => {
    const pending = [STORY_OPENING_NODE_ID];
    const visited = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (id === excluded || visited.has(id)) continue;
      if (id === currentNodeId) return true;
      visited.add(id);
      const node = STORY_NODES[id];
      if (!node) continue;
      if ("transitions" in node)
        pending.push(
          ...Object.values(node.transitions).filter(
            (id): id is string => id !== undefined,
          ),
        );
      if (node.kind === "game-launch") pending.push(node.outcomeNodeId);
      if (node.kind === "outcome-branch")
        pending.push(
          ...Object.values(node.branches).filter(
            (id): id is string => id !== undefined,
          ),
        );
      // The published predecessor could complete without either Postscript page.
      if (id === "ending-4") pending.push("story-complete");
    }
    return false;
  };
  if (!reachesCursor(null)) return [];
  const mandatoryPageIds = new Set(
    Object.values(STORY_NODES)
      .filter(
        (node) =>
          node.id !== currentNodeId &&
          "pageId" in node &&
          !reachesCursor(node.id),
      )
      .map((node) => ("pageId" in node ? node.pageId : "")),
  );
  // Graph declarations need not follow reading order (Fluxball's split intro
  // is declared after its outcomes). The page corpus follows the authored order.
  return Object.keys(STORY_TERMINAL_PAGES).filter((id) =>
    mandatoryPageIds.has(id),
  );
}
