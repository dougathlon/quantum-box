import { describe, expect, it } from "vitest";
import { createRunContext } from "../../src/core/run";
import {
  QongInstalledAuthorityMismatchError,
  requireQongRecoveryReferenceInBankArtifact,
  selectQongStoryPack,
  validateQongStoryPackBank,
} from "../../src/games/qong/qongStoryPackBank";
import {
  SaveRepository,
  SAVE_STORAGE_KEY,
} from "../../src/save/SaveRepository";
import { createDefaultSave, validateSave } from "../../src/save/types";
import { createTutorialRecoveryRecord } from "../../src/tutorials/recovery";
import { createTestQongStoryBank } from "../fixtures/qongStoryBank";

async function savedRecovery() {
  const artifact = await createTestQongStoryBank();
  const selected = selectQongStoryPack(
    await validateQongStoryPackBank(artifact),
    { cursor: 0, cycle: 0 },
  );
  const pack = selected.pack,
    receipt = selected.receipt,
    job = pack.qpuProvenance.jobs[0]!;
  const run = createRunContext({
    gameId: "qong",
    storyStage: "qong",
    playMode: "story",
    rulesVersion: pack.rulesVersion,
    runSeed: 17,
    pack: {
      packId: pack.packId,
      contentSha256: pack.contentSha256,
      schemaVersion: pack.schemaVersion,
      source: pack.source,
    },
    packSelection: receipt,
  });
  const result = {
    rallyId: job.itemId,
    outcome: job.outcome,
    bit: job.outcome === "heads" ? 0 : 1,
    rule: job.outcome === "heads" ? "direct" : "invert",
    mothJobId: job.mothJobId,
    hardwareJobId: job.hardwareJobId,
    backendName: job.backendName,
    shots: job.shots,
    heads: job.heads,
    tails: job.tails,
  };
  const recovery = createTutorialRecoveryRecord("qong", run, {
    status: "validated-run",
    storyProgressEligible: true,
    reason: null,
    label: "VALIDATED MOTH COIN TOSS STORY RUN",
    value: {
      packId: pack.packId,
      result,
      selection: {
        bits: receipt.selectorBits,
        bitIndices: receipt.selectorBitIndices,
        selectedPackIndex: receipt.selectedPackIndex,
        selectedPackId: receipt.selectedPackId,
        selectorPackId: receipt.selectorPackId,
      },
    },
  });
  const base = createDefaultSave();
  const save = validateSave({
    ...base,
    settings: { ...base.settings, soundVolume: 0.37 },
    story: {
      ...base.story,
      attempts: { "skipixl-feasible": 7 },
      tutorialRecoveries: { qong: recovery },
      qongSelector: {
        cursor: receipt.selectorCursorAfter,
        cycle: receipt.selectorCycleAfter,
        recoveredSelection: receipt,
      },
    },
  });
  return { save, artifact, recovery };
}

describe("save authority failure classification", () => {
  it.each([
    "renamed explanatory wording",
    "",
    "translated authority diagnostic",
  ])("preserves unrelated data for typed mismatch: %s", async (message) => {
    const { save } = await savedRecovery();
    const values = new Map([[SAVE_STORAGE_KEY, JSON.stringify(save)]]);
    const removed: string[] = [];
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
      removeItem: (k: string) => {
        removed.push(k);
        values.delete(k);
      },
    } as Storage;
    const repo = new SaveRepository(storage, () => {
      throw new QongInstalledAuthorityMismatchError(message);
    });
    const loaded = JSON.parse(repo.exportJson());
    expect(loaded.settings.soundVolume).toBe(0.37);
    expect(loaded.story.attempts["skipixl-feasible"]).toBe(7);
    expect(loaded.story.tutorialRecoveries.qong).toBeUndefined();
    expect(loaded.story.currentNodeId).toBe("qong-intro");
    expect(removed).not.toContain(SAVE_STORAGE_KEY);
  });
  it("uses a typed mismatch at the bank boundary, while tampered evidence remains rejected", async () => {
    const { artifact, recovery } = await savedRecovery();
    const reference = {
      rulesVersion: "stale",
      pack: recovery.run.pack,
      packSelection: recovery.run.packSelection,
      firstResult: recovery.evidence.result,
    };
    expect(() =>
      requireQongRecoveryReferenceInBankArtifact(reference, artifact),
    ).toThrow(QongInstalledAuthorityMismatchError);
    expect(() =>
      requireQongRecoveryReferenceInBankArtifact(
        {
          ...reference,
          rulesVersion: recovery.run.rulesVersion,
          firstResult: {
            ...recovery.evidence.result,
            hardwareJobId: "tampered",
          },
        },
        artifact,
      ),
    ).toThrow();
  });
});

it("keeps saved progress when old bindings use newly reserved navigation keys", () => {
  const save = createDefaultSave();
  const restored = validateSave({
    ...save,
    settings: {
      ...save.settings,
      soundVolume: 0.37,
      keyboardBindings: {
        ...save.settings.keyboardBindings,
        A: { ...save.settings.keyboardBindings.A, action: "Backspace" },
      },
    },
    story: { ...save.story, attempts: { ...save.story.attempts, qong: 7 } },
  });
  expect(restored.settings.soundVolume).toBe(0.37);
  expect(restored.story.attempts.qong).toBe(7);
  expect(restored.settings.keyboardBindings.A.action).toBe("Space");
});
