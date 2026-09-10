import { describe, expect, it } from "vitest";

import {
  fluxballDisplayView,
  qongDisplayView,
  quantmanDisplayView,
  SKIPIXL_PLAYER_Y,
  skiPixlDisplayView,
} from "../../src/display/views/CabinetDisplayViews";
import { LIBRARY_ORDER } from "../../src/display/views/LibraryView";
import { TITLE_VIEW_COPY } from "../../src/display/views/TitleView";
import type { FluxballSnapshot } from "../../src/games/fluxball/types";
import type { QongSnapshot } from "../../src/games/qong/types";
import type { QuantmanSnapshot } from "../../src/games/quantman/types";
import { selectStorySkiPixlPack } from "../../src/games/skipixl/SkiPixlCourseAdapter";
import type { SkiPixlSnapshot } from "../../src/games/skipixl/types";

describe("Brown Box display models", () => {
  it("keeps the title and library ordering explicit", () => {
    expect(TITLE_VIEW_COPY).toEqual({
      title: "QUANTUM BOX",
      action: "PRESS START",
      assistiveHint: "Any player action key",
    });
    expect(LIBRARY_ORDER).toEqual(["qong", "skipixl", "fluxball", "quantman"]);
  });

  it("maps Qong's unresolved public rule state without exposing its internal rule", () => {
    const snapshot = {
      phase: "active",
      ball: { x: 317, y: 179 },
      leftPaddleY: 160,
      rightPaddleY: 210,
      observationsRemaining: 2,
      measurementState: "unresolved",
      goalRule: "unresolved",
    } as unknown as QongSnapshot;

    const hidden = qongDisplayView(snapshot, false);
    expect(hidden).toEqual({
      phase: "active",
      ball: { x: 317, y: 179 },
      leftPaddleY: 160,
      rightPaddleY: 210,
      observationsRemaining: 2,
      measurementState: "unresolved",
      goalRule: "unresolved",
      paused: false,
    });
    expect(Object.isFrozen(hidden)).toBe(true);
    expect(
      qongDisplayView(
        {
          ...snapshot,
          measurementState: "resolved",
          goalRule: "own",
        },
        true,
      ),
    ).toMatchObject({
      measurementState: "resolved",
      goalRule: "own",
      paused: true,
    });
  });

  it("fixes SkiPixl to a downhill camera with upcoming terrain below the skier", () => {
    const payload = selectStorySkiPixlPack(0).payload;
    const snapshot = {
      distance: 0,
    } as unknown as SkiPixlSnapshot;

    const view = skiPixlDisplayView(snapshot, payload, false);
    expect(view.direction).toBe("down-screen");
    expect(view.playerY).toBe(SKIPIXL_PLAYER_Y);
    expect(view.visibleObstacles.length).toBeGreaterThan(0);
    expect(view.visibleObstacles[0]?.screenY).toBeGreaterThan(view.playerY);
    expect(view.finishY).toBeGreaterThan(view.playerY);
    expect(Object.isFrozen(view.visibleObstacles)).toBe(true);

    const advanced = skiPixlDisplayView(
      { distance: 700 } as unknown as SkiPixlSnapshot,
      payload,
      false,
    );
    expect(
      advanced.visibleObstacles[0]?.obstacle.distance,
    ).toBeGreaterThanOrEqual(660);
    expect(advanced.visibleObstacles[0]?.screenY).toBeLessThan(
      view.visibleObstacles[0]!.screenY,
    );

    const medium = selectStorySkiPixlPack(0, "P84").payload;
    const gateView = skiPixlDisplayView(
      { distance: medium.gates?.[0]?.distance ?? 0 } as SkiPixlSnapshot,
      medium,
      false,
    );
    expect(gateView.visibleGates.length).toBeGreaterThan(0);
  });

  it("orders Fluxball figures by public court depth", () => {
    const snapshot = {
      sport: {
        activePlayerIds: ["A", "B"],
        players: {
          A: { y: 430 },
          B: { y: 120 },
        },
      },
    } as unknown as FluxballSnapshot;

    const view = fluxballDisplayView(snapshot, true);
    expect(view.orderedPlayerIds).toEqual(["B", "A"]);
    expect(view.paused).toBe(true);
    expect(Object.isFrozen(view.orderedPlayerIds)).toBe(true);
  });

  it("copies Quantman collection state into an immutable display view", () => {
    const collectedFragmentIds = ["fragment-a"];
    const snapshot = {
      collectedFragmentIds,
    } as unknown as QuantmanSnapshot;

    const view = quantmanDisplayView(snapshot, false);
    collectedFragmentIds.push("fragment-b");
    expect(view.collectedFragmentIds).toEqual(["fragment-a"]);
    expect(Object.isFrozen(view.collectedFragmentIds)).toBe(true);
    expect(Object.isFrozen(view)).toBe(true);
  });
});
