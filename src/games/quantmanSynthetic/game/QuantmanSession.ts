import { TUNING } from "../config";
import { SeededRng } from "../core/Rng";
import {
  crossingSafetyConstraints,
  mergeConstraints,
  type ActiveCrossing,
} from "../labyrinth/CrossingSafetyPolicy";
import {
  focusedEdgeIndex,
  observedConstraints,
  observedEdgeIndices,
} from "../labyrinth/ObservationModel";
import { RoomGraph } from "../labyrinth/RoomGraph";
import {
  EmptyCompatibleSubsetError,
  TopologyBank,
} from "../labyrinth/TopologyBank";
import {
  DIRECTION_VECTORS,
  type CompiledTopology,
  type DirectionName,
  type EdgeConstraint,
  type LabyrinthFixture,
  type QuantmanQpuFixtureAuthority,
} from "../labyrinth/types";
import {
  collectibleLayoutFromKinds,
  productionCollectibles,
} from "./collectibles";
import { decideGhostStep, directionBetween } from "./GhostPolicy";
import {
  GHOST_HOME_EXIT_ROOM,
  GHOST_HOME_ROOMS,
  isGhostHomeRoom,
  tunnelDestination,
  TUNNEL_ROW,
} from "./MazeTraversal";
import type {
  ActorSnapshot,
  Collectible,
  CompletionRecord,
  GazeStatus,
  GhostMode,
  GhostRole,
  GhostSnapshot,
  MazeMechanic,
  SemanticInput,
  SessionOptions,
  SessionPhase,
  SessionSnapshot,
  TopologyTransition,
} from "./types";

interface RuntimeActor {
  room: number;
  nextRoom: number | null;
  progress: number;
  facing: DirectionName;
  movementDirection: DirectionName | null;
  crossingEdgeIndex: number | null;
  crossingRequiresOpenHold: boolean;
}

interface RuntimeGhost extends RuntimeActor {
  readonly id: string;
  readonly role: GhostRole;
  readonly spawnRoom: number;
  readonly releaseTick: number;
  released: boolean;
  respawnTicks: number;
  decisions: number;
  edgesCrossed: number;
  lastTargetRoom: number;
  lastDecisionEdgeWasOpen: boolean;
}

const DEFAULT_PLAYER_START = 95;
const DEFAULT_GHOST_STARTS = GHOST_HOME_ROOMS;
const DEFAULT_GHOST_RELEASE_TICKS = [60, 150, 240, 330] as const;
const GHOST_ROLES: readonly GhostRole[] = Object.freeze([
  "direct",
  "ambush",
  "flank",
  "distance",
]);
const GHOST_IDS = Object.freeze(["VECTOR", "VEIL", "MIRROR", "DRIFTER"]);

export class QuantmanSession {
  public readonly graph: RoomGraph;
  public readonly bank: TopologyBank;
  public readonly mechanic: MazeMechanic;
  private readonly rng: SeededRng;
  private readonly collectibles: readonly Collectible[];
  private readonly ghostsEnabled: boolean;
  private readonly initialCollectedRooms: readonly number[];
  private readonly playerStartRoom: number;
  private readonly ghostStartRooms: readonly [number, number, number, number];
  private readonly ghostReleaseTicks: readonly [number, number, number, number];
  private readonly initialTopologyIndex: number | undefined;
  private phase: SessionPhase = "ready";
  private tick = 0;
  private activeTick = 0;
  private score = 0;
  private lives: number;
  private player: RuntimeActor;
  private ghosts: RuntimeGhost[];
  private currentTopology: CompiledTopology;
  private collectedRooms = new Set<number>();
  private wallPassTicks = 0;
  private ghostEatTicks = 0;
  private ghostCombo = 0;
  private invulnerableTicks = 0;
  private topologyTicks = 0;
  private compatibleCount: number;
  private observedEdges: readonly number[] = Object.freeze([]);
  private heldEdges: readonly number[] = Object.freeze([]);
  private changedEdges: readonly number[] = Object.freeze([]);
  private changeCueTicks = 0;
  private gazeKey = "";
  private gazeTargetEdgeIndex: number | null = null;
  private gazeTargetFromWall: boolean | null = null;
  private gazeTargetToWall: boolean | null = null;
  private gazeDwellTicks = 0;
  private gazeStatus: GazeStatus;
  private interventionCount = 0;
  private readonly transitions: TopologyTransition[] = [];
  private readonly topologyHistory: string[] = [];
  private invariantFailureCount = 0;
  private readonly diagnostics: string[] = [];
  private powersCollected = { "wall-pass": 0, "ghost-eat": 0 };
  private ghostsEaten = 0;
  private totalGhostDecisions = 0;
  private totalGhostEdgesCrossed = 0;
  private completion: CompletionRecord | null = null;

