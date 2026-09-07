import { deriveSeed } from "../../core/determinism";
import type { RunContext } from "../../core/run";
import { QuantmanPursuerPolicy } from "./QuantmanPursuerPolicy";
import {
  focusedQuantmanDoor,
  initialQuantmanTopologyState,
  quantmanDoorIsOpen,
  quantmanOpenDoorIds,
  quantmanTopologyRows,
  tryObserveQuantmanTopology,
} from "./QuantmanTopology";
import {
  QUANTMAN_SCORING,
  QUANTMAN_RULES_VERSION,
  type QuantmanActorSnapshot,
  type QuantmanCell,
  type QuantmanDirection,
  type QuantmanEvent,
  type QuantmanInput,
  type QuantmanLabyrinthState,
  type QuantmanPackPayload,
  type QuantmanPlayerTraversalTrace,
  type QuantmanPursuerDefinition,
  type QuantmanPursuerMode,
  type QuantmanPursuerResponseTrace,
  type QuantmanPursuerSnapshot,
  type QuantmanSnapshot,
  type QuantmanTopologyTransitionTrace,
} from "./types";

const STEP_SECONDS = 1 / 60;
const PLAYER_RADIUS = 6;
const PURSUER_RADIUS = 7;
const CONTACT_DISTANCE = PLAYER_RADIUS + PURSUER_RADIUS + 1;
const RESPAWN_INVULNERABILITY_TICKS = 240;
const POWER_WINDOW_TICKS = 420;
const PURSUER_RESPAWN_TICKS = 180;
const EVENT_DISPLAY_TICKS = 90;
const TOPOLOGY_TRACE_LIMIT = 96;
const PURSUER_RESPONSE_TRACE_LIMIT = TOPOLOGY_TRACE_LIMIT * 4;
const GRID_EPSILON = 0.001;

interface RuntimeActor {
  x: number;
  y: number;
  facingX: -1 | 0 | 1;
  facingY: -1 | 0 | 1;
}

interface RuntimePursuer extends RuntimeActor {
  readonly definition: QuantmanPursuerDefinition;
  policy: QuantmanPursuerPolicy;
  mode: QuantmanPursuerMode;
  nextCell: QuantmanCell;
  nextDecisionTick: number;
  respawnTicks: number;
  releaseTick: number;
}

export class QuantmanSession {
  private phase: "active" | "won" | "lost" = "active";
  private tick = 0;
  private activeTicks = 0;
  private started = false;
  private lives: number;
  private score = 0;
  private player: RuntimeActor;
  private playerDirection: QuantmanDirection | null = null;
  private bufferedDirection: QuantmanDirection | null = null;
  private pursuers: RuntimePursuer[];
  private readonly collected = new Set<string>();
  private invulnerableTicks = 0;
  private frightenedTicks = 0;
  private pursuerCombo = 0;
  private eventCounter = 0;
  private latestEvent: QuantmanEvent | null = null;
  private latestEventTicks = 0;
  private topologyState: QuantmanLabyrinthState;
  private currentRows: readonly string[];
  private observationCount = 0;
  private lastTopologyChangeCount = 0;
  private observedDoorIds: readonly string[] = Object.freeze([]);
  private readonly topologyTransitions: QuantmanTopologyTransitionTrace[] = [];
  private readonly playerTraversal: QuantmanPlayerTraversalTrace[] = [];
  private readonly pursuerResponses: QuantmanPursuerResponseTrace[] = [];
  private readonly exploitedObservationIndices = new Set<number>();
  private lastPlayerCell: QuantmanCell;
  private pendingPursuerResponseIndex: number | null = null;

  public constructor(
    private readonly context: RunContext,
    private readonly payload: QuantmanPackPayload,
  ) {
    if (
      context.gameId !== "quantman" ||
      context.rulesVersion !== QUANTMAN_RULES_VERSION
    ) {
      throw new Error(
        "Quantman requires a Quantman run context and matching rules version.",
      );
    }
    this.lives = payload.startingLives;
    this.player = this.spawnActor(payload.playerStart, 1, 0);
    this.pursuers = this.spawnPursuers();
    this.topologyState = initialQuantmanTopologyState(payload, context.runSeed);
    this.currentRows = quantmanTopologyRows(payload, this.topologyState);
    this.lastPlayerCell = Object.freeze({ ...payload.playerStart });
  }

