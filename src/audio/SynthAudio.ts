import type { QuantumBoxSettings } from "../save/types";
import MENU_TUNE_ASSET_URL from "./assets/fluxball-01-open-field-likeness-65-region-03-repeated.wav?url";

export type SynthCue =
  | "boot"
  | "select"
  | "launch"
  | "pause"
  | "resume"
  | "impact"
  | "ski-tree-impact"
  | "ski-mogul-impact"
  | "ski-gate-clear"
  | "ski-gate-miss"
  | "ski-finish"
  | "success"
  | "warning"
  | "reveal"
  | "recover"
  | "failure"
  | "story-morph"
  | "story-door"
  | "story-step"
  | "story-transport"
  | "qong-paddle"
  | "qong-wall"
  | "qong-observe"
  | "qong-goal"
  | "qong-match-win"
  | "qong-match-loss"
  | "fluxball-carry"
  | "fluxball-strike"
  | "fluxball-steal"
  | "fluxball-dislodge"
  | "fluxball-rule-shift"
  | "fluxball-goal"
  | "fluxball-no-award"
  | "fluxball-round-win"
  | "fluxball-round-loss"
  | "fluxball-round-draw"
  | "fluxball-match-win"
  | "fluxball-match-loss"
  | "quag-flap"
  | "quag-land"
  | "quag-wrap"
  | "quag-capture"
  | "quag-shift"
  | "quag-match-win"
  | "quag-match-draw"
  | "quag-match-loss";

export interface SynthVoiceProfile {
  readonly delay: number;
  readonly duration: number;
  readonly frequency: number;
  readonly endFrequency?: number;
  readonly gain: number;
  readonly type: OscillatorType;
}

export interface SkiCarveProfile {
  readonly intensity: number;
  readonly gain: number;
  readonly centerFrequency: number;
  readonly q: number;
}

export interface MenuTuneEvent {
  readonly token: "A" | "B" | "C" | "D";
  readonly beat: number;
  readonly velocity: number;
}

export interface MenuTuneProfile {
  readonly id: "fluxball-open-field-65-r03-menu-v1";
  readonly sourceMidiSha256: string;
  readonly providerResponseSha256: string;
  readonly sourceRenderSha256: string;
  readonly playbackAssetSha256: string;
  readonly playbackAssetFilename: string;
  readonly playbackDurationSeconds: number;
  readonly bpm: 126;
  readonly beats: 8;
  readonly durationSeconds: number;
  readonly events: readonly MenuTuneEvent[];
}

interface SkiCarveVoice {
  readonly source: AudioBufferSourceNode;
  readonly filter: BiquadFilterNode;
  readonly envelope: GainNode;
}

interface MenuMusicVoice {
  readonly source: AudioBufferSourceNode;
  readonly envelope: GainNode;
}

type AudioContextFactory = () => AudioContext;

const MENU_TUNE_EVENTS: readonly MenuTuneEvent[] = Object.freeze([
  menuEvent("B", 0, 88),
  menuEvent("D", 1, 72),
  menuEvent("A", 2, 72),
  menuEvent("D", 2.5, 72),
  menuEvent("A", 3.5, 72),
  menuEvent("B", 4, 88),
  menuEvent("C", 5, 72),
  menuEvent("D", 6, 72),
  menuEvent("A", 6.5, 72),
  menuEvent("C", 7.5, 72),
]);

const MENU_TUNE: MenuTuneProfile = Object.freeze({
  id: "fluxball-open-field-65-r03-menu-v1",
  sourceMidiSha256:
    "236dcd67c0388c59ae3977645253ebe3bdee7e0eb3f4e431dcfc8cd180a1b5e3",
  providerResponseSha256:
    "fdf3286691be40e7f06c6471741032ed43a7ec91c67244e8bbf7e7f118032287",
  sourceRenderSha256:
    "1d078a300331f41939f6508460b017b0eb02352ac2852b03405d63d34979eb4c",
  playbackAssetSha256:
    "e385a500ac98fb742633443ac1113085d1f097d6d59dd37e27e24c662b8498b5",
  playbackAssetFilename:
    "fluxball-01-open-field-likeness-65-region-03-repeated.wav",
  playbackDurationSeconds: 38.095238,
  bpm: 126,
  beats: 8,
  durationSeconds: (8 * 60) / 126,
  events: MENU_TUNE_EVENTS,
});