  public constructor(
    fixture: LabyrinthFixture,
    public readonly runSeed: number,
    options: SessionOptions = {},
    authority: QuantmanQpuFixtureAuthority | null = null,
  ) {
    this.graph = new RoomGraph(fixture.width, fixture.height);
    this.bank = new TopologyBank(this.graph, fixture, authority);
    this.mechanic = options.mechanic ?? "stabilize-gaze";
    this.gazeStatus =
      this.mechanic === "inverse-gaze" ? "charging" : "stabilizing";
    this.rng = new SeededRng(runSeed);
    this.collectibles = options.collectibleKinds
      ? collectibleLayoutFromKinds(options.collectibleKinds)
      : productionCollectibles(this.graph.roomCount);
    this.ghostsEnabled = options.ghostsEnabled ?? true;
    this.score = options.startingScore ?? 0;
    if (!Number.isSafeInteger(this.score) || this.score < 0)
      throw new Error("Starting score must be a nonnegative safe integer.");
    this.lives = options.startingLives ?? TUNING.startingLives;
    if (!Number.isInteger(this.lives) || this.lives <= 0)
      throw new Error("Starting lives must be a positive integer.");
    this.initialCollectedRooms = Object.freeze([
      ...new Set([
        ...(options.collectibleKinds ? [] : GHOST_HOME_ROOMS),
        ...(options.initialCollectedRooms ?? []),
      ]),
    ]);
    this.playerStartRoom = options.playerStartRoom ?? DEFAULT_PLAYER_START;
    this.ghostStartRooms = options.ghostStartRooms ?? DEFAULT_GHOST_STARTS;
    this.ghostReleaseTicks =
      options.ghostReleaseTicks ?? DEFAULT_GHOST_RELEASE_TICKS;
    this.initialTopologyIndex = options.initialTopologyIndex;
    this.validateRoom(this.playerStartRoom);
    this.ghostStartRooms.forEach((room) => this.validateRoom(room));
    this.initialCollectedRooms.forEach((room) => this.validateRoom(room));
    const topologyIndex =
      this.initialTopologyIndex ??
      this.rng.nextInt(this.bank.topologies.length);
    const topology = this.bank.topologies[topologyIndex];
    if (!topology)
      throw new Error(`Unknown initial topology ${topologyIndex}.`);
    this.currentTopology = topology;
    this.compatibleCount = this.bank.topologies.length;
    this.player = makeActor(this.playerStartRoom, "right");
    this.ghosts = this.spawnGhosts(0);
    this.collectedRooms = new Set(this.initialCollectedRooms);
    this.topologyHistory.push(topology.id);
    this.resetGazeState();
  }

  public step(input: SemanticInput): SessionSnapshot {
    this.tick += 1;
    if (this.phase === "ready" && (input.start || input.direction !== null))
      this.phase = "active";
    if (this.phase !== "active") return this.snapshot();
    this.activeTick += 1;
    this.decrementTimers();
    if (input.direction !== null) {
      this.player.facing = input.direction;
      this.playerBuffer = input.direction;
    }
    this.advancePlayer();
    this.collectAtPlayerRoom();
    if (this.phase === "active") this.advanceGhosts();
    if (this.phase === "active") {
      if (this.mechanic === "stabilize-gaze") {
        if (this.activeTick % TUNING.topologyPeriodTicks === 0)
          this.advanceStabilizedTopology();
      } else {
        this.advanceInverseGaze();
      }
    }
    if (this.phase === "active") this.resolveContacts();
    return this.snapshot();
  }

  private playerBuffer: DirectionName | null = null;

