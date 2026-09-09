import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatSkiPixlTime,
  skiPixlCanvasPrompt,
  skiPixlNotice,
} from "../../src/games/skipixl/presentation";
import type { SkiPixlSnapshot } from "../../src/games/skipixl/types";
import { skiPixlFrameForAngle } from "../../src/display/views/SkiPixlView";

describe("SkiPixl Atari-lineage sprite states", () => {
  it("maps all seven runtime angles to Candidate B manifest frames", () => {
    const angles = [-3, -2, -1, 0, 1, 2, 3] as const;
    expect(angles.map((angle) => skiPixlFrameForAngle(angle))).toEqual([
      "hard-left",
      "mid-left",
      "soft-left",
      "neutral",
      "soft-right",
      "mid-right",
      "hard-right",
    ]);

    const manifest = JSON.parse(
      readFileSync(
        "src/assets/canonical-runtime-assets-v2/manifests/shipped-runtime-handoff.json",
        "utf8",
      ),
    );
    const steering = manifest.runtimeFiles.find(
      (entry: { fileId: string }) =>
        entry.fileId === "skipixl-steering-seven-angle-strip",
    );
    expect(
      steering.frames.map(
        (frame: { runtimeAngle: number }) => frame.runtimeAngle,
      ),
    ).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  it("keeps the native timer and exact Designer-facing result prompts", () => {
    const complete = {
      phase: "complete",
      storyQualified: true,
    } as SkiPixlSnapshot;

    expect(formatSkiPixlTime(59.5)).toBe("0:59.50");
    expect(skiPixlCanvasPrompt(complete, false)).toBe("WELL DONE");
    expect(skiPixlNotice(complete, false)).toBe(
      "WELL DONE. LET ME SHOW YOU SOMETHING.",
    );
    expect(skiPixlNotice({ ...complete, storyQualified: false }, false)).toBe(
      "DESCENT COMPLETE. TIME LIMIT MISSED.",
    );
  });
});
