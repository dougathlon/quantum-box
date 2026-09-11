import { describe, expect, it, vi } from "vitest";
import { toggleFullscreen } from "../../src/ui/Fullscreen";
describe("fullscreen control", () => {
  it("requests the whole document with browser navigation hidden", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    await toggleFullscreen({
      fullscreenEnabled: true,
      fullscreenElement: null,
      documentElement: { requestFullscreen },
    } as unknown as Document);
    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" });
  });
  it("exits an existing fullscreen session", async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    await toggleFullscreen({
      fullscreenElement: {},
      exitFullscreen,
    } as unknown as Document);
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });
  it("reports unsupported or denied fullscreen instead of pretending it worked", async () => {
    await expect(
      toggleFullscreen({ fullscreenEnabled: false } as Document),
    ).rejects.toThrow("unavailable");
    await expect(
      toggleFullscreen({
        fullscreenEnabled: true,
        documentElement: {
          requestFullscreen: () => Promise.reject(new Error("Denied")),
        },
      } as unknown as Document),
    ).rejects.toThrow("Denied");
  });
});

describe("fullscreen exit observation", () => {
  it("calls once per exit, never on entry or duplicate notifications, and cleans up", async () => {
    const { observeFullscreenExit } = await import("../../src/ui/Fullscreen");
    const target = new EventTarget();
    const document = Object.assign(target, {
      fullscreenElement: null as object | null,
    });
    const exit = vi.fn();
    const stop = observeFullscreenExit(document as unknown as Document, exit);
    const change = () => target.dispatchEvent(new Event("fullscreenchange"));
    change();
    document.fullscreenElement = {};
    change();
    expect(exit).not.toHaveBeenCalled();
    document.fullscreenElement = null;
    change();
    change();
    expect(exit).toHaveBeenCalledOnce();
    document.fullscreenElement = {};
    change();
    stop();
    document.fullscreenElement = null;
    change();
    expect(exit).toHaveBeenCalledOnce();
  });
});
