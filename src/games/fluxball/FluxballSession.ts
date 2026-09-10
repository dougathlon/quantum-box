import type { RunContext } from "../../core/run";
import { ARCADE_CPU_TUNING, FluxballCpuPolicy } from "./FluxballCpuPolicy";
import { isCertifiedFluxballStorySeed } from "./FluxballStorySeed";
import {
  buildFluxballRuleSchedule,
  type FluxballRuleScheduleState,
} from "./FluxballRuleBank";
import { FLUXBALL_FIXTURE_CATALOG } from "./fluxballControlPacks";
import {
  NEUTRAL_PLAYER_INPUT,
  type PlayerInput,
  type PlayerInputFrame,
} from "./standalone/input";
import {
  activePlayerIdsFor,
  type ActivePlayerMap,
  type PlayerId,
} from "./standalone/modes";
import { interpretRoundRules } from "./standalone/rules/interpretRoundRules";
import { mixSeed } from "./standalone/rules/rng";
import type {
  InterpretedRoundRules,
  RoundRuleTrace,
} from "./standalone/rules/types";
import {
  SportSimulation,
  createScoreBoard,
  type BallContactEvent,
  type PhysicalGoalEvent,
  type ScoreBoard,
  type SportSnapshot,
} from "./standalone/simulation";
import {
  FLUXBALL_RULES_VERSION,
  FLUXBALL_PREVIOUS_RULES_VERSION,
  FLUXBALL_LEGACY_RULES_VERSION,
  FLUXBALL_OLDEST_RULES_VERSION,
  FLUXBALL_OLDER_RULES_VERSION,
  FLUXBALL_TICKS_PER_SECOND,
  FLUXBALL_TOTAL_ROUNDS,
  type FluxballCpuBelief,
  type FluxballFormat,
  type FluxballHumanInput,
  type FluxballPublicContact,
  type FluxballPublicGoal,
  type FluxballPublicPlayer,
  type FluxballPublicRuleChangeEvent,
  type FluxballRevealRequest,
  type FluxballRuleEpoch,
  type FluxballPublicSportSnapshot,
  type FluxballRoundReveal,
  type FluxballSnapshot,
} from "./types";

const POLICY_SEED_DOMAIN = 0x4350_5542;

interface PreparedRuleState extends FluxballRuleScheduleState {
  readonly rules: InterpretedRoundRules;
}

interface MutableRuleEpoch {
  readonly stateIndex: number;
  readonly sourceRoundBuckets: readonly [number, number];
  readonly startTick: number;
  endTickExclusive: number;
  readonly triggeredByPlayerId: PlayerId | null;
  readonly trace: RoundRuleTrace;
  readonly rules: InterpretedRoundRules;
}

export class FluxballSession {
  private readonly activePlayerIds: readonly PlayerId[];
  private readonly cpuPlayerIds: readonly PlayerId[];
  private readonly roundTicks: number;
  private readonly totalRounds: number;
  private phase: "active" | "reveal" | "complete" = "active";
  private roundNumber = 1;
  private roundWins: ScoreBoard;
  private sport!: SportSimulation;
  private trace!: RoundRuleTrace;
  private rules!: InterpretedRoundRules;
  private readonly schedules: readonly (readonly PreparedRuleState[])[];
  private currentSchedule: readonly PreparedRuleState[] = [];
  private ruleStateIndex = 0;
  private roundGoals: FluxballPublicGoal[] = [];
  private reveal: FluxballRoundReveal | null = null;
  private policies = new Map<PlayerId, FluxballCpuPolicy>();
  private remainingRuleChanges: 0 | 1 = 1;
  private publicRuleChangeEvents: FluxballPublicRuleChangeEvent[] = [];
  private epochHistory: MutableRuleEpoch[] = [];
  private revealEventCounter = 0;

