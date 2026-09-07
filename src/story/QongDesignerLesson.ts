import type {
  QongPackSelectionReceipt,
  QongQpuPlayPack,
} from "../games/qong/qongStoryPackBank";

export const QONG_DESIGNER_LESSON_VERSION = "qong-designer-lesson-v1";

export type QongDesignerStage =
  | "arrival"
  | "rule"
  | "offer"
  | "prepare"
  | "hadamard"
  | "measure"
  | "map"
  | "pack"
  | "selector"
  | "recovery";

export type QongDesignerAction =
  | "continue"
  | "prepare-zero"
  | "apply-hadamard"
  | "reveal-recorded-measurement"
  | "map-direct"
  | "map-invert"
  | "assemble-rally-pack"
  | "show-selector"
  | "recover-formula";

export interface QongDesignerState {
  readonly version: typeof QONG_DESIGNER_LESSON_VERSION;
  readonly stage: QongDesignerStage;
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly feedback: string | null;
  readonly firstMeasurement: {
    readonly rallyId: string;
    readonly outcome: "heads" | "tails";
    readonly bit: 0 | 1;
    readonly polarity: "direct" | "invert";
    readonly mothJobId: string;
    readonly hardwareJobId: string;
    readonly backendName: string;
    readonly shots: number;
    readonly heads: number;
    readonly tails: number;
    readonly acquiredAt: string;
  };
  readonly rallies: readonly {
    readonly rallyId: string;
    readonly outcome: "heads" | "tails";
    readonly bit: 0 | 1;
    readonly polarity: "direct" | "invert";
  }[];
  readonly selection: {
    readonly bits: readonly [0 | 1, 0 | 1];
    readonly bitIndices: readonly [number, number];
    readonly selectedPackIndex: number;
    readonly selectedPackId: string;
    readonly selectorPackId: string;
    readonly cycle: number;
    readonly reused: boolean;
  };
  readonly provenance: {
    readonly engineId: string;
    readonly engineRecordSha256: string;
    readonly apiSpecificationSha256: string;
    readonly playPackSha256: string;
    readonly selectorPackSha256: string;
    readonly activePlayNetwork: "none";
    readonly firstRallyPostselection: {
      readonly strategy: "first-four-tails-in-32-candidate-pool-v1";
      readonly candidatePoolSize: 32;
      readonly selectedCandidateItemId: string;
      readonly selectedCandidateOrdinal: number;
      readonly selectedTailRank: number;
      readonly preflightContentSha256: string;
      readonly candidatePoolCaptureSetSha256: string;
    } | null;
  };
}

const STAGES: readonly QongDesignerStage[] = [
  "arrival",
  "rule",
  "offer",
  "prepare",
  "hadamard",
  "measure",
  "map",
  "pack",
  "selector",
  "recovery",
];

export class QongDesignerLesson {
  private stageIndex = 0;
  private feedback: string | null = null;
  private readonly evidence: Omit<
    QongDesignerState,
    "version" | "stage" | "stepNumber" | "stepCount" | "feedback"
  >;

