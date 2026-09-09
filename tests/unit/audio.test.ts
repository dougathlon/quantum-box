import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BACKGROUND_CUE_PROFILES,
  backgroundCueProfile,
  normalizeSoundVolume,
  skiCarveProfile,
  synthCueProfile,
} from "../../src/audio/SynthAudio";

describe("Quantum Box synth audio", () => {
  it("bounds presentation gain without creating simulation state", () => {
    expect(normalizeSoundVolume(-1)).toBe(0);
    expect(normalizeSoundVolume(0.4)).toBe(0.4);
    expect(normalizeSoundVolume(2)).toBe(1);
    expect(normalizeSoundVolume(Number.NaN)).toBe(0.35);
  });

  it.each(["ski-tree-impact", "ski-mogul-impact"] as const)(
    "keeps %s short and discrete",
    (cue) => {
      const profile = synthCueProfile(cue);

      expect(profile.length).toBeGreaterThanOrEqual(2);
      expect(
        Math.max(...profile.map((voice) => voice.delay + voice.duration)),
      ).toBeLessThanOrEqual(0.125);
    },
  );

  it("distinguishes tree and mogul impacts without changing game state", () => {
    expect(synthCueProfile("ski-tree-impact")).toHaveLength(3);
    expect(synthCueProfile("ski-mogul-impact")).toHaveLength(2);
    expect(synthCueProfile("ski-tree-impact")).not.toEqual(
      synthCueProfile("ski-mogul-impact"),
    );
  });

  it("provides distinct gate-clear, gate-miss, and finish cadences", () => {
    expect(synthCueProfile("ski-gate-clear")).toHaveLength(2);
    expect(synthCueProfile("ski-gate-miss")).toHaveLength(2);
    expect(synthCueProfile("ski-finish")).toHaveLength(4);
    expect(synthCueProfile("ski-gate-clear")).not.toEqual(
      synthCueProfile("ski-gate-miss"),
    );
    expect(synthCueProfile("ski-gate-clear")).not.toEqual(
      synthCueProfile("ski-finish"),
    );
  });

  it("maps carve intensity to a bounded filtered-noise profile", () => {
    expect(skiCarveProfile(-1)).toEqual({
      intensity: 0,
      gain: 0,
      centerFrequency: 420,
      q: 0.65,
    });
    expect(skiCarveProfile(Number.NaN).intensity).toBe(0);
    const half = skiCarveProfile(0.5);
    expect(half.gain).toBeCloseTo(0.0275);
    expect(half.centerFrequency).toBe(910);
    expect(skiCarveProfile(2)).toEqual({
      intensity: 1,
      gain: 0.055,
      centerFrequency: 1400,
      q: 1.35,
    });
  });

  it("pins the two active background cues and excludes the retired title hum", () => {
    expect(Object.keys(BACKGROUND_CUE_PROFILES)).toEqual([
      "key-is-opaque",
      "spare-key",
    ]);
    for (const cue of Object.values(BACKGROUND_CUE_PROFILES)) {
      const bytes = readFileSync(
        fileURLToPath(
          new URL(
            `../../src/audio/assets/${cue.assetFilename}`,
            import.meta.url,
          ),
        ),
      );
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        cue.assetSha256,
      );
      expect(backgroundCueProfile(cue.id)).toBe(cue);
    }
    expect(
      Object.values(BACKGROUND_CUE_PROFILES).some((cue) =>
        cue.assetFilename.includes("fluxball-01-open-field"),
      ),
    ).toBe(false);
  });

  it("records the exact lead-free eight-bar menu derivative", () => {
    const provenance = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            "../../src/audio/assets/key-is-opaque-backing-loop.provenance.json",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(provenance["sourceSha256"]).toBe(
      "76d5f660b125e61c7e67b212ab7b0a9a2a38c23266f8398e88b6ef3ed73526a8",
    );
    expect(provenance["keptRoles"]).toEqual(["bass", "inner", "drum"]);
    expect(provenance["removedRoles"]).toEqual(["lead"]);
    expect(provenance["bpm"]).toBe(112);
    expect(provenance["startQuarterBeat"]).toBe(8);
    expect(provenance["endQuarterBeatExclusive"]).toBe(40);
    expect(provenance["frameCount"]).toBe(756_000);
    expect(provenance["durationSeconds"]).toBeCloseTo(17.142857142857142);
    expect(provenance["boundaryFramesAreZero"]).toBe(true);
    expect(provenance["outputSha256"]).toBe(
      BACKGROUND_CUE_PROFILES["key-is-opaque"].assetSha256,
    );
  });

  it("gives Qong, Fluxball, and Quag distinct bounded cue families", () => {
    const families = {
      qong: ["qong-paddle", "qong-wall", "qong-observe", "qong-goal"],
      fluxball: [
        "fluxball-carry",
        "fluxball-strike",
        "fluxball-steal",
        "fluxball-dislodge",
        "fluxball-rule-shift",
        "fluxball-goal",
        "fluxball-no-award",
      ],
      quag: [
        "quag-flap",
        "quag-land",
        "quag-wrap",
        "quag-capture",
        "quag-shift",
      ],
    } as const;

    for (const cues of Object.values(families)) {
      const serialized = cues.map((cue) =>
        JSON.stringify(synthCueProfile(cue)),
      );
      expect(new Set(serialized).size).toBe(cues.length);
      for (const cue of cues) {
        const profile = synthCueProfile(cue);
        expect(profile.length).toBeGreaterThan(0);
        expect(
          Math.max(...profile.map((item) => item.delay + item.duration)),
        ).toBeLessThanOrEqual(0.5);
      }
    }
  });
});
