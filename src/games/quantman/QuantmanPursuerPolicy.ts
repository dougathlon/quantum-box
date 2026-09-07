import type {
  QuantmanCell,
  QuantmanPursuerDecision,
  QuantmanPursuerObservation,
  QuantmanPursuerRole,
} from "./types";

export class QuantmanPursuerPolicy {
  private lastSeenCell: QuantmanCell | null = null;
  private lastSeenTick = -1;
  private patrolIndex = 0;
  private decisionCount = 0;

  public constructor(
    private readonly pursuerId: string,
    private readonly policySeed: number,
    private readonly hesitationTicks: number,
    private readonly role: QuantmanPursuerRole = defaultRole(pursuerId),
  ) {}

  public decide(
    observation: QuantmanPursuerObservation,
  ): QuantmanPursuerDecision {
    if (observation.pursuerId !== this.pursuerId) {
      throw new Error("Quantman pursuer observation has the wrong identity.");
    }
    this.decisionCount += 1;
    if (observation.visiblePlayerCell) {
      this.lastSeenCell = observation.visiblePlayerCell;
      this.lastSeenTick = observation.tick;
    }

    const hesitationCycle = Math.max(17, this.hesitationTicks + 19);
    if (
      this.hesitationTicks > 0 &&
      (this.decisionCount + (this.policySeed & 15)) % hesitationCycle === 0
    ) {
      return freezeDecision({
        mode: "hesitate",
        nextCell: observation.ownCell,
        targetCell: observation.ownCell,
        playerVisible: observation.visiblePlayerCell !== null,
      });
    }

    const memoryTicks = this.pursuerId === "SEEKER" ? 210 : 120;
    const hasMemory =
      this.lastSeenCell !== null &&
      observation.tick - this.lastSeenTick <= memoryTicks;
    if (observation.visiblePlayerCell) {
      const target = chaseTarget(this.role, observation);
      return freezeDecision({
        mode: "chase",
        nextCell: firstPathStep(observation.rows, observation.ownCell, target),
        targetCell: target,
        playerVisible: true,
      });
    }
    if (hasMemory && this.lastSeenCell) {
      if (sameCell(observation.ownCell, this.lastSeenCell)) {
        this.lastSeenCell = null;
      } else {
        return freezeDecision({
          mode: "investigate",
          nextCell: firstPathStep(
            observation.rows,
            observation.ownCell,
            this.lastSeenCell,
          ),
          targetCell: this.lastSeenCell,
          playerVisible: false,
        });
      }
    }

    const patrolTarget = observation.patrol[this.patrolIndex];
    if (!patrolTarget) {
      throw new Error(`Quantman pursuer ${this.pursuerId} has no patrol.`);
    }
    if (sameCell(observation.ownCell, patrolTarget)) {
      this.patrolIndex = (this.patrolIndex + 1) % observation.patrol.length;
    }
    const nextTarget = observation.patrol[this.patrolIndex] ?? patrolTarget;
    return freezeDecision({
      mode: "patrol",
      nextCell: firstPathStep(
        observation.rows,
        observation.ownCell,
        nextTarget,
      ),
      targetCell: nextTarget,
      playerVisible: false,
    });
  }
}

export function firstPathStep(
  rows: readonly string[],
  start: QuantmanCell,
  target: QuantmanCell,
): QuantmanCell {
  if (sameCell(start, target)) return Object.freeze({ ...start });
  const queue: QuantmanCell[] = [{ ...start }];
  const previous = new Map<string, QuantmanCell | null>([[key(start), null]]);
  let found = false;
  while (queue.length > 0 && !found) {
    const cell = queue.shift();
    if (!cell) continue;
    for (const next of neighbours(rows, cell)) {
      const nextKey = key(next);
      if (previous.has(nextKey)) continue;
      previous.set(nextKey, cell);
      if (sameCell(next, target)) {
        found = true;
        break;
      }
      queue.push(next);
    }
  }
  if (!found) return Object.freeze({ ...start });
  let cursor = { ...target };
  let parent = previous.get(key(cursor));
  while (parent && !sameCell(parent, start)) {
    cursor = parent;
    parent = previous.get(key(cursor));
  }
  return Object.freeze(cursor);
}

function chaseTarget(
  role: QuantmanPursuerRole,
  observation: QuantmanPursuerObservation,
): QuantmanCell {
  const player = observation.visiblePlayerCell;
  if (!player) return observation.ownCell;
  if (role === "direct") return player;
  if (role === "ambush") {
    return projectTarget(observation.rows, player, observation.playerFacing, 3);
  }
  if (role === "flank") {
    const flank = {
      x: observation.playerFacing.y,
      y: -observation.playerFacing.x,
    } as const;
    return projectTarget(observation.rows, player, flank, 2);
  }
  const distance =
    Math.abs(observation.ownCell.row - player.row) +
    Math.abs(observation.ownCell.col - player.col);
  if (distance > 7) return player;
  return (
    observation.patrol[(observation.tick >>> 5) % observation.patrol.length] ??
    player
  );
}

function projectTarget(
  rows: readonly string[],
  start: QuantmanCell,
  direction: Readonly<{ x: number; y: number }>,
  distance: number,
): QuantmanCell {
  let target = { ...start };
  for (let step = 0; step < distance; step += 1) {
    const candidate = {
      row: target.row + direction.y,
      col: target.col + direction.x,
    };
    if (rows[candidate.row]?.[candidate.col] !== ".") break;
    target = candidate;
  }
  return Object.freeze(target);
}

function neighbours(
  rows: readonly string[],
  cell: QuantmanCell,
): readonly QuantmanCell[] {
  const standard = (
    [
      { row: cell.row - 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col + 1 },
    ] as const
  ).filter((next) => rows[next.row]?.[next.col] === ".");
  const width = rows[cell.row]?.length ?? 0;
  if (cell.col === 0 && rows[cell.row]?.[width - 1] === ".") {
    standard.push({ row: cell.row, col: width - 1 });
  }
  if (cell.col === width - 1 && rows[cell.row]?.[0] === ".") {
    standard.push({ row: cell.row, col: 0 });
  }
  return standard;
}

function defaultRole(pursuerId: string): QuantmanPursuerRole {
  if (pursuerId === "VEIL") return "ambush";
  if (pursuerId === "MIRROR") return "flank";
  if (pursuerId === "DRIFTER") return "wander";
  return "direct";
}

function sameCell(left: QuantmanCell, right: QuantmanCell): boolean {
  return left.row === right.row && left.col === right.col;
}

function key(cell: QuantmanCell): string {
  return `${cell.row}:${cell.col}`;
}

function freezeDecision(
  decision: QuantmanPursuerDecision,
): QuantmanPursuerDecision {
  return Object.freeze({
    ...decision,
    nextCell: Object.freeze({ ...decision.nextCell }),
    targetCell: Object.freeze({ ...decision.targetCell }),
  });
}
