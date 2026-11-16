import {
  createDefaultSave,
  type QuantumBoxSave,
} from "../../../src/save/types";
import { SAVE_STORAGE_KEY } from "../../../src/save/SaveRepository";
import {
  STORY_NODES,
  TERMINAL_TRANSCRIPT_PAGE_IDS,
  storyNode,
  type StoryOutcome,
} from "../../../src/story/terminal";
import type { QuantumBoxTestApi } from "../../../src/app/QuantumBoxApp";
import { createRunContext } from "../../../src/core/run";
import {
  loadInstalledQongStoryBank,
  selectQongStoryPack,
} from "../../../src/games/qong/qongStoryPackBank";

const params = new URLSearchParams(location.search);
const namespaceRoot = "quantum-box/release-test/";
const createdNamespaces = new Set<string>();
const outcomes = Object.values(STORY_NODES).flatMap((node) => {
  if (node.kind !== "outcome-branch") return [];
  return Object.entries(node.branches).map(([outcome, id]) => ({
    id,
    stage: node.stageId,
    outcome: (outcome === "won"
      ? node.stageId.startsWith("skipixl")
        ? "finished"
        : "won"
      : node.stageId.startsWith("skipixl")
        ? "failed"
        : "lost") as StoryOutcome,
  }));
});

class IsolatedStorage implements Storage {
  constructor(
    private readonly backing: Storage,
    private readonly prefix: string,
  ) {}
  get length(): number {
    return this.keys().length;
  }
  clear(): void {
    for (const key of this.keys()) this.removeItem(key);
  }
  getItem(key: string): string | null {
    return this.backing.getItem(this.prefix + key);
  }
  key(index: number): string | null {
    return this.keys()[index] ?? null;
  }
  removeItem(key: string): void {
    this.backing.removeItem(this.prefix + key);
  }
  setItem(key: string, value: string): void {
    this.backing.setItem(this.prefix + key, value);
  }
  private keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < this.backing.length; i++) {
      const key = this.backing.key(i);
      if (key?.startsWith(this.prefix))
        keys.push(key.slice(this.prefix.length));
    }
    return keys;
  }
}

async function seedFor(id: string): Promise<unknown> {
  const base = createDefaultSave();
  const save = {
    ...base,
    settings: { ...base.settings, soundMuted: true, reducedMotion: true },
  };
  if (id === "read-ledger")
    return { ...save, settings: { ...save.settings, reducedMotion: false } };
  if (id === "natural-read")
    return {
      ...save,
      settings: { ...save.settings, reducedMotion: false },
      story: { ...save.story, currentNodeId: "qong-success" },
    };
  if (id === "archive") {
    // A seeded completion, not an earned result: use the installed receipt so
    // save authority validation stays enabled throughout the UI routing check.
    const bank = await loadInstalledQongStoryBank();
    const { pack, receipt } = selectQongStoryPack(bank, {
      cursor: 0,
      cycle: 0,
    });
    const run = createRunContext({
      gameId: "qong",
      storyStage: "qong",
      playMode: "story",
      rulesVersion: pack.rulesVersion,
      runSeed: 741,
      pack: {
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.source,
      },
      packSelection: receipt,
    });
    return {
      ...save,
      story: {
        ...save.story,
        currentNodeId: "ending-4",
        experiencedStages: ["qong"],
        clearedStages: ["qong"],
        completedStages: ["qong"],
        attempts: { qong: 1 },
        lastOutcomes: { qong: "won" },
        qualifiedRuns: { qong: run },
        qongSelector: {
          cursor: receipt.selectorCursorAfter,
          cycle: receipt.selectorCycleAfter,
          recoveredSelection: null,
        },
        readPageIds: ["qong-loss-first", "qong-debrief-1"],
      },
    };
  }
  if (id === "retry")
    return {
      ...save,
      story: {
        ...save.story,
        currentNodeId: "ending-4",
        experiencedStages: ["qong"],
        attempts: { qong: 1 },
        lastOutcomes: { qong: "lost" },
        readPageIds: ["qong-loss-first", "qong-debrief-1"],
      },
    };
  if (id === "old-complete") {
    const { readPageIds: _readHistory, ...legacyStory } = save.story;
    return {
      ...save,
      story: {
        ...legacyStory,
        currentNodeId: "story-complete",
        storyCompleted: true,
        experiencedStages: ["qong"],
        attempts: { qong: 1 },
        lastOutcomes: { qong: "lost" },
      },
    };
  }
  const result = outcomes.find((item) => item.id === id);
  if (!result) throw new Error(`Unknown fixture seed ${id}`);
  const won = result.outcome === "won" || result.outcome === "finished";
  return {
    ...save,
    story: {
      ...save.story,
      currentNodeId: id,
      experiencedStages: [result.stage],
      attempts: { [result.stage]: 1 },
      lastOutcomes: { [result.stage]: result.outcome },
      clearedStages: won ? [result.stage] : [],
      completedStages: won ? [result.stage] : [],
    },
  };
}

