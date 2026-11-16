import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRunContext } from "../../src/core/run";
import { wrapBitmapText } from "../../src/display/BitmapDomText";
import { terminalTextWidth } from "../../src/display/TerminalTypeface";
import { pixelTextWidth } from "../../src/display/PixelText";
import { FluxballSession } from "../../src/games/fluxball/FluxballSession";
import { FLUXBALL_PLAYABLE_RULE_BANK } from "../../src/games/fluxball/fluxballControlPacks";
import { FLUXBALL_RULES_VERSION } from "../../src/games/fluxball/types";
import { STORY_CHAPTER_IDS } from "../../src/games/registry";
import { createDefaultSave, type QuantumBoxSave } from "../../src/save/types";
import {
  chapterStages,
  STORY_TERMINAL_PAGES,
  type StoryTerminalView,
} from "../../src/story/terminal";
import {
  QuantumBoxShell,
  type ArcadeScoreboardRequest,
  type ShellPage,
} from "../../src/ui/QuantumBoxShell";

afterEach(() => vi.unstubAllGlobals());

describe("reviewed shell states", () => {
  it.each(STORY_CHAPTER_IDS)(
    "offers only READ for fully cleared %s even without a read ledger",
    (chapterId) => {
      const base = createDefaultSave();
      const markup = renderPage("terminal", {
        ...base,
        story: { ...base.story, clearedStages: chapterStages(chapterId) },
      });
      const row = chapterRow(markup, chapterId);
      expect(row).toContain('data-action="open-terminal-transcript"');
      expect(row).toContain("<small>READ</small>");
      expect(row).not.toContain("RETRY");
    },
  );

  it("offers only RETRY for an encountered incomplete chapter despite read history", () => {
    const base = createDefaultSave();
    const markup = renderPage("terminal", {
      ...base,
      story: {
        ...base.story,
        experiencedStages: ["skipixl-feasible"],
        clearedStages: ["skipixl-feasible"],
        readPageIds: ["skipixl-intro"],
      },
    });
    const row = chapterRow(markup, "skipixl");
    expect(row).toContain('data-action="retry-terminal-chapter"');
    expect(row).toContain("<small>RETRY</small>");
    expect(row).not.toContain("READ");
  });

  it("recognizes a read introduction and partial clear as encounters", () => {
    const base = createDefaultSave();
    for (const evidence of [
      { readPageIds: ["skipixl-intro"] },
      { clearedStages: ["skipixl-feasible" as const] },
    ]) {
      const markup = renderPage("terminal", {
        ...base,
        story: { ...base.story, ...evidence },
      });
      expect(chapterRow(markup, "skipixl")).toContain("<small>RETRY</small>");
    }
  });

  it("leaves untouched chapters unopened without a retry or transcript action", () => {
    const markup = renderPage("terminal");
    expect(markup.match(/<small>UNOPENED<\/small>/g)).toHaveLength(5);
    expect(markup).not.toContain("data-chapter-id");
  });

  it("renders MOTH with the same leading prompt and cursor structure as FINISH", () => {
    const markup = renderPage("story-terminal", createDefaultSave(), {
      terminalView: {
        nodeId: "postscript-2",
        page: STORY_TERMINAL_PAGES["postscript-2"]!,
        transcript: false,
      },
    });
    expect(markup).toContain("&gt; MOTH</span>");
    expect(markup).toContain("&gt; FINISH</span>");
    expect(markup).not.toContain("[MOTH]");
    for (const label of ["MOTH", "FINISH"]) {
      const width = (terminalTextWidth(`> ${label}`) + 4) / 3.2;
      expect(markup).toContain(
        `style="width: ${width}cqw">&gt; ${label}</span><span class="qb-terminal-cursor"`,
      );
    }
    const source = readFileSync(
      new URL("../../src/ui/QuantumBoxShell.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      'window.open(POSTSCRIPT_MOTH_URL, "_blank", "noopener,noreferrer")',
    );
    expect(source).not.toContain("window.location.assign(POSTSCRIPT_MOTH_URL)");
  });

  it("removes the Source Record destination while retaining Data settings", () => {
    const markup = renderPage("settings");
    expect(markup).toContain("EXPORT SAVE");
    expect(markup).not.toContain("SOURCE RECORD");
    expect(markup).not.toContain('data-page="credits"');
    const source = readFileSync(
      new URL("../../src/ui/QuantumBoxShell.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain('case "credits"');
    expect(source).not.toContain('value === "credits"');
  });

  it("never types the MOTH token's authoring brackets onto the page", () => {
    const page = STORY_TERMINAL_PAGES["postscript-2"]!;
    const prefixLength = [...page.header, ...page.body.slice(0, 2)].reduce(
      (sum, line) => sum + line.length,
      0,
    );
    for (let characters = 1; characters < "[MOTH]".length; characters++) {
      const markup = renderPage("story-terminal", createDefaultSave(), {
        terminalView: { nodeId: "postscript-2", page, transcript: false },
        terminalVisibleCharacters: prefixLength + characters,
      });
      expect(markup).not.toContain("[");
      expect(markup).not.toContain("]");
      expect(markup).not.toContain('data-action="postscript-moth"');
      expect(markup).toContain("&gt; ");
    }
  });
});

describe("score title bitmap width", () => {
  for (const initialsEditable of [false, true]) {
    it.each([
      ["skipixl", "EASY", "SKIPIXL · EASY"],
      ["quantman", "HOLD", "QUANTMAN · HOLD"],
      ["quantman", "INVERT", "QUANTMAN · INVERT"],
    ] as const)(
      "keeps %s %s inline (initials entry: " + initialsEditable + ")",
      (gameId, mode, title) => {
        const markup = renderPage("scores", createDefaultSave(), {
          arcadeScoreboard: {
            gameId,
            mode,
            highlightRecordSequence: initialsEditable ? 1 : null,
            resultLabel: null,
            initialsEditable,
          },
        });
        const match = markup.match(
          /<h1[^>]+style="min-width: ([\d.]+)cqw"[^>]*>([^<]+)<\/h1>/,
        );
        expect(match?.[2]).toBe(title);
        const reservedLogicalWidth = Number(match?.[1]) * 3.2;
        // The framebuffer renderer insets two pixels and uses the reading face.
        expect(
          wrapBitmapText(title, reservedLogicalWidth - 2, 1, 1, Infinity, true),
        ).toEqual([title]);
        expect(markup).toContain(
          initialsEditable ? "qb-score-entry" : "qb-scoreboard-list",
        );
        if (initialsEditable) {
          const kicker = markup.match(
            /<p class="qb-kicker" data-bitmap-text="NEW HIGH SCORE" style="min-width: ([\d.]+)cqw">NEW HIGH SCORE<\/p>/,
          );
          expect(kicker).not.toBeNull();
          const reservedWidth = Number(kicker?.[1]) * 3.2;
          expect(reservedWidth - 2).toBeGreaterThanOrEqual(
            pixelTextWidth("NEW HIGH SCORE", 1),
          );
          expect(wrapBitmapText("NEW HIGH SCORE", reservedWidth - 2)).toEqual([
            "NEW HIGH SCORE",
          ]);
        }
      },
    );
  }
});

describe("final Fluxball shell disclosure", () => {
  it.each(["global", "individual"] as const)(
    "retains the final %s result without a separate RESULTS action",
    (ruleMode) => {
      const session = new FluxballSession(
        createRunContext({
          gameId: "fluxball",
          playMode: "arcade",
          rulesVersion: FLUXBALL_RULES_VERSION,
          runSeed: 31,
          pack: FLUXBALL_PLAYABLE_RULE_BANK,
        }),
        {
          competitorCount: 2,
          ruleMode,
          roundSeconds: 40,
          humanPlayerIds: ["A", "B"],
        },
      );
      const elements = new Map<string, ReturnType<typeof fakeElement>>();
      const shell = {
        cabinetActive: true,
        cabinetPlayMode: "arcade",
        gameUi: { dataset: { cabinet: "fluxball" } },
        fluxballUi: {
          querySelector: (selector: string) => {
            if (!elements.has(selector)) elements.set(selector, fakeElement());
            return elements.get(selector);
          },
        },
        updatePauseLabel: vi.fn(),
        updateCabinetChoices: vi.fn(),
      };
      let snapshot = session.snapshot();
      for (let round = 1; round <= 3; round++) {
        let ticks = 0;
        while (snapshot.phase === "active" && ticks++ < 801) {
          snapshot = session.step({ players: {} });
        }
        expect(snapshot.phase).toBe(round < 3 ? "reveal" : "complete");
        QuantumBoxShell.prototype.updateFluxballHud.call(
          shell as unknown as QuantumBoxShell,
          snapshot,
          false,
          "arcade",
        );
        expect(shell.updateCabinetChoices).toHaveBeenLastCalledWith(
          false,
          round === 3,
          round < 3 ? "NEXT ROUND" : undefined,
        );
        if (round < 3) snapshot = session.continueAfterReveal();
      }
      const result = elements.get("[data-fluxball='reveal']")!.innerHTML;
      expect(result).toContain("Round 3");
      if (ruleMode === "global") {
        expect(result).toContain("global rule history");
        expect(result).toContain("MOVE ");
        expect(result).toContain("BALL ");
        expect(result).toContain("GOAL ");
      } else {
        expect(result).toContain(
          "Individual rules and the joint QGraph state remain hidden",
        );
        expect(result).not.toContain("MOVE ");
      }
      expect(
        elements.get("[data-fluxball='reveal']")!.replaceChildren,
      ).not.toHaveBeenCalled();
    },
  );
});

function fakeElement() {
  return {
    textContent: "",
    innerHTML: "",
    hidden: false,
    parentElement: { toggleAttribute: vi.fn() },
    replaceChildren: vi.fn(),
  };
}

function chapterRow(markup: string, chapterId: string): string {
  return (
    markup.match(
      new RegExp(
        `<li><button[^>]*data-chapter-id="${chapterId}"[^>]*>.*?</button></li>`,
      ),
    )?.[0] ?? ""
  );
}

function renderPage(
  page: ShellPage,
  save: QuantumBoxSave = createDefaultSave(),
  overrides: {
    terminalView?: StoryTerminalView;
    terminalVisibleCharacters?: number;
    arcadeScoreboard?: ArcadeScoreboardRequest;
  } = {},
): string {
  // Exercise the production markup path without fabricating a browser layout.
  const pageRoot = {
    innerHTML: "",
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const shell = {
    page,
    save,
    pageRoot,
    controllerSetup: null,
    controllerSetupOpen: false,
    settingsSection: "data",
    settingsPlayerId: "A",
    terminalView: null,
    terminalVisibleCharacters: 1_000_000,
    arcadeRunSeed: 1,
    storyUnavailableMessage: null,
    arcadeScoreboard: null,
    selectedArcadeCabinet: null,
    arcadeInitialsDraft: ["A", "A", "A"],
    terminalSheetIndex: 0,
    terminalSheets: [],
    scrollPositionObserver: { disconnect: vi.fn(), observe: vi.fn() },
    shell: { dataset: {} },
    root: { querySelector: () => ({ textContent: "" }) },
    screenHeader: { hidden: false },
    screenFooter: { hidden: false, querySelector: () => ({ hidden: false }) },
    syncFullscreenState: vi.fn(),
    updateScrollPosition: vi.fn(),
    ...overrides,
  };
  vi.stubGlobal("window", { requestAnimationFrame: vi.fn(() => 1) });
  const prototype = QuantumBoxShell.prototype as unknown as {
    renderPage(this: typeof shell): void;
  };
  prototype.renderPage.call(shell);
  return pageRoot.innerHTML;
}
