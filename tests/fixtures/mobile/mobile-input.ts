import {
  InputController,
  type InputSignal,
  type SemanticAction,
} from "../../../src/input/InputController";
import { TouchControls } from "../../../src/mobile/TouchControls";
import "../../../src/mobile/mobile.css";

const root = document.querySelector<HTMLElement>("#app")!;
const results = document.querySelector<HTMLOListElement>("#results")!;
const summary = document.querySelector<HTMLOutputElement>("#summary")!;
const run = document.querySelector<HTMLButtonElement>("#run")!;
function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
const settle = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function setup() {
  root.innerHTML =
    '<section class="qb-shell" data-view="cabinet"><div data-ui="game" data-cabinet="fluxball" data-navigation="false" data-phase="playing"><section data-cabinet="fluxball" data-touch-remaining="1"></section></div></section>';
  const input = new InputController(window, document);
  const signals: InputSignal[] = [];
  const held = new Set<SemanticAction>();
  input.subscribe((signal) => {
    if (signal.source !== "touch") return;
    signals.push(signal);
    if (signal.pressed) held.add(signal.action);
    else held.delete(signal.action);
  });
  const controls = new TouchControls(root, input);
  const game = root.querySelector<HTMLElement>("[data-ui='game']")!;
  const panel = game.querySelector<HTMLElement>("section")!;
  const movement = root.querySelector<HTMLElement>(".qb-touch-move")!;
  // Capture needs trusted hardware events. Only the fixture's own targets are stubbed.
  for (const element of root.querySelectorAll<HTMLElement>(
    "[data-touch-action], .qb-touch-move",
  ))
    element.setPointerCapture = () => {};
  const button = () =>
    root.querySelector<HTMLButtonElement>("[data-touch-primary]")!;
  const pointer = (
    target: "move" | "action",
    type: string,
    id = 1,
    x = 50,
    y = 150,
  ) => {
    (target === "move" ? movement : button()).dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: id,
        pointerType: "touch",
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  };
  const steer = (x = -24, y = 0) => {
    pointer("move", "pointerdown");
    pointer("move", "pointermove", 1, 50 + x, 150 + y);
  };
  const cabinet = async (name: string) => {
    game.dataset["cabinet"] = name;
    panel.dataset["cabinet"] = name;
    if (name !== "fluxball" && name !== "qong")
      delete panel.dataset["touchRemaining"];
    await settle();
  };
  return {
    controls,
    game,
    panel,
    movement,
    button,
    pointer,
    steer,
    cabinet,
    held,
    signals,
    edges: () => signals.map((s) => `${s.action}:${s.pressed}`).join(","),
    dispose: () => {
      controls.destroy();
      input.dispose();
      root.innerHTML = "";
    },
  };
}
type Fixture = ReturnType<typeof setup>;
const checks: readonly [string, (f: Fixture) => void | Promise<void>][] = [
  [
    "Touching the stick sets its origin without moving the player",
    (f) => {
      f.pointer("move", "pointerdown");
      expect(f.signals.length === 0, "Touch origin moved the player");
    },
  ],
  [
    "Small drifts remain in the dead zone",
    (f) => {
      f.steer(4, 4);
      expect(f.signals.length === 0, "Drift emitted a direction");
    },
  ],
  [
    "Diagonal movement holds two directions and releases both",
    (f) => {
      f.steer(-24, -24);
      expect(f.held.has("p1-left") && f.held.has("p1-up"), "Diagonal missing");
      f.pointer("move", "pointerup");
      expect(f.held.size === 0, "Diagonal remained held");
    },
  ],
  [
    "Direction and action remain independent",
    (f) => {
      f.steer();
      f.pointer("action", "pointerdown", 2);
      f.pointer("move", "pointerup");
      expect(
        !f.held.has("p1-left") && f.held.has("p1-action"),
        "Movement release affected action",
      );
      f.pointer("action", "pointerup", 2);
      expect(f.held.size === 0, "Action remained held");
    },
  ],
  [
    "Two fingers on the action release only after the last finger",
    (f) => {
      f.pointer("action", "pointerdown", 1);
      f.pointer("action", "pointerdown", 2);
      f.pointer("action", "pointerup", 1);
      expect(
        f.held.has("p1-action") && f.signals.length === 1,
        "First release ended shared hold",
      );
      f.pointer("action", "pointerup", 2);
      expect(!f.held.size && f.signals.length === 2, "Last release missing");
    },
  ],
  [
    "A second movement finger cannot steal the active stick",
    (f) => {
      f.steer();
      f.pointer("move", "pointerdown", 2);
      f.pointer("move", "pointermove", 2, 90, 150);
      f.pointer("move", "pointerup", 2);
      expect(
        f.held.has("p1-left") && !f.held.has("p1-right"),
        "Second finger stole stick",
      );
    },
  ],
  [
    "Returning to the origin stops; crossing it reverses direction",
    (f) => {
      f.steer();
      f.pointer("move", "pointermove", 1, 50, 150);
      expect(!f.held.size, "Origin did not stop");
      f.pointer("move", "pointermove", 1, 74, 150);
      expect(f.held.has("p1-right"), "Reversal missing");
      expect(
        f.edges() === "p1-left:true,p1-left:false,p1-right:true",
        "Unexpected reversal edges",
      );
    },
  ],
  [
    "The floating origin follows a long drag so a short reversal works",
    (f) => {
      f.steer(200);
      const knob = f.movement.querySelector<HTMLElement>(".qb-touch-stick")!;
      expect(
        Math.abs(parseFloat(knob.style.getPropertyValue("--stick-x"))) <= 23,
        "Knob escaped its outline",
      );
      f.pointer("move", "pointermove", 1, 200, 150);
      expect(
        f.held.has("p1-left") && !f.held.has("p1-right"),
        "Long drag trapped direction",
      );
    },
  ],
  [
    "Cancelling movement preserves the other finger's action",
    (f) => {
      f.steer();
      f.pointer("action", "pointerdown", 2);
      f.pointer("move", "pointercancel");
      expect(
        !f.held.has("p1-left") && f.held.has("p1-action"),
        "Cancel affected another finger",
      );
    },
  ],
  [
    "Lost capture and a duplicate release emit one release only",
    (f) => {
      f.steer();
      f.pointer("move", "lostpointercapture");
      f.pointer("move", "pointerup");
      expect(
        f.edges() === "p1-left:true,p1-left:false",
        "Capture loss was not idempotent",
      );
    },
  ],
  [
    "Spending an allowance releases the action and blocks another press",
    async (f) => {
      f.pointer("action", "pointerdown");
      f.panel.dataset["touchRemaining"] = "0";
      await settle();
      expect(
        f.button().disabled && !f.held.has("p1-action"),
        "Spent action stayed active",
      );
      f.pointer("action", "pointerdown", 2);
      expect(f.signals.length === 2, "Disabled action pressed");
    },
  ],
  [
    "Qong's revealed rule disables the button without spending another reveal",
    async (f) => {
      await f.cabinet("qong");
      f.panel.dataset["touchRemaining"] = "3";
      f.panel.innerHTML = '<button data-action="qong-observe">Reveal</button>';
      await settle();
      f.pointer("action", "pointerdown");
      f.panel.querySelector<HTMLButtonElement>("button")!.disabled = true;
      await settle();
      expect(
        f.button().disabled && !f.held.has("p1-action"),
        "Resolved reveal remained active",
      );
      expect(
        f.panel.dataset["touchRemaining"] === "3",
        "Adapter changed allowance",
      );
    },
  ],
  [
    "Qong ignores sideways movement",
    async (f) => {
      await f.cabinet("qong");
      f.steer(24, 0);
      expect(!f.signals.length, "Qong accepted horizontal input");
      f.pointer("move", "pointermove", 1, 74, 126);
      expect(f.held.has("p1-up"), "Vertical movement missing");
    },
  ],
  [
    "SkiPixl can steer while Boost is held independently",
    async (f) => {
      await f.cabinet("skipixl");
      f.steer();
      f.pointer("action", "pointerdown", 2);
      expect(
        f.held.has("p1-left") && f.held.has("p1-down"),
        "Boost and steering did not combine",
      );
      f.pointer("action", "pointerup", 2);
      expect(
        f.held.has("p1-left") && !f.held.has("p1-down"),
        "Boost release affected steering",
      );
    },
  ],
  [
    "Quarry flaps only on a fresh action press, not while moving or holding",
    async (f) => {
      await f.cabinet("quag");
      f.steer();
      f.pointer("action", "pointerdown", 2);
      f.pointer("action", "pointermove", 2, 80, 150);
      f.pointer("action", "pointerdown", 2);
      expect(
        f.signals.filter((s) => s.action === "p1-action" && s.pressed)
          .length === 1,
        "Holding repeated a flap",
      );
      f.pointer("action", "pointerup", 2);
      f.pointer("action", "pointerdown", 2);
      expect(
        f.signals.filter((s) => s.action === "p1-action" && s.pressed)
          .length === 2,
        "Second tap did not flap",
      );
    },
  ],
  [
    "Quantman swipes emit a complete direction edge, with no held control",
    async (f) => {
      await f.cabinet("quantman");
      f.steer(24, 0);
      expect(
        f.edges() === "p1-right:true,p1-right:false" && !f.held.size,
        "Swipe did not pulse",
      );
      expect(f.button().hidden, "Quantman shows an unused action");
    },
  ],
  [
    "Quantman accepts a new turn during the same finger contact",
    async (f) => {
      await f.cabinet("quantman");
      f.steer(24, 0);
      f.pointer("move", "pointermove", 1, 98, 150);
      f.pointer("move", "pointermove", 1, 98, 124);
      expect(
        f.edges() === "p1-right:true,p1-right:false,p1-up:true,p1-up:false",
        "Swipe turn or repeated direction incorrect",
      );
    },
  ],
  [
    "Taps and diagonal ambiguity do not start Quantman",
    async (f) => {
      await f.cabinet("quantman");
      f.steer(20, 20);
      f.pointer("move", "pointerup");
      expect(!f.signals.length, "Ambiguous swipe moved");
    },
  ],
  [
    "Pause/results release all controls and ignore hidden presses",
    async (f) => {
      f.steer();
      f.pointer("action", "pointerdown", 2);
      f.game.dataset["navigation"] = "true";
      await settle();
      expect(!f.held.size, "Navigation retained input");
      const length = f.signals.length;
      f.steer();
      f.pointer("action", "pointerdown", 3);
      expect(f.signals.length === length, "Hidden controls emitted input");
    },
  ],
  [
    "Changing games clears the previous game's input",
    async (f) => {
      f.steer();
      await f.cabinet("quag");
      expect(
        !f.held.size && f.button().getAttribute("aria-label") === "FLAP",
        "Transition retained old input",
      );
    },
  ],
  ...(["blur", "resize", "visibilitychange"] as const).map(
    (eventName): [string, (f: Fixture) => void] => [
      `${eventName} releases every held touch`,
      (f) => {
        f.steer();
        f.pointer("action", "pointerdown", 2);
        (eventName === "visibilitychange" ? document : window).dispatchEvent(
          new Event(eventName),
        );
        expect(
          !f.held.size && f.signals.filter((s) => !s.pressed).length === 2,
          "Interruption retained input",
        );
      },
    ],
  ),
  [
    "Secondary mouse buttons cannot activate touch movement",
    (f) => {
      f.movement.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          button: 2,
        }),
      );
      f.pointer("move", "pointermove", 1, 100, 200);
      expect(!f.signals.length, "Secondary mouse moved player");
    },
  ],
  [
    "Disposal releases input, removes the adapter and is idempotent",
    (f) => {
      f.steer();
      f.pointer("action", "pointerdown", 2);
      f.controls.destroy();
      f.controls.destroy();
      expect(
        !f.held.size && f.signals.filter((s) => !s.pressed).length === 2,
        "Disposal omitted releases",
      );
      expect(
        !root.querySelector(".qb-touch-controls"),
        "Disposal left controls",
      );
    },
  ],
];
run.addEventListener("click", async () => {
  run.disabled = true;
  results.replaceChildren();
  let passed = 0;
  for (const [name, check] of checks) {
    const f = setup();
    const item = document.createElement("li");
    try {
      await settle();
      await check(f);
      item.textContent = `PASS — ${name}`;
      item.dataset["result"] = "pass";
      passed += 1;
    } catch (error) {
      item.textContent = `FAIL — ${name}: ${error instanceof Error ? error.message : String(error)}`;
      item.dataset["result"] = "fail";
    } finally {
      f.dispose();
    }
    results.append(item);
  }
  summary.textContent = `${passed}/${checks.length} checks passed`;
  run.disabled = false;
});
