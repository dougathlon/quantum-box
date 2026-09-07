import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activateBrownBoxBackgroundProgramme,
  BROWN_BOX_BACKGROUND_PROGRAMMES,
  isBrownBoxBackgroundProgrammeId,
  requireBrownBoxBackgroundProgramme,
  type BrownBoxBackgroundProgrammeTarget,
  type LoadedBrownBoxBackgroundProgramme,
} from "../../src/display/backgrounds/BrownBoxBackgroundPrograms";

const EXPECTED_HASH_LIST_DIGESTS = Object.freeze({
  "current-four-state-v1":
    "19b11455dc6eff31e13e6a131cb37b11156187c60b1afc64b71e8d274e09b41b",
  "adaptive-direct-v1":
    "543b41edb209e3f6c971a8344cc87c8209aabc50cad180fe58e3a7c74f8cbcef",
  "adaptive-restrained-v1":
    "05d4ae3be3277cd12673b76642412932bc86849d601f28fe0daae131ceeb4648",
  "adaptive-stronger-v1":
    "90b5a2ddd1839931096e40c65758e73693e416d1696c2d0e6f2d181a50f53037",
  "amplified-four-state-v1":
    "f2d50562acf7ef84ef5a37ee0406518cba9e855ada78bfc158f5675b64dd0ce7",
  "seeded-sixteen-state-v1":
    "92d244a31322351c833d7ca1f4bc6ea87dc62457fece2ab729446ca800e8c727",
});

const APPROVED_COLOURS = new Set(["2b1c14", "564330"]);
const originalImage = globalThis.Image;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalImage === undefined) {
    Reflect.deleteProperty(globalThis, "Image");
  } else {
    globalThis.Image = originalImage;
  }
});

describe("Brown Box background programme assets", () => {
  it("pins every clean endpoint by programme and hash-list digest", () => {
    expect(BROWN_BOX_BACKGROUND_PROGRAMMES).toHaveLength(6);
    expect(
      BROWN_BOX_BACKGROUND_PROGRAMMES.reduce(
        (count, programme) => count + programme.states.length,
        0,
      ),
    ).toBe(96);

    for (const programme of BROWN_BOX_BACKGROUND_PROGRAMMES) {
      const digest = createHash("sha256")
        .update(programme.states.map((state) => state.sha256).join("\n"))
        .digest("hex");
      expect(digest, programme.programmeId).toBe(
        EXPECTED_HASH_LIST_DIGESTS[programme.programmeId],
      );
      for (const state of programme.states) {
        expect(sha256(state.relativePath), state.relativePath).toBe(
          state.sha256,
        );
        expect(state.relativePath).not.toMatch(/apng|poster|comparison/i);
      }
    }
  });

  it("keeps every endpoint at 320x180 with only the approved two colours", () => {
    for (const programme of BROWN_BOX_BACKGROUND_PROGRAMMES) {
      expect(programme.width).toBe(320);
      expect(programme.height).toBe(180);
      expect(programme.palette).toEqual(["#2B1C14", "#564330"]);
      for (const state of programme.states) {
        const inspection = inspectRgbPng(readFileSync(state.relativePath));
        expect(inspection, state.relativePath).toEqual({
          width: 320,
          height: 180,
          colours: ["2b1c14", "564330"],
          animated: false,
        });
      }
    }
  });

  it("retains the recorded provenance classifications and local loop caveat", () => {
    const current = requireBrownBoxBackgroundProgramme("current-four-state-v1");
    const adaptive = requireBrownBoxBackgroundProgramme("adaptive-direct-v1");
    const amplified = requireBrownBoxBackgroundProgramme(
      "amplified-four-state-v1",
    );
    const seeded = requireBrownBoxBackgroundProgramme(
      "seeded-sixteen-state-v1",
    );

    expect(current.label).toBe("STANDARD");
    expect(current.provenance.classification).toBe(
      "exact programme reconstruction using authentic IBM Fez returned values under a local fixed-midpoint two-color presentation mapping",
    );
    expect(adaptive.provenance.classification).toBe(
      "review-only comparison; provider keyframes and local derived whole-field states are explicitly separated",
    );
    expect(
      new Set(adaptive.states.map((state) => state.classification)),
    ).toEqual(new Set(["local whole-field review state"]));
    expect(amplified.provenance.classification).toBe(
      "Review-only local composition of preserved IBM Fez QPixl-returned 20x20 panels; not a provider-rendered whole-screen field.",
    );
    expect(seeded.provenance.classification).toBe(
      "Review-only classically seeded evolution assembled entirely from preserved IBM Fez QPixl-returned 20x20 panels; not quantum randomness and not a provider-rendered whole-screen field.",
    );
    expect(seeded.provenance.loopClosure).toBe(
      "Local hard-sweep presentation from state 16 to state 1; not a provider generation.",
    );
  });

  it("validates programme IDs without accepting arbitrary saved values", () => {
    expect(isBrownBoxBackgroundProgrammeId("adaptive-restrained-v1")).toBe(
      true,
    );
    expect(isBrownBoxBackgroundProgrammeId("baseline")).toBe(false);
    expect(isBrownBoxBackgroundProgrammeId(null)).toBe(false);
  });
});

