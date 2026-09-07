import { TUNING } from "../config/tuning";
import {
  NEUTRAL_INPUT_FRAME,
  axisFromInput,
  copyPlayerInput,
  inputForPlayer,
  normalizeAxis,
  type Axis,
  type PlayerInput,
  type PlayerInputFrame,
} from "../input";
import type { ActivePlayerMap, PlayerId } from "../modes";
import type { InterpretedRoundRules, PlayerRules } from "../rules/types";
import {
  createScoreBoard,
  evaluatePhysicalGoal,
  type GoalId,
  type ScoreBoard,
} from "./scoring";
import type {
  BallContactConsequence,
  BallContactEvent,
  BallSnapshot,
  PhysicalGoalEvent,
  PlayerSnapshot,
  RoundTimerExpiredEvent,
  SportEvent,
  SportFramePacket,
  SportSnapshot,
} from "./types";

interface RuntimePlayer {
  readonly id: PlayerId;
  x: number;
  y: number;
  rawInput: PlayerInput;
  rawCommand: Axis;
  rawFacing: Axis;
  resolvedMotion: Axis;
  resolvedFacing: Axis;
  rules: PlayerRules;
  lastContactTick: number;
}

interface RuntimeBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  carrierId: PlayerId | null;
}

export interface SportSimulationOptions {
  readonly roundNumber: number;
  readonly activePlayerIds: readonly PlayerId[];
  readonly rules: InterpretedRoundRules;
  readonly initialScore?: ScoreBoard;
  readonly roundTicks?: number;
  readonly ruleStateIndex?: number;
}

export type SportInputProvider = (
  snapshot: SportSnapshot,
  nextTick: number,
) => PlayerInputFrame;

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function copyAxis(axis: Axis): Axis {
  return { x: axis.x, y: axis.y };
}

function copyRules(rules: PlayerRules): PlayerRules {
  return { ...rules };
}

function distanceSquared(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  return dx * dx + dy * dy;
}

function moveAxisTowards(
  current: Axis,
  target: Axis,
  maximumDelta: number,
): Axis {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maximumDelta || distance <= Number.EPSILON) {
    return copyAxis(target);
  }
  return {
    x: current.x + (dx / distance) * maximumDelta,
    y: current.y + (dy / distance) * maximumDelta,
  };
}

function pointSegmentDistanceSquared(
  point: Readonly<Axis>,
  start: Readonly<Axis>,
  end: Readonly<Axis>,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return distanceSquared(point, start);
  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  );
  return distanceSquared(point, {
    x: start.x + dx * t,
    y: start.y + dy * t,
  });
}

function spawnFor(playerId: PlayerId): {
  readonly x: number;
  readonly y: number;
  readonly facing: Axis;
} {
  switch (playerId) {
    case "A":
      return {
        x: TUNING.courtWidth * 0.22,
        y: TUNING.courtHeight / 2,
        facing: { x: 1, y: 0 },
      };
    case "B":
      return {
        x: TUNING.courtWidth * 0.78,
        y: TUNING.courtHeight / 2,
        facing: { x: -1, y: 0 },
      };
    case "C":
      return {
        x: TUNING.courtWidth / 2,
        y: TUNING.courtHeight * 0.22,
        facing: { x: 0, y: 1 },
      };
    case "D":
      return {
        x: TUNING.courtWidth / 2,
        y: TUNING.courtHeight * 0.78,
        facing: { x: 0, y: -1 },
      };
  }
}

export class SportSimulation {
  private readonly roundNumber: number;
  private readonly roundTicks: number;
  private readonly activePlayerIds: readonly PlayerId[];
  private rules: ActivePlayerMap<PlayerRules>;
  private players: Partial<Record<PlayerId, RuntimePlayer>> = {};
  private ball!: RuntimeBall;
  private score: ScoreBoard;
  private roundTick = 0;
  private accumulatorSeconds = 0;
  private ended = false;
  private eventCounter = 0;
  private outgoingEvents: SportEvent[] = [];
  private latestGoal: PhysicalGoalEvent | null = null;
  private latestContact: BallContactEvent | null = null;
  private ruleStateIndex: number;
  private goalFreezeTicksRemaining = 0;