  public step(input: QuantmanInput): QuantmanSnapshot {
    if (this.phase !== "active") return this.snapshot();
    this.tick += 1;
    if (!this.started && (input.x !== 0 || input.y !== 0 || input.observe)) {
      this.started = true;
    }
    if (!this.started) return this.snapshot();
    this.activeTicks += 1;
    if (this.invulnerableTicks > 0) this.invulnerableTicks -= 1;
    if (this.frightenedTicks > 0) {
      this.frightenedTicks -= 1;
      if (this.frightenedTicks === 0) this.pursuerCombo = 0;
    }
    if (this.latestEventTicks > 0) this.latestEventTicks -= 1;
    const beforeDirection = this.playerDirection;
    const afterDirection = this.movePlayer(input);
    const completedTurn =
      beforeDirection !== null &&
      afterDirection !== null &&
      !sameDirection(beforeDirection, afterDirection);
    if (completedTurn || input.observe) {
      this.observeTopology(
        afterDirection ?? {
          x: this.player.facingX,
          y: this.player.facingY,
        },
      );
    }
    this.collectFragments();
    if (this.phase === "active") this.movePursuers();
    if (this.phase === "active") this.resolveContact();
    if (
      this.phase === "active" &&
      this.activeTicks >= this.payload.timeLimitSeconds * 60
    ) {
      this.phase = "lost";
      this.emit("MAZE_LOST", "SIGNAL WINDOW CLOSED");
    }
    return this.snapshot();
  }

  public snapshot(): QuantmanSnapshot {
    const focusedDoor = focusedQuantmanDoor(
      this.payload.topologyDoors,
      pointCell(this.payload, this.player.x, this.player.y),
      { x: this.player.facingX, y: this.player.facingY },
    );
    return deepFreeze({
      phase: this.phase,
      started: this.started,
      tick: this.tick,
      secondsRemaining: Math.max(
        0,
        this.payload.timeLimitSeconds - this.activeTicks / 60,
      ),
      lives: this.lives,
      score: this.score,
      player: actorSnapshot(this.player),
      pursuers: this.pursuers.map(pursuerSnapshot),
      collectedFragmentIds: [...this.collected].sort(),
      fragmentsCollected: this.collected.size,
      totalFragments: this.payload.fragments.length,
      requiredFragments: this.payload.requiredFragments,
      exitUnlocked: this.exitUnlocked(),
      invulnerableTicks: this.invulnerableTicks,
      currentRows: this.currentRows,
      topologyStateId: this.topologyState.stateId,
      observationCount: this.observationCount,
      observationsRemaining: null,
      lastTopologyChangeCount: this.lastTopologyChangeCount,
      frightenedTicks: this.frightenedTicks,
      pursuerCombo: this.pursuerCombo,
      openDoorIds: quantmanOpenDoorIds(this.payload, this.topologyState),
      observedDoorIds: this.observedDoorIds,
      focusedDoorId: focusedDoor.doorId,
      focusedDoorOpen: quantmanDoorIsOpen(this.topologyState, focusedDoor),
      bufferedDirection: this.bufferedDirection
        ? { ...this.bufferedDirection }
        : null,
      topologyTransitions: this.topologyTransitions.map((transition) => ({
        ...transition,
      })),
      playerTraversal: this.playerTraversal.map((traversal) => ({
        ...traversal,
      })),
      pursuerResponses: this.pursuerResponses.map((response) => ({
        ...response,
      })),
      exploitedObservationIndices: [...this.exploitedObservationIndices].sort(
        (left, right) => left - right,
      ),
      latestEvent: this.latestEventTicks > 0 ? this.latestEvent : null,
      storyQualified:
        this.phase === "won" &&
        (this.context.playMode !== "story" ||
          this.exploitedObservationIndices.size > 0),
    });
  }

