import { CABINET_RESULT_SETTLE_MS } from "../../../src/ui/CabinetResultInput";
import {
  createDefaultSave,
  type QuantumBoxSave,
} from "../../../src/save/types";
import { SAVE_STORAGE_KEY } from "../../../src/save/SaveRepository";
import {
  recordSkiPixlArcadeResult,
  recordQuantmanArcadeResult,
  ORIGINAL_QUANTMAN_TOPOLOGY_ID,
  ORIGINAL_QUANTMAN_TOPOLOGY_SHA256,
  ORIGINAL_QUANTMAN_TOPOLOGY_LABEL,
} from "../../../src/save/ArcadeRecords";
import type { QuantumBoxTestApi } from "../../../src/app/QuantumBoxApp";
import type {
  ArcadeScoreboardRequest,
  QuantumBoxShell,
} from "../../../src/ui/QuantumBoxShell";

const params = new URLSearchParams(location.search);
const namespaceRoot = "quantum-box/arcade-release-test/";
const createdNamespaces = new Set<string>();
type Cabinet = "qong" | "skipixl" | "quantman" | "fluxball" | "quag";
interface Observation {
  cabinet: Cabinet;
  tick: number;
  paused: boolean;
  phase: string;
  serial: number;
  humanCount?: number;
  competitorCount?: number;
  paddleY?: number;
  observations?: number;
}
interface Measurements {
  frames: number;
  meanMs: number | null;
  p95Ms: number | null;
  worstMs: number | null;
  over50Ms: number;
  longTasks: { count: number; totalMs: number; worstMs: number } | null;
  hiddenFrames: number;
  externalResources: string[];
  errors: string[];
}
interface ArcadeQaApi {
  observation(): Readonly<Observation> | null;
  measurements(): Measurements;
  resetMeasurements(): void;
  showSeededScores(request: ArcadeScoreboardRequest): void;
}
declare global {
  interface Window {
    __ARCADE_QA__?: ArcadeQaApi;
  }
}

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

function seedFor(scores: boolean): QuantumBoxSave {
  const save = createDefaultSave();
  if (!scores)
    return { ...save, settings: { ...save.settings, soundMuted: true } };
  const pack = {
    packId: "arcade-ui-test-only",
    contentSha256: "a".repeat(64),
    schemaVersion: "fixture-v1",
    source: "synthetic-control" as const,
  };
  const ski = recordSkiPixlArcadeResult(
    save.arcadeRecords,
    {
      kind: "skipixl",
      difficulty: "easy",
      runId: "fixture-ski",
      rulesVersion: "ui-fixture-v1",
      pack,
      officialTimeMs: 60000,
      missedGates: 0,
      collisions: 0,
    },
    "YOU",
  );
  const records = recordQuantmanArcadeResult(
    ski,
    {
      kind: "quantman",
      mechanic: "stabilize-gaze",
      runId: "fixture-quantman",
      rulesVersion: "ui-fixture-v1",
      pack,
      topologyId: ORIGINAL_QUANTMAN_TOPOLOGY_ID,
      topologyLabel: ORIGINAL_QUANTMAN_TOPOLOGY_LABEL,
      authoredTopologySha256: ORIGINAL_QUANTMAN_TOPOLOGY_SHA256,
      score: 4000,
      outcome: "lost",
      remainingLives: 0,
      activeTicks: 100,
    },
    "YOU",
  );
  return {
    ...save,
    arcadeRecords: records,
    settings: { ...save.settings, soundMuted: true },
  };
}

