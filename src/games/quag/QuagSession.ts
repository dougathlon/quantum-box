import { deriveSeed } from "../../core/determinism";
import type { RunContext } from "../../core/run";
import type { QGraphCabinetPack } from "../qgraph/QGraphPack";
import { sampleWholeRegisterFrame } from "../qgraph/QGraphPack";
import {
  QUAG_ARENAS,
  QUAG_BODY_HALF_HEIGHT,
  QUAG_BODY_HALF_WIDTH,
  QUAG_CAPTURE_HEIGHT_ADVANTAGE,
  quagBodiesOverlap,
  quagArenaById,
  quagHorizontalSpan,
  quagLandingTop,
  shortestWrappedDeltaX,
  wrapQuagX,
} from "./QuagArena";
import { chooseQuagCpuInput } from "./QuagCpuPolicy";
import {
  QUAG_PLAYER_IDS,
  QUAG_READY_TICKS,
  QUAG_ROUND_BREAK_TICKS,
  QUAG_ROUND_SECONDS,
  QUAG_RULES_VERSION,
  QUAG_SUBPIXELS,
  QUAG_TICKS_PER_SECOND,
  QUAG_TOTAL_ROUNDS,
  type QuagArena,
  type QuagArenaId,
  type QuagEvent,
  type QuagFacing,
  type QuagInput,
  type QuagPlayerId,
  type QuagPlayerSnapshot,
  type QuagPhase,
  type QuagSpawnPerch,
  type QuagSnapshot,
} from "./types";

export const QUAG_DIRECTED_EDGE_ORDER = [
  "A>B",
  "A>C",
  "A>D",
  "B>A",
  "B>C",
  "B>D",
  "C>A",
  "C>B",
  "C>D",
  "D>A",
  "D>B",
  "D>C",
] as const;

export const QUAG_HORIZONTAL_ACCELERATION = 12;
export const QUAG_HORIZONTAL_REVERSAL_ACCELERATION = 20;
export const QUAG_HORIZONTAL_DRAG = 8;
export const QUAG_MAXIMUM_HORIZONTAL_SPEED = 96;
export const QUAG_GRAVITY = 10;
export const QUAG_FLAP_IMPULSE = 96;
export const QUAG_MAXIMUM_RISE_SPEED = -128;
export const QUAG_MAXIMUM_FALL_SPEED = 112;
export const QUAG_CEILING_REBOUND_SPEED = 48;
export const QUAG_FLAP_COOLDOWN_TICKS = 4;
export const QUAG_CONTACT_BOUNCE_SPEED = 32;
export const QUAG_CONTACT_BOUNCE_COOLDOWN_TICKS = 3;
export const QUAG_CAPTURE_SEPARATION_SPEED = 80;
export const QUAG_PAIR_CONTACT_COOLDOWN_TICKS = 52;
export const QUAG_KNOCKOUT_TICKS = 12;
export const QUAG_RESPAWN_GRACE_TICKS = 18;
export const QUAG_RESPAWN_CLEARANCE = 64;
export const QUAG_RESPAWN_DEATH_DISTANCE = 72;
export const QUAG_REMEASUREMENT_INTERVAL_TICKS = 12 * QUAG_TICKS_PER_SECOND;

interface MutablePlayer {
  id: QuagPlayerId;
  previousXSubpixels: number;
  previousYSubpixels: number;
  xSubpixels: number;
  ySubpixels: number;
  velocityXSubpixels: number;
  velocityYSubpixels: number;
  facing: QuagFacing;
  grounded: boolean;
  flapCooldownTicks: number;
  movementSequence: number;
  score: number;
  roundScore: number;
  roundWins: number;
  knockedOutTicks: number;
  graceTicks: number;
  respawns: number;
}

export interface QuagScenario {
  readonly roundTicks?: number;
  readonly totalRounds?: number;
  readonly readyTicks?: number;
  readonly roundBreakTicks?: number;
  readonly initialBitstring?: string;
  readonly cpuEnabled?: boolean;
  readonly humanPlayerIds?: readonly QuagPlayerId[];
  readonly arenaId?: QuagArenaId;
  readonly players?: readonly Readonly<{
    id: QuagPlayerId;
    x: number;
    y: number;
    velocityXSubpixels?: number;
    velocityYSubpixels?: number;
    facing?: QuagFacing;
    grounded?: boolean;
    graceTicks?: number;
    knockedOutTicks?: number;
    score?: number;
    roundScore?: number;
    roundWins?: number;
  }>[];
}

