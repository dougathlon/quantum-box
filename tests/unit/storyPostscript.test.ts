import { expect, it } from "vitest";
import { POSTSCRIPT_MOTH_URL } from "../../src/story/terminal/postscript";
import { SaveRepository } from "../../src/save/SaveRepository";
import {
  STORY_NODES,
  STORY_TERMINAL_PAGES,
} from "../../src/story/terminal/content";

it("END DEMO always leads through both Postscript pages without inventing a clear", () => {
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
    "postscript-1",
  );
  expect(repo.advanceStoryTerminal("continue").story.currentNodeId).toBe(
    "postscript-2",
  );
  expect(repo.advanceStoryTerminal("continue").story.currentNodeId).toBe(
    "story-complete",
  );
  expect(repo.snapshot().story.storyCompleted).toBe(true);
  expect(repo.snapshot().story.readPageIds).toEqual([
    "ending-4",
    "postscript-1",
    "postscript-2",
  ]);
  expect(repo.snapshot().story.clearedStages).toEqual([]);
  expect(repo.snapshot().story.qualifiedRuns).toEqual({});
});
it("preserves the requested text and closes on FINISH", () => {
  expect(STORY_TERMINAL_PAGES["postscript-1"]!.body).toEqual([
    "IF YOU'RE READING THIS,\nYOU REACHED THE END OF THE DEMO.",
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