const MENU_SOUND_ROM = Object.freeze({
  A: Object.freeze({
    frequency: 146.832,
    duration: 0.07,
    duty: 0.125,
    pulseMix: 0.82,
  }),
  B: Object.freeze({
    frequency: 123.471,
    duration: 0.09,
    duty: 0.25,
    pulseMix: 0.7,
  }),
  C: Object.freeze({
    frequency: 110,
    duration: 0.11,
    duty: 0.5,
    pulseMix: 0.62,
  }),
  D: Object.freeze({
    frequency: 82.407,
    duration: 0.145,
    duty: 0.5,
    pulseMix: 0.34,
  }),
});

const VOICES: Readonly<Record<SynthCue, readonly SynthVoiceProfile[]>> =
  Object.freeze({
    boot: Object.freeze([
      voice(0, 0.11, 74, 0.14, "square", 96),
      voice(0.09, 0.12, 148, 0.11, "triangle", 196),
    ]),
    select: Object.freeze([voice(0, 0.045, 236, 0.08, "square", 272)]),
    launch: Object.freeze([
      voice(0, 0.07, 112, 0.1, "square", 168),
      voice(0.055, 0.09, 224, 0.09, "triangle", 314),
    ]),
    pause: Object.freeze([voice(0, 0.07, 118, 0.1, "square", 82)]),
    resume: Object.freeze([voice(0, 0.07, 82, 0.1, "square", 132)]),
    impact: Object.freeze([
      voice(0, 0.045, 92, 0.12, "square", 68),
      voice(0.018, 0.055, 184, 0.07, "triangle", 126),
    ]),
    "ski-tree-impact": Object.freeze([
      voice(0, 0.036, 196, 0.1, "square"),
      voice(0.032, 0.042, 130, 0.09, "square"),
      voice(0.07, 0.055, 82, 0.08, "square"),
    ]),
    "ski-mogul-impact": Object.freeze([
      voice(0, 0.032, 126, 0.1, "square", 94),
      voice(0.018, 0.052, 82, 0.08, "triangle", 62),
    ]),
    "ski-gate-clear": Object.freeze([
      voice(0, 0.055, 294, 0.07, "square", 392),
      voice(0.048, 0.08, 440, 0.065, "triangle", 588),
    ]),
    "ski-gate-miss": Object.freeze([
      voice(0, 0.065, 196, 0.075, "square", 132),
      voice(0.052, 0.09, 110, 0.07, "triangle", 74),
    ]),
    "ski-finish": Object.freeze([
      voice(0, 0.075, 196, 0.075, "square", 247),
      voice(0.07, 0.075, 247, 0.075, "square", 330),
      voice(0.14, 0.085, 330, 0.08, "square", 392),
      voice(0.22, 0.16, 494, 0.075, "triangle", 659),
    ]),
    success: Object.freeze([
      voice(0, 0.055, 168, 0.08, "square", 224),
      voice(0.052, 0.075, 252, 0.07, "triangle", 336),
    ]),
    warning: Object.freeze([
      voice(0, 0.07, 168, 0.09, "sawtooth", 118),
      voice(0.065, 0.08, 118, 0.075, "square", 88),
    ]),
    reveal: Object.freeze([
      voice(0, 0.055, 196, 0.08, "triangle"),
      voice(0.045, 0.07, 294, 0.08, "triangle"),
    ]),
    recover: Object.freeze([
      voice(0, 0.08, 196, 0.1, "square"),
      voice(0.075, 0.1, 294, 0.1, "square"),
      voice(0.165, 0.16, 392, 0.09, "triangle"),
    ]),
    failure: Object.freeze([
      voice(0, 0.11, 164, 0.11, "sawtooth", 130),
      voice(0.1, 0.15, 116, 0.1, "square", 76),
    ]),
    "story-morph": Object.freeze([
      voice(0, 0.06, 98, 0.055, "square", 196),
      voice(0.045, 0.08, 196, 0.05, "triangle", 392),
      voice(0.11, 0.12, 392, 0.045, "square", 147),
    ]),
    "story-door": Object.freeze([
      voice(0, 0.045, 74, 0.06, "square", 64),
      voice(0.06, 0.055, 92, 0.055, "square", 82),
      voice(0.135, 0.1, 123, 0.04, "triangle", 185),
    ]),
    "story-step": Object.freeze([
      voice(0, 0.028, 104, 0.035, "square", 82),
      voice(0.022, 0.025, 208, 0.018, "triangle", 164),
    ]),
    "story-transport": Object.freeze([
      voice(0, 0.08, 92, 0.045, "triangle", 184),
      voice(0.055, 0.1, 184, 0.045, "triangle", 368),
      voice(0.125, 0.12, 368, 0.04, "square", 736),
    ]),
    "qong-paddle": Object.freeze([voice(0, 0.032, 520, 0.07, "square", 438)]),
    "qong-wall": Object.freeze([voice(0, 0.026, 286, 0.06, "square", 246)]),
    "qong-observe": Object.freeze([
      voice(0, 0.048, 110, 0.055, "square", 146),
      voice(0.047, 0.048, 220, 0.055, "square", 293),
      voice(0.094, 0.075, 440, 0.06, "square", 586),
    ]),
    "qong-goal": Object.freeze([
      voice(0, 0.08, 82, 0.09, "square", 62),
      voice(0.07, 0.1, 165, 0.075, "square", 124),
    ]),
    "qong-match-win": Object.freeze([
      voice(0, 0.07, 196, 0.07, "square", 247),
      voice(0.07, 0.07, 247, 0.07, "square", 330),
      voice(0.14, 0.12, 392, 0.075, "square", 523),
    ]),
    "qong-match-loss": Object.freeze([
      voice(0, 0.09, 196, 0.075, "square", 147),
      voice(0.085, 0.13, 123, 0.07, "square", 82),
    ]),
    "fluxball-carry": Object.freeze([
      voice(0, 0.052, 118, 0.065, "triangle", 148),
    ]),
    "fluxball-strike": Object.freeze([
      voice(0, 0.045, 164, 0.095, "square", 94),
      voice(0.014, 0.05, 328, 0.05, "triangle", 188),
    ]),
    "fluxball-steal": Object.freeze([
      voice(0, 0.042, 128, 0.065, "square", 192),
      voice(0.038, 0.055, 256, 0.055, "square", 342),
    ]),
    "fluxball-dislodge": Object.freeze([
      voice(0, 0.048, 246, 0.065, "square", 154),
      voice(0.04, 0.06, 116, 0.055, "triangle", 72),
    ]),
    "fluxball-rule-shift": Object.freeze([
      voice(0, 0.055, 110, 0.055, "triangle", 156),
      voice(0.048, 0.055, 155, 0.05, "triangle", 220),
      voice(0.096, 0.075, 220, 0.05, "triangle", 110),
    ]),
    "fluxball-goal": Object.freeze([
      voice(0, 0.1, 740, 0.055, "square", 980),
      voice(0.08, 0.12, 147, 0.045, "sawtooth", 196),
      voice(0.13, 0.13, 165, 0.04, "sawtooth", 220),
      voice(0.18, 0.14, 196, 0.04, "sawtooth", 262),
      voice(0.24, 0.15, 220, 0.035, "sawtooth", 294),
      voice(0.31, 0.16, 196, 0.035, "sawtooth", 247),
    ]),
    "fluxball-no-award": Object.freeze([
      voice(0, 0.075, 132, 0.08, "square", 76),
      voice(0.065, 0.1, 88, 0.065, "triangle", 55),
    ]),
    "fluxball-round-win": Object.freeze([
      voice(0, 0.06, 196, 0.06, "square", 262),
      voice(0.055, 0.07, 294, 0.06, "square", 392),
      voice(0.12, 0.11, 440, 0.065, "triangle", 523),
    ]),
    "fluxball-round-loss": Object.freeze([
      voice(0, 0.075, 196, 0.065, "square", 139),
      voice(0.07, 0.1, 110, 0.06, "triangle", 73),
    ]),
    "fluxball-round-draw": Object.freeze([
      voice(0, 0.065, 165, 0.06, "square", 196),
      voice(0.06, 0.065, 196, 0.055, "square", 165),
    ]),
    "fluxball-match-win": Object.freeze([
      voice(0, 0.08, 196, 0.065, "square", 262),
      voice(0.075, 0.08, 262, 0.065, "square", 330),
      voice(0.15, 0.09, 330, 0.065, "square", 392),
      voice(0.235, 0.18, 523, 0.07, "triangle", 784),
    ]),
    "fluxball-match-loss": Object.freeze([
      voice(0, 0.11, 196, 0.075, "sawtooth", 147),
      voice(0.1, 0.13, 123, 0.065, "square", 92),
      voice(0.22, 0.16, 73, 0.06, "triangle", 55),
    ]),
    "quag-flap": Object.freeze([
      voice(0, 0.055, 210, 0.055, "square", 320),
      voice(0.038, 0.05, 420, 0.035, "triangle", 520),
    ]),
    "quag-land": Object.freeze([voice(0, 0.06, 96, 0.065, "triangle", 58)]),
    "quag-wrap": Object.freeze([voice(0, 0.09, 155, 0.05, "triangle", 310)]),
    "quag-capture": Object.freeze([
      voice(0, 0.16, 360, 0.08, "sawtooth", 132),
      voice(0.11, 0.12, 220, 0.055, "square", 330),
      voice(0.19, 0.09, 165, 0.05, "square", 118),
    ]),
    "quag-shift": Object.freeze([
      voice(0, 0.18, 92, 0.055, "triangle", 130),
      voice(0, 0.18, 130, 0.045, "sawtooth", 92),
      voice(0.15, 0.14, 65, 0.05, "square", 46),
    ]),
    "quag-match-win": Object.freeze([
      voice(0, 0.1, 196, 0.06, "square", 294),
      voice(0.08, 0.12, 294, 0.06, "square", 440),
      voice(0.18, 0.18, 392, 0.065, "sawtooth", 587),
    ]),
    "quag-match-draw": Object.freeze([
      voice(0, 0.08, 196, 0.055, "square", 247),
      voice(0.075, 0.09, 247, 0.055, "square", 196),
    ]),
    "quag-match-loss": Object.freeze([
      voice(0, 0.16, 330, 0.065, "sawtooth", 123),
      voice(0.13, 0.16, 110, 0.06, "square", 55),
    ]),
  });

