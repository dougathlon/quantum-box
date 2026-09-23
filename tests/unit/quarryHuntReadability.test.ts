import { expect, it } from "vitest";
import { quagHuntRows } from "../../src/games/quag/presentation";
import type { QuagSnapshot } from "../../src/games/quag/types";
it("separates a solo human's prey from predators, including mutual hunts", () => {
  const snapshot = {
    humanPlayerIds: ["B"],
    directedRelations: ["B>A", "B>C", "A>B", "D>B", "C>D"],
  } as unknown as QuagSnapshot;
  expect(quagHuntRows(snapshot)).toEqual(["YOU HUNT A+C", "HUNTS YOU A+D"]);
  expect(quagHuntRows({ ...snapshot, directedRelations: [] })).toEqual([
    "YOU HUNT NONE",
    "HUNTS YOU NONE",
  ]);
});
it("retains all four hunt rows for multiple humans", () => {
  const snapshot = {
    humanPlayerIds: ["A", "B"],
    directedRelations: ["B>A", "A>D"],
  } as unknown as QuagSnapshot;
  expect(quagHuntRows(snapshot)).toEqual([
    "A HUNTS D",
    "B HUNTS A",
    "C HUNTS NONE",
    "D HUNTS NONE",
  ]);
});