async function bootChild(): Promise<void> {
  document.documentElement.classList.add("fixture-child");
  document.querySelector("#fixture-controls")?.remove();
  document.querySelector(".fixture-viewport")?.remove();
  const run = params.get("run");
  assert(run && /^[a-zA-Z0-9-]+$/.test(run), "Unique test run ID required");
  const storage = new IsolatedStorage(
    window.localStorage,
    `${namespaceRoot}${run}/`,
  );
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  if (!storage.getItem("initialized")) {
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(seedFor(params.get("seed") === "scores")),
    );
    storage.setItem("initialized", "true");
  }
  const errors: string[] = [];
  const attemptedExternal = new Set<string>();
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      location.href,
    );
    if (/^https?:$/.test(url.protocol) && url.origin !== location.origin)
      attemptedExternal.add(url.href);
    return nativeFetch(input, init);
  };
  window.addEventListener("error", (event) => errors.push(event.message));
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => errors.push(String(event.reason)),
  );
  let intervals: number[] = [];
  let hiddenFrames = 0;
  let lastFrame: number | null = null;
  let tasks: number[] = [];
  const supportsLongTasks =
    PerformanceObserver.supportedEntryTypes.includes("longtask");
  if (supportsLongTasks)
    new PerformanceObserver((list) => {
      tasks.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: "longtask", buffered: false });
  const frame = (now: number): void => {
    if (document.hidden) hiddenFrames++;
    if (lastFrame !== null) intervals.push(now - lastFrame);
    lastFrame = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const external = (): string[] => [
    ...new Set([
      ...attemptedExternal,
      ...performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => {
          const url = new URL(name, location.href);
          return (
            /^https?:$/.test(url.protocol) && url.origin !== location.origin
          );
        }),
    ]),
  ];
  const { ScreenScene } = await import("../../../src/game/ScreenScene");
  const { QuantumBoxShell: Shell } = await import(
    "../../../src/ui/QuantumBoxShell"
  );
  let observation: Observation | null = null;
  let serial = 0;
  let shell: QuantumBoxShell | null = null;
  const showPage = Shell.prototype.showPage;
  Shell.prototype.showPage = function (...args) {
    shell = this;
    return showPage.apply(this, args);
  };
  // Fixture-only observers leave every production render and simulation call intact.
  const qong = ScreenScene.prototype.showQong;
  ScreenScene.prototype.showQong = function (...args) {
    const [s, opponent, paused] = args;
    observation = {
      cabinet: "qong",
      tick: s.tick,
      phase: s.phase,
      paused,
      serial: ++serial,
      paddleY: s.leftPaddleY,
      observations: s.observationsRemaining,
      humanCount: opponent === "local" ? 2 : 1,
    };
    return qong.apply(this, args);
  };
  const ski = ScreenScene.prototype.showSkiPixl;
  ScreenScene.prototype.showSkiPixl = function (...args) {
    observation = {
      cabinet: "skipixl",
      tick: args[0].tick,
      phase: args[0].phase,
      paused: args[2],
      serial: ++serial,
    };
    return ski.apply(this, args);
  };
  const flux = ScreenScene.prototype.showFluxball;
  ScreenScene.prototype.showFluxball = function (...args) {
    const s = args[0];
    observation = {
      cabinet: "fluxball",
      tick: s.sport?.tick ?? 0,
      phase: s.phase,
      paused: args[1],
      serial: ++serial,
      humanCount: s.format.humanPlayerIds.length,
      competitorCount: s.format.competitorCount,
    };
    return flux.apply(this, args);
  };
  const quant = ScreenScene.prototype.showQuantmanSynthetic;
  ScreenScene.prototype.showQuantmanSynthetic = function (...args) {
    observation = {
      cabinet: "quantman",
      tick: args[0].simulation.tick,
      phase: args[0].simulation.phase,
      paused: args[1],
      serial: ++serial,
    };
    return quant.apply(this, args);
  };
  const quarry = ScreenScene.prototype.showQuag;
  ScreenScene.prototype.showQuag = function (...args) {
    observation = {
      cabinet: "quag",
      tick: args[0].tick,
      phase: args[0].phase,
      paused: args[1],
      serial: ++serial,
      humanCount: args[0].humanPlayerIds.length,
    };
    return quarry.apply(this, args);
  };
  window.__ARCADE_QA__ = {
    observation: () => observation,
    resetMeasurements: () => {
      intervals = [];
      hiddenFrames = 0;
      lastFrame = null;
      tasks = [];
    },
    measurements: () => {
      const sorted = [...intervals].sort((a, b) => a - b);
      return {
        frames: sorted.length,
        meanMs: sorted.length
          ? intervals.reduce((sum, n) => sum + n, 0) / sorted.length
          : null,
        p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? null,
        worstMs: sorted.at(-1) ?? null,
        over50Ms: sorted.filter((n) => n > 50).length,
        longTasks: supportsLongTasks
          ? {
              count: tasks.length,
              totalMs: tasks.reduce((sum, n) => sum + n, 0),
              worstMs: Math.max(0, ...tasks),
            }
          : null,
        hiddenFrames,
        externalResources: external(),
        errors: [...errors],
      };
    },
    showSeededScores: (request) => {
      assert(
        params.get("seed") === "scores",
        "Score UI injection restricted to seeded score fixture",
      );
      assert(shell, "Shell not observed");
      shell.showArcadeScoreboard(request);
    },
  };
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  assert(element, `Missing UI: ${selector}`);
  return element;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