  public snapshot(): SessionSnapshot {
    return deepFreeze({
      phase: this.phase,
      mechanic: this.mechanic,
      runSeed: this.runSeed,
      tick: this.tick,
      activeTick: this.activeTick,
      score: this.score,
      lives: this.lives,
      player: this.actorSnapshot(this.player),
      ghosts: this.ghosts.map((ghost) => this.ghostSnapshot(ghost)),
      wallPassTicks: this.wallPassTicks,
      ghostEatTicks: this.ghostEatTicks,
      ghostCombo: this.ghostCombo,
      collectedRooms: [...this.collectedRooms].sort((a, b) => a - b),
      remainingCollectibles:
        this.collectibles.length - this.collectedRooms.size,
      collectibleKinds: this.collectibles.map(
        (collectible) => collectible.kind,
      ),
      topologyId: this.currentTopology.id,
      topologyBankSize: this.bank.topologies.length,
      topologyWallMask: this.currentTopology.wallMask,
      topologyBitstring: this.currentTopology.representativeBitstring,
      topologyTicks: this.topologyTicks,
      topologyHistory: [...this.topologyHistory],
      rngState: this.rng.snapshot(),
      compatibleCount: this.compatibleCount,
      observedEdgeIndices: [...this.observedEdges],
      heldEdgeIndices: [...this.heldEdges],
      changedEdgeIndices: [...this.changedEdges],
      gazeTargetEdgeIndex: this.gazeTargetEdgeIndex,
      gazeTargetFromWall: this.gazeTargetFromWall,
      gazeTargetToWall: this.gazeTargetToWall,
      gazeDwellTicks: this.gazeDwellTicks,
      gazeStatus: this.gazeStatus,
      interventionCount: this.interventionCount,
      invariantFailureCount: this.invariantFailureCount,
      diagnostics: [...this.diagnostics],
      ghostDecisions: this.totalGhostDecisions,
      ghostEdgesCrossed: this.totalGhostEdgesCrossed,
      powersCollected: { ...this.powersCollected },
      ghostsEaten: this.ghostsEaten,
      completion: this.completion ? { ...this.completion } : null,
    });
  }

  public topologyTransitions(): readonly TopologyTransition[] {
    return Object.freeze(
      this.transitions.map((transition) => deepFreeze({ ...transition })),
    );
  }

  private decrementTimers(): void {
    if (this.changeCueTicks > 0) {
      this.changeCueTicks -= 1;
      if (this.changeCueTicks === 0) this.changedEdges = Object.freeze([]);
    }
    if (this.wallPassTicks > 0) this.wallPassTicks -= 1;
    if (this.ghostEatTicks > 0) {
      this.ghostEatTicks -= 1;
      if (this.ghostEatTicks === 0) this.ghostCombo = 0;
    }
    if (this.invulnerableTicks > 0) this.invulnerableTicks -= 1;
    for (const ghost of this.ghosts) {
      if (ghost.respawnTicks > 0) {
        ghost.respawnTicks -= 1;
        if (ghost.respawnTicks === 0)
          resetActor(ghost, ghost.spawnRoom, "left");
      }
    }
  }

  private advancePlayer(): void {
    if (this.player.nextRoom === null) {
      const directions = [
        this.playerBuffer,
        this.player.movementDirection,
      ].filter(
        (direction, index, all): direction is DirectionName =>
          direction !== null && all.indexOf(direction) === index,
      );
      for (const direction of directions) {
        if (
          this.tryBeginCrossing(this.player, direction, this.wallPassTicks > 0)
        ) {
          if (this.playerBuffer === direction) this.playerBuffer = null;
          break;
        }
      }
    }
    this.advanceCrossing(
      this.player,
      TUNING.playerRoomsPerSecond / TUNING.simulationHz,
    );
  }

