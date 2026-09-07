import type { ComputerDecision } from "../computer";
import type { PlayerInputFrame } from "../input";
import type {
  ActivePlayerMap,
  LobbySnapshot,
  MatchFormat,
  MatchSetup,
  PlayerId,
} from "../modes";
import type { InterpretedRoundRules, RoundRuleTrace } from "../rules/types";
import type {
  PhysicalGoalEvent,
  ScoreBoard,
  SportEvent,
  SportSnapshot,
} from "../simulation";

export type SessionPhase = "menu" | "lobby" | "playing" | "reveal" | "finished";

export interface CompletedRound {
  readonly roundNumber: number;
  readonly trace: RoundRuleTrace;
  readonly rules: InterpretedRoundRules;
  readonly scoreBefore: ScoreBoard;
  readonly scoreAfter: ScoreBoard;
  readonly goals: readonly PhysicalGoalEvent[];
}

interface SessionEventBase {
  readonly runId: number;
  readonly eventId: number;
  readonly roundNumber: number;
}

export interface RunStartedEvent extends SessionEventBase {
  readonly type: "RUN_STARTED";
  readonly setup: MatchSetup;
  readonly seed: number;
}

export interface RoundStartedEvent extends SessionEventBase {
  readonly type: "ROUND_STARTED";
  readonly trace: RoundRuleTrace;
  readonly rules: InterpretedRoundRules;
}

export interface SportWrappedEvent extends SessionEventBase {
  readonly type: "SPORT_EVENT";
  readonly sportEvent: SportEvent;
}

export interface RoundEndedEvent extends SessionEventBase {
  readonly type: "ROUND_ENDED";
  readonly round: CompletedRound;
}

export interface RunFinishedEvent extends SessionEventBase {
  readonly type: "RUN_FINISHED";
  readonly finalScore: ScoreBoard;
}

export interface ControllerFallbackEvent extends SessionEventBase {
  readonly type: "CONTROLLER_FALLBACK";
  readonly playerId: PlayerId;
  readonly controllerId: string;
}

export type SessionEvent =
  | RunStartedEvent
  | RoundStartedEvent
  | SportWrappedEvent
  | RoundEndedEvent
  | RunFinishedEvent
  | ControllerFallbackEvent;

export interface SessionSnapshot {
  readonly runId: number;
  readonly seed: number;
  readonly phase: SessionPhase;
  readonly selectedFormat: MatchFormat | null;
  readonly lobby: LobbySnapshot | null;
  readonly setup: MatchSetup | null;
  readonly roundNumber: number;
  readonly totalRounds: number;
  readonly score: ScoreBoard;
  readonly sport: SportSnapshot | null;
  readonly currentTrace: RoundRuleTrace | null;
  readonly currentRules: InterpretedRoundRules | null;
  readonly computerDecisions: Readonly<ActivePlayerMap<ComputerDecision>>;
  readonly completedRounds: readonly CompletedRound[];
  readonly controllerNotice: string;
  readonly auditHistory: readonly SessionEvent[];
}

export interface SessionFramePacket {
  readonly snapshot: SessionSnapshot;
  readonly events: readonly SessionEvent[];
}

export type SessionInputProvider = (
  snapshot: SessionSnapshot,
  nextTick: number,
) => PlayerInputFrame;