export class QuagSession {
  private readonly players: MutablePlayer[];
  private readonly graphFrames: readonly ReadonlyMap<
    QuagPlayerId,
    ReadonlySet<QuagPlayerId>
  >[];
  private readonly roundTicks: number;
  private readonly totalRounds: number;
  private readonly roundBreakTicks: number;
  private readonly cpuEnabled: boolean;
  private readonly relationshipSource: "MODEL" | "QPU";
  private readonly arena: QuagArena;
  private readonly humanPlayerIds: ReadonlySet<QuagPlayerId>;
  private readonly pairCooldowns = new Map<string, number>();
  private phase: QuagPhase;
  private tick = 0;
  private activeTick = 0;
  private roundNumber = 1;
  private roundTick = 0;
  private readyTicksRemaining: number;
  private roundBreakTicksRemaining = 0;
  private graphFrameIndex = 0;
  private graphActivatedTick = 0;
  private lastGraphShiftTick: number | null = null;
  private graphEpoch = 1;
  private latestEvent: QuagEvent | null = null;
  private eventsThisTick: QuagEvent[] = [];
  private roundWinnerIds: readonly QuagPlayerId[] = [];
  private eventId = 0;
  private firstMeaningfulInteractionTick: number | null = null;
  private captures = 0;
  private repeatDeaths = 0;
  private respawnDelays = 0;
  private cpuInactiveTicks = 0;
  private flaps = 0;
  private landings = 0;
  private wraps = 0;
  private airborneTicks = 0;

  public constructor(
    private readonly context: RunContext,
    pack: QGraphCabinetPack,
    scenario: QuagScenario = {},
  ) {
    if (
      (context.gameId !== "quag" && context.gameId !== "quarry") ||
      (context.playMode !== "arcade" && context.playMode !== "story") ||
      (context.gameId === "quag" && context.playMode !== "arcade") ||
      context.rulesVersion !== QUAG_RULES_VERSION
    ) {
      throw new Error(
        "Quarry accepts current Story/Arcade contexts; its legacy id is an Arcade-only alias.",
      );
    }
    if (
      pack.qubitCount !== 12 ||
      pack.graphSchemaVersion !== "graph-v1-measurement-distribution" ||
      pack.bitOrdering !== QUAG_DIRECTED_EDGE_ORDER.join(",")
    ) {
      throw new Error(
        "Quarry requires a twelve-bit directed-edge QGraph pack in canonical A/B/C/D order.",
      );
    }
    this.relationshipSource =
      pack.sourceClassification === "moth-qgraph-qpu" ? "QPU" : "MODEL";
    this.arena = scenario.arenaId
      ? quagArenaById(scenario.arenaId)
      : QUAG_ARENAS[
          deriveSeed(context.runSeed, "quarry-arena-layout") %
            QUAG_ARENAS.length
        ]!;
    const humanPlayerIds = scenario.humanPlayerIds ?? ["A"];
    if (
      humanPlayerIds.length < 1 ||
      new Set(humanPlayerIds).size !== humanPlayerIds.length ||
      humanPlayerIds.some((id) => !QUAG_PLAYER_IDS.includes(id))
    ) {
      throw new Error("Quarry requires one to four unique human player ids.");
    }
    this.humanPlayerIds = new Set(humanPlayerIds);
    this.graphFrames = pack.frames.map((_, index) =>
      decodeQuagTargets(
        index === 0 && scenario.initialBitstring
          ? scenario.initialBitstring
          : sampleWholeRegisterFrame(pack, index, context.runSeed).bitstring,
      ),
    );
    this.roundTicks =
      scenario.roundTicks ?? QUAG_ROUND_SECONDS * QUAG_TICKS_PER_SECOND;
    this.totalRounds = scenario.totalRounds ?? QUAG_TOTAL_ROUNDS;
    this.roundBreakTicks = scenario.roundBreakTicks ?? QUAG_ROUND_BREAK_TICKS;
    if (
      !Number.isSafeInteger(this.roundTicks) ||
      this.roundTicks < 1 ||
      !Number.isSafeInteger(this.totalRounds) ||
      this.totalRounds < 1 ||
      !Number.isSafeInteger(this.roundBreakTicks) ||
      this.roundBreakTicks < 0
    ) {
      throw new Error("Quarry requires positive round and match timing.");
    }
    this.readyTicksRemaining = scenario.readyTicks ?? QUAG_READY_TICKS;
    this.phase = this.readyTicksRemaining > 0 ? "ready" : "active";
    this.cpuEnabled = scenario.cpuEnabled ?? true;
    const scenarioPlayers = new Map(
      scenario.players?.map((player) => [player.id, player]),
    );
    this.players = QUAG_PLAYER_IDS.map((id, index) => {
      const perch = this.arena.spawnPerches[index]!;
      const start = scenarioPlayers.get(id);
      const x = start?.x ?? perch.x;
      const y = start?.y ?? perch.platformTop - QUAG_BODY_HALF_HEIGHT;
      requireFiniteArenaPosition(id, x, y, this.arena);
      return {
        id,
        previousXSubpixels: toSubpixels(x),
        previousYSubpixels: toSubpixels(y),
        xSubpixels: toSubpixels(x),
        ySubpixels: toSubpixels(y),
        velocityXSubpixels: start?.velocityXSubpixels ?? 0,
        velocityYSubpixels: start?.velocityYSubpixels ?? 0,
        facing: start?.facing ?? perch.facing,
        grounded: start?.grounded ?? true,
        flapCooldownTicks: 0,
        movementSequence: 0,
        score: start?.score ?? 0,
        roundScore: start?.roundScore ?? 0,
        roundWins: start?.roundWins ?? 0,
        knockedOutTicks: start?.knockedOutTicks ?? 0,
        graceTicks: start?.graceTicks ?? 0,
        respawns: 0,
      };
    });
    for (let left = 0; left < QUAG_PLAYER_IDS.length; left += 1) {
      for (let right = left + 1; right < QUAG_PLAYER_IDS.length; right += 1) {
        this.pairCooldowns.set(
          pairKey(QUAG_PLAYER_IDS[left]!, QUAG_PLAYER_IDS[right]!),
          0,
        );
      }
    }
  }

