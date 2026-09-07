import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  QGRAPH_CABINET_MANIFEST_HASHES,
  QGRAPH_CABINET_RUNTIME_ASSETS,
} from "../../src/assets/QGraphCabinetAssets";

const manifestRoot = resolve(
  process.cwd(),
  "src/assets/qgraph-cabinet-assets-v1/manifests",
);

describe("QGraph production boundary", () => {
  it("ships only the four reachable Quarry and Fluxball assets", () => {
    const shippedRaw = readFileSync(
      resolve(manifestRoot, "shipped-runtime-handoff.json"),
      "utf8",
    );
    const shipped = JSON.parse(shippedRaw) as {
      runtimeFiles: readonly { fileId: string }[];
    };

    expect(shipped.runtimeFiles).toHaveLength(4);
    expect(shippedRaw.toLowerCase()).not.toContain("enclose");
    expect(QGRAPH_CABINET_RUNTIME_ASSETS.map((asset) => asset.fileId)).toEqual(
      shipped.runtimeFiles.map((asset) => asset.fileId),
    );
    expect(QGRAPH_CABINET_MANIFEST_HASHES).toEqual(
      expect.objectContaining({
        shippedRuntimeHandoff:
          "01ea293ab0fda90d61a92f283d7472878fbd58e40dde6d68246fd3381a202719",
      }),
    );
  });
});
