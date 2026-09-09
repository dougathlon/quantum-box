import type { RunContext } from "../../core/run";
import {
  SKIPIXL_CHALLENGE_PROFILE,
  skiPixlCollisionClearance,
} from "./SkiPixlChallenge";
import {
  SKIPIXL_READY_TICKS,
  SKIPIXL_LEGACY_RULES_VERSION,
  SKIPIXL_PREVIOUS_RULES_VERSION,
  SKIPIXL_PRIOR_RULES_VERSION,
  SKIPIXL_RULES_VERSION,
  SKIPIXL_V5_RULES_VERSION,
  SKIPIXL_V6_RULES_VERSION,
  type SkiPixlCollision,
  type SkiPixlGate,
  type SkiPixlGateResult,
  type SkiPixlInput,
  type SkiPixlObstacle,
  type SkiPixlPackPayload,
  type SkiPixlSnapshot,
  type SkiPixlSteeringAngle,
} from "./types";

const STEP_SECONDS = 1 / SKIPIXL_CHALLENGE_PROFILE.fixedStepHz;

export class SkiPixlSession {
  private tick = 0;
  private phase: "ready" | "active" | "complete" = "ready";
  private readyTicksRemaining = SKIPIXL_READY_TICKS;
  private elapsedTicks = 0;
  private distance = 0;
  private speed: number;
  private skierX = 320;
  private lateralVelocity = 0;
  private steeringAngle: SkiPixlSteeringAngle = 0;
  private obstaclesResolved = 0;
  private gatesResolved = 0;
  private gatePenaltyTicks = 0;
  private readonly gateResults: SkiPixlGateResult[] = [];
  private latestGate: SkiPixlGateResult | null = null;
  private latestGateTicks = 0;
  private readonly collisions: SkiPixlCollision[] = [];
  private latestCollision: SkiPixlCollision | null = null;
  private latestCollisionTicks = 0;
  private knockdownTicksRemaining = 0;

  public constructor(
    private readonly context: RunContext,
    private readonly payload: SkiPixlPackPayload,
  ) {
    if (
      context.gameId !== "skipixl" ||
      (context.rulesVersion !== SKIPIXL_RULES_VERSION &&
        context.rulesVersion !== SKIPIXL_PREVIOUS_RULES_VERSION &&
        context.rulesVersion !== SKIPIXL_V6_RULES_VERSION &&
        context.rulesVersion !== SKIPIXL_V5_RULES_VERSION &&
        context.rulesVersion !== SKIPIXL_PRIOR_RULES_VERSION &&
        context.rulesVersion !== SKIPIXL_LEGACY_RULES_VERSION)
    ) {
      throw new Error(
        "SkiPixl requires a SkiPixl run context and matching rules version.",
      );
    }
    this.speed = payload.cruiseSpeed;
  }

