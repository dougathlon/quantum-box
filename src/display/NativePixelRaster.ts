import type Phaser from "phaser";

export interface NativePixelPoint {
  readonly x: number;
  readonly y: number;
}

export interface NativePixelStroke {
  readonly colour: number;
  readonly thickness?: 1 | 2;
  readonly dash?: Readonly<{ on: number; off: number }>;
}

export function snapNativePixel(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Native pixel positions must be finite.");
  }
  return Math.round(value);
}

export function drawNativePixelRect(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: number,
): void {
  requireInteger(x, "rectangle x");
  requireInteger(y, "rectangle y");
  requirePositiveInteger(width, "rectangle width");
  requirePositiveInteger(height, "rectangle height");
  graphics.fillStyle(colour, 1).fillRect(x, y, width, height);
}

export function drawNativePixelLine(
  graphics: Phaser.GameObjects.Graphics,
  start: NativePixelPoint,
  end: NativePixelPoint,
  stroke: NativePixelStroke,
): void {
  requirePoint(start, "line start");
  requirePoint(end, "line end");
  const thickness = stroke.thickness ?? 1;
  requirePositiveInteger(thickness, "line thickness");
  if (thickness > 2) {
    throw new Error("Native pixel line thickness must be one or two pixels.");
  }
  const dash = stroke.dash;
  if (dash) {
    requirePositiveInteger(dash.on, "dash on length");
    requirePositiveInteger(dash.off, "dash off length");
  }

  let x = start.x;
  let y = start.y;
  const dx = Math.abs(end.x - start.x);
  const sx = start.x < end.x ? 1 : -1;
  const dy = -Math.abs(end.y - start.y);
  const sy = start.y < end.y ? 1 : -1;
  let error = dx + dy;
  let step = 0;
  const cycle = dash ? dash.on + dash.off : 1;

  while (true) {
    if (!dash || step % cycle < dash.on) {
      drawNativePixelRect(graphics, x, y, thickness, thickness, stroke.colour);
    }
    if (x === end.x && y === end.y) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
    step += 1;
  }
}

export function drawNativePixelPolyline(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly NativePixelPoint[],
  stroke: NativePixelStroke,
  closed = false,
): void {
  if (points.length < 2) {
    throw new Error("Native pixel polylines require at least two points.");
  }
  points.forEach((point, index) =>
    requirePoint(point, `polyline point ${index}`),
  );
  for (let index = 1; index < points.length; index += 1) {
    drawNativePixelLine(graphics, points[index - 1]!, points[index]!, stroke);
  }
  if (closed) drawNativePixelLine(graphics, points.at(-1)!, points[0]!, stroke);
}

export function drawNativePixelEllipse(
  graphics: Phaser.GameObjects.Graphics,
  center: NativePixelPoint,
  radiusX: number,
  radiusY: number,
  stroke: NativePixelStroke,
): void {
  requirePoint(center, "ellipse center");
  requirePositiveInteger(radiusX, "ellipse horizontal radius");
  requirePositiveInteger(radiusY, "ellipse vertical radius");
  const points = new Set<string>();
  const add = (x: number, y: number) => points.add(`${x},${y}`);

  for (let x = -radiusX; x <= radiusX; x += 1) {
    const ratio = x / radiusX;
    const y = Math.round(radiusY * Math.sqrt(Math.max(0, 1 - ratio * ratio)));
    add(center.x + x, center.y - y);
    add(center.x + x, center.y + y);
  }
  for (let y = -radiusY; y <= radiusY; y += 1) {
    const ratio = y / radiusY;
    const x = Math.round(radiusX * Math.sqrt(Math.max(0, 1 - ratio * ratio)));
    add(center.x - x, center.y + y);
    add(center.x + x, center.y + y);
  }

  for (const encoded of points) {
    const [x, y] = encoded.split(",").map(Number) as [number, number];
    drawNativePixelRect(
      graphics,
      x,
      y,
      stroke.thickness ?? 1,
      stroke.thickness ?? 1,
      stroke.colour,
    );
  }
}

export function drawNativePixelFilledEllipse(
  graphics: Phaser.GameObjects.Graphics,
  center: NativePixelPoint,
  radiusX: number,
  radiusY: number,
  colour: number,
): void {
  requirePoint(center, "filled ellipse center");
  requirePositiveInteger(radiusX, "filled ellipse horizontal radius");
  requirePositiveInteger(radiusY, "filled ellipse vertical radius");
  for (let y = -radiusY; y <= radiusY; y += 1) {
    const ratio = y / radiusY;
    const halfWidth = Math.round(
      radiusX * Math.sqrt(Math.max(0, 1 - ratio * ratio)),
    );
    drawNativePixelRect(
      graphics,
      center.x - halfWidth,
      center.y + y,
      halfWidth * 2 + 1,
      1,
      colour,
    );
  }
}

function requirePoint(point: NativePixelPoint, name: string): void {
  requireInteger(point.x, `${name} x`);
  requireInteger(point.y, `${name} y`);
}

function requirePositiveInteger(value: number, name: string): void {
  requireInteger(value, name);
  if (value <= 0) throw new Error(`Native pixel ${name} must be positive.`);
}

function requireInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`Native pixel ${name} must be an integer.`);
  }
}