  public step(input: QuagInput): QuagSnapshot {
    if (this.phase === "complete") return this.snapshot();
    this.eventsThisTick = [];
    this.tick += 1;
    if (this.phase === "ready") {
      this.readyTicksRemaining -= 1;
      if (this.readyTicksRemaining === 0) this.phase = "active";
      return this.snapshot();
    }
    if (this.phase === "round-break") {
      this.roundBreakTicksRemaining -= 1;
      if (this.roundBreakTicksRemaining === 0) this.startNextRound();
      return this.snapshot();
    }
    this.updateTransientState();
    this.simulatePlayers(normalizeInput(input));
    this.resolveContacts();
    this.activeTick += 1;
    this.roundTick += 1;
    if (this.roundTick >= this.roundTicks) this.completeRound();
    else this.maybeShiftGraph();
    return this.snapshot();
  }

  public snapshot(): QuagSnapshot {
    const players = this.playerSnapshots();
    return deepFreeze({
      phase: this.phase,
      tick: this.tick,
      activeTick: this.activeTick,
      roundNumber: this.roundNumber,
      totalRounds: this.totalRounds,
      roundTick: this.roundTick,
      readyTicksRemaining: this.readyTicksRemaining,
      roundBreakTicksRemaining: this.roundBreakTicksRemaining,
      secondsRemaining: Math.max(
        0,
        (this.roundTicks - this.roundTick) / QUAG_TICKS_PER_SECOND,
      ),
      graphPhase: this.graphEpoch,
      ticksUntilRemeasurement: Math.max(
        0,
        QUAG_REMEASUREMENT_INTERVAL_TICKS -
          (this.activeTick - this.graphActivatedTick),
      ),
      lastGraphShiftTick: this.lastGraphShiftTick,
      arenaId: this.arena.id,
      relationshipSource: this.relationshipSource,
      humanPlayerIds: [...this.humanPlayerIds],
      humanTargets: targetsForHumans(
        this.graphFrames[this.graphFrameIndex],
        this.humanPlayerIds,
      ),
      directedRelations: directedRelations(
        this.graphFrames[this.graphFrameIndex],
      ),
      players,
      latestEvent: this.latestEvent,
      eventsThisTick: [...this.eventsThisTick],
      roundWinnerIds: [...this.roundWinnerIds],
      winnerIds: this.phase === "complete" ? matchWinnerIds(players) : [],
      metrics: {
        firstMeaningfulInteractionTick: this.firstMeaningfulInteractionTick,
        captures: this.captures,
        relationshipPhaseCount: this.graphEpoch,
        repeatDeaths: this.repeatDeaths,
        respawnDelays: this.respawnDelays,
        cpuInactiveTicks: this.cpuInactiveTicks,
        flaps: this.flaps,
        landings: this.landings,
        wraps: this.wraps,
        airborneTicks: this.airborneTicks,
      },
    });
  }

  private completeRound(): void {
    const leaders = roundLeaderIds(this.players);
    this.roundWinnerIds = Object.freeze([...leaders]);
    if (leaders.length === 1) this.player(leaders[0]!).roundWins += 1;
    const outcome =
      leaders.length === 1
        ? `${leaders[0]} WINS`
        : `DRAW · ${leaders.join("/")}`;
    this.emit(
      "ROUND_COMPLETE",
      `ROUND ${this.roundNumber}/${this.totalRounds} · ${outcome}`,
      [],
      leaders,
    );
    if (this.roundNumber >= this.totalRounds) {
      this.phase = "complete";
      return;
    }
    this.phase = "round-break";
    this.roundBreakTicksRemaining = this.roundBreakTicks;
    if (this.roundBreakTicksRemaining === 0) this.startNextRound();
  }

