import { QuantumBoxShell } from "../../../src/ui/QuantumBoxShell";
import { QUANTUM_BOX_ASSETS } from "../../../src/assets/manifest";
import { createDefaultSave } from "../../../src/save/types";
import { createRunContext } from "../../../src/core/run";
import { QongSession } from "../../../src/games/qong/QongSession";
import { QONG_RULES_VERSION } from "../../../src/games/qong/types";
import { FluxballSession } from "../../../src/games/fluxball/FluxballSession";
import { FLUXBALL_TWO_CONTROL_PACK } from "../../../src/games/fluxball/fluxballControlPacks";
import { FLUXBALL_RULES_VERSION } from "../../../src/games/fluxball/types";
import {
  QuantmanSyntheticRuntime,
  type QuantmanSyntheticRuntimeSnapshot,
} from "../../../src/games/quantmanSynthetic";
import "../../../src/styles.css";
import "../../../src/display/brownBox.css";
import "../../../src/mobile/mobile.css";

document.documentElement.dataset["mobile"] = "true";
const root = document.querySelector<HTMLElement>("#app")!;
const summary = document.querySelector<HTMLOutputElement>("#summary")!;
const results = document.querySelector<HTMLOListElement>("#results")!;
const noAction = () => {};
let actions = 0;
const shell = new QuantumBoxShell(
  root,
  QUANTUM_BOX_ASSETS.display,
  createDefaultSave(),
  {
    onStartGesture: noAction,
    onInternalEntered: noAction,
    onTitleReturned: noAction,
    onPageChanged: noAction,
    onContinueStory: noAction,
    onNewStory: noAction,
    onStoryTerminalAction: noAction,
    onOpenTerminalTranscript: noAction,
    onRetryTerminalChapter: noAction,
    onLaunchArcade: noAction,
    onSettingChanged: noAction,
    onArcadeScoreInitialsSubmitted: noAction,
    onExportSave: noAction,
    onResetSave: noAction,
    onCabinetAction: () => {
      document.querySelector("#actions")!.textContent =
        `${++actions} cabinet actions`;
    },
    onFluxballLobbyAction: noAction,
  },
);
shell.enterInternal();

const qong = new QongSession(
  createRunContext({
    gameId: "qong",
    playMode: "arcade",
    rulesVersion: QONG_RULES_VERSION,
    runSeed: 17,
    pack: {
      packId: "qong-local-control-v1",
      contentSha256: "a".repeat(64),
      schemaVersion: "quantum-box-pack-v1",
      source: "synthetic-control",
    },
  }),
  { directProbability: 1 },
  "cpu",
).snapshot();
const fluxball = new FluxballSession(
  createRunContext({
    gameId: "fluxball",
    playMode: "arcade",
    rulesVersion: FLUXBALL_RULES_VERSION,
    runSeed: 19,
    pack: FLUXBALL_TWO_CONTROL_PACK,
  }),
  {
    competitorCount: 2,
    ruleMode: "global",
    roundSeconds: 40,
    humanPlayerIds: ["A"],
  },
);
let reveal = fluxball.snapshot();
while (reveal.phase === "active") reveal = fluxball.step({ players: {} });
const quantman = new QuantmanSyntheticRuntime({
  playMode: "story",
  runSeed: 67,
  mechanic: "inverse-gaze",
}).snapshot();
function quantmanResult(cleared: boolean): QuantmanSyntheticRuntimeSnapshot {
  return {
    ...quantman,
    simulation: { ...quantman.simulation, phase: cleared ? "won" : "lost" },
    terminal: {
      outcome: cleared ? "cleared" : "lost",
      cleared,
      playMode: quantman.run.playMode,
      mechanic: quantman.run.mechanic,
      runSeed: quantman.run.runSeed,
      score: quantman.simulation.score,
      remainingLives: quantman.simulation.lives,
      activeTicks: quantman.simulation.activeTick,
      fixtureId: quantman.fixture.fixtureId,
      fixtureContentSha256: quantman.fixture.fixtureContentSha256,
    },
  };
}

