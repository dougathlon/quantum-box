import { TUNING } from "../config/tuning";
import {
  inputFromAxis,
  normalizeAxis,
  type Axis,
  type PlayerInput,
} from "../input";
import type { PlayerId } from "../modes";
import type { PlayerRules } from "../rules/types";
import { scoringGoalFor } from "../simulation/scoring";
import type { SportSnapshot } from "../simulation/types";

export type ComputerDecisionReason =
  | "pursue-ball"
  | "challenge-carrier"
  | "carry-to-goal"
  | "stage-strike"
  | "strike-through-ball"
  | "hesitate";

export interface ComputerDecision {
  playerId: PlayerId;
  reason: ComputerDecisionReason;
  target: Readonly<Axis>;
  desiredWorldMotion: Readonly<Axis>;
  rawInput: Readonly<PlayerInput>;
}

function distance(left: Axis, right: Axis): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function dot(left: Axis, right: Axis): number {
  return left.x * right.x + left.y * right.y;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function inverseEncodeWorldMotion(worldMotion: Axis, rules: PlayerRules): Axis {
  if (rules.action === "DIRECT") return worldMotion;
  return { x: -worldMotion.x, y: -worldMotion.y };
}

export class ComputerController {
  private readonly verticalBias: -1 | 1;
  private lastDecisionTick = -1;
  private cachedDecision: ComputerDecision | null = null;

  constructor(
    private readonly playerId: PlayerId,
    seed: number,
  ) {
    const mixed =
      (seed ^ Math.imul(playerId.charCodeAt(0) - 64, 0x9e3779b1)) >>> 0;
    this.verticalBias = (mixed & 1) === 0 ? -1 : 1;
  }

  reset(): void {
    this.lastDecisionTick = -1;
    this.cachedDecision = null;
  }

  decide(snapshot: SportSnapshot): ComputerDecision {
    const decisionTicks =
      snapshot.activePlayerIds.length === 4
        ? TUNING.computerFourPlayerDecisionTicks
        : TUNING.computerDecisionTicks;
    if (
      this.cachedDecision &&
      snapshot.roundTick - this.lastDecisionTick < decisionTicks
    ) {
      return this.cachedDecision;
    }
    const player = snapshot.players[this.playerId];
    if (!player) throw new Error(`CPU Player ${this.playerId} is not active.`);
    const fourPlayerDecisionIndex = Math.floor(
      snapshot.roundTick / decisionTicks,
    );
    const playerPhase = this.playerId.charCodeAt(0) - 64;
    if (
      snapshot.activePlayerIds.length === 4 &&
      (fourPlayerDecisionIndex + playerPhase) %
        TUNING.computerFourPlayerHesitationCycle ===
        0
    ) {
      const decision: ComputerDecision = Object.freeze({
        playerId: this.playerId,
        reason: "hesitate",
        target: Object.freeze({ x: player.x, y: player.y }),
        desiredWorldMotion: Object.freeze({ x: 0, y: 0 }),
        rawInput: Object.freeze(inputFromAxis({ x: 0, y: 0 })),
      });
      this.lastDecisionTick = snapshot.roundTick;
      this.cachedDecision = decision;
      return decision;
    }
    const goalSide = scoringGoalFor(this.playerId, player.rules.purpose);
    const scoringGoal = (() => {
      switch (goalSide) {
        case "A":
          return { x: 0, y: snapshot.court.height / 2 };
        case "B":
          return { x: snapshot.court.width, y: snapshot.court.height / 2 };
        case "C":
          return { x: snapshot.court.width / 2, y: 0 };
        case "D":
          return { x: snapshot.court.width / 2, y: snapshot.court.height };
      }
    })();
    const playerPosition = { x: player.x, y: player.y };
    const ballPosition = { x: snapshot.ball.x, y: snapshot.ball.y };
    let target = ballPosition;
    let reason: ComputerDecisionReason = "pursue-ball";
    let stageNudge: Axis = { x: 0, y: this.verticalBias };

    if (snapshot.ball.carrierId === this.playerId) {
      target = scoringGoal;
      reason = "carry-to-goal";
    } else if (snapshot.ball.carrierId !== null) {
      target = ballPosition;
      reason = "challenge-carrier";
    } else if (player.rules.interaction === "STRIKE") {
      const strikeDirection = normalizeAxis({
        x: scoringGoal.x - snapshot.ball.x,
        y: scoringGoal.y - snapshot.ball.y,
      });
      const strikePerpendicular = {
        x: -strikeDirection.y,
        y: strikeDirection.x,
      };
      const stagingDistance =
        TUNING.playerRadius + TUNING.ballRadius + TUNING.computerDeadZone * 2;
      const stagingPoint = {
        x: snapshot.ball.x - strikeDirection.x * stagingDistance,
        y: snapshot.ball.y - strikeDirection.y * stagingDistance,
      };
      const playerFromBall = {
        x: player.x - snapshot.ball.x,
        y: player.y - snapshot.ball.y,
      };
      const forwardOffset = dot(playerFromBall, strikeDirection);
      const lateralOffset = dot(playerFromBall, strikePerpendicular);
      const flankClearance = stagingDistance + TUNING.playerRadius;
      const needsFlankRoute =
        forwardOffset > -TUNING.computerDeadZone &&
        Math.abs(lateralOffset) < flankClearance;

      if (needsFlankRoute) {
        const preferredSide: -1 | 1 =
          Math.abs(lateralOffset) > TUNING.computerDeadZone
            ? lateralOffset < 0
              ? -1
              : 1
            : this.verticalBias;
        const flankCandidate = (side: -1 | 1): Axis => ({
          x: snapshot.ball.x + strikePerpendicular.x * flankClearance * side,
          y: snapshot.ball.y + strikePerpendicular.y * flankClearance * side,
        });
        const fitToCourt = (point: Axis): Axis => ({
          x: clamp(
            point.x,
            TUNING.courtPadding,
            snapshot.court.width - TUNING.courtPadding,
          ),
          y: clamp(
            point.y,
            TUNING.courtPadding,
            snapshot.court.height - TUNING.courtPadding,
          ),
        });
        const alternateSide: -1 | 1 = preferredSide === 1 ? -1 : 1;
        const preferredCandidate = flankCandidate(preferredSide);
        const alternateCandidate = flankCandidate(alternateSide);
        const preferredTarget = fitToCourt(preferredCandidate);
        const alternateTarget = fitToCourt(alternateCandidate);
        const useAlternate =
          distance(alternateCandidate, alternateTarget) <
          distance(preferredCandidate, preferredTarget);
        const routeSide = useAlternate ? alternateSide : preferredSide;
        target = useAlternate ? alternateTarget : preferredTarget;
        stageNudge = {
          x: strikePerpendicular.x * routeSide,
          y: strikePerpendicular.y * routeSide,
        };
        reason = "stage-strike";
      } else if (
        distance(playerPosition, stagingPoint) <=
        TUNING.computerDeadZone * 2
      ) {
        target = {
          x: snapshot.ball.x + strikeDirection.x * TUNING.ballRadius,
          y: snapshot.ball.y + strikeDirection.y * TUNING.ballRadius,
        };
        reason = "strike-through-ball";
      } else {
        target = stagingPoint;
        reason = "stage-strike";
      }
    }

    const delta = {
      x:
        Math.abs(target.x - player.x) <= TUNING.computerDeadZone
          ? 0
          : target.x - player.x,
      y:
        Math.abs(target.y - player.y) <= TUNING.computerDeadZone
          ? 0
          : target.y - player.y,
    };
    if (delta.x === 0 && delta.y === 0 && reason === "stage-strike") {
      delta.x = stageNudge.x;
      delta.y = stageNudge.y;
    }
    const desiredWorldMotion = normalizeAxis(delta);
    const controlMotion = inverseEncodeWorldMotion(
      desiredWorldMotion,
      player.rules,
    );
    const decision: ComputerDecision = Object.freeze({
      playerId: this.playerId,
      reason,
      target: Object.freeze({ x: target.x, y: target.y }),
      desiredWorldMotion: Object.freeze({
        x: desiredWorldMotion.x,
        y: desiredWorldMotion.y,
      }),
      rawInput: Object.freeze(inputFromAxis(controlMotion)),
    });
    this.lastDecisionTick = snapshot.roundTick;
    this.cachedDecision = decision;
    return decision;
  }
}
