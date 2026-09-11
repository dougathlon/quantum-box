import type { StoryTerminalPage } from "../story/terminal/types";
import { readingPages } from "./ReadingPages";

// Keep deliberate lists stacked; prose reflows without changing its wording.
const STACKED_BLOCKS: Readonly<Record<string, readonly number[]>> = {
  "intro-1": [2],
  "intro-2": [0, 1],
  "qong-debrief-2": [2],
  "quantman-explain-2": [2],
  "qong-intro": [1],
  "skipixl-feasible-response": [3],
  "skipixl-feasible-failure": [3],
};
export function storyReadingBlocks(page: StoryTerminalPage): readonly string[] {
  const blocks = page.body.map((block, index) =>
    STACKED_BLOCKS[page.id]?.includes(index)
      ? block
      : block.replaceAll("\n", " "),
  );
  // The concluding invitation is one thought; joining it keeps the complete
  // explanation on one screen at the established reading size.
  if (page.id === "fluxball-explain-2" && blocks.length === 7)
    return [...blocks.slice(0, -2), blocks.slice(-2).join(" ")];
  return blocks;
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
