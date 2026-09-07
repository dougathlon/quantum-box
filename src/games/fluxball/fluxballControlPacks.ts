import { PACK_SCHEMA_VERSION, type CommittedPack } from "../../packs/types";
import { FixtureCatalog } from "./standalone/fixtures";
import type {
  HybridFourQubitFixtureBank,
  FixtureBank,
} from "./standalone/fixtures";
import twoQubitFixture from "./standalone/data/fluxball-aer-v1.json";
import fourQubitFixture from "./standalone/data/fluxball-aer-four-qubit-hybrid-v1.json";
import { FLUXBALL_QGRAPH_RULE_BANK } from "./FluxballRuleBank";
import { FLUXBALL_RULES_VERSION } from "./types";

export const FLUXBALL_TWO_FIXTURE_SHA256 =
  "af91a70fc633ef4808e658268309ad67d7b808b1d10d77e5e36fcf35090feedb";
export const FLUXBALL_FOUR_FIXTURE_SHA256 =
  "ba9afa9d257d9a2f6e11d1b23cb3a21bf1a10f87e2c9ea6d54cde92873fe0db3";

export const FLUXBALL_FIXTURE_CATALOG = new FixtureCatalog(
  twoQubitFixture,
  fourQubitFixture,
);

export const FLUXBALL_TWO_CONTROL_PACK = freezePack<FixtureBank>({
  schemaVersion: PACK_SCHEMA_VERSION,
  packId: "fluxball-aer-two-qubit-v1",
  gameId: "fluxball",
  engineId: "graph-v1",
  source: "local-aer-control",
  contentSha256: FLUXBALL_TWO_FIXTURE_SHA256,
  rulesVersion: FLUXBALL_RULES_VERSION,
  warnings: [
    "Committed local-Aer control; no Moth API job or active-play provider execution.",
    "Two-player pairwise tomography remains scientifically distinct from the four-player hybrid path.",
  ],
  mothEvidence: null,
  payload: FLUXBALL_FIXTURE_CATALOG.getTwoQubitBank(),
});

export const FLUXBALL_FOUR_CONTROL_PACK =
  freezePack<HybridFourQubitFixtureBank>({
    schemaVersion: PACK_SCHEMA_VERSION,
    packId: "fluxball-aer-four-qubit-hybrid-v1",
    gameId: "fluxball",
    engineId: "graph-v1",
    source: "local-aer-control",
    contentSha256: FLUXBALL_FOUR_FIXTURE_SHA256,
    rulesVersion: FLUXBALL_RULES_VERSION,
    warnings: [
      "Committed local-Aer control; no Moth API job or active-play provider execution.",
      "Four-player gameplay samples complete uniform-basis outcomes; fitted graph edges are explanation and diagnostics only.",
    ],
    mothEvidence: null,
    payload: FLUXBALL_FIXTURE_CATALOG.getFourQubitBank(),
  });

export const FLUXBALL_PLAYABLE_RULE_BANK = freezePack({
  schemaVersion: PACK_SCHEMA_VERSION,
  packId: FLUXBALL_QGRAPH_RULE_BANK.bankId,
  gameId: "fluxball",
  engineId: "graph-v1",
  source: "mixed-preacquired-bank",
  contentSha256:
    "e5564fcb5d229c766505fa4e8db5965945afeec214119517bc30c109187d4f45",
  rulesVersion: FLUXBALL_RULES_VERSION,
  warnings: [
    "Playable-first frozen bank: valid QPU records are preferred per round, but missing or invalid QPU coverage does not lock Story play.",
    "The validated IBM Fez bank contains 16 two-player and 24 four-player records, with eligible QPU distributions for all eight acquisition buckets in both formats.",
    "Each API capture is committed with transport and content hashes. No record includes provider credentials, and active play makes no provider request.",
  ],
  mothEvidence: null,
  payload: FLUXBALL_QGRAPH_RULE_BANK,
});

export type FluxballCommittedPack =
  | typeof FLUXBALL_PLAYABLE_RULE_BANK
  | typeof FLUXBALL_TWO_CONTROL_PACK
  | typeof FLUXBALL_FOUR_CONTROL_PACK;

export function fluxballRulePackFor(
  _competitorCount: 2 | 4,
): FluxballCommittedPack {
  return FLUXBALL_PLAYABLE_RULE_BANK;
}

function freezePack<TPayload>(
  pack: CommittedPack<TPayload>,
): CommittedPack<TPayload> {
  return deepFreeze({ ...pack, warnings: [...pack.warnings] });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
