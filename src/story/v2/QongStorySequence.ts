import type { QongSnapshot } from "../../games/qong/types";

export const QONG_STORY_STEP_SECONDS = 1 / 30;

export type QongStoryPhase =
  | "morph"
  | "designer-walk"
  | "door-opening"
  | "court-walk"
  | "threshold"
  | "office-walk"
  | "sitting"
  | "terminal";

export type QongStoryDirection = "up" | "down" | "left" | "right";

export interface QongStoryPoint {
  readonly x: number;
  readonly y: number;
}

export interface QongStorySequenceSnapshot {
  readonly phase: QongStoryPhase;
  readonly phaseTick: number;
  readonly morphFrame: number;
  readonly doorFrame: number;
  readonly player: QongStoryPoint;
  readonly designer: QongStoryPoint;
  readonly facing: QongStoryDirection;
  readonly moving: boolean;
  readonly atComputer: boolean;
  readonly scene: "court" | "office";
  readonly showWellDone: boolean;
  readonly prompt: string;
  readonly persistenceBeatId: string;
}

export interface QongStorySequenceAdvance {
  readonly snapshot: QongStorySequenceSnapshot;
  readonly phaseChanged: boolean;
  readonly footstep: boolean;
  readonly terminalEntered: boolean;
}

const COURT_PLAYER_X = 17;
const COURT_DESIGNER_X = 303;
const COURT_DOOR = Object.freeze({ x: 280, y: 132 });
const COURT_PLAYER_BOUNDS = Object.freeze({
  left: 25,
  right: 284,
  top: 42,
  bottom: 157,
});
const OFFICE_PLAYER_BOUNDS = Object.freeze({
  left: 22,
  right: 298,
  top: 42,
  bottom: 158,
});
const OFFICE_START = Object.freeze({ x: 43, y: 151 });
const OFFICE_CHAIR = Object.freeze({ x: 244, y: 91 });
const WALK_SPEED = 2;

const OFFICE_BLOCKERS = Object.freeze([
  Object.freeze({ left: 23, top: 42, right: 95, bottom: 61 }),
  Object.freeze({ left: 201, top: 39, right: 286, bottom: 77 }),
  Object.freeze({ left: 114, top: 96, right: 170, bottom: 126 }),
  Object.freeze({ left: 31, top: 98, right: 84, bottom: 128 }),
]);

const PHASE_BEAT: Readonly<Record<QongStoryPhase, string>> = Object.freeze({
  morph: "qong-opponent-paddle-morph",
  "designer-walk": "qong-well-done",
  "door-opening": "qong-open-door",
  "court-walk": "qong-walk-to-den",
  threshold: "qong-walk-to-den",
  "office-walk": "qong-den-access",
  sitting: "qong-den-method",
  terminal: "qong-terminal-qong-input",
});

/**
 * Presentation-only state for the continuous Qong-to-office sequence. Qong's
 * completed snapshot remains the authority for the court beneath it; this
 * machine owns only the actors, door, room traversal, and terminal handoff.
 */
export class QongStorySequenceMachine {
  private phase: QongStoryPhase;
  private phaseTick = 0;
  private player: QongStoryPoint;
  private designer: QongStoryPoint;
  private facing: QongStoryDirection = "right";
  private moving = false;
  private actionQueued = false;
  private readonly held = new Set<QongStoryDirection>();

  public constructor(
    finalCourt: QongSnapshot,
    resumeBeatId: string | null = null,
    private readonly reducedMotion = false,
  ) {
    this.phase = phaseForBeat(resumeBeatId);
    this.player = startPlayer(finalCourt, this.phase);
    this.designer = startDesigner(finalCourt, this.phase);
    if (this.phase === "office-walk" || this.phase === "sitting") {
      this.facing = "up";
    }
  }

  public setDirection(direction: QongStoryDirection, pressed: boolean): void {
    if (pressed) this.held.add(direction);
    else this.held.delete(direction);
  }

  public queueAction(): void {
    this.actionQueued = true;
  }

  public nudge(direction: QongStoryDirection): QongStorySequenceSnapshot {
    if (this.phase !== "court-walk" && this.phase !== "office-walk") {
      return this.snapshot();
    }
    this.facing = direction;
    this.move(directionVector(direction));
    return this.snapshot();
  }

