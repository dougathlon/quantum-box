import type { QuantumBoxSettings } from "../save/types";
import CABINET_HUM_ASSET_URL from "./assets/cabinet-hum-loop.wav?url";
import KEY_IS_OPAQUE_ASSET_URL from "./assets/key-is-opaque-backing-loop.wav?url";
import SPARE_KEY_ASSET_URL from "./assets/spare-key-loop.wav?url";

export type BackgroundCueId = "cabinet-hum" | "key-is-opaque" | "spare-key";

export interface BackgroundCueProfile {
  readonly id: BackgroundCueId;
  readonly assetFilename: string;
  readonly assetSha256: string;
  readonly durationSeconds: number;
  readonly provenance: string;
}

const BACKGROUND_CUE_URLS: Readonly<Record<BackgroundCueId, string>> =
  Object.freeze({
    "cabinet-hum": CABINET_HUM_ASSET_URL,
    "key-is-opaque": KEY_IS_OPAQUE_ASSET_URL,
    "spare-key": SPARE_KEY_ASSET_URL,
  });

export const BACKGROUND_CUE_PROFILES: Readonly<
  Record<BackgroundCueId, BackgroundCueProfile>
> = Object.freeze({
  "cabinet-hum": Object.freeze({
    id: "cabinet-hum",
    assetFilename: "cabinet-hum-loop.wav",
    assetSha256:
      "f9b1a71687987ba08b6f4009673addc280c57e96b4e15c9f718594279873f01b",
    durationSeconds: 20,
    provenance:
      "Approved local cabinet-hum synthesis; source preserved outside the runtime tree.",
  }),
  "key-is-opaque": Object.freeze({
    id: "key-is-opaque",
    assetFilename: "key-is-opaque-backing-loop.wav",
    assetSha256:
      "feff452edce713f945139fae58469798b8d13aa1783e4683281688bfb7d43d02",
    durationSeconds: 17.142857142857142,
    provenance:
      "Frame-exact beats 8–40 derivative of the approved lead-free bass, inner, and drum render at 112 BPM.",
  }),
  "spare-key": Object.freeze({
    id: "spare-key",
    assetFilename: "spare-key-loop.wav",
    assetSha256:
      "419e6ecb5bceeec1615b7a2843d2a9389f914f6399422304445f45d04d825a3a",
    durationSeconds: 20,
    provenance:
      "Approved local A Spare Key terminal loop; source preserved outside the runtime tree.",
  }),
});

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

interface SkiCarveVoice {
  readonly source: AudioBufferSourceNode;
  readonly filter: BiquadFilterNode;
  readonly envelope: GainNode;
}

type AudioContextFactory = () => AudioContext;
type BackgroundAudioFactory = (
  cue: BackgroundCueId,
  assetUrl: string,
) => HTMLAudioElement;

