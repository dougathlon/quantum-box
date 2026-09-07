import {
  QGRAPH_CABINET_PACK_SCHEMA,
  QGRAPH_FRAME_SCHEMA,
  validateQGraphCabinetPack,
} from "./QGraphPack";

const syntheticProvenance = Object.freeze({
  kind: "synthetic-model" as const,
  modelId: "qgraph-cabinet-synthetic-model-v1",
  generatorVersion: "explicit-weight-table-v1",
  claimBoundary:
    "Locally authored synthetic QGraph-compatible measurement distribution. No provider execution, Moth job, IBM job, or QPU output.",
  providerExecution: false as const,
});

/** Production Quarry fixture. Historical cabinet fixtures live separately. */
export const QUAG_SYNTHETIC_QGRAPH_PACK = validateQGraphCabinetPack({
  schemaVersion: QGRAPH_CABINET_PACK_SCHEMA,
  packId: "quag-synthetic-qgraph-pack-v1",
  contentSha256:
    "64fcb2847f8e25093b232e1de3acf582001d2f8436c268b3c5ab8551a2b8955f",
  sourceClassification: "synthetic-model",
  provenance: syntheticProvenance,
  graphSchemaVersion: "graph-v1-measurement-distribution",
  qubitCount: 12,
  bitOrdering: "A>B,A>C,A>D,B>A,B>C,B>D,C>A,C>B,C>D,D>A,D>B,D>C",
  relationshipInterpretation:
    "Each set bit is one directed hunting relation. Zero to three outgoing targets are valid without repair.",
  replay: {
    algorithm: "mulberry32-v1",
    seedNamespace: "quag-qgraph-frames-v1",
    wholeRegisterSampling: true,
  },
  frames: [
    ["110001010100", "001110100001", "101000011010", "000000000000"],
    ["010101001010", "101010100101", "100001110000", "001100000111"],
    ["111000000111", "000111111000", "010010101001", "100101010010"],
    ["001011010100", "110100101001", "010000111100", "101111000010"],
    ["100010011001", "011101100010", "000101010100", "111010101001"],
    ["010001100110", "101100011001", "001010100101", "110101001010"],
  ].map((bitstrings, sequenceIndex) => ({
    schemaVersion: QGRAPH_FRAME_SCHEMA,
    frameId: `quag-frame-${sequenceIndex + 1}`,
    sequenceIndex,
    measurements: bitstrings.map((bitstring, index) => ({
      bitstring,
      weight: [43, 27, 19, 11][index],
    })),
  })),
});
