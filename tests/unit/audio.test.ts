import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  menuTuneProfile,
  normalizeSoundVolume,
  renderMenuTuneSamples,
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

  it("preserves the exact approved Open Field QRC tune schedule", () => {
    const tune = menuTuneProfile();

    expect(tune.sourceMidiSha256).toBe(
      "236dcd67c0388c59ae3977645253ebe3bdee7e0eb3f4e431dcfc8cd180a1b5e3",
    );
    expect(tune.providerResponseSha256).toBe(
      "fdf3286691be40e7f06c6471741032ed43a7ec91c67244e8bbf7e7f118032287",
    );
    expect(tune.sourceRenderSha256).toBe(
      "1d078a300331f41939f6508460b017b0eb02352ac2852b03405d63d34979eb4c",
    );
    expect(tune.playbackAssetFilename).toBe(
      "fluxball-01-open-field-likeness-65-region-03-repeated.wav",
    );
    expect(tune.playbackAssetSha256).toBe(
      "e385a500ac98fb742633443ac1113085d1f097d6d59dd37e27e24c662b8498b5",
    );
    expect(tune.playbackDurationSeconds).toBeCloseTo(38.095238);
    expect(
      createHash("sha256")
        .update(
          readFileSync(
            fileURLToPath(
              new URL(
                "../../src/audio/assets/fluxball-01-open-field-likeness-65-region-03-repeated.wav",
                import.meta.url,
              ),
            ),
          ),
        )
        .digest("hex"),
    ).toBe(tune.playbackAssetSha256);
    expect(tune.events.map((event) => event.token)).toEqual([
      "B",
      "D",
      "A",
      "D",
      "A",
      "B",
      "C",
      "D",
      "A",
      "C",
    ]);
    expect(tune.events.map((event) => event.beat)).toEqual([
      0, 1, 2, 2.5, 3.5, 4, 5, 6, 6.5, 7.5,
    ]);
    expect(tune.bpm).toBe(126);
    expect(tune.durationSeconds).toBeCloseTo(3.80952381);
  });

  it("renders one four-sound-ROM pulse per approved event in two bars", () => {
    const samples = renderMenuTuneSamples(44_100);
    let activeRegions = 0;
    let wasActive = false;
    for (const sample of samples) {
      const active = Math.abs(sample) > 1e-7;
      if (active && !wasActive) activeRegions += 1;
      wasActive = active;
    }

    expect(samples).toHaveLength(168_000);
    expect(activeRegions).toBe(10);
    expect(
      samples.reduce((peak, sample) => Math.max(peak, sample), 0),
    ).toBeLessThanOrEqual(1);
    expect(
      samples.reduce((peak, sample) => Math.min(peak, sample), 0),
    ).toBeGreaterThanOrEqual(-1);
  });

  it("rejects invalid menu sample rates", () => {
    expect(() => renderMenuTuneSamples(0)).toThrow(/sample rate/i);
    expect(() => renderMenuTuneSamples(Number.NaN)).toThrow(/sample rate/i);
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

  it("gives enacted Story actions distinct, short presentation cues", () => {
    const cues = [
      "story-morph",
      "story-door",
      "story-step",
      "story-transport",
    ] as const;
    const serialized = cues.map((cue) => JSON.stringify(synthCueProfile(cue)));

    expect(new Set(serialized).size).toBe(cues.length);
    for (const cue of cues) {
      const profile = synthCueProfile(cue);
      expect(profile.length).toBeGreaterThan(0);
      expect(
        Math.max(...profile.map((item) => item.delay + item.duration)),
      ).toBeLessThanOrEqual(0.25);
    }
  });
});