  private startNextRound(): void {
    this.roundNumber += 1;
    this.roundTick = 0;
    this.roundBreakTicksRemaining = 0;
    this.roundWinnerIds = [];
    this.phase = "active";
    this.resetPlayersForRound();
    this.advanceGraph();
    this.lastGraphShiftTick = this.activeTick;
    this.emit(
      "GRAPH_SHIFT",
      `ROUND ${this.roundNumber} · STATE ${this.graphEpoch}`,
      [],
      [],
    );
  }

  private resetPlayersForRound(): void {
    this.players.forEach((player, index) => {
      const perch = this.arena.spawnPerches[index]!;
      const xSubpixels = toSubpixels(perch.x);
      const ySubpixels = toSubpixels(perch.platformTop - QUAG_BODY_HALF_HEIGHT);
      player.previousXSubpixels = xSubpixels;
      player.previousYSubpixels = ySubpixels;
      player.xSubpixels = xSubpixels;
      player.ySubpixels = ySubpixels;
      player.velocityXSubpixels = 0;
      player.velocityYSubpixels = 0;
      player.facing = perch.facing;
      player.grounded = true;
      player.flapCooldownTicks = 0;
      player.movementSequence = 0;
      player.roundScore = 0;
      player.knockedOutTicks = 0;
      player.graceTicks = 0;
    });
    for (const key of this.pairCooldowns.keys()) this.pairCooldowns.set(key, 0);
  }

  private simulatePlayers(humanInput: QuagInput): void {
    const observations = this.playerSnapshots();
    for (const player of this.players) {
      player.previousXSubpixels = player.xSubpixels;
      player.previousYSubpixels = player.ySubpixels;
      if (player.knockedOutTicks > 0) continue;
      const control = this.humanPlayerIds.has(player.id)
        ? inputForPlayer(humanInput, player.id)
        : this.cpuEnabled
          ? chooseQuagCpuInput({
              playerId: player.id,
              tick: this.activeTick,
              graphPhase: this.graphEpoch,
              players: observations,
              outgoingTargets: [
                ...(this.graphFrames[this.graphFrameIndex]?.get(player.id) ??
                  []),
              ],
              policySeed: deriveSeed(
                this.context.runSeed,
                `quarry-cpu-${player.id}`,
              ),
              arena: this.arena,
            })
          : NEUTRAL_INPUT;
      this.integratePlayer(player, control);
      if (!player.grounded) this.airborneTicks += 1;
      if (
        !this.humanPlayerIds.has(player.id) &&
        player.xSubpixels === player.previousXSubpixels &&
        player.ySubpixels === player.previousYSubpixels
      ) {
        this.cpuInactiveTicks += 1;
      }
    }
  }

  private integratePlayer(player: MutablePlayer, input: QuagInput): void {
    const desired = input.horizontal * QUAG_MAXIMUM_HORIZONTAL_SPEED;
    const reversing =
      input.horizontal !== 0 &&
      player.velocityXSubpixels !== 0 &&
      Math.sign(player.velocityXSubpixels) !== input.horizontal;
    const horizontalStep =
      input.horizontal === 0
        ? QUAG_HORIZONTAL_DRAG
        : reversing
          ? QUAG_HORIZONTAL_REVERSAL_ACCELERATION
          : QUAG_HORIZONTAL_ACCELERATION;
    player.velocityXSubpixels = approach(
      player.velocityXSubpixels,
      desired,
      horizontalStep,
    );
    if (input.horizontal !== 0) player.facing = input.horizontal;
    if (input.flapPressed && player.flapCooldownTicks === 0) {
      player.velocityYSubpixels = Math.max(
        QUAG_MAXIMUM_RISE_SPEED,
        player.velocityYSubpixels - QUAG_FLAP_IMPULSE,
      );
      player.flapCooldownTicks = QUAG_FLAP_COOLDOWN_TICKS;
      player.grounded = false;
      this.flaps += 1;
    }
    player.velocityYSubpixels = Math.min(
      QUAG_MAXIMUM_FALL_SPEED,
      player.velocityYSubpixels + QUAG_GRAVITY,
    );

    let nextXSubpixels = player.xSubpixels + player.velocityXSubpixels;
    const wrapped = wrapQuagX(nextXSubpixels / QUAG_SUBPIXELS, this.arena);
    if (wrapped.wrapped) {
      nextXSubpixels = toSubpixels(wrapped.x);
      this.wraps += 1;
    }
    let nextYSubpixels = player.ySubpixels + player.velocityYSubpixels;
    const ceiling = toSubpixels(this.arena.ceiling + QUAG_BODY_HALF_HEIGHT);
    if (nextYSubpixels < ceiling) {
      nextYSubpixels = ceiling;
      // A rising duck rebounds instead of sticking to the ceiling. This keeps
      // the Joust height contest alive: repeated flaps cannot collapse every
      // pursuer onto the same uncapturable y coordinate.
      player.velocityYSubpixels = QUAG_CEILING_REBOUND_SPEED;
    }

    const landingTop = quagLandingTop(
      player.ySubpixels / QUAG_SUBPIXELS,
      nextYSubpixels / QUAG_SUBPIXELS,
      nextXSubpixels / QUAG_SUBPIXELS,
      this.arena,
    );
    if (player.velocityYSubpixels >= 0 && landingTop !== null) {
      nextYSubpixels = toSubpixels(landingTop - QUAG_BODY_HALF_HEIGHT);
      player.velocityYSubpixels = 0;
      if (!player.grounded) this.landings += 1;
      player.grounded = true;
    } else {
      player.grounded = false;
    }
    player.xSubpixels = nextXSubpixels;
    player.ySubpixels = nextYSubpixels;
    if (
      player.xSubpixels !== player.previousXSubpixels ||
      player.ySubpixels !== player.previousYSubpixels
    ) {
      player.movementSequence += 1;
    }
  }

