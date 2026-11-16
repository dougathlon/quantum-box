import { pixelTextWidth } from "../../../src/display/PixelText";
import type { RunContext } from "../../../src/core/run";
import type { StoryStageId } from "../../../src/games/registry";
import { SAVE_STORAGE_KEY } from "../../../src/save/SaveRepository";
import { createDefaultSave } from "../../../src/save/types";
import { storyStageIntroNodeId } from "../../../src/story/terminal";
const params = new URLSearchParams(location.search);
const namespaceRoot = "quantum-box/cabinet-outcomes-test/";
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

type Cabinet = "qong" | "skipixl" | "quantman" | "fluxball" | "quarry";
type Outcome = "won" | "lost" | "shared" | "draw";
interface Case {
  stage: StoryStageId;
  game: Cabinet;
  mode: string;
  playMode: "story" | "arcade";
  outcome: Outcome;
}
const stages: { stage: StoryStageId; game: Cabinet; mode: string }[] = [
  { stage: "qong", game: "qong", mode: "HUMAN / CPU" },
  { stage: "skipixl-feasible", game: "skipixl", mode: "EASY" },
  { stage: "skipixl-overloaded", game: "skipixl", mode: "HARD" },
  { stage: "quantman-hold", game: "quantman", mode: "HOLD" },
  { stage: "fluxball-global", game: "fluxball", mode: "2 PLAYER / GLOBAL" },
  {
    stage: "fluxball-individual",
    game: "fluxball",
    mode: "2 PLAYER / INDIVIDUAL",
  },
  { stage: "quarry", game: "quarry", mode: "1 PLAYER" },
];
const cases: Case[] = stages.flatMap((s) =>
  (["story", "arcade"] as const).flatMap((playMode) =>
    (["lost", "won"] as const).map((outcome) => ({ ...s, playMode, outcome })),
  ),
);
for (const playMode of ["story", "arcade"] as const)
  for (const outcome of ["shared", "draw"] as const)
    cases.push({ ...stages[6]!, playMode, outcome });