  public constructor(options: SportSimulationOptions) {
    if (!Number.isInteger(options.roundNumber) || options.roundNumber < 1) {
      throw new Error("Sport round number must be a positive integer.");
    }
    if (
      options.activePlayerIds.length !== 2 &&
      options.activePlayerIds.length !== 4
    ) {
      throw new Error("SportSimulation requires two or four active players.");
    }
    if (
      options.roundTicks !== undefined &&
      (!Number.isInteger(options.roundTicks) || options.roundTicks < 1)
    ) {
      throw new Error("Sport roundTicks must be a positive integer.");
    }
    this.roundNumber = options.roundNumber;
    this.roundTicks = options.roundTicks ?? TUNING.roundTicks;
    this.activePlayerIds = Object.freeze([...options.activePlayerIds]);
    this.ruleStateIndex = options.ruleStateIndex ?? 0;
    const rules: Partial<Record<PlayerId, PlayerRules>> = {};
    for (const playerId of this.activePlayerIds) {
      const playerRules = options.rules.players[playerId];
      if (!playerRules)
        throw new Error(`Player ${playerId} has no round rules.`);
      rules[playerId] = Object.freeze(copyRules(playerRules));
    }
    this.rules = Object.freeze(rules);
    this.score = createScoreBoard(this.activePlayerIds, options.initialScore);
    this.resetBodies();
  }

  public getSnapshot(): SportSnapshot {
    return this.createSnapshot();
  }

  public replaceRules(
    rules: InterpretedRoundRules,
    ruleStateIndex: number,
  ): SportSnapshot {
    if (!Number.isInteger(ruleStateIndex) || ruleStateIndex < 0) {
      throw new Error("Sport rule state index must be a non-negative integer.");
    }
    const replacement: Partial<Record<PlayerId, PlayerRules>> = {};
    for (const playerId of this.activePlayerIds) {
      const playerRules = rules.players[playerId];
      if (!playerRules) {
        throw new Error(`Player ${playerId} has no replacement rules.`);
      }
      replacement[playerId] = Object.freeze(copyRules(playerRules));
    }
    this.rules = Object.freeze(replacement);
    this.ruleStateIndex = ruleStateIndex;
    for (const playerId of this.activePlayerIds) {
      this.requirePlayer(playerId).rules = this.rules[playerId]!;
    }
    return this.createSnapshot();
  }

  public updateFrame(
    wallSeconds: number,
    inputs: PlayerInputFrame = NEUTRAL_INPUT_FRAME,
  ): SportFramePacket {
    if (!Number.isFinite(wallSeconds) || wallSeconds < 0) {
      throw new Error("Frame duration must be a finite, non-negative number.");
    }
    if (!this.ended) {
      this.accumulatorSeconds += wallSeconds;
      while (
        !this.ended &&
        this.accumulatorSeconds + Number.EPSILON >= TUNING.fixedStepSeconds
      ) {
        this.accumulatorSeconds -= TUNING.fixedStepSeconds;
        this.stepTick(inputs);
      }
      if (this.ended) this.accumulatorSeconds = 0;
    }
    return this.drainFramePacket();
  }