async function until(
  predicate: () => boolean,
  label: string,
  timeout = 15000,
): Promise<void> {
  const started = performance.now();
  while (!predicate()) {
    assert(performance.now() - started < timeout, `Timed out: ${label}`);
    await delay(25);
  }
}
function doc(frame: HTMLIFrameElement): Document {
  assert(frame.contentDocument, "Same-origin frame unavailable");
  return frame.contentDocument;
}
function api(frame: HTMLIFrameElement): QuantumBoxTestApi {
  const value = frame.contentWindow?.__QUANTUM_BOX_TEST__;
  assert(value, "App QA API unavailable");
  return value;
}
function qa(frame: HTMLIFrameElement): ArcadeQaApi {
  const value = frame.contentWindow?.__ARCADE_QA__;
  assert(value, "Fixture observers unavailable");
  return value;
}
function observed(frame: HTMLIFrameElement): Readonly<Observation> {
  const value = qa(frame).observation();
  assert(value, "No runtime render observed");
  return value;
}
function click(frame: HTMLIFrameElement, selector: string): void {
  const target = required<HTMLButtonElement>(doc(frame), selector);
  assert(
    !target.disabled && !target.hidden && target.getClientRects().length > 0,
    `Control not actionable: ${selector}`,
  );
  target.click();
}
function key(
  frame: HTMLIFrameElement,
  type: "keydown" | "keyup",
  code: string,
  value = code,
): void {
  const d = doc(frame);
  const target = d.activeElement?.closest("#app")
    ? d.activeElement
    : required<HTMLElement>(d, "#app");
  assert(target, "Keyboard target missing");
  target.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key: value,
      bubbles: true,
      cancelable: true,
    }),
  );
}
function press(frame: HTMLIFrameElement, code: string, value = code): void {
  key(frame, "keydown", code, value);
  key(frame, "keyup", code, value);
}
async function newFrame(
  frame: HTMLIFrameElement,
  seed = "empty",
): Promise<void> {
  const id = crypto.randomUUID();
  createdNamespaces.add(`${namespaceRoot}${id}/`);
  const old = frame.contentDocument;
  frame.src = `${location.pathname}?frame=1&run=${id}&seed=${seed}`;
  await until(
    () =>
      frame.contentDocument !== old &&
      frame.contentDocument?.body?.dataset["fixtureReady"] === "true",
    "isolated frame boot",
    30000,
  );
  click(frame, "[data-action='press-start']");
}
async function reload(frame: HTMLIFrameElement): Promise<void> {
  const old = frame.contentDocument;
  frame.contentWindow?.location.reload();
  await until(
    () =>
      frame.contentDocument !== old &&
      frame.contentDocument?.body?.dataset["fixtureReady"] === "true",
    "reload",
    30000,
  );
  click(frame, "[data-action='press-start']");
}
interface Mode {
  game: "qong" | "skipixl" | "quantman" | "fluxball" | "quarry";
  mode: string;
  humans: 1 | 2;
}
const modes: Mode[] = [
  { game: "qong", mode: "HUMAN / CPU", humans: 1 },
  { game: "qong", mode: "LOCAL TWO PLAYER", humans: 2 },
  ...["EASY", "MEDIUM", "HARD"].map((mode) => ({
    game: "skipixl" as const,
    mode,
    humans: 1 as const,
  })),
  ...["HOLD", "INVERT"].map((mode) => ({
    game: "quantman" as const,
    mode,
    humans: 1 as const,
  })),
  ...[
    "2 PLAYER / GLOBAL",
    "2 PLAYER / INDIVIDUAL",
    "4 PLAYER / GLOBAL",
    "4 PLAYER / INDIVIDUAL",
  ].flatMap((mode) =>
    ([1, 2] as const).map((humans) => ({
      game: "fluxball" as const,
      mode,
      humans,
    })),
  ),
  { game: "quarry", mode: "1 PLAYER", humans: 1 },
  { game: "quarry", mode: "2 PLAYER", humans: 2 },
];
async function launch(frame: HTMLIFrameElement, mode: Mode): Promise<void> {
  click(frame, "[data-action='navigate'][data-page='arcade']");
  click(
    frame,
    `[data-action='open-arcade-cabinet'][data-game-id='${mode.game}']`,
  );
  const oldSerial = qa(frame).observation()?.serial ?? 0;
  click(frame, `[data-action='launch-arcade'][data-mode='${mode.mode}']`);
  if (mode.game === "fluxball") {
    await until(
      () => Boolean(doc(frame).querySelector("[data-action='lobby-start']")),
      "Fluxball human selector",
    );
    equal(
      [
        ...doc(frame).querySelectorAll<HTMLElement>(
          "[data-action='lobby-start']",
        ),
      ].map((e) => e.dataset["humanCount"]),
      ["1", "2"],
      "Visible human options",
    );
    click(
      frame,
      `[data-action='lobby-start'][data-human-count='${mode.humans}']`,
    );
  }
  const cabinet = mode.game === "quarry" ? "quag" : mode.game;
  await until(
    () =>
      qa(frame).observation()?.cabinet === cabinet &&
      observed(frame).serial > oldSerial,
    `${mode.game} runtime launch`,
  );
  equal(
    doc(frame).querySelector(".qb-shell")?.getAttribute("data-view"),
    "cabinet",
    "Cabinet visible",
  );
  if (observed(frame).humanCount !== undefined)
    equal(observed(frame).humanCount, mode.humans, "Human runtime assignment");
  if (mode.game === "fluxball")
    equal(
      observed(frame).competitorCount,
      Number(mode.mode[0]),
      "Competitor count retains four-way CPU play",
    );
}
async function exit(frame: HTMLIFrameElement): Promise<void> {
  if (
    !observed(frame).paused &&
    !["complete", "lost"].includes(observed(frame).phase)
  ) {
    press(frame, "KeyP", "p");
    await until(() => observed(frame).paused, "pause before exit");
  }
  const cabinet = observed(frame).cabinet;
  click(
    frame,
    `.qb-cabinet-ui[data-cabinet='${cabinet}'] [data-action='cabinet-back']`,
  );
  await until(
    () =>
      doc(frame).querySelector(".qb-shell")?.getAttribute("data-view") ===
      "menu",
    "exit to menu",
  );
  // Return through visible navigation rather than the QA navigate helper.
  const returnStarted = performance.now();
  while (api(frame).getPage() !== "main") {
    assert(
      performance.now() - returnStarted < 3000,
      "Back navigation did not reach main menu",
    );
    click(frame, "[data-action='back']");
    await delay(30);
  }
}
function cleanMeasurements(frame: HTMLIFrameElement): Measurements {
  const measurement = qa(frame).measurements();
  equal(measurement.errors, [], "Browser errors");
  equal(measurement.externalResources, [], "External resource requests");
  assert(measurement.frames > 5, "Not enough real animation-frame samples");
  assert(
    measurement.hiddenFrames === 0,
    "Timing run became hidden; rerun with the tab visible",
  );
  return measurement;
}

