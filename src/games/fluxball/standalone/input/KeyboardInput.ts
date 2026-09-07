import { bindingForCode, isEditableTarget } from "./bindings";
import type { KeyboardSchemeId } from "./bindings";
import type { MatchSetup, PlayerId } from "../modes";
import {
  copyPlayerInput,
  NEUTRAL_INPUT_FRAME,
  NEUTRAL_PLAYER_INPUT,
  type PlayerInput,
  type PlayerInputFrame,
} from "./types";

export class SemanticInputState {
  private readonly schemes: Record<KeyboardSchemeId, PlayerInput> = {
    wasd: copyPlayerInput(NEUTRAL_PLAYER_INPUT),
    arrows: copyPlayerInput(NEUTRAL_PLAYER_INPUT),
    tfgh: copyPlayerInput(NEUTRAL_PLAYER_INPUT),
    ijkl: copyPlayerInput(NEUTRAL_PLAYER_INPUT),
  };

  setCode(code: string, pressed: boolean): boolean {
    const binding = bindingForCode(code);
    if (!binding) return false;
    this.schemes[binding.schemeId][binding.direction] = pressed;
    return true;
  }

  clear(): void {
    this.schemes.wasd = copyPlayerInput(NEUTRAL_PLAYER_INPUT);
    this.schemes.arrows = copyPlayerInput(NEUTRAL_PLAYER_INPUT);
    this.schemes.tfgh = copyPlayerInput(NEUTRAL_PLAYER_INPUT);
    this.schemes.ijkl = copyPlayerInput(NEUTRAL_PLAYER_INPUT);
  }

  snapshot(): Readonly<Record<KeyboardSchemeId, PlayerInput>> {
    return Object.freeze({
      wasd: Object.freeze(copyPlayerInput(this.schemes.wasd)),
      arrows: Object.freeze(copyPlayerInput(this.schemes.arrows)),
      tfgh: Object.freeze(copyPlayerInput(this.schemes.tfgh)),
      ijkl: Object.freeze(copyPlayerInput(this.schemes.ijkl)),
    });
  }
}

export class KeyboardInput {
  private readonly state = new SemanticInputState();
  private active = false;
  private disposed = false;

  constructor(
    private readonly target: Window = window,
    private readonly documentTarget: Document = document,
  ) {
    this.target.addEventListener("keydown", this.onKeyDown);
    this.target.addEventListener("keyup", this.onKeyUp);
    this.target.addEventListener("blur", this.onBlur);
    this.documentTarget.addEventListener(
      "visibilitychange",
      this.onVisibilityChange,
    );
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.state.clear();
  }

  snapshot(setup: MatchSetup): PlayerInputFrame {
    if (!this.active) return this.neutralSnapshot();
    const sources = this.state.snapshot();
    const frame: Partial<Record<PlayerId, PlayerInput>> = {};
    for (const playerId of setup.activePlayerIds) {
      const assignment = setup.controllers[playerId];
      if (assignment?.kind !== "human") continue;
      const prefix = "keyboard:";
      if (!assignment.controllerId.startsWith(prefix)) continue;
      const schemeId = assignment.controllerId.slice(prefix.length);
      if (
        schemeId !== "wasd" &&
        schemeId !== "arrows" &&
        schemeId !== "tfgh" &&
        schemeId !== "ijkl"
      ) {
        continue;
      }
      frame[playerId] = Object.freeze(copyPlayerInput(sources[schemeId]));
    }
    return Object.freeze(frame);
  }

  clear(): void {
    this.state.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.state.clear();
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
    this.documentTarget.removeEventListener(
      "visibilitychange",
      this.onVisibilityChange,
    );
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || isEditableTarget(event.target)) return;
    if (this.state.setCode(event.code, true)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (!this.active) return;
    if (this.state.setCode(event.code, false)) event.preventDefault();
  };

  private readonly onBlur = (): void => {
    this.state.clear();
  };

  private readonly onVisibilityChange = (): void => {
    if (this.documentTarget.visibilityState !== "visible") this.state.clear();
  };

  private neutralSnapshot(): PlayerInputFrame {
    return NEUTRAL_INPUT_FRAME;
  }
}
