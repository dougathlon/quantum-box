export const TITLE_LETTERING_CONTRACT = Object.freeze({
  viewBox: Object.freeze({ width: 1672, height: 941 }),
  screenCentreX: 724,
  colour: "#D6BD8B",
  raster: "five-by-seven-original-v1",
  title: Object.freeze({ text: "QUANTUM BOX", y: 252, pixel: 10 }),
  prompt: Object.freeze({ text: "PRESS START", y: 399, pixel: 6 }),
});

type FiveBySevenGlyph = readonly string[];

const glyph = (source: string): FiveBySevenGlyph =>
  Object.freeze(source.trim().split("\n"));

/**
 * An original, deliberately small 5x7 face for the photographed title only.
 * It borrows the constraints of 1970s terminal character generators, not the
 * outline of any one historical typeface. Internal UI text remains 3x5.
 */
const TITLE_GLYPHS: Readonly<Record<string, FiveBySevenGlyph>> = Object.freeze({
  A: glyph(`
.###.
#...#
#...#
#####
#...#
#...#
#...#`),
  B: glyph(`
####.
#...#
#...#
####.
#...#
#...#
####.`),
  E: glyph(`
#####
#....
#....
####.
#....
#....
#####`),
  M: glyph(`
#...#
##.##
#.#.#
#.#.#
#...#
#...#
#...#`),
  N: glyph(`
#...#
##..#
##..#
#.#.#
#..##
#..##
#...#`),
  O: glyph(`
.###.
#...#
#...#
#...#
#...#
#...#
.###.`),
  P: glyph(`
####.
#...#
#...#
####.
#....
#....
#....`),
  Q: glyph(`
.###.
#...#
#...#
#...#
#.#.#
#..##
.####`),
  R: glyph(`
####.
#...#
#...#
####.
#.#..
#..#.
#...#`),
  S: glyph(`
.####
#....
#....
.###.
....#
....#
####.`),
  T: glyph(`
#####
..#..
..#..
..#..
..#..
..#..
..#..`),
  U: glyph(`
#...#
#...#
#...#
#...#
#...#
#...#
.###.`),
  X: glyph(`
#...#
.#.#.
.#.#.
..#..
.#.#.
.#.#.
#...#`),
});

export interface TitleLetteringRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function titleLetteringRects(
  text: string,
  y: number,
  pixel: number,
): readonly TitleLetteringRect[] {
  const normalized = text.toUpperCase();
  const widths = [...normalized].map((character) =>
    character === " " ? 3 : 5,
  );
  const totalColumns =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, widths.length - 1);
  let cursorX =
    TITLE_LETTERING_CONTRACT.screenCentreX -
    Math.floor((totalColumns * pixel) / 2);
  const rects: TitleLetteringRect[] = [];

  for (const character of normalized) {
    if (character === " ") {
      cursorX += 4 * pixel;
      continue;
    }
    const pattern = TITLE_GLYPHS[character];
    if (!pattern) throw new Error(`Unsupported title glyph: ${character}.`);
    for (let row = 0; row < pattern.length; row += 1) {
      for (let column = 0; column < pattern[row]!.length; column += 1) {
        if (pattern[row]![column] !== "#") continue;
        rects.push(
          Object.freeze({
            x: cursorX + column * pixel,
            y: y + row * pixel,
            width: pixel,
            height: pixel,
          }),
        );
      }
    }
    cursorX += 6 * pixel;
  }
  return Object.freeze(rects);
}

export function drawTitleLettering(
  context: CanvasRenderingContext2D,
  assetX: number,
  assetY: number,
  assetScale: number,
): void {
  if (!Number.isFinite(assetScale) || assetScale <= 0) {
    throw new Error("Title lettering scale must be positive and finite.");
  }
  const title = TITLE_LETTERING_CONTRACT.title;
  const prompt = TITLE_LETTERING_CONTRACT.prompt;
  const rects = [
    ...titleLetteringRects(title.text, title.y, title.pixel),
    ...titleLetteringRects(prompt.text, prompt.y, prompt.pixel),
  ];
  context.save();
  context.fillStyle = TITLE_LETTERING_CONTRACT.colour;
  for (const rect of rects) {
    const left = Math.round(assetX + rect.x * assetScale);
    const top = Math.round(assetY + rect.y * assetScale);
    const right = Math.round(assetX + (rect.x + rect.width) * assetScale);
    const bottom = Math.round(assetY + (rect.y + rect.height) * assetScale);
    context.fillRect(
      left,
      top,
      Math.max(1, right - left),
      Math.max(1, bottom - top),
    );
  }
  context.restore();
}
