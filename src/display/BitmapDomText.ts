import {
  drawCanvasPixelText,
  normalizePixelText,
  pixelTextWidth,
} from "./PixelText";

const LOGICAL_WIDTH = 320;
const LOGICAL_HEIGHT = 180;
const CREAM = "#D6BD8B";
const MUTED_TAN = "#564330";
const DARK_TOBACCO = "#2B1C14";

export const BITMAP_DOM_TEXT_CONTRACT = Object.freeze({
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
  palette: Object.freeze([DARK_TOBACCO, MUTED_TAN, CREAM]),
  binaryAlpha: Object.freeze([0, 255]),
  imageSmoothingEnabled: false,
});

interface LogicalRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface BitmapCanvasAudit {
  readonly unexpectedColours: readonly string[];
  readonly unexpectedAlphaValues: readonly number[];
  readonly opaquePixelCount: number;
}

export interface BitmapFocusCursorPlacement {
  readonly x: number;
  readonly side: "left" | "right";
}

export interface BitmapTextLayout {
  readonly pixel: 1 | 2;
  readonly spacing: 0 | 1 | 2;
}

/** Prefers larger glyphs, then tighter tracking, before allowing a label to wrap. */
export function bitmapTextLayout(
  source: string,
  maxWidth: number,
  maxHeight: number,
): BitmapTextLayout {
  const normalized = normalizePixelText(source);
  const candidates: readonly BitmapTextLayout[] =
    maxHeight >= 10
      ? [
          { pixel: 2, spacing: 2 },
          { pixel: 2, spacing: 1 },
          { pixel: 1, spacing: 1 },
          { pixel: 1, spacing: 0 },
        ]
      : [
          { pixel: 1, spacing: 1 },
          { pixel: 1, spacing: 0 },
        ];
  return (
    candidates.find(
      ({ pixel, spacing }) =>
        pixelTextWidth(normalized, pixel, spacing) <= maxWidth,
    ) ?? candidates[candidates.length - 1]!
  );
}

/** Keeps the controller-ready focus marker outside the focused control. */
export function bitmapFocusCursorPlacement(
  controlLeft: number,
  controlRight: number,
): BitmapFocusCursorPlacement | null {
  const left = Math.floor(controlLeft) - 3;
  if (left >= 0) return Object.freeze({ x: left, side: "left" });
  const right = Math.ceil(controlRight) + 1;
  if (right + 1 < LOGICAL_WIDTH) {
    return Object.freeze({ x: right, side: "right" });
  }
  return null;
}

/**
 * Draws the visible text of the semantic HTML layer into one native 320x180
 * bitmap plane. The HTML remains in normal layout and retains focus, pointer,
 * keyboard and accessibility semantics; CSS only makes its glyph paint
 * transparent. Gameplay HUD mirrors already marked visually hidden are never
 * copied into this plane.
 */