  private movePlayer(input: QuantmanInput): QuantmanDirection | null {
    const requested = requestedDirection(input, this.playerDirection);
    if (requested) this.bufferedDirection = requested;
    const distance = this.payload.playerSpeed * STEP_SECONDS;
    const movement = advanceGridPlayer(
      this.payload,
      this.currentRows,
      this.player,
      this.playerDirection,
      this.bufferedDirection,
      distance,
    );
    this.player.x = movement.x;
    this.player.y = movement.y;
    this.playerDirection = movement.direction;
    this.bufferedDirection = movement.bufferedDirection;
    if (movement.direction) {
      this.player.facingX = movement.direction.x;
      this.player.facingY = movement.direction.y;
    }
    this.recordPlayerTraversal();
    return this.playerDirection;
  }

  private collectFragments(): void {
    for (const fragment of this.payload.fragments) {
      if (this.collected.has(fragment.fragmentId)) continue;
      const point = cellCentre(this.payload, fragment);
      if (Math.hypot(this.player.x - point.x, this.player.y - point.y) > 11) {
        continue;
      }
      this.collected.add(fragment.fragmentId);
      const power = fragment.kind === "power";
      const points = power
        ? QUANTMAN_SCORING.powerPellet
        : QUANTMAN_SCORING.pellet;
      this.score += points;
      if (power) {
        this.frightenedTicks = POWER_WINDOW_TICKS;
        this.pursuerCombo = 0;
        for (const pursuer of this.pursuers) {
          if (pursuer.respawnTicks === 0) pursuer.mode = "frightened";
        }
        this.emit("POWER_PELLET_COLLECTED", `POWER WINDOW · +${points}`);
      } else {
        this.emit("FRAGMENT_COLLECTED", `PELLET · +${points}`);
      }
      if (this.collected.size === this.payload.requiredFragments) {
        this.completeMaze();
      }
    }
  }

  private observeTopology(facing?: QuantmanDirection): void {
    const playerCell = pointCell(this.payload, this.player.x, this.player.y);
    const occupiedDoorIds = new Set<string>();
    const actors: readonly RuntimeActor[] = [this.player, ...this.pursuers];
    for (const door of this.payload.topologyDoors) {
      const centre = cellCentre(this.payload, door);
      if (
        actors.some(
          (actor) =>
            Math.abs(actor.x - centre.x) < this.payload.tileSize * 0.72 &&
            Math.abs(actor.y - centre.y) < this.payload.tileSize * 0.72,
        )
      ) {
        occupiedDoorIds.add(door.doorId);
      }
    }
    const beforeState = this.topologyState;
    const selection = tryObserveQuantmanTopology(
      this.payload,
      beforeState,
      playerCell,
      occupiedDoorIds,
      this.context.runSeed,
      this.observationCount,
      facing,
    );
    if (!selection) {
      this.emit("OBSERVATION_BLOCKED", "NO SAFE COMPATIBLE MAZE STATE");
      return;
    }
    this.topologyState = selection.state;
    this.currentRows = quantmanTopologyRows(this.payload, this.topologyState);
    this.observationCount += 1;
    this.lastTopologyChangeCount = selection.changedDoorIds.length;
    this.observedDoorIds = selection.observedDoorIds;
    const changedDoors = this.payload.topologyDoors.filter((door) =>
      selection.changedDoorIds.includes(door.doorId),
    );
    const heldDoor = this.payload.topologyDoors.find(
      (door) => door.doorId === selection.heldDoorId,
    );
    if (!heldDoor) {
      throw new Error(
        `Quantman cannot find held door ${selection.heldDoorId}.`,
      );
    }
    this.topologyTransitions.push(
      Object.freeze({
        observationIndex: this.observationCount,
        tick: this.tick,
        beforeStateId: beforeState.stateId,
        afterStateId: selection.state.stateId,
        heldDoorId: selection.heldDoorId,
        heldDoorOpen: quantmanDoorIsOpen(beforeState, heldDoor),
        changedDoorIds: Object.freeze([...selection.changedDoorIds]),
        openedDoorIds: Object.freeze(
          changedDoors
            .filter((door) => quantmanDoorIsOpen(selection.state, door))
            .map((door) => door.doorId),
        ),
        closedDoorIds: Object.freeze(
          changedDoors
            .filter((door) => !quantmanDoorIsOpen(selection.state, door))
            .map((door) => door.doorId),
        ),
        compatibleStateCount: selection.compatibleStateCount,
      }),
    );
    if (this.topologyTransitions.length > TOPOLOGY_TRACE_LIMIT) {
      this.topologyTransitions.shift();
    }
    this.pendingPursuerResponseIndex = this.observationCount;
    for (const pursuer of this.pursuers) pursuer.nextDecisionTick = 0;
    this.emit(
      "TOPOLOGY_OBSERVED",
      `${selection.changedDoorIds.length} PASSAGES CHANGED`,
    );
  }

