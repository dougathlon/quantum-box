import { BROWN_BOX_ASSET_MANIFEST } from "../display/BrownBoxAssetManifest";
import {
  CANONICAL_MANIFEST_HASHES,
  CANONICAL_RUNTIME_ASSET_MANIFEST,
} from "./CanonicalRuntimeAssets";
import {
  QGRAPH_CABINET_MANIFEST_HASHES,
  QGRAPH_CABINET_RUNTIME_ASSET_MANIFEST,
} from "./QGraphCabinetAssets";

export const QUANTUM_BOX_ASSETS = Object.freeze({
  shell: BROWN_BOX_ASSET_MANIFEST.title,
  display: BROWN_BOX_ASSET_MANIFEST.internalFields,
  displayProgramme: BROWN_BOX_ASSET_MANIFEST.internalFieldProgramme,
  canonicalRuntime: CANONICAL_RUNTIME_ASSET_MANIFEST,
  canonicalManifestHashes: CANONICAL_MANIFEST_HASHES,
  qgraphCabinetRuntime: QGRAPH_CABINET_RUNTIME_ASSET_MANIFEST,
  qgraphCabinetManifestHashes: QGRAPH_CABINET_MANIFEST_HASHES,
});