  private resolveContacts(): void {
    const frame = this.graphFrames[this.graphFrameIndex];
    const validEdges: string[] = [];
    const victims = new Set<QuagPlayerId>();
    const invalidPairs: [MutablePlayer, MutablePlayer][] = [];
    for (let leftIndex = 0; leftIndex < this.players.length; leftIndex += 1) {
      const left = this.players[leftIndex]!;
      if (left.knockedOutTicks > 0 || left.graceTicks > 0) continue;
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < this.players.length;
        rightIndex += 1
      ) {
        const right = this.players[rightIndex]!;
        const key = pairKey(left.id, right.id);
        if (
          right.knockedOutTicks > 0 ||
          right.graceTicks > 0 ||
          (this.pairCooldowns.get(key) ?? 0) > 0 ||
          !quagBodiesOverlap(
            left.xSubpixels / QUAG_SUBPIXELS,
            left.ySubpixels / QUAG_SUBPIXELS,
            right.xSubpixels / QUAG_SUBPIXELS,
            right.ySubpixels / QUAG_SUBPIXELS,
            this.arena,
          )
        ) {
          continue;
        }
        const verticalDelta =
          (left.ySubpixels - right.ySubpixels) / QUAG_SUBPIXELS;
        if (Math.abs(verticalDelta) < QUAG_CAPTURE_HEIGHT_ADVANTAGE) {
          this.pairCooldowns.set(key, QUAG_CONTACT_BOUNCE_COOLDOWN_TICKS);
          invalidPairs.push([left, right]);
          continue;
        }
        const hunter = verticalDelta < 0 ? left : right;
        const target = verticalDelta < 0 ? right : left;
        if (!frame?.get(hunter.id)?.has(target.id)) {
          this.pairCooldowns.set(key, QUAG_CONTACT_BOUNCE_COOLDOWN_TICKS);
          invalidPairs.push([left, right]);
          continue;
        }
        this.pairCooldowns.set(key, QUAG_PAIR_CONTACT_COOLDOWN_TICKS);
        validEdges.push(`${hunter.id}>${target.id}`);
        victims.add(target.id);
      }
    }
    for (const [left, right] of invalidPairs) this.bouncePair(left, right);
    if (validEdges.length === 0) return;
    this.firstMeaningfulInteractionTick ??= this.activeTick;
    this.captures += validEdges.length;
    for (const edge of validEdges) {
      const hunterId = edge[0] as QuagPlayerId;
      const targetId = edge.at(-1) as QuagPlayerId;
      const hunter = this.player(hunterId);
      const target = this.player(targetId);
      hunter.score += 1;
      hunter.roundScore += 1;
      this.knockOutTarget(hunter, target);
    }
    this.emit(
      "CAPTURE",
      `${captureHeadline(validEdges, this.humanPlayerIds)} · STATE ${this.graphEpoch}`,
      validEdges,
      [...victims],
    );
  }

  private bouncePair(left: MutablePlayer, right: MutablePlayer): void {
    const leftX = left.xSubpixels / QUAG_SUBPIXELS;
    const rightX = right.xSubpixels / QUAG_SUBPIXELS;
    let direction = Math.sign(shortestWrappedDeltaX(leftX, rightX, this.arena));
    if (direction === 0) direction = left.id < right.id ? 1 : -1;
    left.velocityXSubpixels = -direction * QUAG_CONTACT_BOUNCE_SPEED;
    right.velocityXSubpixels = direction * QUAG_CONTACT_BOUNCE_SPEED;
    const verticalDelta = left.ySubpixels - right.ySubpixels;
    if (Math.abs(verticalDelta) >= toSubpixels(4)) {
      const upper = verticalDelta < 0 ? left : right;
      const lower = verticalDelta < 0 ? right : left;
      upper.velocityYSubpixels = Math.min(
        upper.velocityYSubpixels,
        -QUAG_CONTACT_BOUNCE_SPEED,
      );
      lower.velocityYSubpixels = Math.max(
        lower.velocityYSubpixels,
        QUAG_CONTACT_BOUNCE_SPEED,
      );
    }
  }

  private knockOutTarget(hunter: MutablePlayer, target: MutablePlayer): void {
    let direction = Math.sign(
      shortestWrappedDeltaX(
        hunter.xSubpixels / QUAG_SUBPIXELS,
        target.xSubpixels / QUAG_SUBPIXELS,
        this.arena,
      ),
    );
    if (direction === 0) direction = hunter.id < target.id ? 1 : -1;
    hunter.velocityXSubpixels = -direction * QUAG_CAPTURE_SEPARATION_SPEED;
    hunter.velocityYSubpixels = -QUAG_CAPTURE_SEPARATION_SPEED;
    hunter.grounded = false;
    target.velocityXSubpixels = 0;
    target.velocityYSubpixels = 0;
    target.grounded = false;
    target.knockedOutTicks = QUAG_KNOCKOUT_TICKS;
    target.graceTicks = 0;
  }

  private updateTransientState(): void {
    this.players.forEach((player, index) => {
      if (player.knockedOutTicks > 0) {
        player.knockedOutTicks -= 1;
        if (player.knockedOutTicks === 0) this.respawnPlayer(player, index);
      } else if (player.graceTicks > 0) {
        player.graceTicks -= 1;
      }
      if (player.flapCooldownTicks > 0) player.flapCooldownTicks -= 1;
    });
    for (const [key, ticks] of this.pairCooldowns) {
      if (ticks > 0) this.pairCooldowns.set(key, ticks - 1);
    }
  }

  private respawnPlayer(player: MutablePlayer, index: number): void {
    const perch = this.selectRespawnPerch(player, index);
    const xSubpixels = toSubpixels(perch.x);
    const ySubpixels = toSubpixels(perch.platformTop - QUAG_BODY_HALF_HEIGHT);
    player.previousXSubpixels = xSubpixels;
    player.previousYSubpixels = ySubpixels;
    player.xSubpixels = xSubpixels;
    player.ySubpixels = ySubpixels;
    player.velocityXSubpixels = 0;
    player.velocityYSubpixels = 0;
    player.facing = perch.facing;
    player.grounded = true;
    player.flapCooldownTicks = 0;
    player.graceTicks = QUAG_RESPAWN_GRACE_TICKS;
    player.respawns += 1;
  }

  private selectRespawnPerch(
    player: MutablePlayer,
    initialPerchIndex: number,
  ): QuagSpawnPerch {
    const candidates = this.arena.spawnPerches.filter(
      (_, index) => index !== initialPerchIndex,
    );
    if (candidates.length === 0) {
      throw new Error("Quarry requires a second respawn point in each arena.");
    }
    const death = {
      x: player.xSubpixels / QUAG_SUBPIXELS,
      y: player.ySubpixels / QUAG_SUBPIXELS,
    };
    const offset =
      deriveSeed(
        this.context.runSeed,
        `quarry-respawn-${this.roundNumber}-${player.id}-${player.respawns + 1}`,
      ) % candidates.length;
    const ordered = candidates.map(
      (_, index) => candidates[(index + offset) % candidates.length]!,
    );
    const safe = ordered.find((perch) => {
      const point = respawnPoint(perch);
      if (
        wrappedDistance(point, death, this.arena) < QUAG_RESPAWN_DEATH_DISTANCE
      ) {
        return false;
      }
      return this.players.every((other) => {
        if (other.id === player.id || other.knockedOutTicks > 0) return true;
        return (
          wrappedDistance(
            point,
            {
              x: other.xSubpixels / QUAG_SUBPIXELS,
              y: other.ySubpixels / QUAG_SUBPIXELS,
            },
            this.arena,
          ) >= QUAG_RESPAWN_CLEARANCE
        );
      });
    });
    if (safe) return safe;
    return ordered.reduce((best, candidate) =>
      respawnClearance(candidate, player, death, this.players, this.arena) >
      respawnClearance(best, player, death, this.players, this.arena)
        ? candidate
        : best,
    );
  }

  private maybeShiftGraph(): void {
    const dwell = this.activeTick - this.graphActivatedTick;
    if (dwell < QUAG_REMEASUREMENT_INTERVAL_TICKS) return;
    this.advanceGraph();
    this.lastGraphShiftTick = this.activeTick;
    const targets = targetsForHumans(
      this.graphFrames[this.graphFrameIndex],
      this.humanPlayerIds,
    );
    this.emit(
      "GRAPH_SHIFT",
      `REMEASURED · STATE ${this.graphEpoch} · ${this.humanPlayerIds.size === 1 ? humanHuntHeadline(targets) : "RELATIONS UPDATED"}`,
      [],
      [],
    );
  }

  private advanceGraph(): void {
    this.graphFrameIndex = (this.graphFrameIndex + 1) % this.graphFrames.length;
    this.graphActivatedTick = this.activeTick;
    this.graphEpoch += 1;
  }

  private playerSnapshots(): QuagPlayerSnapshot[] {
    return this.players.map((player) => ({
      id: player.id,
      previousXSubpixels: player.previousXSubpixels,
      previousYSubpixels: player.previousYSubpixels,
      xSubpixels: player.xSubpixels,
      ySubpixels: player.ySubpixels,
      velocityXSubpixels: player.velocityXSubpixels,
      velocityYSubpixels: player.velocityYSubpixels,
      facing: player.facing,
      grounded: player.grounded,
      flapCooldownTicks: player.flapCooldownTicks,
      movementSequence: player.movementSequence,
      score: player.score,
      roundScore: player.roundScore,
      roundWins: player.roundWins,
      knockedOutTicks: player.knockedOutTicks,
      graceTicks: player.graceTicks,
      respawns: player.respawns,
    }));
  }

  private player(id: QuagPlayerId): MutablePlayer {
    return this.players.find((candidate) => candidate.id === id)!;
  }

  private emit(
    type: QuagEvent["type"],
    detail: string,
    captureEdges: readonly string[],
    playerIds: readonly QuagPlayerId[],
  ): void {
    this.eventId += 1;
    const event = Object.freeze({
      eventId: this.eventId,
      tick: this.activeTick,
      type,
      detail,
      captureEdges: Object.freeze([...captureEdges]),
      playerIds: Object.freeze([...playerIds]),
    });
    this.latestEvent = event;
    this.eventsThisTick.push(event);
  }
}