  private movePursuers(): void {
    const playerCell = pointCell(this.payload, this.player.x, this.player.y);
    const responseIndex = this.pendingPursuerResponseIndex;
    for (const pursuer of this.pursuers) {
      if (pursuer.respawnTicks > 0) {
        pursuer.respawnTicks -= 1;
        pursuer.mode = "returning";
        if (pursuer.respawnTicks === 0) {
          const spawn = cellCentre(this.payload, pursuer.definition);
          pursuer.x = spawn.x;
          pursuer.y = spawn.y;
          pursuer.nextCell = Object.freeze({
            row: pursuer.definition.row,
            col: pursuer.definition.col,
          });
          pursuer.nextDecisionTick = 0;
        }
        continue;
      }
      const ownCell = pointCell(this.payload, pursuer.x, pursuer.y);
      const targetPoint = cellCentre(this.payload, pursuer.nextCell);
      const reachedTarget =
        Math.hypot(pursuer.x - targetPoint.x, pursuer.y - targetPoint.y) < 1.5;
      if (this.tick >= pursuer.nextDecisionTick || reachedTarget) {
        const previousNextCell = Object.freeze({ ...pursuer.nextCell });
        const visiblePlayerCell = pursuerCanSeePlayer(
          this.currentRows,
          pursuer,
          ownCell,
          playerCell,
        )
          ? playerCell
          : null;
        const decision = pursuer.policy.decide({
          tick: this.tick,
          pursuerId: pursuer.definition.pursuerId,
          ownCell,
          visiblePlayerCell,
          playerFacing: {
            x: this.player.facingX,
            y: this.player.facingY,
          },
          exitCell: this.payload.exit,
          exitUnlocked: this.exitUnlocked(),
          rows: this.currentRows,
          patrol: pursuer.definition.patrol,
        });
        pursuer.mode = this.frightenedTicks > 0 ? "frightened" : decision.mode;
        pursuer.nextCell =
          this.frightenedTicks > 0
            ? frightenedStep(
                this.currentRows,
                ownCell,
                playerCell,
                deriveSeed(
                  this.context.runSeed,
                  `quantman:frightened:${pursuer.definition.pursuerId}:${this.tick}`,
                ),
              )
            : decision.nextCell;
        if (responseIndex !== null) {
          this.pursuerResponses.push(
            Object.freeze({
              observationIndex: responseIndex,
              tick: this.tick,
              topologyStateId: this.topologyState.stateId,
              pursuerId: pursuer.definition.pursuerId,
              ownCell: Object.freeze({ ...ownCell }),
              previousNextCell,
              nextCell: Object.freeze({ ...pursuer.nextCell }),
              targetCell: Object.freeze({ ...decision.targetCell }),
              mode: decision.mode,
            }),
          );
          if (this.pursuerResponses.length > PURSUER_RESPONSE_TRACE_LIMIT) {
            this.pursuerResponses.shift();
          }
        }
        pursuer.nextDecisionTick =
          this.tick +
          (decision.mode === "hesitate"
            ? pursuer.definition.hesitationTicks
            : pursuer.definition.decisionIntervalTicks);
      }
      if (this.activeTicks < pursuer.releaseTick) continue;
      if (pursuer.mode === "hesitate") continue;
      const target = cellCentre(this.payload, pursuer.nextCell);
      const deltaX = target.x - pursuer.x;
      const deltaY = target.y - pursuer.y;
      if (
        pointCell(this.payload, pursuer.x, pursuer.y).row ===
          pursuer.nextCell.row &&
        Math.abs(deltaX) > (this.payload.width * this.payload.tileSize) / 2
      ) {
        pursuer.x = target.x;
        pursuer.y = target.y;
        continue;
      }
      const distance = Math.hypot(deltaX, deltaY);
      if (distance <= Number.EPSILON) continue;
      const speed =
        this.frightenedTicks > 0
          ? pursuer.definition.speed * 0.72
          : pursuer.definition.speed;
      const step = Math.min(distance, speed * STEP_SECONDS);
      pursuer.x += (deltaX / distance) * step;
      pursuer.y += (deltaY / distance) * step;
      pursuer.facingX = axisSign(deltaX);
      pursuer.facingY = axisSign(deltaY);
    }
    this.pendingPursuerResponseIndex = null;
  }

