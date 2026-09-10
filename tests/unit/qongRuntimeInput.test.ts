import { afterEach, describe, expect, it, vi } from "vitest";
import { QongRuntime } from "../../src/games/qong/QongRuntime";
import { createRunContext } from "../../src/core/run";
import type { ScreenScene } from "../../src/game/ScreenScene";
import type { QuantumBoxShell } from "../../src/ui/QuantumBoxShell";
import type { QongSnapshot } from "../../src/games/qong/types";

afterEach(() => vi.unstubAllGlobals());
describe("Qong shared reveal input", () => {
  it.each(["keyboard", "gamepad"] as const)(
    "either player's %s action uses one shared reveal",
    (source) => {
      let frame: FrameRequestCallback = () => {};
      let snapshot!: QongSnapshot;
      vi.stubGlobal(
        "requestAnimationFrame",
        (callback: FrameRequestCallback) => {
          frame = callback;
          return 1;
        },
      );
      vi.stubGlobal("cancelAnimationFrame", () => {});
      const runtime = new QongRuntime(
        createRunContext({
          gameId: "qong",
          playMode: "arcade",
          rulesVersion: "qong-rules-v1",
          runSeed: 7,
          pack: {
            packId: "test",
            contentSha256: "a".repeat(64),
            schemaVersion: "quantum-box-pack-v1",
            source: "synthetic-control",
          },
        }),
        { directProbability: 0.5 },
        "local",
        {
          showQong: (state: QongSnapshot) => {
            snapshot = state;
          },
        } as unknown as ScreenScene,
        { updateQongHud: () => {} } as unknown as QuantumBoxShell,
        { onCompleted: () => {}, onContinue: () => {}, onReplay: () => {} },
      );
      runtime.start();
      for (const action of ["p2-action", "p1-action"] as const)
        runtime.handleInput({
          action,
          pressed: true,
          source,
          deviceId: "test",
          capturedAtMs: 1,
        });
      let now = performance.now() + 20;
      frame(now);
      expect(snapshot.observationsRemaining).toBe(2);
      expect(snapshot.measurementState).toBe("measuring");
      for (let i = 0; i < 60; i++) {
        now += 17;
        frame(now);
      }
      runtime.handleInput({
        action: "p2-action",
        pressed: true,
        source,
        deviceId: "test",
        capturedAtMs: 2,
      });
      frame(now + 17);
      expect(snapshot.observationsRemaining).toBe(2);
      runtime.stop();
    },
  );
});