async function allModes(
  frame: HTMLIFrameElement,
  note: (text: string) => void,
): Promise<void> {
  await newFrame(frame);
  const storyBefore = api(frame).getSave().story;
  qa(frame).resetMeasurements();
  for (const mode of modes) {
    note(`Running ${mode.game} ${mode.mode}, ${mode.humans} human(s)`);
    await launch(frame, mode);
    // Quantman waits for a player start/direction before advancing its clock.
    if (mode.game === "quantman") press(frame, "Space", " ");
    const initial = observed(frame).tick;
    await until(
      () => observed(frame).tick > initial + 10,
      "live simulation advances",
    );
    press(frame, "KeyP", "p");
    await until(() => observed(frame).paused, "pause key");
    const stopped = observed(frame).tick;
    await delay(180);
    equal(observed(frame).tick, stopped, "Paused simulation is frozen");
    press(frame, "KeyP", "p");
    await until(
      () => !observed(frame).paused && observed(frame).tick > stopped + 5,
      "resume key advances simulation",
    );
    press(frame, "KeyP", "p");
    await until(() => observed(frame).paused, "pause for restart");
    const cabinet = observed(frame).cabinet;
    const oldSerial = observed(frame).serial;
    click(frame, `[data-action='${cabinet}-replay']`);
    await until(
      () => observed(frame).serial > oldSerial && !observed(frame).paused,
      "restart",
    );
    assert(observed(frame).tick < stopped, "Restart must reset runtime ticks");
    await exit(frame);
  }
  equal(
    api(frame).getSave().story,
    storyBefore,
    "Arcade launch/restart cannot change Story progress",
  );
  note(
    `All ${modes.length} configurations: launch, live ticks, pause, resume, restart, exit. ${JSON.stringify(cleanMeasurements(frame))}`,
  );
}