export class SynthAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;
  private volume: number;
  private paused = false;
  private unavailable = false;
  private skiCarveVoice: SkiCarveVoice | null = null;
  private menuMusicRequested = false;
  private menuMusicDelaySeconds = 0;
  private menuMusicVoice: MenuMusicVoice | null = null;
  private menuMusicBuffer: AudioBuffer | null = null;
  private menuMusicBufferPromise: Promise<AudioBuffer | null> | null = null;
  private readonly transientSources = new Set<OscillatorNode>();

  public constructor(
    settings: Pick<QuantumBoxSettings, "soundMuted" | "soundVolume">,
    private readonly createContext: AudioContextFactory = () =>
      new AudioContext({ latencyHint: "interactive" }),
  ) {
    this.muted = settings.soundMuted;
    this.volume = normalizeSoundVolume(settings.soundVolume);
  }

  /**
   * Must be called directly from a player gesture. Failure is deliberately
   * silent: unavailable audio cannot block the device or create an autoplay
   * error outside the console.
   */
  public async unlock(): Promise<boolean> {
    if (this.unavailable) return false;
    try {
      if (!this.context) {
        this.context = this.createContext();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.skiCarveVoice = createSkiCarveVoice(this.context, this.master);
        this.applyGain();
      }
      if (this.context.state === "suspended") await this.context.resume();
      if (this.menuMusicRequested) this.startMenuMusic();
      return this.context.state === "running";
    } catch {
      this.unavailable = true;
      return false;
    }
  }

  public setSettings(
    settings: Pick<QuantumBoxSettings, "soundMuted" | "soundVolume">,
  ): void {
    this.muted = settings.soundMuted;
    this.volume = normalizeSoundVolume(settings.soundVolume);
    this.applyGain();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.stopTransientSources();
    this.applyGain();
  }

  public setMenuMusic(active: boolean, delaySeconds = 0): void {
    this.menuMusicRequested = active;
    this.menuMusicDelaySeconds = Math.max(0, delaySeconds);
    if (active) this.startMenuMusic();
    else this.stopMenuMusic();
  }

  public play(cue: SynthCue): void {
    const context = this.context;
    const master = this.master;
    if (
      !context ||
      !master ||
      context.state !== "running" ||
      this.muted ||
      this.paused
    ) {
      return;
    }
    const start = context.currentTime + 0.006;
    for (const voiceDefinition of VOICES[cue]) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const voiceStart = start + voiceDefinition.delay;
      const voiceEnd = voiceStart + voiceDefinition.duration;
      oscillator.type = voiceDefinition.type;
      oscillator.frequency.setValueAtTime(
        voiceDefinition.frequency,
        voiceStart,
      );
      if (voiceDefinition.endFrequency !== undefined) {
        oscillator.frequency.linearRampToValueAtTime(
          voiceDefinition.endFrequency,
          voiceEnd,
        );
      }
      envelope.gain.setValueAtTime(0.0001, voiceStart);
      envelope.gain.exponentialRampToValueAtTime(
        voiceDefinition.gain,
        voiceStart + Math.min(0.012, voiceDefinition.duration / 3),
      );
      envelope.gain.exponentialRampToValueAtTime(0.0001, voiceEnd);
      oscillator.connect(envelope);
      envelope.connect(master);
      this.transientSources.add(oscillator);
      oscillator.addEventListener(
        "ended",
        () => {
          this.transientSources.delete(oscillator);
          oscillator.disconnect();
          envelope.disconnect();
        },
        { once: true },
      );
      oscillator.start(voiceStart);
      oscillator.stop(voiceEnd + 0.01);
    }
  }

  public setSkiCarve(intensity: number): void {
    const context = this.context;
    const voice = this.skiCarveVoice;
    if (!context || !voice || context.state !== "running") return;
    const profile = skiCarveProfile(intensity);
    voice.envelope.gain.setTargetAtTime(
      profile.gain,
      context.currentTime,
      profile.intensity > 0 ? 0.035 : 0.025,
    );
    voice.filter.frequency.setTargetAtTime(
      profile.centerFrequency,
      context.currentTime,
      0.045,
    );
    voice.filter.Q.setTargetAtTime(profile.q, context.currentTime, 0.045);
  }

  public destroy(): void {
    const context = this.context;
    const carveVoice = this.skiCarveVoice;
    this.setSkiCarve(0);
    this.stopTransientSources();
    this.stopMenuMusic();
    this.menuMusicBuffer = null;
    this.menuMusicBufferPromise = null;
    this.skiCarveVoice = null;
    this.context = null;
    this.master = null;
    if (carveVoice) {
      try {
        carveVoice.source.stop();
      } catch {
        // The source may already have stopped during context teardown.
      }
      carveVoice.source.disconnect();
      carveVoice.filter.disconnect();
      carveVoice.envelope.disconnect();
    }
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
  }

  private applyGain(): void {
    if (!this.context || !this.master) return;
    const gain = this.muted || this.paused ? 0 : this.volume;
    this.master.gain.setTargetAtTime(gain, this.context.currentTime, 0.012);
  }

  private startMenuMusic(): void {
    const context = this.context;
    const master = this.master;
    if (
      !this.menuMusicRequested ||
      this.menuMusicVoice ||
      !context ||
      !master ||
      context.state !== "running"
    ) {
      return;
    }
    void this.startMenuMusicWhenReady(context, master);
  }

  private async startMenuMusicWhenReady(
    context: AudioContext,
    master: GainNode,
  ): Promise<void> {
    const buffer = await this.loadMenuMusicBuffer(context);
    if (
      !buffer ||
      !this.menuMusicRequested ||
      this.menuMusicVoice ||
      this.context !== context ||
      this.master !== master ||
      context.state !== "running"
    ) {
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    const envelope = context.createGain();
    envelope.gain.value = 0.42;
    source.connect(envelope);
    envelope.connect(master);
    const voice = Object.freeze({ source, envelope });
    this.menuMusicVoice = voice;
    source.addEventListener(
      "ended",
      () => {
        if (this.menuMusicVoice !== voice) return;
        this.menuMusicVoice = null;
        source.disconnect();
        envelope.disconnect();
        if (this.menuMusicRequested) this.startMenuMusic();
      },
      { once: true },
    );
    source.start(context.currentTime + 0.006 + this.menuMusicDelaySeconds);
  }

  private async loadMenuMusicBuffer(
    context: AudioContext,
  ): Promise<AudioBuffer | null> {
    if (this.menuMusicBuffer) return this.menuMusicBuffer;
    this.menuMusicBufferPromise ??= (async () => {
      try {
        const response = await fetch(MENU_TUNE_ASSET_URL, {
          cache: "force-cache",
        });
        if (!response.ok) return null;
        return await context.decodeAudioData(await response.arrayBuffer());
      } catch {
        return null;
      }
    })();
    const buffer = await this.menuMusicBufferPromise;
    if (this.context === context) this.menuMusicBuffer = buffer;
    return buffer;
  }

  private stopMenuMusic(): void {
    const voice = this.menuMusicVoice;
    this.menuMusicVoice = null;
    if (!voice) return;
    try {
      voice.source.stop();
    } catch {
      // A source stopped by context teardown cannot be stopped twice.
    }
    voice.source.disconnect();
    voice.envelope.disconnect();
  }

  private stopTransientSources(): void {
    for (const source of this.transientSources) {
      try {
        source.stop();
      } catch {
        // An ended oscillator cannot be stopped twice.
      }
      source.disconnect();
    }
    this.transientSources.clear();
  }
}

