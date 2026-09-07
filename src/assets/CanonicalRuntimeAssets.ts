import runtimeHandoffJson from "./canonical-runtime-assets-v2/manifests/runtime-handoff.json";

export interface CanonicalFrameRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CanonicalFrame {
  readonly frameId: string;
  readonly order: number;
  readonly rect: CanonicalFrameRect;
  readonly anchor: Readonly<{
    x: number;
    y: number;
    convention: "frame-local-integer";
  }>;
  readonly derivationMethod: string;
  readonly parents: readonly string[];
  readonly runtimeAngle?: number;
}

export interface CanonicalRuntimeAsset {
  readonly fileId: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly dimensions: Readonly<{ width: number; height: number }>;
  readonly kind:
    | "single-frame-runtime-sprite"
    | "runtime-sprite-strip"
    | "runtime-sprite-strip-with-two-pixel-gutters"
    | "reference-and-runtime-action-strip"
    | "runtime-morph-strip";
  readonly frames: readonly CanonicalFrame[];
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
  readonly runtimeFiles: readonly Omit<
    CanonicalRuntimeAsset,
    "textureKey" | "url"
  >[];
  readonly skipixlDesignerEncounter: Readonly<{
    morphAsset: null;
    behavior: string;
    waitingAssetId: string;
    reason: string;
  }>;
}

const runtimeHandoff = runtimeHandoffJson as RuntimeHandoffJson;

export const CANONICAL_MANIFEST_HASHES = Object.freeze({
  sourceManifest:
    "aa12069a34edd3b60585b476bac6f73d01dfd503fbbbac6f9808b7e30ebdb842",
  runtimeHandoff:
    "1ffdb24e076cb10c51402523c7b66ef462a8a8ba9a492d29bc1560d32b43e9ae",
});
const assetUrls = import.meta.glob<string>(
  "./canonical-runtime-assets-v2/assets/**/*.png",
  { eager: true, query: "?url", import: "default" },
);

function textureKey(fileId: string): string {
  return `qbox-canonical-v2:${fileId}`;
}

function buildRuntimeAssets(): readonly CanonicalRuntimeAsset[] {
  if (
    runtimeHandoff.schemaVersion !==
      "quantum-box-canonical-runtime-handoff-v2" ||
    runtimeHandoff.status !== "immutable-canonical-handoff"
  ) {
    throw new Error(
      "Canonical runtime asset handoff is not the approved v2 package.",
    );
  }
  if (
    runtimeHandoff.logicalResolution.width !== 320 ||
    runtimeHandoff.logicalResolution.height !== 180 ||
    runtimeHandoff.palette.darkTobacco !== "#2B1C14" ||
    runtimeHandoff.palette.mutedTan !== "#564330" ||
    runtimeHandoff.palette.warmCream !== "#D6BD8B" ||
    runtimeHandoff.alphaContract !== "binary-only-0-or-255" ||
    runtimeHandoff.scalingContract !== "integer-nearest-neighbour-only" ||
    runtimeHandoff.runtimeFiles.length !== 45
  ) {
    throw new Error("Canonical runtime asset display contract drifted.");
  }

  return Object.freeze(
    runtimeHandoff.runtimeFiles.map((entry) => {
      const modulePath = `./canonical-runtime-assets-v2/${entry.relativePath}`;
      const url = assetUrls[modulePath];
      if (!url)
        throw new Error(`Canonical runtime asset is missing: ${modulePath}`);
      return Object.freeze({
        ...entry,
        frames: Object.freeze(
          entry.frames.map((frame) => Object.freeze(frame)),
        ),
        textureKey: textureKey(entry.fileId),
        url,
      });
    }),
  );
}

export const CANONICAL_RUNTIME_ASSETS = buildRuntimeAssets();
export const CANONICAL_RUNTIME_ASSET_BY_ID = new Map(
  CANONICAL_RUNTIME_ASSETS.map((asset) => [asset.fileId, asset] as const),
);

export const CANONICAL_RUNTIME_ASSET_MANIFEST = Object.freeze({
  schemaVersion: runtimeHandoff.schemaVersion,
  status: runtimeHandoff.status,
  logicalResolution: runtimeHandoff.logicalResolution,
  palette: runtimeHandoff.palette,
  alphaContract: runtimeHandoff.alphaContract,
  scalingContract: runtimeHandoff.scalingContract,
  sourceManifest: Object.freeze({
    relativePath:
      "src/assets/canonical-runtime-assets-v2/manifests/source-manifest.json",
    sha256: CANONICAL_MANIFEST_HASHES.sourceManifest,
  }),
  assets: CANONICAL_RUNTIME_ASSETS,
  skipixlDesignerEncounter: runtimeHandoff.skipixlDesignerEncounter,
});

export function requireCanonicalAsset(fileId: string): CanonicalRuntimeAsset {
  const asset = CANONICAL_RUNTIME_ASSET_BY_ID.get(fileId);
  if (!asset) throw new Error(`Unknown canonical runtime asset: ${fileId}`);
  return asset;
}

export function requireCanonicalFrame(
  fileId: string,
  frameId: string,
): Readonly<{ asset: CanonicalRuntimeAsset; frame: CanonicalFrame }> {
  const asset = requireCanonicalAsset(fileId);
  const frame = asset.frames.find((candidate) => candidate.frameId === frameId);
  if (!frame) {
    throw new Error(`Canonical runtime frame is missing: ${fileId}/${frameId}`);
  }
  return Object.freeze({ asset, frame });
}
