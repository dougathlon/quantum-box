import { describe, expect, it } from "vitest";

import {
  QONG_AUTHORIZED_PREFLIGHT_CONTENT_SHA256,
  selectQongStoryPack,
  validateQongStoryPackBank,
} from "../../src/games/qong/qongStoryPackBank";
import { QongDesignerLesson } from "../../src/story/QongDesignerLesson";
import { createTestQongStoryBank } from "../fixtures/qongStoryBank";

describe("Qong Designer lesson", () => {
  it("requires the full beginner interaction in order", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );
    const selection = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
    const lesson = new QongDesignerLesson(selection.pack, selection.receipt);

    expect(lesson.snapshot().stage).toBe("arrival");
    expect(() => lesson.dispatch("apply-hadamard")).toThrow(/cannot bypass/);
    lesson.dispatch("continue");
    lesson.dispatch("continue");
    lesson.dispatch("continue");
    expect(lesson.snapshot().stage).toBe("prepare");
    lesson.dispatch("prepare-zero");
    lesson.dispatch("apply-hadamard");
    lesson.dispatch("reveal-recorded-measurement");
    expect(lesson.snapshot().stage).toBe("map");
    lesson.dispatch("map-direct");
    expect(lesson.snapshot().stage).toBe("map");
    expect(lesson.snapshot().feedback).toMatch(/maps 1 \/ tails to OWN GOAL/);
    lesson.dispatch("map-invert");
    expect(lesson.snapshot().stage).toBe("pack");
    lesson.dispatch("assemble-rally-pack");
    lesson.dispatch("show-selector");
    expect(lesson.snapshot().stage).toBe("recovery");
  });

  it("binds the explanation to the actual played pack and its selection receipt", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );
    const selection = selectQongStoryPack(bank, { cursor: 2, cycle: 0 });
    const state = new QongDesignerLesson(
      selection.pack,
      selection.receipt,
    ).snapshot();

    expect(state.firstMeasurement.outcome).toBe("tails");
    expect(state.firstMeasurement.bit).toBe(1);
    expect(state.firstMeasurement.polarity).toBe("invert");
    expect(state.rallies).toHaveLength(7);
    expect(state.selection.bits).toEqual([0, 1]);
    expect(state.selection.selectedPackIndex).toBe(1);
    expect(state.provenance.activePlayNetwork).toBe("none");
    const provenance = selection.pack.qpuProvenance;
    if (provenance.adapterVersion !== "qong-coin-bank-adapter-v5") {
      throw new Error("Expected the current authorized Qong adapter.");
    }
    expect(provenance.postselection).toEqual({
      strategy: "first-four-tails-in-32-candidate-pool-v1",
      candidatePoolSize: 32,
      selectedCandidateItemId: "f004",
      selectedCandidateOrdinal: 3,
      selectedTailRank: 1,
      preflightContentSha256: QONG_AUTHORIZED_PREFLIGHT_CONTENT_SHA256,
      candidatePoolCaptureSetSha256: "f".repeat(64),
    });
    expect(state.provenance.firstRallyPostselection).toEqual(
      provenance.postselection,
    );
  });

  it("refuses mismatched pack and receipt evidence", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );
    const first = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
    const second = selectQongStoryPack(bank, { cursor: 2, cycle: 0 });

    expect(() => new QongDesignerLesson(second.pack, first.receipt)).toThrow(
      /does not match/,
    );
  });
});
