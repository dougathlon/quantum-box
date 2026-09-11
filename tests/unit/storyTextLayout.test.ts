import { it, expect } from "vitest";
import { STORY_TERMINAL_PAGES } from "../../src/story/terminal/content";
import { storyTextLayout } from "../../src/display/StoryTextLayout";
it("preserves authored paragraphs and fits each original Story page", () => {
  for (const page of Object.values(STORY_TERMINAL_PAGES)) {
    const layout = storyTextLayout(page);
    expect(layout.body.join(" ").replace(/\s+/g, " ")).toBe(
      page.body.join(" ").replace(/\s+/g, " "),
    );
    expect(storyTextLayout({ ...page, body: layout.body }).height).toBe(
      layout.height,
    );
    expect(
      layout.height,
      `${page.id}: ${layout.height}/${layout.available}`,
    ).toBeLessThanOrEqual(layout.available);
  }
});

it("keeps the three requested single line breaks", () => {
  for (const [id, before, after] of [
    ["intro-2", "I KNOW WHAT YOU’RE THINKING:", "QUANTUM COMPUTERS"],
    ["qong-debrief-2", "BUT THIS IS TRUE RANDOMNESS!", "QRNG"],
    [
      "quantman-explain-2",
      "MATCHING NEIGHBOURS = PASSAGE.",
      "DIFFERENT NEIGHBOURS = WALL.",
    ],
  ]) {
    expect(
      storyTextLayout(STORY_TERMINAL_PAGES[id!]!).body.join("\n\n"),
    ).toContain(before + "\n" + after);
  }
});