  public constructor(pack: QongQpuPlayPack, receipt: QongPackSelectionReceipt) {
    if (
      receipt.selectedPackId !== pack.packId ||
      receipt.selectedPackContentSha256 !== pack.contentSha256
    ) {
      throw new Error(
        "Designer lesson evidence does not match the played pack.",
      );
    }
    const firstJob = pack.qpuProvenance.jobs[0];
    if (!firstJob)
      throw new Error("Designer lesson requires rally r01 evidence.");
    const firstBit = outcomeBit(firstJob.outcome);
    const firstPolarity = outcomePolarity(firstJob.outcome);
    this.evidence = deepFreeze({
      firstMeasurement: {
        rallyId: firstJob.itemId,
        outcome: firstJob.outcome,
        bit: firstBit,
        polarity: firstPolarity,
        mothJobId: firstJob.mothJobId,
        hardwareJobId: firstJob.hardwareJobId,
        backendName: firstJob.backendName,
        shots: firstJob.shots,
        heads: firstJob.heads,
        tails: firstJob.tails,
        acquiredAt: pack.qpuProvenance.acquiredAt,
      },
      rallies: pack.qpuProvenance.jobs.map((job) => ({
        rallyId: job.itemId,
        outcome: job.outcome,
        bit: outcomeBit(job.outcome),
        polarity: outcomePolarity(job.outcome),
      })),
      selection: {
        bits: [...receipt.selectorBits] as [0 | 1, 0 | 1],
        bitIndices: [...receipt.selectorBitIndices] as [number, number],
        selectedPackIndex: receipt.selectedPackIndex,
        selectedPackId: receipt.selectedPackId,
        selectorPackId: receipt.selectorPackId,
        cycle: receipt.selectorCycle,
        reused: receipt.reusedSelectorBits,
      },
      provenance: {
        engineId: pack.engineId,
        engineRecordSha256: pack.qpuProvenance.canonicalEngineRecordSha256,
        apiSpecificationSha256:
          pack.qpuProvenance.apiSpecificationCanonicalSha256,
        playPackSha256: pack.contentSha256,
        selectorPackSha256: receipt.selectorContentSha256,
        activePlayNetwork: "none",
        firstRallyPostselection:
          "postselection" in pack.qpuProvenance &&
          pack.qpuProvenance.postselection !== null
            ? { ...pack.qpuProvenance.postselection }
            : null,
      },
    });
  }

  public snapshot(): QongDesignerState {
    const stage = STAGES[this.stageIndex];
    if (!stage) throw new Error("Designer lesson entered an unknown stage.");
    return deepFreeze({
      version: QONG_DESIGNER_LESSON_VERSION,
      stage,
      stepNumber: this.stageIndex + 1,
      stepCount: STAGES.length,
      feedback: this.feedback,
      ...this.evidence,
    });
  }

  public dispatch(action: QongDesignerAction): QongDesignerState {
    const stage = this.snapshot().stage;
    this.feedback = null;
    if (
      (stage === "arrival" || stage === "rule" || stage === "offer") &&
      action === "continue"
    ) {
      this.stageIndex += 1;
    } else if (stage === "prepare" && action === "prepare-zero") {
      this.stageIndex += 1;
    } else if (stage === "hadamard" && action === "apply-hadamard") {
      this.stageIndex += 1;
    } else if (
      stage === "measure" &&
      action === "reveal-recorded-measurement"
    ) {
      this.stageIndex += 1;
    } else if (
      stage === "map" &&
      (action === "map-direct" || action === "map-invert")
    ) {
      const selected = action === "map-direct" ? "direct" : "invert";
      if (selected === this.evidence.firstMeasurement.polarity) {
        this.stageIndex += 1;
        this.feedback =
          selected === "direct"
            ? "Correct. A recorded 0 / heads became OPPOSITE GOAL."
            : "Correct. A recorded 1 / tails became OWN GOAL.";
      } else {
        this.feedback =
          this.evidence.firstMeasurement.bit === 0
            ? "Not this time. The installed table maps 0 / heads to OPPOSITE GOAL."
            : "Not this time. The installed table maps 1 / tails to OWN GOAL.";
      }
    } else if (stage === "pack" && action === "assemble-rally-pack") {
      this.stageIndex += 1;
    } else if (stage === "selector" && action === "show-selector") {
      this.stageIndex += 1;
    } else if (stage === "recovery" && action === "recover-formula") {
      this.feedback = "RULE STATE recovered.";
    } else {
      throw new Error(
        `Action ${action} cannot bypass Designer stage ${stage}.`,
      );
    }
    return this.snapshot();
  }

  public defaultAction(): QongDesignerAction | null {
    switch (this.snapshot().stage) {
      case "arrival":
      case "rule":
      case "offer":
        return "continue";
      case "prepare":
        return "prepare-zero";
      case "hadamard":
        return "apply-hadamard";
      case "measure":
        return "reveal-recorded-measurement";
      case "map":
        return null;
      case "pack":
        return "assemble-rally-pack";
      case "selector":
        return "show-selector";
      case "recovery":
        return "recover-formula";
    }
  }
}

function outcomeBit(outcome: "heads" | "tails"): 0 | 1 {
  return outcome === "heads" ? 0 : 1;
}

function outcomePolarity(outcome: "heads" | "tails"): "direct" | "invert" {
  return outcome === "heads" ? "direct" : "invert";
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
