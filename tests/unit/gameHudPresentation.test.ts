import { describe, expect, it } from "vitest";

import { createRunContext } from "../../src/core/run";
import { FluxballSession } from "../../src/games/fluxball/FluxballSession";
import { FLUXBALL_TWO_CONTROL_PACK } from "../../src/games/fluxball/fluxballControlPacks";
import {
  fluxballCompletionLabel,
  fluxballHudModel,
} from "../../src/games/fluxball/presentation";
import { FLUXBALL_RULES_VERSION } from "../../src/games/fluxball/types";
import { qongHudModel } from "../../src/games/qong/presentation";
import { QongSession } from "../../src/games/qong/QongSession";
import { QONG_RULES_VERSION } from "../../src/games/qong/types";
import { quantmanHudModel } from "../../src/games/quantman/presentation";
import { QUANTMAN_CONTROL_PACK } from "../../src/games/quantman/quantmanControlPack";
import { QuantmanSession } from "../../src/games/quantman/QuantmanSession";

describe("native cabinet HUD presentation", () => {
  it("derives one Qong model for the framebuffer and accessibility mirror", () => {
    const session = new QongSession(
      createRunContext({
        gameId: "qong",
        playMode: "arcade",
        rulesVersion: QONG_RULES_VERSION,
        runSeed: 17,
        pack: {
          packId: "qong-local-control-v1",
          contentSha256: "a".repeat(64),
          schemaVersion: "quantum-box-pack-v1",
          source: "synthetic-control",
        },
      }),
      { directProbability: 1 },
      "cpu",
    );
    const snapshot = session.snapshot();

    expect(qongHudModel(snapshot, "cpu", false)).toMatchObject({
      leftLabel: "YOU",
      rightLabel: "CPU",
      round: "ROUND: 1/7",
      ruleState: "RULE STATE: UNRESOLVED",
      goal: "GOAL: UNRESOLVED",
      winner: "WINNER: UNRESOLVED",
      notice: "",
    });
    const measuring = session.step({
      leftAxis: 0,
      rightAxis: 0,
      observePressed: true,
    });
    expect(qongHudModel(measuring, "cpu", false)).toMatchObject({
      ruleState: "RULE STATE: MEASURING",
      goal: "GOAL: UNRESOLVED",
      winner: "WINNER: UNRESOLVED",
    });
    let resolved = measuring;
    for (let tick = 0; tick < 18; tick += 1) {
      resolved = session.step({ leftAxis: 0, rightAxis: 0 });
    }
    expect(qongHudModel(resolved, "cpu", false)).toMatchObject({
      ruleState: "RULE STATE: RESOLVED",
      goal: "GOAL: OPPOSITE",
      winner: "WINNER: UNRESOLVED",
    });
    expect(
      qongHudModel(
        {
          ...resolved,
          phase: "between-rallies",
          rallyReveal: {
            polarity: "direct",
            goalSide: "right",
            pointWinner: "left",
          },
        },
        "cpu",
        false,
      ).winner,
    ).toBe("WINNER: YOU");
    expect(
      qongHudModel(
        { ...resolved, phase: "complete", winner: "right" },
        "local",
        false,
      ).winner,
    ).toBe("WINNER: PLAYER 2");
    expect(qongHudModel(snapshot, "cpu", true).notice).toBe("PAUSED");
  });

  it("derives a minimal Fluxball HUD without exposing unresolved rules", () => {
    const session = new FluxballSession(
      createRunContext({
        gameId: "fluxball",
        playMode: "arcade",
        rulesVersion: FLUXBALL_RULES_VERSION,
        runSeed: 19,
        pack: {
          packId: FLUXBALL_TWO_CONTROL_PACK.packId,
          contentSha256: FLUXBALL_TWO_CONTROL_PACK.contentSha256,
          schemaVersion: FLUXBALL_TWO_CONTROL_PACK.schemaVersion,
          source: FLUXBALL_TWO_CONTROL_PACK.source,
        },
      }),
      {
        competitorCount: 2,
        ruleMode: "individual",
        roundSeconds: 40,
        humanPlayerIds: ["A"],
      },
    );
    const snapshot = session.snapshot();

    expect(fluxballHudModel(snapshot, false)).toMatchObject({
      round: "R 1/4",
      time: "40",
      goals: { A: "0", B: "0", C: "0", D: "0" },
      roundWins: { A: "0", B: "0", C: "0", D: "0" },
      activePlayerIds: ["A", "B"],
      notice: "",
      ruleChange: "PRESS SPACE / A TO CHANGE RULES",
    });

    const changed = session.step({
      players: {},
      revealRequests: [{ playerId: "A", capturedAtMs: 1 }],
    });
    expect(fluxballHudModel(changed, false)).toMatchObject({
      ruleChange: "",
    });

    let ended = changed;
    while (ended.phase === "active") ended = session.step({ players: {} });
    const roundEndHud = fluxballHudModel(ended, false);
    expect(JSON.stringify(roundEndHud)).not.toMatch(
      /DIRECT|INVERTED|CARRY|STRIKE|OPPOSITE|OWN/,
    );
  });

  it("keeps internal Story qualification language out of Fluxball results", () => {
    expect(fluxballCompletionLabel("arcade", true)).toBe("MATCH COMPLETE");
    expect(fluxballCompletionLabel("arcade", false)).toBe("MATCH COMPLETE");
    expect(fluxballCompletionLabel("story", true)).toBe("YOU WIN");
    expect(fluxballCompletionLabel("story", false)).toBe("MATCH LOST");
  });

  it("derives concise Quantman maze-chase telemetry without changing it", () => {
    const snapshot = new QuantmanSession(
      createRunContext({
        gameId: "quantman",
        playMode: "arcade",
        rulesVersion: QUANTMAN_CONTROL_PACK.rulesVersion,
        runSeed: 23,
        pack: {
          packId: QUANTMAN_CONTROL_PACK.packId,
          contentSha256: QUANTMAN_CONTROL_PACK.contentSha256,
          schemaVersion: QUANTMAN_CONTROL_PACK.schemaVersion,
          source: QUANTMAN_CONTROL_PACK.source,
        },
      }),
      QUANTMAN_CONTROL_PACK.payload,
    ).snapshot();
    const hud = quantmanHudModel(snapshot, false);

    expect(hud.fragments).toBe(`0 / ${snapshot.requiredFragments}`);
    expect(hud.state).toBe("SCORE 00000 · TURN 0");
    expect(hud.focus).toBe(
      `LOOK ${snapshot.focusedDoorId.toUpperCase()} ${snapshot.focusedDoorOpen ? "OPEN" : "CLOSED"} · LOCAL SIM`,
    );
    expect(hud.notice).toBe("READY · MOVE");
  });
});