  public advance(): QongStorySequenceAdvance {
    const previousPhase = this.phase;
    this.phaseTick += 1;
    this.moving = false;

    switch (this.phase) {
      case "morph":
        if (this.phaseTick >= automaticDuration(42, this.reducedMotion)) {
          this.enterPhase("designer-walk");
        }
        break;
      case "designer-walk":
        this.designer = approach(this.designer, COURT_DOOR, 1.5);
        this.moving = true;
        if (
          this.phaseTick >= automaticDuration(30, this.reducedMotion) ||
          distance(this.designer, COURT_DOOR) < 1
        ) {
          this.designer = COURT_DOOR;
          this.enterPhase("door-opening");
        }
        break;
      case "door-opening":
        if (this.phaseTick >= automaticDuration(20, this.reducedMotion)) {
          this.enterPhase("court-walk");
        }
        break;
      case "court-walk":
        this.moveFromHeld();
        if (distance(this.player, COURT_DOOR) <= 8) {
          this.enterPhase("threshold");
        }
        break;
      case "threshold":
        this.player = approach(this.player, COURT_DOOR, 2);
        this.moving = true;
        if (this.phaseTick >= automaticDuration(12, this.reducedMotion)) {
          this.player = OFFICE_START;
          this.designer = Object.freeze({ x: 266, y: 92 });
          this.enterPhase("office-walk");
        }
        break;
      case "office-walk":
        this.moveFromHeld();
        if (this.actionQueued && atComputer(this.player)) {
          this.player = OFFICE_CHAIR;
          this.facing = "up";
          this.enterPhase("sitting");
        }
        break;
      case "sitting":
        if (this.phaseTick >= automaticDuration(18, this.reducedMotion)) {
          this.enterPhase("terminal");
        }
        break;
      case "terminal":
        break;
    }

    this.actionQueued = false;
    const phaseChanged = previousPhase !== this.phase;
    return freeze({
      snapshot: this.snapshot(),
      phaseChanged,
      footstep: this.moving && this.phaseTick > 0 && this.phaseTick % 5 === 0,
      terminalEntered: phaseChanged && this.phase === "terminal",
    });
  }

  public snapshot(): QongStorySequenceSnapshot {
    const office =
      this.phase === "office-walk" ||
      this.phase === "sitting" ||
      this.phase === "terminal";
    return freeze({
      phase: this.phase,
      phaseTick: this.phaseTick,
      morphFrame:
        this.phase === "morph"
          ? Math.min(6, Math.floor((this.phaseTick / 41) * 7))
          : 6,
      doorFrame:
        this.phase === "door-opening"
          ? Math.min(4, Math.floor((this.phaseTick / 19) * 5))
          : phaseOrder(this.phase) > phaseOrder("door-opening")
            ? 4
            : 0,
      player: this.player,
      designer: this.designer,
      facing: this.facing,
      moving: this.moving,
      atComputer: office && atComputer(this.player),
      scene: office ? "office" : "court",
      showWellDone:
        this.phase === "designer-walk" || this.phase === "door-opening",
      prompt:
        this.phase === "court-walk"
          ? "WALK TO THE OPEN DOOR"
          : this.phase === "office-walk"
            ? atComputer(this.player)
              ? "COMPUTER · SPACE TO SIT"
              : "WALK TO THE COMPUTER"
            : "",
      persistenceBeatId: PHASE_BEAT[this.phase],
    });
  }

  private moveFromHeld(): void {
    const axis = heldVector(this.held);
    if (axis.x === 0 && axis.y === 0) return;
    this.facing = dominantFacing(axis, this.facing);
    this.move(axis);
  }

  private move(axis: QongStoryPoint): void {
    const length = Math.hypot(axis.x, axis.y) || 1;
    const delta = {
      x: (axis.x / length) * WALK_SPEED,
      y: (axis.y / length) * WALK_SPEED,
    };
    const bounds =
      this.phase === "office-walk" ? OFFICE_PLAYER_BOUNDS : COURT_PLAYER_BOUNDS;
    const horizontal = Object.freeze({
      x: clamp(this.player.x + delta.x, bounds.left, bounds.right),
      y: this.player.y,
    });
    if (canOccupy(horizontal, this.phase)) this.player = horizontal;
    const vertical = Object.freeze({
      x: this.player.x,
      y: clamp(this.player.y + delta.y, bounds.top, bounds.bottom),
    });
    if (canOccupy(vertical, this.phase)) this.player = vertical;
    this.moving = true;
  }

