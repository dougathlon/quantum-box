import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import {
  STORY_NODES,
  STORY_OPENING_NODE_ID,
  STORY_TERMINAL_PAGES,
  branchStoryOutcome,
  storyNode,
} from "../../src/story/terminal";
import terminalCopyProvenance from "../../src/story/terminal/text-notes-provenance.json" with { type: "json" };

describe("canonical terminal Story content", () => {
  it("starts at the demonstration prompt and excludes editorial routing labels", () => {
    expect(STORY_OPENING_NODE_ID).toBe("intro-1");
    const rendered = JSON.stringify(STORY_TERMINAL_PAGES);
    for (const forbidden of [
      "INSTRUCTION",
      "AFTER FIRST FAILURE",
      "AFTER SUCCESS",
      "POST-GAME",
    ]) {
      expect(rendered.toUpperCase()).not.toContain(forbidden);
    }
  });

  it("pins the approved DOCX and exact runtime page corpus", () => {
    expect(terminalCopyProvenance.sourceFilename).toBe(
      "QUANTUM BOX text notes.docx",
    );
    expect(terminalCopyProvenance.sourceSha256).toBe(
      "a5d193623eeb1361f430db50e249180871e5752d756906ec483c7dc72a212148",
    );
    expect(
      createHash("sha256")
        .update(JSON.stringify(STORY_TERMINAL_PAGES))
        .digest("hex"),
    ).toBe(terminalCopyProvenance.runtimePageCorpusSha256);
  });

  it("preserves literal placeholders rather than inventing late-story copy", () => {
    for (const page of Object.values(STORY_TERMINAL_PAGES).filter(
      ({ chapterId }) => chapterId === "fluxball" || chapterId === "quarry",
    )) {
      if (page.id === "load-fluxball") continue;
      expect(page.body).toEqual(["PLACEHOLDER"]);
    }
  });

  it("includes the trademark glyph in canonical copy", () => {
    expect(JSON.stringify(STORY_TERMINAL_PAGES)).toContain("QRNG™");
    expect(JSON.stringify(STORY_TERMINAL_PAGES)).toContain("QTG™");
  });

  it("uses deterministic first-loss and later-loss branches", () => {
    const branch = storyNode("outcome-qong");
    if (branch.kind !== "outcome-branch") throw new Error("missing branch");
    expect(branchStoryOutcome(branch, "lost", false)).toBe("qong-loss-first");
    expect(branchStoryOutcome(branch, "lost", true)).toBe("qong-loss-later");
    expect(branchStoryOutcome(branch, "won", false)).toBe("qong-success");
  });

  it("contains only resolvable graph transitions", () => {
    for (const node of Object.values(STORY_NODES)) {
      if ("transitions" in node) {
        for (const target of Object.values(node.transitions)) {
          expect(STORY_NODES[target]).toBeDefined();
        }
      }
      if (node.kind === "game-launch") {
        expect(STORY_NODES[node.outcomeNodeId]?.kind).toBe("outcome-branch");
      }
    }
  });
});