async function bootChild(): Promise<void> {
  document.documentElement.classList.add("fixture-child");
  document.querySelector("#fixture-controls")?.remove();
  document.querySelector(".fixture-viewport")?.remove();
  const runId = params.get("run");
  if (!runId || !/^[a-zA-Z0-9-]+$/.test(runId))
    throw new Error("A unique test run ID is required.");
  const storage = new IsolatedStorage(
    window.localStorage,
    `${namespaceRoot}${runId}/`,
  );
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  if (!storage.getItem("initialized")) {
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(await seedFor(params.get("seed") ?? "read-ledger")),
    );
    storage.setItem("initialized", "true");
  }
  window.addEventListener("error", (event) => {
    document.body.dataset["fixtureError"] = event.message;
  });
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      document.body.dataset["fixtureError"] = String(event.reason);
    },
  );
  // Match the production entry point's cascade; host fixture styles do not apply.
  await import("../../../src/styles.css");
  await import("../../../src/display/brownBox.css");
  const { QuantumBoxApp } = await import("../../../src/app/QuantumBoxApp");
  const root = required<HTMLElement>(document, "#app");
  root.hidden = false;
  const app = new QuantumBoxApp(root);
  window.addEventListener("beforeunload", () => app.destroy(), { once: true });
  await until(
    () =>
      Boolean(
        document.querySelector("[data-action='press-start']:not(:disabled)"),
      ),
    "game boot",
  );
  document.body.dataset["fixtureReady"] = "true";
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const target = root.querySelector<T>(selector);
  if (!target) throw new Error(`Missing UI: ${selector}`);
  return target;
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message}\nExpected ${JSON.stringify(expected)}\nReceived ${JSON.stringify(actual)}`,
  );
}
async function until(
  predicate: () => boolean,
  label: string,
  timeout = 15_000,
): Promise<void> {
  const started = performance.now();
  while (!predicate()) {
    if (performance.now() - started > timeout)
      throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
function documentFor(frame: HTMLIFrameElement): Document {
  assert(frame.contentDocument, "Fixture frame is not same-origin.");
  const error = frame.contentDocument.body?.dataset["fixtureError"];
  assert(!error, `Game browser error: ${error}`);
  return frame.contentDocument;
}
function apiFor(frame: HTMLIFrameElement): QuantumBoxTestApi {
  const api = frame.contentWindow?.__QUANTUM_BOX_TEST__;
  assert(api, "Development read-only QA API unavailable.");
  return api;
}
function saveFor(frame: HTMLIFrameElement): QuantumBoxSave {
  return apiFor(frame).getSave();
}
function click(frame: HTMLIFrameElement, selector: string): void {
  const button = required<HTMLButtonElement>(documentFor(frame), selector);
  assert(
    !button.disabled && !button.hidden && button.getClientRects().length > 0,
    `UI control is not actionable: ${selector}`,
  );
  button.click();
}
function press(frame: HTMLIFrameElement, code: string, key = code): void {
  const doc = documentFor(frame);
  const view = frame.contentWindow;
  assert(view, "Missing fixture window");
  const target = doc.activeElement?.closest("#app")
    ? doc.activeElement
    : required<HTMLElement>(doc, "#app");
  assert(target, "Missing keyboard target");
  for (const type of ["keydown", "keyup"])
    target.dispatchEvent(
      new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }),
    );
}
async function waitPage(
  frame: HTMLIFrameElement,
  id: string,
  complete = true,
): Promise<void> {
  await until(
    () =>
      Boolean(
        documentFor(frame).querySelector(
          `[data-terminal-page="${id}"]${complete ? '[data-terminal-complete="true"]' : ""}`,
        ),
      ),
    `${id} displayed`,
  );
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function assertStoryGeometry(
  frame: HTMLIFrameElement,
  id: string,
  record = true,
): void {
  const doc = documentFor(frame);
  const article = required<HTMLElement>(doc, `[data-terminal-page="${id}"]`);
  const screen = required<HTMLElement>(
    doc,
    ".qb-screen-frame",
  ).getBoundingClientRect();
  const bounds = article.getBoundingClientRect();
  const body = required<HTMLElement>(article, ".qb-terminal-body");
  const actions = required<HTMLElement>(article, ".qb-terminal-actions");
  const tolerance = 1;
  const describe = (box: DOMRect) =>
    `x=${box.left.toFixed(1)}..${box.right.toFixed(1)}, y=${box.top.toFixed(1)}..${box.bottom.toFixed(1)}`;
  const contained = (
    element: Element,
    container: DOMRect,
    label: string,
  ): void => {
    const box = element.getBoundingClientRect();
    assert(
      box.width > 0 && box.height > 0,
      `${id}: ${label} has no rendered area`,
    );
    assert(
      box.left >= container.left - tolerance &&
        box.right <= container.right + tolerance &&
        box.top >= container.top - tolerance &&
        box.bottom <= container.bottom + tolerance,
      `${id}: ${label} leaves its visible container (${describe(box)}; container ${describe(container)})`,
    );
  };
  contained(article, screen, "Story article");
  for (const element of [
    required<HTMLElement>(doc, "#app"),
    required<HTMLElement>(doc, "[data-ui='page']"),
    article,
    body,
  ]) {
    assert(
      element.scrollTop === 0 && element.scrollLeft === 0,
      `${id}: ${element.className || element.id} scrolled and may hide text`,
    );
  }
  const header = required<HTMLElement>(article, "header");
  const rule = required<HTMLElement>(article, ".qb-terminal-top-rule");
  contained(header, bounds, "header");
  contained(body, bounds, "body");
  contained(actions, bounds, "actions");
  assert(
    header.getBoundingClientRect().bottom <=
      rule.getBoundingClientRect().top + tolerance,
    `${id}: heading overlaps its rule`,
  );
  assert(
    rule.getBoundingClientRect().bottom <=
      body.getBoundingClientRect().top + tolerance,
    `${id}: body overlaps heading rule`,
  );
  assert(
    body.getBoundingClientRect().bottom <=
      actions.getBoundingClientRect().top + tolerance,
    `${id}: body overlaps actions`,
  );
  const paragraphs = [...body.children];
  for (const [index, paragraph] of paragraphs.entries()) {
    contained(
      paragraph,
      body.getBoundingClientRect(),
      `body block ${index + 1}`,
    );
    if (index > 0)
      assert(
        paragraphs[index - 1]!.getBoundingClientRect().bottom <=
          paragraph.getBoundingClientRect().top + tolerance,
        `${id}: body blocks ${index} and ${index + 1} overlap`,
      );
  }
  const buttons = [...actions.querySelectorAll<HTMLElement>("button")];
  for (const [index, button] of buttons.entries()) {
    contained(button, actions.getBoundingClientRect(), `action ${index + 1}`);
    contained(
      required<HTMLElement>(button, ".qb-terminal-prompt-label"),
      button.getBoundingClientRect(),
      `action ${index + 1} text`,
    );
    contained(
      required<HTMLElement>(button, ".qb-terminal-cursor"),
      button.getBoundingClientRect(),
      `action ${index + 1} cursor`,
    );
    if (index > 0) {
      const prior = buttons[index - 1]!.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      assert(
        prior.right <= box.left + tolerance ||
          box.right <= prior.left + tolerance ||
          prior.bottom <= box.top + tolerance ||
          box.bottom <= prior.top + tolerance,
        `${id}: action buttons overlap`,
      );
    }
  }
  equal(
    required<HTMLCanvasElement>(doc, "[data-ui='bitmap-text']").dataset[
      "explicitTextFitAudit"
    ],
    "pass",
    `${id}: rendered bitmap text fits its cells`,
  );
  const logicalBottom = (
    ((actions.getBoundingClientRect().bottom - screen.top) / screen.height) *
    180
  ).toFixed(2);
  required<HTMLElement>(document, "#fixture-geometry").textContent +=
    `PASS ${id}: body + actions inside frame; no overlaps; action bottom ${logicalBottom}/180; inline=${actions.dataset["inline"]}\n`;
}
async function startStory(frame: HTMLIFrameElement): Promise<void> {
  click(frame, "[data-action='press-start']");
  click(frame, "[data-page='story-start']");
  const action = documentFor(frame).querySelector(
    "[data-action='continue-story']",
  )
    ? "continue-story"
    : "new-story";
  click(frame, `[data-action='${action}']`);
}
async function openArchive(frame: HTMLIFrameElement): Promise<void> {
  click(frame, "[data-action='press-start']");
  click(frame, "[data-page='terminal']");
  click(
    frame,
    "[data-action='open-terminal-transcript'][data-chapter-id='qong']",
  );
  await waitPage(frame, TERMINAL_TRANSCRIPT_PAGE_IDS.qong[0]!);
}

async function newFrame(seed: string): Promise<HTMLIFrameElement> {
  const frame = required<HTMLIFrameElement>(document, "#fixture-game");
  const runId = crypto.randomUUID();
  createdNamespaces.add(`${namespaceRoot}${runId}/`);
  const oldDocument = frame.contentDocument;
  frame.src = `${location.pathname}?frame=1&run=${runId}&seed=${encodeURIComponent(seed)}`;
  await until(
    () =>
      frame.contentDocument !== oldDocument &&
      Boolean(frame.contentDocument?.body?.dataset["fixtureReady"]),
    `fixture ${seed} boot`,
  );
  documentFor(frame);
  return frame;
}
async function reload(frame: HTMLIFrameElement): Promise<void> {
  const oldDocument = frame.contentDocument;
  frame.contentWindow?.location.reload();
  await until(
    () =>
      frame.contentDocument !== oldDocument &&
      Boolean(frame.contentDocument?.body?.dataset["fixtureReady"]),
    "fixture reload",
  );
  documentFor(frame);
}

const checks: Readonly<
  Record<string, { label: string; run: () => Promise<void> }>
> = {
  "read-ledger": {
    label: "Read only after full display; leave, resume and reload",
    run: async () => {
      const frame = await newFrame("read-ledger");
      await startStory(frame);
      await waitPage(frame, "intro-1", false);
      assert(
        required<HTMLElement>(documentFor(frame), "[data-terminal-page]")
          .dataset["terminalComplete"] === "false",
        "Intro unexpectedly complete before input",
      );
      equal(
        saveFor(frame).story.readPageIds,
        [],
        "Partially typed page must remain unread",
      );
      press(frame, "Backspace", "Backspace");
      equal(apiFor(frame).getPage(), "main", "Back leaves partial Story");
      equal(
        saveFor(frame).story.readPageIds,
        [],
        "Leaving partial text must not mark it read",
      );
      click(frame, "[data-page='story-start']");
      click(frame, "[data-action='new-story']");
      press(frame, "Space", " ");
      await waitPage(frame, "intro-1");
      equal(
        saveFor(frame).story.readPageIds,
        ["intro-1"],
        "Full display records current page once",
      );
      click(frame, "[data-terminal-action='continue']");
      await waitPage(frame, "intro-2", false);
      equal(
        saveFor(frame).story.readPageIds,
        ["intro-1"],
        "Unfinished destination remains unread",
      );
      await reload(frame);
      equal(
        saveFor(frame).story.readPageIds,
        ["intro-1"],
        "Reload preserves exact ledger",
      );
      await startStory(frame);
      await waitPage(frame, "intro-2", false);
      equal(
        saveFor(frame).story.currentNodeId,
        "intro-2",
        "Reload resumes cursor",
      );
      press(frame, "Space", " ");
      await waitPage(frame, "intro-2");
      equal(
        saveFor(frame).story.readPageIds,
        ["intro-1", "intro-2"],
        "Resumed completion records destination",
      );
      const natural = await newFrame("natural-read");
      await startStory(natural);
      await waitPage(natural, "qong-success", false);
      equal(
        saveFor(natural).story.readPageIds,
        [],
        "Naturally typing page begins unread",
      );
      await waitPage(natural, "qong-success");
      equal(
        saveFor(natural).story.readPageIds,
        ["qong-success"],
        "Natural completion also records read page",
      );
    },
  },
  archive: {
    label:
      "Cleared chapters open canonical READ transcripts without rewriting factual read history",
    run: async () => {
      const frame = await newFrame("archive");
      const before = saveFor(frame).story;
      equal(
        before.clearedStages,
        ["qong"],
        "Seeded installed-authority clear survives validation",
      );
      assert(
        before.qualifiedRuns.qong,
        "Seeded clear retains its installed receipt",
      );
      await openArchive(frame);
      for (const id of TERMINAL_TRANSCRIPT_PAGE_IDS.qong) {
        await waitPage(frame, id);
        equal(
          [
            ...documentFor(frame).querySelectorAll<HTMLElement>(
              "[data-terminal-action]",
            ),
          ].map((button) => button.dataset["terminalAction"]),
          ["continue"],
          `${id} transcript only navigates reading`,
        );
        assertStoryGeometry(frame, id);
        click(frame, "[data-terminal-action='continue']");
      }
      equal(
        apiFor(frame).getPage(),
        "terminal",
        "Canonical transcript returns to Terminal",
      );
      equal(
        saveFor(frame).story.readPageIds,
        before.readPageIds,
        "Transcript reading cannot fabricate the historical ledger",
      );
      equal(
        saveFor(frame).story.currentNodeId,
        before.currentNodeId,
        "Transcript reading cannot move main Story cursor",
      );
      equal(
        saveFor(frame).story.clearedStages,
        before.clearedStages,
        "Reading cannot create additional clears",
      );
      equal(
        saveFor(frame).story.qualifiedRuns,
        before.qualifiedRuns,
        "Reading cannot manufacture provenance",
      );
      equal(
        saveFor(frame).story.transcriptSeen,
        ["qong"],
        "Reading marks only the unlocked chapter seen",
      );
    },
  },
  outcomes: {
    label:
      "Success continues; Qong/Quantman first loss retries; later and other failures offer Retry + Continue",
    run: async () => {
      for (const [index, outcome] of outcomes.entries()) {
        required<HTMLElement>(document, "#fixture-status").textContent =
          `RUNNING OUTCOME ${index + 1}/${outcomes.length}: ${outcome.id}`;
        const frame = await newFrame(outcome.id);
        await startStory(frame);
        await waitPage(frame, outcome.id);
        assertStoryGeometry(frame, outcome.id);
        const won = outcome.outcome === "won" || outcome.outcome === "finished";
        const firstLoss =
          outcome.id === "qong-loss-first" ||
          outcome.id === "quantman-loss-first";
        const expected = won
          ? ["continue"]
          : firstLoss
            ? ["retry"]
            : ["retry", "continue"];
        const buttons = [
          ...documentFor(frame).querySelectorAll<HTMLElement>(
            "[data-terminal-action]",
          ),
        ];
        equal(
          buttons.map((button) => button.dataset["terminalAction"]),
          expected,
          `${outcome.id} actions`,
        );
        equal(
          (documentFor(frame).activeElement as HTMLElement | null)?.dataset[
            "terminalAction"
          ],
          expected[0],
          `${outcome.id} initial selection`,
        );
        if (expected.length === 2) {
          const inline =
            required<HTMLElement>(documentFor(frame), ".qb-terminal-actions")
              .dataset["inline"] === "true";
          const forward = inline ? "ArrowRight" : "ArrowDown";
          const backward = inline ? "ArrowLeft" : "ArrowUp";
          press(frame, forward, forward);
          equal(
            (documentFor(frame).activeElement as HTMLElement | null)?.dataset[
              "terminalAction"
            ],
            "continue",
            `${outcome.id} ${forward} selects Continue`,
          );
          assertStoryGeometry(frame, outcome.id, false);
          press(frame, backward, backward);
          equal(
            (documentFor(frame).activeElement as HTMLElement | null)?.dataset[
              "terminalAction"
            ],
            "retry",
            `${outcome.id} ${backward} selects Retry`,
          );
          press(frame, forward, forward);
        }
        const before = saveFor(frame).story.clearedStages;
        press(frame, "Enter", "Enter");
        const node = storyNode(outcome.id);
        assert("transitions" in node, "Missing outcome transitions");
        if (firstLoss) {
          await until(
            () => apiFor(frame).getPage() === "cabinet",
            `${outcome.id} mandatory retry launch`,
          );
          equal(
            saveFor(frame).story.currentNodeId,
            node.transitions.retry,
            `${outcome.id} Retry route`,
          );
        } else {
          assert(node.transitions.continue, "Missing continuation");
          await waitPage(frame, node.transitions.continue);
          equal(
            saveFor(frame).story.currentNodeId,
            node.transitions.continue,
            `${outcome.id} Continue route`,
          );
          if (node.transitions.continue === "skipixl-feasible-response") {
            equal(
              [
                ...documentFor(frame).querySelectorAll<HTMLElement>(
                  "[data-terminal-action]",
                ),
              ].map((button) => button.dataset["terminalAction"]),
              ["continue"],
              "SkiPixl explanation does not repeat the result choice",
            );
            assertStoryGeometry(frame, "skipixl-feasible-response");
          }
        }
        equal(
          saveFor(frame).story.clearedStages,
          before,
          `${outcome.id} routing cannot invent a clear`,
        );
      }
    },
  },
  "old-complete": {
    label:
      "Legacy completed loss save gets both Postscript panels and reloads complete",
    run: async () => {
      const frame = await newFrame("old-complete");
      equal(
        saveFor(frame).story.currentNodeId,
        "postscript-1",
        "Old completion resumes missing Postscript",
      );
      assert(
        !saveFor(frame).story.readPageIds.includes("postscript-1"),
        "Migration must not mark unseen Postscript read",
      );
      await startStory(frame);
      await waitPage(frame, "postscript-1");
      assertStoryGeometry(frame, "postscript-1");
      assert(
        required<HTMLElement>(
          documentFor(frame),
          "[data-terminal-page]",
        ).textContent?.includes("YOU REACHED THE END OF THE DEMO."),
        "Approved replacement sentence missing",
      );
      click(frame, "[data-terminal-action='continue']");
      await waitPage(frame, "postscript-2");
      assertStoryGeometry(frame, "postscript-2");
      equal(
        required<HTMLElement>(
          documentFor(frame),
          ".qb-postscript-link",
        ).textContent?.trim(),
        "> MOTH",
        "Link displays MOTH with its prompt and without brackets",
      );
      click(frame, "[data-terminal-action='continue']");
      equal(apiFor(frame).getPage(), "terminal", "Finish returns to Terminal");
      assert(
        saveFor(frame).story.storyCompleted,
        "Finish records narrative completion",
      );
      equal(
        saveFor(frame).story.clearedStages,
        [],
        "Narrative completion cannot create a win",
      );
      equal(
        saveFor(frame).story.qualifiedRuns,
        {},
        "Narrative completion cannot create provenance",
      );
      await reload(frame);
      equal(
        saveFor(frame).story.currentNodeId,
        "story-complete",
        "Reload does not replay migrated Postscript",
      );
      assert(
        saveFor(frame).story.readPageIds.includes("postscript-1") &&
          saveFor(frame).story.readPageIds.includes("postscript-2"),
        "Both Postscript pages remain in the factual read history",
      );
    },
  },
  retry: {
    label:
      "Uncleared Terminal chapter offers RETRY through introduction/tutorial into Qong while preserving Story cursor",
    run: async () => {
      const frame = await newFrame("retry");
      const before = saveFor(frame).story;
      click(frame, "[data-action='press-start']");
      click(frame, "[data-page='terminal']");
      assert(
        !documentFor(frame).querySelector(
          "[data-action='open-terminal-transcript'][data-chapter-id='qong']",
        ),
        "Uncleared Qong offers no READ action",
      );
      click(
        frame,
        "[data-action='retry-terminal-chapter'][data-chapter-id='qong']",
      );
      await waitPage(frame, "qong-intro");
      assertStoryGeometry(frame, "qong-intro");
      click(frame, "[data-terminal-action='continue']");
      await waitPage(frame, "qong-tutorial");
      assertStoryGeometry(frame, "qong-tutorial");
      click(frame, "[data-terminal-action='play']");
      await until(
        () => apiFor(frame).getPage() === "cabinet",
        "Qong retry launch",
      );
      assert(
        required<HTMLElement>(
          documentFor(frame),
          "[data-cabinet='qong']",
        ).getClientRects().length > 0,
        "Qong cabinet must be visible",
      );
      equal(
        saveFor(frame).story.currentNodeId,
        before.currentNodeId,
        "Independent retry preserves main Story cursor",
      );
      equal(
        saveFor(frame).story.attempts.qong,
        2,
        "Independent retry records a new attempt",
      );
      equal(
        saveFor(frame).story.readPageIds,
        before.readPageIds,
        "Retry creates no additional read pages",
      );
      equal(
        saveFor(frame).story.clearedStages,
        [],
        "Starting a retry cannot create a win",
      );
      press(frame, "KeyP", "p");
      await until(
        () =>
          !required<HTMLButtonElement>(
            documentFor(frame),
            "[data-action='qong-pause']",
          ).hidden,
        "Qong pause",
      );
      await reload(frame);
      await startStory(frame);
      await waitPage(frame, "ending-4");
      equal(
        saveFor(frame).story.currentNodeId,
        "ending-4",
        "Reload continues narrative rather than retry game",
      );
    },
  },
};

function clearFixtureData(): void {
  for (const prefix of createdNamespaces)
    new IsolatedStorage(localStorage, prefix).clear();
  createdNamespaces.clear();
}

async function runChecks(): Promise<void> {
  const run = required<HTMLButtonElement>(document, "#run-checks");
  const status = required<HTMLElement>(document, "#fixture-status");
  const results = required<HTMLOListElement>(document, "#fixture-results");
  const normalSave = localStorage.getItem(SAVE_STORAGE_KEY);
  run.disabled = true;
  results.replaceChildren();
  required<HTMLElement>(document, "#fixture-geometry").textContent = "";
  status.dataset["state"] = "running";
  const selected = params.get("case");
  let passed = 0;
  let failed = 0;
  for (const [id, check] of Object.entries(checks)) {
    if (selected && selected !== id) continue;
    status.textContent = `RUNNING: ${check.label}`;
    const row = document.createElement("li");
    row.dataset["check"] = id;
    row.textContent = `RUNNING · ${check.label}`;
    results.append(row);
    try {
      await check.run();
      equal(
        localStorage.getItem(SAVE_STORAGE_KEY),
        normalSave,
        "Normal game save remains untouched",
      );
      row.dataset["state"] = "passed";
      row.textContent = `PASS · ${check.label}`;
      passed++;
    } catch (error) {
      row.dataset["state"] = "failed";
      row.textContent = `FAIL · ${check.label}\n${error instanceof Error ? error.message : String(error)}`;
      failed++;
    }
  }
  if (!passed && !failed) {
    failed++;
    results.textContent = `Unknown case: ${selected}`;
  }
  status.dataset["state"] = failed ? "failed" : "passed";
  status.textContent = `${passed} PASSED · ${failed} FAILED`;
  run.disabled = false;
}

if (params.get("frame") === "1") {
  void bootChild().catch((error: unknown) => {
    document.body.dataset["fixtureError"] =
      error instanceof Error ? error.message : String(error);
    document.body.dataset["fixtureReady"] = "true";
  });
} else {
  required<HTMLButtonElement>(document, "#run-checks").addEventListener(
    "click",
    () => void runChecks(),
  );
  required<HTMLButtonElement>(document, "#clear-checks").addEventListener(
    "click",
    () => {
      required<HTMLIFrameElement>(document, "#fixture-game").src =
        "about:blank";
      clearFixtureData();
    },
  );
}
