import { describe, expect, it, vi } from "vitest";
import { BROWN_BOX_PALETTE } from "../../src/display/BrownBoxTheme";
import { createRunContext } from "../../src/core/run";
import { SKIPIXL_CONTROL_PACKS } from "../../src/games/skipixl/SkiPixlCourseAdapter";
import { SkiPixlSession } from "../../src/games/skipixl/SkiPixlSession";
import { renderSkiPixl } from "../../src/display/views/SkiPixlView";
import { renderFluxball } from "../../src/display/views/FluxballView";
import { FluxballSession } from "../../src/games/fluxball/FluxballSession";
import { FLUXBALL_TWO_CONTROL_PACK } from "../../src/games/fluxball/fluxballControlPacks";
import { FLUXBALL_RULES_VERSION } from "../../src/games/fluxball/types";

vi.mock("phaser", () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value)),
      Linear: (a: number, b: number, t: number) => a + (b - a) * t,
    },
  },
}));

function graphicsMock() {
  const g = { clear: vi.fn(), fillStyle: vi.fn(), fillRect: vi.fn() };
  for (const method of Object.values(g)) method.mockReturnValue(g);
  return g;
}
const pack = SKIPIXL_CONTROL_PACKS[0]!;
const context = createRunContext({
  gameId: "skipixl",
  playMode: "arcade",
  rulesVersion: pack.rulesVersion,
  runSeed: 17,
  pack,
});
const initial = new SkiPixlSession(context, pack.payload).snapshot();

describe("cabinet presentation QA regressions", () => {
  it("does not scatter decorative brown marks around SkiPixl obstacles", () => {
    const g = graphicsMock();
    renderSkiPixl(
      g as never,
      { ...initial, phase: "active", distance: 100 },
      pack.payload,
      false,
    );
    expect(g.fillRect).toHaveBeenCalled();
    expect(
      g.fillStyle.mock.calls.some(
        ([colour]) => colour === BROWN_BOX_PALETTE.tobacco,
      ),
    ).toBe(false);
  });
  it.each([0, 100, 400, 1000, 2000, 3000])(
    "keeps scrolling SkiPixl scenery above the footer at distance %s",
    (distance) => {
      const g = graphicsMock();
      renderSkiPixl(
        g as never,
        { ...initial, phase: "active", distance },
        pack.payload,
        false,
      );
      expect(g.fillRect).toHaveBeenCalled();
      for (const [, y, , height] of g.fillRect.mock.calls)
        expect(y + height).toBeLessThanOrEqual(164);
    },
  );
  it.each(["ready", "complete"] as const)(
    "puts the SkiPixl %s status frame in the header",
    (phase) => {
      const g = graphicsMock();
      renderSkiPixl(
        g as never,
        { ...initial, phase, storyQualified: true },
        pack.payload,
        false,
      );
      // Rasterized top border spans the centre of the shared header at y=1.
      const topEdge = g.fillRect.mock.calls.filter(
        ([x, y, width, height]) =>
          x >= 80 && x <= 240 && y === 1 && width === 1 && height === 1,
      );
      expect(topEdge.length).toBeGreaterThan(50);
    },
  );
  it("keeps all four Fluxball score panels clear of footer controls", () => {
    const pack = FLUXBALL_TWO_CONTROL_PACK;
    const session = new FluxballSession(
      createRunContext({
        gameId: "fluxball",
        playMode: "arcade",
        rulesVersion: FLUXBALL_RULES_VERSION,
        runSeed: 19,
        pack,
      }),
      {
        competitorCount: 4,
        ruleMode: "individual",
        roundSeconds: 40,
        humanPlayerIds: ["A"],
      },
    );
    for (const phase of ["active", "reveal", "complete"] as const) {
      const g = graphicsMock();
      renderFluxball(g as never, { ...session.snapshot(), phase }, false);
      for (const [, y, , height] of g.fillRect.mock.calls)
        expect(y + height).toBeLessThanOrEqual(164);
    }
  });
});
