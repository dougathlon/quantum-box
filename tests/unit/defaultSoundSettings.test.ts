import { describe, expect, it } from "vitest";
import { normalizeSoundVolume } from "../../src/audio/SynthAudio";
import {
  SAVE_STORAGE_KEY,
  SaveRepository,
} from "../../src/save/SaveRepository";
import {
  createDefaultSave,
  DEFAULT_SOUND_VOLUME,
  validateSave,
} from "../../src/save/types";

describe("full-volume defaults without overriding saved settings", () => {
  it("starts at full volume and uses that default for invalid presentation samples", () => {
    expect(DEFAULT_SOUND_VOLUME).toBe(1);
    expect(createDefaultSave().settings.soundVolume).toBe(1);
    expect(createDefaultSave().settings.soundMuted).toBe(false);
    expect(normalizeSoundVolume(NaN)).toBe(1);
    expect(normalizeSoundVolume(Infinity)).toBe(1);
  });

  it.each([false, true])(
    "migrates a missing volume while preserving mute=%s",
    (soundMuted) => {
      const save = createDefaultSave();
      const { soundVolume: _volume, ...settings } = save.settings;
      const migrated = validateSave({
        ...save,
        settings: { ...settings, soundMuted },
      });
      expect(migrated.settings.soundVolume).toBe(1);
      expect(migrated.settings.soundMuted).toBe(soundMuted);
    },
  );

  for (const soundMuted of [false, true]) {
    it.each([0, 0.2, 0.35, 1])(
      "retains persisted volume %s on load and after another setting changes (mute=" +
        soundMuted +
        ")",
      (soundVolume) => {
        const save = createDefaultSave();
        const values = new Map<string, string>([
          [
            SAVE_STORAGE_KEY,
            JSON.stringify({
              ...save,
              settings: { ...save.settings, soundVolume, soundMuted },
            }),
          ],
        ]);
        const storage = {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => values.delete(key),
          clear: () => values.clear(),
          key: (index: number) => [...values.keys()][index] ?? null,
          get length() {
            return values.size;
          },
        };
        const repository = new SaveRepository(storage);
        expect(repository.snapshot().settings).toMatchObject({
          soundVolume,
          soundMuted,
        });
        repository.updateSettings({ reducedMotion: true });
        expect(new SaveRepository(storage).snapshot().settings).toMatchObject({
          soundVolume,
          soundMuted,
          reducedMotion: true,
        });
      },
    );
  }
});
