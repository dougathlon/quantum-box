import { describe, expect, it } from "vitest";

import { sha256CanonicalJson } from "../../src/core/canonicalJson";
import { createReplayBundle } from "../../src/core/replay";
import { createRunContext, type RunContext } from "../../src/core/run";
import { QongSession } from "../../src/games/qong/QongSession";
import { QONG_CONTROL_PACK } from "../../src/games/qong/qongControlPack";
import {
  loadInstalledQongStoryBank,
  selectQongStoryPack,
  validateQongStoryPackBank,
  type QongCoinJobEvidenceV2,
  type QongStoryPackSelection,
} from "../../src/games/qong/qongStoryPackBank";
import {
  QONG_RULES_VERSION,
  type QongInput,
  type QongPolarity,
  type QongSnapshot,
} from "../../src/games/qong/types";
import { createTestQongStoryBank } from "../fixtures/qongStoryBank";

const NEUTRAL: QongInput = Object.freeze({
  leftAxis: 0,
  rightAxis: 0,
  observePressed: false,
});

describe("Qong vertical-slice machine acceptance", () => {
  it("binds selector records, the selected seven-result pack, and exact replay", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );
    const selection = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });

    expect(selection.receipt.selectorBits).toEqual(
      bank.selectorPack.bits.slice(0, 2),
    );
    expect(selection.receipt.selectedPackIndex).toBe(
      selection.receipt.selectorBits[0] * 2 + selection.receipt.selectorBits[1],
    );
    expect(selection.pack).toBe(
      bank.playPacks[selection.receipt.selectedPackIndex],
    );
    expect(
      bank.selectorPack.qpuProvenance.jobs.slice(0, 2).map((job) => job.itemId),
    ).toEqual(["s001", "s002"]);

    await assertImmutableProviderRecords(
      selection.pack.qpuProvenance.jobs as readonly QongCoinJobEvidenceV2[],
    );
    await assertImmutableProviderRecords(
      bank.selectorPack.qpuProvenance.jobs as readonly QongCoinJobEvidenceV2[],
    );

    const played = playObservationAware(selection, 0);
    expect(played.final.phase).toBe("complete");
    expect(played.final.winner).toBe("left");
    expect(played.reveals).toEqual(selection.pack.payload.rallyPolarities);
    expect(played.reveals).toEqual(
      selection.pack.qpuProvenance.jobs.map((job) =>
        job.outcome === "heads" ? "direct" : "invert",
      ),
    );

    const replay = new QongSession(
      played.context,
      selection.pack.payload,
      "cpu",
    );
    const replayTrace = played.inputs.map((input) => replay.step(input));
    expect(replayTrace).toEqual(played.trace);
    expect(replay.snapshot()).toEqual(played.final);

    const bundle = createReplayBundle({
      run: played.context,
      completion: { succeeded: true, outcome: String(played.final.winner) },
      inputTape: played.inputs,
      finalState: played.final,
    });
    expect(bundle.run.packSelection).toEqual(selection.receipt);
    expect(bundle.run.pack.contentSha256).toBe(selection.pack.contentSha256);
  });

  it("makes passive play lose while keeping the observation-aware policy beatable", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );
    const selection = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
    const passive = playPassive(selection, 0);
    const engaged = playObservationAware(selection, 0);

    expect(passive.final.winner).toBe("right");
    expect(engaged.final.winner).toBe("left");
    expect(engaged.final.storyEvidence.humanObservationsUsed).toBe(3);
    expect(
      engaged.final.storyEvidence.directionalRallyNumbers.length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("loads the installed authentic Story bank and labels Arcade as synthetic", async () => {
    const installed = await loadInstalledQongStoryBank();

    expect(installed.playPacks).toHaveLength(4);
    expect(installed.selectorPack.bits).toHaveLength(44);
    expect(installed.selectorPack.source).toBe("moth-api-qpu");
    expect(QONG_CONTROL_PACK.source).toBe("synthetic-control");
    expect(QONG_CONTROL_PACK.mothEvidence).toBeNull();
    expect(QONG_CONTROL_PACK.warnings.join(" ")).toMatch(/No Moth job/i);
  });
});

