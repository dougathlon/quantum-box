import { describe, expect, it } from "vitest";

import {
  BROWN_BOX_FIELD_LOOP_DURATION_MS,
  BROWN_BOX_FIELD_PROVENANCE,
  BROWN_BOX_FIELD_STATES,
  resolveBrownBoxFieldFrame,
  resolveBrownBoxFieldFrameAtEpoch,
  updateBrownBoxFieldStateDataset,
} from "../../src/display/BrownBoxField";
import {
  BROWN_BOX_BACKGROUND_PROGRAMME_IDS,
  DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME_ID,
  requireBrownBoxBackgroundProgramme,
} from "../../src/display/backgrounds/BrownBoxBackgroundPrograms";

describe("Brown Box four-state field", () => {
  it("pins four authentic two-colour endpoints and the 22.8 second contract", () => {
    expect(BROWN_BOX_FIELD_STATES).toHaveLength(4);
    expect(BROWN_BOX_FIELD_STATES.map((state) => state.sha256)).toEqual([
      "42b8e24696a46d41695712d97bb49b1ad74befce1d4d6a07c54dc2f2c98be3f1",
      "91d9812d112acfccb0d1a67cc555f5bfa1ed806d346bcf33826d1db6f0b1923f",
      "56ed4dac2452e16257ca4c651a6215b54270663a1420ec89f931d748365d288b",
      "f7bfc20072e604e6a67737fbcf7d9579d4f973fc984e99a122bcd4cd714bfb33",
    ]);
    expect(BROWN_BOX_FIELD_PROVENANCE.palette).toEqual(["#2B1C14", "#564330"]);
    expect(BROWN_BOX_FIELD_LOOP_DURATION_MS).toBe(22_800);
  });

  it("holds, then replaces each endpoint left-to-right without a line", () => {
    expect(resolveBrownBoxFieldFrame(0)).toMatchObject({
      currentStateIndex: 0,
      followingStateIndex: 1,
      replacementBoundaryX: 0,
    });
    expect(resolveBrownBoxFieldFrame(700).replacementBoundaryX).toBe(0);
    expect(resolveBrownBoxFieldFrame(800).replacementBoundaryX).toBe(0);
    expect(resolveBrownBoxFieldFrame(3_200).replacementBoundaryX).toBe(160);
    expect(resolveBrownBoxFieldFrame(5_600).replacementBoundaryX).toBe(320);
    expect(resolveBrownBoxFieldFrame(5_700)).toMatchObject({
      currentStateIndex: 1,
      followingStateIndex: 2,
      replacementBoundaryX: 0,
    });
    expect(BROWN_BOX_FIELD_PROVENANCE.transition).toEqual({
      direction: "left-to-right",
      boundaryLine: "none",
      interpolation: "none",
    });
  });

  it("loops exactly and accepts negative presentation time", () => {
    expect(resolveBrownBoxFieldFrame(BROWN_BOX_FIELD_LOOP_DURATION_MS)).toEqual(
      resolveBrownBoxFieldFrame(0),
    );
    expect(resolveBrownBoxFieldFrame(-100)).toMatchObject({
      loopTick: 227,
      currentStateIndex: 3,
      followingStateIndex: 0,
      replacementBoundaryX: 320,
    });
    expect(() => resolveBrownBoxFieldFrame(Number.NaN)).toThrow(/finite/);
  });

  it("resolves every loop tick to the exact four-phase hard-crop schedule", () => {
    const expectedSweep = Array.from({ length: 49 }, (_, step) =>
      Math.round((step * 320) / 48),
    );
    const frames = Array.from({ length: 228 }, (_, loopTick) =>
      resolveBrownBoxFieldFrame(loopTick * 100),
    );

    expect(frames.map((frame) => frame.loopTick)).toEqual(
      Array.from({ length: 228 }, (_, loopTick) => loopTick),
    );
    for (let stateIndex = 0; stateIndex < 4; stateIndex += 1) {
      const phase = frames.slice(stateIndex * 57, (stateIndex + 1) * 57);
      expect(phase.map((frame) => frame.currentStateIndex)).toEqual(
        Array.from({ length: 57 }, () => stateIndex),
      );
      expect(phase.map((frame) => frame.followingStateIndex)).toEqual(
        Array.from({ length: 57 }, () => (stateIndex + 1) % 4),
      );
      expect(
        phase.slice(0, 8).map((frame) => frame.replacementBoundaryX),
      ).toEqual(Array.from({ length: 8 }, () => 0));
      expect(phase.slice(8).map((frame) => frame.replacementBoundaryX)).toEqual(
        expectedSweep,
      );
    }
  });
});