  private resolveContact(): void {
    if (this.invulnerableTicks > 0) return;
    const contacted = this.pursuers.find(
      (pursuer) =>
        pursuer.respawnTicks === 0 &&
        this.activeTicks >= pursuer.releaseTick &&
        Math.hypot(this.player.x - pursuer.x, this.player.y - pursuer.y) <=
          CONTACT_DISTANCE,
    );
    if (!contacted) return;
    if (this.frightenedTicks > 0) {
      const points = QUANTMAN_SCORING.pursuer * 2 ** this.pursuerCombo;
      this.pursuerCombo = Math.min(3, this.pursuerCombo + 1);
      this.score += points;
      contacted.respawnTicks = PURSUER_RESPAWN_TICKS;
      contacted.mode = "returning";
      this.emit(
        "PURSUER_EATEN",
        `${contacted.definition.pursuerId} · +${points}`,
      );
      return;
    }
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = "lost";
      this.emit("MAZE_LOST", "NO SIGNALS REMAIN");
      return;
    }
    this.emit("PLAYER_CAUGHT", "SIGNAL INTERRUPTED");
    const caughtCell = pointCell(this.payload, this.player.x, this.player.y);
    this.player = this.spawnActor(this.payload.playerStart, 1, 0);
    this.playerDirection = null;
    this.bufferedDirection = null;
    this.playerTraversal.push(
      Object.freeze({
        traversalIndex: this.playerTraversal.length + 1,
        tick: this.tick,
        kind: "respawn",
        fromCell: Object.freeze({ ...caughtCell }),
        toCell: Object.freeze({ ...this.payload.playerStart }),
        topologyStateId: this.topologyState.stateId,
        doorId: null,
        exploitedObservationIndex: null,
      }),
    );
    this.lastPlayerCell = Object.freeze({ ...this.payload.playerStart });
    this.pursuers = this.spawnPursuers();
    this.frightenedTicks = 0;
    this.pursuerCombo = 0;
    this.invulnerableTicks = RESPAWN_INVULNERABILITY_TICKS;
  }

  private completeMaze(): void {
    this.phase = "won";
    this.score +=
      QUANTMAN_SCORING.mazeWin + this.lives * QUANTMAN_SCORING.remainingLife;
    this.emit("MAZE_WON", `LABYRINTH CLEARED · SCORE ${this.score}`);
  }

  private exitUnlocked(): boolean {
    return this.collected.size >= this.payload.requiredFragments;
  }

  private recordPlayerTraversal(): void {
    const currentCell = pointCell(this.payload, this.player.x, this.player.y);
    if (sameCell(this.lastPlayerCell, currentCell)) return;
    const crossedDoor = this.payload.topologyDoors.find((door) =>
      sameCell(door, currentCell),
    );
    let exploitedObservationIndex: number | null = null;
    if (
      crossedDoor &&
      this.currentRows[crossedDoor.row]?.[crossedDoor.col] === "."
    ) {
      const exploitedTransition = [...this.topologyTransitions]
        .reverse()
        .find(
          (transition) =>
            transition.openedDoorIds.includes(crossedDoor.doorId) &&
            !this.exploitedObservationIndices.has(transition.observationIndex),
        );
      if (exploitedTransition) {
        exploitedObservationIndex = exploitedTransition.observationIndex;
        this.exploitedObservationIndices.add(exploitedObservationIndex);
        this.score += QUANTMAN_SCORING.observedRoute;
        this.emit(
          "ROUTE_EXPLOITED",
          `${crossedDoor.doorId.toUpperCase()} ROUTE · +${QUANTMAN_SCORING.observedRoute}`,
        );
      }
    }
    this.playerTraversal.push(
      Object.freeze({
        traversalIndex: this.playerTraversal.length + 1,
        tick: this.tick,
        kind: "move",
        fromCell: Object.freeze({ ...this.lastPlayerCell }),
        toCell: Object.freeze({ ...currentCell }),
        topologyStateId: this.topologyState.stateId,
        doorId: crossedDoor?.doorId ?? null,
        exploitedObservationIndex,
      }),
    );
    this.lastPlayerCell = currentCell;
  }

  private spawnActor(
    cell: QuantmanCell,
    facingX: -1 | 0 | 1,
    facingY: -1 | 0 | 1,
  ): RuntimeActor {
    const point = cellCentre(this.payload, cell);
    return { x: point.x, y: point.y, facingX, facingY };
  }

  private spawnPursuers(): RuntimePursuer[] {
    return this.payload.pursuers.map((definition, index) => {
      const actor = this.spawnActor(definition, -1, 0);
      return {
        ...actor,
        definition,
        policy: new QuantmanPursuerPolicy(
          definition.pursuerId,
          deriveSeed(this.context.runSeed, `quantman:${definition.pursuerId}`),
          definition.hesitationTicks,
          definition.role,
        ),
        mode: "patrol",
        nextCell: Object.freeze({ row: definition.row, col: definition.col }),
        nextDecisionTick: 0,
        respawnTicks: 0,
        releaseTick: this.activeTicks + 240 + index * 120,
      };
    });
  }

  private emit(type: QuantmanEvent["type"], detail: string): void {
    this.eventCounter += 1;
    this.latestEvent = Object.freeze({
      eventId: this.eventCounter,
      tick: this.tick,
      type,
      detail,
    });
    this.latestEventTicks = EVENT_DISPLAY_TICKS;
  }
}

