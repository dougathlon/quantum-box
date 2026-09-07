import type { Axis, PlayerInput } from "../input";
import type { ActivePlayerMap, PlayerId } from "../modes";
import type { PlayerRules } from "../rules/types";
import type { GoalEvaluation, GoalId, ScoreBoard } from "./scoring";

export interface PlayerSnapshot {
  readonly id: PlayerId;
  readonly x: number;
  readonly y: number;
  readonly rawInput: Readonly<PlayerInput>;
  readonly rawCommand: Readonly<Axis>;
  readonly rawFacing: Readonly<Axis>;
  readonly resolvedMotion: Readonly<Axis>;
  readonly resolvedFacing: Readonly<Axis>;
  readonly rules: PlayerRules;
}

export interface BallSnapshot {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly carrierId: PlayerId | null;
}

interface SportEventBase {
  readonly eventId: number;
  readonly roundNumber: number;
  readonly tick: number;
  readonly ruleStateIndex: number;
}

export type BallContactConsequence =
  | "possession"
  | "steal"
  | "strike"
  | "dislodge";

export interface BallContactEvent extends SportEventBase {
  readonly type: "BALL_CONTACT";
  readonly playerId: PlayerId;
  readonly interactionRule: PlayerRules["interaction"];
  readonly previousCarrierId: PlayerId | null;
  readonly consequence: BallContactConsequence;
  readonly ballVelocityAfter: Readonly<Axis>;
}

export interface PhysicalGoalEvent extends SportEventBase, GoalEvaluation {
  readonly type: "PHYSICAL_GOAL";
}

export interface RoundTimerExpiredEvent extends SportEventBase {
  readonly type: "ROUND_TIMER_EXPIRED";
  readonly score: ScoreBoard;
}

export type SportEvent =
  | BallContactEvent
  | PhysicalGoalEvent
  | RoundTimerExpiredEvent;

export interface SportSnapshot {
  readonly roundNumber: number;
  readonly tick: number;
  readonly roundTick: number;
  readonly roundTicks: number;
  readonly secondsRemaining: number;
  readonly ruleStateIndex: number;
  readonly goalFreezeTicksRemaining: number;
  readonly ended: boolean;
  readonly activePlayerIds: readonly PlayerId[];
  readonly court: {
    readonly width: number;
    readonly height: number;
    readonly goalHalfExtent: number;
    readonly horizontalGoalHalfExtent: number;
  };
  readonly players: ActivePlayerMap<PlayerSnapshot>;
  readonly ball: BallSnapshot;
  readonly score: ScoreBoard;
  readonly latestGoal: PhysicalGoalEvent | null;
  readonly latestContact: BallContactEvent | null;
}

export interface SportFramePacket {
  readonly snapshot: SportSnapshot;
  readonly events: readonly SportEvent[];
}

export type GoalDetector = (ball: BallSnapshot) => GoalId | null;