async function controls(
  frame: HTMLIFrameElement,
  note: (text: string) => void,
): Promise<void> {
  await newFrame(frame);
  click(frame, "[data-page='settings']");
  click(frame, "[data-settings-section='controls']");
  equal(
    [
      ...doc(frame).querySelectorAll<HTMLElement>(
        "[data-action='settings-player']",
      ),
    ].map((e) => e.dataset["playerId"]),
    ["A", "B"],
    "Only A/B remapping is visible",
  );
  click(frame, "[data-action='rebind-key'][data-control='up']");
  press(frame, "KeyI", "i");
  click(frame, "[data-action='rebind-key'][data-control='action']");
  press(frame, "KeyV", "v");
  equal(
    api(frame).getSave().settings.keyboardBindings.A.up,
    "KeyI",
    "Move remap saved",
  );
  equal(
    api(frame).getSave().settings.keyboardBindings.A.action,
    "KeyV",
    "Action remap saved",
  );
  click(frame, "[data-settings-section='sound']");
  const range = required<HTMLInputElement>(
    doc(frame),
    "[data-setting='soundVolume']",
  );
  range.value = "0.35";
  range.dispatchEvent(new Event("change", { bubbles: true }));
  click(frame, "[data-setting='soundMuted']");
  equal(api(frame).getSave().settings.soundMuted, false, "Mute toggle");
  press(frame, "KeyM", "m");
  equal(api(frame).getSave().settings.soundMuted, true, "Global mute key");
  equal(api(frame).getSave().settings.soundVolume, 0.35, "Volume saved");
  await reload(frame);
  equal(
    api(frame).getSave().settings.soundVolume,
    0.35,
    "Volume survives reload",
  );
  equal(api(frame).getSave().settings.soundMuted, true, "Mute survives reload");
  equal(
    api(frame).getSave().settings.keyboardBindings.A.up,
    "KeyI",
    "Movement binding survives reload",
  );
  equal(
    api(frame).getSave().settings.keyboardBindings.A.action,
    "KeyV",
    "Action binding survives reload",
  );
  await launch(frame, modes[0]!);
  qa(frame).resetMeasurements();
  const beforeOld = observed(frame).paddleY;
  key(frame, "keydown", "KeyW", "w");
  await delay(180);
  key(frame, "keyup", "KeyW", "w");
  equal(observed(frame).paddleY, beforeOld, "Old W binding is inactive");
  const oldCount = observed(frame).observations;
  press(frame, "Space", " ");
  await delay(80);
  equal(
    observed(frame).observations,
    oldCount,
    "Old Space binding is inactive",
  );
  key(frame, "keydown", "KeyI", "i");
  await delay(180);
  key(frame, "keyup", "KeyI", "i");
  assert(
    observed(frame).paddleY! < beforeOld!,
    "New I binding must move paddle up",
  );
  press(frame, "KeyV", "v");
  await until(
    () => observed(frame).observations === oldCount! - 1,
    "New V binding spends one observation",
  );
  key(frame, "keydown", "KeyI", "i");
  await delay(80);
  frame.contentWindow?.dispatchEvent(new Event("blur"));
  await until(() => observed(frame).paused, "Focus loss pauses game");
  const atBlur = observed(frame).paddleY;
  press(frame, "KeyP", "p");
  await until(() => !observed(frame).paused, "Resume after focus loss");
  await delay(180);
  equal(
    observed(frame).paddleY,
    atBlur,
    "Held direction is released after blur",
  );
  key(frame, "keyup", "KeyI", "i");
  await exit(frame);
  note(
    `Remap, old/new bindings, persistence, volume/mute, blur release passed. ${JSON.stringify(cleanMeasurements(frame))}`,
  );
}

