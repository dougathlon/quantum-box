import { expect, it } from "vitest";
import { ARCADE_INSTRUCTIONS } from "../../src/ui/ArcadeInstructions";
import { readingPages } from "../../src/display/ReadingPages";

it("fits each complete Arcade instruction page above the play controls", () => {
  for (const [id, paragraphs] of Object.entries(ARCADE_INSTRUCTIONS)) {
    const wrapped = readingPages(paragraphs, 282, 10000)[0]!;
    const height =
      wrapped.reduce((sum, text) => sum + text.split("\n").length * 10, 0) +
      (wrapped.length - 1) * 6;
    expect(height, id).toBeLessThanOrEqual(86);
    expect(paragraphs.join(" ")).not.toMatch(/OBJECT|CONDITION|PLACEHOLDER/);
  }
});
