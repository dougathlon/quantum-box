import { TUNING } from "./standalone/config/tuning";
import {
  inputFromAxis,
  normalizeAxis,
  type Axis,
  type PlayerInput,
} from "./standalone/input";
import type { PlayerId } from "./standalone/modes";
import { oppositeGoalFor, ownGoalFor } from "./standalone/simulation";
import type {
  FluxballCpuBelief,
  FluxballPublicPlayer,
  FluxballPublicSportSnapshot,
} from "./types";

export interface FluxballCpuDecision {
  readonly playerId: PlayerId;
  readonly reason:
    | "pursue-ball"
    | "intercept-loose-ball"
    | "challenge-carrier"
    | "carry-to-believed-goal"
    | "stage-strike"
    | "strike-through-ball";
  readonly target: Readonly<Axis>;
  readonly desiredWorldMotion: Readonly<Axis>;
  readonly rawInput: Readonly<PlayerInput>;
}

export interface FluxballPolicyTuning {
  readonly twoPlayerDecisionInterval: number;
  readonly fourPlayerDecisionInterval: number;
  /** Consecutive unblocked displacement samples required (20 Hz). */
  readonly movementEvidenceTicks: number;
  /** Ignore reversal inertia until the issued direction has settled. */
  readonly movementSettleTicks: number;
}

export const FORGIVING_CPU_TUNING: FluxballPolicyTuning = Object.freeze({
  twoPlayerDecisionInterval: 3,
  fourPlayerDecisionInterval: 4,
  movementEvidenceTicks: 3,
  movementSettleTicks: 4,
});

export const ARCADE_CPU_TUNING: FluxballPolicyTuning = Object.freeze({
  twoPlayerDecisionInterval: 3,
  fourPlayerDecisionInterval: 4,
  movementEvidenceTicks: 3,
  movementSettleTicks: 4,
});

export const CAPABLE_PUBLIC_POLICY_TUNING: FluxballPolicyTuning = Object.freeze(
  {
    twoPlayerDecisionInterval: 1,
    fourPlayerDecisionInterval: 1,
    movementEvidenceTicks: 3,
    movementSettleTicks: 4,
  },
);

interface MutableBelief {
  action: "DIRECT" | "INVERTED" | "UNKNOWN";
  actionConfidence: number;
  interaction: "CARRY" | "STRIKE" | "UNKNOWN";
  interactionConfidence: number;
  targetGoal: PlayerId | "UNKNOWN";
  purposeConfidence: number;
  observations: number;
}

export class FluxballCpuPolicy {
  private readonly belief: MutableBelief = {
    action: "UNKNOWN",
    actionConfidence: 0,
    interaction: "UNKNOWN",
    interactionConfidence: 0,
    targetGoal: "UNKNOWN",
    purposeConfidence: 0,
    observations: 0,
  };
  private previousObservation: FluxballPublicSportSnapshot | null = null;
  private commandSinceTick = 0;
  private candidateAction: "DIRECT" | "INVERTED" | null = null;
  private candidateTicks = 0;
  private lastIssuedInput: Readonly<PlayerInput> = NEUTRAL_INPUT;
  private lastContactKey = "";
  private lastGoalKey = "";
  private lastDecisionTick = -1;
  private cachedDecision: FluxballCpuDecision | null = null;
  private strikeSide: -1 | 1 | null = null;
  private strikeThrough = false;

  public constructor(
    private readonly playerId: PlayerId,
    private readonly policySeed: number,
    private readonly tuning: FluxballPolicyTuning = FORGIVING_CPU_TUNING,
  ) {}

  public snapshotBelief(): FluxballCpuBelief {
    return deepFreeze({
      playerId: this.playerId,
      action: {
        value: this.belief.action,
        confidence: this.belief.actionConfidence,
      },
      interaction: {
        value: this.belief.interaction,
        confidence: this.belief.interactionConfidence,
      },
      targetGoal: {
        value: this.belief.targetGoal,
        confidence: this.belief.purposeConfidence,
      },
      observations: this.belief.observations,
    });
  }

