import { describe, expect, it } from "vitest";

import { STORY_BRIEFS } from "../../src/story/storyContent";

describe("Story content taxonomy", () => {
  it("names the rule-level escalation without overstating installed sources", () => {
    expect(
      Object.fromEntries(
        Object.entries(STORY_BRIEFS).map(
          ([stage, { ruleLevel, installedSource }]) => [
            stage,
            { ruleLevel, installedSource },
          ],
        ),
      ),
    ).toEqual({
      qong: {
        ruleLevel: "GLOBAL BINARY",
        installedSource: "AUTHENTIC MOTH QPU BANK · 4 × 7 RALLIES INSTALLED",
      },
      skipixl: {
        ruleLevel: "QPIXL RESIDUAL COURSE",
        installedSource: "PRE-ACQUIRED IBM FEZ QPIXL PACK",
      },
      "skipixl-medium": {
        ruleLevel: "QPIXL RESIDUAL COURSE · MEDIUM",
        installedSource: "PRE-ACQUIRED IBM FEZ QPIXL PACK",
      },
      "fluxball-two": {
        ruleLevel: "RELATIONAL GLOBAL",
        installedSource: "OFFLINE QGRAPH QPU BANK · PLAYABLE FALLBACKS",
      },
      "fluxball-four": {
        ruleLevel: "RELATIONAL INDIVIDUAL",
        installedSource: "OFFLINE QGRAPH QPU BANK · PLAYABLE FALLBACKS",
      },
      quantman: {
        ruleLevel: "RECORDED LABYRINTH FIELD · INVERSE GAZE",
        installedSource: "MOTH / IBM FEZ 10 × 10 / 100-BIT RETURN",
      },
      "quantman-stabilize": {
        ruleLevel: "RECORDED LABYRINTH FIELD · STABILIZE GAZE",
        installedSource: "MOTH / IBM FEZ 10 × 10 / 100-BIT RETURN",
      },
      quarry: {
        ruleLevel: "RECORDED QGRAPH RELATION FIELD",
        installedSource: "24 MOTH / IBM FEZ QGRAPH RETURNS",
      },
    });
  });
});