function respawnPoint(perch: QuagSpawnPerch): Readonly<{
  x: number;
  y: number;
}> {
  return {
    x: perch.x,
    y: perch.platformTop - QUAG_BODY_HALF_HEIGHT,
  };
}

function wrappedDistance(
  left: Readonly<{ x: number; y: number }>,
  right: Readonly<{ x: number; y: number }>,
  arena: QuagArena,
): number {
  return Math.hypot(
    shortestWrappedDeltaX(left.x, right.x, arena),
    left.y - right.y,
  );
}

function respawnClearance(
  perch: QuagSpawnPerch,
  player: MutablePlayer,
  death: Readonly<{ x: number; y: number }>,
  players: readonly MutablePlayer[],
  arena: QuagArena,
): number {
  const point = respawnPoint(perch);
  const distances = [wrappedDistance(point, death, arena)];
  for (const other of players) {
    if (other.id === player.id || other.knockedOutTicks > 0) continue;
    distances.push(
      wrappedDistance(
        point,
        {
          x: other.xSubpixels / QUAG_SUBPIXELS,
          y: other.ySubpixels / QUAG_SUBPIXELS,
        },
        arena,
      ),
    );
  }
  return Math.min(...distances);
}

function captureHeadline(
  edges: readonly string[],
  humanPlayerIds: ReadonlySet<QuagPlayerId>,
): string {
  if (humanPlayerIds.size !== 1) {
    return edges
      .map((edge) => {
        const [hunter, target] = edge.split(">");
        return `${hunter} CAUGHT ${target}`;
      })
      .join(" · ");
  }
  const [humanPlayerId] = humanPlayerIds;
  const targets = edges
    .filter((edge) => edge.startsWith(`${humanPlayerId}>`))
    .map((edge) => edge.at(-1))
    .join("+");
  const hunters = edges
    .filter((edge) => edge.endsWith(`>${humanPlayerId}`))
    .map((edge) => edge[0])
    .join("+");
  if (targets && hunters)
    return `YOU CAUGHT ${targets} · ${hunters} CAUGHT YOU`;
  if (targets) return `YOU CAUGHT ${targets}`;
  if (hunters) return `${hunters} CAUGHT YOU`;
  return edges
    .map((edge) => {
      const [hunter, target] = edge.split(">");
      return `${hunter} CAUGHT ${target}`;
    })
    .join(" · ");
}