  public decide(observation: FluxballPublicSportSnapshot): FluxballCpuDecision {
    const player = observation.players[this.playerId];
    if (!player) throw new Error(`CPU Player ${this.playerId} is not active.`);
    this.observeGoal(observation);
    this.observe(observation, player);
    const interval =
      observation.activePlayerIds.length === 4
        ? this.tuning.fourPlayerDecisionInterval
        : this.tuning.twoPlayerDecisionInterval;
    if (
      this.cachedDecision &&
      observation.roundTick - this.lastDecisionTick < interval
    ) {
      return this.cachedDecision;
    }

    const targetGoalId = this.believedTargetGoal(observation);
    const targetGoal = goalApproachWaypoint(targetGoalId, observation);
    const ball = observation.ball;
    const looseBallTarget = predictPoint(
      ball,
      { x: ball.vx, y: ball.vy },
      0.22,
      observation,
    );
    let target: Axis = looseBallTarget;
    let reason: FluxballCpuDecision["reason"] = "intercept-loose-ball";

    if (ball.carrierId !== null) {
      this.strikeSide = null;
      this.strikeThrough = false;
    }
    if (ball.carrierId === this.playerId) {
      target = carryApproach(player, targetGoal, observation);
      reason = "carry-to-believed-goal";
    } else if (ball.carrierId !== null) {
      const carrier = observation.players[ball.carrierId];
      if (!carrier) {
        target = looseBallTarget;
      } else {
        target = predictPoint(
          carrier,
          carrier.resolvedMotion,
          0.36,
          observation,
        );
        reason = "challenge-carrier";
      }
    } else if (this.belief.interaction === "STRIKE") {
      const approach = this.lineUpStrike(player, targetGoal, observation);
      target = approach.target;
      reason = approach.reason;
    }

    const desiredWorldMotion = normalizeAxis({
      x: target.x - player.x,
      y: target.y - player.y,
    });
    const actionAssumption =
      this.belief.action === "UNKNOWN" ? "DIRECT" : this.belief.action;
    const controlMotion =
      actionAssumption === "DIRECT"
        ? desiredWorldMotion
        : { x: -desiredWorldMotion.x, y: -desiredWorldMotion.y };
    return this.commitDecision(observation.roundTick, {
      playerId: this.playerId,
      reason,
      target,
      desiredWorldMotion,
      rawInput: inputFromAxis(controlMotion),
    });
  }

  private lineUpStrike(
    player: FluxballPublicPlayer,
    goal: Axis,
    observation: FluxballPublicSportSnapshot,
  ): { target: Axis; reason: "stage-strike" | "strike-through-ball" } {
    const ball = observation.ball;
    const forward = normalizeAxis({ x: goal.x - ball.x, y: goal.y - ball.y });
    const side = { x: -forward.y, y: forward.x };
    const dx = player.x - ball.x;
    const dy = player.y - ball.y;
    const along = dx * forward.x + dy * forward.y;
    const across = dx * side.x + dy * side.y;
    const margin = TUNING.courtPadding + TUNING.playerRadius;
    const onCourt = (point: Axis): Axis => ({
      x: clamp(point.x, margin, observation.court.width - margin),
      y: clamp(point.y, margin, observation.court.height - margin),
    });
    const staging = onCourt({
      x: ball.x - forward.x * 60,
      y: ball.y - forward.y * 60,
    });
    // Commit to contact once lined up, including a staging point clipped by
    // the sideline. Reversing back to staging halfway through causes stalling.
    if (along >= 0 || Math.abs(across) > 40) this.strikeThrough = false;
    if (
      along < -20 &&
      (Math.abs(across) < 12 ||
        Math.hypot(player.x - staging.x, player.y - staging.y) < 16)
    )
      this.strikeThrough = true;
    if (this.strikeThrough) {
      return {
        target: { x: ball.x + forward.x * 48, y: ball.y + forward.y * 48 },
        reason: "strike-through-ball",
      };
    }
    const path = { x: staging.x - player.x, y: staging.y - player.y };
    const lengthSquared = path.x * path.x + path.y * path.y;
    const closest =
      lengthSquared === 0
        ? 0
        : clamp(
            ((ball.x - player.x) * path.x + (ball.y - player.y) * path.y) /
              lengthSquared,
            0,
            1,
          );
    const clearance = Math.hypot(
      player.x + path.x * closest - ball.x,
      player.y + path.y * closest - ball.y,
    );
    const stagingClearance = Math.hypot(staging.x - ball.x, staging.y - ball.y);
    if (clearance >= Math.min(44, stagingClearance - 0.5))
      return { target: staging, reason: "stage-strike" };

    // Stay on one side while getting behind a loose ball. This is a short
    // clearance waypoint, not an orbit or a change to carrier pursuit.
    const behind = (sign: number): Axis => ({
      x: ball.x + side.x * sign * 90 - forward.x * 70,
      y: ball.y + side.y * sign * 90 - forward.y * 70,
    });
    if (this.strikeSide === null) {
      const preferred = across < 0 ? -1 : 1;
      const boundaryCost = (sign: number): number => {
        const point = behind(sign);
        const clamped = onCourt(point);
        return Math.hypot(point.x - clamped.x, point.y - clamped.y);
      };
      this.strikeSide =
        boundaryCost(preferred) <= boundaryCost(-preferred)
          ? preferred
          : preferred === 1
            ? -1
            : 1;
    }
    const waypointAlong =
      across * this.strikeSide >= 55 ? -70 : Math.max(-70, along);
    const target = onCourt({
      x: ball.x + side.x * this.strikeSide * 90 + forward.x * waypointAlong,
      y: ball.y + side.y * this.strikeSide * 90 + forward.y * waypointAlong,
    });
    return { target, reason: "stage-strike" };
  }

