import { describe, expect, it } from "vitest";
import { createRunContext } from "../../src/core/run";
import {
  LOCAL_HUMAN_LIMIT,
  LOCAL_HUMAN_PLAYERS,
} from "../../src/input/LocalPlayers";
import { FluxballSession } from "../../src/games/fluxball/FluxballSession";
import { FLUXBALL_PLAYABLE_RULE_BANK } from "../../src/games/fluxball/fluxballControlPacks";
import { FLUXBALL_RULES_VERSION } from "../../src/games/fluxball/types";
import {
  NEUTRAL_INPUT_FRAME,
  NEUTRAL_PLAYER_INPUT,
} from "../../src/games/fluxball/standalone/input";
import { QuagSession } from "../../src/games/quag/QuagSession";
import { QUAG_RULES_VERSION } from "../../src/games/quag/types";
import { QUAG_SYNTHETIC_QGRAPH_PACK } from "../../src/games/qgraph/quarrySyntheticPack";

describe("desktop human-player boundary", () => {
  it("offers exactly A and B for local human assignments", () => {
    expect(LOCAL_HUMAN_PLAYERS).toEqual(["A", "B"]);
    expect(LOCAL_HUMAN_LIMIT).toBe(2);
  });

  it.each([1, 2])(
    "keeps four Fluxball competitors with %i humans and ignores C/D human input",
    (humanCount) => {
      const context = createRunContext({
        gameId: "fluxball",
        playMode: "arcade",
        runSeed: 19,
        rulesVersion: FLUXBALL_RULES_VERSION,
        pack: FLUXBALL_PLAYABLE_RULE_BANK,
      });
      const format = {
        competitorCount: 4,
        ruleMode: "individual",
        roundSeconds: 40,
        humanPlayerIds: LOCAL_HUMAN_PLAYERS.slice(0, humanCount),
      } as const;
      const ordinary = new FluxballSession(context, format);
      const extraInputs = new FluxballSession(context, format);
      expect(ordinary.snapshot().sport?.activePlayerIds).toEqual([
        "A",
        "B",
        "C",
        "D",
      ]);
      expect(Object.keys(ordinary.snapshot().cpuBeliefs)).toEqual(
        humanCount === 1 ? ["B", "C", "D"] : ["C", "D"],
      );
      for (let tick = 0; tick < 40; tick++) {
        const baseline = ordinary.step({ players: NEUTRAL_INPUT_FRAME });
        const extra = extraInputs.step({
          players: {
            ...NEUTRAL_INPUT_FRAME,
            C: { ...NEUTRAL_PLAYER_INPUT, left: true },
            D: { ...NEUTRAL_PLAYER_INPUT, down: true },
          },
        });
        expect(extra).toEqual(baseline);
      }
    },
  );

  it.each([1, 2])(
    "keeps four Quarry competitors with %i humans and ignores C/D human input",
    (humanCount) => {
      const context = createRunContext({
        gameId: "quarry",
        playMode: "arcade",
        runSeed: 903,
        rulesVersion: QUAG_RULES_VERSION,
        pack: {
          packId: QUAG_SYNTHETIC_QGRAPH_PACK.packId,
          contentSha256: QUAG_SYNTHETIC_QGRAPH_PACK.contentSha256,
          schemaVersion: QUAG_SYNTHETIC_QGRAPH_PACK.schemaVersion,
          source: QUAG_SYNTHETIC_QGRAPH_PACK.sourceClassification,
        },
      });
      const scenario = {
        readyTicks: 0,
        humanPlayerIds: LOCAL_HUMAN_PLAYERS.slice(0, humanCount),
      };
      const ordinary = new QuagSession(
        context,
        QUAG_SYNTHETIC_QGRAPH_PACK,
        scenario,
      );
      const extraInputs = new QuagSession(
        context,
        QUAG_SYNTHETIC_QGRAPH_PACK,
        scenario,
      );
      expect(ordinary.snapshot().players.map(({ id }) => id)).toEqual([
        "A",
        "B",
        "C",
        "D",
      ]);
      expect(ordinary.snapshot().humanPlayerIds).toEqual(
        LOCAL_HUMAN_PLAYERS.slice(0, humanCount),
      );
      for (let tick = 0; tick < 40; tick++) {
        const baseline = ordinary.step({ horizontal: 0, flapPressed: false });
        const extra = extraInputs.step({
          horizontal: 0,
          flapPressed: false,
          players: {
            C: { horizontal: -1, flapPressed: true },
            D: { horizontal: 1, flapPressed: true },
          },
        });
        expect(extra).toEqual(baseline);
      }
    },
  );
});
