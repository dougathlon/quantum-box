import { describe, expect, it } from "vitest";

import { createRunContext, type PlayMode } from "../../src/core/run";
import { QUAG_SYNTHETIC_QGRAPH_PACK } from "../../src/games/qgraph/quarrySyntheticPack";
import {
  QUAG_ARENAS,
  quagHorizontalSpan,
  wrapQuagX,
} from "../../src/games/quag/QuagArena";
import { quagRenderInterpolationAlpha } from "../../src/games/quag/QuagRuntime";
import {
  QuagSession,
  type QuagScenario,
} from "../../src/games/quag/QuagSession";
import {
  quagHudModel,
  quagHumanQuarrySummary,
  quagRelationPresentation,
} from "../../src/games/quag/presentation";
import { quagMatchIsDraw, quagPlayerWon } from "../../src/games/quag/outcome";
import { quagCompletionCue } from "../../src/games/quag/QuagFeedback";
import {
  QUAG_PLAYER_IDS,
  QUAG_RULES_VERSION,
  type QuagInput,
  type QuagPlayerId,
} from "../../src/games/quag/types";

describe("Quarry current-context and multiplayer mechanics", () => {
  it.each([
    [QUAG_RULES_VERSION, 60],
    ["quarry-rules-v6", 40],
    ["quarry-rules-v5", 40],
    ["quarry-rules-v4", 40],
  ] as const)(
    "uses the replay-compatible round break for %s",
    (rulesVersion, ticks) => {
      const context = { ...quarryContext("arcade", 912), rulesVersion };
      const session = new QuagSession(context, QUAG_SYNTHETIC_QGRAPH_PACK, {
        readyTicks: 0,
        roundTicks: 1,
        totalRounds: 2,
        cpuEnabled: false,
      });
      const input = { horizontal: 0, flapPressed: false } as const;
      expect(session.step(input).roundBreakTicksRemaining).toBe(ticks);
      for (let i = 1; i < ticks; i++)
        expect(session.step(input).phase).toBe("round-break");
      const next = session.step(input);
      expect(next.roundNumber).toBe(2);
      expect(next.phase).toBe("active");
      expect(Boolean(next.sharedWins)).toBe(
        rulesVersion === QUAG_RULES_VERSION ||
          rulesVersion === "quarry-rules-v6",
      );
    },
  );

  it("keeps equal round wins tied despite unequal total points", () => {
    const session = new QuagSession(
      quarryContext("arcade", 901),
      QUAG_SYNTHETIC_QGRAPH_PACK,
      {
        readyTicks: 0,
        roundTicks: 1,
        totalRounds: 1,
        cpuEnabled: false,
        players: [
          { id: "A", x: 100, y: 100, score: 99, roundWins: 1 },
          { id: "B", x: 400, y: 100, score: 1, roundWins: 1 },
        ],
      },
    );
    const result = session.step({ horizontal: 0, flapPressed: false });
    expect(result.phase).toBe("complete");
    expect(result.winnerIds).toEqual(["A", "B"]);
  });

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

const NEUTRAL = {
  horizontal: 0,
  flapPressed: false,
} as const satisfies QuagInput;

describe("Quarry round winner accumulation", () => {
  it.each(QUAG_PLAYER_IDS)(
    "awards exactly one win to sole round leader %s",
    (leader) => {
      const scores = QUAG_PLAYER_IDS.map((id) => (id === leader ? 4 : 1));
      const priorWins = [1, 0, 2, 1];
      const session = scoringSession(scores, priorWins);
      const result = session.step(NEUTRAL);

      expect(result.roundWinnerIds).toEqual([leader]);
      expect(result.players.map((player) => player.roundWins)).toEqual(
        priorWins.map(
          (wins, index) => wins + (QUAG_PLAYER_IDS[index] === leader ? 1 : 0),
        ),
      );
      expect(
        result.eventsThisTick.filter(
          (event) => event.type === "ROUND_COMPLETE",
        ),
      ).toEqual([
        expect.objectContaining({
          playerIds: [leader],
          detail: `ROUND 1/1 · ${leader} WINS`,
        }),
      ]);
      // Repeated render/step requests after completion cannot award the round again.
      expect(session.step(NEUTRAL)).toEqual(result);
    },
  );

  it.each([
    {
      label: "two players tied above the rest",
      scores: [5, 5, 1, 0],
      leaders: ["A", "B"],
      expectedWins: [2, 1, 2, 1],
      matchWinners: ["A", "C"],
      outcome: "A/B SHARE WIN",
    },
    {
      label: "three players tied above the rest",
      scores: [5, 5, 5, 0],
      leaders: ["A", "B", "C"],
      expectedWins: [2, 1, 3, 1],
      matchWinners: ["C"],
      outcome: "A/B/C SHARE WIN",
    },
    {
      label: "all players tied on positive points",
      scores: [2, 2, 2, 2],
      leaders: ["A", "B", "C", "D"],
      expectedWins: [1, 0, 2, 1],
      matchWinners: ["C"],
      outcome: "DRAW · A/B/C/D",
    },
    {
      label: "all players tied without captures",
      scores: [0, 0, 0, 0],
      leaders: ["A", "B", "C", "D"],
      expectedWins: [1, 0, 2, 1],
      matchWinners: ["C"],
      outcome: "DRAW · A/B/C/D",
    },
  ])(
    "awards shared wins only for partial ties: $label",
    ({ scores, leaders, expectedWins, matchWinners, outcome }) => {
      const priorWins = [1, 0, 2, 1];
      const result = scoringSession(scores, priorWins).step(NEUTRAL);

      expect(result.roundWinnerIds).toEqual(leaders);
      expect(result.players.map((player) => player.roundWins)).toEqual(
        expectedWins,
      );
      expect(result.winnerIds).toEqual(matchWinners);
      expect(result.latestEvent).toMatchObject({
        type: "ROUND_COMPLETE",
        playerIds: leaders,
        detail: `ROUND 1/1 · ${outcome}`,
      });
    },
  );

  it("carries a unique first-round win through resets and two later drawn rounds", () => {
    const session = scoringSession([3, 0, 0, 0], [0, 0, 0, 0], {
      totalRounds: 3,
      roundBreakTicks: 1,
    });
    const first = session.step(NEUTRAL);
    expect(first).toMatchObject({
      phase: "round-break",
      roundNumber: 1,
      roundWinnerIds: ["A"],
      winnerIds: [],
    });
    expect(first.players.map((player) => player.roundWins)).toEqual([
      1, 0, 0, 0,
    ]);

    const next = session.step(NEUTRAL);
    expect(next).toMatchObject({
      phase: "active",
      roundNumber: 2,
      roundWinnerIds: [],
      winnerIds: [],
    });
    expect(next.players.map((player) => player.roundScore)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(next.players.map((player) => player.roundWins)).toEqual([
      1, 0, 0, 0,
    ]);
    expect(next.players.map((player) => player.score)).toEqual(
      first.players.map((player) => player.score),
    );

    const second = session.step(NEUTRAL);
    expect(second).toMatchObject({
      phase: "round-break",
      roundNumber: 2,
      roundWinnerIds: QUAG_PLAYER_IDS,
    });
    expect(second.players.map((player) => player.roundWins)).toEqual([
      1, 0, 0, 0,
    ]);
    session.step(NEUTRAL);
    const final = session.step(NEUTRAL);
    expect(final).toMatchObject({
      phase: "complete",
      roundNumber: 3,
      roundWinnerIds: QUAG_PLAYER_IDS,
      winnerIds: ["A"],
    });
    expect(final.players.map((player) => player.roundWins)).toEqual([
      1, 0, 0, 0,
    ]);
    expect(session.step(NEUTRAL)).toEqual(final);
  });

  it("preserves shared first-round wins through later drawn rounds", () => {
    const session = scoringSession([3, 3, 0, 0], [0, 0, 0, 0], {
      totalRounds: 3,
      roundBreakTicks: 1,
    });
    const first = session.step(NEUTRAL);
    expect(first.players.map((player) => player.roundWins)).toEqual([
      1, 1, 0, 0,
    ]);
    expect(quagHudModel(first, false).notice).toBe("ROUND 1 · A/B SHARE WIN");
    session.step(NEUTRAL);
    session.step(NEUTRAL);
    session.step(NEUTRAL);
    const final = session.step(NEUTRAL);
    expect(final.players.map((player) => player.roundWins)).toEqual([
      1, 1, 0, 0,
    ]);
    expect(final.winnerIds).toEqual(["A", "B"]);
    expect(quagMatchIsDraw(final)).toBe(false);
    expect(quagPlayerWon(final, "A")).toBe(true);
    expect(quagPlayerWon(final, "C")).toBe(false);
    expect(quagHudModel(final, false).notice).toBe("A/B SHARE WIN");
    expect(quagCompletionCue(final)).toBe("quag-match-win");
    expect(session.step(NEUTRAL)).toEqual(final);
  });

  it.each(["quarry-rules-v4", "quarry-rules-v5"])(
    "preserves original tied-round scoring for %s replays",
    (rulesVersion) => {
      const context = createRunContext({
        gameId: "quarry",
        playMode: "arcade",
        rulesVersion,
        runSeed: 911,
        pack: packIdentity(),
      });
      const legacy = new QuagSession(context, QUAG_SYNTHETIC_QGRAPH_PACK, {
        readyTicks: 0,
        roundTicks: 1,
        totalRounds: 1,
        cpuEnabled: false,
        initialBitstring: "000000000000",
        players: [
          { id: "A", x: 80, y: 120, score: 4, roundScore: 5, roundWins: 1 },
          { id: "B", x: 240, y: 120, score: 8, roundScore: 5, roundWins: 1 },
          { id: "C", x: 400, y: 120, roundScore: 1 },
          { id: "D", x: 560, y: 120 },
        ],
      });
      const result = legacy.step(NEUTRAL);
      expect(result).not.toHaveProperty("sharedWins");
      expect(result.roundWinnerIds).toEqual(["A", "B"]);
      expect(result.players.map((player) => player.roundWins)).toEqual([
        1, 1, 0, 0,
      ]);
      expect(result.latestEvent?.detail).toBe("ROUND 1/1 · DRAW · A/B");
      expect(result.winnerIds).toEqual(
        rulesVersion === "quarry-rules-v4" ? ["B"] : ["A", "B"],
      );
      expect(quagPlayerWon(result, "A")).toBe(false);
      expect(quagCompletionCue(result)).toBe(
        rulesVersion === "quarry-rules-v4"
          ? "quag-match-loss"
          : "quag-match-draw",
      );
    },
  );

  it.each([
    {
      scores: [4, 4, 0, 0],
      winners: ["A", "B"],
      humanWon: true,
      cue: "quag-match-win",
      notice: "A/B SHARE WIN",
    },
    {
      scores: [0, 4, 4, 0],
      winners: ["B", "C"],
      humanWon: false,
      cue: "quag-match-loss",
      notice: "B/C SHARE WIN · YOU LOSE",
    },
    {
      scores: [4, 4, 4, 0],
      winners: ["A", "B", "C"],
      humanWon: true,
      cue: "quag-match-win",
      notice: "A/B/C SHARE WIN",
    },
    {
      scores: [4, 4, 4, 4],
      winners: ["A", "B", "C", "D"],
      humanWon: false,
      cue: "quag-match-draw",
      notice: "DRAW · A/B/C/D",
    },
  ])(
    "keeps shared match labels and human feedback coherent: $notice",
    ({ scores, winners, humanWon, cue, notice }) => {
      const result = scoringSession(scores, [0, 0, 0, 0]).step(NEUTRAL);
      expect(result.sharedWins).toBe(true);
      expect(result.winnerIds).toEqual(winners);
      expect(quagPlayerWon(result, "A")).toBe(humanWon);
      expect(quagCompletionCue(result)).toBe(cue);
      expect(quagHudModel(result, false).notice).toBe(notice);
    },
  );

  it("retains an all-player match draw after three scoreless rounds", () => {
    const session = scoringSession([0, 0, 0, 0], [0, 0, 0, 0], {
      totalRounds: 3,
      roundBreakTicks: 0,
    });
    session.step(NEUTRAL);
    session.step(NEUTRAL);
    const result = session.step(NEUTRAL);

    expect(result.phase).toBe("complete");
    expect(result.roundWinnerIds).toEqual(QUAG_PLAYER_IDS);
    expect(result.players.map((player) => player.roundWins)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(result.winnerIds).toEqual(QUAG_PLAYER_IDS);
  });
});

function scoringSession(
  scores: readonly number[],
  wins: readonly number[],
  timing: Pick<QuagScenario, "totalRounds" | "roundBreakTicks"> = {},
): QuagSession {
  return new QuagSession(
    quarryContext("arcade", 910),
    QUAG_SYNTHETIC_QGRAPH_PACK,
    {
      readyTicks: 0,
      roundTicks: 1,
      totalRounds: 1,
      cpuEnabled: false,
      arenaId: "quarry-aerial-arena-v1",
      initialBitstring: "000000000000",
      ...timing,
      // Separate stationary bodies isolate the real session's scoring transition.
      players: QUAG_PLAYER_IDS.map((id: QuagPlayerId, index) => ({
        id,
        x: 80 + index * 160,
        y: 120,
        graceTicks: 10,
        score: index * 20,
        roundScore: scores[index]!,
        roundWins: wins[index]!,
      })),
    },
  );
}

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