  private enterPhase(phase: QongStoryPhase): void {
    this.phase = phase;
    this.phaseTick = 0;
    this.moving = false;
  }
}

export function qongStoryPhaseForBeat(beatId: string | null): QongStoryPhase {
  return phaseForBeat(beatId);
}

function phaseForBeat(beatId: string | null): QongStoryPhase {
  switch (beatId) {
    case "qong-player-paddle-morph":
    case "qong-opponent-paddle-morph":
    case null:
      return "morph";
    case "qong-well-done":
      return "designer-walk";
    case "qong-open-door":
      return "door-opening";
    case "qong-walk-to-den":
      return "court-walk";
    case "qong-den-access":
      return "office-walk";
    case "qong-den-method":
      return "sitting";
    default:
      return beatId.startsWith("qong-terminal-") ? "terminal" : "morph";
  }
}

function startPlayer(
  court: QongSnapshot,
  phase: QongStoryPhase,
): QongStoryPoint {
  if (phase === "office-walk") return OFFICE_START;
  if (phase === "sitting" || phase === "terminal") return OFFICE_CHAIR;
  if (phase === "threshold") return COURT_DOOR;
  return Object.freeze({
    x: COURT_PLAYER_X,
    y: clamp((court.leftPaddleY + 20) / 2, 42, 157),
  });
}

function startDesigner(
  court: QongSnapshot,
  phase: QongStoryPhase,
): QongStoryPoint {
  if (phaseOrder(phase) >= phaseOrder("office-walk")) {
    return Object.freeze({ x: 266, y: 92 });
  }
  if (phaseOrder(phase) >= phaseOrder("door-opening")) return COURT_DOOR;
  return Object.freeze({
    x: COURT_DESIGNER_X,
    y: clamp((court.rightPaddleY + 20) / 2, 42, 157),
  });
}

function canOccupy(point: QongStoryPoint, phase: QongStoryPhase): boolean {
  if (phase !== "office-walk") return true;
  const halfWidth = 5;
  const halfHeight = 7;
  return !OFFICE_BLOCKERS.some(
    (blocker) =>
      point.x + halfWidth > blocker.left &&
      point.x - halfWidth < blocker.right &&
      point.y > blocker.top &&
      point.y - halfHeight < blocker.bottom,
  );
}

function atComputer(point: QongStoryPoint): boolean {
  return distance(point, OFFICE_CHAIR) <= 13;
}

function heldVector(held: ReadonlySet<QongStoryDirection>): QongStoryPoint {
  return {
    x: Number(held.has("right")) - Number(held.has("left")),
    y: Number(held.has("down")) - Number(held.has("up")),
  };
}

function directionVector(direction: QongStoryDirection): QongStoryPoint {
  switch (direction) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
  }
}

function dominantFacing(
  axis: QongStoryPoint,
  fallback: QongStoryDirection,
): QongStoryDirection {
  if (Math.abs(axis.x) > Math.abs(axis.y)) return axis.x < 0 ? "left" : "right";
  if (axis.y !== 0) return axis.y < 0 ? "up" : "down";
  return fallback;
}

function approach(
  from: QongStoryPoint,
  to: QongStoryPoint,
  speed: number,
): QongStoryPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= speed || length === 0) return to;
  return Object.freeze({
    x: from.x + (dx / length) * speed,
    y: from.y + (dy / length) * speed,
  });
}

function distance(a: QongStoryPoint, b: QongStoryPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function automaticDuration(ticks: number, reducedMotion: boolean): number {
  return reducedMotion ? 1 : ticks;
}

function phaseOrder(phase: QongStoryPhase): number {
  return [
    "morph",
    "designer-walk",
    "door-opening",
    "court-walk",
    "threshold",
    "office-walk",
    "sitting",
    "terminal",
  ].indexOf(phase);
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
