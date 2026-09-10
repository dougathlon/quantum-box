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
