import { expect, it } from "vitest";
import { ARCADE_INSTRUCTIONS } from "../../src/ui/ArcadeInstructions";
import { readingPages } from "../../src/display/ReadingPages";

it("fits each complete Arcade instruction page above the play controls", () => {
  for (const [id, paragraphs] of Object.entries(ARCADE_INSTRUCTIONS)) {
    const split = { qong: 4, skipixl: 1, quantman: 2, fluxball: 4, quarry: 2 }[
      id as keyof typeof ARCADE_INSTRUCTIONS
    ];
    const gap = id === "fluxball" || id === "quarry" ? 0.9 : 1.8;
    const available =
      (id === "fluxball" ? 57 : id === "quarry" ? 53 : 51) * 1.8;
    for (const column of [
      paragraphs.slice(0, split),
      paragraphs.slice(split),
    ]) {
      const wrapped = readingPages(column, 136, 10000)[0]!;
      const height =
        wrapped.reduce((sum, text) => sum + text.split("\n").length * 10, 0) +
        (wrapped.length - 1) * gap;
      // The final glyph occupies seven pixels of its ten-pixel line advance.
      expect(height - 3, id).toBeLessThanOrEqual(available);
    }
    expect(paragraphs.join(" ")).not.toMatch(/OBJECT|CONDITION|PLACEHOLDER/);
  }
});
