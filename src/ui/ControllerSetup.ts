import {
  controllerMappingKey,
  clearControllerMappingCache,
} from "../input/GamepadMapping";
import { LOCAL_HUMAN_LIMIT } from "../input/LocalPlayers";

export const controllerSetupMarkup = `
<div class="qb-controller-setup">
<p>D-PAD: MOVE<br>A: SELECT / ACTION<br>B / SELECT: BACK<br>START: PAUSE</p>
<p>CONTROLLER 1: PLAYER A<br>CONTROLLER 2: PLAYER B</p>
<p>BUTTONS NOT MATCHING? MAP THEM BELOW.</p>
<button class="qb-action" data-action="controller-map">MAP BUTTONS</button>
<p data-controller-status role="status">CONNECT A CONTROLLER AND PRESS A BUTTON.</p>
<button class="qb-action" data-action="controller-done">PLAYER KEYS</button>
</div>`;

export class ControllerSetup {
  private frame = 0;
  private mapping: Record<string, number> | null = null;
  private index = 0;
  private device: number | null = null;
  private released = false;
  // Keep mapped buttons from also navigating when calibration finishes.
  private waitingForRelease = false;
  public get capturing(): boolean {
    return this.mapping !== null || this.waitingForRelease;
  }
  public constructor(private readonly root: HTMLElement) {
    this.frame = requestAnimationFrame(this.poll);
  }
  public start(): void {
    this.mapping = {};
    this.index = 0;
    this.device = null;
    this.released = false;
    this.status("RELEASE BUTTONS, THEN PRESS A.");
  }
  public destroy(): void {
    cancelAnimationFrame(this.frame);
  }
  private status(message: string): void {
    const target = this.root.querySelector("[data-controller-status]");
    if (target && target.textContent !== message) target.textContent = message;
  }
  private readonly poll = (): void => {
    const pads = [...navigator.getGamepads()].filter((pad): pad is Gamepad =>
      Boolean(pad?.connected && pad.index < LOCAL_HUMAN_LIMIT),
    );
    if (this.mapping) {
      const pad =
        this.device === null
          ? pads.find((p) => p.buttons.some((b) => b.pressed))
          : pads.find((p) => p.index === this.device);
      const pressed =
        pad?.buttons.flatMap((b, i) => (b.pressed ? [i] : [])) ?? [];
      if (!pressed.length) this.released = true;
      else if (this.released && pressed.length === 1 && pad) {
        this.released = false;
        this.device = pad.index;
        const value = pressed[0]!;
        const names = ["A", "B", "START", "SELECT"];
        const keys = ["primary", "back", "start", "select"];
        if (Object.values(this.mapping).includes(value)) {
          this.status(`ALREADY USED. PRESS ${names[this.index]}.`);
        } else {
          this.mapping[keys[this.index++]!] = value;
          if (this.index === keys.length) {
            try {
              localStorage.setItem(
                controllerMappingKey(pad.id),
                JSON.stringify(this.mapping),
              );
              clearControllerMappingCache();
              this.status("SAVED. RELEASE BUTTONS TO CONTINUE.");
            } catch {
              this.status("COULD NOT SAVE. PLEASE TRY AGAIN.");
            }
            this.mapping = null;
            this.waitingForRelease = true;
          } else this.status(`RELEASE, THEN PRESS ${names[this.index]}.`);
        }
      }
    } else if (
      this.waitingForRelease &&
      pads.every((p) => p.buttons.every((b) => !b.pressed))
    ) {
      this.waitingForRelease = false;
    }
    this.frame = requestAnimationFrame(this.poll);
  };
}
