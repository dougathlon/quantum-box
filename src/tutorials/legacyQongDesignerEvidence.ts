/**
 * Compatibility shape for authenticated Qong evidence persisted by save v5.
 *
 * The physical Designer lesson that originally produced this state is retired.
 * Save migration still validates these immutable fields without reinstating the
 * old scene or changing any recorded hashes.
 */
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
