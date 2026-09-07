import type { RuleDistribution, SignedOutcome } from "../fixtures";
import type { Context } from "../fixtures/types";
import type {
  ActivePlayerMap,
  CompetitorCount,
  PlayerId,
  RuleMode,
} from "../modes";

export type RuleDimension = "ACTION" | "INTERACTION" | "PURPOSE";
export type ActionRule = "DIRECT" | "INVERTED";
export type InteractionRule = "CARRY" | "STRIKE";
export type PurposeRule = "OPPOSITE" | "OWN";
export type Sign = "+" | "-";
export type GlobalParity = "+" | "-";

export type RuleAcquisitionSource =
  | "finite-shot-aer"
  | "moth-qgraph-qpu"
  | "moth-qgraph-emu"
  | "deterministic-classical-fallback";

export type RoundRuleDistribution = Omit<
  RuleDistribution,
  "acquisitionSource"
> & {
  readonly acquisitionSource: RuleAcquisitionSource;
};

export interface PlayerRules {
  readonly action: ActionRule;
  readonly interaction: InteractionRule;
  readonly purpose: PurposeRule;
}

export interface AxisSample<
  TContext extends Context = Context,
  TDimension extends RuleDimension = RuleDimension,
> {
  readonly context: TContext;
  readonly dimension: TDimension;
  readonly distribution: RoundRuleDistribution;
  readonly drawIndex: 0 | 1 | 2;
  readonly prngDraw: number;
  readonly outcome: SignedOutcome;
  readonly signs: ActivePlayerMap<Sign>;
  readonly globalParity: GlobalParity;
}

export interface RoundRuleTrace {
  readonly roundNumber: number;
  readonly runSeed: number;
  readonly ruleSeed: number;
  readonly rngAlgorithm: "mulberry32-v1";
  readonly samplingMethod:
    | "three-separate-classical-draws"
    | "three-weighted-draws-from-one-joint-distribution";
  readonly competitorCount: CompetitorCount;
  readonly activePlayerIds: readonly PlayerId[];
  readonly fixtureBankId: string;
  readonly fixtureId: string;
  readonly acquisitionSource: RuleAcquisitionSource;
  readonly shotsPerCircuit: number;
  readonly sourceMeasurementBasis?:
    | "separate-pauli-contexts"
    | "computational"
    | "classical";
  readonly sourceResolution?: Readonly<{
    preferredOrder: readonly [
      "moth-qgraph-qpu",
      "moth-qgraph-emu",
      "finite-shot-aer",
      "deterministic-classical-fallback",
    ];
    selectedSource: RuleAcquisitionSource;
    fallbackReasons: readonly string[];
  }>;
  readonly providerProvenance?: Readonly<{
    engineId: "graph-v1";
    mode: "qpu" | "emu";
    backendName: string | null;
    mothJobId: string;
    ibmJobId: string | null;
    submittedAt: string | null;
    captureMethod: "user-supplied-terminal-transcript" | "committed-api-result";
    rawResultSha256: string | null;
    evidencePath: string | null;
    measurementBasis: "computational";
    bitOrder: "qubit-0-leftmost";
    playerOrder: readonly PlayerId[];
    activePlayNetwork: false;
  }>;
  readonly axes: {
    readonly X: AxisSample<"X", "ACTION">;
    readonly Y: AxisSample<"Y", "INTERACTION">;
    readonly Z: AxisSample<"Z", "PURPOSE">;
  };
}

export interface InterpretedRoundRules {
  readonly mode: RuleMode;
  readonly activePlayerIds: readonly PlayerId[];
  readonly players: ActivePlayerMap<PlayerRules>;
  readonly global: PlayerRules | null;
  readonly parityByAxis: Readonly<Record<Context, GlobalParity>>;
}