interface GridMovement {
  readonly x: number;
  readonly y: number;
  readonly direction: QuantmanDirection | null;
  readonly bufferedDirection: QuantmanDirection | null;
}

function requestedDirection(
  input: QuantmanInput,
  active: QuantmanDirection | null,
): QuantmanDirection | null {
  if (input.x === 0 && input.y === 0) return null;
  if (input.x !== 0 && input.y !== 0) {
    if (active?.x !== 0) return Object.freeze({ x: 0, y: input.y });
    return Object.freeze({ x: input.x, y: 0 });
  }
  return Object.freeze({ x: input.x, y: input.y });
}

function advanceGridPlayer(
  payload: QuantmanPackPayload,
  rows: readonly string[],
  actor: RuntimeActor,
  currentDirection: QuantmanDirection | null,
  currentBuffer: QuantmanDirection | null,
  distance: number,
): GridMovement {
  let x = actor.x;
  let y = actor.y;
  let direction = currentDirection;
  let bufferedDirection = currentBuffer;
  let turnedAtCentre = false;
  const cell = pointCell(payload, x, y);
  const centre = cellCentre(payload, cell);

  if (bufferedDirection) {
    if (direction && oppositeDirections(direction, bufferedDirection)) {
      direction = bufferedDirection;
      bufferedDirection = null;
    } else if (direction && sameDirection(direction, bufferedDirection)) {
      bufferedDirection = null;
    } else if (
      canTurnAtCentre(
        rows,
        cell,
        centre,
        x,
        y,
        direction,
        bufferedDirection,
        distance,
      )
    ) {
      x = centre.x;
      y = centre.y;
      direction = bufferedDirection;
      bufferedDirection = null;
      turnedAtCentre = true;
    }
  }

  if (!direction) {
    return Object.freeze({ x, y, direction, bufferedDirection });
  }
  if (turnedAtCentre) {
    return Object.freeze({ x, y, direction, bufferedDirection });
  }

  const currentCell = pointCell(payload, x, y);
  const currentCentre = cellCentre(payload, currentCell);
  if (direction.x !== 0) y = currentCentre.y;
  if (direction.y !== 0) x = currentCentre.x;
  const centreOffset =
    (x - currentCentre.x) * direction.x + (y - currentCentre.y) * direction.y;
  if (
    !directionIsWalkable(rows, currentCell, direction) &&
    centreOffset >= -distance - GRID_EPSILON
  ) {
    return Object.freeze({
      x: currentCentre.x,
      y: currentCentre.y,
      direction: null,
      bufferedDirection,
    });
  }

  if (payload.tunnelRows.includes(currentCell.row) && direction.x !== 0) {
    const left = cellCentre(payload, { row: currentCell.row, col: 0 });
    const right = cellCentre(payload, {
      row: currentCell.row,
      col: payload.width - 1,
    });
    if (
      direction.x < 0 &&
      currentCell.col === 0 &&
      x <= left.x + GRID_EPSILON
    ) {
      return Object.freeze({
        x: right.x,
        y: right.y,
        direction,
        bufferedDirection,
      });
    }
    if (
      direction.x > 0 &&
      currentCell.col === payload.width - 1 &&
      x >= right.x - GRID_EPSILON
    ) {
      return Object.freeze({
        x: left.x,
        y: left.y,
        direction,
        bufferedDirection,
      });
    }
  }

  const moved = moveAxis(
    payload,
    rows,
    x,
    y,
    direction.x * distance,
    direction.y * distance,
    PLAYER_RADIUS,
  );
  if (moved.x === x && moved.y === y) {
    return Object.freeze({
      x: currentCentre.x,
      y: currentCentre.y,
      direction: null,
      bufferedDirection,
    });
  }
  return Object.freeze({
    ...moved,
    direction,
    bufferedDirection,
  });
}