async function scoreUi(
  frame: HTMLIFrameElement,
  note: (text: string) => void,
): Promise<void> {
  await newFrame(frame, "scores");
  click(frame, "[data-action='navigate'][data-page='arcade']");
  const storyBefore = api(frame).getSave().story;
  for (const [gameId, mode, sequence, initials] of [
    ["skipixl", "EASY", 1, "SKI"],
    ["quantman", "HOLD", 2, "QNT"],
  ] as const) {
    note(`SEEDED UI FIXTURE: ${gameId} score entry; these are not earned runs`);
    qa(frame).showSeededScores({
      gameId,
      mode,
      highlightRecordSequence: sequence,
      resultLabel: null,
      initialsEditable: true,
    });
    await until(
      () => Boolean(doc(frame).querySelector("[data-arcade-score-form]")),
      "initials entry",
    );
    assert(
      !doc(frame).querySelector("[data-action='activate-page-control']"),
      "Score page must not contain a selectable SELECT hint",
    );
    required<HTMLElement>(doc(frame), "[data-initial-slot='0']").focus();
    for (const letter of initials)
      press(frame, `Key${letter}`, letter.toLowerCase());
    equal(
      required<HTMLInputElement>(doc(frame), "[data-arcade-score-initials]")
        .value,
      initials,
      "Typed initials",
    );
    click(frame, "[data-action='save-initials']");
    await until(
      () => !doc(frame).querySelector("[data-arcade-score-form]"),
      "initials save returns to score table",
    );
    equal(
      doc(frame).querySelectorAll(".qb-scoreboard-table ol > li").length,
      5,
      "Five ranked score rows",
    );
    const headers = [
      ...doc(frame).querySelectorAll("[role='columnheader']"),
    ].map((e) => e.textContent);
    equal(
      headers,
      ["RANK", "INITIALS", gameId === "skipixl" ? "TIME" : "SCORE"],
      "Primary score table columns",
    );
    assert(
      !headers.some((text) => /RESULT|MAZE|MISSED|HITS/.test(text ?? "")),
      "Scores contain only primary score/time metadata",
    );
  }
  await reload(frame);
  const save = api(frame).getSave();
  equal(
    save.arcadeRecords.skipixl.easy[0]?.initials,
    "SKI",
    "Ski initials persisted",
  );
  equal(
    save.arcadeRecords.quantman["stabilize-gaze"][
      ORIGINAL_QUANTMAN_TOPOLOGY_ID
    ]?.[0]?.initials,
    "QNT",
    "Failed Quantman record initials persisted",
  );
  equal(save.story, storyBefore, "Score entry preserves Story progress");
  note(
    "SEEDED UI FIXTURE passed: SkiPixl time and failed Quantman score accept initials, persist reload, and use simplified tables. Natural completion is not asserted by this case.",
  );
}

async function soak(
  frame: HTMLIFrameElement,
  note: (text: string) => void,
): Promise<void> {
  await newFrame(frame);
  qa(frame).resetMeasurements();
  const readings: Record<string, Measurements> = {};
  for (const mode of [modes[0]!, modes[11]!, modes[16]!]) {
    await launch(frame, mode);
    note(`Real-time soak: ${mode.game}, 60 seconds`);
    qa(frame).resetMeasurements();
    const firstTick = observed(frame).tick;
    const started = performance.now();
    let lastTick = firstTick;
    let advancedTicks = 0;
    while (performance.now() - started < 60000) {
      const current = observed(frame);
      advancedTicks += Math.max(0, current.tick - lastTick);
      lastTick = current.tick;
      if (current.cabinet === "fluxball" && current.phase === "reveal")
        click(frame, "[data-action='fluxball-continue']");
      if (current.phase === "complete") {
        const again = [
          ...doc(frame).querySelectorAll<HTMLButtonElement>(
            `.qb-cabinet-ui[data-cabinet='${current.cabinet}'] button`,
          ),
        ].find(
          (button) =>
            button.textContent === "PLAY AGAIN" &&
            !button.hidden &&
            button.getClientRects().length > 0,
        );
        assert(again, "Completed soak run offers Play Again");
        again.click();
      }
      await delay(100);
    }
    assert(
      advancedTicks > 60,
      "Live soak must advance at least one simulation second",
    );
    readings[mode.game] = cleanMeasurements(frame);
    await exit(frame);
  }
  note(
    `Measured (no pass/fail speed threshold; longTasks=null means unsupported): ${JSON.stringify(readings)}`,
  );
}

