import { afterEach, describe, expect, it, vi } from "vitest";

import { SynthAudio } from "../../src/audio/SynthAudio";

class FakeAudioParam {
  public value = 0;

  public setTargetAtTime(value: number): void {
    this.value = value;
  }

  public setValueAtTime(value: number): void {
    this.value = value;
  }

  public exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }

  public linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class FakeAudioNode {
  public readonly connections: unknown[] = [];
  public disconnected = false;
  public connect(node: unknown): void {
    this.connections.push(node);
  }
  public disconnect(): void {
    this.disconnected = true;
  }
}

class FakeGainNode extends FakeAudioNode {
  public readonly gain = new FakeAudioParam();
}

class FakeBiquadFilterNode extends FakeAudioNode {
  public type: BiquadFilterType = "lowpass";
  public readonly frequency = new FakeAudioParam();
  public readonly Q = new FakeAudioParam();
}

class FakeAudioBuffer {
  public constructor(
    public readonly duration: number,
    private readonly samples = new Float32Array(1),
  ) {}

  public getChannelData(): Float32Array {
    return this.samples;
  }
}

class FakeAudioBufferSourceNode extends EventTarget {
  public buffer: AudioBuffer | null = null;
  public loop = false;
  public loopStart = 0;
  public loopEnd = 0;
  public readonly starts: number[] = [];
  public stopCalls = 0;

  public connect(): void {}
  public disconnect(): void {}

  public start(when = 0): void {
    this.starts.push(when);
  }

  public stop(): void {
    this.stopCalls += 1;
    this.finish();
  }

  public finish(): void {
    this.dispatchEvent(new Event("ended"));
  }
}

class FakeMenuAudio extends EventTarget {
  public currentTime = 0;
  public loop = false;
  public muted = false;
  public paused = true;
  public preload = "none";
  public volume = 1;
  public playCalls = 0;
  public rejectPlay = false;

  public async play(): Promise<void> {
    this.playCalls += 1;
    if (this.rejectPlay) throw new Error("gesture required");
    this.paused = false;
  }

  public pause(): void {
    this.paused = true;
  }

  public load(): void {}
  public removeAttribute(): void {}

  public finish(): void {
    this.paused = true;
    this.dispatchEvent(new Event("ended"));
  }
}

class FakeAudioContext extends EventTarget {
  public state: AudioContextState = "suspended";
  public currentTime = 4;
  public readonly sampleRate = 44_100;
  public readonly destination = new FakeAudioNode();
  public readonly sources: FakeAudioBufferSourceNode[] = [];
  public rejectResume = false;
  public readonly mediaSources: FakeAudioNode[] = [];
  public readonly gains: FakeGainNode[] = [];

  public createMediaElementSource(): MediaElementAudioSourceNode {
    const source = new FakeAudioNode();
    this.mediaSources.push(source);
    return source as unknown as MediaElementAudioSourceNode;
  }

  public createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  public createBuffer(_channels: number, length: number): AudioBuffer {
    return new FakeAudioBuffer(
      length / this.sampleRate,
      new Float32Array(length),
    ) as unknown as AudioBuffer;
  }