export function normalizeSoundVolume(value: number): number {
  if (!Number.isFinite(value)) return 0.35;
  return Math.min(1, Math.max(0, value));
}

export function skiCarveProfile(intensity: number): SkiCarveProfile {
  const normalized = Number.isFinite(intensity)
    ? Math.min(1, Math.max(0, intensity))
    : 0;
  return Object.freeze({
    intensity: normalized,
    gain: normalized * 0.055,
    centerFrequency: 420 + normalized * 980,
    q: 0.65 + normalized * 0.7,
  });
}

/**
 * Read-only cue data for deterministic QA. Audio remains presentation-only and
 * never enters simulation, replay, or provenance state.
 */
export function synthCueProfile(cue: SynthCue): readonly SynthVoiceProfile[] {
  return VOICES[cue];
}

export function menuTuneProfile(): MenuTuneProfile {
  return MENU_TUNE;
}

/** Deterministic local derivative used by the menu and waveform QA. */
export function renderMenuTuneSamples(sampleRate = 44_100): Float32Array {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Menu tune sample rate must be a positive finite number.");
  }
  const samples = new Float32Array(
    Math.ceil(MENU_TUNE.durationSeconds * sampleRate),
  );
  const secondsPerBeat = 60 / MENU_TUNE.bpm;
  for (const event of MENU_TUNE.events) {
    addMenuToken(
      samples,
      sampleRate,
      event.token,
      event.beat * secondsPerBeat,
      event.velocity / 127,
    );
  }
  return samples;
}