function canTurnAtCentre(
  rows: readonly string[],
  cell: QuantmanCell,
  centre: Readonly<{ x: number; y: number }>,
  x: number,
  y: number,
  active: QuantmanDirection | null,
  requested: QuantmanDirection,
  distance: number,
): boolean {
  if (!directionIsWalkable(rows, cell, requested)) return false;
  if (!active) {
    return (
      Math.abs(x - centre.x) <= distance + GRID_EPSILON &&
      Math.abs(y - centre.y) <= distance + GRID_EPSILON
    );
  }
  const distanceToCentre =
    (centre.x - x) * active.x + (centre.y - y) * active.y;
  return (
    distanceToCentre >= -GRID_EPSILON &&
    distanceToCentre <= distance + GRID_EPSILON
  );
}

function directionIsWalkable(
  rows: readonly string[],
  cell: QuantmanCell,
  direction: QuantmanDirection,
): boolean {
  const row = cell.row + direction.y;
  const col = cell.col + direction.x;
  if (rows[row]?.[col] === ".") return true;
  if (direction.y !== 0 || rows[cell.row]?.[cell.col] !== ".") return false;
  const lastCol = (rows[cell.row]?.length ?? 0) - 1;
  return (
    (col < 0 || col > lastCol) &&
    rows[cell.row]?.[0] === "." &&
    rows[cell.row]?.[lastCol] === "."
  );
}

function frightenedStep(
  rows: readonly string[],
  start: QuantmanCell,
  player: QuantmanCell,
  seed: number,
): QuantmanCell {
  const options = walkableNeighbours(rows, start);
  if (options.length === 0) return Object.freeze({ ...start });
  const ordered = [...options].sort((left, right) => {
    const leftDistance =
      Math.abs(left.row - player.row) + Math.abs(left.col - player.col);
    const rightDistance =
      Math.abs(right.row - player.row) + Math.abs(right.col - player.col);
    return (
      rightDistance - leftDistance ||
      ((left.row * 31 + left.col + seed) >>> 0) -
        ((right.row * 31 + right.col + seed) >>> 0)
    );
  });
  return Object.freeze({ ...(ordered[0] ?? start) });
}

function walkableNeighbours(
  rows: readonly string[],
  cell: QuantmanCell,
): readonly QuantmanCell[] {
  const width = rows[cell.row]?.length ?? 0;
  const candidates: QuantmanCell[] = [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ];
  if (cell.col === 0 && rows[cell.row]?.[width - 1] === ".") {
    candidates.push({ row: cell.row, col: width - 1 });
  }
  if (cell.col === width - 1 && rows[cell.row]?.[0] === ".") {
    candidates.push({ row: cell.row, col: 0 });
  }
  return candidates.filter((next) => rows[next.row]?.[next.col] === ".");
}

