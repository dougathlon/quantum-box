import { ComputerController, type ComputerDecision } from "../computer";
import { TUNING } from "../config/tuning";
import type { FixtureCatalog } from "../fixtures";
import {
  NEUTRAL_INPUT_FRAME,
  copyPlayerInput,
  inputForPlayer,
  type PlayerInputFrame,
} from "../input";
import {
  COMPUTER_CONTROLLER,
  activePlayerIdsFor,
  controllerForPlayer,
  createMatchSetup,
  type ActivePlayerMap,
  type HumanControllerAssignment,
  type LobbyController,
  type LobbySnapshot,
  type MatchFormat,
  type MatchSetup,
  type PlayerId,
} from "../modes";
import { interpretRoundRules } from "../rules/interpretRoundRules";
import { sampleRoundRules } from "../rules/sampleRoundRules";
import type { InterpretedRoundRules, RoundRuleTrace } from "../rules/types";
import {
  SportSimulation,
  createScoreBoard,
  type PhysicalGoalEvent,
  type ScoreBoard,
  type SportEvent,
  type SportFramePacket,
} from "../simulation";
import type {
  CompletedRound,
  ControllerFallbackEvent,
  RoundEndedEvent,
  RoundStartedEvent,
  RunFinishedEvent,
  RunStartedEvent,
  SessionEvent,
  SessionFramePacket,
  SessionInputProvider,
  SessionPhase,
  SessionSnapshot,
  SportWrappedEvent,
} from "./types";

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
}

function copyScore(
  activePlayerIds: readonly PlayerId[],
  score: ScoreBoard,
): ScoreBoard {
  return createScoreBoard(activePlayerIds, score);
}

function humanAssignmentsFromSetup(
  setup: MatchSetup,
): ActivePlayerMap<HumanControllerAssignment> {
  const humans: Partial<Record<PlayerId, HumanControllerAssignment>> = {};
  for (const playerId of setup.activePlayerIds) {
    const controller = controllerForPlayer(setup, playerId);
    if (controller.kind === "human") humans[playerId] = controller;
  }
  return Object.freeze(humans);
}

export class FluxballSession {
  private readonly catalog: FixtureCatalog;
  private readonly seed: number;
  private runId = 0;
  private phase: SessionPhase = "menu";
  private selectedFormat: MatchFormat | null = null;
  private joinedControllers: Partial<
    Record<PlayerId, HumanControllerAssignment>
  > = {};
  private setup: MatchSetup | null = null;
  private roundNumber = 0;
  private score: ScoreBoard = {};
  private sport: SportSimulation | null = null;
  private currentTrace: RoundRuleTrace | null = null;
  private currentRules: InterpretedRoundRules | null = null;
  private roundScoreBefore: ScoreBoard = {};
  private roundGoals: PhysicalGoalEvent[] = [];
  private computerControllers = new Map<PlayerId, ComputerController>();
  private computerDecisions: Partial<Record<PlayerId, ComputerDecision>> = {};
  private completedRounds: CompletedRound[] = [];
  private controllerNotice = "";
  private accumulatorSeconds = 0;
  private eventCounter = 0;
  private outgoingEvents: SessionEvent[] = [];
  private auditHistory: SessionEvent[] = [];

  public constructor(catalog: FixtureCatalog, seed = 260818) {
    this.catalog = catalog;
    this.seed = seed >>> 0;
  }

  public configureFormat(format: MatchFormat): SessionFramePacket {
    const activePlayerIds = activePlayerIdsFor(format.competitorCount);
    this.phase = "lobby";
    this.selectedFormat = Object.freeze({ ...format });
    this.joinedControllers = {};
    this.setup = null;
    this.roundNumber = 0;
    this.score = createScoreBoard(activePlayerIds);
    this.clearRunState();
    return this.drainFramePacket();
  }

