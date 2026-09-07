import { describe, expect, it } from "vitest";

import { sha256CanonicalJson } from "../../src/core/canonicalJson";
import {
  QongStoryBankUnavailableError,
  loadInstalledQongStoryBank,
  requireQongRecoveryReferenceInBankArtifact,
  selectQongArcadePack,
  selectQongStoryPack,
  validateQongSelectionReceipt,
  validateQongStoryPackBank,
} from "../../src/games/qong/qongStoryPackBank";
import { QONG_RULES_VERSION } from "../../src/games/qong/types";
import { createTestQongStoryBank } from "../fixtures/qongStoryBank";

describe("Qong QPU Story bank", () => {
  it("fails closed for an unavailable-bank artifact", async () => {
    await expect(
      validateQongStoryPackBank({
        schemaVersion: "quantum-box-qong-bank-unavailable-v1",
        reason: "No complete authenticated bank is installed.",
      }),
    ).rejects.toBeInstanceOf(QongStoryBankUnavailableError);
  });

  it("loads the installed v5 bank bound to the authorized preflight", async () => {
    const bank = await loadInstalledQongStoryBank();
    expect(bank.selectorPack.bits).toHaveLength(44);
    expect(
      bank.playPacks.every(
        (pack) =>
          pack.qpuProvenance.adapterVersion === "qong-coin-bank-adapter-v5",
      ),
    ).toBe(true);
    expect(bank.selectorPack.qpuProvenance.adapterVersion).toBe(
      "qong-coin-bank-adapter-v5",
    );
  });

  it("selects Arcade runs only from authenticated play packs and recorded selector pairs", async () => {
    const bank = await loadInstalledQongStoryBank();
    const first = selectQongArcadePack(bank, 1234);
    const repeated = selectQongArcadePack(bank, 1234);
    const other = selectQongArcadePack(bank, 1235);

    expect(first).toEqual(repeated);
    expect(first.pack.source).toBe("moth-api-qpu");
    expect(first.pack.qpuProvenance.acquisitionClass).toBe("moth-acquired");
    expect(first.receipt.selectorCursorBefore % 2).toBe(0);
    expect(first.receipt.selectorBits).toEqual([
      bank.selectorPack.bits[first.receipt.selectorCursorBefore],
      bank.selectorPack.bits[first.receipt.selectorCursorBefore + 1],
    ]);
    expect(other.pack.source).toBe("moth-api-qpu");
  });

  it("validates four seven-rally packs and a separately evidenced selector", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );

    expect(bank.playPacks).toHaveLength(4);
    expect(bank.selectorPack.bits).toHaveLength(64);
    expect(bank.playPacks[0]?.payload.rallyPolarities).toHaveLength(7);
    expect(
      bank.playPacks.every(
        (pack) => pack.payload.rallyPolarities?.[0] === "invert",
      ),
    ).toBe(true);
    expect(bank.playPacks[0]?.source).toBe("moth-api-qpu");
    expect(bank.playPacks[0]?.qpuProvenance.acquisitionClass).toBe(
      "moth-acquired",
    );
    expect(Object.isFrozen(bank)).toBe(true);
  });

  it("rejects a rehashed legacy showcase bank without the exact preflight contract", async () => {
    const fixture = structuredClone(await createTestQongStoryBank()) as any;
    const provenances = [
      ...fixture.playPacks.map((pack: any) => pack.qpuProvenance),
      fixture.selectorPack.qpuProvenance,
    ];
    for (const provenance of provenances) {
      provenance.adapterVersion = "qong-coin-bank-adapter-v4";
      for (const key of [
        "preflightSchemaVersion",
        "preflightContentSha256",
        "showcaseUrl",
        "processEndpoint",
        "terminalStatusSchema",
        "priceDisplay",
        "selectorCompletion",
      ]) {
        delete provenance[key];
      }
    }
    for (let index = 0; index < fixture.playPacks.length; index += 1) {
      await rehashPlayPackAndBank(fixture, index);
    }
    await rehashSelectorAndBank(fixture);

    await expect(validateQongStoryPackBank(fixture)).rejects.toThrow(
      /exact authorized preflight/,
    );
  });

  it("accepts adapter v5 mixed backends and rejects a changed preflight identity", async () => {
    const fixture = structuredClone(await createTestQongStoryBank()) as any;
    fixture.playPacks[0].qpuProvenance.jobs[1].backendName = "test_qpu_alt";
    await rehashProviderRecord(fixture.playPacks[0].qpuProvenance.jobs[1]);
    for (let index = 0; index < fixture.playPacks.length; index += 1) {
      await rehashPlayPackAndBank(fixture, index);
    }
    await rehashSelectorAndBank(fixture);

    const bank = await validateQongStoryPackBank(fixture);
    expect(bank.playPacks[0]?.qpuProvenance.adapterVersion).toBe(
      "qong-coin-bank-adapter-v5",
    );
    expect(bank.playPacks[0]?.qpuProvenance.jobs[1]?.backendName).toBe(
      "test_qpu_alt",
    );

    const tampered = structuredClone(fixture) as any;
    tampered.playPacks[0].qpuProvenance.preflightContentSha256 = "0".repeat(64);
    await rehashPlayPackAndBank(tampered, 0);
    await expect(validateQongStoryPackBank(tampered)).rejects.toThrow(
      /authorized preflight hash/,
    );
  });

  it("rejects a rehashed mixed-backend adapter v2 bank without a policy field", async () => {
    const fixture = structuredClone(await createTestQongStoryBank()) as any;
    const provenances = [
      ...fixture.playPacks.map((pack: any) => pack.qpuProvenance),
      fixture.selectorPack.qpuProvenance,
    ];
    for (const provenance of provenances) {
      provenance.adapterVersion = "qong-coin-bank-adapter-v2";
      provenance.engineUpdatedAt = "2026-08-31T15:56:01Z";
      for (const key of [
        "contractSource",
        "contractObservedAt",
        "canonicalContractRecordSha256",
        "preflightSchemaVersion",
        "preflightContentSha256",
        "backendPolicy",
        "showcaseUrl",
        "processEndpoint",
        "terminalStatusSchema",
        "priceDisplay",
        "selectorCompletion",
      ]) {
        delete provenance[key];
      }
    }
    fixture.playPacks[0].qpuProvenance.jobs[1].backendName = "test_qpu_alt";
    await rehashProviderRecord(fixture.playPacks[0].qpuProvenance.jobs[1]);
    for (let index = 0; index < fixture.playPacks.length; index += 1) {
      await rehashPlayPackAndBank(fixture, index);
    }
    await rehashSelectorAndBank(fixture);

    await expect(validateQongStoryPackBank(fixture)).rejects.toThrow(
      /exact authorized preflight/,
    );
  });

  it("rejects an incomplete selector without the exact blocked-prefix seal", async () => {
    const fixture = structuredClone(await createTestQongStoryBank()) as any;
    fixture.selectorPack.bits = fixture.selectorPack.bits.slice(0, 46);
    fixture.selectorPack.qpuProvenance.jobs =
      fixture.selectorPack.qpuProvenance.jobs.slice(0, 46);
    fixture.selectorPack.qpuProvenance.acquiredAt =
      fixture.selectorPack.qpuProvenance.jobs[45].retrievedAt;
    await rehashSelectorAndBank(fixture);

    await expect(validateQongStoryPackBank(fixture)).rejects.toThrow(
      /unauthorized selector-result count/,
    );
  });

  it("rejects missing, reordered, duplicated, and semantically tampered evidence", async () => {
    const missing = structuredClone(await createTestQongStoryBank()) as any;
    missing.playPacks[0].qpuProvenance.jobs.pop();
    await expect(validateQongStoryPackBank(missing)).rejects.toThrow(
      /provenance is incomplete/,
    );

    const reordered = structuredClone(await createTestQongStoryBank()) as any;
    [
      reordered.playPacks[0].qpuProvenance.jobs[0],
      reordered.playPacks[0].qpuProvenance.jobs[1],
    ] = [
      reordered.playPacks[0].qpuProvenance.jobs[1],
      reordered.playPacks[0].qpuProvenance.jobs[0],
    ];
    await expect(validateQongStoryPackBank(reordered)).rejects.toThrow(
      /stable item ID/,
    );

    const duplicated = structuredClone(await createTestQongStoryBank()) as any;
    duplicated.selectorPack.qpuProvenance.jobs[1].mothJobId =
      duplicated.selectorPack.qpuProvenance.jobs[0].mothJobId;
    await rehashProviderRecord(duplicated.selectorPack.qpuProvenance.jobs[1]);
    await rehashSelectorAndBank(duplicated);
    await expect(validateQongStoryPackBank(duplicated)).rejects.toThrow(
      /Moth job IDs must be unique/,
    );

    const alteredProviderRecord = structuredClone(
      await createTestQongStoryBank(),
    ) as any;
    alteredProviderRecord.playPacks[0].qpuProvenance.jobs[0].submittedAt =
      "2026-08-31T16:00:00.500Z";
    await rehashPlayPackAndBank(alteredProviderRecord, 0);
    await expect(
      validateQongStoryPackBank(alteredProviderRecord),
    ).rejects.toThrow(/provider-record hash does not match/);

    const tampered = structuredClone(await createTestQongStoryBank()) as any;
    tampered.playPacks[0].payload.rallyPolarities[1] = "direct";
    await expect(validateQongStoryPackBank(tampered)).rejects.toThrow(
      /does not match its rally polarity/,
    );
  });

  it("rejects mixed or inconsistent first-rally postselection provenance", async () => {
    const wrongRank = structuredClone(await createTestQongStoryBank()) as any;
    wrongRank.playPacks[0].qpuProvenance.postselection.selectedTailRank = 1;
    await rehashPlayPackAndBank(wrongRank, 0);
    await expect(validateQongStoryPackBank(wrongRank)).rejects.toThrow(
      /wrong tail rank/,
    );

    const mixed = structuredClone(await createTestQongStoryBank()) as any;
    mixed.playPacks[0].qpuProvenance.adapterVersion =
      "qong-coin-bank-adapter-v1";
    mixed.playPacks[0].qpuProvenance.engineUpdatedAt = "2026-08-31T15:56:01Z";
    delete mixed.playPacks[0].qpuProvenance.requestBody;
    delete mixed.playPacks[0].qpuProvenance.requestBodySha256;
    delete mixed.playPacks[0].qpuProvenance.postselection;
    for (const key of [
      "contractSource",
      "contractObservedAt",
      "canonicalContractRecordSha256",
      "preflightSchemaVersion",
      "preflightContentSha256",
      "backendPolicy",
      "showcaseUrl",
      "processEndpoint",
      "terminalStatusSchema",
      "priceDisplay",
      "selectorCompletion",
    ]) {
      delete mixed.playPacks[0].qpuProvenance[key];
    }
    for (const job of mixed.playPacks[0].qpuProvenance.jobs) {
      delete job.sequenceOrdinal;
      delete job.submittedAt;
      delete job.providerUpdatedAt;
      delete job.terminalObservedAt;
      delete job.retrievedAt;
      delete job.terminalStatusSha256;
      delete job.providerRecordSha256;
    }
    await rehashPlayPackAndBank(mixed, 0);
    await expect(validateQongStoryPackBank(mixed)).rejects.toThrow(
      /cannot mix acquisition adapter versions/,
    );

    const selectorSelection = structuredClone(
      await createTestQongStoryBank(),
    ) as any;
    selectorSelection.selectorPack.qpuProvenance.postselection =
      selectorSelection.playPacks[0].qpuProvenance.postselection;
    await rehashSelectorAndBank(selectorSelection);
    await expect(validateQongStoryPackBank(selectorSelection)).rejects.toThrow(
      /selector provenance must not use postselection/,
    );
  });

  it("maps each two-bit pair to one of four packs without a local PRNG", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );

    expect(
      [0, 2, 4, 6].map(
        (cursor) =>
          selectQongStoryPack(bank, { cursor, cycle: 0 }).receipt
            .selectedPackIndex,
      ),
    ).toEqual([0, 1, 2, 3]);
  });

  it("records cursor advancement, replay identity, and explicit reuse cycles", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );
    const finalPair = selectQongStoryPack(bank, { cursor: 62, cycle: 0 });

    expect(finalPair.receipt.selectorBitIndices).toEqual([62, 63]);
    expect(finalPair.receipt.selectorCursorAfter).toBe(0);
    expect(finalPair.receipt.selectorCycleAfter).toBe(1);
    expect(finalPair.receipt.reusedSelectorBits).toBe(false);

    const reused = selectQongStoryPack(bank, { cursor: 0, cycle: 1 });
    expect(reused.receipt.reusedSelectorBits).toBe(true);
    expect(validateQongSelectionReceipt(reused.receipt)).toEqual(
      reused.receipt,
    );
  });

  it("rejects a receipt whose stored bits and selected pack disagree", async () => {
    const bank = await validateQongStoryPackBank(
      await createTestQongStoryBank(),
    );
    const selection = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
    const tampered = {
      ...selection.receipt,
      selectedPackIndex: 3,
    };

    expect(() => validateQongSelectionReceipt(tampered)).toThrow(
      /inconsistent selector state/,
    );
  });

  it.each(["qong-rules-v0", "arbitrary-self-consistent-rules-v99"])(
    "rejects an otherwise matching recovery with stale rules version %s",
    async (rulesVersion) => {
      const artifact = await createTestQongStoryBank();
      const bank = await validateQongStoryPackBank(artifact);
      const selected = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
      const firstJob = selected.pack.qpuProvenance.jobs[0]!;
      const reference = {
        rulesVersion: QONG_RULES_VERSION,
        pack: {
          packId: selected.pack.packId,
          contentSha256: selected.pack.contentSha256,
          schemaVersion: selected.pack.schemaVersion,
          source: selected.pack.source,
        },
        packSelection: selected.receipt,
        firstResult: {
          rallyId: firstJob.itemId,
          outcome: firstJob.outcome,
          bit: firstJob.outcome === "heads" ? 0 : 1,
          rule: firstJob.outcome === "heads" ? "direct" : "invert",
          mothJobId: firstJob.mothJobId,
          hardwareJobId: firstJob.hardwareJobId,
          backendName: firstJob.backendName,
          shots: firstJob.shots,
          heads: firstJob.heads,
          tails: firstJob.tails,
        },
      };

      expect(() =>
        requireQongRecoveryReferenceInBankArtifact(reference, artifact),
      ).not.toThrow();
      expect(() =>
        requireQongRecoveryReferenceInBankArtifact(
          { ...reference, rulesVersion },
          artifact,
        ),
      ).toThrow(/absent from the installed Story bank/);
    },
  );
});