  public step(input: SkiPixlInput): SkiPixlSnapshot {
    if (this.phase === "complete") return this.snapshot();
    this.tick += 1;
    if (this.latestCollisionTicks > 0) this.latestCollisionTicks -= 1;
    if (this.latestGateTicks > 0) this.latestGateTicks -= 1;

    if (this.phase === "ready") {
      this.readyTicksRemaining -= 1;
      if (this.readyTicksRemaining === 0) this.phase = "active";
      return this.snapshot();
    }

    this.elapsedTicks += 1;
    if (this.knockdownTicksRemaining > 0) {
      this.knockdownTicksRemaining -= 1;
      this.lateralVelocity = approach(
        this.lateralVelocity,
        0,
        SKIPIXL_CHALLENGE_PROFILE.lateral.releaseDeceleration * STEP_SECONDS,
      );
      this.speed +=
        (this.payload.minSpeed - this.speed) *
        SKIPIXL_CHALLENGE_PROFILE.knockdownSpeedRecoveryPerSecond *
        STEP_SECONDS;
      return this.snapshot();
    }

    this.applySteering(input.steer);
    if (this.context.rulesVersion === SKIPIXL_RULES_VERSION) {
      this.speed = approach(
        this.speed,
        input.throttle > 0 ? this.payload.maxSpeed : this.payload.cruiseSpeed,
        (input.throttle > 0
          ? SKIPIXL_CHALLENGE_PROFILE.boostAccelerationPerSecond
          : SKIPIXL_CHALLENGE_PROFILE.cruiseReturnPerSecond) * STEP_SECONDS,
      );
    } else {
      // Historical replay cohorts retain the pre-v8 autonomous descent.
      this.speed += (this.payload.maxSpeed - this.speed) * 2.4 * STEP_SECONDS;
    }
    const previousX = this.skierX;
    this.skierX = clamp(
      this.skierX + this.lateralVelocity * STEP_SECONDS,
      this.payload.corridorMinX +
        SKIPIXL_CHALLENGE_PROFILE.skierCollisionRadius,
      this.payload.corridorMaxX -
        SKIPIXL_CHALLENGE_PROFILE.skierCollisionRadius,
    );

    const previousDistance = this.distance;
    this.distance = Math.min(
      this.payload.courseLength,
      this.distance +
        this.speed *
          SKIPIXL_CHALLENGE_PROFILE.forwardMultipliers[this.steeringAngle] *
          STEP_SECONDS,
    );
    this.resolveCrossedGates(
      previousDistance,
      this.distance,
      previousX,
      this.skierX,
    );
    if (
      this.skierX ===
        this.payload.corridorMinX +
          SKIPIXL_CHALLENGE_PROFILE.skierCollisionRadius ||
      this.skierX ===
        this.payload.corridorMaxX -
          SKIPIXL_CHALLENGE_PROFILE.skierCollisionRadius
    ) {
      this.lateralVelocity = 0;
      this.steeringAngle = 0;
    }
    this.resolveCrossedObstacles(
      previousDistance,
      this.distance,
      previousX,
      this.skierX,
    );
    if (this.distance >= this.payload.courseLength) this.phase = "complete";
    return this.snapshot();
  }

  public snapshot(): SkiPixlSnapshot {
    const elapsedSeconds =
      (this.elapsedTicks + this.gatePenaltyTicks) /
      SKIPIXL_CHALLENGE_PROFILE.fixedStepHz;
    return deepFreeze({
      phase: this.phase,
      tick: this.tick,
      readyTicksRemaining: this.readyTicksRemaining,
      elapsedTicks: this.elapsedTicks,
      elapsedSeconds,
      targetSeconds: this.payload.winSeconds,
      secondsRemaining: Math.max(0, this.payload.winSeconds - elapsedSeconds),
      distance: this.distance,
      courseLength: this.payload.courseLength,
      speed: this.speed,
      skierX: this.skierX,
      lateralVelocity: this.lateralVelocity,
      steeringAngle: this.steeringAngle,
      obstaclesResolved: this.obstaclesResolved,
      gatesResolved: this.gatesResolved,
      gatePenaltyTicks: this.gatePenaltyTicks,
      gateResults: [...this.gateResults],
      latestGate: this.latestGateTicks > 0 ? this.latestGate : null,
      collisions: [...this.collisions],
      latestCollision:
        this.latestCollisionTicks > 0 ? this.latestCollision : null,
      knockdownTicksRemaining: this.knockdownTicksRemaining,
      storyQualified:
        this.phase === "complete" && elapsedSeconds < this.payload.winSeconds,
      finishedUnderPar:
        this.phase === "complete" && elapsedSeconds < this.payload.parSeconds,
      receipt: this.payload.receipt,
    });
  }

  private applySteering(steer: -1 | 0 | 1): void {
    if (steer === 0) {
      this.lateralVelocity = approach(
        this.lateralVelocity,
        0,
        SKIPIXL_CHALLENGE_PROFILE.lateral.releaseDeceleration * STEP_SECONDS,
      );
    } else {
      const reversing =
        this.lateralVelocity !== 0 && Math.sign(this.lateralVelocity) !== steer;
      const acceleration = reversing
        ? SKIPIXL_CHALLENGE_PROFILE.lateral.reversalAcceleration
        : SKIPIXL_CHALLENGE_PROFILE.lateral.acceleration;
      this.lateralVelocity = clamp(
        this.lateralVelocity + steer * acceleration * STEP_SECONDS,
        -SKIPIXL_CHALLENGE_PROFILE.lateral.maximumSpeed,
        SKIPIXL_CHALLENGE_PROFILE.lateral.maximumSpeed,
      );
    }
    this.steeringAngle = steeringAngleForVelocity(this.lateralVelocity);
  }

