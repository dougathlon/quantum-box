import { QUANTUM_BOX_ASSETS } from "../../../src/assets/manifest";
import {
  terminalGlyphRects,
  terminalTextWidth,
} from "../../../src/display/TerminalTypeface";
import {
  bitmapTextLineLeft,
  scaledReadingGlyphRects,
  wrapBitmapText,
  type BitmapDomTextRenderer,
} from "../../../src/display/BitmapDomText";
import {
  createDefaultSave,
  type QuantumBoxSave,
} from "../../../src/save/types";
import type {
  QuantmanArcadeRecord,
  SkiPixlArcadeRecord,
} from "../../../src/save/ArcadeRecords";
import { STORY_TERMINAL_PAGES } from "../../../src/story/terminal";
import { POSTSCRIPT_MOTH_URL } from "../../../src/story/terminal/postscript";
import {
  QuantumBoxShell,
  type QuantumBoxShellActions,
} from "../../../src/ui/QuantumBoxShell";

type Example =
  | `menu-${"qong" | "skipixl" | "quantman" | "fluxball" | "quarry"}`
  | "fluxball-players"
  | "hold-list"
  | "hold-entry"
  | "invert-list"
  | "invert-entry"
  | "ski-list"
  | "ski-entry"
  | "moth"
  | "settings";
interface FixtureApi {
  show(example: Example): Promise<void>;
  check(example: Example): Promise<string>;
}
declare global {
  interface Window {
    __SHELL_CORRECTIONS__?: FixtureApi;
  }
}
const examples: readonly Example[] = [
  "menu-qong",
  "menu-skipixl",
  "menu-quantman",
  "menu-fluxball",
  "menu-quarry",
  "fluxball-players",
  "hold-list",
  "hold-entry",
  "invert-list",
  "invert-entry",
  "ski-list",
  "ski-entry",
  "moth",
  "settings",
];
const dimensions = [
  [1280, 720],
  [1920, 1080],
  [1024, 768],
  [1031, 988],
  [1032, 989],
  [1031, 989],
] as const;

function seededSave(): QuantumBoxSave {
  const base = createDefaultSave();
  const identity = {
    runId: "synthetic-shell-review-only",
    initials: "QA1",
    rulesVersion: "fixture-only",
    recordedSequence: 1,
    pack: {
      packId: "synthetic-shell-review-only",
      contentSha256: "0".repeat(64),
      schemaVersion: "fixture-only",
      source: "synthetic UI fixture; not a gameplay or QPU result",
    },
  };
  const quantman = (
    mechanic: QuantmanArcadeRecord["mechanic"],
  ): QuantmanArcadeRecord => ({
    ...identity,
    kind: "quantman",
    mechanic,
    topologyId: "fixture-only",
    topologyLabel: "FIXTURE",
    authoredTopologySha256: "0".repeat(64),
    score: 2030,
    outcome: "lost",
    remainingLives: 0,
    activeTicks: 400,
  });
  const ski: SkiPixlArcadeRecord = {
    ...identity,
    kind: "skipixl",
    difficulty: "medium",
    officialTimeMs: 38670,
    missedGates: 0,
    collisions: 0,
  };
  return {
    ...base,
    settings: { ...base.settings, reducedMotion: true, soundMuted: true },
    arcadeRecords: {
      ...base.arcadeRecords,
      nextSequence: 2,
      skipixl: { ...base.arcadeRecords.skipixl, medium: [ski] },
      quantman: {
        "stabilize-gaze": { fixture: [quantman("stabilize-gaze")] },
        "inverse-gaze": { fixture: [quantman("inverse-gaze")] },
      },
    },
  };
}