  private observe(
    observation: FluxballPublicSportSnapshot,
    player: FluxballPublicPlayer,
  ): void {
    const previous = this.previousObservation;
    const previousPlayer = previous?.players[this.playerId];
    if (previous && observation.roundTick <= previous.roundTick) {
      this.previousObservation = observation;
      this.candidateTicks = 0;
      return;
    }
    const command = axisForInput(this.lastIssuedInput);
    const uninterrupted =
      previous &&
      previousPlayer &&
      observation.roundTick === previous.roundTick + 1 &&
      previous.goalFreezeTicksRemaining === 0 &&
      observation.goalFreezeTicksRemaining === 0 &&
      previous.latestGoal?.eventId === observation.latestGoal?.eventId;
    const clear =
      uninterrupted &&
      clearOfObstructions(previous, this.playerId) &&
      clearOfObstructions(observation, this.playerId);
    if (
      clear &&
      observation.roundTick - this.commandSinceTick >=
        this.tuning.movementSettleTicks
    ) {
      const dx = player.x - previousPlayer.x;
      const dy = player.y - previousPlayer.y;
      const distance = Math.hypot(dx, dy);
      const alignment =
        distance > 0.15 ? (command.x * dx + command.y * dy) / distance : 0;
      if (
        Math.abs(alignment) >= 0.9 &&
        distance <= TUNING.playerMaximumSpeed * TUNING.fixedStepSeconds + 0.1
      ) {
        const candidate = alignment > 0 ? "DIRECT" : "INVERTED";
        this.candidateTicks =
          candidate === this.candidateAction ? this.candidateTicks + 1 : 1;
        this.candidateAction = candidate;
        if (this.candidateTicks >= this.tuning.movementEvidenceTicks) {
          this.belief.action = candidate;
          this.belief.actionConfidence = 0.94;
          this.belief.observations += 1;
        }
      } else {
        this.candidateTicks = 0;
      }
    } else {
      this.candidateTicks = 0;
    }
    this.previousObservation = observation;

    const contact = observation.latestContact;
    const contactKey = contact
      ? `${contact.roundNumber}:${contact.eventId}`
      : "";
    if (
      contact &&
      contactKey !== this.lastContactKey &&
      contact.playerId === this.playerId
    ) {
      this.lastContactKey = contactKey;
      this.strikeSide = null;
      this.strikeThrough = false;
      this.belief.interaction =
        contact.consequence === "possession" || contact.consequence === "steal"
          ? "CARRY"
          : "STRIKE";
      this.belief.interactionConfidence = 1;
      this.belief.observations += 1;
    }
  }

  private observeGoal(observation: FluxballPublicSportSnapshot): void {
    const goal = observation.latestGoal;
    if (!goal) return;
    const goalKey = `${goal.roundNumber}:${goal.eventId}`;
    if (goalKey === this.lastGoalKey) return;
    this.lastGoalKey = goalKey;
    this.strikeSide = null;
    this.strikeThrough = false;
    const own = ownGoalFor(this.playerId);
    const opposite = oppositeGoalFor(this.playerId);
    if (goal.physicalGoal !== own && goal.physicalGoal !== opposite) return;

    // Public recipients describe this goal's scoreboard change. A previous
    // frame may already contain the updated score or predate several goals.
    const beneficial = goal.awardedPlayerIds.includes(this.playerId);
    const targetGoal = beneficial
      ? goal.physicalGoal
      : goal.physicalGoal === own
        ? opposite
        : own;
    if (targetGoal !== this.belief.targetGoal) {
      this.belief.targetGoal = targetGoal;
      // Do not keep issuing a decision based on a disproven scoring belief.
      this.cachedDecision = null;
    }
    this.belief.purposeConfidence = 1;
    this.belief.observations += 1;
  }

