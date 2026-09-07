import type { QongInput, QongSnapshot } from "./types";

export const QONG_STORY_MIN_DIRECTIONAL_RALLIES = 3;

export function qualifiesQongStory(
  snapshot: QongSnapshot,
  _recording: readonly QongInput[],
): boolean {
  return (
    snapshot.winner === "left" &&
    snapshot.storyEvidence.humanObservationsUsed >= 1 &&
    snapshot.storyEvidence.directionalRallyNumbers.length >=
      QONG_STORY_MIN_DIRECTIONAL_RALLIES
  );
}
