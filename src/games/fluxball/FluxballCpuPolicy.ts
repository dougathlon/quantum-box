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
    | "probe-action"
    | "pursue-ball"
    | "intercept-loose-ball"
    | "challenge-carrier"
    | "intercept-carrier"
    | "support-carrier"
    | "guard-open-goal"
    | "carry-to-believed-goal"
    | "stage-strike"
    | "strike-through-ball"
    | "hesitate";
  readonly target: Readonly<Axis>;
  readonly desiredWorldMotion: Readonly<Axis>;
  readonly rawInput: Readonly<PlayerInput>;
}

export interface FluxballPolicyTuning {
  readonly twoPlayerDecisionInterval: number;
  readonly fourPlayerDecisionInterval: number;
  readonly hesitationEveryDecisions: number;
}

export const FORGIVING_CPU_TUNING: FluxballPolicyTuning = Object.freeze({
  twoPlayerDecisionInterval: 3,
  fourPlayerDecisionInterval: 4,
  hesitationEveryDecisions: 0,
});

export const ARCADE_CPU_TUNING: FluxballPolicyTuning = Object.freeze({
  twoPlayerDecisionInterval: 3,
  fourPlayerDecisionInterval: 4,
  hesitationEveryDecisions: 0,
});

export const CAPABLE_PUBLIC_POLICY_TUNING: FluxballPolicyTuning = Object.freeze(
  {
    twoPlayerDecisionInterval: 1,
    fourPlayerDecisionInterval: 1,
    hesitationEveryDecisions: 0,
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
  private previousPlayer: FluxballPublicPlayer | null = null;
  private lastIssuedInput: Readonly<PlayerInput> = NEUTRAL_INPUT;
  private lastContactKey = "";
  private lastGoalKey = "";
  private lastDecisionTick = -1;
  private cachedDecision: FluxballCpuDecision | null = null;

  public constructor(
    private readonly playerId: PlayerId,
    private readonly policySeed: number,
    private readonly tuning: FluxballPolicyTuning = FORGIVING_CPU_TUNING,
    private readonly cpuPlayerIds: readonly PlayerId[] = Object.freeze([
      playerId,
    ]),
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

    const decisionIndex = Math.floor(observation.roundTick / interval);
    const playerPhase = this.playerId.charCodeAt(0) - 64;
    if (
      this.tuning.hesitationEveryDecisions > 0 &&
      (decisionIndex + playerPhase + (this.policySeed & 3)) %
        this.tuning.hesitationEveryDecisions ===
        0
    ) {
      return this.commitDecision(observation.roundTick, {
        playerId: this.playerId,
        reason: "hesitate",
        target: { x: player.x, y: player.y },
        desiredWorldMotion: { x: 0, y: 0 },
        rawInput: NEUTRAL_INPUT,
      });
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

    if (this.belief.action === "UNKNOWN" && observation.roundTick < 24) {
      target = { x: player.x + 90, y: player.y };
      reason = "probe-action";
    } else if (ball.carrierId === this.playerId) {
      target = targetGoal;
      reason = "carry-to-believed-goal";
    } else if (ball.carrierId !== null) {
      const carrier = observation.players[ball.carrierId];
      if (!carrier) {
        target = looseBallTarget;
      } else if (this.cpuPlayerIds.includes(ball.carrierId)) {
        target = supportPoint(carrier, targetGoal, this.playerId, observation);
        reason = "support-carrier";
      } else if (this.isNearestCpuTo(carrier, observation)) {
        target = predictPoint(
          carrier,
          carrier.resolvedMotion,
          0.36,
          observation,
        );
        reason = "challenge-carrier";
      } else {
        target = interceptionPoint(carrier, this.playerId, observation);
        reason = "intercept-carrier";
      }
    } else if (!this.isNearestCpuTo(looseBallTarget, observation)) {
      target = guardPoint(
        oppositeGoalFor(targetGoalId),
        this.playerId,
        observation,
      );
      reason = "guard-open-goal";
    } else if (this.belief.interaction === "STRIKE") {
      const strikeDirection = normalizeAxis({
        x: targetGoal.x - ball.x,
        y: targetGoal.y - ball.y,
      });
      const stagingDistance = 42;
      const stagingPoint = {
        x: ball.x - strikeDirection.x * stagingDistance,
        y: ball.y - strikeDirection.y * stagingDistance,
      };
      const stagingDelta = {
        x: stagingPoint.x - player.x,
        y: stagingPoint.y - player.y,
      };
      if (Math.hypot(stagingDelta.x, stagingDelta.y) < 13) {
        target = {
          x: ball.x + strikeDirection.x * 12,
          y: ball.y + strikeDirection.y * 12,
        };
        reason = "strike-through-ball";
      } else {
        target = stagingPoint;
        reason = "stage-strike";
      }
    }

    const desiredWorldMotion = normalizeAxis({
      x: target.x - player.x,
      y: target.y - player.y,
    });
    const actionAssumption =
      this.belief.action === "UNKNOWN"
        ? decisionIndex % 14 < 7
          ? "DIRECT"
          : "INVERTED"
        : this.belief.action;
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

  private observe(
    observation: FluxballPublicSportSnapshot,
    player: FluxballPublicPlayer,
  ): void {
    if (this.previousPlayer) {
      const command = axisForInput(this.lastIssuedInput);
      const displacement = {
        x: player.x - this.previousPlayer.x,
        y: player.y - this.previousPlayer.y,
      };
      const commandMagnitude = Math.hypot(command.x, command.y);
      const displacementMagnitude = Math.hypot(displacement.x, displacement.y);
      if (commandMagnitude > 0 && displacementMagnitude > 0.15) {
        const relation =
          command.x * displacement.x + command.y * displacement.y;
        this.belief.action = relation >= 0 ? "DIRECT" : "INVERTED";
        this.belief.actionConfidence = 0.94;
        this.belief.observations += 1;
      }
    }
    this.previousPlayer = player;

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
      this.belief.interaction =
        contact.consequence === "possession" || contact.consequence === "steal"
          ? "CARRY"
          : "STRIKE";
      this.belief.interactionConfidence = 1;
      this.belief.observations += 1;
    }

    const goal = observation.latestGoal;
    const goalKey = goal ? `${goal.roundNumber}:${goal.eventId}` : "";
    if (goal && goalKey !== this.lastGoalKey) {
      this.lastGoalKey = goalKey;
      const own = ownGoalFor(this.playerId);
      const opposite = oppositeGoalFor(this.playerId);
      if (goal.physicalGoal === own || goal.physicalGoal === opposite) {
        this.belief.targetGoal = goal.awardedPlayerIds.includes(this.playerId)
          ? goal.physicalGoal
          : goal.physicalGoal === own
            ? opposite
            : own;
        this.belief.purposeConfidence = 1;
        this.belief.observations += 1;
      }
    }
  }

  private believedTargetGoal(
    observation: FluxballPublicSportSnapshot,
  ): PlayerId {
    if (this.belief.targetGoal !== "UNKNOWN") return this.belief.targetGoal;
    const phase =
      Math.floor(observation.roundTick / 120) +
      observation.roundNumber +
      this.playerId.charCodeAt(0) +
      (this.policySeed & 7);
    return phase % 2 === 0
      ? ownGoalFor(this.playerId)
      : oppositeGoalFor(this.playerId);
  }

  private isNearestCpuTo(
    target: Readonly<Axis>,
    observation: FluxballPublicSportSnapshot,
  ): boolean {
    const ranked = this.cpuPlayerIds
      .filter((playerId) => observation.players[playerId] !== undefined)
      .sort((leftId, rightId) => {
        const left = observation.players[leftId]!;
        const right = observation.players[rightId]!;
        const distance =
          squaredDistance(left, target) - squaredDistance(right, target);
        return distance || leftId.localeCompare(rightId);
      });
    return ranked[0] === this.playerId;
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

function guardPoint(
  goalId: PlayerId,
  playerId: PlayerId,
  observation: FluxballPublicSportSnapshot,
): Axis {
  const centre = goalApproachWaypoint(goalId, observation);
  const courtCentre = {
    x: observation.court.width / 2,
    y: observation.court.height / 2,
  };
  const inward = normalizeAxis({
    x: courtCentre.x - centre.x,
    y: courtCentre.y - centre.y,
  });
  const side = playerId.charCodeAt(0) % 2 === 0 ? 1 : -1;
  return {
    x: clamp(
      centre.x + inward.x * 110 - inward.y * side * 38,
      observation.court.width * 0.08,
      observation.court.width * 0.92,
    ),
    y: clamp(
      centre.y + inward.y * 110 + inward.x * side * 38,
      observation.court.height * 0.1,
      observation.court.height * 0.9,
    ),
  };
}

function supportPoint(
  carrier: FluxballPublicPlayer,
  goal: Readonly<Axis>,
  playerId: PlayerId,
  observation: FluxballPublicSportSnapshot,
): Axis {
  const towardGoal = normalizeAxis({
    x: goal.x - carrier.x,
    y: goal.y - carrier.y,
  });
  const flank = playerId.charCodeAt(0) % 2 === 0 ? 1 : -1;
  return {
    x: clamp(
      carrier.x - towardGoal.x * 54 - towardGoal.y * flank * 62,
      observation.court.width * 0.05,
      observation.court.width * 0.95,
    ),
    y: clamp(
      carrier.y - towardGoal.y * 54 + towardGoal.x * flank * 62,
      observation.court.height * 0.07,
      observation.court.height * 0.93,
    ),
  };
}

function interceptionPoint(
  carrier: FluxballPublicPlayer,
  playerId: PlayerId,
  observation: FluxballPublicSportSnapshot,
): Axis {
  const prediction = predictPoint(
    carrier,
    carrier.resolvedMotion,
    0.72,
    observation,
  );
  const offset = playerId.charCodeAt(0) % 2 === 0 ? 34 : -34;
  return {
    x: clamp(
      prediction.x - carrier.resolvedMotion.y * 0.12,
      observation.court.width * 0.04,
      observation.court.width * 0.96,
    ),
    y: clamp(
      prediction.y + carrier.resolvedMotion.x * 0.12 + offset,
      observation.court.height * 0.06,
      observation.court.height * 0.94,
    ),
  };
}

function squaredDistance(left: Readonly<Axis>, right: Readonly<Axis>): number {
  const x = left.x - right.x;
  const y = left.y - right.y;
  return x * x + y * y;
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