  private advanceGhosts(): void {
    if (!this.ghostsEnabled) return;
    for (const [index, ghost] of this.ghosts.entries()) {
      if (ghost.respawnTicks > 0) continue;
      if (!ghost.released) {
        if (this.activeTick < ghost.releaseTick) continue;
        ghost.released = true;
      }
      // The den is fixed local geometry; its exit does not use measured walls.
      if (isGhostHomeRoom(ghost.room)) {
        if (ghost.nextRoom === null) {
          const next =
            ghost.room === 44
              ? 45
              : ghost.room === 54
                ? 44
                : ghost.room === 55
                  ? 45
                  : GHOST_HOME_EXIT_ROOM;
          ghost.nextRoom = next;
          ghost.facing = next === ghost.room + 1 ? "right" : "up";
          ghost.movementDirection = ghost.facing;
        }
        this.advanceCrossing(
          ghost,
          TUNING.ghostRoomsPerSecond / TUNING.simulationHz,
        );
        continue;
      }
      const beforeRoom = ghost.room;
      if (ghost.nextRoom === null) {
        const decision = decideGhostStep(this.graph, ghost.role, index, {
          ownRoom: ghost.room,
          playerRoom: actorAnchorRoom(this.player),
          playerFacing: this.player.facing,
          currentWallMask: this.currentTopology.wallMask,
          activeTick: this.activeTick,
          frightened: this.ghostEatTicks > 0,
        });
        ghost.decisions += 1;
        this.totalGhostDecisions += 1;
        ghost.lastTargetRoom = decision.targetRoom;
        ghost.lastDecisionEdgeWasOpen = decision.edgeWasOpen;
        if (decision.nextRoom !== ghost.room && decision.edgeWasOpen) {
          const direction = directionBetween(
            this.graph,
            ghost.room,
            decision.nextRoom,
          );
          if (direction) this.tryBeginCrossing(ghost, direction, false);
        }
      }
      this.advanceCrossing(
        ghost,
        (TUNING.ghostRoomsPerSecond / TUNING.simulationHz) *
          (this.isTunnelMouth(ghost.room) ||
          (ghost.nextRoom !== null && this.isTunnelMouth(ghost.nextRoom))
            ? TUNING.ghostTunnelSpeedMultiplier
            : 1),
      );
      if (ghost.room !== beforeRoom) {
        ghost.edgesCrossed += 1;
        this.totalGhostEdgesCrossed += 1;
      }
    }
  }

  private isTunnelMouth(room: number): boolean {
    const { row, col } = this.graph.coordinate(room);
    return row === TUNNEL_ROW && (col === 0 || col === this.graph.width - 1);
  }

  private tryBeginCrossing(
    actor: RuntimeActor,
    direction: DirectionName,
    mayCrossWall: boolean,
  ): boolean {
    const nextRoom = this.graph.neighbour(actor.room, direction);
    if (nextRoom === null) {
      const destination = tunnelDestination(this.graph, actor.room, direction);
      if (destination === null) return false;
      resetActor(actor, destination, direction);
      actor.movementDirection = direction;
      return true;
    }
    if (isGhostHomeRoom(nextRoom)) return false;
    const edge = this.graph.edgeBetween(actor.room, nextRoom);
    if (!edge) throw new Error("Adjacent rooms have no graph edge.");
    const wall = this.graph.isWall(this.currentTopology.wallMask, edge.index);
    if (wall && !mayCrossWall) return false;
    actor.nextRoom = nextRoom;
    actor.progress = 0;
    actor.facing = direction;
    actor.movementDirection = direction;
    actor.crossingEdgeIndex = edge.index;
    actor.crossingRequiresOpenHold = !wall;
    return true;
  }

  private advanceCrossing(actor: RuntimeActor, amount: number): void {
    if (actor.nextRoom === null) return;
    actor.progress = Math.min(1, actor.progress + amount);
    if (actor.progress < 1) return;
    actor.room = actor.nextRoom;
    actor.nextRoom = null;
    actor.progress = 0;
    actor.crossingEdgeIndex = null;
    actor.crossingRequiresOpenHold = false;
  }

  private collectAtPlayerRoom(): void {
    const room = this.player.room;
    if (this.collectedRooms.has(room)) return;
    const collectible = this.collectibles[room];
    if (!collectible) throw new Error(`Room ${room} has no collectible.`);
    this.collectedRooms.add(room);
    if (collectible.kind === "pellet") this.score += TUNING.pelletScore;
    else {
      this.score += TUNING.powerScore;
      this.powersCollected[collectible.kind] += 1;
      if (collectible.kind === "wall-pass")
        this.wallPassTicks = TUNING.wallPassTicks;
      else {
        this.ghostEatTicks = TUNING.ghostEatTicks;
        this.ghostCombo = 0;
      }
    }
    if (this.collectedRooms.size === this.collectibles.length)
      this.clearLevel();
  }