  public constructor(
    private readonly context: RunContext,
    private readonly format: FluxballFormat,
  ) {
    validateContext(context, format);
    this.totalRounds =
      context.rulesVersion === FLUXBALL_RULES_VERSION
        ? FLUXBALL_TOTAL_ROUNDS
        : 4;
    if (
      context.playMode === "story" &&
      !isCertifiedFluxballStorySeed(
        context.runSeed,
        format.competitorCount,
        context.rulesVersion !== FLUXBALL_RULES_VERSION,
      )
    ) {
      throw new Error(
        "Fluxball Story rejected an uncertified seed before RUN_STARTED.",
      );
    }
    this.activePlayerIds = Object.freeze([
      ...activePlayerIdsFor(format.competitorCount),
    ]);
    validateHumanPlayers(this.activePlayerIds, format.humanPlayerIds);
    this.cpuPlayerIds = Object.freeze(
      this.activePlayerIds.filter(
        (playerId) => !format.humanPlayerIds.includes(playerId),
      ),
    );
    this.roundTicks = format.roundSeconds * FLUXBALL_TICKS_PER_SECOND;
    const stateCount = 2;
    this.schedules = deepFreeze(
      Array.from({ length: this.totalRounds }, (_, index) =>
        buildFluxballRuleSchedule({
          catalog: FLUXBALL_FIXTURE_CATALOG,
          competitorCount: format.competitorCount,
          runSeed: context.runSeed,
          gameplayRoundNumber: index + 1,
          stateCount,
        }).map((state) => ({
          ...state,
          rules: interpretRoundRules(state.trace, format.ruleMode),
        })),
      ),
    );
    if (
      this.schedules.some((schedule) =>
        schedule.some(
          (state) => state.trace.acquisitionSource !== "moth-qgraph-qpu",
        ),
      )
    ) {
      throw new Error(
        "Fluxball runtime authority requires a complete recorded QPU schedule.",
      );
    }
    this.roundWins = createScoreBoard(this.activePlayerIds);
    this.startRound();
  }

  public snapshot(): FluxballSnapshot {
    const sport = this.sport
      ? createPublicSportSnapshot(this.sport.getSnapshot())
      : null;
    const roundGoals = sport?.score ?? createScoreBoard(this.activePlayerIds);
    const winners = this.phase === "complete" ? winnerIds(this.roundWins) : [];
    return deepFreeze({
      phase: this.phase,
      runId: this.context.runId,
      format: {
        ...this.format,
        humanPlayerIds: [...this.format.humanPlayerIds],
      },
      roundNumber: this.roundNumber,
      totalRounds: this.totalRounds,
      roundGoals: createScoreBoard(this.activePlayerIds, roundGoals),
      roundWins: createScoreBoard(this.activePlayerIds, this.roundWins),
      sport,
      reveal: this.reveal,
      remainingRuleChanges: this.remainingRuleChanges,
      publicRuleChangeEvents: [...this.publicRuleChangeEvents],
      cpuBeliefs: this.cpuBeliefs(),
      winnerIds: winners,
      humanWon:
        this.phase === "complete" &&
        humanBeatComputers(
          this.roundWins,
          this.format.humanPlayerIds,
          this.cpuPlayerIds,
        ),
    });
  }

  public developerAudit(): Readonly<{
    roundNumber: number;
    cpuBeliefs: ActivePlayerMap<FluxballCpuBelief>;
  }> {
    return deepFreeze({
      roundNumber: this.roundNumber,
      cpuBeliefs: this.cpuBeliefs(),
    });
  }

  public step(input: FluxballHumanInput): FluxballSnapshot {
    if (this.phase !== "active") return this.snapshot();
    this.processRevealRequests(input.revealRequests ?? []);
    const publicBefore = createPublicSportSnapshot(this.sport.getSnapshot());
    const inputFrame: Partial<Record<PlayerId, Readonly<PlayerInput>>> = {};
    for (const playerId of this.activePlayerIds) {
      if (this.format.humanPlayerIds.includes(playerId)) {
        inputFrame[playerId] = copyInput(
          input.players[playerId] ?? NEUTRAL_PLAYER_INPUT,
        );
        continue;
      }
      const policy = this.policies.get(playerId);
      if (!policy) throw new Error(`Fluxball CPU ${playerId} has no policy.`);
      inputFrame[playerId] = policy.decide(publicBefore).rawInput;
    }
    const packet = this.sport.step(inputFrame as PlayerInputFrame);
    for (const event of packet.events) {
      if (event.type === "PHYSICAL_GOAL") {
        this.roundGoals.push(publicGoal(event));
      }
    }
    if (packet.snapshot.ended) this.endRound(packet.snapshot);
    return this.snapshot();
  }

