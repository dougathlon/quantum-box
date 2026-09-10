import { freezeObservation, type AgentPolicy } from "../../agents/contracts";
import { deriveSeed, Mulberry32 } from "../../core/determinism";
import type { RunContext } from "../../core/run";
import {
  createQongCpuBelief,
  QongCpuPolicy,
  type QongCpuAction,
  type QongCpuBelief,
  type QongCpuHypothesis,
} from "./QongCpuPolicy";
import {
  QONG_RULES_VERSION,
  QONG_STARTING_OBSERVATIONS,
  QONG_TOTAL_RALLIES,
  type QongGoalEvent,
  type QongInput,
  type QongOpponent,
  type QongPackPayload,
  type QongPolarity,
  type QongPublicState,
  type QongRallyReveal,
  type QongSide,
  type QongSnapshot,
} from "./types";

const STEP_SECONDS = 1 / 60;
const COURT_TOP = 48;
const COURT_BOTTOM = 324;
const LEFT_GOAL = 18;
const RIGHT_GOAL = 622;
const LEFT_PADDLE_X = 34;
const RIGHT_PADDLE_X = 606;
const PADDLE_HALF_HEIGHT = 27;
const PADDLE_SPEED = 148;
const BALL_RADIUS = 5;
const BALL_SPEED_X = 196;
const BETWEEN_RALLY_TICKS = 78;
export const QONG_MEASUREMENT_TICKS = 18;

type QongPolicy = AgentPolicy<
  QongPublicState,
  QongGoalEvent,
  QongCpuHypothesis,
  QongCpuAction
>;

export interface QongDeveloperAudit {
  readonly belief: QongCpuBelief;
  readonly lastDecision: Readonly<{
    action: QongCpuAction;
    rationaleCode: string;
  }> | null;
}

export class QongSession {
  private readonly ruleRandom: Mulberry32;
  private readonly physicsRandom: Mulberry32;
  private readonly cpuPolicy: QongPolicy;
  private cpuBelief: QongCpuBelief = createQongCpuBelief();
  private tick = 0;
  private rallyNumber = 0;
  private phase: "active" | "between-rallies" | "complete" = "active";
  private betweenTicks = 0;
  private observationsRemaining = QONG_STARTING_OBSERVATIONS;
  private humanObservationsUsed = 0;
  private readonly directionalRallyNumbers = new Set<number>();
  private measurementState: "unresolved" | "measuring" | "resolved" =
    "unresolved";
  private measurementTicks = 0;
  private pendingGoalSide: QongSide | null = null;
  private leftScore = 0;
  private rightScore = 0;
  private leftPaddleY = 186;
  private rightPaddleY = 186;
  private ballX = 320;
  private ballY = 186;
  private ballVx = 0;
  private ballVy = 0;
  private currentPolarity: QongPolarity = "direct";
  private rallyReveal: QongRallyReveal | null = null;
  private winner: QongSide | null = null;
  private lastCpuDecision: Readonly<{
    action: QongCpuAction;
    rationaleCode: string;
  }> | null = null;

  public constructor(
    private readonly context: RunContext,
    private readonly payload: QongPackPayload,
    private readonly opponent: QongOpponent,
    cpuPolicy?: QongPolicy,
  ) {
    if (
      context.gameId !== "qong" ||
      context.rulesVersion !== QONG_RULES_VERSION
    ) {
      throw new Error(
        "Qong requires a Qong run context and matching rules version.",
      );
    }
    if (
      !Number.isFinite(payload.directProbability) ||
      payload.directProbability < 0 ||
      payload.directProbability > 1
    ) {
      throw new Error("Qong directProbability must be between zero and one.");
    }
    if (
      payload.rallyPolarities !== undefined &&
      (payload.rallyPolarities.length !== QONG_TOTAL_RALLIES ||
        payload.rallyPolarities.some(
          (polarity) => polarity !== "direct" && polarity !== "invert",
        ))
    ) {
      throw new Error(
        "Qong rallyPolarities must contain exactly seven regimes.",
      );
    }
    if (
      context.playMode === "story" &&
      payload.rallyPolarities?.[0] !== "invert"
    ) {
      throw new Error(
        "Qong Story requires an acquired seven-rally sequence whose first polarity is invert.",
      );
    }
    this.ruleRandom = new Mulberry32(deriveSeed(context.runSeed, "qong:rules"));
    this.physicsRandom = new Mulberry32(
      deriveSeed(context.runSeed, "qong:physics"),
    );
    this.cpuPolicy =
      cpuPolicy ??
      new QongCpuPolicy(deriveSeed(context.runSeed, "qong:cpu-policy"));
    this.startRally();
  }

