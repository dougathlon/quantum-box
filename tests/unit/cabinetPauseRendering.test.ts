import { afterEach, describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { createRunContext, type RunContext } from "../../src/core/run";
import { QongSession } from "../../src/games/qong/QongSession";
import { QONG_RULES_VERSION } from "../../src/games/qong/types";
import { SkiPixlSession } from "../../src/games/skipixl/SkiPixlSession";
import { SKIPIXL_CONTROL_PACKS } from "../../src/games/skipixl/SkiPixlCourseAdapter";
import { FluxballSession } from "../../src/games/fluxball/FluxballSession";
import { FLUXBALL_RULES_VERSION } from "../../src/games/fluxball/types";
import { QuagSession } from "../../src/games/quag/QuagSession";
import { QUAG_RULES_VERSION } from "../../src/games/quag/types";
import type { QuagSnapshot } from "../../src/games/quag/types";
import { QUAG_SYNTHETIC_QGRAPH_PACK } from "../../src/games/qgraph/quarrySyntheticPack";
import { QuantmanSyntheticRuntime } from "../../src/games/quantmanSynthetic/QuantmanSyntheticRuntime";
import { renderQong } from "../../src/display/views/QongView";
import { renderSkiPixl } from "../../src/display/views/SkiPixlView";
import { renderFluxball } from "../../src/display/views/FluxballView";
import { drawQuagArena, renderQuag } from "../../src/display/views/QuagView";
import { renderQuantmanSynthetic } from "../../src/display/views/QuantmanSyntheticView";
import {
  drawCabinetPauseHeader,
  drawCenteredPixelPanel,
} from "../../src/display/PixelHud";
import * as PixelText from "../../src/display/PixelText";

vi.mock("phaser", () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, value)),
      Linear: (start: number, end: number, amount: number) =>
        start + (end - start) * amount,
    },
  },
}));

afterEach(() => vi.restoreAllMocks());

function context(
  gameId: RunContext["gameId"],
  rulesVersion: string,
): RunContext {
  return createRunContext({
    gameId,
    playMode: "arcade",
    rulesVersion,
    runSeed: 23,
    pack: {
      packId: "pause-render-test-control",
      contentSha256: "a".repeat(64),
      schemaVersion: "quantum-box-pack-v1",
      source: "synthetic-control",
    },
  });
}

function raster() {
  let colour = 0;
  const rects: number[][] = [];
  const graphics = {
    clear() {
      rects.length = 0;
      return graphics;
    },
    fillStyle(value: number) {
      colour = value;
      return graphics;
    },
    fillRect(x: number, y: number, width: number, height: number) {
      rects.push([x, y, width, height, colour]);
      return graphics;
    },
  };
  return {
    graphics: graphics as unknown as Phaser.GameObjects.Graphics,
    rects,
  };
}

function cases() {
  const qong = new QongSession(
    context("qong", QONG_RULES_VERSION),
    { directProbability: 1 },
    "cpu",
  ).snapshot();
  const skiPack = SKIPIXL_CONTROL_PACKS[0]!;
  const ski = new SkiPixlSession(
    context("skipixl", skiPack.rulesVersion),
    skiPack.payload,
  ).snapshot();
  const flux = new FluxballSession(
    context("fluxball", FLUXBALL_RULES_VERSION),
    {
      competitorCount: 2,
      ruleMode: "individual",
      roundSeconds: 40,
      humanPlayerIds: ["A"],
    },
  ).snapshot();
  const quarry = new QuagSession(
    context("quarry", QUAG_RULES_VERSION),
    QUAG_SYNTHETIC_QGRAPH_PACK,
  ).snapshot();
  const quantman = new QuantmanSyntheticRuntime({
    playMode: "arcade",
    runSeed: 23,
    mechanic: "stabilize-gaze",
  }).snapshot();
  return [
    {
      name: "Qong",
      headerHeight: 24,
      snapshot: qong,
      render: (g: Phaser.GameObjects.Graphics, paused: boolean) =>
        renderQong(g, qong, "cpu", paused),
    },
    {
      name: "SkiPixl",
      headerHeight: 24,
      snapshot: ski,
      render: (g: Phaser.GameObjects.Graphics, paused: boolean) =>
        renderSkiPixl(g, ski, skiPack.payload, paused),
    },
    {
      name: "Fluxball",
      headerHeight: 24,
      snapshot: flux,
      render: (g: Phaser.GameObjects.Graphics, paused: boolean) =>
        renderFluxball(g, flux, paused),
    },
    {
      name: "Quarry",
      headerHeight: 24,
      snapshot: quarry,
      render: (g: Phaser.GameObjects.Graphics, paused: boolean) =>
        renderQuag(g, quarry, paused),
    },
    {
      name: "Quantman",
      headerHeight: 20,
      snapshot: quantman,
      render: (g: Phaser.GameObjects.Graphics, paused: boolean) =>
        renderQuantmanSynthetic(g, quantman, paused),
    },
  ];
}

