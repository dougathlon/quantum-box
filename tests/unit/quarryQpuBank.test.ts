import installedBankArtifact from "../../src/games/qgraph/packs/quarry-qgraph-ibm-fez-bank-v2.json";
import { describe, expect, it } from "vitest";

import { createRunContext } from "../../src/core/run";
import {
  QUARRY_QPU_BIT_ORDER,
  QUARRY_RECIPE_FAMILIES,
  findInstalledQuarryQpuPack,
  loadInstalledQuarryQpuBank,
  selectQuarryQpuPack,
  validateQuarryQpuBank,
} from "../../src/games/qgraph/quarryQpuBank";
import {
  QUAG_REMEASUREMENT_INTERVAL_TICKS,
  QuagSession,
} from "../../src/games/quag/QuagSession";
import { QUAG_RULES_VERSION } from "../../src/games/quag/types";

describe("Quarry QPU bank", () => {
  it("loads 24 credential-free IBM Fez records with four realizations per recipe", async () => {
    const bank = await loadInstalledQuarryQpuBank();

    expect(bank.packs).toHaveLength(24);
    expect(bank.packIndex).toHaveLength(24);
    expect(bank.sourceBanks.map((source) => source.captureCount)).toEqual([
      6, 18,
    ]);
    expect(bank.sourceBanks).toMatchObject([
      {
        bankId: "quarry-qgraph-ibm-fez-bank-v1",
        campaignId: "quarry-qgraph-qpu-bank-v1",
        sourceBankVersion: "v1",
        compiledBankContentSha256:
          "b0970a5bcb2c7244a490592fee78b2072773a96dc6ee81a531f09be1d020b0b8",
      },
      {
        bankId: "quarry-qgraph-ibm-fez-bank-v2-tranche",
        campaignId: "quarry-qgraph-qpu-bank-v2",
        sourceBankVersion: "v2",
      },
    ]);
    expect(bank.packs.every((pack) => pack.frames.length === 7)).toBe(true);
    expect(
      bank.packs.every(
        (pack) =>
          pack.sourceClassification === "moth-qgraph-qpu" &&
          pack.provenance.kind === "qpu-record" &&
          pack.provenance.backendName === "ibm_fez",
      ),
    ).toBe(true);
    expect(
      bank.packs.every((pack) => pack.bitOrdering === QUARRY_QPU_BIT_ORDER),
    ).toBe(true);
    for (const recipeFamily of QUARRY_RECIPE_FAMILIES) {
      expect(
        bank.packIndex
          .filter((entry) => entry.recipeFamily === recipeFamily)
          .map((entry) => entry.realizationId)
          .sort(),
      ).toEqual(["r1", "r2", "r3", "r4"]);
    }
    expect(JSON.stringify(bank)).not.toMatch(
      /qpu_token|qpu_instance|api_key|access_token/i,
    );
  });

  it("selects a reproducible hardware record and reaches all 24 across seeds", async () => {
    const bank = await loadInstalledQuarryQpuBank();
    const first = selectQuarryQpuPack(bank, 104);
    const repeated = selectQuarryQpuPack(bank, 104);

    expect(repeated).toEqual(first);
    expect(first.pack.sourceClassification).toBe("moth-qgraph-qpu");
    expect(first.indexEntry.packId).toBe(first.pack.packId);
    expect(first.sourceBank.sourceBankVersion).toBe(
      first.indexEntry.sourceBankVersion,
    );
    expect(first.bankContentSha256).toBe(bank.contentSha256);
    const reachable = new Set<string>();
    for (let seed = 0; seed < 4096; seed += 1) {
      reachable.add(selectQuarryQpuPack(bank, seed).pack.packId);
    }
    expect(reachable).toEqual(new Set(bank.packs.map((pack) => pack.packId)));
  });

  it("resolves an original v1 pack without changing its identity", async () => {
    const bank = await loadInstalledQuarryQpuBank();
    const original = bank.packs[0];
    expect(original).toBeDefined();
    const selection = findInstalledQuarryQpuPack(
      bank,
      original!.packId,
      original!.contentSha256,
    );

    expect(selection?.pack).toEqual(original);
    expect(selection?.sourceBank).toMatchObject({
      bankId: "quarry-qgraph-ibm-fez-bank-v1",
      sourceBankVersion: "v1",
    });
  });

  it("drives the shipped session through fixed twelve-second QPU phases", async () => {
    const bank = await loadInstalledQuarryQpuBank();
    const selection = selectQuarryQpuPack(bank, 104);
    const pack = selection.pack;
    const context = createRunContext({
      gameId: "quarry",
      playMode: "arcade",
      rulesVersion: QUAG_RULES_VERSION,
      runSeed: 104,
      pack: {
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.sourceClassification,
      },
    });
    const session = new QuagSession(context, pack, {
      readyTicks: 0,
      cpuEnabled: false,
    });

    expect(session.snapshot()).toMatchObject({
      relationshipSource: "QPU",
      graphPhase: 1,
    });
    for (let tick = 1; tick < QUAG_REMEASUREMENT_INTERVAL_TICKS; tick += 1) {
      session.step({ horizontal: 0, flapPressed: false });
    }
    const shifted = session.step({ horizontal: 0, flapPressed: false });
    expect(shifted.graphPhase).toBe(2);
    expect(shifted.eventsThisTick.map((event) => event.type)).toContain(
      "GRAPH_SHIFT",
    );
  });

  it("rejects a changed bank hash", async () => {
    const changed = structuredClone(installedBankArtifact);
    changed.bankId = "changed";

    await expect(validateQuarryQpuBank(changed)).rejects.toThrow(
      /content hash does not match/i,
    );
  });

  it("rejects a synthetic pack as corpus authority", async () => {
    const changed = structuredClone(installedBankArtifact) as any;
    changed.packs[0].sourceClassification = "synthetic-model";

    await expect(validateQuarryQpuBank(changed)).rejects.toThrow(
      /synthetic|not a seven-phase, twelve-bit QPU record/i,
    );
  });
});