  private clearLevel(): void {
    this.phase = "won";
    this.score += TUNING.levelClearScore + this.lives * TUNING.lifeBonusScore;
    this.lives += 1;
    this.completion = Object.freeze({
      outcome: "LEVEL_CLEARED",
      runSeed: this.runSeed,
      score: this.score,
      remainingLives: this.lives,
      simulationTicks: this.activeTick,
      fixtureId: this.bank.fixture.fixtureId,
      fixtureSha256: this.bank.fixture.contentSha256,
      mechanic: this.mechanic,
    });
  }

  private advanceStabilizedTopology(): void {
    const anchorRoom = actorAnchorRoom(this.player);
    const observed = observedEdgeIndices(
      this.graph,
      anchorRoom,
      this.player.facing,
    );
    const safety = this.crossingSafety();
    const constraints = mergeConstraints(
      observedConstraints(this.currentTopology.wallMask, observed),
      safety,
    );
    const before = this.currentTopology;
    try {
      const sample = this.bank.sampleCompatible(before, constraints, this.rng);
      this.currentTopology = sample.topology;
      this.compatibleCount = sample.compatible.length;
    } catch (error) {
      if (!(error instanceof EmptyCompatibleSubsetError)) throw error;
      this.invariantFailureCount += 1;
      if (this.diagnostics.length < TUNING.topologyDiagnosticLimit)
        this.diagnostics.push(error.message);
    }
    this.observedEdges = observed;
    this.gazeStatus = "stabilizing";
    this.recordTopologyTransition(before, safety, null, null, null);
  }

  private advanceInverseGaze(): void {
    const safety = this.crossingSafety();
    this.heldEdges = Object.freeze(
      safety.map((constraint) => constraint.edgeIndex),
    );
    const anchorRoom = actorAnchorRoom(this.player);
    const targetEdgeIndex = focusedEdgeIndex(
      this.graph,
      anchorRoom,
      this.player.facing,
      this.player.crossingEdgeIndex,
    );
    const nextKey = `${this.player.facing}:${targetEdgeIndex ?? "perimeter"}`;
    if (nextKey !== this.gazeKey) {
      this.gazeKey = nextKey;
      this.gazeTargetEdgeIndex = targetEdgeIndex;
      this.gazeDwellTicks = 1;
      if (targetEdgeIndex === null) {
        this.gazeTargetFromWall = null;
        this.gazeTargetToWall = null;
        this.gazeStatus = "perimeter";
      } else {
        const fromWall = this.graph.isWall(
          this.currentTopology.wallMask,
          targetEdgeIndex,
        );
        this.gazeTargetFromWall = fromWall;
        this.gazeTargetToWall = !fromWall;
        this.gazeStatus = "charging";
      }
      return;
    }
    if (
      targetEdgeIndex === null ||
      this.gazeStatus === "applied" ||
      this.phase !== "active"
    )
      return;
    this.gazeDwellTicks = Math.min(
      TUNING.topologyPeriodTicks,
      this.gazeDwellTicks + 1,
    );
    if (this.gazeDwellTicks < TUNING.topologyPeriodTicks) return;
    this.applyInverseIntervention(targetEdgeIndex, safety);
  }

  private applyInverseIntervention(
    targetEdgeIndex: number,
    safety: readonly EdgeConstraint[],
  ): void {
    if (safety.some((constraint) => constraint.edgeIndex === targetEdgeIndex)) {
      this.gazeStatus = "deferred";
      this.heldEdges = Object.freeze(
        safety.map((constraint) => constraint.edgeIndex),
      );
      return;
    }
    const before = this.currentTopology;
    const fromWall = this.graph.isWall(before.wallMask, targetEdgeIndex);
    const toWall = !fromWall;
    const constraints = mergeConstraints(
      [Object.freeze({ edgeIndex: targetEdgeIndex, wall: toWall })],
      safety,
    );
    try {
      const sample = this.bank.sampleConstrained(constraints, this.rng);
      this.currentTopology = sample.topology;
      this.compatibleCount = sample.compatible.length;
    } catch (error) {
      if (!(error instanceof EmptyCompatibleSubsetError)) throw error;
      this.gazeStatus = "deferred";
      if (this.diagnostics.length < TUNING.topologyDiagnosticLimit)
        this.diagnostics.push(`Gaze intervention deferred: ${error.message}`);
      return;
    }
    this.observedEdges = Object.freeze([]);
    this.gazeTargetFromWall = fromWall;
    this.gazeTargetToWall = toWall;
    this.gazeStatus = "applied";
    this.interventionCount += 1;
    this.recordTopologyTransition(
      before,
      safety,
      targetEdgeIndex,
      fromWall,
      toWall,
    );
  }

