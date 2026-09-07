import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { validateQongStoryPackBank } from "../../src/games/qong/qongStoryPackBank";

describe("Python Qong bank compiler interoperability", () => {
  it("emits the exact public schema and canonical hashes accepted by the browser", async () => {
    const serialized = execFileSync(
      "python3",
      [
        "-c",
        [
          "import json",
          "from compiler.tests.test_qong_bank import fixture_mixed_browser_preflight, fixture_captures",
          "from compiler.quantum_box_moth.qong_bank import assemble_bank",
          "print(json.dumps(assemble_bank(fixture_mixed_browser_preflight(), fixture_captures())))",
        ].join("; "),
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          PYTHONPYCACHEPREFIX: "/private/tmp/quantum-box-pycache",
        },
      },
    );

    const bank = await validateQongStoryPackBank(JSON.parse(serialized));

    expect(bank.playPacks).toHaveLength(4);
    expect(
      bank.playPacks.every((pack) => pack.qpuProvenance.jobs.length === 7),
    ).toBe(true);
    expect(bank.selectorPack.bits).toHaveLength(64);
  }, 15_000);
});
