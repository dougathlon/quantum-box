import { describe, expect, it } from "vitest";

import type { GameId } from "../../src/games/registry";
import { createRunContext } from "../../src/core/run";
import { createFluxballDesignerEvidence } from "../../src/games/fluxball/FluxballDesignerEvidence";
import { FluxballSession } from "../../src/games/fluxball/FluxballSession";
import { FLUXBALL_FOUR_CONTROL_PACK } from "../../src/games/fluxball/fluxballControlPacks";
import type { FluxballSnapshot } from "../../src/games/fluxball/types";
import { createQuantmanDesignerEvidence } from "../../src/games/quantman/QuantmanDesignerEvidence";
import { QUANTMAN_CONTROL_PACK } from "../../src/games/quantman/quantmanControlPack";
import { QuantmanSession } from "../../src/games/quantman/QuantmanSession";
import {
  createSkiPixlDesignerEvidence,
  selectStorySkiPixlPack,
} from "../../src/games/skipixl/SkiPixlCourseAdapter";
import { DesignerEncounter } from "../../src/story/DesignerEncounter";
import { QongDesignerLesson } from "../../src/story/QongDesignerLesson";
import {
  selectQongStoryPack,
  validateQongStoryPackBank,
} from "../../src/games/qong/qongStoryPackBank";
import { createTestQongStoryBank } from "../fixtures/qongStoryBank";

const MECHANISM_STEPS: Readonly<Record<GameId, number>> = {
  qong: 2,
  skipixl: 3,
  fluxball: 3,
  quantman: 2,
};

