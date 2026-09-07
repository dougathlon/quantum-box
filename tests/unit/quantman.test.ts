import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { asUint32Seed } from "../../src/core/determinism";
import { createRunContext, type RunContext } from "../../src/core/run";
import { sha256CanonicalJsonSync } from "../../src/tutorials/recovery";
import { QuantmanPursuerPolicy } from "../../src/games/quantman/QuantmanPursuerPolicy";
import { quantmanLookTriggersShift } from "../../src/games/quantman/QuantmanRuntime";
import {
  cellCentre,
  pointCell,
  QuantmanSession,
} from "../../src/games/quantman/QuantmanSession";
import {
  initialQuantmanTopologyState,
  observeQuantmanTopology,
  quantmanDoorIsOpen,
} from "../../src/games/quantman/QuantmanTopology";
import {
  QUANTMAN_CONTROL_PACK,
  QUANTMAN_LABYRINTH_PREVIEW_BYTES_SHA256,
  QUANTMAN_MAZE_SOURCE_SHA256,
  validateQuantmanPayload,
} from "../../src/games/quantman/quantmanControlPack";
import type {
  QuantmanCell,
  QuantmanInput,
  QuantmanPackPayload,
  QuantmanSnapshot,
} from "../../src/games/quantman/types";

function context(
  seed = 23,
  playMode: "story" | "arcade" = "arcade",
): RunContext {
  return createRunContext({
    gameId: "quantman",
    playMode,
    storyStage: playMode === "story" ? "quantman" : null,
    rulesVersion: QUANTMAN_CONTROL_PACK.rulesVersion,
    runSeed: seed,
    pack: {
      packId: QUANTMAN_CONTROL_PACK.packId,
      contentSha256: QUANTMAN_CONTROL_PACK.contentSha256,
      schemaVersion: QUANTMAN_CONTROL_PACK.schemaVersion,
      source: QUANTMAN_CONTROL_PACK.source,
    },
  });
}