  public toggleLobbyController(
    controller: LobbyController,
  ): SessionFramePacket {
    if (this.phase !== "lobby" || !this.selectedFormat) {
      throw new Error("Controllers can join only in the Fluxball lobby.");
    }
    if (!controller.controllerId || !controller.label) {
      throw new Error("Lobby controller identity and label are required.");
    }
    const activePlayerIds = activePlayerIdsFor(
      this.selectedFormat.competitorCount,
    );
    const existing = activePlayerIds.find(
      (playerId) =>
        this.joinedControllers[playerId]?.controllerId ===
        controller.controllerId,
    );
    if (existing) {
      delete this.joinedControllers[existing];
      return this.drainFramePacket();
    }
    const open = activePlayerIds.find(
      (playerId) => this.joinedControllers[playerId] === undefined,
    );
    if (!open) return this.drainFramePacket();
    this.joinedControllers[open] = Object.freeze({
      kind: "human",
      controllerId: controller.controllerId,
      label: controller.label,
    });
    return this.drainFramePacket();
  }

  public beginMatch(): SessionFramePacket {
    if (this.phase !== "lobby" || !this.selectedFormat) {
      throw new Error(
        "Configure a Fluxball format before beginning the match.",
      );
    }
    return this.startRun(
      createMatchSetup(this.selectedFormat, this.joinedControllers),
    );
  }

  public startRun(setup: MatchSetup): SessionFramePacket {
    const normalized = createMatchSetup(
      setup.format,
      humanAssignmentsFromSetup(setup),
    );
    this.runId += 1;
    this.phase = "playing";
    this.selectedFormat = normalized.format;
    this.joinedControllers = { ...humanAssignmentsFromSetup(normalized) };
    this.setup = normalized;
    this.roundNumber = 1;
    this.score = createScoreBoard(normalized.activePlayerIds);
    this.completedRounds = [];
    this.controllerNotice = "";
    this.accumulatorSeconds = 0;
    this.eventCounter = 0;
    this.outgoingEvents = [];
    this.auditHistory = [];
    this.record<RunStartedEvent>({
      ...this.allocateBase(),
      type: "RUN_STARTED",
      setup: normalized,
      seed: this.seed,
    });
    this.startRound();
    return this.drainFramePacket();
  }

  public returnToMenu(): SessionFramePacket {
    this.phase = "menu";
    this.selectedFormat = null;
    this.joinedControllers = {};
    this.setup = null;
    this.roundNumber = 0;
    this.score = {};
    this.clearRunState();
    return this.drainFramePacket();
  }

  public fallbackController(controllerId: string): SessionFramePacket {
    if (this.phase !== "playing" || !this.setup) return this.drainFramePacket();
    const playerId = this.setup.activePlayerIds.find(
      (candidate) =>
        this.setup?.controllers[candidate]?.kind === "human" &&
        this.setup.controllers[candidate]?.controllerId === controllerId,
    );
    if (!playerId) return this.drainFramePacket();
    const controllers = {
      ...this.setup.controllers,
      [playerId]: COMPUTER_CONTROLLER,
    };
    this.setup = deepFreeze({ ...this.setup, controllers });
    const seed =
      (this.seed ^
        Math.imul(this.roundNumber, 0x9e3779b1) ^
        Math.imul(playerId.charCodeAt(0), 0x85ebca6b)) >>>
      0;
    this.computerControllers.set(
      playerId,
      new ComputerController(playerId, seed),
    );
    this.controllerNotice = `PLAYER ${playerId} CONTROLLER DISCONNECTED · CPU TOOK OVER`;
    this.record<ControllerFallbackEvent>({
      ...this.allocateBase(),
      type: "CONTROLLER_FALLBACK",
      playerId,
      controllerId,
    });
    return this.drainFramePacket();
  }

  public getSnapshot(): SessionSnapshot {
    return this.createSnapshot();
  }

  public updateFrame(
    wallSeconds: number,
    humanInputs: PlayerInputFrame = NEUTRAL_INPUT_FRAME,
  ): SessionFramePacket {
    if (!Number.isFinite(wallSeconds) || wallSeconds < 0) {
      throw new Error("Frame duration must be a finite, non-negative number.");
    }
    if (this.phase === "playing") {
      this.accumulatorSeconds += wallSeconds;
      while (
        this.phase === "playing" &&
        this.accumulatorSeconds + Number.EPSILON >= TUNING.fixedStepSeconds
      ) {
        this.accumulatorSeconds -= TUNING.fixedStepSeconds;
        this.stepSport(humanInputs);
      }
      if (this.phase !== "playing") this.accumulatorSeconds = 0;
    }
    return this.drainFramePacket();
  }