interface Control {
  finish(): void;
  run(): RunContext | null;
}
declare global {
  interface Window {
    __CABINET_OUTCOME_FIXTURE__?: Control;
  }
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function required<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  assert(el, `Missing ${selector}`);
  return el;
}
async function until(test: () => boolean, label: string): Promise<void> {
  const start = performance.now();
  while (!test()) {
    assert(performance.now() - start < 20000, `Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
function click(d: Document, selector: string): void {
  const el = [...d.querySelectorAll<HTMLButtonElement>(selector)].find(
    (e) => !e.hidden && !e.disabled && e.getClientRects().length,
  );
  assert(el, `No visible button ${selector}`);
  el.click();
}
function key(w: Window, code: string): void {
  for (const type of ["keydown", "keyup"])
    w.dispatchEvent(
      new KeyboardEvent(type, {
        code,
        key: code === "Space" ? " " : code,
        bubbles: true,
        cancelable: true,
      }),
    );
}
function gameId(c: Case): string {
  return c.game === "quarry" ? "quag" : c.game;
}
function label(c: Case): string {
  return `${c.playMode} / ${c.stage} / ${c.outcome}`;
}
function state(d: Document): string | undefined {
  return d.querySelector<HTMLElement>("[data-ui='game']")?.dataset["phase"];
}
function visibleButtons(d: Document): HTMLButtonElement[] {
  return [
    ...d.querySelectorAll<HTMLButtonElement>("[data-ui='game'] footer button"),
  ].filter((e) => !e.hidden && !e.disabled && e.getClientRects().length > 0);
}

async function boot(): Promise<void> {
  document.documentElement.classList.add("fixture-child");
  document.querySelector("#fixture-controls")?.remove();
  document.querySelector("iframe")?.remove();
  const c = cases[Number(params.get("case") ?? 0)]!;
  assert(c, "Known case");
  const storage = new NamespacedStorage(
    localStorage,
    `${namespaceRoot}${params.get("run") ?? crypto.randomUUID()}/`,
  );
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  const base = createDefaultSave();
  storage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      ...base,
      settings: { ...base.settings, soundMuted: true, reducedMotion: true },
      story: { ...base.story, currentNodeId: storyStageIntroNodeId(c.stage) },
    }),
  );
  window.addEventListener(
    "error",
    (e) => (document.body.dataset["fixtureError"] = e.message),
  );
  window.addEventListener(
    "unhandledrejection",
    (e) => (document.body.dataset["fixtureError"] = String(e.reason)),
  );
  await import("../../../src/styles.css");
  await import("../../../src/display/brownBox.css");
  const { QuantumBoxApp } = await import("../../../src/app/QuantumBoxApp");
  const root = required<HTMLElement>(document, "#app");
  root.hidden = false;
  const app = new QuantumBoxApp(root);
  // Only this isolated test page can set terminal session states. Rendering,
  // runtime completion callbacks, save routing, and UI input stay production code.
  const control = app as unknown as {
    activeRun: RunContext | null;
    qongRuntime: { session: object } | null;
    skipixlRuntime: { session: object } | null;
    fluxballRuntime: { session: object } | null;
    quagRuntime: {
      session: { players: { id: string; roundWins: number; score: number }[] };
    } | null;
    quantmanRuntime: { engine: { session: object } } | null;
  };
  window.__CABINET_OUTCOME_FIXTURE__ = {
    run: () => control.activeRun,
    finish: () => {
      assert(
        control.activeRun?.gameId === c.game,
        "Actual cabinet must be launched before controlled result",
      );
      const won = c.outcome === "won";
      switch (c.game) {
        case "qong":
          Object.assign(control.qongRuntime!.session, {
            phase: "complete",
            winner: won ? "left" : "right",
            leftScore: won ? 4 : 3,
            rightScore: won ? 3 : 4,
            rallyNumber: 7,
          });
          break;
        case "skipixl":
          Object.assign(control.skipixlRuntime!.session, {
            phase: "complete",
            elapsedTicks: won ? 1200 : 12000,
          });
          break;
        case "fluxball":
          Object.assign(control.fluxballRuntime!.session, {
            phase: "complete",
            roundNumber: 3,
            roundWins: { A: won ? 3 : 0, B: won ? 0 : 3 },
          });
          break;
        case "quarry": {
          const s = control.quagRuntime!.session;
          Object.assign(s, { phase: "complete", roundNumber: 3 });
          for (const p of s.players) {
            p.roundWins =
              c.outcome === "draw"
                ? 1
                : p.id === (won ? "A" : "B") ||
                    (c.outcome === "shared" && p.id === "A")
                  ? 2
                  : 0;
            p.score = p.roundWins;
          }
          break;
        }
        case "quantman":
          Object.assign(control.quantmanRuntime!.engine.session, {
            phase: won ? "won" : "lost",
            lives: won ? 3 : 0,
            score: 1230,
          });
          break;
      }
    },
  };
  window.addEventListener("beforeunload", () => app.destroy(), { once: true });
  await until(
    () =>
      Boolean(
        document.querySelector("[data-action='press-start']:not(:disabled)"),
      ),
    "app boot",
  );
  click(document, "[data-action='press-start']");
  if (c.playMode === "story") {
    click(document, "[data-page='story-start']");
    click(document, "[data-action='continue-story']");
    for (
      let i = 0;
      i < 10 && window.__QUANTUM_BOX_TEST__!.getPage() !== "cabinet";
      i++
    ) {
      await until(
        () =>
          Boolean(document.querySelector("[data-terminal-complete='true']")),
        "Story text",
      );
      const previous = document.querySelector("[data-terminal-page]");
      click(
        document,
        "[data-terminal-action='continue'], [data-terminal-action='play']",
      );
      await until(
        () =>
          window.__QUANTUM_BOX_TEST__!.getPage() === "cabinet" ||
          previous !== document.querySelector("[data-terminal-page]"),
        "next Story page",
      );
    }
  } else {
    click(document, "[data-page='arcade']");
    click(
      document,
      `[data-action='open-arcade-cabinet'][data-game-id='${c.game}']`,
    );
    click(document, `[data-action='launch-arcade'][data-mode='${c.mode}']`);
    if (c.game === "fluxball") {
      await until(
        () => Boolean(document.querySelector("[data-action='lobby-start']")),
        "lobby",
      );
      click(document, "[data-action='lobby-start'][data-human-count='1']");
    }
  }
  await until(
    () =>
      window.__QUANTUM_BOX_TEST__!.getPage() === "cabinet" &&
      Boolean(control.activeRun),
    "runtime launch",
  );
  document.body.dataset["fixtureReady"] = "true";
  if (params.get("review") === "1") window.__CABINET_OUTCOME_FIXTURE__.finish();
}

function doc(frame: HTMLIFrameElement): Document {
  const d = frame.contentDocument;
  assert(d, "Same-origin frame");
  assert(
    !d.body?.dataset["fixtureError"],
    d.body?.dataset["fixtureError"] ?? "Browser error",
  );
  return d;
}
function win(frame: HTMLIFrameElement): Window {
  const w = frame.contentWindow;
  assert(w, "Frame window");
  return w;
}
async function load(index: number): Promise<HTMLIFrameElement> {
  const frame = required<HTMLIFrameElement>(document, "#fixture-game");
  const previous = frame.contentDocument;
  frame.src = `${location.pathname}?frame=1&case=${index}&run=${crypto.randomUUID()}`;
  await until(
    () =>
      frame.contentDocument !== previous &&
      Boolean(frame.contentDocument?.body?.dataset["fixtureReady"]),
    "child launch",
  );
  doc(frame);
  return frame;
}
async function finish(frame: HTMLIFrameElement, probe: boolean): Promise<void> {
  win(frame).__CABINET_OUTCOME_FIXTURE__!.finish();
  await until(
    () =>
      ["complete", "won", "lost", "game-over", "screen-cleared"].includes(
        state(doc(frame)) ?? "",
      ),
    "rendered completion",
  );
  if (probe) {
    key(win(frame), "Space");
    key(win(frame), "Enter");
    key(win(frame), "Backspace");
    for (const b of visibleButtons(doc(frame))) b.click();
    assert(
      win(frame).__QUANTUM_BOX_TEST__!.getPage() === "cabinet",
      "Rapid final-gameplay input must not skip the outcome",
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 750));
  assert(
    win(frame).__QUANTUM_BOX_TEST__!.getPage() === "cabinet",
    "Outcome must wait for player choice",
  );
  const before = win(frame).__CABINET_OUTCOME_FIXTURE__!.run()?.runId;
  key(win(frame), "KeyX");
  assert(
    win(frame).__QUANTUM_BOX_TEST__!.getPage() === "cabinet" &&
      win(frame).__CABINET_OUTCOME_FIXTURE__!.run()?.runId === before,
    "Hidden X retry/exit must not bypass visible result choices",
  );
}
async function check(index: number): Promise<string> {
  const c = cases[index]!;
  const frame = await load(index);
  const w = win(frame);
  const startId = w.__CABINET_OUTCOME_FIXTURE__!.run()!.runId;
  key(w, "Backspace");
  await until(() => state(doc(frame)) === "paused", "Back pauses");
  const pauseLabels = visibleButtons(doc(frame)).map((b) => b.textContent);
  assert(
    pauseLabels.some((v) => v?.includes("RESUME")) &&
      pauseLabels.some((v) => v === "RESTART") &&
      pauseLabels.some((v) => v?.includes("EXIT")),
    "Pause choices Resume/Restart/Exit",
  );
  key(w, "KeyP");
  await until(() => state(doc(frame)) !== "paused", "P resumes");
  if (c.playMode === "story") {
    const failureFlags = JSON.stringify(
      w.__QUANTUM_BOX_TEST__!.getSave().story.firstLossExplanations,
    );
    key(w, "KeyP");
    await until(
      () => state(doc(frame)) === "paused",
      "Story pause for restart",
    );
    click(doc(frame), `[data-action='${gameId(c)}-replay']`);
    await until(
      () =>
        state(doc(frame)) !== "paused" &&
        w.__QUANTUM_BOX_TEST__!.getPage() === "cabinet",
      "Story restart",
    );
    key(w, "Backspace");
    await until(
      () => state(doc(frame)) === "paused",
      "pause before Story abandonment",
    );
    key(w, "Backspace");
    await until(
      () => w.__QUANTUM_BOX_TEST__!.getPage() === "story-start",
      "abandon to Story start",
    );
    assert(
      JSON.stringify(
        w.__QUANTUM_BOX_TEST__!.getSave().story.firstLossExplanations,
      ) === failureFlags,
      "Restart and abandonment cannot count as completed failures",
    );
    click(doc(frame), "[data-action='continue-story']");
    await until(
      () => w.__QUANTUM_BOX_TEST__!.getPage() === "cabinet",
      "resume abandoned Story stage",
    );
    assert(
      w.__CABINET_OUTCOME_FIXTURE__!.run()?.storyStage === c.stage,
      "Resume preserves the Story stage",
    );
  }
  await finish(frame, true);
  const buttons = visibleButtons(doc(frame));
  const continueOnly =
    c.playMode === "arcade" &&
    (c.game === "quantman" || (c.game === "skipixl" && c.outcome === "won"));
  assert(
    buttons.length === (continueOnly ? 1 : 2),
    "Correct result choice count",
  );
  if (continueOnly)
    assert(
      buttons[0]!.textContent ===
        (c.game === "quantman" && c.outcome === "won"
          ? "NEXT MAZE"
          : "CONTINUE"),
      "Only the required continuation is visible",
    );
  const canvas = required<HTMLCanvasElement>(
    doc(frame),
    "[data-ui='bitmap-text']",
  );
  const scale = canvas.getBoundingClientRect().width / 320;
  for (const button of buttons) {
    const text = button.textContent ?? "";
    assert(
      button.dataset["bitmapText"] === text,
      "Visible bitmap label matches semantic action",
    );
    assert(
      button.getBoundingClientRect().width / scale >=
        pixelTextWidth(text, 1) + 4,
      `Entire result label fits: ${text}`,
    );
  }
  const focused = doc(frame).activeElement;
  key(w, "ArrowLeft");
  assert(
    continueOnly
      ? doc(frame).activeElement === focused
      : doc(frame).activeElement !== focused,
    "Selection cursor moves between result options",
  );
  key(w, "ArrowRight");
  assert(
    doc(frame).activeElement === focused,
    "Reverse selection restores focus",
  );
  if (c.playMode === "story") {
    assert(
      !buttons.some((b) => /RETRY|PLAY AGAIN/.test(b.textContent ?? "")),
      "Story gameplay result must not offer Retry",
    );
    click(
      doc(frame),
      `[data-action='${gameId(c) === "qong" ? "qong-observe" : gameId(c) + "-continue"}']`,
    );
    await until(
      () =>
        Boolean(doc(frame).querySelector("[data-terminal-complete='true']")),
      "narrator outcome",
    );
    const actions = [
      ...doc(frame).querySelectorAll<HTMLElement>("[data-terminal-action]"),
    ].map((b) => b.dataset["terminalAction"]);
    const won = c.outcome === "won" || c.outcome === "shared";
    const mandatoryRetry = c.stage === "qong" || c.stage === "quantman-hold";
    const expected = won
      ? ["continue"]
      : mandatoryRetry
        ? ["retry"]
        : ["retry", "continue"];
    assert(
      JSON.stringify(actions) === JSON.stringify(expected),
      `Narrator actions ${actions} expected ${expected}`,
    );
    const response = doc(frame).querySelector<HTMLElement>(
      "[data-terminal-page]",
    )!.dataset["terminalPage"];
    if (!won && mandatoryRetry) {
      click(doc(frame), "[data-terminal-action='retry']");
      await until(
        () => w.__QUANTUM_BOX_TEST__!.getPage() === "cabinet",
        "retry runtime",
      );
      await finish(frame, false);
      click(
        doc(frame),
        `[data-action='${c.game === "qong" ? "qong-observe" : "quantman-continue"}']`,
      );
      await until(
        () =>
          Boolean(doc(frame).querySelector("[data-terminal-complete='true']")),
        "later failure",
      );
      const later = [
        ...doc(frame).querySelectorAll<HTMLElement>("[data-terminal-action]"),
      ].map((b) => b.dataset["terminalAction"]);
      assert(
        JSON.stringify(later) === JSON.stringify(["retry", "continue"]),
        "Later failure permits retry or continue",
      );
    }
    return `${response}: ${expected.join(" / ")}; outcome retained and focus moves`;
  }
  if (c.game === "quantman" && c.outcome === "won") {
    key(w, "Backspace");
    assert(
      w.__QUANTUM_BOX_TEST__!.getPage() === "cabinet" &&
        w.__CABINET_OUTCOME_FIXTURE__!.run()?.runId === startId,
      "Back cannot abandon a cleared maze",
    );
    click(doc(frame), "[data-action='quantman-continue']");
    await until(
      () => w.__CABINET_OUTCOME_FIXTURE__!.run()?.runId !== startId,
      "next maze",
    );
    assert(
      w.__QUANTUM_BOX_TEST__!.getPage() === "cabinet",
      "Cleared maze continues Arcade run",
    );
    return "SCREEN CLEARED → NEXT MAZE; pause and result focus verified";
  }
  if (c.game === "skipixl" || c.game === "quantman") {
    click(
      doc(frame),
      continueOnly
        ? `[data-action='${c.game}-continue']`
        : "[data-action='cabinet-back']",
    );
    await until(
      () => w.__QUANTUM_BOX_TEST__!.getPage() === "scores",
      "scoreboard",
    );
    const offersInitials = Boolean(
      doc(frame).querySelector("[data-action='save-initials']"),
    );
    assert(
      offersInitials === (c.game === "quantman" || c.outcome === "won"),
      "Preserve score eligibility: SkiPixl qualifying times; Quantman scores including losses",
    );
    if (offersInitials) {
      click(doc(frame), "[data-initial-slot='0']");
      key(w, "ArrowUp");
      const initials = required<HTMLInputElement>(
        doc(frame),
        "[data-arcade-score-initials]",
      ).value;
      assert(initials !== "YOU", "Initials change through the visible editor");
      click(doc(frame), "[data-action='save-initials']");
      await until(
        () => !doc(frame).querySelector("[data-action='save-initials']"),
        "saved scoreboard",
      );
      const saved = w.__QUANTUM_BOX_TEST__!.getSave();
      const records =
        c.game === "skipixl"
          ? Object.values(saved.arcadeRecords.skipixl).flat()
          : Object.values(saved.arcadeRecords.quantman).flatMap((boards) =>
              Object.values(boards).flat(),
            );
      assert(
        records.some(
          (record) => record.runId === startId && record.initials === initials,
        ),
        "Edited initials persist on this run's high score",
      );
      assert(
        required<HTMLElement>(
          doc(frame),
          ".qb-scoreboard-list",
        ).textContent?.includes(initials),
        "Saved initials appear on the scoreboard",
      );
    }
    return `Result → scoreboard${offersInitials ? " / edited initials saved" : " (over-limit SkiPixl time is not recorded)"}; pause and result focus verified`;
  }
  const replay = c.game === "qong" ? "qong-observe" : gameId(c) + "-replay";
  click(doc(frame), `[data-action='${replay}']`);
  await until(
    () => w.__CABINET_OUTCOME_FIXTURE__!.run()?.runId !== startId,
    "play again",
  );
  key(w, "Backspace");
  await until(() => state(doc(frame)) === "paused", "pause replay");
  key(w, "Backspace");
  await until(
    () => w.__QUANTUM_BOX_TEST__!.getPage() !== "cabinet",
    "exit replay",
  );
  return "Result → PLAY AGAIN; Back pauses then exits to Arcade";
}
async function main(): Promise<void> {
  const select = required<HTMLSelectElement>(document, "#case");
  for (const [i, c] of cases.entries()) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = label(c);
    select.append(o);
  }
  required(document, "#review").addEventListener("click", () => {
    location.href = `${location.pathname}?frame=1&review=1&case=${select.value}&run=${crypto.randomUUID()}`;
  });
  required(document, "#run-checks").addEventListener("click", async () => {
    const status = required<HTMLElement>(document, "#fixture-status");
    status.textContent = "RUNNING";
    status.dataset["state"] = "running";
    const list = required(document, "#fixture-results");
    list.replaceChildren();
    let failed = 0;
    for (let i = 0; i < cases.length; i++) {
      const item = document.createElement("li");
      status.textContent = `RUNNING: ${i + 1}/${cases.length}`;
      item.textContent = `${label(cases[i]!)}: RUNNING`;
      list.append(item);
      try {
        item.textContent = `${label(cases[i]!)}: PASS — ${await check(i)}`;
        item.dataset["state"] = "passed";
      } catch (e) {
        failed++;
        item.textContent = `${label(cases[i]!)}: FAIL — ${String(e)}`;
        item.dataset["state"] = "failed";
        if (params.get("stop") === "1") break;
      }
    }
    status.textContent = `${failed ? "FAILED" : "PASSED"}: ${list.children.length - failed}/${list.children.length}`;
    status.dataset["state"] = failed ? "failed" : "passed";
  });
}
if (params.get("frame") === "1") void boot();
else void main();