  public continueAfterReveal(): FluxballSnapshot {
    if (this.phase !== "reveal") return this.snapshot();
    if (this.roundNumber >= this.totalRounds) {
      this.phase = "complete";
      return this.snapshot();
    }
    this.roundNumber += 1;
    this.startRound();
    return this.snapshot();
  }

  private startRound(): void {
    this.phase = "active";
    this.reveal = null;
    this.roundGoals = [];
    this.currentSchedule = this.schedules[this.roundNumber - 1] ?? [];
    const firstState = this.currentSchedule[0];
    if (!firstState)
      throw new Error("Fluxball round has no prepared rule state.");
    this.ruleStateIndex = 0;
    this.trace = firstState.trace;
    this.rules = firstState.rules;
    this.remainingRuleChanges = 1;
    this.publicRuleChangeEvents = [];
    this.epochHistory = [this.createMutableEpoch(0, 1, null)];
    this.sport = new SportSimulation({
      roundNumber: this.roundNumber,
      activePlayerIds: this.activePlayerIds,
      rules: this.rules,
      roundTicks: this.roundTicks,
      ruleStateIndex: 0,
    });
    this.resetCpuPolicies();
  }

  private resetCpuPolicies(): void {
    this.policies = new Map(
      this.cpuPlayerIds.map((playerId) => [
        playerId,
        new FluxballCpuPolicy(
          playerId,
          mixSeed(
            mixSeed(this.context.runSeed, POLICY_SEED_DOMAIN),
            mixSeed(
              mixSeed(this.roundNumber, this.ruleStateIndex),
              playerId.charCodeAt(0),
            ),
          ),
          ARCADE_CPU_TUNING,
          this.cpuPlayerIds,
        ),
      ]),
    );
  }

  private processRevealRequests(
    requests: readonly FluxballRevealRequest[],
  ): void {
    if (this.sport.getSnapshot().goalFreezeTicksRemaining > 0) return;
    const ordered = [...requests].sort(
      (left, right) =>
        left.capturedAtMs - right.capturedAtMs ||
        left.playerId.localeCompare(right.playerId),
    );
    for (const request of ordered) {
      if (!Number.isFinite(request.capturedAtMs)) continue;
      if (!this.format.humanPlayerIds.includes(request.playerId)) continue;
      if (this.remainingRuleChanges !== 1) continue;
      const nextState = this.currentSchedule[this.ruleStateIndex + 1];
      if (!nextState) continue;
      const tick = this.sport.getSnapshot().roundTick;
      const currentEpoch = this.epochHistory.at(-1);
      if (!currentEpoch)
        throw new Error("Fluxball rule epoch history is empty.");
      currentEpoch.endTickExclusive = tick + 1;
      this.remainingRuleChanges = 0;
      this.revealEventCounter += 1;
      this.publicRuleChangeEvents.push(
        deepFreeze({
          eventId: this.revealEventCounter,
          roundNumber: this.roundNumber,
          tick,
          playerId: request.playerId,
        }),
      );
      this.ruleStateIndex += 1;
      this.trace = nextState.trace;
      this.rules = nextState.rules;
      this.sport.replaceRules(this.rules, this.ruleStateIndex);
      this.epochHistory.push(
        this.createMutableEpoch(
          this.ruleStateIndex,
          tick + 1,
          request.playerId,
        ),
      );
      this.resetCpuPolicies();
      break;
    }
  }

  private createMutableEpoch(
    stateIndex: number,
    startTick: number,
    triggeredByPlayerId: PlayerId | null,
  ): MutableRuleEpoch {
    const state = this.currentSchedule[stateIndex];
    if (!state)
      throw new Error(`Fluxball rule state ${stateIndex} is missing.`);
    return {
      stateIndex,
      sourceRoundBuckets: state.sourceRoundBuckets,
      startTick,
      endTickExclusive: startTick,
      triggeredByPlayerId,
      trace: state.trace,
      rules: state.rules,
    };
  }