  public advanceTicks(
    count: number,
    humanInputs: PlayerInputFrame | SessionInputProvider = NEUTRAL_INPUT_FRAME,
  ): SessionFramePacket {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error("Tick count must be a non-negative integer.");
    }
    for (let index = 0; index < count && this.phase === "playing"; index += 1) {
      const nextTick = (this.sport?.getSnapshot().roundTick ?? 0) + 1;
      const inputFrame =
        typeof humanInputs === "function"
          ? humanInputs(this.createSnapshot(), nextTick)
          : humanInputs;
      this.stepSport(inputFrame);
    }
    return this.drainFramePacket();
  }

  public continueFromReveal(): SessionFramePacket {
    if (this.phase !== "reveal") {
      throw new Error("The next round can begin only from a round reveal.");
    }
    const setup = this.requireSetup();
    if (this.roundNumber >= TUNING.totalRounds) {
      this.phase = "finished";
      this.record<RunFinishedEvent>({
        ...this.allocateBase(),
        type: "RUN_FINISHED",
        finalScore: copyScore(setup.activePlayerIds, this.score),
      });
    } else {
      this.roundNumber += 1;
      this.phase = "playing";
      this.startRound();
    }
    return this.drainFramePacket();
  }

  public drainFramePacket(): SessionFramePacket {
    const events = this.outgoingEvents.splice(0);
    return deepFreeze({ snapshot: this.createSnapshot(), events });
  }

  private clearRunState(): void {
    this.sport = null;
    this.currentTrace = null;
    this.currentRules = null;
    this.roundScoreBefore = {};
    this.roundGoals = [];
    this.completedRounds = [];
    this.computerControllers.clear();
    this.computerDecisions = {};
    this.controllerNotice = "";
    this.accumulatorSeconds = 0;
    this.outgoingEvents = [];
    this.auditHistory = [];
    this.eventCounter = 0;
  }

  private startRound(): void {
    const setup = this.requireSetup();
    const trace = sampleRoundRules({
      catalog: this.catalog,
      competitorCount: setup.format.competitorCount,
      runSeed: this.seed,
      roundNumber: this.roundNumber,
    });
    const rules = interpretRoundRules(trace, setup.format.ruleMode);
    this.currentTrace = trace;
    this.currentRules = rules;
    this.roundScoreBefore = copyScore(setup.activePlayerIds, this.score);
    this.roundGoals = [];
    this.sport = new SportSimulation({
      roundNumber: this.roundNumber,
      activePlayerIds: setup.activePlayerIds,
      rules,
      initialScore: this.score,
    });
    this.computerControllers.clear();
    this.computerDecisions = {};
    for (const playerId of setup.activePlayerIds) {
      if (controllerForPlayer(setup, playerId).kind !== "computer") continue;
      this.computerControllers.set(
        playerId,
        new ComputerController(
          playerId,
          (this.seed ^ Math.imul(this.roundNumber, 0x9e3779b1)) >>> 0,
        ),
      );
    }
    this.accumulatorSeconds = 0;
    this.record<RoundStartedEvent>({
      ...this.allocateBase(),
      type: "ROUND_STARTED",
      trace,
      rules,
    });
  }

  private stepSport(humanInputs: PlayerInputFrame): void {
    const sport = this.requireSport();
    const resolvedInputs = this.resolveControllers(
      humanInputs,
      sport.getSnapshot(),
    );
    this.consumeSportPacket(sport.step(resolvedInputs));
  }

  private resolveControllers(
    humanInputs: PlayerInputFrame,
    snapshot: ReturnType<SportSimulation["getSnapshot"]>,
  ): PlayerInputFrame {
    const setup = this.requireSetup();
    const resolved: Partial<
      Record<PlayerId, ReturnType<typeof copyPlayerInput>>
    > = {};
    for (const playerId of setup.activePlayerIds) {
      const controller = controllerForPlayer(setup, playerId);
      if (controller.kind === "human") {
        resolved[playerId] = copyPlayerInput(
          inputForPlayer(humanInputs, playerId),
        );
        continue;
      }
      const computer = this.computerControllers.get(playerId);
      if (!computer)
        throw new Error(`Missing computer controller for Player ${playerId}.`);
      const decision = computer.decide(snapshot);
      this.computerDecisions[playerId] = decision;
      resolved[playerId] = copyPlayerInput(decision.rawInput);
    }
    return deepFreeze(resolved);
  }

  private consumeSportPacket(packet: SportFramePacket): void {
    for (const sportEvent of packet.events) {
      this.recordSportEvent(sportEvent);
      if (sportEvent.type === "PHYSICAL_GOAL") this.roundGoals.push(sportEvent);
    }
    this.score = packet.snapshot.score;
    if (packet.snapshot.ended) this.finishRound();
  }

  private recordSportEvent(sportEvent: SportEvent): void {
    this.record<SportWrappedEvent>({
      ...this.allocateBase(),
      type: "SPORT_EVENT",
      sportEvent,
    });
  }

  private finishRound(): void {
    const setup = this.requireSetup();
    const trace = this.currentTrace;
    const rules = this.currentRules;
    if (!trace || !rules) {
      throw new Error("Cannot reveal a round without its sampled rule trace.");
    }
    const completed: CompletedRound = deepFreeze({
      roundNumber: this.roundNumber,
      trace,
      rules,
      scoreBefore: copyScore(setup.activePlayerIds, this.roundScoreBefore),
      scoreAfter: copyScore(setup.activePlayerIds, this.score),
      goals: [...this.roundGoals],
    });
    this.completedRounds.push(completed);
    this.phase = "reveal";
    this.record<RoundEndedEvent>({
      ...this.allocateBase(),
      type: "ROUND_ENDED",
      round: completed,
    });
  }

  private createLobby(): LobbySnapshot | null {
    if (this.phase !== "lobby" || !this.selectedFormat) return null;
    const activePlayerIds = activePlayerIdsFor(
      this.selectedFormat.competitorCount,
    );
    return deepFreeze({
      format: this.selectedFormat,
      activePlayerIds: [...activePlayerIds],
      joinedControllers: { ...this.joinedControllers },
      canBegin: activePlayerIds.some(
        (playerId) => this.joinedControllers[playerId] !== undefined,
      ),
    });
  }

  private createSnapshot(): SessionSnapshot {
    const activePlayerIds =
      this.setup?.activePlayerIds ??
      (this.selectedFormat
        ? activePlayerIdsFor(this.selectedFormat.competitorCount)
        : []);
    return deepFreeze({
      runId: this.runId,
      seed: this.seed,
      phase: this.phase,
      selectedFormat: this.selectedFormat,
      lobby: this.createLobby(),
      setup: this.setup,
      roundNumber: this.roundNumber,
      totalRounds: TUNING.totalRounds,
      score: copyScore(activePlayerIds, this.score),
      sport: this.sport?.getSnapshot() ?? null,
      currentTrace: this.currentTrace,
      currentRules: this.currentRules,
      computerDecisions: { ...this.computerDecisions },
      completedRounds: [...this.completedRounds],
      controllerNotice: this.controllerNotice,
      auditHistory: [...this.auditHistory],
    });
  }

  private requireSetup(): MatchSetup {
    if (!this.setup) throw new Error("No Fluxball match setup is active.");
    return this.setup;
  }

  private requireSport(): SportSimulation {
    if (!this.sport) throw new Error("No Fluxball sport round is active.");
    return this.sport;
  }

  private allocateBase(): {
    readonly runId: number;
    readonly eventId: number;
    readonly roundNumber: number;
  } {
    this.eventCounter += 1;
    return {
      runId: this.runId,
      eventId: this.eventCounter,
      roundNumber: this.roundNumber,
    };
  }

  private record<T extends SessionEvent>(event: T): T {
    const frozen = deepFreeze(event);
    this.outgoingEvents.push(frozen);
    this.auditHistory.push(frozen);
    if (this.auditHistory.length > TUNING.maxAuditEvents)
      this.auditHistory.shift();
    return frozen;
  }
}
