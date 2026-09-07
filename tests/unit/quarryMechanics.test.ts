import { describe, expect, it } from "vitest";

import { createRunContext, type PlayMode } from "../../src/core/run";
import { QUAG_SYNTHETIC_QGRAPH_PACK } from "../../src/games/qgraph/quarrySyntheticPack";
import {
  QUAG_ARENAS,
  quagHorizontalSpan,
  wrapQuagX,
} from "../../src/games/quag/QuagArena";
import { quagRenderInterpolationAlpha } from "../../src/games/quag/QuagRuntime";
import { QuagSession } from "../../src/games/quag/QuagSession";
import {
  quagHumanQuarrySummary,
  quagRelationPresentation,
} from "../../src/games/quag/presentation";
import {
  QUAG_PLAYER_IDS,
  QUAG_RULES_VERSION,
  type QuagInput,
} from "../../src/games/quag/types";

describe("Quarry current-context and multiplayer mechanics", () => {
  it("freezes render interpolation outside active play", () => {
    expect(quagRenderInterpolationAlpha("active", false, 0.25)).toBe(0.25);
    expect(quagRenderInterpolationAlpha("active", true, 0.25)).toBe(1);
    expect(quagRenderInterpolationAlpha("round-break", false, 0.25)).toBe(1);
    expect(quagRenderInterpolationAlpha("complete", false, 0.25)).toBe(1);
  });

  it.each(["arcade", "story"] as const)(
    "accepts the current Quarry id in %s mode",
    (playMode) => {
      const snapshot = new QuagSession(
        quarryContext(playMode, 901),
        QUAG_SYNTHETIC_QGRAPH_PACK,
      ).snapshot();

      expect(snapshot.humanPlayerIds).toEqual(["A"]);
      expect(QUAG_ARENAS.map(({ id }) => id)).toContain(snapshot.arenaId);
    },
  );

  it("retains quag only as an Arcade compatibility alias", () => {
    expect(
      () =>
        new QuagSession(
          createRunContext({
            gameId: "quag",
            storyStage: "quarry",
            playMode: "story",
            rulesVersion: QUAG_RULES_VERSION,
            runSeed: 902,
            pack: packIdentity(),
          }),
          QUAG_SYNTHETIC_QGRAPH_PACK,
        ),
    ).toThrow(/legacy id is an Arcade-only alias/);
  });

  it("selects one of three layouts reproducibly from the run seed", () => {
    const selected = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const first = new QuagSession(
        quarryContext("arcade", seed),
        QUAG_SYNTHETIC_QGRAPH_PACK,
      ).snapshot().arenaId;
      const second = new QuagSession(
        quarryContext("arcade", seed),
        QUAG_SYNTHETIC_QGRAPH_PACK,
      ).snapshot().arenaId;
      expect(second).toBe(first);
      selected.add(first);
    }
    expect([...selected].sort()).toEqual(
      QUAG_ARENAS.map(({ id }) => id).sort(),
    );
  });

  it("applies four simultaneous human control profiles independently", () => {
    const session = new QuagSession(
      quarryContext("arcade", 903),
      QUAG_SYNTHETIC_QGRAPH_PACK,
      {
        readyTicks: 0,
        cpuEnabled: false,
        humanPlayerIds: QUAG_PLAYER_IDS,
        arenaId: "quarry-aerial-arena-v1",
        initialBitstring: "000000000000",
        players: [
          { id: "A", x: 80, y: 120, grounded: false },
          { id: "B", x: 240, y: 120, grounded: false },
          { id: "C", x: 400, y: 120, grounded: false },
          { id: "D", x: 560, y: 120, grounded: false },
        ],
      },
    );
    const input = {
      horizontal: 0,
      flapPressed: false,
      players: {
        A: { horizontal: -1, flapPressed: true },
        B: { horizontal: 1, flapPressed: true },
        C: { horizontal: -1, flapPressed: true },
        D: { horizontal: 1, flapPressed: true },
      },
    } as const satisfies QuagInput;

    const snapshot = session.step(input);
    expect(
      snapshot.players.map(({ velocityXSubpixels }) => velocityXSubpixels),
    ).toEqual([-12, 12, -12, 12]);
    expect(
      snapshot.players.map(({ velocityYSubpixels }) => velocityYSubpixels),
    ).toEqual([-86, -86, -86, -86]);
  });

  it("reports the outgoing quarry of whichever local players joined", () => {
    const playerB = new QuagSession(
      quarryContext("arcade", 906),
      QUAG_SYNTHETIC_QGRAPH_PACK,
      {
        humanPlayerIds: ["B"],
        initialBitstring: "000010000000",
      },
    ).snapshot();
    const allPlayers = new QuagSession(
      quarryContext("arcade", 907),
      QUAG_SYNTHETIC_QGRAPH_PACK,
      {
        humanPlayerIds: QUAG_PLAYER_IDS,
        initialBitstring: "100010001100",
      },
    ).snapshot();

    expect(playerB.humanTargets).toEqual(["C"]);
    expect(allPlayers.humanTargets).toEqual(["A", "B", "C", "D"]);
    expect(quagHumanQuarrySummary(playerB)).toBe("C");
    expect(quagHumanQuarrySummary(allPlayers).split(" ")).toEqual([
      expect.stringMatching(/^A>/),
      expect.stringMatching(/^B>/),
      expect.stringMatching(/^C>/),
      expect.stringMatching(/^D>/),
    ]);
    expect(quagRelationPresentation(playerB)).toEqual(
      playerB.directedRelations.map((edge) => {
        const [sourceId, targetId] = edge.split(">");
        return {
          sourceId,
          targetId,
          sourceKind: sourceId === "B" ? "human" : "cpu",
        };
      }),
    );
    expect(
      quagRelationPresentation(allPlayers).every(
        (relation) => relation.sourceKind === "human",
      ),
    ).toBe(true);
  });

  it("rejects empty and duplicate human rosters", () => {
    expect(
      () =>
        new QuagSession(
          quarryContext("arcade", 904),
          QUAG_SYNTHETIC_QGRAPH_PACK,
          { humanPlayerIds: [] },
        ),
    ).toThrow(/one to four unique human player ids/);
    expect(
      () =>
        new QuagSession(
          quarryContext("arcade", 905),
          QUAG_SYNTHETIC_QGRAPH_PACK,
          { humanPlayerIds: ["A", "A"] },
        ),
    ).toThrow(/one to four unique human player ids/);
  });

  it.each(QUAG_ARENAS)("keeps $id horizontally open and wrapped", (arena) => {
    const left = wrapQuagX(arena.left - 15, arena);
    const right = wrapQuagX(arena.right + 15, arena);
    expect(left).toEqual({
      x: arena.left - 15 + quagHorizontalSpan(arena),
      wrapped: true,
    });
    expect(right).toEqual({
      x: arena.right + 15 - quagHorizontalSpan(arena),
      wrapped: true,
    });
  });
});

function quarryContext(playMode: PlayMode, runSeed: number) {
  return createRunContext({
    gameId: "quarry",
    ...(playMode === "story" ? { storyStage: "quarry" as const } : {}),
    playMode,
    rulesVersion: QUAG_RULES_VERSION,
    runSeed,
    pack: packIdentity(),
  });
}

function packIdentity() {
  return {
    packId: QUAG_SYNTHETIC_QGRAPH_PACK.packId,
    contentSha256: QUAG_SYNTHETIC_QGRAPH_PACK.contentSha256,
    schemaVersion: QUAG_SYNTHETIC_QGRAPH_PACK.schemaVersion,
    source: QUAG_SYNTHETIC_QGRAPH_PACK.sourceClassification,
  } as const;
}
