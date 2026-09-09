export const TITLE_LETTERING_CONTRACT = Object.freeze({
  logicalScreen: Object.freeze({ width: 320, height: 180 }),
  screenCentreX: 160,
  colour: "#D6BD8B",
  raster: "five-by-seven-field-grid-v5",
  title: Object.freeze({ text: "QUANTUM BOX", y: 55, pixel: 3, tracking: 3 }),
  prompt: Object.freeze({ text: "PRESS START", y: 99, pixel: 2, tracking: 2 }),
});

type FiveBySevenGlyph = readonly string[];

const glyph = (source: string): FiveBySevenGlyph =>
  Object.freeze(source.trim().split("\n"));

/**
 * An original 5x7 face for the native Brown Box opening.
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
  tracking = pixel,
): readonly TitleLetteringRect[] {
  const normalized = text.toUpperCase();
  const widths = [...normalized].map((character) =>
    character === " " ? 3 : 5,
  );
  const totalWidth =
    widths.reduce((sum, width) => sum + width * pixel, 0) +
    Math.max(0, widths.length - 1) * tracking;
  let cursorX =
    TITLE_LETTERING_CONTRACT.screenCentreX - Math.floor(totalWidth / 2);
  const rects: TitleLetteringRect[] = [];

  for (
    let characterIndex = 0;
    characterIndex < normalized.length;
    characterIndex += 1
  ) {
    const character = normalized[characterIndex]!;
    if (character === " ") {
      cursorX += 3 * pixel;
    } else {
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
      cursorX += 5 * pixel;
    }
    if (characterIndex < normalized.length - 1) cursorX += tracking;
  }
  return Object.freeze(rects);
}

export function drawTitleLettering(
  context: CanvasRenderingContext2D,
  fieldX: number,
  fieldY: number,
  pixelScale: number,
): void {
  if (!Number.isInteger(fieldX) || !Number.isInteger(fieldY)) {
    throw new Error("Title lettering field origin must use integer pixels.");
  }
  if (!Number.isInteger(pixelScale) || pixelScale <= 0) {
    throw new Error("Title lettering scale must be a positive integer.");
  }
  const title = TITLE_LETTERING_CONTRACT.title;
  const prompt = TITLE_LETTERING_CONTRACT.prompt;
  const rects = [
    ...titleLetteringRects(title.text, title.y, title.pixel, title.tracking),
    ...titleLetteringRects(
      prompt.text,
      prompt.y,
      prompt.pixel,
      prompt.tracking,
    ),
  ];
  context.save();
  context.fillStyle = TITLE_LETTERING_CONTRACT.colour;
  for (const rect of rects) {
    context.fillRect(
      fieldX + rect.x * pixelScale,
      fieldY + rect.y * pixelScale,
      rect.width * pixelScale,
      rect.height * pixelScale,
    );
  }
  context.restore();
}
