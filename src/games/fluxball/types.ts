import type { ActivePlayerMap, PlayerId, RuleMode } from "./standalone/modes";
import type { PlayerInput } from "./standalone/input";
import type {
  InterpretedRoundRules,
  RoundRuleTrace,
} from "./standalone/rules/types";
import type { ScoreBoard } from "./standalone/simulation";
import type { PackSource } from "../../packs/types";
import type { RuleAcquisitionSource } from "./standalone/rules/types";

export const FLUXBALL_RULES_VERSION = "fluxball-rules-v6";
export const FLUXBALL_PREVIOUS_RULES_VERSION = "fluxball-rules-v5";
export const FLUXBALL_LEGACY_RULES_VERSION = "fluxball-rules-v4";
export const FLUXBALL_OLDER_RULES_VERSION = "fluxball-rules-v3";
export const FLUXBALL_OLDEST_RULES_VERSION = "fluxball-rules-v2";
export const FLUXBALL_TOTAL_ROUNDS = 3;
export const FLUXBALL_TICKS_PER_SECOND = 20;

export type FluxballPhase = "active" | "reveal" | "complete";

export interface FluxballFormat {
  readonly competitorCount: 2 | 4;
  readonly ruleMode: RuleMode;
  readonly roundSeconds: 40 | 60;
  readonly humanPlayerIds: readonly PlayerId[];
}

export interface FluxballHumanInput {
  readonly players: ActivePlayerMap<Readonly<PlayerInput>>;
  readonly revealRequests?: readonly FluxballRevealRequest[];
}

export interface FluxballRevealRequest {
  readonly playerId: PlayerId;
  readonly capturedAtMs: number;
}

export interface FluxballPublicPlayer {
  readonly id: PlayerId;
  readonly x: number;
  readonly y: number;
  readonly rawFacing: Readonly<{ x: number; y: number }>;
  readonly resolvedMotion: Readonly<{ x: number; y: number }>;
}

export interface FluxballPublicContact {
  readonly eventId: number;
  readonly roundNumber: number;
  readonly tick: number;
  readonly ruleStateIndex: number;
  readonly playerId: PlayerId;
  readonly previousCarrierId: PlayerId | null;
  readonly consequence: "possession" | "steal" | "strike" | "dislodge";
}

export interface FluxballPublicGoal {
  readonly eventId: number;
  readonly roundNumber: number;
  readonly tick: number;
  readonly ruleStateIndex: number;
  readonly physicalGoal: PlayerId;
  readonly awardedPlayerIds: readonly PlayerId[];
  readonly scoreAfter: ScoreBoard;
}

export interface FluxballPublicSportSnapshot {
  readonly roundNumber: number;
  readonly tick: number;
  readonly roundTick: number;
  readonly roundTicks: number;
  readonly secondsRemaining: number;
  readonly ruleStateIndex: number;
  readonly goalFreezeTicksRemaining: number;
  readonly activePlayerIds: readonly PlayerId[];
  readonly court: {
    readonly width: number;
    readonly height: number;
    readonly goalHalfExtent: number;
    readonly horizontalGoalHalfExtent: number;
  };
  readonly players: ActivePlayerMap<FluxballPublicPlayer>;
  readonly ball: {
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
    readonly carrierId: PlayerId | null;
  };
  readonly score: ScoreBoard;
  readonly latestGoal: FluxballPublicGoal | null;
  readonly latestContact: FluxballPublicContact | null;
}

export type FluxballBeliefValue<T extends string> = Readonly<{
  value: T | "UNKNOWN";
  confidence: number;
}>;

export interface FluxballCpuBelief {
  readonly playerId: PlayerId;
  readonly action: FluxballBeliefValue<"DIRECT" | "INVERTED">;
  readonly interaction: FluxballBeliefValue<"CARRY" | "STRIKE">;
  readonly targetGoal: FluxballBeliefValue<PlayerId>;
  readonly observations: number;
}

export interface FluxballRoundReveal {
  readonly roundNumber: number;
  readonly epochs: readonly FluxballRuleEpoch[];
  /** Final operative state, retained for tutorial evidence compatibility. */
  readonly trace: RoundRuleTrace;
  /** Final operative state, retained for tutorial evidence compatibility. */
  readonly rules: InterpretedRoundRules;
  readonly roundGoals: ScoreBoard;
  readonly roundWinnerIds: readonly PlayerId[];
  readonly roundWinsBefore: ScoreBoard;
  readonly roundWinsAfter: ScoreBoard;
  readonly goals: readonly FluxballPublicGoal[];
}

export interface FluxballRuleEpoch {
  readonly stateIndex: number;
  readonly sourceRoundBuckets: readonly [number, number];
  readonly startTick: number;
  readonly endTickExclusive: number;
  readonly triggeredByPlayerId: PlayerId | null;
  readonly trace: RoundRuleTrace;
  readonly rules: InterpretedRoundRules;
}

export interface FluxballPublicRuleChangeEvent {
  readonly eventId: number;
  readonly roundNumber: number;
  readonly tick: number;
  readonly playerId: PlayerId;
}

export interface FluxballSnapshot {
  readonly phase: FluxballPhase;
  readonly runId: string;
  readonly format: FluxballFormat;
  readonly roundNumber: number;
  readonly totalRounds: number;
  /** Goals in the current (or just-completed) timed round. */
  readonly roundGoals: ScoreBoard;
  /** Match score: one point for each timed round won outright. */
  readonly roundWins: ScoreBoard;
  readonly sport: FluxballPublicSportSnapshot | null;
  readonly reveal: FluxballRoundReveal | null;
  /** One shared human-triggered rule change is available per round. */
  readonly remainingRuleChanges: 0 | 1;
  readonly publicRuleChangeEvents: readonly FluxballPublicRuleChangeEvent[];
  readonly cpuBeliefs: ActivePlayerMap<FluxballCpuBelief>;
  readonly winnerIds: readonly PlayerId[];
  readonly humanWon: boolean;
}

export interface FluxballDesignerAxisEvidence {
  readonly context: "X" | "Y" | "Z";
  readonly dimension: "ACTION" | "INTERACTION" | "PURPOSE";
  readonly outcome: string;
  readonly signs: ActivePlayerMap<"+" | "-">;
  readonly rules: ActivePlayerMap<string>;
  readonly drawIndex: 0 | 1 | 2;
}

export interface FluxballDesignerEvidence {
  readonly packId: string;
  readonly contentSha256: string;
  readonly source: PackSource;
  readonly fixtureBankId: string;
  readonly fixtureId: string;
  readonly acquisitionSource: RuleAcquisitionSource;
  readonly samplingMethod: RoundRuleTrace["samplingMethod"];
  readonly sourceMeasurementBasis:
    | "separate-pauli-contexts"
    | "computational"
    | "classical";
  readonly providerProvenance: RoundRuleTrace["providerProvenance"] | null;
  readonly shotsPerCircuit: number;
  readonly roundNumber: number;
  readonly activePlayerIds: readonly PlayerId[];
  readonly axes: readonly FluxballDesignerAxisEvidence[];
}