function humanHuntHeadline(targets: readonly QuagPlayerId[]): string {
  return targets.length > 0 ? `HUNT ${targets.join("+")}` : "SURVIVE";
}

function roundLeaderIds(
  players: readonly Pick<MutablePlayer, "id" | "roundScore">[],
): QuagPlayerId[] {
  const highScore = Math.max(...players.map((player) => player.roundScore));
  return players
    .filter((player) => player.roundScore === highScore)
    .map((player) => player.id);
}

function matchWinnerIds(
  players: readonly Pick<QuagPlayerSnapshot, "id" | "score" | "roundWins">[],
): QuagPlayerId[] {
  const mostRounds = Math.max(...players.map((player) => player.roundWins));
  const roundLeaders = players.filter(
    (player) => player.roundWins === mostRounds,
  );
  const mostPoints = Math.max(...roundLeaders.map((player) => player.score));
  return roundLeaders
    .filter((player) => player.score === mostPoints)
    .map((player) => player.id);
}

export function decodeQuagTargets(
  bitstring: string,
): ReadonlyMap<QuagPlayerId, ReadonlySet<QuagPlayerId>> {
  if (!/^[01]{12}$/.test(bitstring))
    throw new Error("Quarry relationship state must be exactly twelve bits.");
  const result = new Map<QuagPlayerId, Set<QuagPlayerId>>(
    QUAG_PLAYER_IDS.map((id) => [id, new Set()]),
  );
  QUAG_DIRECTED_EDGE_ORDER.forEach((edge, index) => {
    if (bitstring[index] !== "1") return;
    const [source, target] = edge.split(">") as [QuagPlayerId, QuagPlayerId];
    result.get(source)!.add(target);
  });
  return result;
}

