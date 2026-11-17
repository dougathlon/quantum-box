import type { RunContext } from "../../../src/core/run";
import type { StoryChapterId, StoryStageId } from "../../../src/games/registry";
import { SAVE_STORAGE_KEY } from "../../../src/save/SaveRepository";
import { createDefaultSave } from "../../../src/save/types";
import type { StoryOutcome } from "../../../src/story/terminal";
import { TERMINAL_TRANSCRIPT_PAGE_IDS } from "../../../src/story/terminal";

const params = new URLSearchParams(location.search);
const namespaceRoot = "quantum-box/story-correction-test/";
const namespaces = new Set<string>();

class NamespacedStorage implements Storage {
  constructor(
    private readonly backing: Storage,
    private readonly prefix: string,
  ) {}
  private keys(): string[] {
    return Array.from({ length: this.backing.length }, (_, i) =>
      this.backing.key(i),
    )
      .filter(
        (key): key is string => key !== null && key.startsWith(this.prefix),
      )
      .map((key) => key.slice(this.prefix.length));
  }
  get length(): number {
    return this.keys().length;
  }
  key(index: number): string | null {
    return this.keys()[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.backing.getItem(this.prefix + key);
  }
  setItem(key: string, value: string): void {
    this.backing.setItem(this.prefix + key, value);
  }
  removeItem(key: string): void {
    this.backing.removeItem(this.prefix + key);
  }
  clear(): void {
    for (const key of this.keys()) this.removeItem(key);
  }
}

interface FixtureControl {
  readonly run: () => RunContext | null;
  readonly finishQong: (outcome: "won" | "lost") => void;
}
declare global {
  interface Window {
    __STORY_CORRECTION_FIXTURE__?: FixtureControl;
  }
}

function seed(chapter: string) {
  const base = createDefaultSave();
  const first: StoryStageId =
    chapter === "skipixl"
      ? "skipixl-feasible"
      : chapter === "fluxball"
        ? "fluxball-global"
        : chapter === "quarry"
          ? "quarry"
          : "qong";
  const cleared: StoryStageId[] = chapter === "qong" ? [] : [first];
  return {
    ...base,
    settings: { ...base.settings, soundMuted: true, reducedMotion: true },
    story: {
      ...base.story,
      currentNodeId: "ending-4",
      experiencedStages: [first],
      clearedStages: cleared,
      completedStages: cleared,
      attempts: { [first]: 1 },
      firstLossExplanations: { qong: true, quantman: true, fluxball: false },
    },
  };
}

async function bootChild(): Promise<void> {
  document.documentElement.classList.add("fixture-child");
  document.querySelector("#fixture-controls")?.remove();
  document.querySelector("iframe")?.remove();
  const id = params.get("run");
  assert(id && /^[a-zA-Z0-9-]+$/.test(id), "Valid isolated run ID required");
  const storage = new NamespacedStorage(localStorage, `${namespaceRoot}${id}/`);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  if (!storage.getItem(SAVE_STORAGE_KEY))
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(seed(params.get("chapter") ?? "qong")),
    );
  window.addEventListener("error", (event) => {
    document.body.dataset["fixtureError"] = event.message;
  });
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      document.body.dataset["fixtureError"] = String(event.reason);
    },
  );
  await import("../../../src/styles.css");
  await import("../../../src/display/brownBox.css");
  const { QuantumBoxApp } = await import("../../../src/app/QuantumBoxApp");
  const root = required<HTMLElement>(document, "#app");
  root.hidden = false;
  const app = new QuantumBoxApp(root);
  // This private adapter exists only in this seeded fixture, never production.
  const controlled = app as unknown as {
    activeRun: RunContext | null;
    qongRuntime: { stop(): void } | null;
    recordActiveStoryOutcome(outcome: StoryOutcome): void;
    returnFromStoryCabinet(): void;
  };
  window.__STORY_CORRECTION_FIXTURE__ = {
    run: () => controlled.activeRun,
    finishQong: (outcome) => {
      assert(
        controlled.activeRun?.storyStage === "qong" && controlled.qongRuntime,
        "Controlled result requires an actual active Qong Story launch",
      );
      controlled.qongRuntime.stop();
      controlled.recordActiveStoryOutcome(outcome);
      controlled.returnFromStoryCabinet();
    },
  };
  window.addEventListener("beforeunload", () => app.destroy(), { once: true });
  await until(
    () =>
      Boolean(
        document.querySelector("[data-action='press-start']:not(:disabled)"),
      ),
    "boot",
  );
  document.body.dataset["fixtureReady"] = "true";
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message}\nExpected ${JSON.stringify(expected)}\nReceived ${JSON.stringify(actual)}`,
  );
}
function required<T extends Element>(root: ParentNode, selector: string): T {
  const target = root.querySelector<T>(selector);
  assert(target, `Missing ${selector}`);
  return target;
}
async function until(predicate: () => boolean, label: string): Promise<void> {
  const started = performance.now();
  while (!predicate()) {
    assert(performance.now() - started < 20000, `Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
