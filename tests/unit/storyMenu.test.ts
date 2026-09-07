import { describe, expect, it } from "vitest";

import { storySelectionForChapter } from "../../src/ui/QuantumBoxShell";
import { createDefaultSave, type QuantumBoxSave } from "../../src/save/types";

describe("Story menu availability", () => {
  it("opens only the current cabinet in a fresh save", () => {
    const save = createDefaultSave();

    expect(storySelectionForChapter("qong", save)).toEqual({
      locked: false,
      replay: false,
      stage: "qong",
    });
    for (const chapterId of [
      "skipixl",
      "fluxball",
      "quantman",
      "quarry",
    ] as const) {
      expect(storySelectionForChapter(chapterId, save)).toEqual({
        locked: true,
        replay: false,
        stage: null,
      });
    }
  });

  it("keeps completed cabinets unlocked while prioritizing the current Fluxball tier", () => {
    const save = progressedSave({
      currentStage: "fluxball-four",
      completedStages: ["qong", "skipixl-medium", "skipixl", "fluxball-two"],
    });

    expect(storySelectionForChapter("qong", save)).toEqual({
      locked: false,
      replay: true,
      stage: "qong",
    });
    expect(storySelectionForChapter("skipixl", save)).toEqual({
      locked: false,
      replay: true,
      stage: "skipixl",
    });
    expect(storySelectionForChapter("fluxball", save)).toEqual({
      locked: false,
      replay: false,
      stage: "fluxball-four",
    });
    expect(storySelectionForChapter("quantman", save).locked).toBe(true);
    expect(storySelectionForChapter("quarry", save).locked).toBe(true);
  });

  it("replays the final completed tier for every recovered cabinet", () => {
    const save = progressedSave({
      currentStage: "complete",
      completedStages: [
        "qong",
        "skipixl-medium",
        "skipixl",
        "fluxball-two",
        "fluxball-four",
        "quantman-stabilize",
        "quantman",
        "quarry",
      ],
    });

    expect(storySelectionForChapter("qong", save).replay).toBe(true);
    expect(storySelectionForChapter("skipixl", save).replay).toBe(true);
    expect(storySelectionForChapter("fluxball", save)).toEqual({
      locked: false,
      replay: true,
      stage: "fluxball-four",
    });
    expect(storySelectionForChapter("quantman", save)).toEqual({
      locked: false,
      replay: true,
      stage: "quantman",
    });
    expect(storySelectionForChapter("quarry", save)).toEqual({
      locked: false,
      replay: true,
      stage: "quarry",
    });
  });
});

function progressedSave(
  story: Pick<QuantumBoxSave["story"], "currentStage" | "completedStages">,
): QuantumBoxSave {
  const save = createDefaultSave();
  return {
    ...save,
    story: {
      ...save.story,
      ...story,
    },
  };
}
