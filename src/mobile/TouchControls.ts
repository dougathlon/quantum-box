import type { InputController, SemanticAction } from "../input/InputController";
import {
  movementForCabinet,
  stickDirections,
  swipeDirection,
  TOUCH_STICK_RADIUS,
  type TouchDirection,
  type TouchMovement,
} from "./TouchGestures";

/** Touch emits the same player-A semantic edges as keys and controllers. */
export class TouchControls {
  private readonly element: HTMLElement;
  private readonly movement: HTMLElement;
  private readonly indicator: HTMLElement;
  private readonly action: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private readonly observer: MutationObserver;
  private readonly buttons = new Map<number, SemanticAction>();
  private readonly directions = new Set<TouchDirection>();
  private readonly media = window.matchMedia("(pointer: coarse)");
  private readonly force =
    new URLSearchParams(location.search).get("mobile") === "1";
  private mode: TouchMovement = "stick";
  private gesture: {
    id: number;
    x: number;
    y: number;
    last: TouchDirection | null;
  } | null = null;
  private context = "";
  private disposed = false;

  public constructor(
    private readonly root: HTMLElement,
    private readonly input: InputController,
  ) {
    this.element = document.createElement("nav");
    this.element.className = "qb-touch-controls";
    this.element.setAttribute("aria-label", "Touch game controls");
    this.element.innerHTML = `<div class="qb-touch-move" role="group" aria-label="Movement"><span class="qb-touch-stick" aria-hidden="true"><i></i></span><span class="qb-touch-gesture" aria-hidden="true"></span><span class="qb-touch-hint" aria-hidden="true"></span></div><button type="button" class="qb-touch-pause" data-touch-action="pause" aria-label="PAUSE"><span aria-hidden="true"></span></button><button type="button" class="qb-touch-action" data-touch-primary data-touch-action="p1-action" aria-label="ACTION"><span data-touch-name>ACTION</span><small data-touch-allowance></small></button>`;
    this.movement = this.element.querySelector<HTMLElement>(".qb-touch-move")!;
    this.indicator =
      this.element.querySelector<HTMLElement>(".qb-touch-stick")!;
    this.action = this.element.querySelector<HTMLButtonElement>(
      "[data-touch-primary]",
    )!;
    this.hint = this.element.querySelector<HTMLElement>(".qb-touch-hint")!;
    root.append(this.element);
    this.element.addEventListener("pointerdown", this.down);
    this.element.addEventListener("pointermove", this.move);
    this.element.addEventListener("pointerup", this.up);
    this.element.addEventListener("pointercancel", this.up);
    this.element.addEventListener("lostpointercapture", this.up);
    this.element.addEventListener("contextmenu", this.preventDefault);
    this.element.addEventListener("click", this.preventDefault);
    window.addEventListener("blur", this.release);
    window.addEventListener("resize", this.release);
    document.addEventListener("visibilitychange", this.release);
    this.media.addEventListener("change", this.sync);
    this.observer = new MutationObserver(this.sync);
    this.observer.observe(root.querySelector(".qb-shell")!, {
      attributes: true,
      attributeFilter: ["data-view"],
    });
    this.observer.observe(root.querySelector("[data-ui='game']")!, {
      attributes: true,
      subtree: true,
      attributeFilter: [
        "data-cabinet",
        "data-navigation",
        "data-phase",
        "data-touch-remaining",
        "disabled",
      ],
    });
    this.sync();
  }

  private readonly sync = (): void => {
    if (this.disposed) return;
    const enabled = this.force || this.media.matches;
    document.documentElement.dataset["mobile"] = String(enabled);
    const shell = this.root.querySelector<HTMLElement>(".qb-shell")!;
    const game = this.root.querySelector<HTMLElement>("[data-ui='game']")!;
    const playing = shell.dataset["view"] === "cabinet";
    const navigating = game.dataset["navigation"] === "true";
    const cabinet = game.dataset["cabinet"];
    const context = [enabled, playing, cabinet, navigating].join(":");
    if (context !== this.context) {
      this.context = context;
      this.release();
      this.movement.dataset["used"] = "false";
    }
    this.mode = movementForCabinet(cabinet);
    if (this.mode === "swipe" && game.dataset["phase"] === "ready")
      this.movement.dataset["used"] = "false";
    this.element.dataset["movement"] = this.mode;
    this.element.dataset["cabinet"] = cabinet ?? "";
    this.element.hidden = !enabled || !playing || navigating;
    if (this.element.hidden) this.release();
    const hint =
      this.mode === "swipe"
        ? game.dataset["phase"] === "ready"
          ? "SWIPE TO START"
          : "SWIPE TO TURN"
        : this.mode === "vertical"
          ? "DRAG UP / DOWN"
          : this.mode === "horizontal"
            ? "DRAG TO STEER"
            : "DRAG TO MOVE";
    if (this.hint.textContent !== hint) this.hint.textContent = hint;
    this.movement.setAttribute("aria-label", hint);
    const label =
      cabinet === "qong"
        ? "REVEAL"
        : cabinet === "fluxball"
          ? "CHANGE"
          : cabinet === "quag"
            ? "FLAP"
            : "BOOST";
    const action: SemanticAction =
      cabinet === "skipixl" ? "p1-down" : "p1-action";
    this.action.dataset["touchAction"] = action;
    const panel = game.querySelector<HTMLElement>(
      `[data-cabinet='${cabinet}']`,
    );
    const remaining = panel?.dataset["touchRemaining"];
    const allowance =
      remaining === undefined
        ? cabinet === "skipixl"
          ? "HOLD"
          : "TAP"
        : `${remaining} LEFT`;
    const name = this.action.querySelector<HTMLElement>("[data-touch-name]")!;
    const count = this.action.querySelector<HTMLElement>(
      "[data-touch-allowance]",
    )!;
    if (name.textContent !== label) name.textContent = label;
    if (count.textContent !== allowance) count.textContent = allowance;
    this.action.setAttribute("aria-label", label);
    this.action.disabled =
      remaining === "0" ||
      (cabinet === "qong" &&
        Boolean(
          panel?.querySelector<HTMLButtonElement>(
            "[data-action='qong-observe']",
          )?.disabled,
        ));
    this.action.hidden = cabinet === "quantman";
    if (this.action.disabled || this.action.hidden) this.releaseButton(action);
  };