function doc(frame: HTMLIFrameElement): Document {
  const value = frame.contentDocument;
  assert(value, "Same-origin frame required");
  assert(
    !value.body?.dataset["fixtureError"],
    `Browser error: ${value.body?.dataset["fixtureError"]}`,
  );
  return value;
}
function api(frame: HTMLIFrameElement) {
  const value = frame.contentWindow?.__QUANTUM_BOX_TEST__;
  assert(value, "App QA API required");
  return value;
}
function control(frame: HTMLIFrameElement): FixtureControl {
  const value = frame.contentWindow?.__STORY_CORRECTION_FIXTURE__;
  assert(value, "Fixture control required");
  return value;
}
function click(frame: HTMLIFrameElement, selector: string): void {
  const button = [
    ...doc(frame).querySelectorAll<HTMLButtonElement>(selector),
  ].find(
    (item) =>
      !item.disabled && !item.hidden && item.getClientRects().length > 0,
  );
  assert(button, `No visible enabled ${selector}`);
  button.click();
}
async function page(frame: HTMLIFrameElement, id: string): Promise<void> {
  await until(
    () =>
      Boolean(
        doc(frame).querySelector(
          `[data-terminal-page='${id}'][data-terminal-complete='true']`,
        ),
      ),
    id,
  );
}
function actions(frame: HTMLIFrameElement): string[] {
  return [
    ...doc(frame).querySelectorAll<HTMLElement>("[data-terminal-action]"),
  ].map((button) => button.dataset["terminalAction"]!);
}
function preserved(
  frame: HTMLIFrameElement,
  before: ReturnType<ReturnType<typeof api>["getSave"]>,
): void {
  const after = api(frame).getSave();
  equal(
    after.story.currentNodeId,
    before.story.currentNodeId,
    "Main cursor preserved",
  );
  equal(
    after.story.firstLossExplanations,
    before.story.firstLossExplanations,
    "Main failure flags preserved",
  );
  equal(
    after.story.readPageIds,
    before.story.readPageIds,
    "Main read history preserved",
  );
  equal(
    after.story.storyCompleted,
    before.story.storyCompleted,
    "Main narrative completion preserved",
  );
}
async function newFrame(chapter: string): Promise<HTMLIFrameElement> {
  const frame = required<HTMLIFrameElement>(document, "#fixture-game");
  const id = crypto.randomUUID();
  namespaces.add(`${namespaceRoot}${id}/`);
  const previous = frame.contentDocument;
  frame.src = `${location.pathname}?frame=1&run=${id}&chapter=${chapter}`;
  await until(
    () =>
      frame.contentDocument !== previous &&
      Boolean(frame.contentDocument?.body?.dataset["fixtureReady"]),
    "child ready",
  );
  doc(frame);
  return frame;
}
async function reload(frame: HTMLIFrameElement): Promise<void> {
  const previous = frame.contentDocument;
  frame.contentWindow?.location.reload();
  await until(
    () =>
      frame.contentDocument !== previous &&
      Boolean(frame.contentDocument?.body?.dataset["fixtureReady"]),
    "reload",
  );
  doc(frame);
}
function openTerminal(frame: HTMLIFrameElement): void {
  click(frame, "[data-action='press-start']");
  click(frame, "[data-page='terminal']");
}
async function launch(
  frame: HTMLIFrameElement,
  chapter: StoryChapterId,
  stage: StoryStageId,
  intro: string,
): Promise<RunContext> {
  click(
    frame,
    `[data-action='retry-terminal-chapter'][data-chapter-id='${chapter}']`,
  );
  await page(frame, intro);
  for (let step = 0; step < 8 && api(frame).getPage() !== "cabinet"; step++) {
    const previous = doc(frame).querySelector<HTMLElement>(
      "[data-terminal-page]",
    )?.dataset["terminalPage"];
    assert(previous, "Retry intro should be displayed");
    await page(frame, previous);
    click(
      frame,
      "[data-terminal-action='continue'], [data-terminal-action='play']",
    );
    await until(
      () =>
        api(frame).getPage() === "cabinet" ||
        doc(frame).querySelector<HTMLElement>("[data-terminal-page]")?.dataset[
          "terminalPage"
        ] !== previous,
      "next lead-in",
    );
  }
  await until(() => api(frame).getPage() === "cabinet", "valid cabinet launch");
  const run = control(frame).run();
  assert(run?.storyStage === stage, `Expected ${stage} launch`);
  assert(
    run.pack.source ===
      (chapter === "skipixl"
        ? "moth-platform-qpu-capture"
        : chapter === "fluxball"
          ? "mixed-preacquired-bank"
          : "moth-api-qpu"),
    "Launch must use the installed cabinet's QPU pack",
  );
  return run;
}