async function rehashSelectorAndBank(bank: any): Promise<void> {
  const selector = bank.selectorPack;
  selector.contentSha256 = await sha256CanonicalJson({
    schemaVersion: selector.schemaVersion,
    packId: selector.packId,
    engineId: selector.engineId,
    source: selector.source,
    acquisitionClass: selector.acquisitionClass,
    mapping: selector.mapping,
    bits: selector.bits,
    qpuProvenance: selector.qpuProvenance,
  });
  bank.contentSha256 = await sha256CanonicalJson({
    schemaVersion: bank.schemaVersion,
    bankId: bank.bankId,
    selectionMethod: bank.selectionMethod,
    playPackContentSha256: bank.playPacks.map(
      (pack: any) => pack.contentSha256,
    ),
    selectorPackContentSha256: selector.contentSha256,
  });
}

async function rehashPlayPackAndBank(
  bank: any,
  packIndex: number,
): Promise<void> {
  const pack = bank.playPacks[packIndex];
  pack.contentSha256 = await sha256CanonicalJson({
    schemaVersion: pack.schemaVersion,
    packSchemaVersion: pack.packSchemaVersion,
    packId: pack.packId,
    gameId: pack.gameId,
    engineId: pack.engineId,
    source: pack.source,
    rulesVersion: pack.rulesVersion,
    warnings: pack.warnings,
    payload: pack.payload,
    qpuProvenance: pack.qpuProvenance,
  });
  bank.contentSha256 = await sha256CanonicalJson({
    schemaVersion: bank.schemaVersion,
    bankId: bank.bankId,
    selectionMethod: bank.selectionMethod,
    playPackContentSha256: bank.playPacks.map(
      (item: any) => item.contentSha256,
    ),
    selectorPackContentSha256: bank.selectorPack.contentSha256,
  });
}

async function rehashProviderRecord(job: any): Promise<void> {
  const { providerRecordSha256: _providerRecordSha256, ...material } = job;
  job.providerRecordSha256 = await sha256CanonicalJson(material);
}
