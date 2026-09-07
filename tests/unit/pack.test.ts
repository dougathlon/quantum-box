import { describe, expect, it } from "vitest";

import { PACK_SCHEMA_VERSION, type CommittedPack } from "../../src/packs/types";
import { validateCommittedPack } from "../../src/packs/validatePack";

interface Payload {
  readonly polarity: readonly [number, number];
}

const validatePayload = (value: unknown): Payload => {
  if (
    value === null ||
    typeof value !== "object" ||
    !("polarity" in value) ||
    !Array.isArray(value.polarity) ||
    value.polarity.length !== 2
  ) {
    throw new Error("Invalid Qong polarity payload.");
  }
  return { polarity: [Number(value.polarity[0]), Number(value.polarity[1])] };
};

function localPack(): CommittedPack<Payload> {
  return {
    schemaVersion: PACK_SCHEMA_VERSION,
    packId: "qong-control-1",
    gameId: "qong",
    engineId: "coin-toss-v1",
    source: "synthetic-control",
    contentSha256: "a".repeat(64),
    rulesVersion: "qong-rules-v1",
    warnings: [],
    mothEvidence: null,
    payload: { polarity: [0.5, 0.5] },
  };
}

describe("committed pack validation", () => {
  it("accepts and freezes a local control without pretending it is Moth-acquired", () => {
    const result = validateCommittedPack(localPack(), validatePayload);

    expect(result.source).toBe("synthetic-control");
    expect(result.mothEvidence).toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects a remote label without complete Moth evidence", () => {
    expect(() =>
      validateCommittedPack(
        { ...localPack(), source: "moth-api-emulator" },
        validatePayload,
      ),
    ).toThrow("classification and engine evidence disagree");
  });

  it("accepts a contract mock only without Moth evidence", () => {
    const result = validateCommittedPack(
      { ...localPack(), source: "contract-mock" },
      validatePayload,
    );

    expect(result.source).toBe("contract-mock");
    expect(result.mothEvidence).toBeNull();
  });

  it("rejects evidence whose engine identity does not match the pack", () => {
    expect(() =>
      validateCommittedPack(
        {
          ...localPack(),
          source: "moth-api-emulator",
          mothEvidence: {
            engineId: "wrong-engine",
            engineUpdatedAt: "2026-08-23T00:00:00Z",
            canonicalEngineRecordSha256: "b".repeat(64),
            apiSpecificationCanonicalSha256: "c".repeat(64),
            jobId: "job-redacted",
            jobIdentitySha256: null,
            observedStatuses: ["queued", "completed"],
            rawResultSha256: "d".repeat(64),
            executionMode: "emu",
          },
        },
        validatePayload,
      ),
    ).toThrow("incomplete or mismatched");
  });
});
