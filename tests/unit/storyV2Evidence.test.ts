import { beforeAll, describe, expect, it } from "vitest";

import { createRunContext, type RunContext } from "../../src/core/run";
import {
  loadInstalledQongStoryBank,
  selectQongStoryPack,
  type QongStoryPackSelection,
} from "../../src/games/qong/qongStoryPackBank";
import type { QongSnapshot } from "../../src/games/qong/types";
import {
  loadInstalledQuarryQpuBank,
  selectQuarryQpuPack,
} from "../../src/games/qgraph/quarryQpuBank";
import { QuagSession } from "../../src/games/quag/QuagSession";
import { QUAG_RULES_VERSION } from "../../src/games/quag/types";
import {
  QUANTMAN_QPU_RULES_VERSION,
  QuantmanSyntheticRuntime,
  loadInstalledQuantmanQpuBank,
  selectQuantmanQpuFixture,
} from "../../src/games/quantmanSynthetic";
import { SaveRepository } from "../../src/save/SaveRepository";
import {
  StoryV2PresentationMachine,
  createLegacyStoryV2PresentationEvidence,
  createQongPresentationEvidenceDetail,
  createQuarryPresentationEvidenceDetail,
  createQuantmanPresentationEvidenceDetail,
  createStoryV2PresentationEvidence,
  storyV2TerminalPresentation,
  validateStoryV2PresentationEvidence,
} from "../../src/story/v2";

const QONG_QUALIFICATION_SHA = "1".repeat(64);
const QUANTMAN_QUALIFICATION_SHA = "2".repeat(64);
const QUARRY_QUALIFICATION_SHA = "3".repeat(64);
const QONG_FINAL_COURT: QongSnapshot = Object.freeze({
  phase: "complete",
  tick: 733,
  rallyNumber: 7,
  totalRallies: 7,
  leftScore: 4,
  rightScore: 3,
  observationsRemaining: 1,
  measurementState: "resolved",
  goalRule: "own",
  ball: Object.freeze({ x: 320, y: 180 }),
  leftPaddleY: 134,
  rightPaddleY: 176,
  rallyReveal: null,
  winner: "left",
  storyEvidence: Object.freeze({
    humanObservationsUsed: 2,
    directionalRallyNumbers: Object.freeze([2, 5]),
  }),
});

let qongSelection: QongStoryPackSelection;
let qongRun: RunContext;

beforeAll(async () => {
  const bank = await loadInstalledQongStoryBank();
  qongSelection = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
  qongRun = createRunContext({
    gameId: "qong",
    storyStage: "qong",
    playMode: "story",
    rulesVersion: qongSelection.pack.rulesVersion,
    runSeed: 101,
    pack: {
      packId: qongSelection.pack.packId,
      contentSha256: qongSelection.pack.contentSha256,
      schemaVersion: qongSelection.pack.schemaVersion,
      source: qongSelection.pack.source,
    },
    packSelection: qongSelection.receipt,
  });
});