describe("Brown Box background programme activation", () => {
  it("loads the complete programme before switching every target at one epoch", async () => {
    class CompleteImage {
      public complete = true;
      public naturalWidth = 320;
      public naturalHeight = 180;
      public decoding = "async";
      public src = "";

      public addEventListener(): void {}
    }
    globalThis.Image = CompleteImage as unknown as typeof Image;
    vi.spyOn(performance, "now").mockReturnValue(12_345);
    const calls: Array<{
      loaded: LoadedBrownBoxBackgroundProgramme;
      startedAtMs: number;
    }> = [];
    const target = (): BrownBoxBackgroundProgrammeTarget => ({
      setProgramme(loaded, startedAtMs) {
        calls.push({ loaded, startedAtMs });
      },
    });

    await activateBrownBoxBackgroundProgramme("seeded-sixteen-state-v1", [
      target(),
      target(),
    ]);

    expect(calls).toHaveLength(2);
    expect(calls[0]!.loaded).toBe(calls[1]!.loaded);
    expect(calls[0]!.loaded.images).toHaveLength(16);
    expect(calls[0]!.loaded.programme.programmeId).toBe(
      "seeded-sixteen-state-v1",
    );
    expect(calls.map((call) => call.startedAtMs)).toEqual([12_345, 12_345]);
  });

  it("refuses an activation with no render target", async () => {
    await expect(
      activateBrownBoxBackgroundProgramme("current-four-state-v1", []),
    ).rejects.toThrow(/requires a target/);
  });

  it("leaves every target untouched when any selected endpoint is invalid", async () => {
    class InvalidImage {
      public complete = true;
      public naturalWidth = 319;
      public naturalHeight = 180;
      public decoding = "async";
      public src = "";

      public addEventListener(): void {}
    }
    globalThis.Image = InvalidImage as unknown as typeof Image;
    const setProgramme = vi.fn();

    await expect(
      activateBrownBoxBackgroundProgramme("adaptive-stronger-v1", [
        { setProgramme },
      ]),
    ).rejects.toThrow(/invalid dimensions/);
    expect(setProgramme).not.toHaveBeenCalled();
  });
});

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function inspectRgbPng(buffer: Buffer): Readonly<{
  width: number;
  height: number;
  colours: string[];
  animated: boolean;
}> {
  expect(buffer.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = -1;
  let colourType = -1;
  let interlace = -1;
  let animated = false;
  const idat: Buffer[] = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colourType = data[9]!;
      interlace = data[12]!;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "acTL" || type === "fcTL" || type === "fdAT") {
      animated = true;
    }
    if (type === "IEND") break;
  }
  expect({ bitDepth, colourType, interlace }).toEqual({
    bitDepth: 8,
    colourType: 2,
    interlace: 0,
  });

  const inflated = inflateSync(Buffer.concat(idat));
  const bytesPerPixel = 3;
  const rowLength = width * bytesPerPixel;
  const colours = new Set<string>();
  let previous = Buffer.alloc(rowLength);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = inflated[sourceOffset]!;
    const source = inflated.subarray(
      sourceOffset + 1,
      sourceOffset + 1 + rowLength,
    );
    const decoded = Buffer.alloc(rowLength);
    for (let index = 0; index < rowLength; index += 1) {
      const left = index >= bytesPerPixel ? decoded[index - bytesPerPixel]! : 0;
      const above = previous[index]!;
      const upperLeft =
        index >= bytesPerPixel ? previous[index - bytesPerPixel]! : 0;
      const predictor = pngPredictor(filter, left, above, upperLeft);
      decoded[index] = (source[index]! + predictor) & 0xff;
    }
    for (let index = 0; index < rowLength; index += bytesPerPixel) {
      const colour = decoded
        .subarray(index, index + bytesPerPixel)
        .toString("hex");
      if (!APPROVED_COLOURS.has(colour)) {
        throw new Error(`Unapproved Brown Box background colour: ${colour}`);
      }
      colours.add(colour);
    }
    previous = decoded;
    sourceOffset += rowLength + 1;
  }
  expect(sourceOffset).toBe(inflated.length);
  return Object.freeze({
    width,
    height,
    colours: [...colours].sort(),
    animated,
  });
}

function pngPredictor(
  filter: number,
  left: number,
  above: number,
  upperLeft: number,
): number {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return above;
  if (filter === 3) return Math.floor((left + above) / 2);
  if (filter === 4) return paeth(left, above, upperLeft);
  throw new Error(`Unsupported PNG filter: ${filter}`);
}

function paeth(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}