  private crossingSafety(): readonly EdgeConstraint[] {
    const crossings: ActiveCrossing[] = [this.player, ...this.ghosts]
      .filter((actor) => actor.crossingEdgeIndex !== null)
      .map((actor) => ({
        edgeIndex: actor.crossingEdgeIndex!,
        requiresOpenHold: actor.crossingRequiresOpenHold,
      }));
    return crossingSafetyConstraints(this.currentTopology.wallMask, crossings);
  }

  private recordTopologyTransition(
    before: CompiledTopology,
    safety: readonly EdgeConstraint[],
    targetEdgeIndex: number | null,
    targetFromWall: boolean | null,
    targetToWall: boolean | null,
  ): void {
    this.heldEdges = Object.freeze(
      safety.map((constraint) => constraint.edgeIndex),
    );
    this.changedEdges = Object.freeze(
      this.graph.edges
        .filter(
          (edge) =>
            before.wallMask[edge.index] !==
            this.currentTopology.wallMask[edge.index],
        )
        .map((edge) => edge.index),
    );
    this.changeCueTicks = TUNING.topologyChangeCueTicks;
    this.topologyTicks += 1;
    this.topologyHistory.push(this.currentTopology.id);
    this.transitions.push(
      deepFreeze({
        activeTick: this.activeTick,
        mechanic: this.mechanic,
        fromId: before.id,
        toId: this.currentTopology.id,
        compatibleCount: this.compatibleCount,
        observedEdgeIndices: [...this.observedEdges],
        heldEdgeIndices: [...this.heldEdges],
        changedEdgeIndices: [...this.changedEdges],
        targetEdgeIndex,
        targetFromWall,
        targetToWall,
      }),
    );
  }

  private resetGazeState(): void {
    this.gazeKey = "";
    this.observedEdges = Object.freeze([]);
    this.heldEdges = Object.freeze([]);
    this.changedEdges = Object.freeze([]);
    this.changeCueTicks = 0;
    this.gazeDwellTicks = 0;
    this.gazeTargetEdgeIndex =
      this.mechanic === "inverse-gaze"
        ? focusedEdgeIndex(
            this.graph,
            actorAnchorRoom(this.player),
            this.player.facing,
          )
        : null;
    if (this.gazeTargetEdgeIndex === null) {
      this.gazeTargetFromWall = null;
      this.gazeTargetToWall = null;
      this.gazeStatus =
        this.mechanic === "inverse-gaze" ? "perimeter" : "stabilizing";
    } else {
      const fromWall = this.graph.isWall(
        this.currentTopology.wallMask,
        this.gazeTargetEdgeIndex,
      );
      this.gazeTargetFromWall = fromWall;
      this.gazeTargetToWall = !fromWall;
      this.gazeStatus = "charging";
    }
  }

  private resolveContacts(): void {
    if (!this.ghostsEnabled || this.invulnerableTicks > 0) return;
    const playerPosition = actorPosition(this.graph, this.player);
    for (const ghost of this.ghosts) {
      if (ghost.respawnTicks > 0 || !ghost.released) continue;
      const ghostPosition = actorPosition(this.graph, ghost);
      if (
        Math.hypot(
          playerPosition.row - ghostPosition.row,
          playerPosition.col - ghostPosition.col,
        ) > 0.34
      )
        continue;
      if (this.ghostEatTicks > 0) {
        const comboIndex = Math.min(
          this.ghostCombo,
          TUNING.ghostComboScores.length - 1,
        );
        this.score += TUNING.ghostComboScores[comboIndex] ?? 0;
        this.ghostCombo += 1;
        this.ghostsEaten += 1;
        ghost.respawnTicks = TUNING.ghostRespawnTicks;
        ghost.released = false;
        resetActor(ghost, ghost.spawnRoom, "left");
      } else {
        this.loseLife();
        return;
      }
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = "lost";
      return;
    }
    resetActor(this.player, this.playerStartRoom, "right");
    this.playerBuffer = null;
    this.wallPassTicks = 0;
    this.ghostEatTicks = 0;
    this.ghostCombo = 0;
    this.invulnerableTicks = TUNING.respawnInvulnerabilityTicks;
    this.ghosts = this.spawnGhosts(this.activeTick);
    this.resetGazeState();
  }