async function naturalCompletion(
  frame: HTMLIFrameElement,
  note: (text: string) => void,
  game?: Mode["game"],
): Promise<void> {
  const results: {
    game: string;
    seconds: number;
    phase: string;
    ticks: number;
    measurements: Measurements;
    earnedRecord?: boolean;
  }[] = [];
  const selectedGame = game ?? params.get("game");
  const selected = [
    modes[0]!,
    modes[2]!,
    modes[5]!,
    modes[7]!,
    modes[15]!,
  ].filter((mode) => !selectedGame || selectedGame === mode.game);
  assert(selected.length > 0, "Unknown completion game");
  for (const mode of selected) {
    await newFrame(frame);
    const storyBefore = api(frame).getSave().story;
    const recordSequenceBefore =
      api(frame).getSave().arcadeRecords.nextSequence;
    await launch(frame, mode);
    qa(frame).resetMeasurements();
    const started = performance.now();
    const limit = mode.game === "quarry" ? 240000 : 180000;
    note(
      `NATURAL COMPLETION: ${mode.game}; live simulation, up to ${limit / 1000}s. No result/session injection.`,
    );
    if (mode.game === "skipixl") key(frame, "keydown", "KeyS", "s");
    if (mode.game === "quantman") press(frame, "Space", " ");
    try {
      await until(
        () => {
          const current = observed(frame);
          if (mode.game === "fluxball" && current.phase === "reveal")
            click(frame, "[data-action='fluxball-continue']");
          return current.phase === "complete" || current.phase === "lost";
        },
        `${mode.game} natural completion`,
        limit,
      );
    } finally {
      if (mode.game === "skipixl") key(frame, "keyup", "KeyS", "s");
    }
    if (mode.game === "skipixl" || mode.game === "quantman") {
      // The final frame is presented before the completion callback saves its
      // score and selects the qualifying-result controls.
      await until(
        () =>
          api(frame).getSave().arcadeRecords.nextSequence >
          recordSequenceBefore,
        "natural result finishes saving its earned score",
      );
    }
    const current = observed(frame);
    const panel = `.qb-cabinet-ui[data-cabinet='${current.cabinet}']`;
    assert(!current.paused, "Completion must be earned by an unpaused runtime");
    equal(
      doc(frame)
        .querySelector("[data-ui='game']")
        ?.getAttribute("data-navigation"),
      "true",
      "Completion presents navigable choices",
    );
    if (mode.game === "quantman") {
      equal(current.phase, "lost", "Natural Quantman loss");
      assert(
        required<HTMLElement>(
          doc(frame),
          "[data-quantman='state']",
        ).textContent?.includes("GAME OVER"),
        "Quantman loss says GAME OVER",
      );
    }
    const measurement = cleanMeasurements(frame);
    const result = {
      game: mode.game,
      seconds: (performance.now() - started) / 1000,
      phase: current.phase,
      ticks: current.tick,
      measurements: measurement,
      earnedRecord: false,
    };
    const scoreEntry = mode.game === "skipixl" || mode.game === "quantman";
    const completionAction = scoreEntry
      ? `${mode.game}-continue`
      : "cabinet-back";
    const next = required<HTMLButtonElement>(
      doc(frame),
      `${panel} [data-action='${completionAction}']`,
    );
    equal(
      next.textContent,
      scoreEntry ? "CONTINUE" : "BACK TO ARCADE",
      "Completion action label",
    );
    assert(
      next.getClientRects().length > 0 && !next.disabled,
      "Completion action is available",
    );
    if (scoreEntry) {
      equal(
        required<HTMLElement>(
          doc(frame),
          `${panel} [data-action='cabinet-back']`,
        ).getClientRects().length,
        0,
        "Qualifying scores cannot bypass initials entry",
      );
    }
    await delay(CABINET_RESULT_SETTLE_MS + 50);
    click(frame, `${panel} [data-action='${completionAction}']`);
    await until(
      () =>
        doc(frame).querySelector(".qb-shell")?.getAttribute("data-view") ===
        "menu",
      "completion exits live cabinet",
    );
    if (mode.game === "skipixl" || mode.game === "quantman") {
      await until(
        () => Boolean(doc(frame).querySelector("[data-arcade-score-form]")),
        "naturally earned high-score entry",
      );
      required<HTMLElement>(doc(frame), "[data-initial-slot='0']").focus();
      for (const letter of "RUN")
        press(frame, `Key${letter}`, letter.toLowerCase());
      equal(
        required<HTMLInputElement>(doc(frame), "[data-arcade-score-initials]")
          .value,
        "RUN",
        "Natural-result initials",
      );
      click(frame, "[data-action='save-initials']");
      await until(
        () => !doc(frame).querySelector("[data-arcade-score-form]"),
        "natural score save",
      );
      const save = api(frame).getSave();
      const entries =
        mode.game === "skipixl"
          ? save.arcadeRecords.skipixl.easy
          : Object.values(save.arcadeRecords.quantman["stabilize-gaze"]).flat();
      assert(
        entries.some((entry) => entry.initials === "RUN"),
        "Earned score record stores typed initials",
      );
      result.earnedRecord = true;
    }
    equal(
      api(frame).getSave().story,
      storyBefore,
      "Natural Arcade results preserve Story",
    );
    results.push(result);
    note(`NATURAL COMPLETION evidence: ${JSON.stringify(results)}`);
  }
}