  private resolveCrossedObstacles(
    fromDistance: number,
    toDistance: number,
    fromX: number,
    toX: number,
  ): void {
    let collisionRegistered = false;
    while (this.obstaclesResolved < this.payload.obstacles.length) {
      const obstacle = this.payload.obstacles[this.obstaclesResolved];
      if (!obstacle || obstacle.distance > toDistance) return;
      this.obstaclesResolved += 1;
      if (obstacle.distance <= fromDistance || collisionRegistered) continue;
      const progress =
        toDistance === fromDistance
          ? 1
          : (obstacle.distance - fromDistance) / (toDistance - fromDistance);
      const skierXAtObstacle = fromX + (toX - fromX) * progress;
      if (
        Math.abs(skierXAtObstacle - obstacle.x) <=
        skiPixlCollisionClearance(obstacle.kind)
      ) {
        this.registerCollision(obstacle, skierXAtObstacle);
        collisionRegistered = true;
      }
    }
  }

  private resolveCrossedGates(
    fromDistance: number,
    toDistance: number,
    fromX: number,
    toX: number,
  ): void {
    const gates = this.payload.gates ?? [];
    while (this.gatesResolved < gates.length) {
      const gate = gates[this.gatesResolved];
      if (!gate || gate.distance > toDistance) return;
      this.gatesResolved += 1;
      if (gate.distance <= fromDistance) continue;
      const progress =
        toDistance === fromDistance
          ? 1
          : (gate.distance - fromDistance) / (toDistance - fromDistance);
      const skierXAtGate = fromX + (toX - fromX) * progress;
      this.registerGateResult(gate, skierXAtGate);
    }
  }

  private registerGateResult(gate: SkiPixlGate, skierX: number): void {
    const passed = skierX > gate.leftX && skierX < gate.rightX;
    const penaltyTicks = passed
      ? 0
      : SKIPIXL_CHALLENGE_PROFILE.gateMissPenaltyTicks;
    const result = Object.freeze({
      gateId: gate.gateId,
      passed,
      skierX,
      penaltyTicks,
    });
    this.gateResults.push(result);
    this.gatePenaltyTicks += penaltyTicks;
    this.latestGate = result;
    this.latestGateTicks = SKIPIXL_CHALLENGE_PROFILE.gateIndicatorTicks;
  }

  private registerCollision(
    obstacle: SkiPixlObstacle,
    skierX = this.skierX,
  ): void {
    const penaltyTicks =
      SKIPIXL_CHALLENGE_PROFILE.collisionPenaltyTicks[obstacle.kind];
    const collision = Object.freeze({
      obstacleId: obstacle.obstacleId,
      kind: obstacle.kind,
      skierX,
      penaltyTicks,
    });
    this.collisions.push(collision);
    this.latestCollision = collision;
    this.latestCollisionTicks =
      SKIPIXL_CHALLENGE_PROFILE.collisionIndicatorTicks;
    this.knockdownTicksRemaining = penaltyTicks;
    this.lateralVelocity = 0;
    this.steeringAngle = 0;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function approach(value: number, target: number, amount: number): number {
  if (value < target) return Math.min(target, value + amount);
  if (value > target) return Math.max(target, value - amount);
  return target;
}

function steeringAngleForVelocity(velocity: number): SkiPixlSteeringAngle {
  const magnitude = Math.abs(velocity);
  const direction = Math.sign(velocity);
  const angle = magnitude < 8 ? 0 : magnitude < 48 ? 1 : magnitude < 96 ? 2 : 3;
  return (angle * direction) as SkiPixlSteeringAngle;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
