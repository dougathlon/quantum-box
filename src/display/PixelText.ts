import Phaser from "phaser";

export type PixelTextAlign = "left" | "center" | "right";

export interface PixelTextOptions {
  readonly x: number;
  readonly y: number;
  readonly pixel: number;
  readonly colour: number;
  readonly align?: PixelTextAlign;
  readonly spacing?: number;
}

export interface PixelTextBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface CanvasPixelTextOptions {
  readonly x: number;
  readonly y: number;
  readonly pixel: number;
  readonly colour: string;
  readonly align?: PixelTextAlign;
  readonly spacing?: number;
}

export interface PixelTextRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

type PixelGlyph = readonly string[];

const glyph = (source: string): PixelGlyph =>
  Object.freeze(source.trim().split("\n"));

const GLYPHS: Readonly<Record<string, PixelGlyph>> = Object.freeze({
  " ": glyph(`
.
.
.
.
.`),
  "0": glyph(`
###
#.#
#.#
#.#
###`),
  "1": glyph(`
.#.
##.
.#.
.#.
###`),
  "2": glyph(`
###
..#
###
#..
###`),
  "3": glyph(`
###
..#
.##
..#
###`),
  "4": glyph(`
#.#
#.#
###
..#
..#`),
  "5": glyph(`
###
#..
###
..#
###`),
  "6": glyph(`
###
#..
###
#.#
###`),
  "7": glyph(`
###
..#
.#.
.#.
.#.`),
  "8": glyph(`
###
#.#
###
#.#
###`),
  "9": glyph(`
###
#.#
###
..#
###`),
  A: glyph(`
.#.
#.#
###
#.#
#.#`),
  B: glyph(`
##.
#.#
##.
#.#
##.`),
  C: glyph(`
.##
#..
#..
#..
.##`),
  D: glyph(`
##.
#.#
#.#
#.#
##.`),
  E: glyph(`
###
#..
##.
#..
###`),
  F: glyph(`
###
#..
##.
#..
#..`),
  G: glyph(`
.##
#..
#.#
#.#
.##`),
  H: glyph(`
#.#
#.#
###
#.#
#.#`),
  I: glyph(`
###
.#.
.#.
.#.
###`),
  J: glyph(`
..#
..#
..#
#.#
.#.`),
  K: glyph(`
#.#
#.#
##.
#.#
#.#`),
  L: glyph(`
#..
#..
#..
#..
###`),
  M: glyph(`
#...#
##.##
#.#.#
#...#
#...#`),
  N: glyph(`
#...#
##..#
#.#.#
#..##
#...#`),
  O: glyph(`
.#.
#.#
#.#
#.#
.#.`),
  P: glyph(`
##.
#.#
##.
#..
#..`),
  Q: glyph(`
.##.
#..#
#..#
#.##
.###`),
  R: glyph(`
##.
#.#
##.
#.#
#.#`),
  S: glyph(`
.##
#..
.#.
..#
##.`),
  T: glyph(`
###
.#.
.#.
.#.
.#.`),
  U: glyph(`
#.#
#.#
#.#
#.#
###`),
  V: glyph(`
#.#
#.#
#.#
#.#
.#.`),
  W: glyph(`
#...#
#...#
#.#.#
##.##
#...#`),
  X: glyph(`
#.#
#.#
.#.
#.#
#.#`),
  Y: glyph(`
#.#
#.#
.#.
.#.
.#.`),
  Z: glyph(`
###
..#
.#.
#..
###`),
  ":": glyph(`
.
#
.
#
.`),
  ".": glyph(`
.
.
.
.
#`),
  "·": glyph(`
.
.
#
.
.`),
  "-": glyph(`
...
...
###
...
...`),
  "/": glyph(`
..#
..#
.#.
#..
#..`),
  "?": glyph(`
##.
..#
.#.
...
.#.`),
  "!": glyph(`
#
#
#
.
#`),
  ",": glyph(`
.
.
.
#
#`),
  "'": glyph(`
#
#
.
.
.`),
  '"': glyph(`
#.#
#.#
...
...
...`),
  "+": glyph(`
...
.#.
###
.#.
...`),
  "=": glyph(`
...
###
...
###
...`),
  "%": glyph(`
##..#
##.#.
..#..
.#.##
#..##`),
  "(": glyph(`
.#
#.
#.
#.
.#`),
  ")": glyph(`
#.
.#
.#
.#
#.`),
  "[": glyph(`
##
#.
#.
#.
##`),
  "]": glyph(`
##
.#
.#
.#
##`),
  "|": glyph(`
#
#
#
#
#`),
  _: glyph(`
...
...
...
...
###`),
  "<": glyph(`
..#
.#.
#..
.#.
..#`),
  ">": glyph(`
#..
.#.
..#
.#.
#..`),
  "#": glyph(`
.#.#.
#####
.#.#.
#####
.#.#.`),
  "&": glyph(`
.##.
#...
.##.
#..#
.###`),
  "🔒": glyph(`
.###.
.#.#.
#####
#.#.#
#####`),
  "🔓": glyph(`
.###.
.#...
#####
#.#.#
#####`),
  "™": glyph(`
###.#.#
.#.###.
.#.#.#.
.......
.......`),
});