const checks = [
  ...(["qong", "skipixl", "quantman", "fluxball", "quarry"] as const).map(
    (game) => ({
      id: `completion-${game}`,
      label: `OPT-IN: natural ${game} completion`,
      run: (frame: HTMLIFrameElement, note: (text: string) => void) =>
        naturalCompletion(frame, note, game),
    }),
  ),
  {
    id: "completion",
    label: "OPT-IN: natural Arcade completions (no injected outcomes)",
    run: naturalCompletion,
  },
  {
    id: "modes",
    label:
      "17 Arcade configurations + repeated launch/pause/resume/restart/exit",
    run: allModes,
  },
  {
    id: "controls",
    label:
      "Keyboard remaps, persistence, old-key removal, focus reset, sound settings",
    run: controls,
  },
  {
    id: "scores",
    label: "SEEDED UI FIXTURE: high-score initials and simplified tables",
    run: scoreUi,
  },
  {
    id: "soak",
    label: "Real-time animation-frame and long-task observations",
    run: soak,
  },
];
function clearNamespaces(): void {
  for (const prefix of createdNamespaces)
    new IsolatedStorage(localStorage, prefix).clear();
  createdNamespaces.clear();
}
async function runChecks(): Promise<void> {
  const button = required<HTMLButtonElement>(document, "#run-checks");
  const status = required<HTMLElement>(document, "#fixture-status");
  const results = required<HTMLOListElement>(document, "#fixture-results");
  const frame = required<HTMLIFrameElement>(document, "#fixture-game");
  const normalSave = localStorage.getItem(SAVE_STORAGE_KEY);
  button.disabled = true;
  results.replaceChildren();
  status.dataset["state"] = "running";
  let failures = 0;
  const selectedChecks = checks.filter((check) =>
    params.has("case")
      ? check.id === params.get("case")
      : !check.id.startsWith("completion"),
  );
  try {
    if (!selectedChecks.length) {
      failures++;
      results.textContent = `Unknown check: ${params.get("case")}`;
    }
    for (const check of selectedChecks) {
      const row = document.createElement("li");
      row.dataset["check"] = check.id;
      row.dataset["state"] = "running";
      results.append(row);
      let lastNote = "Starting";
      const note = (text: string): void => {
        lastNote = text;
        row.textContent = `${check.label}\n${text}`;
        status.textContent = text;
      };
      note("Starting");
      try {
        await check.run(frame, note);
        equal(
          localStorage.getItem(SAVE_STORAGE_KEY),
          normalSave,
          "Normal installed save untouched",
        );
        row.dataset["state"] = "passed";
      } catch (error) {
        failures++;
        row.dataset["state"] = "failed";
        const runtime =
          frame.contentWindow?.__ARCADE_QA__?.observation() ?? null;
        row.textContent = `${check.label}\nLast operation: ${lastNote}\nObserved runtime: ${JSON.stringify(runtime)}\n${error instanceof Error ? error.stack : String(error)}`;
      }
    }
  } finally {
    button.disabled = false;
    status.dataset["state"] = failures ? "failed" : "passed";
    status.textContent = failures
      ? `${failures} CHECK(S) FAILED`
      : "ALL CHECKS PASSED — see evidence scope per case";
  }
}
if (params.get("frame") === "1")
  void bootChild().catch((error: unknown) => {
    document.body.dataset["fixtureError"] = String(error);
    document.body.textContent = String(error);
  });
else {
  required<HTMLButtonElement>(document, "#run-checks").addEventListener(
    "click",
    () => void runChecks(),
  );
  required<HTMLButtonElement>(document, "#clear-checks").addEventListener(
    "click",
    () => {
      const frame = required<HTMLIFrameElement>(document, "#fixture-game");
      frame.src = "about:blank";
      clearNamespaces();
      required<HTMLElement>(document, "#fixture-status").textContent =
        "TEST NAMESPACES CLEARED";
    },
  );
}