  private endRound(snapshot: SportSnapshot): void {
    this.phase = "reveal";
    const roundWinsBefore = createScoreBoard(
      this.activePlayerIds,
      this.roundWins,
    );
    const roundWinnerIds = uniqueRoundWinnerIds(snapshot.score);
    const winnerId = roundWinnerIds[0];
    if (winnerId) {
      this.roundWins = Object.freeze({
        ...this.roundWins,
        [winnerId]: (this.roundWins[winnerId] ?? 0) + 1,
      });
    }
    const finalEpoch = this.epochHistory.at(-1);
    if (!finalEpoch) throw new Error("Fluxball rule epoch history is empty.");
    finalEpoch.endTickExclusive = snapshot.roundTick + 1;
    this.reveal = deepFreeze({
      roundNumber: this.roundNumber,
      epochs: this.epochHistory.map(
        (epoch): FluxballRuleEpoch => ({
          ...epoch,
        }),
      ),
      trace: this.trace,
      rules: this.rules,
      roundGoals: createScoreBoard(this.activePlayerIds, snapshot.score),
      roundWinnerIds,
      roundWinsBefore,
      roundWinsAfter: createScoreBoard(this.activePlayerIds, this.roundWins),
      goals: [...this.roundGoals],
    });
  }

  private cpuBeliefs(): ActivePlayerMap<FluxballCpuBelief> {
    return Object.freeze(
      Object.fromEntries(
        this.cpuPlayerIds.map((playerId) => {
          const policy = this.policies.get(playerId);
          if (!policy)
            throw new Error(`Fluxball CPU ${playerId} has no policy.`);
          return [playerId, policy.snapshotBelief()];
        }),
      ) as Partial<Record<PlayerId, FluxballCpuBelief>>,
    );
  }
}

export function createPublicSportSnapshot(
  snapshot: SportSnapshot,
): FluxballPublicSportSnapshot {
  const players: Partial<Record<PlayerId, FluxballPublicPlayer>> = {};
  for (const playerId of snapshot.activePlayerIds) {
    const player = snapshot.players[playerId];
    if (!player)
      throw new Error(`Public snapshot is missing Player ${playerId}.`);
    players[playerId] = {
      id: player.id,
      x: player.x,
      y: player.y,
      rawFacing: { ...player.rawFacing },
      resolvedMotion: { ...player.resolvedMotion },
    };
  }
  return deepFreeze({
    roundNumber: snapshot.roundNumber,
    tick: snapshot.tick,
    roundTick: snapshot.roundTick,
    roundTicks: snapshot.roundTicks,
    secondsRemaining: snapshot.secondsRemaining,
    ruleStateIndex: snapshot.ruleStateIndex,
    goalFreezeTicksRemaining: snapshot.goalFreezeTicksRemaining,
    activePlayerIds: [...snapshot.activePlayerIds],
    court: { ...snapshot.court },
    players,
    ball: { ...snapshot.ball },
    score: createScoreBoard(snapshot.activePlayerIds, snapshot.score),
    latestGoal: snapshot.latestGoal ? publicGoal(snapshot.latestGoal) : null,
    latestContact: snapshot.latestContact
      ? publicContact(snapshot.latestContact)
      : null,
  });
}

function publicContact(event: BallContactEvent): FluxballPublicContact {
  return deepFreeze({
    eventId: event.eventId,
    roundNumber: event.roundNumber,
    tick: event.tick,
    ruleStateIndex: event.ruleStateIndex,
    playerId: event.playerId,
    previousCarrierId: event.previousCarrierId,
    consequence: event.consequence,
  });
}

function publicGoal(event: PhysicalGoalEvent): FluxballPublicGoal {
  return deepFreeze({
    eventId: event.eventId,
    roundNumber: event.roundNumber,
    tick: event.tick,
    ruleStateIndex: event.ruleStateIndex,
    physicalGoal: event.physicalGoal,
    awardedPlayerIds: awardedIds(event),
    scoreAfter: event.scoreAfter,
  });
}

function awardedIds(event: PhysicalGoalEvent): readonly PlayerId[] {
  return Object.entries(event.awards)
    .filter(([, awarded]) => awarded)
    .map(([playerId]) => playerId as PlayerId);
}