  public step(input: QongInput): QongSnapshot {
    if (this.phase === "complete") return this.snapshot();
    this.tick += 1;

    if (this.phase === "between-rallies") {
      this.betweenTicks -= 1;
      if (this.betweenTicks <= 0) this.startRally();
      return this.snapshot();
    }

    if (this.measurementState === "measuring") {
      this.advanceMeasurement();
      if (this.phase !== "active" || this.pendingGoalSide !== null) {
        return this.snapshot();
      }
    }

    if (
      (input.observePressed === true || input.scanPressed === true) &&
      this.observationsRemaining > 0 &&
      this.measurementState === "unresolved"
    ) {
      this.observationsRemaining -= 1;
      this.humanObservationsUsed += 1;
      this.beginMeasurement(null);
    }

    if (input.leftAxis !== 0) {
      this.directionalRallyNumbers.add(this.rallyNumber);
    }

    const rightAxis =
      this.opponent === "cpu" ? this.decideCpuAxis() : input.rightAxis;
    this.leftPaddleY = movePaddle(this.leftPaddleY, input.leftAxis);
    this.rightPaddleY = movePaddle(this.rightPaddleY, rightAxis);
    this.moveBall();
    return this.snapshot();
  }

  public snapshot(): QongSnapshot {
    return deepFreeze({
      phase: this.phase,
      tick: this.tick,
      rallyNumber: this.rallyNumber,
      totalRallies: QONG_TOTAL_RALLIES,
      leftScore: this.leftScore,
      rightScore: this.rightScore,
      observationsRemaining: this.observationsRemaining,
      measurementState: this.measurementState,
      goalRule:
        this.measurementState === "resolved"
          ? this.currentPolarity === "direct"
            ? "opposite"
            : "own"
          : "unresolved",
      ball: { x: this.ballX, y: this.ballY },
      leftPaddleY: this.leftPaddleY,
      rightPaddleY: this.rightPaddleY,
      rallyReveal: this.rallyReveal,
      winner: this.winner,
      storyEvidence: {
        humanObservationsUsed: this.humanObservationsUsed,
        directionalRallyNumbers: [...this.directionalRallyNumbers],
      },
    });
  }

  public developerAudit(): Readonly<QongDeveloperAudit> {
    return deepFreeze({
      belief: this.cpuBelief,
      lastDecision: this.lastCpuDecision,
    });
  }

  private startRally(): void {
    this.rallyNumber += 1;
    this.phase = "active";
    this.rallyReveal = null;
    this.measurementState = "unresolved";
    this.measurementTicks = 0;
    this.pendingGoalSide = null;
    const acquiredPolarity =
      this.payload.rallyPolarities?.[this.rallyNumber - 1];
    this.currentPolarity =
      acquiredPolarity ??
      (this.ruleRandom.next() < this.payload.directProbability
        ? "direct"
        : "invert");
    this.ballX = 320;
    this.ballY = 176 + this.physicsRandom.next() * 20;
    const direction = this.rallyNumber % 2 === 1 ? -1 : 1;
    this.ballVx = BALL_SPEED_X * direction;
    this.ballVy = (this.physicsRandom.next() * 2 - 1) * 92;
  }