const cases: readonly [string, () => void, () => void][] = [
  [
    "Qong Story result",
    () => shell.beginQong("cpu", "story"),
    () =>
      shell.updateQongHud(
        { ...qong, phase: "complete", winner: "left" },
        "cpu",
        false,
      ),
  ],
  [
    "Qong Arcade result",
    () => shell.beginQong("cpu", "arcade"),
    () =>
      shell.updateQongHud(
        { ...qong, phase: "complete", winner: "left" },
        "cpu",
        false,
      ),
  ],
  [
    "Fluxball round result",
    () => shell.beginFluxball("story"),
    () => shell.updateFluxballHud(reveal, false, "story"),
  ],
  [
    "Fluxball final round",
    () => shell.beginFluxball("story"),
    () =>
      shell.updateFluxballHud(
        { ...reveal, roundNumber: reveal.totalRounds },
        false,
        "story",
      ),
  ],
  [
    "Fluxball Story result",
    () => shell.beginFluxball("story"),
    () =>
      shell.updateFluxballHud({ ...reveal, phase: "complete" }, false, "story"),
  ],
  [
    "Quantman Story result",
    () => shell.beginQuantman("story"),
    () => shell.updateQuantmanSyntheticHud(quantmanResult(false), false),
  ],
  [
    "Quantman Arcade result",
    () => shell.beginQuantman("arcade"),
    () => shell.updateQuantmanSyntheticHud(quantmanResult(false), false),
  ],
  [
    "Quantman next maze",
    () => shell.beginQuantman("arcade"),
    () => shell.updateQuantmanSyntheticHud(quantmanResult(true), false),
  ],
  [
    "Quantman paused",
    () => shell.beginQuantman("story"),
    () => shell.updateQuantmanSyntheticHud(quantman, true),
  ],
];
let liveDraw: (() => void) | undefined;
let frame = 0;
function render() {
  liveDraw?.();
  frame = requestAnimationFrame(render);
}
frame = requestAnimationFrame(render);

document
  .querySelector<HTMLButtonElement>("#run")!
  .addEventListener("click", () => {
    liveDraw = undefined;
    results.replaceChildren();
    let passed = 0;
    const record = (name: string, success: boolean) => {
      const item = document.createElement("li");
      item.dataset["result"] = success ? "pass" : "fail";
      item.textContent = `${success ? "PASS" : "FAIL"}: ${name}`;
      results.append(item);
      if (success) passed++;
    };
    shell.exitCabinet();
    shell.returnToTitle();
    shell.setLoading(true);
    shell.enterInternal();
    record(
      "Start waits for the game canvas",
      shell.getPage() === "title" &&
        root.querySelector<HTMLButtonElement>("[data-action='press-start']")!
          .disabled,
    );
    shell.setLoading(false);
    record(
      "A pending start enters after loading",
      shell.getPage() === "main" &&
        !root.querySelector<HTMLButtonElement>("[data-action='press-start']")!
          .disabled,
    );
    for (const [name, begin] of [
      ["Qong", () => shell.beginQong("cpu")],
      ["SkiPixl", () => shell.beginSkiPixl()],
      ["Quantman", () => shell.beginQuantman()],
      ["Fluxball", () => shell.beginFluxball()],
      ["Quarry", () => shell.beginQuag()],
    ] as const) {
      shell.exitCabinet();
      begin();
      const game = root.querySelector<HTMLElement>(".qb-game-ui")!;
      const frame = root.querySelector<HTMLElement>(".qb-screen-frame")!;
      game.dataset["navigation"] = "false";
      game.dataset["phase"] = "active";
      const active = frame.getBoundingClientRect();
      let fixed = true;
      for (const phase of ["paused", "reveal", "complete"]) {
        game.dataset["navigation"] = "true";
        game.dataset["phase"] = phase;
        const current = frame.getBoundingClientRect();
        fixed &&= ["x", "y", "width", "height"].every(
          (key) => Math.abs(current[key as "x"] - active[key as "x"]) < 0.5,
        );
      }
      record(
        `${name} keeps identical arena bounds in play, pause and results`,
        fixed,
      );
    }
    for (const [name, begin, draw] of cases) {
      shell.exitCabinet();
      begin();
      draw();
      const buttons = [
        ...root.querySelectorAll<HTMLButtonElement>("footer button"),
      ].filter((button) => button.getClientRects().length && !button.hidden);
      const before = buttons.map((button) => ({
        button,
        child: button.firstChild,
        label: button.textContent,
      }));
      for (let i = 0; i < 40; i++) draw();
      const stable =
        before.length > 0 &&
        before.every(
          ({ button, child, label }) =>
            button.firstChild === child && button.textContent === label,
        );
      record(
        `${name} keeps visible button text nodes stable across 40 redraws`,
        stable,
      );
    }
    summary.textContent = `${passed}/${cases.length + 7} checks passed`;
    shell.exitCabinet();
    const [, begin, draw] = cases[2]!;
    begin();
    liveDraw = draw;
    draw();
  });
window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(frame);
  shell.destroy();
});
