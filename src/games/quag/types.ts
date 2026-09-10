export const QUAG_RULES_VERSION = "quarry-rules-v5";
export const QUAG_TICKS_PER_SECOND = 20;
export const QUAG_TOTAL_ROUNDS = 3;
export const QUAG_ROUND_SECONDS = 60;
export const QUAG_READY_TICKS = 3 * QUAG_TICKS_PER_SECOND;
export const QUAG_ROUND_BREAK_TICKS = 2 * QUAG_TICKS_PER_SECOND;
export const QUAG_SUBPIXELS = 16;
export const QUAG_PLAYER_IDS = ["A", "B", "C", "D"] as const;
export type QuagPlayerId = (typeof QUAG_PLAYER_IDS)[number];
export type QuagPhase = "ready" | "active" | "round-break" | "complete";
export type QuagFacing = -1 | 1;

export interface QuagInput {
  readonly horizontal: -1 | 0 | 1;
  readonly flapPressed: boolean;
  readonly players?: Readonly<Partial<Record<QuagPlayerId, QuagPlayerControl>>>;
}

export interface QuagPlayerControl {
  readonly horizontal: -1 | 0 | 1;
  readonly flapPressed: boolean;
}

export interface QuagPlayerSnapshot {
  readonly id: QuagPlayerId;
  readonly previousXSubpixels: number;
  readonly previousYSubpixels: number;
  readonly xSubpixels: number;
  readonly ySubpixels: number;
  readonly velocityXSubpixels: number;
  readonly velocityYSubpixels: number;
  readonly facing: QuagFacing;
  readonly grounded: boolean;
  readonly flapCooldownTicks: number;
  readonly movementSequence: number;
  readonly score: number;
  readonly roundScore: number;
  readonly roundWins: number;
  readonly knockedOutTicks: number;
  readonly graceTicks: number;
  readonly respawns: number;
}

export interface QuagEvent {
  readonly eventId: number;
  readonly tick: number;
  readonly type:
    | "CAPTURE"
    | "GRAPH_SHIFT"
    | "FLAP"
    | "LAND"
    | "WRAP"
    | "ROUND_COMPLETE";
  readonly detail: string;
  readonly captureEdges: readonly string[];
  readonly playerIds: readonly QuagPlayerId[];
}

export interface QuagMetrics {
  readonly firstMeaningfulInteractionTick: number | null;
  readonly captures: number;
  readonly relationshipPhaseCount: number;
  readonly repeatDeaths: number;
  readonly respawnDelays: number;
  readonly cpuInactiveTicks: number;
  readonly flaps: number;
  readonly landings: number;
  readonly wraps: number;
  readonly airborneTicks: number;
}

export interface QuagSnapshot {
  readonly phase: QuagPhase;
  readonly tick: number;
  readonly activeTick: number;
  readonly roundNumber: number;
  readonly totalRounds: number;
  readonly roundTick: number;
  readonly readyTicksRemaining: number;
  readonly roundBreakTicksRemaining: number;
  readonly secondsRemaining: number;
  readonly graphPhase: number;
  readonly ticksUntilRemeasurement: number;
  readonly lastGraphShiftTick: number | null;
  readonly arenaId: QuagArenaId;
  readonly relationshipSource: "MODEL" | "QPU";
  readonly humanPlayerIds: readonly QuagPlayerId[];
  readonly humanTargets: readonly QuagPlayerId[];
  readonly directedRelations: readonly `${QuagPlayerId}>${QuagPlayerId}`[];
  readonly players: readonly QuagPlayerSnapshot[];
  readonly latestEvent: QuagEvent | null;
  readonly eventsThisTick: readonly QuagEvent[];
  readonly roundWinnerIds: readonly QuagPlayerId[];
  readonly winnerIds: readonly QuagPlayerId[];
  readonly metrics: QuagMetrics;
}

export interface QuagPlatform {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly thickness: number;
}

export interface QuagSpawnPerch {
  readonly id: string;
  readonly x: number;
  readonly platformTop: number;
  readonly facing: QuagFacing;
}

export interface QuagArena {
  readonly id: QuagArenaId;
  readonly left: number;
  readonly right: number;
  readonly ceiling: number;
  readonly floorTop: number;
  readonly platforms: readonly QuagPlatform[];
  readonly spawnPerches: readonly QuagSpawnPerch[];
}

export type QuagArenaId =
  | "quarry-aerial-arena-v1"
  | "quarry-aerial-arena-v2"
  | "quarry-aerial-arena-v3";
