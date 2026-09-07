export type StoryV2WalkDirection = "up" | "down" | "left" | "right";

export type StoryV2WalkRoomId =
  | "designer-den"
  | "cabin-office"
  | "fluxball-office"
  | "ghost-passage"
  | "final-workshop";

export interface StoryV2WalkPoint {
  readonly x: number;
  readonly y: number;
}

export interface StoryV2WalkFixture {
  readonly kind: "desk" | "shelf" | "table" | "machine" | "wall";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface StoryV2WalkRoom {
  readonly beatId: string;
  readonly roomId: StoryV2WalkRoomId;
  readonly label: string;
  readonly columns: 18;
  readonly rows: 8;
  readonly start: StoryV2WalkPoint;
  readonly destination: StoryV2WalkPoint;
  readonly designer: StoryV2WalkPoint;
  readonly destinationLabel: "COMPUTER" | "DESIGNER";
  readonly fixtures: readonly StoryV2WalkFixture[];
}

export interface StoryV2WalkSnapshot {
  readonly beatId: string;
  readonly room: StoryV2WalkRoom;
  readonly position: StoryV2WalkPoint;
  readonly facing: StoryV2WalkDirection;
  readonly stepSequence: number;
  readonly atDestination: boolean;
}

export interface StoryV2WalkStepResult {
  readonly moved: boolean;
  readonly snapshot: StoryV2WalkSnapshot;
}

const OFFICE_FIXTURES = deepFreeze([
  fixture("shelf", 2, 1, 4, 1),
  fixture("machine", 14, 1, 2, 1),
  fixture("desk", 12, 2, 5, 1),
  fixture("table", 7, 4, 3, 2),
]);

const WALK_ROOMS = deepFreeze({
  "qong-walk-to-den": room(
    "qong-walk-to-den",
    "designer-den",
    "THE DESIGNER'S DEN",
    { x: 2, y: 6 },
    { x: 14, y: 3 },
    { x: 10, y: 3 },
    "COMPUTER",
    OFFICE_FIXTURES,
  ),
  "skipixl-hard-enter-office": room(
    "skipixl-hard-enter-office",
    "cabin-office",
    "THE CABIN OFFICE",
    { x: 2, y: 6 },
    { x: 14, y: 3 },
    { x: 10, y: 3 },
    "COMPUTER",
    OFFICE_FIXTURES,
  ),
  "fluxball-four-enter-office": room(
    "fluxball-four-enter-office",
    "fluxball-office",
    "THE GRAPH ROOM",
    { x: 2, y: 6 },
    { x: 14, y: 3 },
    { x: 10, y: 3 },
    "COMPUTER",
    OFFICE_FIXTURES,
  ),
  "quantman-ghost-den-walk": room(
    "quantman-ghost-den-walk",
    "ghost-passage",
    "THE GHOST DEN",
    { x: 2, y: 6 },
    { x: 15, y: 1 },
    { x: 16, y: 1 },
    "DESIGNER",
    [
      fixture("wall", 4, 1, 1, 4),
      fixture("wall", 8, 3, 1, 4),
      fixture("wall", 12, 1, 1, 4),
      fixture("machine", 16, 0, 1, 1),
    ],
  ),
  "quarry-designer-walk-offscreen": room(
    "quarry-designer-walk-offscreen",
    "final-workshop",
    "THE FINAL WORKSHOP",
    { x: 2, y: 6 },
    { x: 13, y: 3 },
    { x: 14, y: 3 },
    "DESIGNER",
    [
      fixture("machine", 14, 1, 2, 1),
      fixture("desk", 12, 2, 5, 1),
      fixture("shelf", 2, 1, 5, 1),
      fixture("machine", 3, 4, 2, 2),
      fixture("table", 7, 5, 3, 1),
    ],
  ),
} as const satisfies Readonly<Record<string, StoryV2WalkRoom>>);

export const STORY_V2_WALK_BEAT_IDS = Object.freeze(Object.keys(WALK_ROOMS));

export function storyV2WalkRoom(beatId: string): StoryV2WalkRoom | null {
  return WALK_ROOMS[beatId as keyof typeof WALK_ROOMS] ?? null;
}

export class StoryV2WalkMachine {
  private readonly room: StoryV2WalkRoom;
  private position: StoryV2WalkPoint;
  private facing: StoryV2WalkDirection = "down";
  private stepSequence = 0;

  public constructor(beatId: string) {
    const room = storyV2WalkRoom(beatId);
    if (!room) throw new Error(`Story walk beat has no room: ${beatId}`);
    this.room = room;
    this.position = room.start;
  }

  public snapshot(): StoryV2WalkSnapshot {
    return deepFreeze({
      beatId: this.room.beatId,
      room: this.room,
      position: this.position,
      facing: this.facing,
      stepSequence: this.stepSequence,
      atDestination: samePoint(this.position, this.room.destination),
    });
  }

  public step(direction: StoryV2WalkDirection): StoryV2WalkStepResult {
    this.facing = direction;
    const delta = directionDelta(direction);
    const candidate = Object.freeze({
      x: this.position.x + delta.x,
      y: this.position.y + delta.y,
    });
    const moved = this.canOccupy(candidate);
    if (moved) {
      this.position = candidate;
      this.stepSequence += 1;
    }
    return deepFreeze({ moved, snapshot: this.snapshot() });
  }

  public canContinue(): boolean {
    return samePoint(this.position, this.room.destination);
  }

  private canOccupy(point: StoryV2WalkPoint): boolean {
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x >= this.room.columns ||
      point.y >= this.room.rows ||
      samePoint(point, this.room.designer)
    ) {
      return false;
    }
    return !this.room.fixtures.some(
      (candidate) =>
        point.x >= candidate.x &&
        point.x < candidate.x + candidate.width &&
        point.y >= candidate.y &&
        point.y < candidate.y + candidate.height,
    );
  }
}

function room(
  beatId: string,
  roomId: StoryV2WalkRoomId,
  label: string,
  start: StoryV2WalkPoint,
  destination: StoryV2WalkPoint,
  designer: StoryV2WalkPoint,
  destinationLabel: StoryV2WalkRoom["destinationLabel"],
  fixtures: readonly StoryV2WalkFixture[],
): StoryV2WalkRoom {
  return {
    beatId,
    roomId,
    label,
    columns: 18,
    rows: 8,
    start,
    destination,
    designer,
    destinationLabel,
    fixtures,
  };
}

function fixture(
  kind: StoryV2WalkFixture["kind"],
  x: number,
  y: number,
  width: number,
  height: number,
): StoryV2WalkFixture {
  return Object.freeze({ kind, x, y, width, height });
}

function directionDelta(direction: StoryV2WalkDirection): StoryV2WalkPoint {
  switch (direction) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
  }
}

function samePoint(a: StoryV2WalkPoint, b: StoryV2WalkPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
