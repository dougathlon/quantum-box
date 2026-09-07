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
  public connect(): void {}
  public disconnect(): void {}
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

  public createGain(): GainNode {
    return new FakeGainNode() as unknown as GainNode;
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

describe("menu audio lifecycle", () => {
  it("uses a persistent native loop and restarts an unexpected ending", async () => {
    const context = new FakeAudioContext();
    const menuAudio = new FakeMenuAudio();
    const audio = new SynthAudio(
      { soundMuted: false, soundVolume: 0.35 },
      () => context as unknown as AudioContext,
      () => menuAudio as unknown as HTMLAudioElement,
    );

    audio.setMenuMusic(true);
    await vi.waitFor(() => expect(menuAudio.playCalls).toBe(1));
    await expect(audio.unlock()).resolves.toBe(true);
    expect(menuAudio.loop).toBe(true);
    expect(menuAudio.preload).toBe("auto");
    expect(menuAudio.volume).toBeCloseTo(0.35 * 0.42);
    expect(context.sources).toHaveLength(0);

    menuAudio.finish();
    await vi.waitFor(() => expect(menuAudio.playCalls).toBe(2));
    expect(menuAudio.paused).toBe(false);

    audio.setMenuMusic(false);
    expect(menuAudio.paused).toBe(true);
    expect(menuAudio.currentTime).toBe(0);
    audio.destroy();
  });

  it("retries a transient native-media play rejection", async () => {
    const context = new FakeAudioContext();
    const menuAudio = new FakeMenuAudio();
    menuAudio.rejectPlay = true;
    const audio = new SynthAudio(
      { soundMuted: false, soundVolume: 0.35 },
      () => context as unknown as AudioContext,
      () => menuAudio as unknown as HTMLAudioElement,
    );

    audio.setMenuMusic(true);
    await vi.waitFor(() => expect(menuAudio.playCalls).toBe(1));
    expect(menuAudio.paused).toBe(true);
    await Promise.resolve();
    await Promise.resolve();

    menuAudio.rejectPlay = false;
    audio.recoverFromBrowserInterruption();
    await vi.waitFor(() => expect(menuAudio.playCalls).toBe(2));
    expect(menuAudio.paused).toBe(false);
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
