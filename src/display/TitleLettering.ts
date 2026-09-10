import { terminalGlyphRects, terminalTextWidth } from "./TerminalTypeface";
export const TITLE_LETTERING_CONTRACT = Object.freeze({
  logicalScreen: Object.freeze({ width: 320, height: 180 }),
  screenCentreX: 160,
  colour: "#D6BD8B",
  raster: "refined-five-by-seven-v1",
  title: Object.freeze({ text: "QUANTUM BOX", y: 55, pixel: 3, tracking: 3 }),
  prompt: Object.freeze({ text: "PRESS START", y: 99, pixel: 2, tracking: 2 }),
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
  let cursor =
    160 - Math.floor(terminalTextWidth(normalized, pixel, tracking) / 2);
  const result: TitleLetteringRect[] = [];
  for (const character of normalized) {
    for (const r of terminalGlyphRects(character))
      result.push({
        x: cursor + r.x * pixel,
        y: y + r.y * pixel,
        width: r.width * pixel,
        height: r.height * pixel,
      });
    cursor += terminalTextWidth(character, pixel) + tracking;
  }
  return result;
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
      fieldX + Math.round(rect.x * pixelScale),
      fieldY + Math.round(rect.y * pixelScale),
      Math.round((rect.x + rect.width) * pixelScale) -
        Math.round(rect.x * pixelScale),
      Math.round((rect.y + rect.height) * pixelScale) -
        Math.round(rect.y * pixelScale),
    );
  }
  context.restore();
}
