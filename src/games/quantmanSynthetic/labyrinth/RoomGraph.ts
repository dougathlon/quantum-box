import {
  DIRECTION_VECTORS,
  type DirectionName,
  type RoomCoordinate,
  type RoomEdge,
} from "./types";

export class RoomGraph {
  public readonly roomCount: number;
  public readonly edges: readonly RoomEdge[];
  private readonly edgeByPair = new Map<string, RoomEdge>();

  public constructor(
    public readonly width: number,
    public readonly height: number,
  ) {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 2 ||
      height < 2
    ) {
      throw new Error("RoomGraph dimensions must be integers of at least two.");
    }
    this.roomCount = width * height;
    const edges: RoomEdge[] = [];
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const a = this.index({ row, col });
        if (col + 1 < width) {
          edges.push(
            this.makeEdge(edges.length, a, this.index({ row, col: col + 1 })),
          );
        }
        if (row + 1 < height) {
          edges.push(
            this.makeEdge(edges.length, a, this.index({ row: row + 1, col })),
          );
        }
      }
    }
    this.edges = Object.freeze(edges);
    for (const edge of edges)
      this.edgeByPair.set(pairKey(edge.a, edge.b), edge);
  }

  public index(room: RoomCoordinate): number {
    if (
      !Number.isInteger(room.row) ||
      !Number.isInteger(room.col) ||
      room.row < 0 ||
      room.row >= this.height ||
      room.col < 0 ||
      room.col >= this.width
    ) {
      throw new Error(
        `Room is outside ${this.width}×${this.height}: ${room.row},${room.col}.`,
      );
    }
    return room.row * this.width + room.col;
  }

  public coordinate(index: number): RoomCoordinate {
    if (!Number.isInteger(index) || index < 0 || index >= this.roomCount) {
      throw new Error(`Unknown room index: ${index}.`);
    }
    return Object.freeze({
      row: Math.floor(index / this.width),
      col: index % this.width,
    });
  }

  public neighbour(roomIndex: number, direction: DirectionName): number | null {
    const room = this.coordinate(roomIndex);
    const vector = DIRECTION_VECTORS[direction];
    const row = room.row + vector.row;
    const col = room.col + vector.col;
    return row < 0 || row >= this.height || col < 0 || col >= this.width
      ? null
      : this.index({ row, col });
  }

  public edgeBetween(a: number, b: number): RoomEdge | null {
    return this.edgeByPair.get(pairKey(a, b)) ?? null;
  }

  public wallMask(bitstring: string): string {
    if (bitstring.length !== this.roomCount || /[^01]/u.test(bitstring)) {
      throw new Error(`Expected a ${this.roomCount}-bit binary room state.`);
    }
    return this.edges
      .map((edge) => (bitstring[edge.a] === bitstring[edge.b] ? "0" : "1"))
      .join("");
  }

  public isWall(wallMask: string, edgeIndex: number): boolean {
    if (wallMask.length !== this.edges.length)
      throw new Error("Topology wall mask has the wrong edge count.");
    const value = wallMask[edgeIndex];
    if (value !== "0" && value !== "1")
      throw new Error(`Invalid wall bit at edge ${edgeIndex}.`);
    return value === "1";
  }

  public openNeighbours(
    roomIndex: number,
    wallMask: string,
  ): readonly number[] {
    return (Object.keys(DIRECTION_VECTORS) as DirectionName[])
      .map((direction) => this.neighbour(roomIndex, direction))
      .filter((candidate): candidate is number => candidate !== null)
      .filter((candidate) => {
        const edge = this.edgeBetween(roomIndex, candidate);
        return edge !== null && !this.isWall(wallMask, edge.index);
      });
  }

  private makeEdge(index: number, a: number, b: number): RoomEdge {
    const aCoordinate = this.coordinate(a);
    const bCoordinate = this.coordinate(b);
    return Object.freeze({
      index,
      id: `e${index.toString().padStart(3, "0")}:${a}-${b}`,
      a,
      b,
      aCoordinate,
      bCoordinate,
      midpointDoubled: Object.freeze({
        x: aCoordinate.col + bCoordinate.col,
        y: aCoordinate.row + bCoordinate.row,
      }),
    });
  }
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
