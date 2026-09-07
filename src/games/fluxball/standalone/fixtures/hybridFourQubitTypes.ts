import type { PlayerId } from "../modes";
import type {
  CircuitIdentity,
  Context,
  ContextDistributions,
  DensityMatrix,
  VerifiedGitSource,
} from "./types";
import type {
  FourContextDistributions,
  FourCountVector,
} from "./fourQubitTypes";

export const HYBRID_EDGE_IDS = ["A-C", "A-D", "B-C", "B-D"] as const;
export type HybridEdgeId = (typeof HYBRID_EDGE_IDS)[number];

export const HYBRID_MEASUREMENT_SETTINGS = [
  "XXXX",
  "XXYY",
  "XXZZ",
  "YYXX",
  "YYYY",
  "YYZZ",
  "ZZXX",
  "ZZYY",
  "ZZZZ",
] as const;
export type HybridMeasurementSetting =
  (typeof HYBRID_MEASUREMENT_SETTINGS)[number];

export interface HybridEdgeArtifact {
  readonly edgeId: HybridEdgeId;
  readonly canonicalEdge: readonly [number, number];
  readonly playerOrder: readonly [PlayerId, PlayerId];
  readonly matrixOrder: string;
  readonly densityMatrix: DensityMatrix;
  readonly pauliExpectations: Readonly<Record<string, number>>;
  readonly distributions: ContextDistributions;
  readonly productMarginalsControl: ContextDistributions;
  readonly fullRegisterMarginals: ContextDistributions;
  readonly finiteVsFullRegisterMarginalTotalVariation: Readonly<
    Record<Context, number>
  >;
}

export interface HybridFourQubitAcquisitionRecord {
  readonly backendClass: "AerSimulator";
  readonly backendName: "aer_simulator";
  readonly providerMode: "local-aer";
  readonly providerName: "qiskit-aer";
  readonly mothApi: false;
  readonly jobId: string;
  readonly shotsPerCircuit: number;
  readonly simulatorSeed: number;
  readonly transpilerSeed: number;
  readonly characterizationCircuitCount: 9;
  readonly measurementSettings: typeof HYBRID_MEASUREMENT_SETTINGS;
  readonly uniformGameplaySettings: Readonly<{
    X: "XXXX";
    Y: "YYYY";
    Z: "ZZZZ";
  }>;
  readonly totalShots: number;
  readonly logicalMeasurementCircuitQasm: readonly string[];
  readonly logicalMeasurementCircuitSha256: readonly string[];
  readonly transpiledAerCircuitQasm: readonly string[];
  readonly transpiledAerCircuitSha256: readonly string[];
  readonly tomographyRawCounts: Readonly<
    Record<HybridMeasurementSetting, FourCountVector>
  >;
  readonly tomographyRawCountsSha256: string;
  readonly fullRegisterRawCounts: Readonly<Record<Context, FourCountVector>>;
  readonly durableProviderResult: false;
  readonly hardwareLayout: null;
  readonly backendCalibration: null;
  readonly fallbackFrom: null;
}

export interface HybridFourQubitFixtureRecord {
  readonly fixtureId: "fluxball-four-player-hybrid-preparation-v1";
  readonly circuit: CircuitIdentity;
  readonly acquisition: HybridFourQubitAcquisitionRecord;
  readonly derivation: {
    readonly method: "joint-counts-plus-pairwise-lstsq-psd";
    readonly outcomeOrder: "q0-q1-q2-q3 / A-B-C-D";
    readonly qiskitCountOrder: "c3-c2-c1-c0 reversed to q0-q1-q2-q3";
    readonly pairMatrixOrder: "higher-qubit tensor lower-qubit";
    readonly gameplaySource: "uniform full-register count frequencies";
    readonly edgeRole: "explanation and diagnostics only";
  };
  readonly distributions: FourContextDistributions;
  readonly productMarginalsControl: FourContextDistributions;
  readonly pairs: Readonly<Record<HybridEdgeId, HybridEdgeArtifact>>;
  readonly exactStateDiagnostic: {
    readonly acquisitionSource: "exact-statevector";
    readonly distributions: FourContextDistributions;
    readonly pairs: Readonly<
      Record<
        HybridEdgeId,
        {
          readonly distributions: ContextDistributions;
          readonly pauliExpectations: Readonly<Record<string, number>>;
        }
      >
    >;
  };
}

