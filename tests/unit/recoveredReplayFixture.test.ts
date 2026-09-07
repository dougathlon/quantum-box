import { describe, expect, it } from "vitest";

import { createTutorialRecoveryRecord } from "../../src/tutorials/recovery";
import { startTutorialReplay } from "../../src/tutorials/replay";
import { adaptSkiPixlLodgeEvidence } from "../../src/tutorials/skiPixlLodge";
import { skiPixlLodgeRunInput } from "./tutorialWorldEvidenceFixtures";

describe("saved replay E2E fixture", () => {
  it("uses a completed installed SkiPixl run without laundering development evidence", async () => {
    const input = skiPixlLodgeRunInput();
    const first = await createTutorialRecoveryRecord(
      "skipixl",
      input.context,
      adaptSkiPixlLodgeEvidence(input),
    );
    const second = await createTutorialRecoveryRecord(
      "skipixl",
      input.context,
      adaptSkiPixlLodgeEvidence(input),
    );

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toContain("development-fixture");
    expect(first).toMatchObject({
      gameId: "skipixl",
      evidenceOrigin: "completed-story-run",
      evidenceStatus: "validated-run",
      storyProgressEligible: true,
      run: {
        gameId: "skipixl",
        playMode: "story",
        storyStage: "skipixl",
        pack: { source: "moth-platform-qpu-capture" },
      },
    });

    const replay = await startTutorialReplay(first);
    expect(replay.snapshot().evidence).toMatchObject({
      requestOrigin: "saved-recovery",
      authority: "saved-recovery-replay",
      storyProgressEligible: false,
    });
  });
});