describe("selectable Brown Box background schedules", () => {
  it("pins the six programmes and retains the current programme as the default", () => {
    expect(BROWN_BOX_BACKGROUND_PROGRAMME_IDS).toEqual([
      "current-four-state-v1",
      "adaptive-direct-v1",
      "adaptive-restrained-v1",
      "adaptive-stronger-v1",
      "amplified-four-state-v1",
      "seeded-sixteen-state-v1",
    ]);
    expect(DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME_ID).toBe(
      "current-four-state-v1",
    );
  });

  it("uses the recorded short adaptive hard sweep without interpolation", () => {
    const programme = requireBrownBoxBackgroundProgramme("adaptive-direct-v1");

    expect(programme.states).toHaveLength(24);
    expect(programme.timing).toEqual({
      frameDurationMs: 120,
      holdFrameCount: 2,
      sweepStepCount: 6,
      sweepFrameCount: 6,
      firstSweepStep: 1,
      phaseFrameCount: 8,
      loopFrameCount: 192,
      loopDurationMs: 23_040,
    });
    expect(resolveBrownBoxFieldFrame(0, programme)).toMatchObject({
      loopTick: 0,
      currentStateIndex: 0,
      followingStateIndex: 1,
      replacementBoundaryX: 0,
    });
    expect(resolveBrownBoxFieldFrame(120, programme).replacementBoundaryX).toBe(
      0,
    );
    expect(resolveBrownBoxFieldFrame(240, programme).replacementBoundaryX).toBe(
      53,
    );
    expect(resolveBrownBoxFieldFrame(840, programme).replacementBoundaryX).toBe(
      320,
    );
    expect(resolveBrownBoxFieldFrame(960, programme)).toMatchObject({
      loopTick: 8,
      currentStateIndex: 1,
      followingStateIndex: 2,
      replacementBoundaryX: 0,
    });
    expect(resolveBrownBoxFieldFrame(23_040, programme)).toEqual(
      resolveBrownBoxFieldFrame(0, programme),
    );
  });

  it("keeps the long sweep for amplified and seeded programmes", () => {
    const amplified = requireBrownBoxBackgroundProgramme(
      "amplified-four-state-v1",
    );
    const seeded = requireBrownBoxBackgroundProgramme(
      "seeded-sixteen-state-v1",
    );

    expect(amplified.states).toHaveLength(4);
    expect(amplified.timing.loopDurationMs).toBe(22_800);
    expect(seeded.states).toHaveLength(16);
    expect(seeded.timing.loopDurationMs).toBe(91_200);
    expect(seeded.timing).toMatchObject({
      frameDurationMs: 100,
      holdFrameCount: 8,
      sweepStepCount: 48,
      sweepFrameCount: 49,
      firstSweepStep: 0,
      phaseFrameCount: 57,
    });
    expect(resolveBrownBoxFieldFrame(5_600, seeded)).toMatchObject({
      currentStateIndex: 0,
      followingStateIndex: 1,
      replacementBoundaryX: 320,
    });
    expect(resolveBrownBoxFieldFrame(91_100, seeded)).toMatchObject({
      currentStateIndex: 15,
      followingStateIndex: 0,
      replacementBoundaryX: 320,
    });
    expect(resolveBrownBoxFieldFrame(91_200, seeded)).toEqual(
      resolveBrownBoxFieldFrame(0, seeded),
    );
  });

  it("uses the same adaptive schedule for each adaptive provenance lane", () => {
    const timings = [
      "adaptive-direct-v1",
      "adaptive-restrained-v1",
      "adaptive-stronger-v1",
    ].map(
      (programmeId) =>
        requireBrownBoxBackgroundProgramme(
          programmeId as
            | "adaptive-direct-v1"
            | "adaptive-restrained-v1"
            | "adaptive-stronger-v1",
        ).timing,
    );

    expect(timings[1]).toEqual(timings[0]);
    expect(timings[2]).toEqual(timings[0]);
  });

  it("resolves synchronized surfaces from one programme epoch even without layout", () => {
    const programme = requireBrownBoxBackgroundProgramme("adaptive-direct-v1");
    const startedAtMs = 4_000;
    const frameTimeMs = 5_080;
    const titleCanvas = { dataset: {} as DOMStringMap };
    const internalCanvas = { dataset: {} as DOMStringMap };
    const titleFrame = resolveBrownBoxFieldFrameAtEpoch(
      frameTimeMs,
      startedAtMs,
      false,
      programme,
    );
    const internalFrame = resolveBrownBoxFieldFrameAtEpoch(
      frameTimeMs,
      startedAtMs,
      false,
      programme,
    );

    updateBrownBoxFieldStateDataset(
      titleCanvas,
      programme,
      titleFrame,
      startedAtMs,
    );
    updateBrownBoxFieldStateDataset(
      internalCanvas,
      programme,
      internalFrame,
      startedAtMs,
    );

    expect(titleCanvas.dataset).toEqual(internalCanvas.dataset);
    expect(titleCanvas.dataset).toMatchObject({
      fieldProgramme: "adaptive-direct-v1",
      fieldEpoch: "4000",
      fieldTick: "9",
      fieldState: "state-2",
      fieldFollowingState: "state-3",
      fieldSourceBoundary: "0",
    });
  });

  it("freezes every selected programme at state one from the shared epoch", () => {
    const programme = requireBrownBoxBackgroundProgramme(
      "seeded-sixteen-state-v1",
    );

    expect(
      resolveBrownBoxFieldFrameAtEpoch(95_200, 4_000, true, programme),
    ).toEqual(resolveBrownBoxFieldFrame(0, programme));
  });
});