function sameDirection(
  left: QuantmanDirection,
  right: QuantmanDirection,
): boolean {
  return left.x === right.x && left.y === right.y;
}

function oppositeDirections(
  left: QuantmanDirection,
  right: QuantmanDirection,
): boolean {
  return left.x === -right.x && left.y === -right.y;
}

function pursuerCanSeePlayer(
  rows: readonly string[],
  pursuer: RuntimePursuer,
  ownCell: QuantmanCell,
  playerCell: QuantmanCell,
): boolean {
  const radius = pursuer.definition.basePerceptionTiles;
  const distance = Math.hypot(
    ownCell.row - playerCell.row,
    ownCell.col - playerCell.col,
  );
  if (distance > radius) return false;
  return true;
}

function moveAxis(
  payload: QuantmanPackPayload,
  rows: readonly string[],
  x: number,
  y: number,
  deltaX: number,
  deltaY: number,
  radius: number,
): Readonly<{ x: number; y: number }> {
  const nextX = x + deltaX;
  const nextY = y + deltaY;
  return collidesWithWall(payload, rows, nextX, nextY, radius)
    ? { x, y }
    : { x: nextX, y: nextY };
}

function sameCell(left: QuantmanCell, right: QuantmanCell): boolean {
  return left.row === right.row && left.col === right.col;
}

function collidesWithWall(
  payload: QuantmanPackPayload,
  rows: readonly string[],
  x: number,
  y: number,
  radius: number,
): boolean {
  const minimumCol = Math.floor(
    (x - radius - payload.originX) / payload.tileSize,
  );
  const maximumCol = Math.floor(
    (x + radius - payload.originX) / payload.tileSize,
  );
  const minimumRow = Math.floor(
    (y - radius - payload.originY) / payload.tileSize,
  );
  const maximumRow = Math.floor(
    (y + radius - payload.originY) / payload.tileSize,
  );
  for (let row = minimumRow; row <= maximumRow; row += 1) {
    for (let col = minimumCol; col <= maximumCol; col += 1) {
      if (rows[row]?.[col] === ".") continue;
      const left = payload.originX + col * payload.tileSize;
      const top = payload.originY + row * payload.tileSize;
      const closestX = clamp(x, left, left + payload.tileSize);
      const closestY = clamp(y, top, top + payload.tileSize);
      if (Math.hypot(x - closestX, y - closestY) < radius) return true;
    }
  }
  return false;
}

export function cellCentre(
  payload: QuantmanPackPayload,
  cell: QuantmanCell,
): Readonly<{ x: number; y: number }> {
  return Object.freeze({
    x: payload.originX + (cell.col + 0.5) * payload.tileSize,
    y: payload.originY + (cell.row + 0.5) * payload.tileSize,
  });
}

export function pointCell(
  payload: QuantmanPackPayload,
  x: number,
  y: number,
): QuantmanCell {
  return Object.freeze({
    row: clampInteger(
      Math.round((y - payload.originY) / payload.tileSize - 0.5),
      0,
      payload.height - 1,
    ),
    col: clampInteger(
      Math.round((x - payload.originX) / payload.tileSize - 0.5),
      0,
      payload.width - 1,
    ),
  });
}

function actorSnapshot(actor: RuntimeActor): QuantmanActorSnapshot {
  return Object.freeze({
    x: actor.x,
    y: actor.y,
    facingX: actor.facingX,
    facingY: actor.facingY,
  });
}

function pursuerSnapshot(pursuer: RuntimePursuer): QuantmanPursuerSnapshot {
  return Object.freeze({
    pursuerId: pursuer.definition.pursuerId,
    role: pursuer.definition.role,
    tone: pursuer.definition.tone,
    mode: pursuer.mode,
    respawnTicks: pursuer.respawnTicks,
    ...actorSnapshot(pursuer),
  });
}

function axisSign(value: number): -1 | 0 | 1 {
  return value < -0.01 ? -1 : value > 0.01 ? 1 : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