export class BitmapDomTextRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly mutationObserver: MutationObserver;
  private readonly resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private focusedControlDrawn: HTMLElement | null = null;
  private explicitTextOverflowCount = 0;

  public constructor(
    private readonly frame: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly semanticRoots: readonly HTMLElement[],
  ) {
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;
    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: false,
      willReadFrequently: true,
    });
    if (!context)
      throw new Error("Bitmap UI canvas 2D context is unavailable.");
    this.context = context;
    this.context.imageSmoothingEnabled = false;
    canvas.dataset["nativeResolution"] = `${LOGICAL_WIDTH}x${LOGICAL_HEIGHT}`;
    canvas.dataset["scaling"] = "integer-nearest-neighbour-only";

    for (const root of semanticRoots) root.classList.add("qb-bitmap-semantic");

    this.mutationObserver = new MutationObserver(this.requestRender);
    for (const root of semanticRoots) {
      this.mutationObserver.observe(root, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
    this.resizeObserver = new ResizeObserver(this.requestRender);
    this.resizeObserver.observe(frame);
    frame.addEventListener("focusin", this.requestRender);
    frame.addEventListener("focusout", this.requestRender);
    frame.addEventListener("pointerover", this.requestRender);
    frame.addEventListener("pointerout", this.requestRender);
    frame.addEventListener("input", this.requestRender);
    frame.addEventListener("change", this.requestRender);
    frame.addEventListener("scroll", this.requestRender, true);
    this.requestRender();
  }

  public destroy(): void {
    this.mutationObserver.disconnect();
    this.resizeObserver.disconnect();
    this.frame.removeEventListener("focusin", this.requestRender);
    this.frame.removeEventListener("focusout", this.requestRender);
    this.frame.removeEventListener("pointerover", this.requestRender);
    this.frame.removeEventListener("pointerout", this.requestRender);
    this.frame.removeEventListener("input", this.requestRender);
    this.frame.removeEventListener("change", this.requestRender);
    this.frame.removeEventListener("scroll", this.requestRender, true);
    window.cancelAnimationFrame(this.animationFrame);
  }

  public renderNow(): void {
    this.animationFrame = 0;
    const frameRect = this.frame.getBoundingClientRect();
    this.context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.focusedControlDrawn = null;
    this.explicitTextOverflowCount = 0;
    this.context.imageSmoothingEnabled = false;
    if (frameRect.width <= 0 || frameRect.height <= 0) return;

    for (const root of this.semanticRoots) {
      if (root.classList.contains("qb-bitmap-status-mirror")) {
        continue;
      }
      if (!isElementPainted(root, this.frame)) continue;
      this.drawTextNodes(root, frameRect);
      this.drawFormValues(root, frameRect);
    }
    this.publishAudit();
  }

  public readPixels(): ImageData {
    return this.context.getImageData(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  private publishAudit(): void {
    const audit = auditBitmapCanvasPixels(this.readPixels());
    this.canvas.dataset["paletteAudit"] =
      audit.unexpectedColours.length === 0 ? "pass" : "fail";
    this.canvas.dataset["alphaAudit"] =
      audit.unexpectedAlphaValues.length === 0 ? "pass" : "fail";
    this.canvas.dataset["opaquePixels"] = String(audit.opaquePixelCount);
    this.canvas.dataset["imageSmoothing"] = String(
      this.context.imageSmoothingEnabled,
    );
    this.canvas.dataset["explicitTextFitAudit"] =
      this.explicitTextOverflowCount === 0 ? "pass" : "fail";
  }

  private readonly requestRender = (): void => {
    if (this.animationFrame !== 0) return;
    this.animationFrame = window.requestAnimationFrame(() => this.renderNow());
  };

  private drawTextNodes(root: HTMLElement, frameRect: DOMRect): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (parent && isElementPainted(parent, this.frame)) {
        this.drawTextNode(node as Text, parent, frameRect);
      }
      node = walker.nextNode();
    }
  }

  private drawTextNode(
    node: Text,
    parent: HTMLElement,
    frameRect: DOMRect,
  ): void {
    const source =
      parent.dataset["bitmapText"] ?? node.data.replace(/\s+/g, " ").trim();
    if (source.length === 0) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const textRect = range.getBoundingClientRect();
    range.detach();
    const ownerRect = parent.getBoundingClientRect();
    const usesOwnBlock =
      parent.matches(
        "button, summary, label, p, q, dt, dd, li, span, strong, small, output",
      ) && directText(parent).length > 0;
    const logical = toLogicalRect(
      usesOwnBlock
        ? ownerRect
        : new DOMRect(
            textRect.left,
            textRect.top,
            Math.max(textRect.width, ownerRect.right - textRect.left),
            textRect.height,
          ),
      frameRect,
    );
    if (!this.isInsideVisibleClip(logical, parent, frameRect)) return;
    this.drawTextBlock(
      source,
      insetRect(logical, usesOwnBlock ? 1 : 0, 0),
      parent,
    );
  }

  private drawFormValues(root: HTMLElement, frameRect: DOMRect): void {
    for (const control of root.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >("input[type='number'], input[type='text'], select")) {
      if (!isElementPainted(control, this.frame)) continue;
      const value =
        control instanceof HTMLSelectElement
          ? (control.selectedOptions[0]?.textContent ?? control.value)
          : control.value;
      const logical = toLogicalRect(control.getBoundingClientRect(), frameRect);
      if (!this.isInsideVisibleClip(logical, control, frameRect)) continue;
      this.drawTextBlock(value, insetRect(logical, 2), control);
    }
  }

  private drawTextBlock(
    source: string,
    rect: LogicalRect,
    owner: HTMLElement,
  ): void {
    const normalized = normalizePixelText(source);
    if (normalized.length === 0 || rect.width < 2 || rect.height < 2) return;
    const roundedWidth = Math.max(1, Math.floor(rect.width));
    const { pixel, spacing } = bitmapTextLayout(
      normalized,
      roundedWidth,
      rect.height,
    );
    const maxLines = Math.max(1, Math.floor(rect.height / (pixel * 6)));
    const lines = wrapBitmapText(
      normalized,
      roundedWidth,
      pixel,
      spacing,
      maxLines,
    );
    if (
      owner.dataset["bitmapText"] !== undefined &&
      lines.join(" ") !== normalized
    ) {
      this.explicitTextOverflowCount += 1;
    }
    const lineHeight = pixel * 6;
    const totalHeight = lines.length * lineHeight - pixel;
    const top = Math.max(
      0,
      Math.min(
        LOGICAL_HEIGHT - totalHeight,
        Math.round(rect.top + (rect.height - totalHeight) / 2),
      ),
    );
    const style = getComputedStyle(owner);
    const align: "left" | "center" | "right" =
      style.textAlign === "center"
        ? "center"
        : style.textAlign === "right" || style.textAlign === "end"
          ? "right"
          : "left";
    const x =
      align === "center"
        ? Math.round(rect.left + rect.width / 2)
        : align === "right"
          ? Math.round(rect.right)
          : Math.round(rect.left);

    this.drawFocusCursor(owner);

    this.context.save();
    this.context.beginPath();
    this.context.rect(
      Math.floor(rect.left),
      Math.floor(rect.top),
      Math.ceil(rect.width),
      Math.ceil(rect.height),
    );
    this.context.clip();
    lines.forEach((line, index) => {
      drawCanvasPixelText(this.context, line, {
        x,
        y: top + index * lineHeight,
        pixel,
        colour: textColour(owner),
        spacing,
        align,
      });
    });
    this.context.restore();
  }

  private drawFocusCursor(owner: HTMLElement): void {
    const control = owner.closest<HTMLElement>(
      "button, summary, label, [role='button']",
    );
    if (
      !control ||
      control !== document.activeElement ||
      control === this.focusedControlDrawn
    ) {
      return;
    }
    this.focusedControlDrawn = control;
    const frameRect = this.frame.getBoundingClientRect();
    const controlRect = toLogicalRect(
      control.getBoundingClientRect(),
      frameRect,
    );
    const placement = bitmapFocusCursorPlacement(
      controlRect.left,
      controlRect.right,
    );
    if (!placement) return;
    const middle = Math.max(
      2,
      Math.round(controlRect.top + controlRect.height / 2),
    );
    this.context.fillStyle = CREAM;
    this.context.fillRect(placement.x, middle - 2, 1, 5);
    this.context.fillRect(placement.x + 1, middle - 1, 1, 3);
  }

  private isInsideVisibleClip(
    rect: LogicalRect,
    owner: HTMLElement,
    frameRect: DOMRect,
  ): boolean {
    if (
      rect.right <= 0 ||
      rect.left >= LOGICAL_WIDTH ||
      rect.bottom <= 0 ||
      rect.top >= LOGICAL_HEIGHT
    ) {
      return false;
    }
    let ancestor = owner.parentElement;
    while (ancestor && ancestor !== this.frame) {
      const style = getComputedStyle(ancestor);
      const clips =
        style.overflow === "auto" ||
        style.overflow === "hidden" ||
        style.overflowY === "auto" ||
        style.overflowY === "hidden";
      if (clips) {
        const clip = toLogicalRect(ancestor.getBoundingClientRect(), frameRect);
        if (!intersects(rect, clip)) return false;
      }
      ancestor = ancestor.parentElement;
    }
    return true;
  }
}

