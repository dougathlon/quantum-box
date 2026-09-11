import { expect, it } from "vitest";
import { STORY_SEQUENCE } from "../../src/games/registry";
import {
  gatedStoryNode,
  postscriptUnlocked,
  POSTSCRIPT_MOTH_URL,
} from "../../src/story/terminal/postscript";
import { SaveRepository } from "../../src/save/SaveRepository";
import {
  STORY_NODES,
  STORY_TERMINAL_PAGES,
} from "../../src/story/terminal/content";

it("requires every recorded clear, even when all other games were beaten", () => {
  expect(postscriptUnlocked(STORY_SEQUENCE)).toBe(true);
  for (const stage of STORY_SEQUENCE) {
    const partial = STORY_SEQUENCE.filter((s) => s !== stage);
    expect(postscriptUnlocked(partial), stage).toBe(false);
    expect(gatedStoryNode("postscript-1", partial)).toBe("story-complete");
    expect(gatedStoryNode("postscript-2", partial)).toBe("story-complete");
  }
  expect(gatedStoryNode("postscript-1", STORY_SEQUENCE)).toBe("postscript-1");
  expect(gatedStoryNode("postscript-2", STORY_SEQUENCE)).toBe("postscript-2");
});
it("END DEMO reached by continuing cannot unlock the postscript", () => {
  const repo = new SaveRepository(
    {
      length: 0,
      clear: () => {},
      key: () => null,
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    () => undefined,
  );
  repo.setStoryNode("ending-4");
  expect(repo.advanceStoryTerminal("continue").story.currentNodeId).toBe(
    "story-complete",
  );
  expect(repo.setStoryNode("postscript-2").story.currentNodeId).toBe(
    "story-complete",
  );
});
it("preserves the requested text and closes on FINISH", () => {
  expect(STORY_TERMINAL_PAGES["postscript-1"]!.body).toEqual([
    "IF YOU'RE READING THIS,\nYOU BEAT THE DEMO.",
    "WELL DONE.",
    "UNFORTUNATELY,\nTHAT'S ALL THIS EVER WAS.",
    "PERHAPS IT WAS UNTIMELY.\nPERHAPS IT WAS RUBBISH.",
    "BOTH CAN BE TRUE.",
    ";)",
  ]);
  expect(STORY_TERMINAL_PAGES["postscript-2"]!.body).toEqual([
    "I'VE STORED ALL MY ENGINES HERE.",
    "I HOPE THE LINK STILL WORKS.",
    "[MOTH]",
    "IF YOU FIND A BETTER GAME\nIN ALL THIS,\nI'D LIKE TO PLAY IT.",
  ]);
  expect(STORY_TERMINAL_PAGES["postscript-2"]!.actions).toEqual([
    { id: "continue", label: "FINISH" },
  ]);
  expect(STORY_NODES["postscript-2"]).toMatchObject({
    transitions: { continue: "story-complete" },
  });
  expect(POSTSCRIPT_MOTH_URL).toBe("https://mothquantum.com/");
});
