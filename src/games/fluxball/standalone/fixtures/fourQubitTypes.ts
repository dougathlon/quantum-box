import type { PlayerId } from "../modes";
import type { CircuitIdentity, Context, VerifiedGitSource } from "./types";

export type Sign = "+" | "-";
export type FourOutcome = `${Sign}${Sign}${Sign}${Sign}`;
export type FourProbabilityVector = Readonly<Record<FourOutcome, number>>;
export type FourCountVector = Readonly<Record<FourOutcome, number>>;
export type FourContextDistributions = Readonly<
  Record<Context, FourProbabilityVector>
>;

export interface FourQubitAcquisitionRecord {
  readonly backendClass: "AerSimulator";
  readonly backendName: "aer_simulator";
  readonly providerMode: "local-aer";
  readonly providerName: "qiskit-aer";
  readonly mothApi: false;
  readonly jobId: string;
  readonly shotsPerCircuit: number;
  readonly simulatorSeed: number;
  readonly transpilerSeed: number;
  readonly characterizationCircuitCount: 3;
  readonly measurementSettings: readonly ["XXXX", "YYYY", "ZZZZ"];
  readonly totalShots: number;
  readonly logicalMeasurementCircuitQasm: readonly [string, string, string];
  readonly logicalMeasurementCircuitSha256: readonly [string, string, string];
  readonly transpiledAerCircuitQasm: readonly [string, string, string];
  readonly transpiledAerCircuitSha256: readonly [string, string, string];
  readonly rawCounts: Readonly<Record<Context, FourCountVector>>;
  readonly rawCountsSha256: string;
  readonly durableProviderResult: false;
  readonly hardwareLayout: null;
  readonly backendCalibration: null;
  readonly fallbackFrom: null;
}

export interface FourQubitFixtureRecord {
  readonly fixtureId: "fluxball-four-player-preparation-v1";
  readonly circuit: CircuitIdentity;
  readonly acquisition: FourQubitAcquisitionRecord;
  readonly derivation: {
    readonly method: "direct-count-frequency";
    readonly outcomeOrder: "q0-q1-q2-q3 / A-B-C-D";
    readonly qiskitCountOrder: "c3-c2-c1-c0 reversed to q0-q1-q2-q3";
  };
  readonly distributions: FourContextDistributions;
  readonly productMarginalsControl: FourContextDistributions;
  readonly exactStateDiagnostic: {
    readonly acquisitionSource: "exact-statevector";
    readonly distributions: FourContextDistributions;
  };
}

export interface FourQubitFixtureBank {
  readonly schemaVersion: "fluxball-four-qubit-fixture-bank-v1";
  readonly fixtureBankId: "fluxball-aer-four-qubit-v1";
  readonly defaultFixtureId: "fluxball-four-player-preparation-v1";
  readonly compiledAt: string;
  readonly deliveryMode: "committed-fixture";
  readonly acquisitionSource: "finite-shot-aer";
  readonly derivationMethod: "direct-count-frequency";
  readonly model: {
    readonly modelId: "fluxball-four-qubit-rulefield-v1";
    readonly numQubits: 4;
    readonly playerOrder: readonly ["A", "B", "C", "D"];
    readonly qubitMap: readonly {
      readonly qubit: number;
      readonly playerId: PlayerId;
      readonly displayName: string;
    }[];
    readonly configuredEdges: readonly (readonly [number, number])[];
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
    readonly characterizationCircuitsPerFixture: 3;
    readonly totalCircuitExecutions: 3;
    readonly shotsPerCircuit: number;
    readonly totalShots: number;
  };
  readonly fixtures: {
    readonly "fluxball-four-player-preparation-v1": FourQubitFixtureRecord;
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
  };
}
