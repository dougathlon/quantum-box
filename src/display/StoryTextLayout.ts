import type { StoryTerminalPage } from "../story/terminal/types";
import { readingPages } from "./ReadingPages";

// Reviewed prose wraps from the original narrow display. Paragraph boundaries
// remain intact; omitted blocks keep their deliberate stacked presentation.
const SOFT_BREAK_BLOCKS: Readonly<Record<string, readonly number[]>> = {
  "intro-1": [1],
  "intro-2": [0, 2],
  "intro-3": [0, 1],
  "qong-intro": [0, 1, 2, 3],
  "qong-tutorial": [0, 1, 2, 5, 6],
  "qong-loss-first": [1, 2, 4],
  "qong-debrief-1": [0, 2, 3],
  "qong-debrief-2": [1, 3],
  "skipixl-intro": [0, 2, 3],
  "skipixl-feasible-tutorial": [0, 2, 3],
  "skipixl-feasible-response": [1, 2, 3],
  "skipixl-overloaded-intro": [1],
  "skipixl-overloaded-tutorial": [3, 4],
  "skipixl-overloaded-failure": [1],
  "skipixl-debrief-1": [0, 1, 2],
  "skipixl-debrief-2": [0, 1],
  "quantman-intro": [0, 1, 2],
  "quantman-tutorial": [2, 3, 4],
  "quantman-loss-first": [1, 2],
  "quantman-success": [1],
  "quantman-explain-1": [0, 1, 2, 4],
  "quantman-explain-2": [0, 1, 2, 3, 4],
  "quantman-explain-3": [0, 1, 2],
  "quantman-explain-4": [0, 4],
  "quantman-explain-5": [0, 1, 2, 5],
};
export function storyReadingBlocks(page: StoryTerminalPage): readonly string[] {
  return page.body.map((block, index) =>
    SOFT_BREAK_BLOCKS[page.id]?.includes(index)
      ? block.replaceAll("\n", " ")
      : block,
  );
}
export function storyBodyTop(header: readonly string[]): number {
  return (
    5 +
    header.reduce((count, line) => count + line.split("\n").length, 0) * 6 +
    10
  );
}
export function storyTextLayout(page: StoryTerminalPage) {
  const body = readingPages(storyReadingBlocks(page), 282, 10000)[0]!;
  const lineHeight = body.reduce(
    (sum, block) => sum + block.split("\n").length * 10,
    0,
  );
  const available =
    147 - storyBodyTop(page.header) - Math.max(0, page.actions.length - 1) * 14;
  const gap =
    [8, 6, 4].find(
      (gap) => lineHeight + Math.max(0, body.length - 1) * gap <= available,
    ) ?? 4;
  return {
    body,
    gap,
    height: lineHeight + Math.max(0, body.length - 1) * gap,
    available,
  };
}