export function wrapBitmapText(
  source: string,
  maxWidth: number,
  pixel = 1,
  spacing = pixel,
  maxLines = Number.POSITIVE_INFINITY,
): readonly string[] {
  const words = normalizePixelText(source).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const push = (value: string): boolean => {
    if (lines.length >= maxLines) return false;
    lines.push(value);
    return true;
  };

  for (const word of words) {
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (pixelTextWidth(candidate, pixel, spacing) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line.length > 0 && !push(line)) break;
    line = "";
    if (pixelTextWidth(word, pixel, spacing) <= maxWidth) {
      line = word;
      continue;
    }
    let chunk = "";
    for (const character of word) {
      const next = `${chunk}${character}`;
      if (chunk.length > 0 && pixelTextWidth(next, pixel, spacing) > maxWidth) {
        if (!push(chunk)) break;
        chunk = character;
      } else {
        chunk = next;
      }
    }
    line = chunk;
  }
  if (line.length > 0 && lines.length < maxLines) lines.push(line);
  return Object.freeze(lines.slice(0, maxLines));
}

export function auditBitmapCanvasPixels(image: ImageData): BitmapCanvasAudit {
  const allowed = new Set([DARK_TOBACCO, MUTED_TAN, CREAM]);
  const unexpectedColours = new Set<string>();
  const unexpectedAlphaValues = new Set<number>();
  let opaquePixelCount = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index] ?? 0;
    const green = image.data[index + 1] ?? 0;
    const blue = image.data[index + 2] ?? 0;
    const alpha = image.data[index + 3] ?? 0;
    if (alpha !== 0 && alpha !== 255) unexpectedAlphaValues.add(alpha);
    if (alpha === 0) continue;
    opaquePixelCount += 1;
    const colour = `#${hex(red)}${hex(green)}${hex(blue)}`;
    if (!allowed.has(colour)) unexpectedColours.add(colour);
  }
  return Object.freeze({
    unexpectedColours: Object.freeze([...unexpectedColours].sort()),
    unexpectedAlphaValues: Object.freeze([...unexpectedAlphaValues].sort()),
    opaquePixelCount,
  });
}

