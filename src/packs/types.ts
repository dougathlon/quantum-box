import type { GameId } from "../games/registry";

export const PACK_SCHEMA_VERSION = "quantum-box-pack-v1";

export type PackSource =
  | "synthetic-control"
  | "local-aer-control"
  | "contract-mock"
  | "moth-api-simulator"
  | "moth-api-emulator"
  | "moth-api-qpu"
  | "moth-platform-qpu-capture"
  | "mixed-preacquired-bank";

export interface MothEngineEvidence {
  readonly engineId: string;
  readonly engineUpdatedAt: string;
  readonly canonicalEngineRecordSha256: string;
  readonly apiSpecificationCanonicalSha256: string;
  readonly jobId: string | null;
  readonly jobIdentitySha256: string | null;
  readonly observedStatuses: readonly string[];
  readonly rawResultSha256: string;
  readonly executionMode: string;
}

export interface CommittedPack<TPayload> {
  readonly schemaVersion: typeof PACK_SCHEMA_VERSION;
  readonly packId: string;
  readonly gameId: GameId;
  readonly engineId: string;
  readonly source: PackSource;
  readonly contentSha256: string;
  readonly rulesVersion: string;
  readonly warnings: readonly string[];
  readonly mothEvidence: MothEngineEvidence | null;
  readonly payload: Readonly<TPayload>;
}

export function packIsMothAcquired(pack: CommittedPack<unknown>): boolean {
  return pack.source.startsWith("moth-api-") && pack.mothEvidence !== null;
}
