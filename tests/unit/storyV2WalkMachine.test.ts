import { describe, expect, it } from "vitest";

import {
  STORY_V2_WALK_BEAT_IDS,
  StoryV2WalkMachine,
  storyV2WalkRoom,
  type StoryV2WalkDirection,
  type StoryV2WalkPoint,
  type StoryV2WalkRoom,
} from "../../src/story/v2";

describe("Story v2 top-down room traversal", () => {
  it("gives every authored exploration beat a reachable interaction tile", () => {
    expect(STORY_V2_WALK_BEAT_IDS).toHaveLength(5);
    for (const beatId of STORY_V2_WALK_BEAT_IDS) {
      const room = storyV2WalkRoom(beatId);
      expect(room, beatId).not.toBeNull();
      const path = findPath(room!);
      expect(path.length, beatId).toBeGreaterThan(0);

      const machine = new StoryV2WalkMachine(beatId);
      expect(machine.canContinue(), beatId).toBe(false);
      for (const direction of path) {
        expect(machine.step(direction).moved, beatId).toBe(true);
      }
      const snapshot = machine.snapshot();
      expect(snapshot.position, beatId).toEqual(room!.destination);
      expect(snapshot.atDestination, beatId).toBe(true);
      expect(machine.canContinue(), beatId).toBe(true);
      expect(Object.isFrozen(snapshot), beatId).toBe(true);
      expect(Object.isFrozen(snapshot.position), beatId).toBe(true);
      expect(Object.isFrozen(snapshot.room.fixtures), beatId).toBe(true);
    }
  });

  it("routes office scenes to a computer instead of an invisible Designer trigger", () => {
    for (const beatId of [
      "qong-walk-to-den",
      "skipixl-hard-enter-office",
      "fluxball-four-enter-office",
    ]) {
      expect(storyV2WalkRoom(beatId)?.destinationLabel).toBe("COMPUTER");
    }
  });

  it("keeps collision authoritative while still turning toward a blocked step", () => {
    const machine = new StoryV2WalkMachine("qong-walk-to-den");
    expect(machine.step("left").moved).toBe(true);
    expect(machine.step("left").moved).toBe(true);
    const blocked = machine.step("left");
    expect(blocked.moved).toBe(false);
    expect(blocked.snapshot.position).toEqual({ x: 0, y: 6 });
    expect(blocked.snapshot.facing).toBe("left");
    expect(blocked.snapshot.stepSequence).toBe(2);
  });

  it("rejects a beat that has no authored room", () => {
    expect(() => new StoryV2WalkMachine("invented-beat")).toThrow(
      "has no room",
    );
  });
});

function findPath(room: StoryV2WalkRoom): readonly StoryV2WalkDirection[] {
  const directions = [
    ["up", 0, -1],
    ["left", -1, 0],
    ["down", 0, 1],
    ["right", 1, 0],
  ] as const;
  const queue: Array<{
    readonly point: StoryV2WalkPoint;
    readonly path: readonly StoryV2WalkDirection[];
  }> = [{ point: room.start, path: [] }];
  const visited = new Set([key(room.start)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (key(current.point) === key(room.destination)) return current.path;
    for (const [direction, dx, dy] of directions) {
      const point = { x: current.point.x + dx, y: current.point.y + dy };
      if (!canOccupy(room, point) || visited.has(key(point))) continue;
      visited.add(key(point));
      queue.push({ point, path: [...current.path, direction] });
    }
  }
  return [];
}

function canOccupy(room: StoryV2WalkRoom, point: StoryV2WalkPoint): boolean {
  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x >= room.columns ||
    point.y >= room.rows ||
    key(point) === key(room.designer)
  ) {
    return false;
  }
  return !room.fixtures.some(
    (fixture) =>
      point.x >= fixture.x &&
      point.x < fixture.x + fixture.width &&
      point.y >= fixture.y &&
      point.y < fixture.y + fixture.height,
  );
}

function key(point: StoryV2WalkPoint): string {
  return `${point.x},${point.y}`;
}