  private readonly preventDefault = (event: Event): void =>
    event.preventDefault();
  private readonly down = (event: PointerEvent): void => {
    if (this.disposed || event.button !== 0 || this.element.hidden) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-touch-action]",
    );
    if (button) {
      if (button.disabled || button.hidden) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      const action = button.dataset["touchAction"] as SemanticAction;
      this.buttons.set(event.pointerId, action);
      button.dataset["held"] = "true";
      this.input.setTouchAction(action, true);
      return;
    }
    if (
      this.gesture ||
      !(event.target as HTMLElement).closest(".qb-touch-move")
    )
      return;
    event.preventDefault();
    this.movement.setPointerCapture(event.pointerId);
    this.gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      last: null,
    };
    this.movement.dataset["held"] = "true";
    this.placeIndicator(event.clientX, event.clientY, 0, 0);
  };
  private readonly move = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture || gesture.id !== event.pointerId) return;
    event.preventDefault();
    let x = event.clientX - gesture.x;
    let y = event.clientY - gesture.y;
    if (this.mode === "swipe") {
      const direction = swipeDirection(x, y);
      if (!direction) return;
      if (direction !== gesture.last) {
        // Quantman's existing direction latch retains this edge until its next tick.
        this.input.setTouchAction(`p1-${direction}`, true);
        this.input.setTouchAction(`p1-${direction}`, false);
      }
      gesture.last = direction;
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      this.movement.dataset["direction"] = direction;
      this.movement.dataset["used"] = "true";
      this.placeIndicator(event.clientX, event.clientY, 0, 0);
      return;
    }
    if (this.mode === "horizontal") y = 0;
    if (this.mode === "vertical") x = 0;
    const distance = Math.hypot(x, y);
    if (distance > TOUCH_STICK_RADIUS) {
      const scale = TOUCH_STICK_RADIUS / distance;
      gesture.x += x * (1 - scale);
      gesture.y += y * (1 - scale);
      x *= scale;
      y *= scale;
    }
    const directions = stickDirections(x, y, this.mode);
    this.setDirections(directions);
    if (directions.length) this.movement.dataset["used"] = "true";
    this.placeIndicator(gesture.x, gesture.y, x, y);
  };
  private placeIndicator(
    clientX: number,
    clientY: number,
    x: number,
    y: number,
  ): void {
    const rect = this.movement.getBoundingClientRect();
    this.indicator.style.left = `${clientX - rect.left}px`;
    this.indicator.style.top = `${clientY - rect.top}px`;
    // Keep the knob inside the 66px outline while retaining the input radius.
    const visualTravel = 23 / TOUCH_STICK_RADIUS;
    this.indicator.style.setProperty("--stick-x", `${x * visualTravel}px`);
    this.indicator.style.setProperty("--stick-y", `${y * visualTravel}px`);
  }
  private setDirections(next: readonly TouchDirection[]): void {
    for (const direction of this.directions)
      if (!next.includes(direction)) {
        this.input.setTouchAction(`p1-${direction}`, false);
        this.directions.delete(direction);
      }
    for (const direction of next)
      if (!this.directions.has(direction)) {
        this.directions.add(direction);
        this.input.setTouchAction(`p1-${direction}`, true);
      }
  }
  private readonly up = (event: PointerEvent): void => {
    if (this.gesture?.id === event.pointerId) {
      this.gesture = null;
      this.setDirections([]);
      this.movement.dataset["held"] = "false";
      this.indicator.removeAttribute("style");
    }
    const action = this.buttons.get(event.pointerId);
    if (!action) return;
    this.buttons.delete(event.pointerId);
    if (![...this.buttons.values()].includes(action)) {
      this.input.setTouchAction(action, false);
      this.element.querySelector<HTMLElement>(
        `[data-touch-action='${action}']`,
      )!.dataset["held"] = "false";
    }
  };
  private releaseButton(action: SemanticAction): void {
    for (const [pointer, held] of this.buttons)
      if (held === action) this.buttons.delete(pointer);
    this.input.setTouchAction(action, false);
    this.element.querySelector<HTMLElement>(
      `[data-touch-action='${action}']`,
    )!.dataset["held"] = "false";
  }
  private readonly release = (): void => {
    this.gesture = null;
    this.setDirections([]);
    for (const action of new Set(this.buttons.values()))
      this.input.setTouchAction(action, false);
    this.buttons.clear();
    this.indicator.removeAttribute("style");
    for (const element of this.element.querySelectorAll<HTMLElement>(
      "[data-held]",
    ))
      element.dataset["held"] = "false";
  };
  public destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.observer.disconnect();
    this.media.removeEventListener("change", this.sync);
    window.removeEventListener("blur", this.release);
    window.removeEventListener("resize", this.release);
    document.removeEventListener("visibilitychange", this.release);
    this.element.remove();
    delete document.documentElement.dataset["mobile"];
  }
}