async function bootChild(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const liveLink = params.get("liveLink") === "1";
  document.documentElement.classList.add("fixture-child");
  required(document, "#fixture-controls").remove();
  required(document, "iframe").remove();
  required(document, "#fixture-results").remove();
  await import("../../../src/styles.css");
  await import("../../../src/display/brownBox.css");
  const root = required<HTMLElement>(document, "#app");
  root.hidden = false;
  const opened: Array<{
    url: string;
    target: string | undefined;
    features: string | undefined;
  }> = [];
  // Only this explicit review URL permits a human click to open the real link.
  // Automated parent checks always use the default intercepted child URL.
  if (!liveLink) {
    window.open = (url, target, features) => {
      opened.push({ url: String(url), target, features });
      document.body.dataset["mothOpen"] = JSON.stringify(opened.at(-1));
      return null;
    };
  }
  document.body.dataset["linkMode"] = liveLink ? "live" : "intercepted";
  const noop = () => {};
  const actions: QuantumBoxShellActions = {
    onStartGesture: noop,
    onInternalEntered: noop,
    onTitleReturned: noop,
    onPageChanged: noop,
    onContinueStory: noop,
    onNewStory: noop,
    onStoryTerminalAction: noop,
    onStoryPageRead: noop,
    onOpenTerminalTranscript: noop,
    onRetryTerminalChapter: noop,
    onLaunchArcade: noop,
    onSettingChanged: noop,
    onArcadeScoreInitialsSubmitted: noop,
    onExportSave: noop,
    onResetSave: noop,
    onCabinetAction: noop,
    onFluxballLobbyAction: noop,
  };
  const shell = new QuantumBoxShell(
    root,
    QUANTUM_BOX_ASSETS.display,
    seededSave(),
    actions,
  );
  const controlled = shell as unknown as { bitmapText: BitmapDomTextRenderer };
  shell.enterInternal();
  async function settled(): Promise<void> {
    await frames(4);
    controlled.bitmapText.renderNow();
    await frames(2);
  }
  async function show(example: Example): Promise<void> {
    if (example.startsWith("menu-")) {
      shell.showPage("arcade");
      required<HTMLButtonElement>(
        document,
        `[data-action='open-arcade-cabinet'][data-game-id='${example.slice(5)}']`,
      ).click();
    } else if (example === "fluxball-players") {
      shell.showFluxballLobby(
        {
          competitorCount: 2,
          ruleMode: "global",
          roundSeconds: 40,
          humanPlayerIds: ["A"],
        },
        ["A"],
      );
    } else if (example === "moth") {
      shell.showStoryTerminal({
        nodeId: "postscript-2",
        page: STORY_TERMINAL_PAGES["postscript-2"]!,
        transcript: false,
      });
      await settled();
      required<HTMLElement>(
        document,
        "[data-action='postscript-moth']",
      ).focus();
    } else if (example === "settings") {
      shell.showPage("settings");
      required<HTMLButtonElement>(
        document,
        "[data-settings-section='data']",
      ).click();
    } else {
      const ski = example.startsWith("ski");
      const entry = example.endsWith("entry");
      shell.showArcadeScoreboard({
        gameId: ski ? "skipixl" : "quantman",
        mode: ski ? "MEDIUM" : example.startsWith("hold") ? "HOLD" : "INVERT",
        highlightRecordSequence: entry ? 1 : null,
        resultLabel: null,
        initialsEditable: entry,
      });
    }
    await settled();
    document.body.dataset["example"] = example;
  }
  function audit(): void {
    const host = required(document, ".qb-internal").getBoundingClientRect();
    const frame = required(
      document,
      ".qb-screen-frame",
    ).getBoundingClientRect();
    const field = required<HTMLCanvasElement>(document, ".qb-field-surface");
    const fieldRect = field.getBoundingClientRect();
    const expectedX = Math.floor((Math.round(host.width) - frame.width) / 2);
    const expectedY = Math.floor((Math.round(host.height) - frame.height) / 2);
    assert(
      frame.left - host.left === expectedX &&
        frame.top - host.top === expectedY,
      `Foreground shares the field's whole-pixel origin: expected ${expectedX},${expectedY}; got ${frame.left - host.left},${frame.top - host.top}`,
    );
    assert(
      fieldRect.left === host.left &&
        fieldRect.top === host.top &&
        field.width === Math.round(host.width) &&
        field.height === Math.round(host.height) &&
        Number(field.dataset["fieldPixelScale"]) === frame.width / 320,
      "Background canvas retains the same origin and display scale",
    );
    const canvas = required<HTMLCanvasElement>(
      document,
      "[data-ui='bitmap-text']",
    );
    for (const key of [
      "paletteAudit",
      "alphaAudit",
      "explicitTextFitAudit",
      "fractionalPlacementAudit",
      "visibleDomPaintAudit",
    ])
      assert(
        canvas.dataset[key] === "pass",
        `Bitmap ${key}: ${canvas.dataset[key]}`,
      );
  }
  function pixelsIn(rect: DOMRect): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } {
    const frame = required(
      document,
      ".qb-screen-frame",
    ).getBoundingClientRect();
    const pixels = controlled.bitmapText.readPixels();
    const x0 = Math.max(
      0,
      Math.floor(((rect.left - frame.left) * pixels.width) / frame.width),
    );
    const x1 = Math.min(
      pixels.width,
      Math.ceil(((rect.right - frame.left) * pixels.width) / frame.width),
    );
    const y0 = Math.max(
      0,
      Math.floor(((rect.top - frame.top) * pixels.height) / frame.height),
    );
    const y1 = Math.min(
      pixels.height,
      Math.ceil(((rect.bottom - frame.top) * pixels.height) / frame.height),
    );
    let left = x1,
      right = x0 - 1,
      top = y1,
      bottom = y0 - 1;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (pixels.data[(y * pixels.width + x) * 4 + 3]) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left + 1),
      height: Math.max(0, bottom - top + 1),
    };
  }
  function checkBottomAlignment(example: Example): number {
    const frame = required(
      document,
      ".qb-screen-frame",
    ).getBoundingClientRect();
    const scale = frame.width / 320;
    const selectors = example.startsWith("menu-")
      ? ".qb-arcade-detail-header h1, .qb-arcade-detail-header p, .qb-arcade-tutorial p, .qb-arcade-trials h2, .qb-arcade-mode > button, .qb-terminal-footer button, .qb-terminal-footer span"
      : example === "fluxball-players"
        ? ".qb-fluxball-lobby h1, .qb-fluxball-lobby p, .qb-fluxball-lobby button"
        : ".qb-scoreboard-page h1, .qb-scoreboard-page p, .qb-scoreboard-page [role='columnheader'], .qb-scoreboard-page [role='cell'], .qb-scoreboard-initials-label, .qb-scoreboard-initial-slots button, [data-action='save-initials'], .qb-screen-footer button, .qb-screen-footer span";
    const pixels = controlled.bitmapText.readPixels();
    let alignedLines = 0;
    for (const node of document.querySelectorAll<HTMLElement>(selectors)) {
      if (!node.getClientRects().length || node.textContent?.trim() === "---")
        continue;
      const r = node.getBoundingClientRect();
      // Initial slots are boxed. Exclude their borders, as well as mode underlines.
      const inset = node.matches(".qb-scoreboard-initial-slots button") ? 4 : 0;
      const x0 = Math.ceil(((r.left - frame.left) * 2) / scale) + inset;
      const x1 = Math.floor(((r.right - frame.left) * 2) / scale) - inset;
      const y0 = Math.floor((r.top - frame.top) / scale) * 2 + inset;
      const underline = node.matches(
        ".qb-arcade-mode > button:not(.qb-arcade-scores), .qb-fluxball-lobby-slots button, [data-action='save-initials']",
      )
        ? 2
        : 0;
      const y1 =
        Math.ceil((r.bottom - frame.top) / scale) * 2 - inset - underline;
      let lastInk = -1;
      for (let y = y0; y <= y1; y++) {
        const ink =
          y < y1 &&
          Array.from({ length: Math.max(0, x1 - x0) }, (_, i) => x0 + i).some(
            (x) => pixels.data[(y * pixels.width + x) * 4 + 3],
          );
        if (ink) lastInk = y;
        else if (lastInk >= 0) {
          assert(
            (lastInk + 1) % 2 === 0,
            `${example}: ${node.textContent} ends between full background rows at ${lastInk + 1}`,
          );
          alignedLines++;
          lastInk = -1;
        }
      }
    }
    return alignedLines;
  }
  window.__SHELL_CORRECTIONS__ = {
    show,
    check: async (example) => {
      await show(example);
      audit();
      const frame = required(
        document,
        ".qb-screen-frame",
      ).getBoundingClientRect();
      const scale = frame.width / 320;
      if (example.startsWith("menu-") || example === "fluxball-players") {
        const page = required<HTMLElement>(document, "[data-ui='page']");
        const controls = [
          ...page.querySelectorAll<HTMLButtonElement>("button"),
        ];
        const heading = required<HTMLElement>(page, "h1");
        const top = heading.getBoundingClientRect().top;
        const blocks = [
          ...page.querySelectorAll<HTMLElement>(".qb-arcade-tutorial p"),
        ];
        for (const block of blocks) {
          const rect = block.getBoundingClientRect();
          assert(
            getComputedStyle(block)
              .getPropertyValue("--qb-reading-scale")
              .trim() === "0.75",
            "Arcade body uses the approved reading size",
          );
          const play = required(
            page,
            ".qb-arcade-trials",
          ).getBoundingClientRect();
          assert(
            rect.bottom < play.top,
            "Complete rules stay above play controls",
          );
          for (const other of blocks.filter((other) => other !== block)) {
            const b = other.getBoundingClientRect();
            assert(
              rect.right <= b.left ||
                rect.left >= b.right ||
                rect.bottom <= b.top ||
                rect.top >= b.bottom,
              "Instruction blocks do not overlap",
            );
          }
        }
        const alignedLines = checkBottomAlignment(example);
        assert(alignedLines >= 5, "All visible menu text roles checked");
        for (const button of controls) {
          button.focus();
          await settled();
          for (
            let parent = button.parentElement;
            parent && parent !== root;
            parent = parent.parentElement
          )
            assert(
              parent.scrollTop === 0,
              `${example} ${button.textContent}: ${parent.className} scrolled ${parent.scrollTop}`,
            );
          assert(
            Math.abs(heading.getBoundingClientRect().top - top) < 1,
            "Menu title stays fixed while selecting modes",
          );
          const rect = button.getBoundingClientRect();
          assert(
            rect.bottom <= frame.bottom && rect.top >= frame.top,
            "Menu action remains inside frame",
          );
        }
        return `${example}: all ${controls.length} controls visible and no focus-induced scrolling; ${alignedLines} text lines bottom aligned`;
      }
      if (example === "settings") {
        const body =
          required<HTMLElement>(document, "[data-ui='page']").textContent ?? "";
        assert(body.includes("EXPORT SAVE"), "Data settings remain present");
        assert(
          !body.includes("SOURCE RECORD") &&
            !document.querySelector("[data-page='credits']"),
          "Source Record destination removed",
        );
        return "Data settings present; Source Record link absent; bitmap audits pass";
      }
      if (example === "moth") {
        assert(
          !liveLink,
          "Automatic MOTH checks require intercepted mode; liveLink=1 is for manual clicks only",
        );
        const moth = required<HTMLButtonElement>(
          document,
          "[data-action='postscript-moth']",
        );
        const finish = required<HTMLButtonElement>(
          document,
          "[data-terminal-action='continue']",
        );
        const label = required<HTMLElement>(moth, ".qb-terminal-prompt-label");
        const cursor = required<HTMLElement>(moth, ".qb-terminal-cursor");
        assert(
          label.textContent === "> MOTH",
          "MOTH prompt has leading > and no brackets",
        );
        assert(
          required(finish, ".qb-terminal-prompt-label").textContent ===
            "> FINISH",
          "FINISH prompt retained",
        );
        const textRect = label.getBoundingClientRect(),
          cursorRect = cursor.getBoundingClientRect();
        const leadingGutter = pixelsIn(
          new DOMRect(
            textRect.left - 5 * scale,
            textRect.top,
            5 * scale,
            textRect.height,
          ),
        );
        assert(
          leadingGutter.width === 0,
          "MOTH has no duplicate menu cursor before its prompt arrow",
        );
        assert(
          Math.abs(textRect.top - cursorRect.top) <= scale,
          "MOTH cursor aligns with word top",
        );
        const gap =
          (cursorRect.left - textRect.left) / scale -
          terminalTextWidth("> MOTH");
        assert(
          gap >= 3 && gap <= 9,
          `MOTH trailing cursor remains beside word (gap ${gap.toFixed(2)})`,
        );
        assert(
          getComputedStyle(cursor).visibility === "visible",
          "Focused MOTH cursor visible",
        );
        assert(
          getComputedStyle(required(finish, ".qb-terminal-cursor"))
            .visibility === "hidden",
          "Unselected FINISH cursor hidden",
        );
        const cursorPixels = pixelsIn(cursorRect);
        assert(
          cursorPixels.height > 0,
          "Selected MOTH cursor actually rasterized",
        );
        const before = location.href,
          article = required(document, "[data-terminal-page='postscript-2']");
        const count = opened.length;
        moth.click();
        await settled();
        const call = opened.at(-1);
        assert(
          opened.length === count + 1 &&
            call?.url === POSTSCRIPT_MOTH_URL &&
            call.target === "_blank" &&
            call.features === "noopener,noreferrer",
          "MOTH new-tab request isolates opener and referrer",
        );
        assert(
          location.href === before && article.isConnected,
          "MOTH activation preserves game document and page",
        );
        finish.focus();
        await settled();
        assert(
          getComputedStyle(cursor).visibility === "hidden",
          "MOTH cursor hides after selecting FINISH",
        );
        assert(
          getComputedStyle(required(finish, ".qb-terminal-cursor"))
            .visibility === "visible",
          "FINISH cursor becomes selected",
        );
        moth.focus();
        await settled();
        return `MOTH/FINISH selection and alignment pass; gap ${gap.toFixed(2)} logical pixels; intercepted new-tab request preserves document`;
      }
      const alignedLines = checkBottomAlignment(example);
      assert(
        alignedLines >= 10,
        "Score, initials, small labels and navigation checked",
      );
      const heading = required<HTMLElement>(
        document,
        ".qb-scoreboard-page > header h1",
      );
      const rect = heading.getBoundingClientRect(),
        title = heading.textContent ?? "";
      const wholeHeadingPixels = pixelsIn(rect);
      const width = terminalTextWidth(title);
      const logicalLeft = ((rect.left - frame.left) * 320) / frame.width + 1;
      const logicalRight = ((rect.right - frame.left) * 320) / frame.width - 1;
      const logicalTop = Math.round(
        ((rect.top - frame.top) * 180) / frame.height,
      );
      const logicalX = bitmapTextLineLeft(
        logicalLeft,
        logicalRight,
        width,
        "right",
      );
      const availableWidth = Math.floor(logicalRight) - Math.ceil(logicalLeft);
      assert(
        heading.hasAttribute("data-bitmap-flow"),
        "Heading uses production seven-pixel reading face",
      );
      assert(
        JSON.stringify(
          wrapBitmapText(title, availableWidth, 1, 1, Infinity, true),
        ) === JSON.stringify([title]),
        "Complete title fits on one reading line at its actual DOM width",
      );
      // A list heading's DOM box also crosses the table divider. Its entire
      // alpha bounds therefore measure text + divider, not the font's cap height.
      // Check the exact expected glyph pixels in the live bitmap instead.
      const bitmap = controlled.bitmapText.readPixels();
      let glyphPixelCount = 0;
      for (const glyph of terminalGlyphRects(title, logicalX, logicalTop)) {
        for (let y = glyph.y * 2; y < (glyph.y + glyph.height) * 2; y++) {
          for (let x = glyph.x * 2; x < (glyph.x + glyph.width) * 2; x++) {
            const index = (y * bitmap.width + x) * 4;
            assert(
              bitmap.data[index] === 214 &&
                bitmap.data[index + 1] === 189 &&
                bitmap.data[index + 2] === 139 &&
                bitmap.data[index + 3] === 255,
              `Complete title glyph at ${x / 2},${y / 2} is present and unclipped`,
            );
            glyphPixelCount++;
          }
        }
      }
      assert(
        glyphPixelCount > 0,
        "Title raster contains all expected seven-pixel reading glyphs",
      );
      assert(
        rect.left >= frame.left && rect.right <= frame.right,
        "Heading stays inside frame",
      );
      if (example.endsWith("list")) {
        const columns = required(
          document,
          ".qb-scoreboard-columns",
        ).getBoundingClientRect();
        const score = required(
          document,
          ".qb-scoreboard-columns > span:last-child",
        );
        const scoreRight =
          score.getBoundingClientRect().left +
          (terminalTextWidth(score.textContent ?? "") + 2) * scale;
        assert(
          rect.left > scoreRight,
          "Title does not overlap score/time column label",
        );
        assert(
          rect.top + 7 * scale < columns.bottom,
          "Title glyphs stay above table divider",
        );
      } else {
        const kicker = required<HTMLElement>(
          document,
          ".qb-score-entry > header .qb-kicker",
        );
        assert(
          kicker.dataset["bitmapText"] === "NEW HIGH SCORE",
          "Complete left label participates in bitmap fit audit",
        );
        const kickerRect = kicker.getBoundingClientRect();
        const kickerWidth = terminalTextWidth("NEW HIGH SCORE", 0.625);
        const kickerLeft =
          ((kickerRect.left - frame.left) * 320) / frame.width + 1;
        const kickerRight =
          ((kickerRect.right - frame.left) * 320) / frame.width - 1;
        const kickerHeight = (kickerRect.height * 180) / frame.height;
        assert(
          kickerHeight >= 5 && kickerHeight < 10,
          "Left label has space for the caption reading role",
        );
        assert(
          JSON.stringify(
            wrapBitmapText(
              "NEW HIGH SCORE",
              Math.floor(kickerRight) - Math.ceil(kickerLeft),
              0.625,
              0.625,
              Infinity,
              true,
            ),
          ) === JSON.stringify(["NEW HIGH SCORE"]),
          "Entire left label fits a single compact line",
        );
        const kickerX = bitmapTextLineLeft(
          kickerLeft,
          kickerRight,
          kickerWidth,
          "left",
        );
        const kickerY = Math.round(
          ((kickerRect.top - frame.top) * 180) / frame.height +
            (kickerHeight - 7 * 0.625) / 2,
        );
        let kickerPixels = 0;
        for (const glyph of scaledReadingGlyphRects(
          "NEW HIGH SCORE",
          kickerX,
          kickerY,
          0.625,
          "bottom",
        )) {
          for (let y = glyph.y * 2; y < (glyph.y + glyph.height) * 2; y++) {
            for (let x = glyph.x * 2; x < (glyph.x + glyph.width) * 2; x++) {
              const index = (y * bitmap.width + x) * 4;
              assert(
                bitmap.data[index] === 214 &&
                  bitmap.data[index + 1] === 189 &&
                  bitmap.data[index + 2] === 139 &&
                  bitmap.data[index + 3] === 255,
                `NEW HIGH SCORE glyph at ${x / 2},${y / 2} is present and unclipped`,
              );
              kickerPixels++;
            }
          }
        }
        assert(
          kickerPixels > 0 && kickerRect.right < rect.left,
          "Left label is rasterized and separate from game title",
        );
        const header = required(
          document,
          ".qb-score-entry > header",
        ).getBoundingClientRect();
        const result = required(
          document,
          ".qb-score-entry-result",
        ).getBoundingClientRect();
        assert(
          rect.top + 7 * scale < header.bottom,
          "Entry title glyphs stay above header divider",
        );
        assert(
          header.bottom <= result.top,
          "Entry header and result do not overlap",
        );
        assert(
          frame.top + ((kickerY + 5) * frame.height) / 180 < header.bottom,
          "Complete left-label glyphs remain above divider",
        );
      }
      return `${title}: ${alignedLines} text lines bottom aligned; ${width} × 7 logical glyph band (${glyphPixelCount} raster pixels checked); complete DOM-box alpha height ${wholeHeadingPixels.height / 2} includes any table divider; one line, divider clear, bitmap audits pass${example.endsWith("entry") ? "; all NEW HIGH SCORE caption glyph pixels verified" : ""}`;
    },
  };
  window.addEventListener("beforeunload", () => shell.destroy(), {
    once: true,
  });
  const initialExample = params.get("example");
  assert(
    initialExample === null || examples.includes(initialExample as Example),
    "Known fixture example required",
  );
  await show((initialExample ?? "hold-list") as Example);
  document.body.dataset["fixtureReady"] = "true";
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function required<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const found = root.querySelector<T>(selector);
  assert(found, `Missing ${selector}`);
  return found;
}
async function frames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
}
async function until(predicate: () => boolean): Promise<void> {
  const start = performance.now();
  while (!predicate()) {
    assert(performance.now() - start < 20000, "Timed out waiting for fixture");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function bootParent(): Promise<void> {
  const frame = required<HTMLIFrameElement>(document, "iframe");
  const status = required<HTMLElement>(document, "#fixture-status");
  const results = required(document, "#fixture-results");
  const api = (): FixtureApi => {
    const value = frame.contentWindow?.__SHELL_CORRECTIONS__;
    assert(value, "Child Shell ready");
    return value;
  };
  const resize = async (width: number, height: number) => {
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    await frames(3);
  };
  await resize(1280, 720);
  frame.src = `${location.pathname}?child=1`;
  await until(
    () => frame.contentDocument?.body?.dataset["fixtureReady"] === "true",
  );
  required<HTMLButtonElement>(document, "#show-example").onclick = () => {
    void (async () => {
      const [width, height] = required<HTMLSelectElement>(document, "#viewport")
        .value.split("x")
        .map(Number);
      await resize(width!, height!);
      await api().show(
        required<HTMLSelectElement>(document, "#example").value as Example,
      );
    })().catch((error) => {
      status.textContent = String(error);
      status.dataset["state"] = "failed";
    });
  };
  required<HTMLButtonElement>(document, "#run-checks").onclick = () => {
    void (async () => {
      const controls = [
        ...document.querySelectorAll<HTMLButtonElement | HTMLSelectElement>(
          "#fixture-controls button, #fixture-controls select",
        ),
      ];
      controls.forEach((control) => {
        control.disabled = true;
      });
      results.replaceChildren();
      status.textContent = "RUNNING";
      status.dataset["state"] = "running";
      let failures = 0;
      try {
        for (const [width, height] of dimensions) {
          await resize(width, height);
          for (const example of examples) {
            const row = document.createElement("li");
            results.append(row);
            try {
              row.textContent = `PASS ${width}×${height} ${example}: ${await api().check(example)}`;
              row.dataset["state"] = "passed";
            } catch (error) {
              failures++;
              row.textContent = `FAIL ${width}×${height} ${example}: ${String(error)}`;
              row.dataset["state"] = "failed";
            }
          }
        }
        status.textContent = `${dimensions.length * examples.length - failures}/${dimensions.length * examples.length} checks passed; ${failures} failures`;
        status.dataset["state"] = failures ? "failed" : "passed";
      } finally {
        controls.forEach((control) => {
          control.disabled = false;
        });
        await resize(1280, 720);
        await api().show("moth");
      }
    })().catch((error) => {
      status.textContent = String(error);
      status.dataset["state"] = "failed";
    });
  };
  required<HTMLButtonElement>(document, "#run-checks").disabled = false;
  required<HTMLButtonElement>(document, "#show-example").disabled = false;
}

void (
  new URLSearchParams(location.search).has("child") ? bootChild() : bootParent()
).catch((error: unknown) => {
  document.body.dataset["fixtureError"] = String(error);
  const status = document.querySelector<HTMLElement>("#fixture-status");
  if (status) {
    status.textContent = String(error);
    status.dataset["state"] = "failed";
  } else document.body.append(String(error));
});
