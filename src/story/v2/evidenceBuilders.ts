import type { QongStoryPackSelection } from "../../games/qong/qongStoryPackBank";
import type { QongSnapshot } from "../../games/qong/types";
import type { SkiPixlCommittedPack } from "../../games/skipixl/SkiPixlCourseAdapter";
import type { SkiPixlSnapshot } from "../../games/skipixl/types";
import type { FluxballSnapshot } from "../../games/fluxball/types";
import type { FluxballCommittedPack } from "../../games/fluxball/fluxballControlPacks";
import { type QuantmanSyntheticRuntimeSnapshot } from "../../games/quantmanSynthetic";
import type { QuantmanQpuFixtureSelection } from "../../games/quantmanSynthetic/labyrinth/types";
import {
  QUAG_DIRECTED_EDGE_ORDER,
  QUAG_REMEASUREMENT_INTERVAL_TICKS,
} from "../../games/quag/QuagSession";
import type { QuagSnapshot } from "../../games/quag/types";
import { sampleWholeRegisterFrame } from "../../games/qgraph/QGraphPack";
import type { QuarryQpuPackSelection } from "../../games/qgraph/quarryQpuBank";
import type {
  StoryV2FluxballEvidenceDetail,
  StoryV2QongEvidenceDetail,
  StoryV2QuantmanEvidenceDetail,
  StoryV2QuarryEvidenceDetail,
  StoryV2SkiPixlEvidenceDetail,
} from "./types";

export function createQongPresentationEvidenceDetail(
  selection: QongStoryPackSelection,
  snapshot?: QongSnapshot,
): StoryV2QongEvidenceDetail {
  const job = selection.pack.qpuProvenance.jobs[0];
  const polarity = selection.pack.payload.rallyPolarities?.[0];
  if (!job || !polarity) {
    throw new Error("Qong presentation evidence cannot resolve rally one.");
  }
  const bit = job.outcome === "heads" ? 0 : 1;
  const mappedGoal = polarity === "direct" ? "OPPOSITE" : "OWN";
  return deepFreeze({
    kind: "qong",
    sourceStatus: "recorded-moth-qpu",
    selector: {
      selectorPackId: selection.receipt.selectorPackId,
      selectorContentSha256: selection.receipt.selectorContentSha256,
      bitIndices: [...selection.receipt.selectorBitIndices],
      bits: [...selection.receipt.selectorBits],
      selectedPackIndex: selection.receipt.selectedPackIndex,
      selectedPackId: selection.receipt.selectedPackId,
      selectedPackContentSha256: selection.receipt.selectedPackContentSha256,
    },
    storedResult: {
      rallyNumber: 1,
      bit,
      outcome: job.outcome,
      mappedGoal,
      mothJobId: job.mothJobId,
      hardwareJobId: job.hardwareJobId,
      backendName: job.backendName,
      rawResultSha256: job.rawResultSha256,
    },
    ...(snapshot
      ? {
          finalCourt: {
            tick: snapshot.tick,
            rallyNumber: snapshot.rallyNumber,
            totalRallies: snapshot.totalRallies,
            leftScore: snapshot.leftScore,
            rightScore: snapshot.rightScore,
            observationsRemaining: snapshot.observationsRemaining,
            measurementState: snapshot.measurementState,
            goalRule: snapshot.goalRule,
            ball: { ...snapshot.ball },
            leftPaddleY: snapshot.leftPaddleY,
            rightPaddleY: snapshot.rightPaddleY,
            winner: snapshot.winner,
          },
        }
      : {}),
  });
}

