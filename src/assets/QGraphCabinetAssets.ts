import runtimeHandoffJson from "./qgraph-cabinet-assets-v1/manifests/shipped-runtime-handoff.json" with { type: "json" };

export interface QGraphCabinetFrame {
  readonly frameId: string;
  readonly order: number;
  readonly rect: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  readonly anchor: Readonly<{
    x: number;
    y: number;
    convention: "frame-local-integer";
  }>;
  readonly derivationMethod: string;
  readonly parents: readonly string[];
}

export interface QGraphCabinetRuntimeAsset {
  readonly fileId: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly dimensions: Readonly<{ width: number; height: number }>;
  readonly kind:
    | "single-frame-runtime-sprite"
    | "runtime-sprite-strip-with-two-pixel-gutters";
  readonly frames: readonly QGraphCabinetFrame[];
  readonly textureKey: string;
  readonly url: string;
}

interface RuntimeHandoffJson {
  readonly schemaVersion: string;
  readonly status: string;
  readonly logicalResolution: Readonly<{ width: number; height: number }>;
  readonly palette: Readonly<{
    darkTobacco: string;
    mutedTan: string;
    warmCream: string;
  }>;
  readonly alphaContract: string;
  readonly scalingContract: string;
  readonly lineage: string;
  readonly runtimeFiles: readonly Omit<
    QGraphCabinetRuntimeAsset,
    "textureKey" | "url"
  >[];
}

const runtimeHandoff = runtimeHandoffJson as RuntimeHandoffJson;
const assetUrls = import.meta.glob<string>(
  [
    "./qgraph-cabinet-assets-v1/assets/quag/*.png",
    "./qgraph-cabinet-assets-v1/assets/fluxball/*.png",
    "./qgraph-cabinet-assets-v1/assets/shared/*.png",
  ],
  { eager: true, query: "?url", import: "default" },
);

export const QGRAPH_CABINET_MANIFEST_HASHES = Object.freeze({
  sourceManifest:
    "74ec38ed772325de2ddce2925176ac6ee603d851d86d0cf8870ae90f0fe264b2",
  runtimeHandoff:
    "1da1036cf441815aba1b4b2e6642bbe89d01c6d8f4b4dabc367c3b7f1bf921f0",
  shippedRuntimeHandoff:
    "01ea293ab0fda90d61a92f283d7472878fbd58e40dde6d68246fd3381a202719",
});

function buildRuntimeAssets(): readonly QGraphCabinetRuntimeAsset[] {
  if (
    runtimeHandoff.schemaVersion !==
      "quantum-box-qgraph-cabinet-shipped-runtime-handoff-v1" ||
    runtimeHandoff.status !== "deterministic-local-shipped-runtime-handoff" ||
    runtimeHandoff.logicalResolution.width !== 320 ||
    runtimeHandoff.logicalResolution.height !== 180 ||
    runtimeHandoff.palette.darkTobacco !== "#2B1C14" ||
    runtimeHandoff.palette.mutedTan !== "#564330" ||
    runtimeHandoff.palette.warmCream !== "#D6BD8B" ||
    runtimeHandoff.alphaContract !== "binary-only-0-or-255" ||
    runtimeHandoff.scalingContract !== "integer-nearest-neighbour-only" ||
    runtimeHandoff.runtimeFiles.length !== 4
  ) {
    throw new Error("QGraph cabinet runtime asset contract drifted.");
  }
  return Object.freeze(
    runtimeHandoff.runtimeFiles.map((entry) => {
      const modulePath = `./qgraph-cabinet-assets-v1/${entry.relativePath}`;
      const url = assetUrls[modulePath];
      if (!url)
        throw new Error(`QGraph cabinet asset is missing: ${modulePath}`);
      return Object.freeze({
        ...entry,
        frames: Object.freeze(
          entry.frames.map((frame) => Object.freeze(frame)),
        ),
        textureKey: `qbox-qgraph-v1:${entry.fileId}`,
        url,
      });
    }),
  );
}

export const QGRAPH_CABINET_RUNTIME_ASSETS = buildRuntimeAssets();
export const QGRAPH_CABINET_RUNTIME_ASSET_BY_ID = new Map(
  QGRAPH_CABINET_RUNTIME_ASSETS.map((asset) => [asset.fileId, asset] as const),
);

export const QGRAPH_CABINET_RUNTIME_ASSET_MANIFEST = Object.freeze({
  schemaVersion: runtimeHandoff.schemaVersion,
  status: runtimeHandoff.status,
  logicalResolution: runtimeHandoff.logicalResolution,
  palette: runtimeHandoff.palette,
  alphaContract: runtimeHandoff.alphaContract,
  scalingContract: runtimeHandoff.scalingContract,
  lineage: runtimeHandoff.lineage,
  sourceManifest: Object.freeze({
    relativePath:
      "src/assets/qgraph-cabinet-assets-v1/manifests/source-manifest.json",
    sha256: QGRAPH_CABINET_MANIFEST_HASHES.sourceManifest,
  }),
  assets: QGRAPH_CABINET_RUNTIME_ASSETS,
});

export function requireQGraphCabinetFrame(
  fileId: string,
  frameId: string,
): Readonly<{
  asset: QGraphCabinetRuntimeAsset;
  frame: QGraphCabinetFrame;
}> {
  const asset = QGRAPH_CABINET_RUNTIME_ASSET_BY_ID.get(fileId);
  if (!asset) throw new Error(`Unknown QGraph cabinet asset: ${fileId}`);
  const frame = asset.frames.find((candidate) => candidate.frameId === frameId);
  if (!frame)
    throw new Error(`QGraph cabinet frame is missing: ${fileId}/${frameId}`);
  return Object.freeze({ asset, frame });
}