function targetsForHumans(
  frame: ReadonlyMap<QuagPlayerId, ReadonlySet<QuagPlayerId>> | undefined,
  humanPlayerIds: ReadonlySet<QuagPlayerId>,
): QuagPlayerId[] {
  if (!frame) return [];
  const targets = new Set<QuagPlayerId>();
  for (const playerId of humanPlayerIds) {
    for (const target of frame.get(playerId) ?? []) targets.add(target);
  }
  return QUAG_PLAYER_IDS.filter((playerId) => targets.has(playerId));
}

function normalizeInput(input: QuagInput): QuagInput {
  const players = Object.fromEntries(
    Object.entries(input.players ?? {}).map(([id, control]) => [
      id,
      Object.freeze({
        horizontal: Math.sign(control.horizontal) as -1 | 0 | 1,
        flapPressed: Boolean(control.flapPressed),
      }),
    ]),
  );
  return Object.freeze({
    horizontal: Math.sign(input.horizontal) as -1 | 0 | 1,
    flapPressed: Boolean(input.flapPressed),
    players: Object.freeze(players),
  });
}

function requireFiniteArenaPosition(
  id: QuagPlayerId,
  x: number,
  y: number,
  arena: QuagArena,
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new Error(`Quarry ${id} requires a finite arena position.`);
  if (
    x < arena.left - QUAG_BODY_HALF_WIDTH ||
    x > arena.right + QUAG_BODY_HALF_WIDTH ||
    y < arena.ceiling + QUAG_BODY_HALF_HEIGHT ||
    y > arena.floorTop - QUAG_BODY_HALF_HEIGHT
  ) {
    throw new Error(`Quarry ${id} starts outside the aerial arena.`);
  }
}

function inputForPlayer(input: QuagInput, playerId: QuagPlayerId): QuagInput {
  const control = input.players?.[playerId];
  if (control) return Object.freeze({ ...control });
  return playerId === "A"
    ? Object.freeze({
        horizontal: input.horizontal,
        flapPressed: input.flapPressed,
      })
    : NEUTRAL_INPUT;
}

function directedRelations(
  frame: ReadonlyMap<QuagPlayerId, ReadonlySet<QuagPlayerId>> | undefined,
): `${QuagPlayerId}>${QuagPlayerId}`[] {
  if (!frame) return [];
  return QUAG_DIRECTED_EDGE_ORDER.filter((edge) => {
    const [source, target] = edge.split(">") as [QuagPlayerId, QuagPlayerId];
    return frame.get(source)?.has(target) ?? false;
  });
}

function approach(current: number, target: number, step: number): number {
  if (current < target) return Math.min(target, current + step);
  if (current > target) return Math.max(target, current - step);
  return current;
}

function toSubpixels(value: number): number {
  return Math.round(value * QUAG_SUBPIXELS);
}

function pairKey(left: QuagPlayerId, right: QuagPlayerId): string {
  return left < right ? `${left}${right}` : `${right}${left}`;
}

const NEUTRAL_INPUT: QuagInput = Object.freeze({
  horizontal: 0,
  flapPressed: false,
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