describe("Story v2 qualification evidence binding", () => {
  it("persists and reloads the same concrete Qong selector and provider receipt", () => {
    const evidence = createStoryV2PresentationEvidence(
      {
        stageId: "qong",
        run: qongRun,
        activeTick: 733,
        evidenceSha256: QONG_QUALIFICATION_SHA,
      },
      createQongPresentationEvidenceDetail(qongSelection, QONG_FINAL_COURT),
    );
    const storage = new MemoryStorage();
    const repository = new SaveRepository(storage, () => undefined);
    repository.recordPendingNarrativeBeat(qongRun, {
      beatId: "qong-opponent-paddle-morph",
      kind: "debrief",
      activeTick: 733,
      evidenceSha256: QONG_QUALIFICATION_SHA,
      presentationEvidence: evidence,
    });

    const reloaded = new SaveRepository(storage, () => undefined).snapshot()
      .story.pendingNarrativeBeat;
    expect(reloaded?.presentationEvidence).toEqual(evidence);
    expect(reloaded?.presentationEvidence.detail).toMatchObject({
      kind: "qong",
      selector: {
        bits: qongSelection.receipt.selectorBits,
        selectedPackId: qongSelection.pack.packId,
      },
      storedResult: {
        mothJobId: qongSelection.pack.qpuProvenance.jobs[0]?.mothJobId,
        hardwareJobId: qongSelection.pack.qpuProvenance.jobs[0]?.hardwareJobId,
      },
      finalCourt: {
        tick: 733,
        ball: { x: 320, y: 180 },
        leftPaddleY: 134,
        rightPaddleY: 176,
        winner: "left",
      },
    });

    const resumed = new StoryV2PresentationMachine(
      "qong",
      null,
      reloaded?.presentationEvidence ?? null,
    ).snapshot();
    expect(resumed.evidence).toEqual(evidence);

    const returned = storyV2TerminalPresentation(
      "qong-return",
      resumed.evidence,
    );
    expect(returned.evidenceStatus).toBe("bound");
    expect(returned.sourceStatus).toBe("recorded-moth-qpu");
    expect(JSON.stringify(returned)).toContain(
      qongSelection.pack.qpuProvenance.jobs[0]?.rawResultSha256,
    );
    expect(JSON.stringify(returned)).toContain(qongRun.runId);
  });

  it("rejects a receipt whose immutable run binding drifts", () => {
    const evidence = createStoryV2PresentationEvidence(
      {
        stageId: "qong",
        run: qongRun,
        activeTick: 733,
        evidenceSha256: QONG_QUALIFICATION_SHA,
      },
      createQongPresentationEvidenceDetail(qongSelection),
    );
    expect(() =>
      validateStoryV2PresentationEvidence(evidence, {
        stageId: "qong",
        run: qongRun,
        activeTick: 734,
        evidenceSha256: QONG_QUALIFICATION_SHA,
      }),
    ).toThrow("does not match its qualified run");
  });

  it("keeps legacy pending beats honest instead of inferring provider evidence", () => {
    const legacy = createLegacyStoryV2PresentationEvidence({
      stageId: "qong",
      run: qongRun,
      activeTick: 733,
      evidenceSha256: QONG_QUALIFICATION_SHA,
    });
    const returned = storyV2TerminalPresentation("qong-return", legacy);
    expect(returned).toMatchObject({
      sourceStatus: "unbound-legacy",
      evidenceStatus: "legacy-identity-only",
      sourceLabel: "LEGACY RUN IDENTITY ONLY",
      authorityLabel: "STAGE RECEIPT UNAVAILABLE",
    });
    expect(JSON.stringify(returned.lines)).toContain(
      "no stage-specific provider evidence is inferred",
    );
    expect(JSON.stringify(returned.details)).not.toContain("MOTH JOB");
  });

  it("binds Quantman's played maze to its exact IBM Fez return", async () => {
    const bank = await loadInstalledQuantmanQpuBank();
    const selection = selectQuantmanQpuFixture(bank, 107);
    const { fixture, authority } = selection;
    const runtime = new QuantmanSyntheticRuntime({
      playMode: "story",
      runSeed: 107,
      mechanic: "inverse-gaze",
      fixture,
      qpuAuthority: authority,
      rulesVersion: QUANTMAN_QPU_RULES_VERSION,
    });
    const snapshot = runtime.snapshot();
    const run = createRunContext({
      gameId: "quantman",
      storyStage: "quantman",
      playMode: "story",
      rulesVersion: QUANTMAN_QPU_RULES_VERSION,
      runSeed: 107,
      pack: {
        packId: fixture.fixtureId,
        contentSha256: fixture.contentSha256,
        schemaVersion: fixture.schemaVersion,
        source: "moth-api-qpu",
      },
    });
    const evidence = createStoryV2PresentationEvidence(
      {
        stageId: "quantman",
        run,
        activeTick: snapshot.simulation.activeTick,
        evidenceSha256: QUANTMAN_QUALIFICATION_SHA,
      },
      createQuantmanPresentationEvidenceDetail(selection, snapshot),
    );

    const played = storyV2TerminalPresentation("quantman-mapping", evidence);
    const source = storyV2TerminalPresentation("quantman-source", evidence);
    expect(played.sourceStatus).toBe("recorded-moth-qpu");
    expect(played.authorityLabel).toBe("GAMEPLAY AUTHORITY");
    expect(JSON.stringify(played)).toContain("ROOM 0 BIT");
    expect(JSON.stringify(played)).toContain("ROOM 1 BIT");
    expect(source.sourceStatus).toBe("recorded-moth-qpu");
    expect(source.authorityLabel).toBe("GAMEPLAY AUTHORITY");
    expect(JSON.stringify(source)).toContain(fixture.provenance.hardwareJobId);
    const returned = storyV2TerminalPresentation("quantman-return", evidence);
    expect(JSON.stringify(returned)).toContain("NO BIT OR WALL IS REPAIRED");
    expect(JSON.stringify(returned)).toContain(
      authority.admissibility.filterId,
    );
    expect(evidence.detail).toMatchObject({
      kind: "quantman",
      bank: {
        bankId: bank.bankId,
        contentSha256: bank.contentSha256,
      },
      topology: {
        topologyId: selection.topology.topologyId,
        authoredTopologySha256: selection.topology.authoredTopologySha256,
        captureCount: selection.topology.captureFixtureIds.length,
      },
      fixtureId: fixture.fixtureId,
    });
    expect(
      validateStoryV2PresentationEvidence(
        JSON.parse(JSON.stringify(evidence)),
        {
          stageId: "quantman",
          run,
          activeTick: snapshot.simulation.activeTick,
          evidenceSha256: QUANTMAN_QUALIFICATION_SHA,
        },
      ),
    ).toEqual(evidence);
  });

  it("preserves Quarry's source tranche and recipe identity through serialized Story evidence", async () => {
    const bank = await loadInstalledQuarryQpuBank();
    const selection = selectQuarryQpuPack(bank, 113);
    if (selection.pack.provenance.kind !== "qpu-record") {
      throw new Error("Installed Quarry selection is not a QPU record.");
    }
    const run = createRunContext({
      gameId: "quarry",
      storyStage: "quarry",
      playMode: "story",
      rulesVersion: QUAG_RULES_VERSION,
      runSeed: 113,
      pack: {
        packId: selection.pack.packId,
        contentSha256: selection.pack.contentSha256,
        schemaVersion: selection.pack.schemaVersion,
        source: selection.pack.sourceClassification,
      },
    });
    const snapshot = new QuagSession(run, selection.pack, {
      readyTicks: 0,
      cpuEnabled: false,
    }).snapshot();
    const evidence = createStoryV2PresentationEvidence(
      {
        stageId: "quarry",
        run,
        activeTick: snapshot.tick,
        evidenceSha256: QUARRY_QUALIFICATION_SHA,
      },
      createQuarryPresentationEvidenceDetail(selection, snapshot, run.runSeed),
    );
    const reloaded = validateStoryV2PresentationEvidence(
      JSON.parse(JSON.stringify(evidence)) as unknown,
      {
        stageId: "quarry",
        run,
        activeTick: snapshot.tick,
        evidenceSha256: QUARRY_QUALIFICATION_SHA,
      },
    );
    expect(reloaded).toEqual(evidence);
    expect(reloaded.detail).toMatchObject({
      kind: "quarry",
      provider: {
        selectedPackId: selection.pack.packId,
        selectedPackIndex: selection.selectedPackIndex,
        recipeFamily: selection.indexEntry.recipeFamily,
        realizationId: selection.indexEntry.realizationId,
        sourceCampaignId: selection.indexEntry.sourceCampaignId,
        sourceBankVersion: selection.indexEntry.sourceBankVersion,
        redactedRequestSha256: selection.indexEntry.redactedRequestSha256,
        captureContentSha256: selection.indexEntry.captureContentSha256,
        mothJobId: selection.pack.provenance.mothJobId,
        hardwareJobId: selection.pack.provenance.hardwareJobId,
      },
    });
    expect(
      storyV2TerminalPresentation("quarry-return", reloaded).sourceStatus,
    ).toBe("recorded-moth-qpu");

    const preCorpusEvidence = structuredClone(evidence) as any;
    for (const field of [
      "selectedPackId",
      "selectedPackContentSha256",
      "selectedPackIndex",
      "recipeFamily",
      "realizationId",
      "sourceBankId",
      "sourceBankContentSha256",
      "sourceCampaignId",
      "sourceBankVersion",
      "redactedRequestSha256",
      "captureContentSha256",
    ]) {
      delete preCorpusEvidence.detail.provider[field];
    }
    const retained = validateStoryV2PresentationEvidence(preCorpusEvidence, {
      stageId: "quarry",
      run,
      activeTick: snapshot.tick,
      evidenceSha256: QUARRY_QUALIFICATION_SHA,
    });
    expect(
      JSON.stringify(storyV2TerminalPresentation("quarry-return", retained)),
    ).not.toContain("HARDWARE PACK");

    const mismatchedPack = structuredClone(evidence) as any;
    mismatchedPack.detail.provider.selectedPackId = "other-pack";
    expect(() =>
      validateStoryV2PresentationEvidence(mismatchedPack, {
        stageId: "quarry",
        run,
        activeTick: snapshot.tick,
        evidenceSha256: QUARRY_QUALIFICATION_SHA,
      }),
    ).toThrow("does not match its run pack");
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  public get length(): number {
    return this.values.size;
  }

  public clear(): void {
    this.values.clear();
  }

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