export function createSkiPixlPresentationEvidenceDetail(
  pack: SkiPixlCommittedPack,
  snapshot: Pick<
    SkiPixlSnapshot,
    "storyQualified" | "elapsedSeconds" | "collisions" | "gateResults"
  >,
): StoryV2SkiPixlEvidenceDetail {
  const payload = pack.payload;
  const receipt = payload.receipt;
  const tripletId =
    payload.tripletId ?? ("tripletId" in receipt ? receipt.tripletId : null);
  const cutId = payload.cutId ?? ("cutId" in receipt ? receipt.cutId : null);
  if (!tripletId || !cutId || receipt.segments.length !== 3) {
    throw new Error(
      "SkiPixl presentation evidence requires a current three-segment cut.",
    );
  }
  const gate = payload.gates?.[0] ?? null;
  const obstacle = gate
    ? payload.obstacles.find(
        (candidate) => candidate.obstacleId === gate.sourceObstacleId,
      )
    : payload.obstacles[0];
  if (!obstacle) {
    throw new Error(
      "SkiPixl presentation evidence requires one mapped obstacle.",
    );
  }
  const passedGateCount = snapshot.gateResults.filter(
    ({ passed }) => passed,
  ).length;
  return deepFreeze({
    kind: "skipixl",
    sourceStatus: "recorded-moth-platform-qpu-capture",
    tripletId,
    cutId,
    decoderVersion: payload.decoderVersion,
    bankId: receipt.bankId,
    bankContentSha256: receipt.bankContentSha256,
    selectionThreshold: receipt.selectionThreshold,
    attempt: {
      qualified: snapshot.storyQualified,
      elapsedSeconds: snapshot.elapsedSeconds,
      collisionCount: snapshot.collisions.length,
      gateCount: snapshot.gateResults.length,
      passedGateCount,
      missedGateCount: snapshot.gateResults.length - passedGateCount,
    },
    segments: receipt.segments.map((segment) => ({
      segmentId: segment.segmentId,
      sourceSha256: segment.sourceSha256,
      returnedValuesSha256: segment.returnedValuesSha256,
      mothJobId: segment.mothJobId,
      ibmJobId: segment.ibmJobId,
    })),
    mappedExample: {
      segmentId: obstacle.segmentId,
      cellIndex: obstacle.cellIndex,
      residual: obstacle.residual,
      kind: obstacle.kind,
      obstacleId: obstacle.obstacleId,
      x: obstacle.x,
      distance: obstacle.distance,
      gateId: gate?.gateId ?? null,
    },
  });
}

export function createFluxballPresentationEvidenceDetail(
  _pack: FluxballCommittedPack,
  snapshot: FluxballSnapshot,
): StoryV2FluxballEvidenceDetail {
  const reveal = snapshot.reveal;
  const epoch = reveal?.epochs.at(-1);
  if (!reveal || !epoch) {
    throw new Error(
      "Fluxball presentation evidence requires a completed rule epoch.",
    );
  }
  const provider = epoch.trace.providerProvenance ?? null;
  return deepFreeze({
    kind: "fluxball",
    sourceStatus:
      epoch.trace.acquisitionSource === "moth-qgraph-qpu" && provider
        ? "recorded-moth-qpu"
        : "local-synthetic-control",
    ruleMode: snapshot.format.ruleMode,
    fixtureBankId: epoch.trace.fixtureBankId,
    fixtureId: epoch.trace.fixtureId,
    acquisitionSource: epoch.trace.acquisitionSource,
    roundNumber: reveal.roundNumber,
    stateIndex: epoch.stateIndex,
    sourceRoundBuckets: [...epoch.sourceRoundBuckets],
    provider: provider
      ? {
          mothJobId: provider.mothJobId,
          ibmJobId: provider.ibmJobId,
          backendName: provider.backendName,
          rawResultSha256: provider.rawResultSha256,
        }
      : null,
    mappedAxes: (["X", "Y", "Z"] as const).map((axisName) => {
      const axis = epoch.trace.axes[axisName];
      return {
        dimension: axis.dimension,
        outcome: axis.outcome,
        playerRules: epoch.trace.activePlayerIds.map((playerId) => {
          const rules = epoch.rules.players[playerId];
          if (!rules)
            throw new Error(`Fluxball epoch omits Player ${playerId}.`);
          const rule =
            axis.dimension === "ACTION"
              ? rules.action
              : axis.dimension === "INTERACTION"
                ? rules.interaction
                : rules.purpose;
          return `${playerId}:${rule}`;
        }),
      };
    }),
  });
}