const FALLBACK_GLYPH = GLYPHS["?"] as PixelGlyph;

export function drawPixelText(
  graphics: Phaser.GameObjects.Graphics,
  text: string,
  options: PixelTextOptions,
): PixelTextBounds {
  const normalized = text.toUpperCase();
  const spacing = options.spacing ?? options.pixel;
  const width = pixelTextWidth(normalized, options.pixel, spacing);
  const height = 5 * options.pixel;
  const left = alignedLeft(options.x, width, options.align ?? "left");

  graphics.fillStyle(options.colour, 1);
  for (const rect of pixelTextRects(normalized, {
    x: left,
    y: options.y,
    pixel: options.pixel,
    spacing,
  })) {
    graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  return Object.freeze({ left, top: options.y, width, height });
}

export function drawCanvasPixelText(
  context: CanvasRenderingContext2D,
  text: string,
  options: CanvasPixelTextOptions,
): PixelTextBounds {
  const normalized = normalizePixelText(text);
  const spacing = options.spacing ?? options.pixel;
  const width = pixelTextWidth(normalized, options.pixel, spacing);
  const height = 5 * options.pixel;
  const left = alignedLeft(options.x, width, options.align ?? "left");
  context.fillStyle = options.colour;
  for (const rect of pixelTextRects(normalized, {
    x: left,
    y: options.y,
    pixel: options.pixel,
    spacing,
  })) {
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  return Object.freeze({ left, top: options.y, width, height });
}

export function pixelTextRects(
  text: string,
  options: Readonly<{
    x: number;
    y: number;
    pixel: number;
    spacing?: number;
  }>,
): readonly PixelTextRect[] {
  for (const [name, value] of [
    ["x", options.x],
    ["y", options.y],
    ["pixel", options.pixel],
    ["spacing", options.spacing ?? options.pixel],
  ] as const) {
    if (
      !Number.isInteger(value) ||
      (name !== "x" && name !== "y" && value <= 0)
    ) {
      throw new Error(`Pixel text ${name} must use a native integer.`);
    }
  }
  const normalized = normalizePixelText(text);
  const spacing = options.spacing ?? options.pixel;
  const rectangles: PixelTextRect[] = [];
  let cursor = options.x;
  for (const character of normalized) {
    const pattern = GLYPHS[character] ?? FALLBACK_GLYPH;
    const glyphWidth = pattern.reduce(
      (maximum, row) => Math.max(maximum, row.length),
      0,
    );
    pattern.forEach((row, rowIndex) => {
      for (let column = 0; column < row.length; column += 1) {
        if (row[column] !== "#") continue;
        rectangles.push(
          Object.freeze({
            x: cursor + column * options.pixel,
            y: options.y + rowIndex * options.pixel,
            width: options.pixel,
            height: options.pixel,
          }),
        );
      }
    });
    cursor += glyphWidth * options.pixel + spacing;
  }
  return Object.freeze(rectangles);
}

export function pixelTextWidth(
  text: string,
  pixel: number,
  spacing = pixel,
): number {
  const normalized = normalizePixelText(text);
  if (normalized.length === 0) return 0;
  const characters = [...normalized];
  const glyphWidth = characters.reduce((width, character) => {
    const pattern = GLYPHS[character] ?? FALLBACK_GLYPH;
    return (
      width +
      pattern.reduce((maximum, row) => Math.max(maximum, row.length), 0) * pixel
    );
  }, 0);
  return glyphWidth + spacing * (characters.length - 1);
}

export function normalizePixelText(text: string): string {
  return text
    .toUpperCase()
    .replaceAll("×", "X")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("→", ">")
    .replaceAll("←", "<")
    .replaceAll("▶", ">")
    .replaceAll("◀", "<")
    .replaceAll("⟩", ">")
    .replaceAll("⟨", "<")
    .replaceAll("⟶", ">")
    .replaceAll("•", "·")
    .replaceAll("…", "...")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"');
}

function alignedLeft(x: number, width: number, align: PixelTextAlign): number {
  if (align === "center") return Math.round(x - width / 2);
  if (align === "right") return x - width;
  return x;
}