  public advanceTicks(
    count: number,
    inputs: PlayerInputFrame | SportInputProvider = NEUTRAL_INPUT_FRAME,
  ): SportFramePacket {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error("Tick count must be a non-negative integer.");
    }
    for (let index = 0; index < count && !this.ended; index += 1) {
      const frame =
        typeof inputs === "function"
          ? inputs(this.createSnapshot(), this.roundTick + 1)
          : inputs;
      this.stepTick(frame);
    }
    return this.drainFramePacket();
  }

  public step(
    inputs: PlayerInputFrame = NEUTRAL_INPUT_FRAME,
  ): SportFramePacket {
    if (!this.ended) this.stepTick(inputs);
    return this.drainFramePacket();
  }

  public drainFramePacket(): SportFramePacket {
    const events = this.outgoingEvents.splice(0);
    return deepFreeze({ snapshot: this.createSnapshot(), events });
  }

  private requirePlayer(playerId: PlayerId): RuntimePlayer {
    const player = this.players[playerId];
    if (!player) throw new Error(`Player ${playerId} is not active.`);
    return player;
  }

  private stepTick(inputs: PlayerInputFrame): void {
    if (this.goalFreezeTicksRemaining > 0) {
      this.goalFreezeTicksRemaining -= 1;
      if (this.goalFreezeTicksRemaining === 0) {
        this.resetBodies();
        if (this.roundTick >= this.roundTicks) this.endRound();
      }
      return;
    }
    this.roundTick += 1;
    this.resolvePlayerMovement(inputs);
    this.separatePlayers();
    const ballStart = { x: this.ball.x, y: this.ball.y };
    this.advanceBall();
    this.resolveBallContact(ballStart);
    if (this.ball.carrierId) this.attachBallToCarrier();
    const goalId = this.detectPhysicalGoal(ballStart);
    if (goalId) this.recordPhysicalGoal(goalId);
    else this.containBallOutsideGoal();
    if (!goalId && this.roundTick >= this.roundTicks) this.endRound();
  }

  private resolvePlayerMovement(inputs: PlayerInputFrame): void {
    for (const playerId of this.activePlayerIds) {
      const player = this.requirePlayer(playerId);
      const input = inputForPlayer(inputs, playerId);
      const rawCommand = axisFromInput(input);
      const multiplier = player.rules.action === "INVERTED" ? -1 : 1;
      const resolvedAxis = {
        x: rawCommand.x * multiplier,
        y: rawCommand.y * multiplier,
      };
      player.rawInput = copyPlayerInput(input);
      player.rawCommand = rawCommand;
      const hasIntent = resolvedAxis.x !== 0 || resolvedAxis.y !== 0;
      if (!hasIntent) {
        player.resolvedMotion = moveAxisTowards(
          player.resolvedMotion,
          { x: 0, y: 0 },
          TUNING.playerReleaseDeceleration * TUNING.fixedStepSeconds,
        );
      } else if (
        Math.hypot(player.resolvedMotion.x, player.resolvedMotion.y) <=
        Number.EPSILON
      ) {
        player.resolvedMotion = {
          x: resolvedAxis.x * TUNING.playerInitialSpeed,
          y: resolvedAxis.y * TUNING.playerInitialSpeed,
        };
      } else {
        const alignment =
          player.resolvedMotion.x * resolvedAxis.x +
          player.resolvedMotion.y * resolvedAxis.y;
        const acceleration =
          alignment < 0
            ? TUNING.playerReversalAcceleration
            : TUNING.playerAcceleration;
        player.resolvedMotion = moveAxisTowards(
          player.resolvedMotion,
          {
            x: resolvedAxis.x * TUNING.playerMaximumSpeed,
            y: resolvedAxis.y * TUNING.playerMaximumSpeed,
          },
          acceleration * TUNING.fixedStepSeconds,
        );
      }
      if (rawCommand.x !== 0 || rawCommand.y !== 0)
        player.rawFacing = copyAxis(rawCommand);
      if (resolvedAxis.x !== 0 || resolvedAxis.y !== 0)
        player.resolvedFacing = copyAxis(resolvedAxis);
      const nextX =
        player.x + player.resolvedMotion.x * TUNING.fixedStepSeconds;
      const nextY =
        player.y + player.resolvedMotion.y * TUNING.fixedStepSeconds;
      player.x = clamp(
        nextX,
        TUNING.courtPadding,
        TUNING.courtWidth - TUNING.courtPadding,
      );
      player.y = clamp(
        nextY,
        TUNING.courtPadding,
        TUNING.courtHeight - TUNING.courtPadding,
      );
      if (player.x !== nextX) player.resolvedMotion.x = 0;
      if (player.y !== nextY) player.resolvedMotion.y = 0;
    }
  }

  private separatePlayers(): void {
    const minimum = TUNING.playerRadius * 2;
    for (
      let leftIndex = 0;
      leftIndex < this.activePlayerIds.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < this.activePlayerIds.length;
        rightIndex += 1
      ) {
        const leftId = this.activePlayerIds[leftIndex];
        const rightId = this.activePlayerIds[rightIndex];
        if (!leftId || !rightId) continue;
        const left = this.requirePlayer(leftId);
        const right = this.requirePlayer(rightId);
        let dx = right.x - left.x;
        let dy = right.y - left.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minimum) continue;
        if (distance <= Number.EPSILON) {
          dx = leftId.localeCompare(rightId) < 0 ? 1 : -1;
          dy = 0;
          distance = 1;
        }
        const overlap = minimum - distance;
        const nx = dx / distance;
        const ny = dy / distance;
        left.x = clamp(
          left.x - (nx * overlap) / 2,
          TUNING.courtPadding,
          TUNING.courtWidth - TUNING.courtPadding,
        );
        left.y = clamp(
          left.y - (ny * overlap) / 2,
          TUNING.courtPadding,
          TUNING.courtHeight - TUNING.courtPadding,
        );
        right.x = clamp(
          right.x + (nx * overlap) / 2,
          TUNING.courtPadding,
          TUNING.courtWidth - TUNING.courtPadding,
        );
        right.y = clamp(
          right.y + (ny * overlap) / 2,
          TUNING.courtPadding,
          TUNING.courtHeight - TUNING.courtPadding,
        );
        const leftNormal =
          left.resolvedMotion.x * nx + left.resolvedMotion.y * ny;
        const rightNormal =
          right.resolvedMotion.x * nx + right.resolvedMotion.y * ny;
        const closingSpeed = leftNormal - rightNormal;
        if (closingSpeed > 0) {
          const retained = closingSpeed * TUNING.playerCollisionNormalDamping;
          const shared = (leftNormal + rightNormal) / 2;
          const nextLeftNormal = shared + retained / 2;
          const nextRightNormal = shared - retained / 2;
          left.resolvedMotion.x += (nextLeftNormal - leftNormal) * nx;
          left.resolvedMotion.y += (nextLeftNormal - leftNormal) * ny;
          right.resolvedMotion.x += (nextRightNormal - rightNormal) * nx;
          right.resolvedMotion.y += (nextRightNormal - rightNormal) * ny;
        }
      }
    }
  }

  private advanceBall(): void {
    if (this.ball.carrierId) {
      this.attachBallToCarrier();
      return;
    }
    this.ball.x += this.ball.vx * TUNING.fixedStepSeconds;
    this.ball.y += this.ball.vy * TUNING.fixedStepSeconds;
    this.ball.vx *= TUNING.ballDampingPerTick;
    this.ball.vy *= TUNING.ballDampingPerTick;
    if (Math.hypot(this.ball.vx, this.ball.vy) < TUNING.ballStopSpeed) {
      this.ball.vx = 0;
      this.ball.vy = 0;
    }
  }

  private resolveBallContact(ballStart: Readonly<Axis>): void {
    const contactDistance = TUNING.playerRadius + TUNING.ballRadius;
    const candidates = this.activePlayerIds
      .filter((playerId) => {
        if (this.ball.carrierId === playerId) return false;
        const player = this.requirePlayer(playerId);
        if (
          this.roundTick - player.lastContactTick <
          TUNING.contactCooldownTicks
        )
          return false;
        return (
          pointSegmentDistanceSquared(player, ballStart, this.ball) <=
          contactDistance ** 2
        );
      })
      .sort((leftId, rightId) => {
        const difference =
          distanceSquared(this.requirePlayer(leftId), this.ball) -
          distanceSquared(this.requirePlayer(rightId), this.ball);
        return difference || leftId.localeCompare(rightId);
      });
    const playerId = candidates[0];
    if (playerId) this.applyBallContact(this.requirePlayer(playerId));
  }

  private applyBallContact(player: RuntimePlayer): void {
    const previousCarrierId = this.ball.carrierId;
    player.lastContactTick = this.roundTick;
    if (previousCarrierId && previousCarrierId !== player.id) {
      this.requirePlayer(previousCarrierId).lastContactTick = this.roundTick;
    }
    let consequence: BallContactConsequence;
    if (player.rules.interaction === "CARRY") {
      consequence = previousCarrierId ? "steal" : "possession";
      this.ball.carrierId = player.id;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.attachBallToCarrier();
    } else {
      consequence = previousCarrierId ? "dislodge" : "strike";
      this.ball.carrierId = null;
      const fromPlayer = normalizeAxis({
        x: this.ball.x - player.x,
        y: this.ball.y - player.y,
      });
      const fallback = normalizeAxis(player.resolvedFacing);
      const direction =
        fromPlayer.x !== 0 || fromPlayer.y !== 0 ? fromPlayer : fallback;
      this.ball.x =
        player.x +
        direction.x * (TUNING.playerRadius + TUNING.ballRadius + 0.5);
      this.ball.y =
        player.y +
        direction.y * (TUNING.playerRadius + TUNING.ballRadius + 0.5);
      const closingSpeed = Math.max(
        0,
        player.resolvedMotion.x * direction.x +
          player.resolvedMotion.y * direction.y -
          (this.ball.vx * direction.x + this.ball.vy * direction.y),
      );
      const strikeSpeed = clamp(
        TUNING.strikeBaseSpeed + closingSpeed * TUNING.strikeClosingSpeedFactor,
        TUNING.strikeBaseSpeed,
        TUNING.strikeMaximumSpeed,
      );
      this.ball.vx = direction.x * strikeSpeed;
      this.ball.vy = direction.y * strikeSpeed;
    }
    const event: BallContactEvent = {
      ...this.allocateBase(),
      type: "BALL_CONTACT",
      playerId: player.id,
      interactionRule: player.rules.interaction,
      previousCarrierId,
      consequence,
      ballVelocityAfter: { x: this.ball.vx, y: this.ball.vy },
    };
    this.latestContact = this.record(event);
  }

  private attachBallToCarrier(): void {
    const carrierId = this.ball.carrierId;
    if (!carrierId) return;
    const carrier = this.requirePlayer(carrierId);
    this.ball.x = clamp(
      carrier.x + carrier.resolvedFacing.x * TUNING.carryOffset,
      TUNING.ballRadius,
      TUNING.courtWidth - TUNING.ballRadius,
    );
    this.ball.y = clamp(
      carrier.y + carrier.resolvedFacing.y * TUNING.carryOffset,
      TUNING.ballRadius,
      TUNING.courtHeight - TUNING.ballRadius,
    );
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  private detectPhysicalGoal(ballStart: Readonly<Axis>): GoalId | null {
    const carriedGoal = this.detectCarriedPhysicalGoal();
    if (carriedGoal) return carriedGoal;
    const verticalGoal = this.crossedVerticalGoal(ballStart);
    if (verticalGoal) return verticalGoal;
    if (this.activePlayerIds.length === 4) {
      const horizontalGoal = this.crossedHorizontalGoal(ballStart);
      if (horizontalGoal) return horizontalGoal;
    }
    return null;
  }

  private detectCarriedPhysicalGoal(): GoalId | null {
    const carrierId = this.ball.carrierId;
    if (!carrierId) return null;
    const carrier = this.requirePlayer(carrierId);
    const epsilon = 0.001;
    const inVerticalMouth =
      Math.abs(this.ball.y - TUNING.courtHeight / 2) <= TUNING.goalHalfHeight;
    if (
      inVerticalMouth &&
      ((carrier.x <= TUNING.courtPadding + epsilon &&
        carrier.resolvedFacing.x < 0) ||
        (carrier.x >= TUNING.courtWidth - TUNING.courtPadding - epsilon &&
          carrier.resolvedFacing.x > 0))
    ) {
      return carrier.x <= TUNING.courtPadding + epsilon ? "A" : "B";
    }
    if (this.activePlayerIds.length !== 4) return null;
    const inHorizontalMouth =
      Math.abs(this.ball.x - TUNING.courtWidth / 2) <=
      TUNING.horizontalGoalHalfWidth;
    if (
      inHorizontalMouth &&
      ((carrier.y <= TUNING.courtPadding + epsilon &&
        carrier.resolvedFacing.y < 0) ||
        (carrier.y >= TUNING.courtHeight - TUNING.courtPadding - epsilon &&
          carrier.resolvedFacing.y > 0))
    ) {
      return carrier.y <= TUNING.courtPadding + epsilon ? "C" : "D";
    }
    return null;
  }

  private crossedVerticalGoal(ballStart: Readonly<Axis>): GoalId | null {
    for (const [goalId, boundary] of [
      ["A", TUNING.ballRadius],
      ["B", TUNING.courtWidth - TUNING.ballRadius],
    ] as const) {
      const crossed =
        goalId === "A"
          ? ballStart.x > boundary && this.ball.x <= boundary
          : ballStart.x < boundary && this.ball.x >= boundary;
      if (!crossed && this.ball.x !== boundary) continue;
      const denominator = this.ball.x - ballStart.x;
      const t =
        Math.abs(denominator) <= Number.EPSILON
          ? 1
          : clamp((boundary - ballStart.x) / denominator, 0, 1);
      const y = ballStart.y + (this.ball.y - ballStart.y) * t;
      if (Math.abs(y - TUNING.courtHeight / 2) <= TUNING.goalHalfHeight) {
        return goalId;
      }
    }
    return null;
  }

  private crossedHorizontalGoal(ballStart: Readonly<Axis>): GoalId | null {
    for (const [goalId, boundary] of [
      ["C", TUNING.ballRadius],
      ["D", TUNING.courtHeight - TUNING.ballRadius],
    ] as const) {
      const crossed =
        goalId === "C"
          ? ballStart.y > boundary && this.ball.y <= boundary
          : ballStart.y < boundary && this.ball.y >= boundary;
      if (!crossed && this.ball.y !== boundary) continue;
      const denominator = this.ball.y - ballStart.y;
      const t =
        Math.abs(denominator) <= Number.EPSILON
          ? 1
          : clamp((boundary - ballStart.y) / denominator, 0, 1);
      const x = ballStart.x + (this.ball.x - ballStart.x) * t;
      if (
        Math.abs(x - TUNING.courtWidth / 2) <= TUNING.horizontalGoalHalfWidth
      ) {
        return goalId;
      }
    }
    return null;
  }

  private containBallOutsideGoal(): void {
    if (this.ball.x < TUNING.ballRadius) {
      this.ball.x = TUNING.ballRadius;
      if (!this.ball.carrierId) this.ball.vx = Math.abs(this.ball.vx);
    } else if (this.ball.x > TUNING.courtWidth - TUNING.ballRadius) {
      this.ball.x = TUNING.courtWidth - TUNING.ballRadius;
      if (!this.ball.carrierId) this.ball.vx = -Math.abs(this.ball.vx);
    }
    if (this.ball.y < TUNING.ballRadius) {
      this.ball.y = TUNING.ballRadius;
      if (!this.ball.carrierId) this.ball.vy = Math.abs(this.ball.vy);
    } else if (this.ball.y > TUNING.courtHeight - TUNING.ballRadius) {
      this.ball.y = TUNING.courtHeight - TUNING.ballRadius;
      if (!this.ball.carrierId) this.ball.vy = -Math.abs(this.ball.vy);
    }
  }

  private recordPhysicalGoal(goalId: GoalId): void {
    const evaluation = evaluatePhysicalGoal(
      goalId,
      this.activePlayerIds,
      this.rules,
      this.score,
    );
    this.score = evaluation.scoreAfter;
    const event: PhysicalGoalEvent = {
      ...this.allocateBase(),
      type: "PHYSICAL_GOAL",
      ...evaluation,
    };
    this.latestGoal = this.record(event);
    this.ball.vx = 0;
    this.ball.vy = 0;
    for (const playerId of this.activePlayerIds) {
      this.requirePlayer(playerId).resolvedMotion = { x: 0, y: 0 };
    }
    this.goalFreezeTicksRemaining = TUNING.goalFreezeTicks;
  }

  private endRound(): void {
    this.ended = true;
    this.ball.vx = 0;
    this.ball.vy = 0;
    for (const playerId of this.activePlayerIds) {
      this.requirePlayer(playerId).resolvedMotion = { x: 0, y: 0 };
    }
    this.record<RoundTimerExpiredEvent>({
      ...this.allocateBase(),
      type: "ROUND_TIMER_EXPIRED",
      score: createScoreBoard(this.activePlayerIds, this.score),
    });
  }

  private resetBodies(): void {
    const players: Partial<Record<PlayerId, RuntimePlayer>> = {};
    for (const playerId of this.activePlayerIds) {
      const spawn = spawnFor(playerId);
      const rules = this.rules[playerId];
      if (!rules) throw new Error(`Player ${playerId} has no reset rules.`);
      players[playerId] = {
        id: playerId,
        x: spawn.x,
        y: spawn.y,
        rawInput: copyPlayerInput(
          inputForPlayer(NEUTRAL_INPUT_FRAME, playerId),
        ),
        rawCommand: { x: 0, y: 0 },
        rawFacing: copyAxis(spawn.facing),
        resolvedMotion: { x: 0, y: 0 },
        resolvedFacing: copyAxis(spawn.facing),
        rules,
        lastContactTick: -TUNING.contactCooldownTicks,
      };
    }
    this.players = players;
    this.ball = {
      x: TUNING.courtWidth / 2,
      y: TUNING.courtHeight / 2,
      vx: 0,
      vy: 0,
      carrierId: null,
    };
  }

  private createSnapshot(): SportSnapshot {
    const players: Partial<Record<PlayerId, PlayerSnapshot>> = {};
    for (const playerId of this.activePlayerIds) {
      const player = this.requirePlayer(playerId);
      players[playerId] = {
        id: player.id,
        x: player.x,
        y: player.y,
        rawInput: copyPlayerInput(player.rawInput),
        rawCommand: copyAxis(player.rawCommand),
        rawFacing: copyAxis(player.rawFacing),
        resolvedMotion: copyAxis(player.resolvedMotion),
        resolvedFacing: copyAxis(player.resolvedFacing),
        rules: copyRules(player.rules),
      };
    }
    const ball: BallSnapshot = {
      x: this.ball.x,
      y: this.ball.y,
      vx: this.ball.vx,
      vy: this.ball.vy,
      carrierId: this.ball.carrierId,
    };
    return deepFreeze({
      roundNumber: this.roundNumber,
      tick: this.roundTick,
      roundTick: this.roundTick,
      roundTicks: this.roundTicks,
      secondsRemaining:
        (this.roundTicks - this.roundTick) / TUNING.ticksPerSecond,
      ruleStateIndex: this.ruleStateIndex,
      goalFreezeTicksRemaining: this.goalFreezeTicksRemaining,
      ended: this.ended,
      activePlayerIds: [...this.activePlayerIds],
      court: {
        width: TUNING.courtWidth,
        height: TUNING.courtHeight,
        goalHalfExtent: TUNING.goalHalfHeight,
        horizontalGoalHalfExtent: TUNING.horizontalGoalHalfWidth,
      },
      players,
      ball,
      score: createScoreBoard(this.activePlayerIds, this.score),
      latestGoal: this.latestGoal,
      latestContact: this.latestContact,
    });
  }

  private allocateBase(): {
    readonly eventId: number;
    readonly roundNumber: number;
    readonly tick: number;
    readonly ruleStateIndex: number;
  } {
    this.eventCounter += 1;
    return {
      eventId: this.eventCounter,
      roundNumber: this.roundNumber,
      tick: this.roundTick,
      ruleStateIndex: this.ruleStateIndex,
    };
  }

  private record<T extends SportEvent>(event: T): T {
    const frozen = deepFreeze(event);
    this.outgoingEvents.push(frozen);
    return frozen;
  }
}