function isElementPainted(
  element: HTMLElement,
  boundary: HTMLElement,
): boolean {
  const closedDetails = element.closest<HTMLDetailsElement>(
    "details:not([open])",
  );
  const containingSummary = element.closest<HTMLElement>("summary");
  if (
    closedDetails &&
    (!containingSummary || containingSummary.parentElement !== closedDetails)
  ) {
    return false;
  }
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.hidden ||
      current.classList.contains("qb-visually-hidden") ||
      current.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (current === boundary) break;
    current = current.parentElement;
  }
  return true;
}

function textColour(owner: HTMLElement): string {
  const disabled = owner.closest<HTMLElement>(
    ":disabled, [aria-disabled='true']",
  );
  if (disabled) return MUTED_TAN;
  const interactive = owner.closest<HTMLElement>(
    "button, summary, label, [role='button']",
  );
  if (interactive) {
    const background = getComputedStyle(interactive).backgroundColor;
    if (background === "rgb(214, 189, 139)") return DARK_TOBACCO;
  }
  return CREAM;
}

function directText(element: HTMLElement): string {
  return [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function toLogicalRect(rect: DOMRect, frame: DOMRect): LogicalRect {
  const scaleX = LOGICAL_WIDTH / frame.width;
  const scaleY = LOGICAL_HEIGHT / frame.height;
  const left = (rect.left - frame.left) * scaleX;
  const top = (rect.top - frame.top) * scaleY;
  const width = rect.width * scaleX;
  const height = rect.height * scaleY;
  return Object.freeze({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  });
}

function insetRect(
  rect: LogicalRect,
  horizontalInset: number,
  verticalInset = horizontalInset,
): LogicalRect {
  return Object.freeze({
    left: rect.left + horizontalInset,
    top: rect.top + verticalInset,
    right: rect.right - horizontalInset,
    bottom: rect.bottom - verticalInset,
    width: Math.max(0, rect.width - horizontalInset * 2),
    height: Math.max(0, rect.height - verticalInset * 2),
  });
}

function intersects(left: LogicalRect, right: LogicalRect): boolean {
  return (
    left.right > right.left &&
    left.left < right.right &&
    left.bottom > right.top &&
    left.top < right.bottom
  );
}

function hex(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}