  private moveBall(): void {
    const previousX = this.ballX;
    this.ballX += this.ballVx * STEP_SECONDS;
    this.ballY += this.ballVy * STEP_SECONDS;

    if (this.ballY - BALL_RADIUS <= COURT_TOP && this.ballVy < 0) {
      this.ballY = COURT_TOP + BALL_RADIUS;
      this.ballVy *= -1;
    } else if (this.ballY + BALL_RADIUS >= COURT_BOTTOM && this.ballVy > 0) {
      this.ballY = COURT_BOTTOM - BALL_RADIUS;
      this.ballVy *= -1;
    }

    if (
      this.ballVx < 0 &&
      previousX - BALL_RADIUS >= LEFT_PADDLE_X &&
      this.ballX - BALL_RADIUS <= LEFT_PADDLE_X &&
      Math.abs(this.ballY - this.leftPaddleY) <=
        PADDLE_HALF_HEIGHT + BALL_RADIUS
    ) {
      this.ballX = LEFT_PADDLE_X + BALL_RADIUS;
      this.ballVx = Math.abs(this.ballVx) * 1.025;
      this.ballVy += (this.ballY - this.leftPaddleY) * 3.2;
    } else if (
      this.ballVx > 0 &&
      previousX + BALL_RADIUS <= RIGHT_PADDLE_X &&
      this.ballX + BALL_RADIUS >= RIGHT_PADDLE_X &&
      Math.abs(this.ballY - this.rightPaddleY) <=
        PADDLE_HALF_HEIGHT + BALL_RADIUS
    ) {
      this.ballX = RIGHT_PADDLE_X - BALL_RADIUS;
      this.ballVx = -Math.abs(this.ballVx) * 1.025;
      this.ballVy += (this.ballY - this.rightPaddleY) * 3.2;
    }

    if (this.ballX < LEFT_GOAL) this.crossGoalLine("left");
    else if (this.ballX > RIGHT_GOAL) this.crossGoalLine("right");
  }

  private crossGoalLine(goalSide: QongSide): void {
    if (this.measurementState === "unresolved") {
      this.beginMeasurement(goalSide);
      return;
    }
    if (this.measurementState === "measuring") {
      this.pendingGoalSide = goalSide;
      return;
    }
    if (this.measurementState === "resolved") this.resolveGoal(goalSide);
  }

  private beginMeasurement(goalSide: QongSide | null): void {
    this.measurementState = "measuring";
    this.measurementTicks = QONG_MEASUREMENT_TICKS;
    this.pendingGoalSide = goalSide;
  }

  private advanceMeasurement(): void {
    this.measurementTicks -= 1;
    if (this.measurementTicks > 0) return;
    this.measurementState = "resolved";
    const goalSide = this.pendingGoalSide;
    this.pendingGoalSide = null;
    if (goalSide !== null) this.resolveGoal(goalSide);
  }

  private resolveGoal(goalSide: QongSide): void {
    const pointWinner: QongSide =
      this.currentPolarity === "direct"
        ? goalSide === "left"
          ? "right"
          : "left"
        : goalSide;
    if (pointWinner === "left") this.leftScore += 1;
    else this.rightScore += 1;

    this.rallyReveal = Object.freeze({
      polarity: this.currentPolarity,
      goalSide,
      pointWinner,
    });
    if (this.rallyNumber >= QONG_TOTAL_RALLIES) {
      this.phase = "complete";
      this.winner = this.leftScore > this.rightScore ? "left" : "right";
    } else {
      this.phase = "between-rallies";
      this.betweenTicks = BETWEEN_RALLY_TICKS;
    }
  }

  private decideCpuAxis(): -1 | 0 | 1 {
    const publicState: QongPublicState = {
      goalRule: this.snapshot().goalRule,
      rallyNumber: this.rallyNumber,
      ball: { x: this.ballX, y: this.ballY, vx: this.ballVx, vy: this.ballVy },
      leftPaddleY: this.leftPaddleY,
      rightPaddleY: this.rightPaddleY,
      leftScore: this.leftScore,
      rightScore: this.rightScore,
    };
    const observation = freezeObservation<QongPublicState, QongGoalEvent>({
      tick: this.tick,
      selfId: "right-cpu",
      publicState,
      publicEvents: [],
    });
    const decision = this.cpuPolicy.decide(observation, this.cpuBelief);
    this.cpuBelief = decision.nextBelief;
    this.lastCpuDecision = Object.freeze({
      action: Object.freeze({ ...decision.action }),
      rationaleCode: decision.rationaleCode,
    });
    return decision.action.axis;
  }
}

function movePaddle(current: number, axis: -1 | 0 | 1): number {
  return Math.min(
    COURT_BOTTOM - PADDLE_HALF_HEIGHT,
    Math.max(
      COURT_TOP + PADDLE_HALF_HEIGHT,
      current + axis * PADDLE_SPEED * STEP_SECONDS,
    ),
  );
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