const BACKGROUND_GAIN = 0.42;
const BACKGROUND_FADE_SECONDS = 0.096;
const BACKGROUND_FADE_STEPS = 6;

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
  private skiCarveReleaseTimer: ReturnType<typeof setTimeout> | null = null;
  private requestedBackgroundCue: BackgroundCueId | null = null;
  private activeBackgroundCue: BackgroundCueId | null = null;
  private backgroundElement: HTMLAudioElement | null = null;
  private backgroundPlayPending: Promise<void> | null = null;
  private backgroundFadeTimer: ReturnType<typeof setInterval> | null = null;
  private backgroundFadeFactor = 0;
  private backgroundGeneration = 0;
  private backgroundAutoplayPending = false;
  private documentVisible = true;
  private readonly transientSources = new Set<OscillatorNode>();
  private readonly onContextStateChange = (): void => {
    const context = this.context;
    if (!context || context.state === "closed") return;
    if (context.state === "running") {
      this.retryBackgroundPlayback();
      return;
    }
    if (this.requestedBackgroundCue) void this.resumeExistingContext(context);
  };

  public constructor(
    settings: Pick<QuantumBoxSettings, "soundMuted" | "soundVolume">,
    private readonly createContext: AudioContextFactory = () =>
      new AudioContext({ latencyHint: "interactive" }),
    private readonly createBackgroundAudio: BackgroundAudioFactory = (
      _cue,
      assetUrl,
    ) => new Audio(assetUrl),
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
    this.retryBackgroundPlayback();
    if (this.unavailable) return false;
    if (!this.context) {
      try {
        this.context = this.createContext();
        this.context.addEventListener("statechange", this.onContextStateChange);
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.applyGain();
      } catch {
        this.unavailable = true;
        return false;
      }
    }
    const context = this.context;
    if (context.state !== "running") await this.resumeExistingContext(context);
    this.retryBackgroundPlayback();
    return context.state === "running";
  }

  /**
   * Browser tab suspension is not a permanent audio failure. Resume an already
   * unlocked context when the page becomes active or receives another gesture.
   */
  public recoverFromBrowserInterruption(): void {
    this.retryBackgroundPlayback();
    const context = this.context;
    if (!context || context.state === "closed") return;
    if (context.state === "running") return;
    void this.resumeExistingContext(context);
  }

  public setSettings(
    settings: Pick<QuantumBoxSettings, "soundMuted" | "soundVolume">,
  ): void {
    this.muted = settings.soundMuted;
    this.volume = normalizeSoundVolume(settings.soundVolume);
    this.applyGain();
  }

  public setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.stopTransientSources();
      this.backgroundElement?.pause();
    } else {
      this.retryBackgroundPlayback();
    }
    this.applyGain();
  }

  public requestBackgroundCue(cue: BackgroundCueId | null): void {
    if (this.requestedBackgroundCue === cue) return;
    this.requestedBackgroundCue = cue;
    this.backgroundAutoplayPending = false;
    const generation = ++this.backgroundGeneration;
    this.clearBackgroundFade();
    if (!this.backgroundElement) {
      this.commitBackgroundCue(generation);
      return;
    }
    this.fadeBackgroundTo(0, generation, () => {
      if (generation !== this.backgroundGeneration) return;
      this.releaseBackgroundElement();
      this.commitBackgroundCue(generation);
    });
  }

  public setDocumentVisible(visible: boolean): void {
    if (this.documentVisible === visible) return;
    this.documentVisible = visible;
    if (!visible) {
      this.clearBackgroundFade();
      this.backgroundElement?.pause();
      return;
    }
    this.retryBackgroundPlayback();
  }

  public backgroundCueState(): Readonly<{
    requested: BackgroundCueId | null;
    active: BackgroundCueId | null;
    autoplayPending: boolean;
  }> {
    return Object.freeze({
      requested: this.requestedBackgroundCue,
      active: this.activeBackgroundCue,
      autoplayPending: this.backgroundAutoplayPending,
    });
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
    const master = this.master;
    if (!context || !master || context.state !== "running") return;
    const profile = skiCarveProfile(intensity);
    if (profile.intensity <= 0) {
      const voice = this.skiCarveVoice;
      if (!voice) return;
      voice.envelope.gain.setTargetAtTime(0, context.currentTime, 0.018);
      if (this.skiCarveReleaseTimer === null) {
        this.skiCarveReleaseTimer = setTimeout(() => {
          this.skiCarveReleaseTimer = null;
          if (this.skiCarveVoice !== voice) return;
          this.skiCarveVoice = null;
          disposeSkiCarveVoice(voice);
        }, 100);
      }
      return;
    }
    if (this.skiCarveReleaseTimer !== null) {
      clearTimeout(this.skiCarveReleaseTimer);
      this.skiCarveReleaseTimer = null;
    }
    const voice = this.skiCarveVoice ?? createSkiCarveVoice(context, master);
    this.skiCarveVoice = voice;
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
    this.requestedBackgroundCue = null;
    this.backgroundGeneration += 1;
    this.clearBackgroundFade();
    this.releaseBackgroundElement();
    if (this.skiCarveReleaseTimer !== null) {
      clearTimeout(this.skiCarveReleaseTimer);
      this.skiCarveReleaseTimer = null;
    }
    if (carveVoice) disposeSkiCarveVoice(carveVoice);
    this.skiCarveVoice = null;
    this.context = null;
    this.master = null;
    context?.removeEventListener("statechange", this.onContextStateChange);
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
  }

  private applyGain(): void {
    const gain = this.muted || this.paused ? 0 : this.volume;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(gain, this.context.currentTime, 0.012);
    }
    this.applyBackgroundGain();
  }

  private async resumeExistingContext(context: AudioContext): Promise<void> {
    if (this.context !== context || context.state === "closed") return;
    try {
      await context.resume();
    } catch {
      // A browser may still require a fresh gesture. The next player input
      // calls unlock() again; a transient denial must not disable all audio.
      return;
    }
    if (this.context === context && context.state === "running")
      this.retryBackgroundPlayback();
  }

  private commitBackgroundCue(generation: number): void {
    if (generation !== this.backgroundGeneration) return;
    const cue = this.requestedBackgroundCue;
    if (!cue) {
      this.activeBackgroundCue = null;
      this.backgroundFadeFactor = 0;
      return;
    }
    const element = this.createBackgroundAudio(cue, BACKGROUND_CUE_URLS[cue]);
    element.preload = "auto";
    element.loop = true;
    element.addEventListener("ended", this.onBackgroundEnded);
    element.addEventListener("canplay", this.onBackgroundCanPlay);
    this.backgroundElement = element;
    this.activeBackgroundCue = cue;
    this.backgroundFadeFactor = 0;
    this.applyBackgroundGain();
    this.retryBackgroundPlayback();
  }

  private retryBackgroundPlayback(): void {
    const cue = this.requestedBackgroundCue;
    const element = this.backgroundElement;
    if (
      !cue ||
      cue !== this.activeBackgroundCue ||
      !element ||
      this.backgroundPlayPending ||
      !this.documentVisible ||
      this.paused
    ) {
      return;
    }
    if (!element.paused) {
      this.backgroundAutoplayPending = false;
      this.fadeBackgroundTo(1, this.backgroundGeneration);
      return;
    }
    const generation = this.backgroundGeneration;
    let pending: Promise<void>;
    try {
      pending = element.play();
    } catch {
      this.backgroundAutoplayPending = true;
      return;
    }
    this.backgroundPlayPending = pending;
    void pending
      .then(
        () => {
          if (
            generation !== this.backgroundGeneration ||
            element !== this.backgroundElement ||
            cue !== this.requestedBackgroundCue
          ) {
            element.pause();
            return;
          }
          this.backgroundAutoplayPending = false;
          this.fadeBackgroundTo(1, generation);
        },
        () => {
          if (
            generation === this.backgroundGeneration &&
            element === this.backgroundElement &&
            cue === this.requestedBackgroundCue
          ) {
            this.backgroundAutoplayPending = true;
          }
        },
      )
      .finally(() => {
        if (this.backgroundPlayPending === pending) {
          this.backgroundPlayPending = null;
          if (
            !this.backgroundAutoplayPending &&
            this.documentVisible &&
            !this.paused &&
            element === this.backgroundElement &&
            element.paused
          ) {
            this.retryBackgroundPlayback();
          }
        }
      });
  }

  private fadeBackgroundTo(
    target: 0 | 1,
    generation: number,
    onComplete?: () => void,
  ): void {
    const element = this.backgroundElement;
    if (!element) {
      onComplete?.();
      return;
    }
    this.clearBackgroundFade();
    const start = this.backgroundFadeFactor;
    if (start === target) {
      onComplete?.();
      return;
    }
    let step = 0;
    const intervalMilliseconds =
      (BACKGROUND_FADE_SECONDS * 1_000) / BACKGROUND_FADE_STEPS;
    this.backgroundFadeTimer = setInterval(() => {
      if (
        generation !== this.backgroundGeneration ||
        element !== this.backgroundElement
      ) {
        this.clearBackgroundFade();
        return;
      }
      step += 1;
      this.backgroundFadeFactor =
        start + (target - start) * (step / BACKGROUND_FADE_STEPS);
      this.applyBackgroundGain();
      if (step < BACKGROUND_FADE_STEPS) return;
      this.clearBackgroundFade();
      this.backgroundFadeFactor = target;
      this.applyBackgroundGain();
      onComplete?.();
    }, intervalMilliseconds);
  }

  private readonly onBackgroundEnded = (): void => {
    const element = this.backgroundElement;
    if (!element || !this.requestedBackgroundCue) return;
    element.currentTime = 0;
    this.retryBackgroundPlayback();
  };

  private readonly onBackgroundCanPlay = (): void => {
    this.retryBackgroundPlayback();
  };

  private applyBackgroundGain(): void {
    const element = this.backgroundElement;
    if (!element) return;
    element.muted = this.muted || this.paused;
    element.volume = Math.min(
      1,
      this.volume * BACKGROUND_GAIN * this.backgroundFadeFactor,
    );
  }

  private clearBackgroundFade(): void {
    if (this.backgroundFadeTimer !== null) {
      clearInterval(this.backgroundFadeTimer);
      this.backgroundFadeTimer = null;
    }
  }

  private releaseBackgroundElement(): void {
    const element = this.backgroundElement;
    this.clearBackgroundFade();
    this.backgroundElement = null;
    this.backgroundPlayPending = null;
    this.activeBackgroundCue = null;
    this.backgroundFadeFactor = 0;
    if (!element) return;
    element.removeEventListener("ended", this.onBackgroundEnded);
    element.removeEventListener("canplay", this.onBackgroundCanPlay);
    element.pause();
    element.removeAttribute("src");
    element.load();
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

export function backgroundCueProfile(
  cue: BackgroundCueId,
): BackgroundCueProfile {
  return BACKGROUND_CUE_PROFILES[cue];
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

function disposeSkiCarveVoice(voice: SkiCarveVoice): void {
  try {
    voice.source.stop();
  } catch {
    // An already-ended source can still be disconnected safely.
  }
  voice.source.disconnect();
  voice.filter.disconnect();
  voice.envelope.disconnect();
}