function voice(
  delay: number,
  duration: number,
  frequency: number,
  gain: number,
  type: OscillatorType,
  endFrequency?: number,
): SynthVoiceProfile {
  return Object.freeze({
    delay,
    duration,
    frequency,
    gain,
    type,
    ...(endFrequency === undefined ? {} : { endFrequency }),
  });
}

function menuEvent(
  token: MenuTuneEvent["token"],
  beat: number,
  velocity: number,
): MenuTuneEvent {
  return Object.freeze({ token, beat, velocity });
}

function createMenuTuneBuffer(context: AudioContext): AudioBuffer {
  const sampleRate = context.sampleRate;
  const samples = renderMenuTuneSamples(sampleRate);
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);
  return buffer;
}

function addMenuToken(
  target: Float32Array,
  sampleRate: number,
  tokenId: MenuTuneEvent["token"],
  startSeconds: number,
  velocityGain: number,
): void {
  const token = MENU_SOUND_ROM[tokenId];
  const count = Math.max(1, Math.round(token.duration * sampleRate));
  const start = Math.round(startSeconds * sampleRate);
  const attack = Math.max(1, Math.round(0.003 * sampleRate));
  const release = Math.max(
    1,
    Math.round(Math.min(0.055, token.duration * 0.62) * sampleRate),
  );
  let phase = 0;
  const phaseIncrement = token.frequency / sampleRate;
  for (let index = 0; index < count; index += 1) {
    const destination = start + index;
    if (destination >= target.length) break;
    const pulse = phase % 1 < token.duty ? 1 : -1;
    const triangle = 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1;
    const raw = pulse * token.pulseMix + triangle * (1 - token.pulseMix);
    let envelope = 1;
    if (index < attack) envelope = index / attack;
    else if (index >= count - release) {
      envelope = Math.max(0, (count - index - 1) / release);
    }
    envelope *= Math.exp((-2.35 * index) / count);
    target[destination]! += raw * envelope * 0.72 * velocityGain;
    phase += phaseIncrement;
  }
}

function createSkiCarveVoice(
  context: AudioContext,
  destination: AudioNode,
): SkiCarveVoice {
  const sampleCount = Math.max(1, Math.round(context.sampleRate));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let state = 0x51f15e5d;
  for (let index = 0; index < samples.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    samples[index] = ((state >>> 0) / 0xffffffff) * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 420;
  filter.Q.value = 0.65;
  const envelope = context.createGain();
  envelope.gain.value = 0;
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(destination);
  source.start();
  return Object.freeze({ source, filter, envelope });
}