export interface HybridEdgeDiagnostic {
  readonly finiteVsExactTotalVariation: Readonly<Record<Context, number>>;
  readonly finiteVsFullRegisterMarginalTotalVariation: Readonly<
    Record<Context, number>
  >;
  readonly finiteProductMarginalsTotalVariation: Readonly<
    Record<Context, number>
  >;
}

export interface HybridFourQubitFixtureBank {
  readonly schemaVersion: "fluxball-four-qubit-hybrid-fixture-bank-v1";
  readonly fixtureBankId: "fluxball-aer-four-qubit-hybrid-v1";
  readonly defaultFixtureId: "fluxball-four-player-hybrid-preparation-v1";
  readonly compiledAt: string;
  readonly deliveryMode: "committed-fixture";
  readonly acquisitionSource: "finite-shot-aer";
  readonly derivationMethod: "joint-counts-plus-pairwise-lstsq-psd";
  readonly model: {
    readonly modelId: "fluxball-four-qubit-rulefield-hybrid-v1";
    readonly numQubits: 4;
    readonly playerOrder: readonly ["A", "B", "C", "D"];
    readonly qubitMap: readonly {
      readonly qubit: number;
      readonly playerId: PlayerId;
      readonly displayName: string;
    }[];
    readonly configuredEdges: readonly (readonly [number, number])[];
    readonly characterizedEdges: readonly (readonly [number, number])[];
    readonly topologyKind: "four-player-court-ring";
    readonly initialCircuit: CircuitIdentity;
  };
  readonly provenance: {
    readonly python: string;
    readonly platform: string;
    readonly packageVersions: {
      readonly quantumgraph: "0.0.1";
      readonly "pairwise-tomography": "0.1.0";
      readonly qiskit: "2.2.3";
      readonly "qiskit-aer": "0.17.2";
      readonly numpy: "2.0.2";
      readonly scipy: "1.13.1";
    };
    readonly quantumGraphCommit: "6917364b9496bd324225e87e6dd986bce52ecefd";
    readonly pairwiseTomographyCommit: "dbab12513281bd8ca7828252cf2e98a1a5749761";
    readonly verifiedSources: {
      readonly quantumgraph: VerifiedGitSource;
      readonly "pairwise-tomography": VerifiedGitSource;
    };
    readonly sourceRelationship: string;
    readonly lineage: string;
    readonly qpu: false;
    readonly remoteService: false;
    readonly mothApi: false;
  };
  readonly costEstimate: {
    readonly fixtureCount: 1;
    readonly characterizationCircuitsPerFixture: 9;
    readonly totalCircuitExecutions: 9;
    readonly shotsPerCircuit: number;
    readonly totalShots: number;
  };
  readonly fixtures: {
    readonly "fluxball-four-player-hybrid-preparation-v1": HybridFourQubitFixtureRecord;
  };
  readonly calibration: {
    readonly status: "accepted-for-local-prototype";
    readonly selectionMethod: "authored-rule-legibility-calibration";
    readonly finiteMinimumOutcomeProbability: number;
    readonly finiteMaximumOutcomeProbability: number;
    readonly finiteParityPlusProbability: Readonly<Record<Context, number>>;
    readonly finitePlayerPlusMarginals: Readonly<
      Record<Context, Readonly<Record<PlayerId, number>>>
    >;
    readonly finiteProductMarginalsTotalVariation: Readonly<
      Record<Context, number>
    >;
    readonly finiteVsExactTotalVariation: Readonly<Record<Context, number>>;
    readonly claimBoundary: string;
    readonly edgeDiagnostics: {
      readonly byEdge: Readonly<Record<HybridEdgeId, HybridEdgeDiagnostic>>;
      readonly maximumFiniteVsExactTotalVariation: number;
      readonly maximumFiniteVsFullRegisterMarginalTotalVariation: number;
    };
  };
}
