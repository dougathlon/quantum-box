import type { SeededRng } from "../core/Rng";
import { RoomGraph } from "./RoomGraph";
import type {
  CompiledTopology,
  EdgeConstraint,
  LabyrinthFixture,
  QuantmanQpuFixtureAuthority,
} from "./types";

export class EmptyCompatibleSubsetError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EmptyCompatibleSubsetError";
  }
}

export class TopologyBank {
  public readonly topologies: readonly CompiledTopology[];
  public readonly effectiveShots: number;
  public readonly returnedRecordCount: number;
  public readonly returnedWeight: number;
  public readonly admittedRecordCount: number;
  public readonly admittedWeight: number;

  public constructor(
    public readonly graph: RoomGraph,
    public readonly fixture: LabyrinthFixture,
    public readonly authority: QuantmanQpuFixtureAuthority | null = null,
  ) {
    if (fixture.width !== graph.width || fixture.height !== graph.height) {
      throw new Error("Fixture dimensions do not match the room graph.");
    }
    this.returnedRecordCount = fixture.records.length;
    this.returnedWeight = fixture.records.reduce(
      (sum, record) => sum + record.weight,
      0,
    );
    const indexedRecords = this.runtimeRecords(fixture, authority);
    this.admittedRecordCount = indexedRecords.length;
    this.admittedWeight = indexedRecords.reduce(
      (sum, entry) => sum + entry.record.weight,
      0,
    );
    const aggregated = new Map<
      string,
      { weight: number; bitstring: string; indices: number[] }
    >();
    indexedRecords.forEach(({ record, index }) => {
      const wallMask = graph.wallMask(record.bitstring);
      const existing = aggregated.get(wallMask);
      if (existing) {
        existing.weight += record.weight;
        existing.indices.push(index);
      } else {
        aggregated.set(wallMask, {
          weight: record.weight,
          bitstring: record.bitstring,
          indices: [index],
        });
      }
    });
    this.topologies = Object.freeze(
      [...aggregated.entries()].map(([wallMask, entry], index) =>
        Object.freeze({
          id: `topology-${index.toString().padStart(3, "0")}`,
          wallMask,
          representativeBitstring: entry.bitstring,
          weight: entry.weight,
          rawRecordIndices: Object.freeze([...entry.indices]),
        }),
      ),
    );
    this.effectiveShots = this.topologies.reduce(
      (sum, topology) => sum + topology.weight,
      0,
    );
  }

  private runtimeRecords(
    fixture: LabyrinthFixture,
    authority: QuantmanQpuFixtureAuthority | null,
  ) {
    if (fixture.provenance.sourceType !== "qpu") {
      return fixture.records.map((record, index) => ({ record, index }));
    }
    if (
      authority?.fixtureId !== fixture.fixtureId ||
      authority.fixtureContentSha256 !== fixture.contentSha256 ||
      !authority.admissibility.runtimeEligible
    ) {
      throw new Error(
        `Quantman QPU fixture ${fixture.fixtureId} has no matching runtime-admissible authority.`,
      );
    }
    return authority.admissibility.admittedRecordIndices.map((index) => {
      const record = fixture.records[index];
      if (!record) {
        throw new Error(
          `Quantman QPU fixture ${fixture.fixtureId} admits missing record ${index}.`,
        );
      }
      return { record, index };
    });
  }

  public compatible(
    constraints: readonly EdgeConstraint[],
  ): readonly CompiledTopology[] {
    return this.topologies.filter((topology) =>
      constraints.every(
        (constraint) =>
          (topology.wallMask[constraint.edgeIndex] === "1") === constraint.wall,
      ),
    );
  }

  public sampleCompatible(
    current: CompiledTopology,
    constraints: readonly EdgeConstraint[],
    rng: SeededRng,
  ): Readonly<{
    topology: CompiledTopology;
    compatible: readonly CompiledTopology[];
  }> {
    if (!matches(current, constraints)) {
      throw new EmptyCompatibleSubsetError(
        "Current topology does not witness its observation and crossing constraints.",
      );
    }
    return this.sampleConstrained(constraints, rng);
  }

  public sampleConstrained(
    constraints: readonly EdgeConstraint[],
    rng: SeededRng,
  ): Readonly<{
    topology: CompiledTopology;
    compatible: readonly CompiledTopology[];
  }> {
    const compatible = this.compatible(constraints);
    if (compatible.length === 0) {
      throw new EmptyCompatibleSubsetError(
        "No topology satisfies the requested edge constraints; retaining the current topology.",
      );
    }
    const totalWeight = compatible.reduce(
      (sum, topology) => sum + topology.weight,
      0,
    );
    let draw = rng.nextInt(totalWeight);
    for (const topology of compatible) {
      if (draw < topology.weight)
        return Object.freeze({ topology, compatible });
      draw -= topology.weight;
    }
    throw new Error("Integer weighted sampler exhausted its compatible bank.");
  }
}

export function matches(
  topology: CompiledTopology,
  constraints: readonly EdgeConstraint[],
): boolean {
  return constraints.every(
    (constraint) =>
      (topology.wallMask[constraint.edgeIndex] === "1") === constraint.wall,
  );
}
