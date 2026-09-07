import type { LabyrinthFixture } from "../labyrinth/types";
import { QuantmanSession } from "../game/QuantmanSession";
import type {
  MazeMechanic,
  SemanticInput,
  SessionSnapshot,
} from "../game/types";

export interface ReplayTape {
  readonly schemaVersion: "quantman-replay-v2";
  readonly runSeed: number;
  readonly mechanic: MazeMechanic;
  readonly fixtureId: string;
  readonly fixtureSha256: string;
  readonly inputs: readonly SemanticInput[];
}

export class ReplayRecorder {
  private readonly inputs: SemanticInput[] = [];

  public constructor(
    private readonly fixture: LabyrinthFixture,
    private readonly runSeed: number,
    private readonly mechanic: MazeMechanic = "stabilize-gaze",
  ) {}

  public record(input: SemanticInput): void {
    this.inputs.push(Object.freeze({ ...input }));
  }

  public tape(): ReplayTape {
    return deepFreeze({
      schemaVersion: "quantman-replay-v2",
      runSeed: this.runSeed,
      mechanic: this.mechanic,
      fixtureId: this.fixture.fixtureId,
      fixtureSha256: this.fixture.contentSha256,
      inputs: this.inputs.map((input) => ({ ...input })),
    });
  }
}

export function runReplay(
  fixture: LabyrinthFixture,
  tape: ReplayTape,
): SessionSnapshot {
  if (
    tape.schemaVersion !== "quantman-replay-v2" ||
    tape.fixtureId !== fixture.fixtureId ||
    tape.fixtureSha256 !== fixture.contentSha256
  ) {
    throw new Error(
      "Replay fixture identity does not match the loaded Labyrinth bank.",
    );
  }
  const session = new QuantmanSession(fixture, tape.runSeed, {
    mechanic: tape.mechanic,
  });
  for (const input of tape.inputs) session.step(input);
  return session.snapshot();
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
  }
  return value;
}
