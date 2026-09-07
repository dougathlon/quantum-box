import type { RunContext } from "./run";

export const REPLAY_SCHEMA_VERSION = "quantum-box-replay-v1";

export interface ReplayCompletion {
  readonly succeeded: boolean;
  readonly outcome: string;
}

export interface ReplayBundle<TInput = unknown, TFinalState = unknown> {
  readonly schemaVersion: typeof REPLAY_SCHEMA_VERSION;
  readonly run: RunContext;
  readonly completion: ReplayCompletion;
  readonly inputTape: readonly TInput[];
  readonly finalState: TFinalState;
}

export function createReplayBundle<TInput, TFinalState>(input: {
  readonly run: RunContext;
  readonly completion: ReplayCompletion;
  readonly inputTape: readonly TInput[];
  readonly finalState: TFinalState;
}): ReplayBundle<TInput, TFinalState> {
  assertJsonValue(input);
  return deepFreeze(
    cloneJson({
      schemaVersion: REPLAY_SCHEMA_VERSION,
      run: input.run,
      completion: input.completion,
      inputTape: input.inputTape,
      finalState: input.finalState,
    }),
  );
}

export function serializeReplayBundle(bundle: ReplayBundle): string {
  assertJsonValue(bundle);
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertJsonValue(value: unknown, path = "replay"): void {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} contains a non-finite number.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      assertJsonValue(child, `${path}[${index}]`),
    );
    return;
  }
  if (typeof value !== "object") {
    throw new Error(`${path} is not JSON serializable.`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) {
      throw new Error(`${path}.${key} is undefined.`);
    }
    assertJsonValue(child, `${path}.${key}`);
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