function validateContext(context: RunContext, format: FluxballFormat): void {
  if (
    context.gameId !== "fluxball" ||
    (context.rulesVersion !== FLUXBALL_RULES_VERSION &&
      context.rulesVersion !== FLUXBALL_PREVIOUS_RULES_VERSION &&
      context.rulesVersion !== FLUXBALL_LEGACY_RULES_VERSION &&
      context.rulesVersion !== FLUXBALL_OLDER_RULES_VERSION &&
      context.rulesVersion !== FLUXBALL_OLDEST_RULES_VERSION)
  ) {
    throw new Error(
      "Fluxball requires a Fluxball run context and matching rules version.",
    );
  }
  const currentDuration =
    context.rulesVersion === FLUXBALL_RULES_VERSION ||
    context.rulesVersion === FLUXBALL_PREVIOUS_RULES_VERSION;
  const uniformMinuteDuration =
    context.rulesVersion === FLUXBALL_LEGACY_RULES_VERSION;
  const legacySplitDuration = !currentDuration && !uniformMinuteDuration;
  if (
    (currentDuration && format.roundSeconds !== 40) ||
    (uniformMinuteDuration && format.roundSeconds !== 60) ||
    (legacySplitDuration &&
      ((format.competitorCount === 2 && format.roundSeconds !== 40) ||
        (format.competitorCount === 4 && format.roundSeconds !== 60)))
  ) {
    throw new Error(
      currentDuration
        ? "Quantum Box Fluxball v5/v6 requires 40-second rounds in every format."
        : uniformMinuteDuration
          ? "Quantum Box Fluxball v4 requires 60-second rounds in every format."
          : "Older Quantum Box Fluxball requires 2P/40s or 4P/60s rounds.",
    );
  }
  if (context.playMode !== "story") return;
  const currentStoryFormat =
    context.storyStage === "fluxball-global"
      ? format.competitorCount === 2 && format.ruleMode === "global"
      : context.storyStage === "fluxball-individual"
        ? format.competitorCount === 2 && format.ruleMode === "individual"
        : false;
  const legacyStoryFormat =
    context.storyStage === "fluxball-two"
      ? format.competitorCount === 2
      : context.storyStage === "fluxball-four"
        ? format.competitorCount === 4
        : false;
  if (
    (currentDuration && !currentStoryFormat) ||
    (!currentDuration && !legacyStoryFormat)
  )
    throw new Error(
      "Fluxball Story authority does not match the match format.",
    );
}

function validateHumanPlayers(
  activePlayerIds: readonly PlayerId[],
  humanPlayerIds: readonly PlayerId[],
): void {
  if (
    humanPlayerIds.length === 0 ||
    new Set(humanPlayerIds).size !== humanPlayerIds.length
  ) {
    throw new Error("Fluxball requires at least one unique human player.");
  }
  if (humanPlayerIds.some((playerId) => !activePlayerIds.includes(playerId))) {
    throw new Error("Fluxball human assignment includes an inactive player.");
  }
}

function winnerIds(score: ScoreBoard): readonly PlayerId[] {
  const entries = Object.entries(score) as [PlayerId, number][];
  const maximum = Math.max(...entries.map(([, value]) => value));
  return Object.freeze(
    entries
      .filter(([, value]) => value === maximum)
      .map(([playerId]) => playerId),
  );
}

function uniqueRoundWinnerIds(score: ScoreBoard): readonly PlayerId[] {
  const leaders = winnerIds(score);
  return leaders.length === 1 ? leaders : Object.freeze([]);
}

function humanBeatComputers(
  score: ScoreBoard,
  humanPlayerIds: readonly PlayerId[],
  cpuPlayerIds: readonly PlayerId[],
): boolean {
  if (cpuPlayerIds.length === 0) return true;
  const bestHuman = Math.max(
    ...humanPlayerIds.map((playerId) => score[playerId] ?? 0),
  );
  const bestCpu = Math.max(
    ...cpuPlayerIds.map((playerId) => score[playerId] ?? 0),
  );
  return bestHuman > bestCpu;
}

function copyInput(input: Readonly<PlayerInput>): Readonly<PlayerInput> {
  return Object.freeze({ ...input });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
