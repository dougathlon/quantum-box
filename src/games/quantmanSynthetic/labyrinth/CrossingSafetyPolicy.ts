import type { EdgeConstraint } from "./types";

export interface ActiveCrossing {
  readonly edgeIndex: number;
  readonly requiresOpenHold: boolean;
}

export function crossingSafetyConstraints(
  currentWallMask: string,
  crossings: readonly ActiveCrossing[],
): readonly EdgeConstraint[] {
  const held = new Set<number>();
  for (const crossing of crossings) {
    if (!crossing.requiresOpenHold) continue;
    if (currentWallMask[crossing.edgeIndex] !== "0") {
      throw new Error(
        `Crossing safety hold ${crossing.edgeIndex} is not open in the current topology.`,
      );
    }
    held.add(crossing.edgeIndex);
  }
  return Object.freeze(
    [...held]
      .sort((a, b) => a - b)
      .map((edgeIndex) => Object.freeze({ edgeIndex, wall: false })),
  );
}

export function mergeConstraints(
  observation: readonly EdgeConstraint[],
  crossing: readonly EdgeConstraint[],
): readonly EdgeConstraint[] {
  const constraints = new Map<number, boolean>();
  for (const constraint of [...observation, ...crossing]) {
    const existing = constraints.get(constraint.edgeIndex);
    if (existing !== undefined && existing !== constraint.wall) {
      throw new Error(
        `Contradictory constraint for edge ${constraint.edgeIndex}.`,
      );
    }
    constraints.set(constraint.edgeIndex, constraint.wall);
  }
  return Object.freeze(
    [...constraints.entries()]
      .sort(([left], [right]) => left - right)
      .map(([edgeIndex, wall]) => Object.freeze({ edgeIndex, wall })),
  );
}
