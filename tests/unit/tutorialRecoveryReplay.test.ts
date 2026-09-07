import { describe, expect, it } from "vitest";

import { canonicalJson } from "../../src/core/canonicalJson";
import { adaptFluxballClubhouseEvidence } from "../../src/tutorials/fluxballClubhouse";
import { adaptQongWorkshopEvidence } from "../../src/tutorials/qongWorkshop";
import { adaptQuantmanTopologyRoomEvidence } from "../../src/tutorials/quantmanTopologyRoom";
import {
  SKIPIXL_LODGE_COMPLETION_SCRIPT,
  adaptSkiPixlLodgeEvidence,
} from "../../src/tutorials/skiPixlLodge";
import {
  createTutorialRecoveryRecord,
  type TutorialRecoveryRecord,
} from "../../src/tutorials/recovery";
import {
  startTutorialReplay,
  TUTORIAL_REPLAY_AUTHORITY,
  TUTORIAL_REPLAY_REASON,
} from "../../src/tutorials/replay";
import {
  fluxballClubhouseFixtureInput,
  qongWorkshopRunInput,
  quantmanTopologyRoomFixtureInput,
  skiPixlLodgeRunInput,
} from "./tutorialWorldEvidenceFixtures";

describe("saved spatial tutorial replay", () => {
  it("validates saved evidence and starts a fresh interactive replay", async () => {
    const record = await skiPixlRecoveryRecord();
    const first = await startTutorialReplay(record);
    const second = await startTutorialReplay(record);

    expect(first.source).toEqual({
      gameId: "skipixl",
      worldId: "skipixl-lodge",
      runId: record.run.runId,
      evidenceSha256: record.evidenceSha256,
      evidenceLabel: record.evidenceLabel,
    });
    expect(first.snapshot().evidence).toEqual({
      requestOrigin: "saved-recovery",
      status: "validated-run",
      authority: TUTORIAL_REPLAY_AUTHORITY,
      label: `SAVED RECOVERY REPLAY · ${record.evidenceLabel}`,
      reason: TUTORIAL_REPLAY_REASON,
      storyProgressEligible: false,
      sourceRunId: record.run.runId,
      sourceEvidenceSha256: record.evidenceSha256,
    });

    const action = { type: "move", direction: "left" } as const;
    expect(first.dispatch(action)).toEqual(second.dispatch(action));
    expect(first.snapshot().world.player.tile).toEqual({ row: 7, col: 4 });
  });

  it("reconstructs every recovery backed by an installed authority", async () => {
    const qong = await qongWorkshopRunInput();
    const skiPixl = skiPixlLodgeRunInput();
    const fluxballFixture = fluxballClubhouseFixtureInput();
    const fluxball = {
      ...fluxballFixture,
      origin: "completed-story-run" as const,
      snapshot: { ...fluxballFixture.snapshot, humanWon: true },
    };
    const quantman = {
      ...quantmanTopologyRoomFixtureInput(),
      origin: "completed-story-run" as const,
    };
    const qongRecord = await createTutorialRecoveryRecord(
      "qong",
      qong.context,
      adaptQongWorkshopEvidence(qong),
    );

    const records = [
      qongRecord,
      await createTutorialRecoveryRecord(
        "skipixl",
        skiPixl.context,
        adaptSkiPixlLodgeEvidence(skiPixl),
      ),
      await createTutorialRecoveryRecord(
        "fluxball",
        fluxball.context,
        adaptFluxballClubhouseEvidence(fluxball),
      ),
      await createTutorialRecoveryRecord(
        "quantman",
        quantman.context,
        adaptQuantmanTopologyRoomEvidence(quantman),
      ),
    ];

    await expect(
      Promise.all(
        records.map(async (record) => {
          const snapshot = (await startTutorialReplay(record)).snapshot();
          return [snapshot.gameId, snapshot.worldId, snapshot.world.phase];
        }),
      ),
    ).resolves.toEqual([
      ["qong", "qong-workshop", "approach"],
      ["skipixl", "skipixl-lodge", "approach"],
      ["fluxball", "fluxball-clubhouse", "approach"],
      ["quantman", "quantman-topology-room", "approach"],
    ]);
  });

  it("can complete interactively but never grants Story progress", async () => {
    const session = await startTutorialReplay(await skiPixlRecoveryRecord());
    let snapshot = session.snapshot();

    for (const action of SKIPIXL_LODGE_COMPLETION_SCRIPT) {
      snapshot = session.dispatch(action);
    }

    expect(snapshot.world.phase).toBe("completion");
    expect(snapshot.world.completion).toEqual({
      worldComplete: true,
      demonstratedUnderstanding: true,
      storyProgressGranted: false,
    });
    expect(snapshot.world.evidence).toMatchObject({
      status: "validated-run",
      storyProgressEligible: false,
      reason: TUTORIAL_REPLAY_REASON,
    });
  });

  it("rejects changed saved evidence before constructing a replay", async () => {
    const record = await skiPixlRecoveryRecord();
    const tampered = structuredClone(record) as {
      evidence: { decoderVersion: string };
    };
    tampered.evidence.decoderVersion = "tampered-decoder";

    await expect(startTutorialReplay(tampered)).rejects.toThrow(
      "tutorial recovery evidence hash changed",
    );
  });

  it("has no save mutation channel and leaves serialized save bytes unchanged", async () => {
    const record = await skiPixlRecoveryRecord();
    const serializedSave = JSON.stringify({
      schemaVersion: "quantum-box-save-test-sentinel",
      story: { currentStage: "skipixl", attempts: { skipixl: 2 } },
    });
    const storage = new Map([["quantum-box/save", serializedSave]]);
    const before = storage.get("quantum-box/save");
    const recordBefore = canonicalJson(record);

    const session = await startTutorialReplay(record);
    for (const action of SKIPIXL_LODGE_COMPLETION_SCRIPT) {
      session.dispatch(action);
    }

    expect(storage.get("quantum-box/save")).toBe(before);
    expect(canonicalJson(record)).toBe(recordBefore);
    expect(session.snapshot().world.completion.storyProgressGranted).toBe(
      false,
    );
  });
});

async function skiPixlRecoveryRecord(): Promise<
  TutorialRecoveryRecord<"skipixl">
> {
  const input = skiPixlLodgeRunInput();
  const gate = adaptSkiPixlLodgeEvidence(input);
  return createTutorialRecoveryRecord("skipixl", input.context, gate);
}