async function assertImmutableProviderRecords(
  jobs: readonly QongCoinJobEvidenceV2[],
): Promise<void> {
  for (const [index, job] of jobs.entries()) {
    const { providerRecordSha256, ...material } = job;
    expect(job.sequenceOrdinal).toBe(index);
    expect(await sha256CanonicalJson(material)).toBe(providerRecordSha256);
  }
}

function playPassive(selection: QongStoryPackSelection, seed: number) {
  return play(selection, seed, () => NEUTRAL);
}

function playObservationAware(selection: QongStoryPackSelection, seed: number) {
  const publicHistory: QongPolarity[] = [];
  let observedRevealRally = 0;
  let currentRally = 0;
  let requestedObservation = false;
  let strategy: "defend" | "concede" = "defend";
  return play(selection, seed, (snapshot) => {
    if (
      snapshot.rallyReveal !== null &&
      snapshot.rallyNumber !== observedRevealRally
    ) {
      observedRevealRally = snapshot.rallyNumber;
      publicHistory.push(snapshot.rallyReveal.polarity);
    }
    if (snapshot.rallyNumber !== currentRally) {
      currentRally = snapshot.rallyNumber;
      requestedObservation = false;
      const previous = publicHistory.at(-1);
      const beforePrevious = publicHistory.at(-2);
      const prediction =
        previous === undefined
          ? "direct"
          : beforePrevious !== undefined && beforePrevious !== previous
            ? previous === "direct"
              ? "invert"
              : "direct"
            : previous;
      strategy = prediction === "direct" ? "defend" : "concede";
    }
    const observePressed =
      snapshot.phase === "active" &&
      snapshot.observationsRemaining > 0 &&
      snapshot.measurementState === "unresolved" &&
      !requestedObservation;
    if (observePressed) requestedObservation = true;
    if (snapshot.measurementState === "resolved") {
      strategy = snapshot.goalRule === "opposite" ? "defend" : "concede";
    }
    const error = snapshot.ball.y - snapshot.leftPaddleY;
    const defendAxis: -1 | 0 | 1 = Math.abs(error) < 7 ? 0 : error < 0 ? -1 : 1;
    const concedeAxis: -1 | 1 = snapshot.ball.y < snapshot.leftPaddleY ? 1 : -1;
    return {
      leftAxis: strategy === "defend" ? defendAxis : concedeAxis,
      rightAxis: 0,
      observePressed,
    };
  });
}

function play(
  selection: QongStoryPackSelection,
  seed: number,
  inputFor: (snapshot: QongSnapshot) => QongInput,
) {
  const context = storyContext(selection, seed);
  const session = new QongSession(context, selection.pack.payload, "cpu");
  const inputs: QongInput[] = [];
  const trace: QongSnapshot[] = [];
  const reveals: QongPolarity[] = [];
  let recordedRevealRally = 0;
  let snapshot = session.snapshot();
  for (
    let tick = 0;
    tick < 12_000 && snapshot.phase !== "complete";
    tick += 1
  ) {
    const input = inputFor(snapshot);
    inputs.push(input);
    snapshot = session.step(input);
    trace.push(snapshot);
    if (
      snapshot.rallyReveal !== null &&
      snapshot.rallyNumber !== recordedRevealRally
    ) {
      recordedRevealRally = snapshot.rallyNumber;
      reveals.push(snapshot.rallyReveal.polarity);
    }
  }
  return { context, final: snapshot, inputs, trace, reveals };
}

function storyContext(
  selection: QongStoryPackSelection,
  seed: number,
): RunContext {
  return createRunContext({
    gameId: "qong",
    storyStage: "qong",
    playMode: "story",
    rulesVersion: QONG_RULES_VERSION,
    runSeed: seed,
    pack: {
      packId: selection.pack.packId,
      contentSha256: selection.pack.contentSha256,
      schemaVersion: selection.pack.schemaVersion,
      source: selection.pack.source,
    },
    packSelection: selection.receipt,
  });
}
