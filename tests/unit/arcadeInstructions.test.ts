import { expect, it } from "vitest";
import { ARCADE_INSTRUCTIONS } from "../../src/ui/ArcadeInstructions";
import { arcadeInstructionLayout } from "../../src/ui/ArcadeMenuLayout";
import type { ShippedArcadeCabinetId } from "../../src/games/registry";

const words = (text: string) => text.split(/\s+/).filter(Boolean).sort();
it.each(Object.keys(ARCADE_INSTRUCTIONS) as ShippedArcadeCabinetId[])(
  "%s A composition preserves every approved word and fits all rules above play",
  (id) => {
    const { blocks, divider } = arcadeInstructionLayout(id);
    expect(words(blocks.map((block) => block.text).join(" "))).toEqual(
      words(ARCADE_INSTRUCTIONS[id].join(" ")),
    );
    expect(blocks.some((block) => block.y > divider)).toBe(true);
    for (const block of blocks) {
      expect(block.x).toBeGreaterThanOrEqual(66);
      expect(block.x + block.width).toBeLessThanOrEqual(1210);
      expect(block.y + block.height).toBeLessThan(546);
      expect(block.y + block.height <= divider || block.y > divider).toBe(true);
      for (const other of blocks.filter((other) => other !== block)) {
        expect(
          block.x + block.width <= other.x ||
            block.x >= other.x + other.width ||
            block.y + block.height <= other.y ||
            block.y >= other.y + other.height,
        ).toBe(true);
      }
    }
  },
);