describe("Quantman committed maze", () => {
  it("turns a facing change into an automatic topology event", () => {
    expect(quantmanLookTriggersShift({ x: 1, y: 0 }, { x: 0, y: -1 })).toBe(
      true,
    );
    expect(quantmanLookTriggersShift({ x: 1, y: 0 }, { x: 1, y: 0 })).toBe(
      false,
    );
    expect(quantmanLookTriggersShift({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe(
      false,
    );
  });

  it("binds the maze and authentic Labyrinth preview to exact bytes", async () => {
    const mazeBytes = await readFile(
      new URL(
        "../../src/games/quantman/packs/archive-maze-v1.json",
        import.meta.url,
      ),
    );
    const labyrinthBytes = await readFile(
      new URL(
        "../../src/games/quantman/packs/moth-labyrinth-emu-4x5-preview-v1.json",
        import.meta.url,
      ),
    );
    expect(createHash("sha256").update(mazeBytes).digest("hex")).toBe(
      QUANTMAN_MAZE_SOURCE_SHA256,
    );
    expect(createHash("sha256").update(labyrinthBytes).digest("hex")).toBe(
      QUANTMAN_LABYRINTH_PREVIEW_BYTES_SHA256,
    );
  });

  it("rejects false provenance, invalid doors, and malformed states", () => {
    const falseProvenance = structuredClone(
      QUANTMAN_CONTROL_PACK.payload,
    ) as unknown as { labyrinthEnsemble: { acquisition: { qpu: boolean } } };
    falseProvenance.labyrinthEnsemble.acquisition.qpu = true;
    expect(() => validateQuantmanPayload(falseProvenance)).toThrow(
      /acquisition claim/,
    );

    const door = structuredClone(QUANTMAN_CONTROL_PACK.payload) as unknown as {
      topologyDoors: Array<{ row: number; col: number }>;
    };
    door.topologyDoors[0]!.row = 1;
    door.topologyDoors[0]!.col = 1;
    expect(() => validateQuantmanPayload(door)).toThrow(/replace a wall/);

    const state = structuredClone(QUANTMAN_CONTROL_PACK.payload) as unknown as {
      labyrinthEnsemble: { states: Array<{ bitstring: string }> };
    };
    state.labyrinthEnsemble.states[0]!.bitstring = "0";
    expect(() => validateQuantmanPayload(state)).toThrow(/twenty bits/);
  });

  it("keeps authentic Moth emulator provenance explicit", () => {
    expect(QUANTMAN_CONTROL_PACK.source).toBe("moth-api-emulator");
    expect(QUANTMAN_CONTROL_PACK.mothEvidence).toMatchObject({
      engineId: "labyrinth-v1",
      jobId: null,
      rawResultSha256:
        "c8425b2a974844283daabb8aec2de60d5397044bb3b5a756edb21e7f46406bc7",
      executionMode: "remote-simulator",
    });
    expect(QUANTMAN_CONTROL_PACK.payload.labyrinthEnsemble.states).toHaveLength(
      128,
    );
    expect(QUANTMAN_CONTROL_PACK.payload.topologyDoors).toHaveLength(12);
    expect(
      QUANTMAN_CONTROL_PACK.payload.labyrinthEnsemble.acquisition.qpu,
    ).toBe(false);
    expect(sha256CanonicalJsonSync(QUANTMAN_CONTROL_PACK.payload)).toBe(
      QUANTMAN_CONTROL_PACK.contentSha256,
    );
  });

  it("replays exactly from its semantic input tape", () => {
    const inputs = Array.from(
      { length: 1_500 },
      (_, tick): QuantmanInput => ({
        x: tick % 240 < 120 ? 1 : -1,
        y: tick % 300 < 150 ? -1 : 1,
        observe: tick % 180 === 0,
      }),
    );
    const first = new QuantmanSession(
      context(901),
      QUANTMAN_CONTROL_PACK.payload,
    );
    const second = new QuantmanSession(
      context(901),
      QUANTMAN_CONTROL_PACK.payload,
    );
    for (const input of inputs) {
      expect(second.step(input)).toEqual(first.step(input));
    }
  });

  it("turns observation into a deterministic material topology change", () => {
    const first = new QuantmanSession(
      context(8_104),
      QUANTMAN_CONTROL_PACK.payload,
    );
    const second = new QuantmanSession(
      context(8_104),
      QUANTMAN_CONTROL_PACK.payload,
    );
    const before = first.snapshot();
    const observedInput = { x: 0, y: 0, observe: true } as const;
    const after = first.step(observedInput);
    const replayed = second.step(observedInput);
    const changedCells = after.currentRows.reduce(
      (sum, row, rowIndex) =>
        sum +
        [...row].filter(
          (cell, colIndex) => cell !== before.currentRows[rowIndex]?.[colIndex],
        ).length,
      0,
    );

    expect(after).toEqual(replayed);
    expect(after.observationCount).toBe(1);
    expect(after.topologyStateId).not.toBe(before.topologyStateId);
    expect(after.lastTopologyChangeCount).toBeGreaterThanOrEqual(4);
    expect(changedCells).toBe(after.lastTopologyChangeCount);
    expect(after.latestEvent).toMatchObject({
      type: "TOPOLOGY_OBSERVED",
      detail: `${after.lastTopologyChangeCount} PASSAGES CHANGED`,
    });
    const transition = after.topologyTransitions[0];
    expect(transition).toBeDefined();
    expect(after.observedDoorIds).toContain(transition!.heldDoorId);
    expect(transition!.heldDoorOpen).toBe(
      quantmanDoorIsOpen(
        QUANTMAN_CONTROL_PACK.payload.labyrinthEnsemble.states.find(
          (state) => state.stateId === transition!.beforeStateId,
        )!,
        QUANTMAN_CONTROL_PACK.payload.topologyDoors.find(
          (door) => door.doorId === transition!.heldDoorId,
        )!,
      ),
    );
  });

  it("lets player position choose which door an observation preserves", () => {
    const payload = QUANTMAN_CONTROL_PACK.payload;
    const seed = asUint32Seed(8_104);
    const initial = initialQuantmanTopologyState(payload, seed);
    const transformations = payload.topologyDoors.map((door) => {
      const result = observeQuantmanTopology(
        payload,
        initial,
        door,
        new Set(),
        seed,
        0,
      );
      const beforeOpen = quantmanDoorIsOpen(initial, door);
      const afterOpen = quantmanDoorIsOpen(result.state, door);
      expect(result.observedDoorIds).toContain(door.doorId);
      expect(afterOpen).toBe(beforeOpen);
      return `${door.doorId}:${result.state.stateId}:${result.changedDoorIds.join(",")}`;
    });

    expect(new Set(transformations).size).toBeGreaterThan(1);
  });

  it("admits a deterministic public-maze path that can recover the channel", () => {
    const session = new QuantmanSession(
      context(4_811),
      QUANTMAN_CONTROL_PACK.payload,
    );
    let snapshot = session.snapshot();
    for (let tick = 0; tick < 7_200 && snapshot.phase === "active"; tick += 1) {
      snapshot = session.step(
        autopilotInput(QUANTMAN_CONTROL_PACK.payload, snapshot),
      );
    }
    expect(snapshot.phase, JSON.stringify(snapshot)).toBe("won");
    expect(snapshot.fragmentsCollected).toBeGreaterThanOrEqual(
      snapshot.requiredFragments,
    );
    expect(snapshot.lives).toBeGreaterThan(0);
  }, 30_000);

  it("does not qualify a Story win merely because a topology change occurred", () => {
    const base = QUANTMAN_CONTROL_PACK.payload;
    const payload: QuantmanPackPayload = {
      ...base,
      requiredFragments: 1,
      fragments: [
        Object.freeze({
          fragmentId: "start-pellet",
          row: base.playerStart.row,
          col: base.playerStart.col,
          kind: "pellet",
        }),
      ],
      pursuers: Object.freeze([]),
    };
    const snapshot = new QuantmanSession(context(4_811, "story"), payload).step(
      {
        x: 0,
        y: 0,
        observe: true,
      },
    );
    expect(snapshot.phase).toBe("won");
    expect(snapshot.observationCount).toBe(1);
    expect(snapshot.exploitedObservationIndices).toEqual([]);
    expect(snapshot.storyQualified).toBe(false);
  });
});

describe("Quantman pursuer information boundary", () => {
  it("bases decisions only on the public maze, visibility, and exit state", () => {
    const policy = new QuantmanPursuerPolicy("SEEKER", 17, 10);
    const observation = {
      tick: 120,
      pursuerId: "SEEKER",
      ownCell: { row: 3, col: 17 },
      visiblePlayerCell: null,
      playerFacing: { x: 1, y: 0 },
      exitCell: { row: 1, col: 17 },
      exitUnlocked: false,
      rows: QUANTMAN_CONTROL_PACK.payload.rows,
      patrol: QUANTMAN_CONTROL_PACK.payload.pursuers[0]!.patrol,
    } as const;
    const decision = policy.decide(observation);
    expect(decision.mode).toBe("patrol");
    expect(JSON.stringify(observation)).not.toMatch(
      /bitString|roomFields|syntheticState|future|result|Moth/,
    );
  });

  it("remains fallible through deterministic hesitation", () => {
    const policy = new QuantmanPursuerPolicy("SEEKER", 0, 10);
    let hesitations = 0;
    for (let index = 0; index < 80; index += 1) {
      const decision = policy.decide({
        tick: index * 12,
        pursuerId: "SEEKER",
        ownCell: { row: 3, col: 17 },
        visiblePlayerCell: { row: 3, col: 15 },
        playerFacing: { x: 1, y: 0 },
        exitCell: { row: 1, col: 17 },
        exitUnlocked: false,
        rows: QUANTMAN_CONTROL_PACK.payload.rows,
        patrol: QUANTMAN_CONTROL_PACK.payload.pursuers[0]!.patrol,
      });
      if (decision.mode === "hesitate") hesitations += 1;
    }
    expect(hesitations).toBeGreaterThan(0);
  });
});

function autopilotInput(
  payload: QuantmanPackPayload,
  snapshot: QuantmanSnapshot,
): QuantmanInput {
  const start = pointCell(payload, snapshot.player.x, snapshot.player.y);
  const pursuerCells = snapshot.pursuers.map((pursuer) =>
    pointCell(payload, pursuer.x, pursuer.y),
  );
  const blocked = new Set<string>();
  for (const pursuer of pursuerCells) {
    for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
      for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
        if (Math.abs(rowDelta) + Math.abs(colDelta) > 1) continue;
        blocked.add(`${pursuer.row + rowDelta}:${pursuer.col + colDelta}`);
      }
    }
  }
  blocked.delete(`${start.row}:${start.col}`);
  const remaining = payload.fragments.filter(
    (fragment) => !snapshot.collectedFragmentIds.includes(fragment.fragmentId),
  );
  const candidates = snapshot.exitUnlocked ? [payload.exit] : remaining;
  const paths = candidates
    .map((target) => path(payload.rows, start, target, blocked))
    .filter(
      (candidate): candidate is readonly QuantmanCell[] => candidate !== null,
    )
    .sort((left, right) => left.length - right.length);
  const route = paths[0] ?? safestStep(payload.rows, start, pursuerCells);
  const next = route[1] ?? route[0];
  if (!next) return { x: 0, y: 0, observe: false };
  const currentCentre = cellCentre(payload, start);
  const target = cellCentre(payload, next);
  const deltaX = target.x - snapshot.player.x;
  const deltaY = target.y - snapshot.player.y;
  if (
    next.col !== start.col &&
    Math.abs(currentCentre.y - snapshot.player.y) > 1.2
  ) {
    return {
      x: 0,
      y: currentCentre.y < snapshot.player.y ? -1 : 1,
      observe: false,
    };
  }
  if (
    next.row !== start.row &&
    Math.abs(currentCentre.x - snapshot.player.x) > 1.2
  ) {
    return {
      x: currentCentre.x < snapshot.player.x ? -1 : 1,
      y: 0,
      observe: false,
    };
  }
  if (Math.abs(deltaX) > 1.2) {
    return { x: deltaX < 0 ? -1 : 1, y: 0, observe: false };
  }
  if (Math.abs(deltaY) > 1.2) {
    return { x: 0, y: deltaY < 0 ? -1 : 1, observe: false };
  }
  return { x: 0, y: 0, observe: false };
}

function path(
  rows: readonly string[],
  start: QuantmanCell,
  target: QuantmanCell,
  blocked: ReadonlySet<string> = new Set(),
): readonly QuantmanCell[] | null {
  const key = (cell: QuantmanCell) => `${cell.row}:${cell.col}`;
  const queue: QuantmanCell[] = [start];
  const previous = new Map<string, QuantmanCell | null>([[key(start), null]]);
  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell) continue;
    if (key(cell) === key(target)) {
      const result: QuantmanCell[] = [];
      let cursor: QuantmanCell | null = cell;
      while (cursor) {
        result.unshift(cursor);
        cursor = previous.get(key(cursor)) ?? null;
      }
      return result;
    }
    for (const next of [
      { row: cell.row - 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col + 1 },
    ]) {
      if (
        rows[next.row]?.[next.col] !== "." ||
        blocked.has(key(next)) ||
        previous.has(key(next))
      )
        continue;
      previous.set(key(next), cell);
      queue.push(next);
    }
  }
  return null;
}

function safestStep(
  rows: readonly string[],
  start: QuantmanCell,
  pursuers: readonly QuantmanCell[],
): readonly QuantmanCell[] {
  const options = [
    start,
    { row: start.row - 1, col: start.col },
    { row: start.row, col: start.col - 1 },
    { row: start.row + 1, col: start.col },
    { row: start.row, col: start.col + 1 },
  ].filter((cell) => rows[cell.row]?.[cell.col] === ".");
  options.sort(
    (left, right) => safety(right, pursuers) - safety(left, pursuers),
  );
  return [start, options[0] ?? start];
}

function safety(cell: QuantmanCell, pursuers: readonly QuantmanCell[]): number {
  return Math.min(
    ...pursuers.map(
      (pursuer) =>
        Math.abs(cell.row - pursuer.row) + Math.abs(cell.col - pursuer.col),
    ),
  );
}
