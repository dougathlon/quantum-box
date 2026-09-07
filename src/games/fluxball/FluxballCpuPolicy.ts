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
    | "challenge-carrier"
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
  twoPlayerDecisionInterval: 20,
  fourPlayerDecisionInterval: 30,
  hesitationEveryDecisions: 3,
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
    const targetGoal = goalCentre(targetGoalId, observation);
    const ball = observation.ball;
    let target: Axis = { x: ball.x, y: ball.y };
    let reason: FluxballCpuDecision["reason"] = "pursue-ball";

    if (this.belief.action === "UNKNOWN" && observation.roundTick < 24) {
      target = { x: player.x + 90, y: player.y };
      reason = "probe-action";
    } else if (ball.carrierId === this.playerId) {
      target = targetGoal;
      reason = "carry-to-believed-goal";
    } else if (ball.carrierId !== null) {
      reason = "challenge-carrier";
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

function goalCentre(
  playerId: PlayerId,
  observation: FluxballPublicSportSnapshot,
): Axis {
  switch (playerId) {
    case "A":
      return { x: 0, y: observation.court.height / 2 };
    case "B":
      return { x: observation.court.width, y: observation.court.height / 2 };
    case "C":
      return { x: observation.court.width / 2, y: 0 };
    case "D":
      return {
        x: observation.court.width / 2,
        y: observation.court.height,
      };
  }
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
