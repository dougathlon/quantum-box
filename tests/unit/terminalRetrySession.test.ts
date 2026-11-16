import { describe, expect, it } from "vitest";
import type { StoryStageId } from "../../src/games/registry";
import { TerminalRetrySession } from "../../src/story/terminal/TerminalRetrySession";
import {
  chapterStages,
  storyTerminalPage,
} from "../../src/story/terminal/content";

function advanceToGame(
  session: TerminalRetrySession,
  cleared: StoryStageId[] = [],
) {
  const pages: string[] = [];
  for (let count = 0; count < 40; count += 1) {
    const node = session.currentNode(cleared);
    if (!node || node.kind === "game-launch") return { node, pages };
    if (!("pageId" in node)) throw new Error("Unexpected terminal node");
    pages.push(node.pageId);
    const page = storyTerminalPage(node.pageId);
    session.advance(page.actions.find(({ id }) => id !== "retry")!.id);
  }
  throw new Error("Terminal failed to reach a chapter boundary");
}

describe("chapter-local Terminal retries", () => {
  it.each([
    ["qong", "qong", "qong-intro"],
    ["skipixl", "skipixl-feasible", "skipixl-intro"],
    ["quantman", "quantman-hold", "quantman-intro"],
    ["fluxball", "fluxball-global", "fluxball-intro"],
    ["quarry", "quarry", "quarry-intro"],
  ] as const)(
    "starts %s with its Story introduction",
    (chapter, stage, intro) => {
      const session = new TerminalRetrySession(chapter, []);
      const { node, pages } = advanceToGame(session);
      expect(pages[0]).toBe(intro);
      expect(node).toMatchObject({ kind: "game-launch", stageId: stage });
    },
  );

  it.each([
    [
      "skipixl",
      "skipixl-feasible",
      "skipixl-overloaded",
      "skipixl-overloaded-intro",
    ],
    [
      "fluxball",
      "fluxball-global",
      "fluxball-individual",
      "fluxball-split-intro",
    ],
  ] as const)(
    "starts the missing second %s stage, not the first",
    (chapter, first, second, intro) => {
      const session = new TerminalRetrySession(chapter, [first]);
      const { node, pages } = advanceToGame(session, [first]);
      expect(pages[0]).toBe(intro);
      expect(node).toMatchObject({ stageId: second });
    },
  );

  it.each(["qong", "quantman"] as const)(
    "requires a second completed %s failure before Continue",
    (chapter) => {
      const stage = chapterStages(chapter)[0]!;
      const session = new TerminalRetrySession(chapter, []);
      // Merely resolving/presenting the game repeatedly is not a completed failure.
      advanceToGame(session);
      session.currentNode([]);
      session.currentNode([]);
      session.recordOutcome(stage, "lost");
      expect(() => session.advance("continue")).toThrow("not available");
      session.advance("retry");
      advanceToGame(session);
      session.recordOutcome(stage, "lost");
      session.advance("continue");
      expect(session.currentNode([])).toBeNull();
    },
  );

  it.each(["skipixl", "fluxball", "quarry"] as const)(
    "returns to the index on the first allowed %s failure Continue",
    (chapter) => {
      const session = new TerminalRetrySession(chapter, []);
      advanceToGame(session);
      session.recordOutcome(chapterStages(chapter)[0]!, "failed");
      session.advance("continue");
      expect(session.currentNode([])).toBeNull();
    },
  );

  it.each(["skipixl", "fluxball"] as const)(
    "advances after the first %s win but skips a previously won second game",
    (chapter) => {
      const [first, second] = chapterStages(chapter) as readonly [
        StoryStageId,
        StoryStageId,
      ];
      const session = new TerminalRetrySession(chapter, [second]);
      advanceToGame(session, [second]);
      session.recordOutcome(first, "won");
      expect(() => session.advance("retry")).toThrow("not available");
      const { node, pages } = advanceToGame(session, [first, second]);
      expect(node).toBeNull();
      expect(pages.length).toBeGreaterThan(2);
    },
  );

  it.each(["skipixl", "fluxball"] as const)(
    "continues into the unfinished second %s stage after winning the first",
    (chapter) => {
      const [first, second] = chapterStages(chapter) as readonly [
        StoryStageId,
        StoryStageId,
      ];
      const session = new TerminalRetrySession(chapter, []);
      advanceToGame(session);
      session.recordOutcome(first, "finished");
      const { node, pages } = advanceToGame(session, [first]);
      expect(node).toMatchObject({ stageId: second });
      expect(pages.length).toBeGreaterThan(2);
    },
  );

  it("keeps a new retry session's failures separate and rejects mismatched results", () => {
    const first = new TerminalRetrySession("qong", []);
    advanceToGame(first);
    first.recordOutcome("qong", "lost");
    const second = new TerminalRetrySession("qong", []);
    advanceToGame(second);
    expect(() => second.recordOutcome("quarry", "won")).toThrow("active stage");
    second.recordOutcome("qong", "lost");
    expect(() => second.advance("continue")).toThrow("not available");
  });
});