describe("shared cabinet pause rendering", () => {
  it("keeps Quarry's open sides free of wraparound chevrons", () => {
    const frame = raster();
    drawQuagArena(frame.graphics);
    expect(frame.rects.length).toBeGreaterThan(0);
    expect(
      frame.rects.every(([x, , width]) => x! >= 9 && x! + width! <= 312),
    ).toBe(true);
  });

  it.each(["round-break", "complete"] as const)(
    "keeps Quarry's %s notice above the field without the hunt HUD",
    (phase) => {
      const snapshot = new QuagSession(
        context("quarry", QUAG_RULES_VERSION),
        QUAG_SYNTHETIC_QGRAPH_PACK,
      ).snapshot();
      const text = vi.spyOn(PixelText, "drawPixelText");
      const frame = raster();
      renderQuag(frame.graphics, { ...snapshot, phase }, false);
      const header = text.mock.calls.filter(([, , options]) => options.y < 24);
      expect(header).toHaveLength(3);
      expect(header[2]![1]).toBe(
        phase === "round-break"
          ? "NEXT ROUND 1"
          : "SPACE / A EXIT · X / X RETRY",
      );
      expect(
        header.every(
          ([, value, options]) =>
            options.y + 5 < 24 &&
            PixelText.pixelTextWidth(value, options.pixel) <= 216,
        ),
      ).toBe(true);
      expect(text.mock.calls.some(([, value]) => value.includes("HUNTS"))).toBe(
        false,
      );
      expect(frame.rects.filter(([, y]) => y! >= 24)).not.toHaveLength(0);
    },
  );

  it("puts Quarry's opening instructions above the field and pulses once per relation change", () => {
    const snapshot = new QuagSession(
      context("quarry", QUAG_RULES_VERSION),
      QUAG_SYNTHETIC_QGRAPH_PACK,
    ).snapshot();
    const text = vi.spyOn(PixelText, "drawPixelText");
    const frame = raster();
    renderQuag(frame.graphics, snapshot, false);
    for (const [, value, options] of text.mock.calls) {
      if (
        value.startsWith("READY") ||
        value.startsWith("QUARRY") ||
        value === "CATCH FROM ABOVE"
      ) {
        expect(options.y + 5).toBeLessThan(24);
      }
    }
    expect(
      text.mock.calls.some(([, value]) => value === "CATCH FROM ABOVE"),
    ).toBe(true);
    const hasFlash = () =>
      frame.rects.some(
        ([x, y, w, h]) => x === 0 && y === 0 && w === 320 && h === 180,
      );
    for (const [elapsed, expected] of [
      [0, true],
      [1, true],
      [2, false],
      [10, false],
    ] as const) {
      renderQuag(
        frame.graphics,
        {
          ...snapshot,
          phase: "active",
          lastGraphShiftTick: 20,
          activeTick: 20 + elapsed,
        },
        false,
      );
      expect(hasFlash()).toBe(expected);
    }
    renderQuag(
      frame.graphics,
      { ...snapshot, phase: "active", lastGraphShiftTick: 20, activeTick: 20 },
      true,
    );
    expect(hasFlash()).toBe(false);
  });

  it("keeps Quarry relations in the header, with room for every hunter and all three targets", () => {
    const snapshot = new QuagSession(
      context("quarry", QUAG_RULES_VERSION),
      QUAG_SYNTHETIC_QGRAPH_PACK,
    ).snapshot();
    const text = vi.spyOn(PixelText, "drawPixelText");
    const dense: QuagSnapshot = {
      ...snapshot,
      phase: "active",
      directedRelations: [
        "A>B",
        "A>C",
        "A>D",
        "B>A",
        "B>C",
        "B>D",
        "C>A",
        "C>B",
        "C>D",
        "D>A",
        "D>B",
        "D>C",
      ],
      humanTargets: ["B", "C", "D"],
    };
    const sparse: QuagSnapshot = {
      ...dense,
      directedRelations: ["A>B", "B>A", "D>C"],
      humanTargets: ["B"],
    };
    const first = raster();
    const second = raster();
    renderQuag(first.graphics, dense, false);
    expect(
      text.mock.calls
        .filter(([, , options]) => options.y === 9)
        .map(([, value]) => value),
    ).toEqual([
      "A HUNTS B+C+D",
      "B HUNTS A+C+D",
      "C HUNTS A+B+D",
      "D HUNTS A+B+C",
    ]);
    for (const [, value, options] of text.mock.calls.filter(
      ([, , options]) => options.y < 24,
    )) {
      const width = PixelText.pixelTextWidth(value, options.pixel);
      expect(width).toBeLessThanOrEqual(74);
      expect(options.x - width / 2).toBeGreaterThanOrEqual(9);
      expect(options.x + width / 2).toBeLessThanOrEqual(311);
      expect(options.y + 5).toBeLessThan(24);
    }
    text.mockClear();
    renderQuag(second.graphics, sparse, false);
    expect(
      text.mock.calls
        .filter(([, , options]) => options.y === 9)
        .map(([, value]) => value),
    ).toEqual(["A HUNTS B", "B HUNTS A", "C HUNTS NONE", "D HUNTS C"]);
    expect(second.rects.filter(([, y]) => y! >= 24)).toEqual(
      first.rects.filter(([, y]) => y! >= 24),
    );
    expect(second.rects).not.toEqual(first.rects);
  });

  it("preserves the exact Qong pause box and keeps Quantman's box above its maze", () => {
    const reference = raster();
    drawCenteredPixelPanel(reference.graphics, "PAUSED", {
      centerX: 160,
      y: 6,
      pixel: 2,
      border: true,
    });
    const shared = raster();
    drawCabinetPauseHeader(shared.graphics);
    expect(shared.rects).toEqual(reference.rects);
    shared.graphics.clear();
    drawCabinetPauseHeader(shared.graphics, 20);
    expect(
      shared.rects.every(([, y, , height]) => y! >= 0 && y! + height! < 20),
    ).toBe(true);
  });

  for (const cabinet of cases()) {
    it(`${cabinet.name} replaces its HUD with one top pause box and restores it on resume`, () => {
      const { graphics } = raster();
      const text = vi.spyOn(PixelText, "drawPixelText");
      const snapshotBefore = JSON.stringify(cabinet.snapshot);
      const header = () =>
        text.mock.calls
          .filter(([, , options]) => options.y < cabinet.headerHeight)
          .map(([, value, options]) => ({ value, ...options }));
      cabinet.render(graphics, false);
      const activeHeader = header();
      expect(activeHeader.length).toBeGreaterThan(0);
      text.mockClear();
      cabinet.render(graphics, true);
      expect(header().map(({ value }) => value)).toEqual(["PAUSED"]);
      expect(
        text.mock.calls.filter(([, value]) => value === "PAUSED"),
      ).toHaveLength(1);
      text.mockClear();
      cabinet.render(graphics, false);
      expect(header()).toEqual(activeHeader);
      expect(JSON.stringify(cabinet.snapshot)).toBe(snapshotBefore);
    });
  }

  it("shows the identical vision cone in Hold and Invert without a floating target marker", () => {
    const snapshot = new QuantmanSyntheticRuntime({
      playMode: "arcade",
      runSeed: 23,
      mechanic: "stabilize-gaze",
    }).snapshot();
    const hold = raster();
    const invert = raster();
    renderQuantmanSynthetic(hold.graphics, snapshot, true);
    renderQuantmanSynthetic(
      invert.graphics,
      {
        ...snapshot,
        simulation: {
          ...snapshot.simulation,
          mechanic: "inverse-gaze",
          gazeTargetEdgeIndex: 0,
          gazeStatus: "applied",
        },
      },
      true,
    );
    expect(invert.rects).toEqual(hold.rects);
  });
});