describe("in-world Designer encounters", () => {
  for (const gameId of ["qong", "skipixl", "fluxball", "quantman"] as const) {
    it(`${gameId} requires approach, dialogue, mechanism operation, and recovery`, () => {
      const encounter = new DesignerEncounter(gameId);
      expect(encounter.snapshot().phase).toBe("approach");
      expect(encounter.dispatch("primary").phase).toBe("approach");

      for (let step = 0; step < 6; step += 1) {
        encounter.dispatch("p1-right");
      }
      expect(encounter.dispatch("primary").phase).toBe("dialogue");
      encounter.dispatch("primary");
      encounter.dispatch("primary");
      expect(encounter.dispatch("primary").phase).toBe("mechanism");

      encounter.dispatch("p1-right");
      for (let step = 0; step < MECHANISM_STEPS[gameId]; step += 1) {
        encounter.dispatch("primary");
      }
      expect(encounter.snapshot()).toMatchObject({
        phase: "recovered",
        completed: false,
      });
      expect(encounter.dispatch("primary").completed).toBe(true);
    });
  }

  it("names the actual mechanism instead of a generic explanation menu", () => {
    const messages = (["qong", "skipixl", "fluxball", "quantman"] as const).map(
      (gameId) => {
        const encounter = new DesignerEncounter(gameId);
        for (let step = 0; step < 6; step += 1) encounter.dispatch("p1-right");
        encounter.dispatch("primary");
        encounter.dispatch("primary");
        encounter.dispatch("primary");
        encounter.dispatch("primary");
        return encounter.snapshot().message;
      },
    );

    expect(messages[0]).toMatch(/COIN-TOSS QPU EVIDENCE UNAVAILABLE/);
    expect(messages[1]).toMatch(/QPIXL|TWENTY-BY-TWENTY/);
    expect(messages[2]).toMatch(/RELATION|RULE/);
    expect(messages[3]).toMatch(/SHIFT|PASSAGES/);
  });

  it("opens the two required first recoveries with the Designer's invitation", () => {
    for (const gameId of ["qong", "skipixl"] as const) {
      const encounter = new DesignerEncounter(gameId);
      for (let step = 0; step < 6; step += 1) encounter.dispatch("p1-right");
      expect(encounter.dispatch("primary").message).toMatch(
        /^WELL DONE\. LET ME SHOW YOU SOMETHING\./,
      );
    }
  });

  it("uses the exact recorded Qong result and selector receipt without invented hardware values", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );
    const selection = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
    const evidence = new QongDesignerLesson(
      selection.pack,
      selection.receipt,
    ).snapshot();
    const encounter = new DesignerEncounter("qong", { qong: evidence });
    for (let step = 0; step < 6; step += 1) encounter.dispatch("p1-right");
    encounter.dispatch("primary");
    encounter.dispatch("primary");
    encounter.dispatch("primary");
    let snapshot = encounter.dispatch("primary");

    expect(snapshot.message).toBe(
      "R01 · TAILS → BIT 1 · CHOOSE OPPOSITE OR OWN · TAIL 1 SELECTED FROM 32 RECORDED CANDIDATES",
    );
    encounter.dispatch("p1-left");
    snapshot = encounter.dispatch("primary");
    expect(snapshot.mechanismStep).toBe(0);
    expect(snapshot.message).toMatch(/OPPOSITE GOAL DOES NOT MATCH/);
    encounter.dispatch("p1-right");
    encounter.dispatch("p1-right");
    snapshot = encounter.dispatch("primary");
    expect(snapshot.mechanismStep).toBe(1);
    expect(snapshot.message).toBe(
      "SELECTOR 0=0 · 1=0 → PACK 1 · ACTIVE PLAY NETWORK NONE",
    );
    expect(snapshot.qongEvidence).toBe(evidence);
  });

  it("shows literal provider row evidence in the SkiPixl mechanism", () => {
    const evidence = createSkiPixlDesignerEvidence(selectStorySkiPixlPack(0));
    const encounter = new DesignerEncounter("skipixl", { skipixl: evidence });
    for (let step = 0; step < 6; step += 1) encounter.dispatch("p1-right");
    encounter.dispatch("primary");
    encounter.dispatch("primary");
    encounter.dispatch("primary");
    const snapshot = encounter.dispatch("primary");
    expect(snapshot.phase).toBe("mechanism");
    expect(snapshot.skipixlEvidence).toBe(evidence);
    expect(snapshot.message).toMatch(
      /GRID 1\/3 · ROW 11 · \d+ CELLS ≥ CUT \d\.\d{3} · PEAK COL \d+ · Δ [+-]\d\.\d{3} → (TREE|MOGUL) · LIMIT \d+S/,
    );
  });

  it("teaches the current bank-threshold SkiPixl obstacle rule", () => {
    const encounter = new DesignerEncounter("skipixl");
    for (let step = 0; step < 6; step += 1) encounter.dispatch("p1-right");
    encounter.dispatch("primary");
    encounter.dispatch("primary");
    const snapshot = encounter.dispatch("primary");
    expect(snapshot.phase).toBe("dialogue");
    expect(snapshot.message).toMatch(
      /EVERY ABSOLUTE DIFFERENCE ABOVE THE BANK CUT BECOMES A HAZARD/,
    );
    expect(snapshot.message).toMatch(
      /POSITIVE DIFFERENCES BECOME TREES; NEGATIVE DIFFERENCES BECOME MOGULS/,
    );
    expect(snapshot.message).toMatch(/SOME ROWS REMAIN OPEN. OTHERS CLOSE/);
  });

  it("uses an exact Labyrinth state transition in the Quantman mechanism", () => {
    const context = createRunContext({
      gameId: "quantman",
      storyStage: "quantman",
      playMode: "story",
      rulesVersion: QUANTMAN_CONTROL_PACK.rulesVersion,
      runSeed: 4_811,
      pack: {
        packId: QUANTMAN_CONTROL_PACK.packId,
        contentSha256: QUANTMAN_CONTROL_PACK.contentSha256,
        schemaVersion: QUANTMAN_CONTROL_PACK.schemaVersion,
        source: QUANTMAN_CONTROL_PACK.source,
      },
    });
    const session = new QuantmanSession(context, QUANTMAN_CONTROL_PACK.payload);
    const observed = session.step({ x: 0, y: 0, observe: true });
    const qualified = {
      ...observed,
      phase: "won",
      storyQualified: true,
    } as const;
    const evidence = createQuantmanDesignerEvidence(
      QUANTMAN_CONTROL_PACK,
      context,
      qualified,
    );
    const encounter = new DesignerEncounter("quantman", { quantman: evidence });
    for (let step = 0; step < 6; step += 1) encounter.dispatch("p1-right");
    encounter.dispatch("primary");
    encounter.dispatch("primary");
    encounter.dispatch("primary");
    let snapshot = encounter.dispatch("primary");
    expect(snapshot.message).toMatch(/Q\d+=\d Q\d+=\d · (EQUAL|DIFFERENT)/);
    snapshot = encounter.dispatch("primary");
    expect(snapshot.message).toMatch(
      /HELD (OPEN|CLOSED) · \d+ OTHER PASSAGES CHANGED/,
    );
    expect(snapshot.quantmanEvidence).toBe(evidence);
  });

  it("uses the exact final-round signs and rules in the Fluxball mechanism", () => {
    const context = createRunContext({
      gameId: "fluxball",
      storyStage: "fluxball-four",
      playMode: "story",
      rulesVersion: FLUXBALL_FOUR_CONTROL_PACK.rulesVersion,
      runSeed: 0,
      pack: {
        packId: FLUXBALL_FOUR_CONTROL_PACK.packId,
        contentSha256: FLUXBALL_FOUR_CONTROL_PACK.contentSha256,
        schemaVersion: FLUXBALL_FOUR_CONTROL_PACK.schemaVersion,
        source: FLUXBALL_FOUR_CONTROL_PACK.source,
      },
    });
    const session = new FluxballSession(context, {
      competitorCount: 4,
      ruleMode: "individual",
      roundSeconds: 60,
      humanPlayerIds: ["A"],
    });
    let game = session.snapshot();
    for (let round = 0; round < 4; round += 1) {
      while (game.phase === "active") {
        game = session.step({
          players: {
            A: { up: false, down: false, left: false, right: false },
          },
        });
      }
      game = session.continueAfterReveal();
    }
    expect(game.phase).toBe("complete");
    const evidence = createFluxballDesignerEvidence(
      FLUXBALL_FOUR_CONTROL_PACK,
      game as FluxballSnapshot,
    );
    const encounter = new DesignerEncounter("fluxball", {
      fluxball: evidence,
    });
    for (let step = 0; step < 6; step += 1) encounter.dispatch("p1-right");
    encounter.dispatch("primary");
    encounter.dispatch("primary");
    encounter.dispatch("primary");
    const snapshot = encounter.dispatch("primary");
    expect(snapshot.message).toMatch(
      /PLAYER [A-D] · X\/ACTION · OUTCOME [+-]{4} · SIGN [+-] → (DIRECT|INVERTED)/,
    );
    expect(snapshot.fluxballEvidence).toBe(evidence);
  });
});
