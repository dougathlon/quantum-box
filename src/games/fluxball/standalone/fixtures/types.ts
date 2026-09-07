export const CONTEXTS = ["X", "Y", "Z"] as const;
export type Context = (typeof CONTEXTS)[number];

export const OUTCOME_ORDER = ["pp", "pm", "mp", "mm"] as const;
export type OutcomeKey = (typeof OUTCOME_ORDER)[number];

export interface ProbabilityVector {
  readonly pp: number;
  readonly pm: number;
  readonly mp: number;
  readonly mm: number;
}

export interface ContextDistributions {
  readonly X: ProbabilityVector;
  readonly Y: ProbabilityVector;
  readonly Z: ProbabilityVector;
}

export type ComplexValue = readonly [real: number, imaginary: number];
export type DensityMatrix = readonly (readonly ComplexValue[])[];

export interface CircuitIdentity {
  readonly format: "OPENQASM 2";
  readonly sha256: string;
  readonly depth: number;
  readonly twoQubitDepth: number;
  readonly operationCounts: Readonly<Record<string, number>>;
  readonly serialization: string;
}

export interface PairArtifact {
  readonly canonicalEdge: readonly [0, 1];
  readonly matrixOrder: "hi-tensor-lo";
  readonly densityMatrix: DensityMatrix;
  readonly pauliExpectations: Readonly<Record<string, number>>;
  readonly distributions: ContextDistributions;
  readonly productMarginalsControl: ContextDistributions;
}

export interface AcquisitionRecord {
  readonly backendClass: "AerSimulator";
  readonly backendName: "aer_simulator";
  readonly providerMode: "local-aer";
  readonly providerName: "qiskit-aer";
  readonly mothApi: false;
  readonly jobId: string;
  readonly shotsPerCircuit: number;
  readonly simulatorSeed: number;
  readonly transpilerSeed: number;
  readonly tomographyCircuitCount: 9;
  readonly tomographyMeasurementSettings: readonly [
    "XX",
    "XY",
    "XZ",
    "YX",
    "YY",
    "YZ",
    "ZX",
    "ZY",
    "ZZ",
  ];
  readonly totalShots: number;
  readonly logicalMeasurementCircuitQasm: readonly string[];
  readonly logicalMeasurementCircuitSha256: readonly string[];
  readonly transpiledAerCircuitQasm: readonly string[];
  readonly transpiledAerCircuitSha256: readonly string[];
  readonly rawCountsSha256: string;
  readonly durableProviderResult: false;
  readonly hardwareLayout: null;
  readonly backendCalibration: null;
  readonly fallbackFrom: null;
}

export interface FixtureRecord {
  readonly fixtureId: "fluxball-preparation-v1";
  readonly circuit: CircuitIdentity;
  readonly acquisition: AcquisitionRecord;
  readonly derivation: {
    readonly method: "lstsq-psd";
    readonly matrixOrder: "hi-tensor-lo";
    readonly probabilityProjectors: "Pi_hi tensor Pi_lo";
    readonly maxFiniteVsExactTotalVariation: number;
  };
  readonly pair: PairArtifact;
  readonly exactStateDiagnostic: {
    readonly acquisitionSource: "exact-statevector";
    readonly pair: {
      readonly distributions: ContextDistributions;
      readonly pauliExpectations: Readonly<Record<string, number>>;
    };
  };
}

export interface VerifiedGitSource {
  readonly url: string;
  readonly vcs: "git";
  readonly commit: string;
  readonly requestedRevision: string;
  readonly directUrlSha256: string;
}

export interface FixtureBank {
  readonly schemaVersion: "fluxball-fixture-bank-v1";
  readonly fixtureBankId: "fluxball-aer-two-qubit-v1";
  readonly defaultFixtureId: "fluxball-preparation-v1";
  readonly compiledAt: string;
  readonly deliveryMode: "committed-fixture";
  readonly acquisitionSource: "finite-shot-aer";
  readonly derivationMethod: "lstsq-psd";
  readonly model: {
    readonly modelId: "fluxball-two-qubit-rulefield-v1";
    readonly numQubits: 2;
    readonly qubitMap: readonly [
      {
        readonly qubit: 0;
        readonly playerId: "A";
        readonly displayName: "Player A";
      },
      {
        readonly qubit: 1;
        readonly playerId: "B";
        readonly displayName: "Player B";
      },
    ];
    readonly configuredEdges: readonly [readonly [0, 1]];
    readonly topologyKind: "single-two-qubit-rule-relation";
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
    readonly qpu: false;
    readonly remoteService: false;
    readonly mothApi: false;
  };
  readonly costEstimate: {
    readonly fixtureCount: 1;
    readonly tomographyCircuitsPerFixture: 9;
    readonly totalCircuitExecutions: 9;
    readonly shotsPerCircuit: number;
    readonly totalShots: number;
  };
  readonly fixtures: {
    readonly "fluxball-preparation-v1": FixtureRecord;
  };
  readonly calibration: {
    readonly status: "accepted-for-local-prototype";
    readonly selectionMethod: "authored-rule-legibility-calibration";
    readonly finiteMinimumOutcomeProbability: number;
    readonly finiteMaximumOutcomeProbability: number;
    readonly finiteSameParityProbability: Readonly<Record<Context, number>>;
    readonly finiteProductMarginalsTotalVariation: Readonly<
      Record<Context, number>
    >;
    readonly claimBoundary: string;
  };
}

export type DistributionSource = "fitted" | "product-control";

export interface ResolvedDistribution {
  readonly fixtureBankId: FixtureBank["fixtureBankId"];
  readonly fixtureId: FixtureRecord["fixtureId"];
  readonly context: Context;
  readonly source: DistributionSource;
  readonly acquisitionSource: FixtureBank["acquisitionSource"];
  readonly shotsPerCircuit: number;
  readonly probabilities: ProbabilityVector;
}