  public createBufferSource(): AudioBufferSourceNode {
    const source = new FakeAudioBufferSourceNode();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  public createBiquadFilter(): BiquadFilterNode {
    return new FakeBiquadFilterNode() as unknown as BiquadFilterNode;
  }

  public async decodeAudioData(): Promise<AudioBuffer> {
    return new FakeAudioBuffer(38.095238) as unknown as AudioBuffer;
  }

  public async resume(): Promise<void> {
    if (this.rejectResume) throw new Error("gesture required");
    this.setState("running");
  }

  public async close(): Promise<void> {
    this.setState("closed");
  }

  public setState(state: AudioContextState): void {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("background audio lifecycle", () => {
  it("boosts music by 12 dB once and releases each media graph", async () => {
    vi.useFakeTimers();
    try {
      const context = new FakeAudioContext();
      const elements: FakeMenuAudio[] = [];
      const audio = new SynthAudio(
        { soundMuted: false, soundVolume: 0.35 },
        () => context as unknown as AudioContext,
        () => {
          const element = new FakeMenuAudio();
          elements.push(element);
          return element as unknown as HTMLAudioElement;
        },
      );
      await audio.unlock();
      audio.requestBackgroundCue("key-is-opaque");
      await vi.advanceTimersByTimeAsync(120);
      expect(elements[0]?.volume).toBe(1);
      const musicGain = context.gains[1]!;
      expect(musicGain.gain.value).toBeCloseTo(0.35 * 0.42 * 10 ** (12 / 20));
      expect(context.mediaSources[0]?.connections).toEqual([musicGain]);
      expect(musicGain.connections).toEqual([context.destination]);
      audio.setSettings({ soundMuted: false, soundVolume: 1 });
      expect(musicGain.gain.value).toBeCloseTo(0.42 * 10 ** (12 / 20));
      audio.setSettings({ soundMuted: true, soundVolume: 1 });
      expect(elements[0]?.muted).toBe(true);
      audio.setSettings({ soundMuted: false, soundVolume: 1 });
      audio.requestBackgroundCue("key-is-opaque");
      await audio.unlock();
      audio.setDocumentVisible(false);
      audio.setDocumentVisible(true);
      await vi.advanceTimersByTimeAsync(120);
      expect(context.mediaSources).toHaveLength(1);
      expect(elements[0]?.playCalls).toBe(2);
      audio.requestBackgroundCue("spare-key");
      await vi.advanceTimersByTimeAsync(240);
      expect(context.mediaSources).toHaveLength(2);
      expect(context.mediaSources[0]?.disconnected).toBe(true);
      expect(musicGain.disconnected).toBe(true);
      expect(context.gains[2]?.gain.value).toBeCloseTo(0.42 * 10 ** (12 / 20));
      audio.destroy();
      expect(context.mediaSources[1]?.disconnected).toBe(true);
      expect(context.gains[2]?.disconnected).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the same cue alive and restarts only an unexpected ending", async () => {
    vi.useFakeTimers();
    try {
      const context = new FakeAudioContext();
      const element = new FakeMenuAudio();
      const audio = new SynthAudio(
        { soundMuted: false, soundVolume: 0.35 },
        () => context as unknown as AudioContext,
        () => element as unknown as HTMLAudioElement,
      );

      audio.requestBackgroundCue("key-is-opaque");
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(100);
      expect(element.playCalls).toBe(1);
      expect(element.loop).toBe(true);
      expect(element.preload).toBe("auto");
      expect(element.volume).toBeCloseTo(0.35 * 0.42);

      audio.requestBackgroundCue("key-is-opaque");
      expect(element.playCalls).toBe(1);
      element.finish();
      await Promise.resolve();
      expect(element.playCalls).toBe(2);
      expect(element.paused).toBe(false);
      audio.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("fades out before creating the replacement cue", async () => {
    vi.useFakeTimers();
    try {
      const context = new FakeAudioContext();
      const created: Array<{ cue: string; audio: FakeMenuAudio }> = [];
      const audio = new SynthAudio(
        { soundMuted: false, soundVolume: 0.5 },
        () => context as unknown as AudioContext,
        (cue) => {
          const item = { cue, audio: new FakeMenuAudio() };
          created.push(item);
          return item.audio as unknown as HTMLAudioElement;
        },
      );
      audio.requestBackgroundCue("key-is-opaque");
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(100);
      expect(created.map(({ cue }) => cue)).toEqual(["key-is-opaque"]);

      audio.requestBackgroundCue("spare-key");
      await vi.advanceTimersByTimeAsync(80);
      expect(created).toHaveLength(1);
      expect(created[0]!.audio.paused).toBe(false);
      await vi.advanceTimersByTimeAsync(20);
      expect(created.map(({ cue }) => cue)).toEqual([
        "key-is-opaque",
        "spare-key",
      ]);
      expect(created[0]!.audio.paused).toBe(true);
      expect(created[1]!.audio.playCalls).toBe(1);
      audio.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a transient native-media play rejection", async () => {
    const context = new FakeAudioContext();
    const element = new FakeMenuAudio();
    element.rejectPlay = true;
    const audio = new SynthAudio(
      { soundMuted: false, soundVolume: 0.35 },
      () => context as unknown as AudioContext,
      () => element as unknown as HTMLAudioElement,
    );

    audio.requestBackgroundCue("key-is-opaque");
    await Promise.resolve();
    await Promise.resolve();
    expect(element.playCalls).toBe(1);
    expect(audio.backgroundCueState().autoplayPending).toBe(true);

    element.rejectPlay = false;
    audio.recoverFromBrowserInterruption();
    await Promise.resolve();
    expect(element.playCalls).toBe(2);
    expect(element.paused).toBe(false);
    audio.destroy();
  });

  it("preserves native-media position while the document is hidden", async () => {
    const context = new FakeAudioContext();
    const element = new FakeMenuAudio();
    const audio = new SynthAudio(
      { soundMuted: false, soundVolume: 0.35 },
      () => context as unknown as AudioContext,
      () => element as unknown as HTMLAudioElement,
    );
    audio.requestBackgroundCue("spare-key");
    await Promise.resolve();
    element.currentTime = 7.25;
    audio.setDocumentVisible(false);
    expect(element.paused).toBe(true);
    audio.setDocumentVisible(true);
    await Promise.resolve();
    expect(element.currentTime).toBe(7.25);
    expect(element.playCalls).toBe(2);
    audio.destroy();
  });

  it("applies mute and volume without restarting playback", async () => {
    const context = new FakeAudioContext();
    const element = new FakeMenuAudio();
    const audio = new SynthAudio(
      { soundMuted: false, soundVolume: 0.35 },
      () => context as unknown as AudioContext,
      () => element as unknown as HTMLAudioElement,
    );
    audio.requestBackgroundCue("key-is-opaque");
    await Promise.resolve();
    audio.setSettings({ soundMuted: true, soundVolume: 0.8 });
    expect(element.muted).toBe(true);
    expect(element.playCalls).toBe(1);
    audio.setSettings({ soundMuted: false, soundVolume: 0.8 });
    expect(element.muted).toBe(false);
    expect(element.playCalls).toBe(1);
    audio.destroy();
  });

  it("does not turn a transient resume denial into permanent unavailability", async () => {
    const context = new FakeAudioContext();
    const audio = new SynthAudio(
      { soundMuted: false, soundVolume: 0.35 },
      () => context as unknown as AudioContext,
    );

    context.rejectResume = true;
    await expect(audio.unlock()).resolves.toBe(false);
    context.rejectResume = false;
    await expect(audio.unlock()).resolves.toBe(true);
    audio.destroy();
  });

  it("creates the noise source only while SkiPixl is actively carving", async () => {
    vi.useFakeTimers();
    try {
      const context = new FakeAudioContext();
      const audio = new SynthAudio(
        { soundMuted: false, soundVolume: 0.35 },
        () => context as unknown as AudioContext,
      );

      await expect(audio.unlock()).resolves.toBe(true);
      expect(context.sources).toHaveLength(0);

      audio.setSkiCarve(0.8);
      expect(context.sources).toHaveLength(1);
      const firstSource = context.sources[0]!;
      expect(firstSource.stopCalls).toBe(0);

      audio.setSkiCarve(0);
      await vi.advanceTimersByTimeAsync(100);
      expect(firstSource.stopCalls).toBe(1);

      audio.setSkiCarve(0.5);
      expect(context.sources).toHaveLength(2);
      audio.destroy();
      expect(context.sources[1]!.stopCalls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("audio transition interruption regressions", () => {
  it("finishes a cue replacement while hidden and resumes only the requested cue", async () => {
    vi.useFakeTimers();
    const elements: FakeMenuAudio[] = [];
    const audio = new SynthAudio(
      { soundMuted: false, soundVolume: 0.35 },
      () => new FakeAudioContext() as unknown as AudioContext,
      () => {
        const element = new FakeMenuAudio();
        elements.push(element);
        return element as unknown as HTMLAudioElement;
      },
    );
    try {
      audio.requestBackgroundCue("key-is-opaque");
      await vi.advanceTimersByTimeAsync(110);
      audio.requestBackgroundCue("spare-key");
      await vi.advanceTimersByTimeAsync(32);
      audio.setDocumentVisible(false);
      expect(elements[0]!.paused).toBe(true);
      expect(elements[1]!.playCalls).toBe(0);
      audio.setDocumentVisible(true);
      await vi.advanceTimersByTimeAsync(110);
      expect(audio.backgroundCueState()).toMatchObject({
        requested: "spare-key",
        active: "spare-key",
        autoplayPending: false,
      });
      expect(elements.filter((element) => !element.paused)).toEqual([
        elements[1],
      ]);
      audio.requestBackgroundCue(null);
      audio.setDocumentVisible(false);
      audio.setDocumentVisible(true);
      await vi.advanceTimersByTimeAsync(110);
      expect(elements.every((element) => element.paused)).toBe(true);
    } finally {
      audio.destroy();
      vi.useRealTimers();
    }
  });

  it("does not let a pending play promise resume sound after the tab is hidden", async () => {
    const element = new FakeMenuAudio();
    let finish: (() => void) | undefined;
    element.play = () =>
      new Promise<void>((resolve) => {
        finish = () => {
          element.paused = false;
          resolve();
        };
      });
    const audio = new SynthAudio(
      { soundMuted: false, soundVolume: 0.35 },
      () => new FakeAudioContext() as unknown as AudioContext,
      () => element as unknown as HTMLAudioElement,
    );
    audio.requestBackgroundCue("key-is-opaque");
    audio.setDocumentVisible(false);
    finish!();
    await Promise.resolve();
    expect(element.paused).toBe(true);
    audio.destroy();
  });
});
