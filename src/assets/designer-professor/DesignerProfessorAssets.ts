import runtimeHandoffJson from "./manifests/runtime-handoff.json";
import type { StoryV2AssetCue } from "../../story/v2/types";

export interface DesignerProfessorFrame {
  readonly frameId: string;
  readonly order: number;
  readonly rect: Readonly<{
    x: number;
    y: number;
    width: 20;
    height: 20;
  }>;
  readonly anchor: Readonly<{
    x: 10;
    y: 20;
    convention: "frame-local-integer";
  }>;
  readonly derivationMethod: string;
  readonly parents: readonly string[];
}

export interface DesignerProfessorRuntimeAsset {
  readonly fileId: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly dimensions: Readonly<{ width: number; height: 20 }>;
  readonly kind:
    | "single-frame-runtime-sprite"
    | "runtime-sprite-strip"
    | "runtime-morph-strip";
  readonly frames: readonly DesignerProfessorFrame[];
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
  readonly sourceManifest: Readonly<{
    relativePath: string;
    sha256: string;
  }>;
  readonly morphDescriptors: Readonly<{
    relativePath: string;
    sha256: string;
  }>;
  readonly runtimeFiles: readonly Omit<
    DesignerProfessorRuntimeAsset,
    "textureKey" | "url"
  >[];
}

export type StoryV2ResolvedAssetCue =
  | Readonly<{
      source: "designer-professor-v1";
      fileId: string;
      frameIds: readonly string[];
    }>
  | Readonly<{
      source: "canonical-runtime-v2";
      fileId: "player-c-four-direction-walk-strip";
      frameIds: readonly ["front-idle"];
    }>;