  private believedTargetGoal(
    observation: FluxballPublicSportSnapshot,
  ): PlayerId {
    if (this.belief.targetGoal !== "UNKNOWN") return this.belief.targetGoal;
    const phase =
      observation.roundNumber +
      this.playerId.charCodeAt(0) +
      (this.policySeed & 7);
    return phase % 2 === 0
      ? ownGoalFor(this.playerId)
      : oppositeGoalFor(this.playerId);
  }

  private commitDecision(
    tick: number,
    decision: FluxballCpuDecision,
  ): FluxballCpuDecision {
    const frozen = deepFreeze({
      ...decision,
      target: { ...decision.target },
      desiredWorldMotion: { ...decision.desiredWorldMotion },
      rawInput: { ...decision.rawInput },
    });
    this.lastDecisionTick = tick;
    this.cachedDecision = frozen;
    const oldAxis = axisForInput(this.lastIssuedInput);
    const newAxis = axisForInput(frozen.rawInput);
    if (oldAxis.x !== newAxis.x || oldAxis.y !== newAxis.y) {
      this.commandSinceTick = tick;
      this.candidateTicks = 0;
    }
    this.lastIssuedInput = frozen.rawInput;
    return frozen;
  }
}

function axisForInput(input: Readonly<PlayerInput>): Axis {
  return normalizeAxis({
    x: Number(input.right) - Number(input.left),
    y: Number(input.down) - Number(input.up),
  });
}

function goalApproachWaypoint(
  playerId: PlayerId,
  observation: FluxballPublicSportSnapshot,
): Axis {
  const overshoot = Math.max(48, observation.court.width * 0.08);
  switch (playerId) {
    case "A":
      return { x: -overshoot, y: observation.court.height / 2 };
    case "B":
      return {
        x: observation.court.width + overshoot,
        y: observation.court.height / 2,
      };
    case "C":
      return { x: observation.court.width / 2, y: -overshoot };
    case "D":
      return {
        x: observation.court.width / 2,
        y: observation.court.height + overshoot,
      };
  }
}

function predictPoint(
  point: Readonly<Axis>,
  velocity: Readonly<Axis>,
  seconds: number,
  observation: FluxballPublicSportSnapshot,
): Axis {
  return {
    x: clamp(
      point.x + velocity.x * seconds,
      observation.court.width * 0.03,
      observation.court.width * 0.97,
    ),
    y: clamp(
      point.y + velocity.y * seconds,
      observation.court.height * 0.05,
      observation.court.height * 0.95,
    ),
  };
}

function carryApproach(
  player: FluxballPublicPlayer,
  goal: Axis,
  observation: FluxballPublicSportSnapshot,
): Axis {
  const forward = normalizeAxis({ x: goal.x - player.x, y: goal.y - player.y });
  for (const id of observation.activePlayerIds) {
    if (id === player.id) continue;
    const other = observation.players[id]!;
    const dx = other.x - player.x;
    const dy = other.y - player.y;
    const ahead = dx * forward.x + dy * forward.y;
    const side = dx * -forward.y + dy * forward.x;
    if (ahead > 0 && ahead < 90 && Math.abs(side) < 42) {
      const away = side >= 0 ? -1 : 1;
      return {
        x: other.x - forward.y * away * 65,
        y: other.y + forward.x * away * 65,
      };
    }
  }
  return goal;
}

// Only geometry visible on court is used; collision impulses and wall clipping
// cannot provide reliable evidence about the input mapping.
function clearOfObstructions(
  observation: FluxballPublicSportSnapshot,
  playerId: PlayerId,
): boolean {
  const player = observation.players[playerId]!;
  const margin =
    TUNING.courtPadding +
    TUNING.playerRadius +
    TUNING.playerMaximumSpeed * TUNING.fixedStepSeconds;
  if (
    player.x <= margin ||
    player.x >= observation.court.width - margin ||
    player.y <= margin ||
    player.y >= observation.court.height - margin
  )
    return false;
  return observation.activePlayerIds.every((id) => {
    const other = observation.players[id]!;
    return (
      id === playerId ||
      Math.hypot(other.x - player.x, other.y - player.y) >
        TUNING.carrierSeparationDistance +
          2 * TUNING.playerMaximumSpeed * TUNING.fixedStepSeconds
    );
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

const NEUTRAL_INPUT: Readonly<PlayerInput> = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