const checks: Record<string, () => Promise<void>> = {
  "qong-failures": async () => {
    const frame = await newFrame("qong");
    const before = api(frame).getSave();
    openTerminal(frame);
    const first = await launch(frame, "qong", "qong", "qong-intro");
    control(frame).finishQong("lost");
    await page(frame, "qong-loss-first");
    equal(actions(frame), ["retry"], "First terminal loss requires Retry");
    click(frame, "[data-terminal-action='retry']");
    await until(() => api(frame).getPage() === "cabinet", "second Qong launch");
    assert(
      control(frame).run()?.runId !== first.runId,
      "Retry gets a fresh selected run",
    );
    control(frame).finishQong("lost");
    await page(frame, "qong-loss-later");
    equal(actions(frame), ["retry", "continue"], "Second loss allows Continue");
    click(frame, "[data-terminal-action='continue']");
    await until(() => api(frame).getPage() === "terminal", "Terminal index");
    equal(
      api(frame).getSave().story.clearedStages,
      [],
      "Losses never grant a win",
    );
    preserved(frame, before);
    const saved = api(frame).getSave();
    await reload(frame);
    equal(api(frame).getSave(), saved, "Reload preserves saved evidence");
    openTerminal(frame);
    assert(
      !doc(frame).querySelector(
        "[data-action='open-terminal-transcript'][data-chapter-id='qong']",
      ),
      "Uncleared Qong cannot be read",
    );
  },
  "qong-win": async () => {
    const frame = await newFrame("qong");
    const before = api(frame).getSave();
    openTerminal(frame);
    const run = await launch(frame, "qong", "qong", "qong-intro");
    control(frame).finishQong("won");
    await page(frame, "qong-success");
    equal(actions(frame), ["continue"], "Win only allows Continue");
    for (const next of ["qong-debrief-1", "qong-debrief-2"]) {
      click(frame, "[data-terminal-action='continue']");
      await page(frame, next);
    }
    click(frame, "[data-terminal-action='continue']");
    await until(() => api(frame).getPage() === "terminal", "chapter boundary");
    preserved(frame, before);
    equal(
      api(frame).getSave().story.qualifiedRuns.qong,
      run,
      "Qualified run receipt retained",
    );
    assert(
      !doc(frame).querySelector(
        "[data-action='retry-terminal-chapter'][data-chapter-id='qong']",
      ),
      "Cleared Qong has no Retry",
    );
    click(
      frame,
      "[data-action='open-terminal-transcript'][data-chapter-id='qong']",
    );
    for (const id of [
      "intro-1",
      "intro-2",
      "intro-3",
      "qong-intro",
      "qong-tutorial",
      "qong-success",
      "qong-debrief-1",
      "qong-debrief-2",
    ]) {
      await page(frame, id);
      equal(actions(frame), ["continue"], "Transcript is read-only");
      click(frame, "[data-terminal-action='continue']");
    }
    await until(
      () => api(frame).getPage() === "terminal",
      "full Qong transcript returns to index",
    );
    const saved = api(frame).getSave();
    await reload(frame);
    equal(api(frame).getSave(), saved, "Terminal-earned clear survives reload");
  },
  "skipixl-partial": () =>
    partial("skipixl", "skipixl-overloaded", "skipixl-overloaded-intro"),
  "fluxball-partial": () =>
    partial("fluxball", "fluxball-individual", "fluxball-split-intro"),
  "quarry-read": async () => {
    const frame = await newFrame("quarry");
    const before = api(frame).getSave();
    openTerminal(frame);
    click(
      frame,
      "[data-action='open-terminal-transcript'][data-chapter-id='quarry']",
    );
    for (const id of TERMINAL_TRANSCRIPT_PAGE_IDS.quarry) {
      await page(frame, id);
      equal(
        actions(frame),
        ["continue"],
        "Quarry transcript never launches gameplay",
      );
      click(frame, "[data-terminal-action='continue']");
    }
    await until(
      () => api(frame).getPage() === "terminal",
      "Quarry ending and Postscript return to index",
    );
    preserved(frame, before);
  },
};
async function partial(
  chapter: "skipixl" | "fluxball",
  stage: StoryStageId,
  intro: string,
): Promise<void> {
  const frame = await newFrame(chapter);
  const before = api(frame).getSave();
  openTerminal(frame);
  await launch(frame, chapter, stage, intro);
  preserved(frame, before);
  await until(
    () =>
      Boolean(
        [
          ...doc(frame).querySelectorAll<HTMLElement>(
            "[data-action='cabinet-back']",
          ),
        ].some((button) => button.getClientRects().length > 0),
      ),
    "cabinet controls presented",
  );
  click(frame, "[data-action='cabinet-back']");
  await until(
    () =>
      [
        ...doc(frame).querySelectorAll<HTMLElement>(
          "[data-action='cabinet-back']",
        ),
      ].some(
        (button) =>
          button.getClientRects().length > 0 &&
          button.textContent?.startsWith("EXIT"),
      ),
    "pause menu presented",
  );
  click(frame, "[data-action='cabinet-back']");
  await until(
    () => api(frame).getPage() === "terminal",
    "paused Exit returns to Terminal",
  );
  equal(
    api(frame).getSave().story.clearedStages,
    before.story.clearedStages,
    "Aborted retry does not count as completion",
  );
  preserved(frame, before);
  click(
    frame,
    `[data-action='retry-terminal-chapter'][data-chapter-id='${chapter}']`,
  );
  await page(frame, intro);
}
function clearData(): void {
  required<HTMLIFrameElement>(document, "#fixture-game").src = "about:blank";
  for (const prefix of namespaces)
    new NamespacedStorage(localStorage, prefix).clear();
  namespaces.clear();
}
async function runChecks(): Promise<void> {
  const button = required<HTMLButtonElement>(document, "#run-checks");
  button.disabled = true;
  const status = required<HTMLElement>(document, "#fixture-status");
  status.dataset["state"] = "running";
  const results = required<HTMLElement>(document, "#fixture-results");
  results.replaceChildren();
  const original = localStorage.getItem(SAVE_STORAGE_KEY);
  let failures = 0;
  let count = 0;
  for (const [id, run] of Object.entries(checks)) {
    if (params.get("case") && params.get("case") !== id) continue;
    count++;
    const row = document.createElement("li");
    row.dataset["check"] = id;
    row.textContent = `RUNNING · ${id}`;
    results.append(row);
    try {
      await run();
      equal(
        localStorage.getItem(SAVE_STORAGE_KEY),
        original,
        "Normal save untouched",
      );
      row.dataset["state"] = "passed";
      row.textContent = `PASS · ${id}`;
    } catch (error) {
      failures++;
      row.dataset["state"] = "failed";
      row.textContent = `FAIL · ${id}\n${error instanceof Error ? error.stack : String(error)}`;
    }
  }
  status.dataset["state"] = failures || count === 0 ? "failed" : "passed";
  status.textContent = `${count - failures} PASSED · ${failures} FAILED`;
  button.disabled = false;
}
if (params.get("frame") === "1") {
  void bootChild().catch((error: unknown) => {
    document.body.dataset["fixtureError"] = String(error);
    document.body.dataset["fixtureReady"] = "true";
  });
} else {
  required(document, "#run-checks").addEventListener(
    "click",
    () => void runChecks(),
  );
  required(document, "#clear-checks").addEventListener("click", clearData);
}
