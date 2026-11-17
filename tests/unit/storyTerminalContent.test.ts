import agreed from "../fixtures/agreed-story-2026-09-11.json";
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

// Explicit user-approved corrections; the source-document fixture stays intact.
const approvedBodyOverrides: Readonly<Record<string, readonly string[]>> = {
  "intro-3": [
    "BUT IT WAS PLAY, NOT WORK, THAT TURNED MAINFRAME\nMONOLITHS INTO CONSUMER PRODUCTS.",
    "HIPPIES HACKING SPACEWAR! MADE COMPUTERS COOL.\nARCADES DEMANDING COINS MADE COMPUTERS COMMERCIAL.\nCONSOLES COMING HOME MADE COMPUTERS PART OF LIFE.",
    "THE VIDEO GAME MADE CLASSICAL COMPUTING PERSONAL.",
    "IT’S TIME FOR QUANTUM COMPUTING TO HAVE ITS MAGNAVOX ODYSSEY MOMENT.",
  ],
  "quantman-loss-later": [
    "WE CAN TRY AGAIN.",
    "OR I CAN SHOW YOU HOW THE MAZE WORKS.",
  ],
  "quantman-success": ["AMAZING"],
  "fluxball-individual-pre": [
    "NOW EACH PLAYER HAS THEIR OWN\nMOVEMENT, BALL AND SCORING RULES.",
    "WATCH YOUR SCORE:\nA GOAL CAN BENEFIT BOTH OF YOU.",
    "ACTION CHANGES BOTH PLAYERS' RULES.",
    "ONE SHARED CHANGE PER ROUND.",
    "SAME MATCH:\nTHREE 40-SECOND ROUNDS.",
  ],
};

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
      "Quantum Box agreed story text 2026-09-11 v2.docx",
    );
    expect(terminalCopyProvenance.sourceSha256).toBe(
      "40b81f5188c8ea0a8213bc2450090432b61294d34e56465613e67635b45bfd29",
    );
    expect(
      createHash("sha256")
        .update(JSON.stringify(STORY_TERMINAL_PAGES))
        .digest("hex"),
    ).toBe(terminalCopyProvenance.runtimePageCorpusSha256);
  });

  it("matches every approved screen, including punctuation, headers and choices", () => {
    expect(agreed).toHaveLength(55);
    for (const expected of agreed) {
      const actual = STORY_TERMINAL_PAGES[expected.id]!;
      expect(actual.header, expected.id).toEqual(expected.header);
      expect(actual.body, expected.id).toEqual(
        approvedBodyOverrides[expected.id] ?? expected.body,
      );
      expect(
        actual.actions.map((a) => a.label),
        expected.id,
      ).toEqual(
        expected.id === "skipixl-overloaded-failure"
          ? ["RETRY", "CONTINUE"]
          : expected.actions,
      );
    }
    expect(Object.values(STORY_TERMINAL_PAGES)).toHaveLength(agreed.length + 4);
  });
  it("routes both Fluxball outcomes through the agreed explanations", () => {
    for (const suffix of ["win", "loss"]) {
      expect(storyNode(`fluxball-global-post-${suffix}`)).toMatchObject({
        transitions: { continue: "fluxball-split-intro" },
      });
      expect(storyNode(`fluxball-individual-post-${suffix}`)).toMatchObject({
        transitions: { continue: "fluxball-explain-1" },
      });
    }
    expect(storyNode("fluxball-explain-1")).toMatchObject({
      transitions: { continue: "fluxball-explain-2" },
    });
    expect(storyNode("quantman-explain-3")).toMatchObject({
      transitions: { continue: "quantman-explain-5" },
    });
    expect(storyNode("quantman-explain-4")).toMatchObject({
      pageId: "quantman-explain-5",
      transitions: { continue: "load-fluxball" },
    });
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

it("successful outcomes continue while first Qong and Quantman failures require retry", () => {
  for (const node of Object.values(STORY_NODES)) {
    if (node.kind !== "outcome-branch") continue;
    for (const [outcome, id] of Object.entries(node.branches)) {
      const response = storyNode(id!);
      if (!("pageId" in response)) throw new Error("Expected outcome page");
      const expectedActions =
        outcome === "won"
          ? ["continue"]
          : outcome === "firstLoss"
            ? ["retry"]
            : ["retry", "continue"];
      expect(
        STORY_TERMINAL_PAGES[response.pageId]!.actions.map((a) => a.id),
      ).toEqual(expectedActions);
      expect(Object.keys(response.transitions)).toEqual(expectedActions);
      if (outcome !== "won")
        expect(response.transitions.retry).toBe(`game-${node.stageId}`);
    }
  }
});

it("gives feasible SkiPixl one result choice before its common explanation", () => {
  expect(STORY_TERMINAL_PAGES["skipixl-feasible-success"]!.body).toEqual([
    "WELL DONE.",
  ]);
  expect(STORY_TERMINAL_PAGES["skipixl-feasible-failure"]!.body).toEqual([
    "WHOOPS. WOULD YOU LIKE TO TRY AGAIN?",
  ]);
  for (const result of ["success", "failure"]) {
    expect(storyNode(`skipixl-feasible-${result}`)).toMatchObject({
      transitions: { continue: "skipixl-feasible-response" },
    });
  }
  expect(storyNode("skipixl-feasible-response")).toMatchObject({
    transitions: { continue: "skipixl-overloaded-intro" },
  });
  expect(
    STORY_TERMINAL_PAGES["skipixl-feasible-response"]!.actions.map((a) => a.id),
  ).toEqual(["continue"]);
});
