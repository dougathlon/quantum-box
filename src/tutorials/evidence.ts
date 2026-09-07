import type { RunContext } from "../core/run";
import {
  developmentTutorialEvidence,
  unavailableTutorialEvidence,
  validatedTutorialEvidence,
  type TutorialEvidenceGate,
  type TutorialWorldId,
} from "./contracts";

export type TutorialEvidenceOrigin =
  | "completed-story-run"
  | "development-fixture";

export interface TutorialAdapterBaseInput {
  readonly origin: TutorialEvidenceOrigin;
  readonly context: RunContext;
}

export function adaptTutorialEvidence<T>(
  worldId: TutorialWorldId,
  input: TutorialAdapterBaseInput | null,
  validatedLabel: string,
  build: () => T,
): TutorialEvidenceGate<T> {
  if (input === null) {
    return unavailableTutorialEvidence(
      `${worldId} requires a completed, qualified Story run.`,
    );
  }
  try {
    const value = build();
    return input.origin === "development-fixture"
      ? developmentTutorialEvidence(value)
      : validatedTutorialEvidence(validatedLabel, value);
  } catch (error) {
    return unavailableTutorialEvidence(errorMessage(error));
  }
}

export function requireStoryRunContext(
  context: RunContext,
  gameId: "qong" | "skipixl" | "fluxball" | "quantman",
  packId: string,
  contentSha256: string,
): void {
  if (
    context.gameId !== gameId ||
    context.playMode !== "story" ||
    context.storyStage === null
  ) {
    throw new Error(`${gameId} tutorial evidence requires a Story run.`);
  }
  if (
    context.pack.packId !== packId ||
    context.pack.contentSha256 !== contentSha256
  ) {
    throw new Error(`${gameId} tutorial evidence does not match the run pack.`);
  }
  if (!SHA256_PATTERN.test(contentSha256)) {
    throw new Error(`${gameId} tutorial evidence has an invalid pack hash.`);
  }
}

export function requireNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} is missing.`);
}

export function requireSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${label} is invalid.`);
}

export function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} is not finite.`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