export function createQuantmanPresentationEvidenceDetail(
  selection: QuantmanQpuFixtureSelection,
  snapshot: QuantmanSyntheticRuntimeSnapshot,
): StoryV2QuantmanEvidenceDetail {
  const { bank, topology, fixture, authority } = selection;
  const recordIndex = fixture.records.findIndex(
    (candidate) =>
      candidate.bitstring === snapshot.simulation.topologyBitstring,
  );
  const record = fixture.records[recordIndex];
  const provenance = fixture.provenance;
  if (
    !record ||
    provenance.sourceType !== "qpu" ||
    provenance.engineId !== "labyrinth-v1" ||
    !provenance.mothJobId ||
    !provenance.hardwareJobId ||
    !provenance.backend ||
    !provenance.rawResultSha256 ||
    !provenance.shots ||
    authority.fixtureId !== fixture.fixtureId ||
    authority.fixtureContentSha256 !== fixture.contentSha256 ||
    !authority.admissibility.runtimeEligible
  ) {
    throw new Error(
      "Quantman presentation evidence cannot resolve its QPU fixture.",
    );
  }
  const bitA = Number(record.bitstring[0]) as 0 | 1;
  const bitB = Number(record.bitstring[1]) as 0 | 1;
  const equalParity = bitA === bitB;
  return deepFreeze({
    kind: "quantman",
    sourceStatus: "recorded-moth-qpu",
    mechanic: snapshot.run.mechanic,
    bank,
    topology: {
      topologyId: topology.topologyId,
      label: topology.label,
      authoredTopologySha256: topology.authoredTopologySha256,
      captureCount: topology.captureFixtureIds.length,
    },
    fixtureId: fixture.fixtureId,
    fixtureContentSha256: fixture.contentSha256,
    provider: {
      engineId: provenance.engineId,
      mothJobId: provenance.mothJobId,
      hardwareJobId: provenance.hardwareJobId,
      backendName: provenance.backend,
      rawResultSha256: authority.rawResultSha256,
      redactedRequestSha256: authority.redactedRequestSha256,
      captureContentSha256: authority.captureContentSha256,
      requestedShots: authority.requestedShots,
      returnedMeasurementCount: fixture.records.reduce(
        (sum, candidate) => sum + candidate.weight,
        0,
      ),
    },
    filtering: {
      filterId: authority.admissibility.filterId,
      admittedRecordCount: authority.admissibility.summary.admittedRecordCount,
      admittedWeight: authority.admissibility.summary.admittedWeight,
      excludedRecordCount: authority.admissibility.summary.excludedRecordCount,
      excludedWeight: authority.admissibility.summary.excludedWeight,
    },
    bitParityExample: {
      recordIndex,
      roomA: 0,
      roomB: 1,
      bitA,
      bitB,
      equalParity,
      passage: equalParity ? "OPEN" : "WALL",
    },
  });
}

export function createQuarryPresentationEvidenceDetail(
  selection: QuarryQpuPackSelection,
  snapshot: QuagSnapshot,
  runSeed: number,
): StoryV2QuarryEvidenceDetail {
  const { pack, indexEntry, sourceBank } = selection;
  if (pack.provenance.kind !== "qpu-record") {
    throw new Error("Quarry presentation evidence requires a QPU record.");
  }
  const sampledSchedule = pack.frames.map((_, frameIndex) => {
    const sample = sampleWholeRegisterFrame(pack, frameIndex, runSeed);
    return {
      phase: frameIndex + 1,
      frameId: sample.frame.frameId,
      bitstring: sample.bitstring,
      directedRelations: QUAG_DIRECTED_EDGE_ORDER.filter(
        (_edge, index) => sample.bitstring[index] === "1",
      ),
    };
  });
  const examplePhase = sampledSchedule.find(
    (phase) => phase.directedRelations.length > 0,
  );
  const edge = examplePhase?.directedRelations[0];
  if (!examplePhase || !edge) {
    throw new Error("Quarry QPU schedule has no concrete directed relation.");
  }
  return deepFreeze({
    kind: "quarry",
    sourceStatus: "recorded-moth-qpu",
    arenaId: snapshot.arenaId,
    remeasurementIntervalTicks: QUAG_REMEASUREMENT_INTERVAL_TICKS,
    bitOrdering: pack.bitOrdering,
    sampledSchedule,
    relationExample: {
      phase: examplePhase.phase,
      frameId: examplePhase.frameId,
      edge,
    },
    provider: {
      selectedPackId: pack.packId,
      selectedPackContentSha256: pack.contentSha256,
      selectedPackIndex: selection.selectedPackIndex,
      recipeFamily: indexEntry.recipeFamily,
      realizationId: indexEntry.realizationId,
      sourceBankId: sourceBank.bankId,
      sourceBankContentSha256: sourceBank.compiledBankContentSha256,
      sourceCampaignId: indexEntry.sourceCampaignId,
      sourceBankVersion: indexEntry.sourceBankVersion,
      redactedRequestSha256: indexEntry.redactedRequestSha256,
      captureContentSha256: indexEntry.captureContentSha256,
      mothJobId: pack.provenance.mothJobId,
      hardwareJobId: pack.provenance.hardwareJobId,
      backendName: pack.provenance.backendName,
      rawResultSha256: pack.provenance.rawResultSha256,
      requestedShots: pack.provenance.requestedShots,
      returnedShotCount: pack.provenance.returnedShotCount,
      returnedMeasurementCount: pack.provenance.returnedMeasurementCount,
      returnedProbabilityMass: pack.provenance.returnedProbabilityMass,
      distributionProjection: pack.provenance.distributionProjection,
    },
    claimBoundary:
      "The provider returned a ranked projection of measured outcomes. Runtime sampling renormalizes only those preserved outcomes, while the twelve-second phase timing remains a local game rule.",
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