const runtimeHandoff = runtimeHandoffJson as RuntimeHandoffJson;
const assetUrls = import.meta.glob<string>("./assets/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

export const DESIGNER_PROFESSOR_MANIFEST_HASHES = Object.freeze({
  sourceManifest:
    "91052a8af94842f5a74e84991ed5ff428d871d41ad2bc81bbea7b6b51c0c68bf",
  morphDescriptors:
    "50595463b981fd6f8f00cf5a33341059bd5003acb6784ffb6ab7448df0edef25",
  runtimeHandoff:
    "ca9cb19abf0e68b4daccf1f19e833186dda74f48c2d27c3c00dc48e8dab1a496",
});

function buildRuntimeAssets(): readonly DesignerProfessorRuntimeAsset[] {
  if (
    runtimeHandoff.schemaVersion !==
      "quantum-box-designer-professor-runtime-handoff-v1" ||
    runtimeHandoff.status !== "deterministic-local-runtime-handoff" ||
    runtimeHandoff.logicalResolution.width !== 320 ||
    runtimeHandoff.logicalResolution.height !== 180 ||
    runtimeHandoff.palette.darkTobacco !== "#2B1C14" ||
    runtimeHandoff.palette.mutedTan !== "#564330" ||
    runtimeHandoff.palette.warmCream !== "#D6BD8B" ||
    runtimeHandoff.alphaContract !== "binary-only-0-or-255" ||
    runtimeHandoff.scalingContract !== "integer-nearest-neighbour-only" ||
    runtimeHandoff.sourceManifest.sha256 !==
      DESIGNER_PROFESSOR_MANIFEST_HASHES.sourceManifest ||
    runtimeHandoff.morphDescriptors.sha256 !==
      DESIGNER_PROFESSOR_MANIFEST_HASHES.morphDescriptors ||
    runtimeHandoff.runtimeFiles.length !== 12
  ) {
    throw new Error("Designer Professor runtime asset contract drifted.");
  }

  return Object.freeze(
    runtimeHandoff.runtimeFiles.map((entry) => {
      const modulePath = `./${entry.relativePath}`;
      const url = assetUrls[modulePath];
      if (!url) {
        throw new Error(`Designer Professor asset is missing: ${modulePath}`);
      }
      return Object.freeze({
        ...entry,
        frames: Object.freeze(
          entry.frames.map((frame) => Object.freeze(frame)),
        ),
        textureKey: `qbox-designer-professor-v1:${entry.fileId}`,
        url,
      });
    }),
  );
}

export const DESIGNER_PROFESSOR_RUNTIME_ASSETS = buildRuntimeAssets();
export const DESIGNER_PROFESSOR_RUNTIME_ASSET_BY_ID = new Map(
  DESIGNER_PROFESSOR_RUNTIME_ASSETS.map(
    (asset) => [asset.fileId, asset] as const,
  ),
);

export const DESIGNER_PROFESSOR_RUNTIME_ASSET_MANIFEST = Object.freeze({
  schemaVersion: runtimeHandoff.schemaVersion,
  status: runtimeHandoff.status,
  logicalResolution: runtimeHandoff.logicalResolution,
  palette: runtimeHandoff.palette,
  alphaContract: runtimeHandoff.alphaContract,
  scalingContract: runtimeHandoff.scalingContract,
  sourceManifest: runtimeHandoff.sourceManifest,
  morphDescriptors: runtimeHandoff.morphDescriptors,
  assets: DESIGNER_PROFESSOR_RUNTIME_ASSETS,
});

export function requireDesignerProfessorAsset(
  fileId: string,
): DesignerProfessorRuntimeAsset {
  const asset = DESIGNER_PROFESSOR_RUNTIME_ASSET_BY_ID.get(fileId);
  if (!asset) throw new Error(`Unknown Designer Professor asset: ${fileId}`);
  return asset;
}

export function requireDesignerProfessorFrame(
  fileId: string,
  frameId: string,
): Readonly<{
  asset: DesignerProfessorRuntimeAsset;
  frame: DesignerProfessorFrame;
}> {
  const asset = requireDesignerProfessorAsset(fileId);
  const frame = asset.frames.find((candidate) => candidate.frameId === frameId);
  if (!frame) {
    throw new Error(
      `Designer Professor frame is missing: ${fileId}/${frameId}`,
    );
  }
  return Object.freeze({ asset, frame });
}

const STORY_V2_ASSET_CUES = Object.freeze({
  "professor-idle": {
    source: "designer-professor-v1",
    fileId: "professor-idle",
    frameIds: ["idle"],
  },
  "professor-walk": {
    source: "designer-professor-v1",
    fileId: "professor-action-strip",
    frameIds: ["walk-a", "walk-b"],
  },
  "professor-talk": {
    source: "designer-professor-v1",
    fileId: "professor-action-strip",
    frameIds: ["talk-a", "talk-b"],
  },
  "professor-open-door": {
    source: "designer-professor-v1",
    fileId: "professor-open-door",
    frameIds: ["open-door"],
  },
  "professor-point": {
    source: "designer-professor-v1",
    fileId: "professor-point",
    frameIds: ["point"],
  },
  "qong-paddle-to-professor": {
    source: "designer-professor-v1",
    fileId: "qong-paddle-to-professor",
    frameIds: [
      "morph-0",
      "morph-1",
      "morph-2",
      "morph-3",
      "morph-4",
      "morph-5",
      "morph-6",
    ],
  },
  "qong-paddle-to-player-c": {
    source: "designer-professor-v1",
    fileId: "qong-paddle-to-player-c",
    frameIds: [
      "morph-0",
      "morph-1",
      "morph-2",
      "morph-3",
      "morph-4",
      "morph-5",
      "morph-6",
    ],
  },
  "quantman-ghost-c-to-professor": {
    source: "designer-professor-v1",
    fileId: "quantman-ghost-c-to-professor",
    frameIds: [
      "morph-0",
      "morph-1",
      "morph-2",
      "morph-3",
      "morph-4",
      "morph-5",
      "morph-6",
    ],
  },
  "quarry-duck-d-to-professor": {
    source: "designer-professor-v1",
    fileId: "quarry-duck-d-to-professor",
    frameIds: [
      "morph-0",
      "morph-1",
      "morph-2",
      "morph-3",
      "morph-4",
      "morph-5",
      "morph-6",
    ],
  },
  "player-c-front-idle": {
    source: "canonical-runtime-v2",
    fileId: "player-c-four-direction-walk-strip",
    frameIds: ["front-idle"],
  },
} as const satisfies Readonly<
  Record<StoryV2AssetCue, StoryV2ResolvedAssetCue>
>);

export function resolveStoryV2AssetCue(
  assetCue: StoryV2AssetCue,
): StoryV2ResolvedAssetCue {
  return STORY_V2_ASSET_CUES[assetCue];
}