  private spawnGhosts(releaseBaseTick: number): RuntimeGhost[] {
    return GHOST_ROLES.map((role, index) => {
      const spawnRoom =
        this.ghostStartRooms[index] ?? DEFAULT_GHOST_STARTS[index]!;
      return {
        ...makeActor(spawnRoom, "left"),
        id: GHOST_IDS[index] ?? `GHOST-${index}`,
        role,
        spawnRoom,
        releaseTick:
          releaseBaseTick +
          (this.ghostReleaseTicks[index] ??
            DEFAULT_GHOST_RELEASE_TICKS[index]!),
        released:
          (this.ghostReleaseTicks[index] ??
            DEFAULT_GHOST_RELEASE_TICKS[index]!) === 0,
        respawnTicks: 0,
        decisions: 0,
        edgesCrossed: 0,
        lastTargetRoom: spawnRoom,
        lastDecisionEdgeWasOpen: true,
      };
    });
  }

  private actorSnapshot(actor: RuntimeActor): ActorSnapshot {
    const position = actorPosition(this.graph, actor);
    return Object.freeze({
      room: actor.room,
      nextRoom: actor.nextRoom,
      progress: actor.progress,
      row: position.row,
      col: position.col,
      facing: actor.facing,
      movementDirection: actor.movementDirection,
      crossingEdgeIndex: actor.crossingEdgeIndex,
    });
  }

  private ghostSnapshot(ghost: RuntimeGhost): GhostSnapshot {
    const mode: GhostMode = !this.ghostsEnabled
      ? "waiting"
      : ghost.respawnTicks > 0
        ? "respawning"
        : !ghost.released
          ? "waiting"
          : this.ghostEatTicks > 0
            ? "frightened"
            : "chase";
    return Object.freeze({
      ...this.actorSnapshot(ghost),
      id: ghost.id,
      role: ghost.role,
      mode,
      respawnTicks: ghost.respawnTicks,
      decisions: ghost.decisions,
      edgesCrossed: ghost.edgesCrossed,
      lastTargetRoom: ghost.lastTargetRoom,
      lastDecisionEdgeWasOpen: ghost.lastDecisionEdgeWasOpen,
    });
  }

  private validateRoom(room: number): void {
    this.graph.coordinate(room);
  }
}

function makeActor(room: number, facing: DirectionName): RuntimeActor {
  return {
    room,
    nextRoom: null,
    progress: 0,
    facing,
    movementDirection: null,
    crossingEdgeIndex: null,
    crossingRequiresOpenHold: false,
  };
}

function resetActor(
  actor: RuntimeActor,
  room: number,
  facing: DirectionName,
): void {
  actor.room = room;
  actor.nextRoom = null;
  actor.progress = 0;
  actor.facing = facing;
  actor.movementDirection = null;
  actor.crossingEdgeIndex = null;
  actor.crossingRequiresOpenHold = false;
}

function actorAnchorRoom(actor: RuntimeActor): number {
  return actor.nextRoom !== null && actor.progress >= 0.5
    ? actor.nextRoom
    : actor.room;
}

function actorPosition(
  graph: RoomGraph,
  actor: RuntimeActor,
): Readonly<{ row: number; col: number }> {
  const from = graph.coordinate(actor.room);
  if (actor.nextRoom === null) return from;
  const to = graph.coordinate(actor.nextRoom);
  return Object.freeze({
    row: from.row + (to.row - from.row) * actor.progress,
    col: from.col + (to.col - from.col) * actor.progress,
  });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
  }
  return value;
}
