import { it, expect } from "vitest";
import { STORY_TERMINAL_PAGES } from "../../src/story/terminal/content";
import { storyTextLayout } from "../../src/display/StoryTextLayout";
it("preserves authored paragraphs and fits each original Story page", () => {
  for (const page of Object.values(STORY_TERMINAL_PAGES)) {
    const layout = storyTextLayout(page);
    expect(layout.body).toHaveLength(page.body.length);
    layout.body.forEach((block, i) =>
      expect(block.replace(/\s+/g, " ")).toBe(
        page.body[i]!.replace(/\s+/g, " "),
      ),
    );
    expect(
      layout.height,
      `${page.id}: ${layout.height}/${layout.available}`,
    ).toBeLessThanOrEqual(layout.available);
  }
});
