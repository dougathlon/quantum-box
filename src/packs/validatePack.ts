import {
  PACK_SCHEMA_VERSION,
  packIsMothAcquired,
  type CommittedPack,
} from "./types";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function validateCommittedPack<TPayload>(
  input: CommittedPack<TPayload>,
  validatePayload: (payload: unknown) => TPayload,
): CommittedPack<TPayload> {
  if (input.schemaVersion !== PACK_SCHEMA_VERSION) {
    throw new Error("Unknown Quantum Box pack schema.");
  }
  if (!input.packId || !input.engineId || !input.rulesVersion) {
    throw new Error("Committed pack identity is incomplete.");
  }
  if (!SHA256_PATTERN.test(input.contentSha256)) {
    throw new Error("Committed pack content hash is invalid.");
  }
  const remote = input.source.startsWith("moth-api-");
  if (remote !== (input.mothEvidence !== null)) {
    throw new Error("Moth source classification and engine evidence disagree.");
  }
  if (packIsMothAcquired(input)) {
    const evidence = input.mothEvidence;
    if (evidence === null) {
      throw new Error("Moth acquisition evidence is missing.");
    }
    if (
      evidence.engineId !== input.engineId ||
      !SHA256_PATTERN.test(evidence.canonicalEngineRecordSha256) ||
      !SHA256_PATTERN.test(evidence.apiSpecificationCanonicalSha256) ||
      !SHA256_PATTERN.test(evidence.rawResultSha256) ||
      (evidence.jobId === null &&
        (evidence.jobIdentitySha256 === null ||
          !SHA256_PATTERN.test(evidence.jobIdentitySha256))) ||
      evidence.observedStatuses.length === 0
    ) {
      throw new Error("Moth acquisition evidence is incomplete or mismatched.");
    }
  }
  return deepFreeze({
    ...input,
    warnings: [...input.warnings],
    mothEvidence:
      input.mothEvidence === null
        ? null
        : {
            ...input.mothEvidence,
            observedStatuses: [...input.mothEvidence.observedStatuses],
          },
    payload: validatePayload(input.payload),
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
