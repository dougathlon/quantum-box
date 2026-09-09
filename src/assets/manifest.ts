import {
  BROWN_BOX_FIELD_PROVENANCE,
  BROWN_BOX_FIELD_STATES,
} from "../display/BrownBoxField";
import {
  CANONICAL_MANIFEST_HASHES,
  CANONICAL_RUNTIME_ASSET_MANIFEST,
} from "./CanonicalRuntimeAssets";
import {
  QGRAPH_CABINET_MANIFEST_HASHES,
  QGRAPH_CABINET_RUNTIME_ASSET_MANIFEST,
} from "./QGraphCabinetAssets";

export const QUANTUM_BOX_ASSETS = Object.freeze({
  display: BROWN_BOX_FIELD_STATES,
  displayProgramme: BROWN_BOX_FIELD_PROVENANCE,
  canonicalRuntime: CANONICAL_RUNTIME_ASSET_MANIFEST,
  canonicalManifestHashes: CANONICAL_MANIFEST_HASHES,
  qgraphCabinetRuntime: QGRAPH_CABINET_RUNTIME_ASSET_MANIFEST,
  qgraphCabinetManifestHashes: QGRAPH_CABINET_MANIFEST_HASHES,
});
