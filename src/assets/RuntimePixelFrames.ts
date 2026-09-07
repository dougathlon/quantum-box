import runtimePixelFramesJson from "./runtime-pixel-frames-v1.json";

export type RuntimePixelFrameFamily =
  | "canonical-runtime-v2"
  | "qgraph-cabinet-v1";

interface RuntimePixelFrameJson {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly string[];
}

interface RuntimePixelFrameFamilyJson {
  readonly familyId: RuntimePixelFrameFamily;
  readonly manifestPath: string;
  readonly manifestSha256: string;
  readonly frameCount: number;
  readonly frames: Readonly<Record<string, RuntimePixelFrameJson>>;
}

interface RuntimePixelFramesJson {
  readonly schemaVersion: string;
  readonly status: string;
  readonly encoding: Readonly<Record<string, string>>;
  readonly families: readonly RuntimePixelFrameFamilyJson[];
}

interface RuntimePixelFrame {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly string[];
}

const payload = runtimePixelFramesJson as RuntimePixelFramesJson;
const EXPECTED_FRAME_COUNTS: Readonly<Record<RuntimePixelFrameFamily, number>> =
  Object.freeze({
    "canonical-runtime-v2": 98,
    "qgraph-cabinet-v1": 81,
  });

function buildFrameIndex(): ReadonlyMap<
  RuntimePixelFrameFamily,
  ReadonlyMap<string, RuntimePixelFrame>
> {
  if (
    payload.schemaVersion !== "quantum-box-runtime-pixel-frames-v1" ||
    payload.status !== "deterministic-build-time-browser-independent-raster" ||
    payload.encoding["."] !== "transparent" ||
    payload.encoding["D"] !== "#2B1C14" ||
    payload.encoding["T"] !== "#564330" ||
    payload.encoding["C"] !== "#D6BD8B"
  ) {
    throw new Error("Runtime pixel frame contract drifted.");
  }

  const families = new Map<
    RuntimePixelFrameFamily,
    ReadonlyMap<string, RuntimePixelFrame>
  >();
  for (const family of payload.families) {
    const expectedCount = EXPECTED_FRAME_COUNTS[family.familyId];
    if (
      expectedCount === undefined ||
      family.frameCount !== expectedCount ||
      Object.keys(family.frames).length !== expectedCount ||
      families.has(family.familyId)
    ) {
      throw new Error(`Runtime pixel frame family drifted: ${family.familyId}`);
    }
    const frames = new Map<string, RuntimePixelFrame>();
    for (const [frameKey, frame] of Object.entries(family.frames)) {
      if (
        frame.width <= 0 ||
        frame.height <= 0 ||
        frame.rows.length !== frame.height ||
        frame.rows.some(
          (row) => row.length !== frame.width || /[^.DTC]/u.test(row),
        )
      ) {
        throw new Error(
          `Runtime pixel frame data is invalid: ${family.familyId}/${frameKey}`,
        );
      }
      frames.set(
        frameKey,
        Object.freeze({
          width: frame.width,
          height: frame.height,
          rows: Object.freeze([...frame.rows]),
        }),
      );
    }
    families.set(family.familyId, frames);
  }
  if (families.size !== Object.keys(EXPECTED_FRAME_COUNTS).length) {
    throw new Error("Runtime pixel frame family coverage drifted.");
  }
  return families;
}

const FRAME_INDEX = buildFrameIndex();

export const RUNTIME_PIXEL_FRAME_SUMMARY = Object.freeze(
  payload.families.map((family) =>
    Object.freeze({
      familyId: family.familyId,
      manifestPath: family.manifestPath,
      manifestSha256: family.manifestSha256,
      frameCount: family.frameCount,
    }),
  ),
);

export function requireRuntimePixelFrame(
  familyId: RuntimePixelFrameFamily,
  fileId: string,
  frameId: string,
): RuntimePixelFrame {
  const frame = FRAME_INDEX.get(familyId)?.get(`${fileId}/${frameId}`);
  if (!frame) {
    throw new Error(
      `Runtime pixel frame is missing: ${familyId}/${fileId}/${frameId}`,
    );
  }
  return frame;
}
