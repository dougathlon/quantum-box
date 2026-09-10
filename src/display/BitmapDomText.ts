import { terminalGlyphRects, terminalTextWidth } from "./TerminalTypeface";
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
  rasterWidth: LOGICAL_WIDTH * 2,
  rasterHeight: LOGICAL_HEIGHT * 2,
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

export interface IntegerLogicalRect extends LogicalRect {
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
  readonly spacing: 1 | 2;
}

/** Reflowing copy reserves rows using the same glyph measure as its raster. */
export function bitmapFlowTextHeight(source: string, maxWidth: number): number {
  return (
    wrapBitmapText(normalizePixelText(source), maxWidth, 1, 1, Infinity, true)
      .length * 10
  );
}

/** Prefers larger glyphs without ever collapsing adjacent letter cells together. */
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
        ]
      : [{ pixel: 1, spacing: 1 }];
  return (
    candidates.find(({ pixel, spacing }) => {
      const wrapped = wrapBitmapText(normalized, maxWidth, pixel, spacing);
      const requiredHeight = wrapped.length * pixel * 6 - pixel;
      return requiredHeight <= maxHeight;
    }) ?? candidates[candidates.length - 1]!
  );
}

export function bitmapTextLineLeft(
  rectLeft: number,
  rectRight: number,
  lineWidth: number,
  align: "left" | "center" | "right",
): number {
  const safeLeft = Math.max(0, Math.ceil(rectLeft));
  const safeRight = Math.min(LOGICAL_WIDTH, Math.floor(rectRight));
  const available = Math.max(0, safeRight - safeLeft);
  if (lineWidth >= available) return safeLeft;
  if (align === "right") return safeRight - lineWidth;
  if (align === "center") {
    return safeLeft + Math.floor((available - lineWidth) / 2);
  }
  return safeLeft;
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

/** Quantizes a DOM projection once, at the final 320x180 presentation edge. */
export function integerLogicalRect(rect: LogicalRect): IntegerLogicalRect {
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.right) ||
    !Number.isFinite(rect.bottom)
  ) {
    throw new Error("Bitmap UI geometry must be finite.");
  }
  const left = Math.round(rect.left);
  const top = Math.round(rect.top);
  const right = Math.round(rect.right);
  const bottom = Math.round(rect.bottom);
  return Object.freeze({
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  });
}

/**
 * Draws the visible text of the semantic HTML layer into one 640x360
 * bitmap plane using 320x180 logical layout. The HTML remains in normal layout and retains focus, pointer,
 * keyboard and accessibility semantics, but is wholly transparent. Gameplay
 * HUD mirrors already marked visually hidden are never copied into this plane.
 */
export class BitmapDomTextRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly mutationObserver: MutationObserver;
  private readonly resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private focusedControlDrawn: HTMLElement | null = null;
  private explicitTextOverflowCount = 0;
  private fractionalPlacementCorrections = 0;
  private unrepresentablePlacementCount = 0;
  private visibleDomPaintViolationCount = 0;

  public constructor(
    private readonly frame: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly semanticRoots: readonly HTMLElement[],
  ) {
    canvas.width = LOGICAL_WIDTH * 2;
    canvas.height = LOGICAL_HEIGHT * 2;
    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: false,
      willReadFrequently: true,
    });
    if (!context)
      throw new Error("Bitmap UI canvas 2D context is unavailable.");
    this.context = context;
    context.scale(2, 2);
    this.context.imageSmoothingEnabled = false;
    canvas.dataset["nativeResolution"] =
      `${LOGICAL_WIDTH * 2}x${LOGICAL_HEIGHT * 2}`;
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
    this.layoutFlowText(frameRect);
    this.context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.focusedControlDrawn = null;
    this.explicitTextOverflowCount = 0;
    this.fractionalPlacementCorrections = 0;
    this.unrepresentablePlacementCount = 0;
    this.visibleDomPaintViolationCount = 0;
    this.context.imageSmoothingEnabled = false;
    if (frameRect.width <= 0 || frameRect.height <= 0) return;

    for (const root of this.semanticRoots) {
      if (root.classList.contains("qb-bitmap-status-mirror")) {
        continue;
      }
      if (!isElementPainted(root, this.frame)) continue;
      this.drawElementGeometry(root, frameRect);
      this.drawKnownRasterGeometry(root, frameRect);
      this.drawImages(root, frameRect);
      this.drawFormControls(root, frameRect);
      this.drawTextNodes(root, frameRect);
      this.drawFormValues(root, frameRect);
    }
    this.publishAudit();
    if (this.hasVisibleAnimation()) this.requestRender();
  }

  private layoutFlowText(frameRect: DOMRect): void {
    if (frameRect.width <= 0) return;
    for (const root of this.semanticRoots) {
      for (const owner of root.querySelectorAll<HTMLElement>(
        "[data-bitmap-flow]",
      )) {
        if (!isElementLayoutVisible(owner, this.frame)) continue;
        const rect = insetRect(
          toLogicalRect(owner.getBoundingClientRect(), frameRect),
          1,
          0,
        );
        const width = Math.floor(rect.right) - Math.ceil(rect.left);
        if (width < 1) continue;
        const height = bitmapFlowTextHeight(
          owner.dataset["bitmapText"] ?? owner.textContent ?? "",
          width,
        );
        const minHeight = `${Math.ceil((height * 100_000) / LOGICAL_HEIGHT) / 1000}cqh`;
        if (owner.style.minHeight !== minHeight)
          owner.style.minHeight = minHeight;
      }
    }
  }

  public readPixels(): ImageData {
    return this.context.getImageData(
      0,
      0,
      LOGICAL_WIDTH * 2,
      LOGICAL_HEIGHT * 2,
    );
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
    this.canvas.dataset["fractionalPlacementCorrections"] = String(
      this.fractionalPlacementCorrections,
    );
    this.canvas.dataset["fractionalPlacementViolations"] = String(
      this.unrepresentablePlacementCount,
    );
    this.canvas.dataset["fractionalPlacementAudit"] =
      this.unrepresentablePlacementCount === 0 ? "pass" : "fail";
    for (const root of this.semanticRoots) {
      if (getComputedStyle(root).opacity !== "0") {
        this.visibleDomPaintViolationCount += 1;
      }
    }
    this.canvas.dataset["visibleDomPaintViolations"] = String(
      this.visibleDomPaintViolationCount,
    );
    this.canvas.dataset["visibleDomPaintAudit"] =
      this.visibleDomPaintViolationCount === 0 ? "pass" : "fail";
  }

  private readonly requestRender = (): void => {
    if (this.animationFrame !== 0) return;
    this.animationFrame = window.requestAnimationFrame(() => this.renderNow());
  };

  private hasVisibleAnimation(): boolean {
    // A visibility animation still needs frames during its hidden phase.
    // The browser also handles paused, finished and display:none animations.
    return this.semanticRoots.some((root) =>
      root
        .getAnimations({ subtree: true })
        .some((animation) => animation.playState === "running"),
    );
  }

  private drawElementGeometry(root: HTMLElement, frameRect: DOMRect): void {
    for (const element of semanticElements(root)) {
      if (!isElementLayoutVisible(element, this.frame)) continue;
      const logical = toLogicalRect(element.getBoundingClientRect(), frameRect);
      const rect = this.quantizeRect(logical);
      if (!rect || rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(element);
      const background = this.paletteColour(style.backgroundColor);
      if (background) {
        this.withElementClip(element, frameRect, () => {
          this.context.fillStyle = background;
          this.context.fillRect(rect.left, rect.top, rect.width, rect.height);
        });
      }
      this.drawElementBorders(element, rect, style, frameRect);
    }
  }

  private drawElementBorders(
    element: HTMLElement,
    rect: IntegerLogicalRect,
    style: CSSStyleDeclaration,
    frameRect: DOMRect,
  ): void {
    const sides = [
      ["top", style.borderTopWidth, style.borderTopStyle, style.borderTopColor],
      [
        "right",
        style.borderRightWidth,
        style.borderRightStyle,
        style.borderRightColor,
      ],
      [
        "bottom",
        style.borderBottomWidth,
        style.borderBottomStyle,
        style.borderBottomColor,
      ],
      [
        "left",
        style.borderLeftWidth,
        style.borderLeftStyle,
        style.borderLeftColor,
      ],
    ] as const;
    this.withElementClip(element, frameRect, () => {
      for (const [side, width, borderStyle, colourValue] of sides) {
        if (borderStyle === "none" || Number.parseFloat(width) <= 0) continue;
        const colour = this.paletteColour(colourValue);
        if (!colour) continue;
        const thickness = nativeBorderThickness(element);
        this.context.fillStyle = colour;
        drawCanvasBorderSide(this.context, rect, side, thickness, borderStyle);
      }
    });
  }

  private drawImages(root: HTMLElement, frameRect: DOMRect): void {
    for (const image of root.querySelectorAll<HTMLImageElement>("img")) {
      if (!isElementLayoutVisible(image, this.frame)) continue;
      if (!image.complete || image.naturalWidth === 0) {
        if (image.dataset["bitmapLoadBound"] !== "true") {
          image.dataset["bitmapLoadBound"] = "true";
          image.addEventListener("load", this.requestRender, { once: true });
        }
        continue;
      }
      const logical = toLogicalRect(image.getBoundingClientRect(), frameRect);
      const rect = this.quantizeRect(logical);
      if (!rect || rect.width === 0 || rect.height === 0) continue;
      this.withElementClip(image, frameRect, () => {
        this.context.imageSmoothingEnabled = false;
        this.context.drawImage(
          image,
          0,
          0,
          image.naturalWidth,
          image.naturalHeight,
          rect.left,
          rect.top,
          rect.width,
          rect.height,
        );
      });
    }
  }

  private drawFormControls(root: HTMLElement, frameRect: DOMRect): void {
    for (const control of root.querySelectorAll<HTMLInputElement>("input")) {
      if (!isElementPainted(control, this.frame)) continue;
      const rect = this.quantizeRect(
        toLogicalRect(control.getBoundingClientRect(), frameRect),
      );
      if (!rect || rect.width === 0 || rect.height === 0) continue;
      this.withElementClip(control, frameRect, () => {
        if (control.type === "range") {
          const y = rect.top + Math.floor(rect.height / 2);
          this.context.fillStyle = MUTED_TAN;
          this.context.fillRect(rect.left, y, rect.width, 1);
          const minimum = Number(control.min || 0);
          const maximum = Number(control.max || 100);
          const value = Number(control.value);
          const ratio =
            maximum === minimum
              ? 0
              : Math.max(
                  0,
                  Math.min(1, (value - minimum) / (maximum - minimum)),
                );
          const x = Math.round(rect.left + ratio * Math.max(0, rect.width - 3));
          this.context.fillStyle = CREAM;
          this.context.fillRect(x, y - 2, 3, 5);
        } else if (control.type === "checkbox" || control.type === "radio") {
          const size = Math.max(3, Math.min(5, rect.width, rect.height));
          const x = rect.left + Math.floor((rect.width - size) / 2);
          const y = rect.top + Math.floor((rect.height - size) / 2);
          this.context.fillStyle = CREAM;
          drawCanvasFrame(this.context, x, y, size, size);
          if (control.checked) {
            this.context.fillRect(
              x + 1,
              y + 1,
              Math.max(1, size - 2),
              Math.max(1, size - 2),
            );
          }
        }
      });
    }
    for (const select of root.querySelectorAll<HTMLSelectElement>("select")) {
      if (!isElementPainted(select, this.frame)) continue;
      const rect = this.quantizeRect(
        toLogicalRect(select.getBoundingClientRect(), frameRect),
      );
      if (!rect || rect.width < 4 || rect.height < 4) continue;
      this.context.fillStyle = CREAM;
      const x = rect.right - 3;
      const y = rect.top + Math.floor(rect.height / 2) - 1;
      this.context.fillRect(x, y, 1, 1);
      this.context.fillRect(x - 1, y + 1, 3, 1);
    }
  }

  private drawKnownRasterGeometry(root: HTMLElement, frameRect: DOMRect): void {
    for (const floor of root.querySelectorAll<HTMLElement>(
      ".qb-story-walk-floor",
    )) {
      if (!isElementLayoutVisible(floor, this.frame)) continue;
      const rect = this.quantizeRect(
        toLogicalRect(floor.getBoundingClientRect(), frameRect),
      );
      if (!rect) continue;
      this.context.fillStyle = MUTED_TAN;
      for (let column = 1; column < 18; column += 1) {
        const x = Math.round(rect.left + (rect.width * column) / 18);
        this.context.fillRect(x, rect.top, 1, rect.height);
      }
      for (let row = 1; row < 8; row += 1) {
        const y = Math.round(rect.top + (rect.height * row) / 8);
        this.context.fillRect(rect.left, y, rect.width, 1);
      }
    }

    for (const scene of root.querySelectorAll<HTMLElement>(".qb-story-scene")) {
      if (!isElementLayoutVisible(scene, this.frame)) continue;
      const rect = this.quantizeRect(
        toLogicalRect(scene.getBoundingClientRect(), frameRect),
      );
      if (!rect) continue;
      if (scene.classList.contains("qb-story-scene--field")) {
        drawCanvasPatternLine(
          this.context,
          Math.round(rect.left + rect.width / 2),
          rect.top,
          Math.round(rect.left + rect.width / 2),
          rect.bottom - 1,
          MUTED_TAN,
          2,
          2,
        );
      } else if (!scene.closest("[data-story-scene='slope']")) {
        const offset =
          scene.classList.contains("qb-story-scene--den") ||
          scene.classList.contains("qb-story-scene--office")
            ? 13
            : 14;
        this.context.fillStyle = scene.classList.contains(
          "qb-story-scene--arena",
        )
          ? CREAM
          : MUTED_TAN;
        this.context.fillRect(rect.left, rect.bottom - offset, rect.width, 1);
      }
    }

    for (const cabin of root.querySelectorAll<HTMLElement>(
      ".qb-story-prop--cabin",
    )) {
      if (!isElementLayoutVisible(cabin, this.frame)) continue;
      const rect = this.quantizeRect(
        toLogicalRect(cabin.getBoundingClientRect(), frameRect),
      );
      if (!rect) continue;
      const roofHeight = 16;
      for (let row = 0; row < roofHeight; row += 1) {
        const half = Math.round(((row + 1) / roofHeight) * (rect.width / 2));
        const y = rect.top - roofHeight + row;
        this.context.fillStyle =
          row === 0 || row === roofHeight - 1 ? CREAM : MUTED_TAN;
        this.context.fillRect(
          Math.round(rect.left + rect.width / 2 - half),
          y,
          Math.max(1, half * 2),
          1,
        );
      }
    }
  }

  private paletteColour(value: string): string | null {
    const normalized = cssColourToHex(value);
    if (!normalized) return null;
    if (!BITMAP_DOM_TEXT_CONTRACT.palette.includes(normalized)) {
      this.visibleDomPaintViolationCount += 1;
      return null;
    }
    return normalized;
  }

  private quantizeRect(logical: LogicalRect): IntegerLogicalRect | null {
    let rect: IntegerLogicalRect;
    try {
      rect = integerLogicalRect(logical);
    } catch {
      this.unrepresentablePlacementCount += 1;
      return null;
    }
    if (
      Math.abs(rect.left - logical.left) > 0.001 ||
      Math.abs(rect.top - logical.top) > 0.001 ||
      Math.abs(rect.right - logical.right) > 0.001 ||
      Math.abs(rect.bottom - logical.bottom) > 0.001
    ) {
      this.fractionalPlacementCorrections += 1;
    }
    if (
      (logical.width > 0 && rect.width === 0) ||
      (logical.height > 0 && rect.height === 0)
    ) {
      this.unrepresentablePlacementCount += 1;
      return null;
    }
    return rect;
  }

  private withElementClip(
    owner: HTMLElement,
    frameRect: DOMRect,
    draw: () => void,
  ): void {
    const clip = visibleClipRect(owner, this.frame, frameRect);
    if (!clip || clip.width === 0 || clip.height === 0) return;
    this.context.save();
    this.context.beginPath();
    this.context.rect(clip.left, clip.top, clip.width, clip.height);
    this.context.clip();
    draw();
    this.context.restore();
  }

  private drawTextNodes(root: HTMLElement, frameRect: DOMRect): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const lineBreakBlocks = new Set<HTMLElement>();
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (parent && isElementPainted(parent, this.frame)) {
        if (hasDirectLineBreak(parent)) {
          if (!lineBreakBlocks.has(parent)) {
            lineBreakBlocks.add(parent);
            this.drawTextElement(
              parent.dataset["bitmapText"] ?? directTextWithLineBreaks(parent),
              parent,
              frameRect,
            );
          }
        } else {
          this.drawTextNode(node as Text, parent, frameRect);
        }
      }
      node = walker.nextNode();
    }
  }

  private drawTextElement(
    source: string,
    owner: HTMLElement,
    frameRect: DOMRect,
  ): void {
    if (source.length === 0) return;
    const logical = toLogicalRect(owner.getBoundingClientRect(), frameRect);
    if (!this.isInsideVisibleClip(logical, owner, frameRect)) return;
    this.drawTextBlock(source, insetRect(logical, 1, 0), owner);
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
        "button, summary, label, p, q, dt, dd, li, span, strong, b, legend, h1, h2, h3, small, output",
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
    const clipLeft = Math.max(0, Math.ceil(rect.left));
    const clipRight = Math.min(LOGICAL_WIDTH, Math.floor(rect.right));
    const roundedWidth = Math.max(1, clipRight - clipLeft);
    const { pixel, spacing } = owner.closest(
      ".qb-terminal-page, .qb-terminal-footer, .qb-screen-footer, [data-bitmap-flow]",
    )
      ? { pixel: 1, spacing: 1 }
      : bitmapTextLayout(normalized, roundedWidth, rect.height);
    const flow = owner.matches("[data-bitmap-flow]");
    const reading =
      flow ||
      (rect.height >= 10 &&
        !normalized.includes("\n") &&
        terminalTextWidth(normalized) <= roundedWidth &&
        !owner.closest(
          ".qb-cabinet-ui, .qb-terminal-page header, .qb-terminal-footer, .qb-screen-footer",
        ));
    const lineHeight = reading ? 10 : pixel * 6;
    const capHeight = reading ? 7 : pixel * 5;
    const maxLines = Math.max(
      1,
      Math.floor((rect.height + lineHeight - capHeight) / lineHeight),
    );
    const lines = wrapBitmapText(
      normalized,
      roundedWidth,
      reading ? 1 : pixel,
      reading ? 1 : spacing,
      maxLines,
      reading,
    );
    if (
      owner.dataset["bitmapText"] !== undefined &&
      lines.join(" ").replace(/\s+/g, " ").trim() !==
        normalized.replace(/\s+/g, " ").trim()
    ) {
      this.explicitTextOverflowCount += 1;
    }
    const totalHeight = (lines.length - 1) * lineHeight + capHeight;
    const top = Math.max(
      0,
      Math.min(
        LOGICAL_HEIGHT - totalHeight,
        Math.round(
          flow ? rect.top : rect.top + (rect.height - totalHeight) / 2,
        ),
      ),
    );
    const style = getComputedStyle(owner);
    const align: "left" | "center" | "right" =
      style.textAlign === "center"
        ? "center"
        : style.textAlign === "right" || style.textAlign === "end"
          ? "right"
          : "left";
    this.drawFocusCursor(owner);

    this.context.save();
    this.context.beginPath();
    const ancestorClip = visibleClipRect(
      owner,
      this.frame,
      this.frame.getBoundingClientRect(),
    );
    const clipTop = Math.max(Math.floor(rect.top), ancestorClip?.top ?? 0);
    const clipBottom = Math.min(
      Math.ceil(rect.bottom),
      ancestorClip?.bottom ?? LOGICAL_HEIGHT,
    );
    const textClipLeft = Math.max(clipLeft, ancestorClip?.left ?? 0);
    const textClipRight = Math.min(
      clipRight,
      ancestorClip?.right ?? LOGICAL_WIDTH,
    );
    this.context.rect(
      textClipLeft,
      clipTop,
      Math.max(0, textClipRight - textClipLeft),
      Math.max(0, clipBottom - clipTop),
    );
    this.context.clip();
    lines.forEach((line, index) => {
      const lineWidth = reading
        ? terminalTextWidth(line)
        : pixelTextWidth(line, pixel, spacing);
      const x = bitmapTextLineLeft(rect.left, rect.right, lineWidth, align);
      if (reading) {
        this.context.fillStyle = textColour(owner);
        for (const r of terminalGlyphRects(line, x, top + index * lineHeight))
          this.context.fillRect(r.x, r.y, r.width, r.height);
        return;
      }
      drawCanvasPixelText(this.context, line, {
        x,
        y: top + index * lineHeight,
        pixel,
        colour: textColour(owner),
        spacing,
        align: "left",
      });
    });
    this.context.restore();
  }

  private drawFocusCursor(owner: HTMLElement): void {
    if (owner.closest(".qb-terminal-actions")) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const activeControl =
      active.closest<HTMLElement>("label") ??
      active.closest<HTMLElement>(
        "button, summary, input, select, [role='button']",
      );
    const ownerControl = owner.closest<HTMLElement>(
      "button, summary, label, input, select, [role='button']",
    );
    if (
      !activeControl ||
      !ownerControl ||
      (ownerControl !== activeControl && !ownerControl.contains(active)) ||
      activeControl === this.focusedControlDrawn
    ) {
      return;
    }
    const control = activeControl;
    this.focusedControlDrawn = activeControl;
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
  reading = false,
): readonly string[] {
  const authoredLines = normalizePixelText(source).split(/\r?\n/);
  const lines: string[] = [];
  const push = (value: string): boolean => {
    if (lines.length >= maxLines) return false;
    lines.push(value);
    return true;
  };

  for (const authoredLine of authoredLines) {
    const words = authoredLine.split(" ").filter(Boolean);
    let line = "";
    if (words.length === 0) {
      if (!push("")) break;
      continue;
    }
    for (const word of words) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (
        (reading ? terminalTextWidth : pixelTextWidth)(
          candidate,
          pixel,
          spacing,
        ) <= maxWidth
      ) {
        line = candidate;
        continue;
      }
      if (line.length > 0 && !push(line)) break;
      line = "";
      if (
        (reading ? terminalTextWidth : pixelTextWidth)(word, pixel, spacing) <=
        maxWidth
      ) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const character of word) {
        const next = `${chunk}${character}`;
        if (
          chunk.length > 0 &&
          (reading ? terminalTextWidth : pixelTextWidth)(next, pixel, spacing) >
            maxWidth
        ) {
          if (!push(chunk)) break;
          chunk = character;
        } else {
          chunk = next;
        }
      }
      line = chunk;
    }
    if (line.length > 0 && !push(line)) break;
    if (lines.length >= maxLines) break;
  }
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
    if (current.hidden || current.classList.contains("qb-visually-hidden")) {
      return false;
    }
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (current === boundary) break;
    current = current.parentElement;
  }
  return true;
}

function isElementLayoutVisible(
  element: HTMLElement,
  boundary: HTMLElement,
): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.hidden || current.classList.contains("qb-visually-hidden")) {
      return false;
    }
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (current === boundary) break;
    current = current.parentElement;
  }
  return true;
}

function semanticElements(root: HTMLElement): readonly HTMLElement[] {
  return Object.freeze([root, ...root.querySelectorAll<HTMLElement>("*")]);
}

function cssColourToHex(value: string): string | null {
  if (value === "transparent") return null;
  const match = value.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/,
  );
  if (!match) return null;
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (alpha === 0) return null;
  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}

function nativeBorderThickness(element: HTMLElement): 1 | 2 {
  if (
    element.matches(
      ".qb-story-terminal, .qb-story-dialogue, .qb-story-prop--cabin, .qb-story-walk-floor, .qb-story-walk-fixture--machine",
    )
  ) {
    return 2;
  }
  return 1;
}

function drawCanvasFrame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: 1 | 2 = 1,
): void {
  context.fillRect(x, y, width, thickness);
  context.fillRect(x, y + height - thickness, width, thickness);
  context.fillRect(x, y, thickness, height);
  context.fillRect(x + width - thickness, y, thickness, height);
}

function drawCanvasBorderSide(
  context: CanvasRenderingContext2D,
  rect: IntegerLogicalRect,
  side: "top" | "right" | "bottom" | "left",
  thickness: 1 | 2,
  style: string,
): void {
  const horizontal = side === "top" || side === "bottom";
  const x = side === "right" ? rect.right - thickness : rect.left;
  const y = side === "bottom" ? rect.bottom - thickness : rect.top;
  const width = horizontal ? rect.width : thickness;
  const height = horizontal ? thickness : rect.height;
  if (style !== "dashed" && style !== "dotted") {
    context.fillRect(x, y, width, height);
    return;
  }
  const on = style === "dotted" ? 1 : 3;
  const off = style === "dotted" ? 1 : 2;
  const length = horizontal ? width : height;
  for (let step = 0; step < length; step += on + off) {
    const segment = Math.min(on, length - step);
    context.fillRect(
      horizontal ? x + step : x,
      horizontal ? y : y + step,
      horizontal ? segment : thickness,
      horizontal ? thickness : segment,
    );
  }
}

function drawCanvasPatternLine(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  colour: string,
  on: number,
  off: number,
): void {
  let x = startX;
  let y = startY;
  const dx = Math.abs(endX - startX);
  const sx = startX < endX ? 1 : -1;
  const dy = -Math.abs(endY - startY);
  const sy = startY < endY ? 1 : -1;
  let error = dx + dy;
  let step = 0;
  context.fillStyle = colour;
  while (true) {
    if (step % (on + off) < on) context.fillRect(x, y, 1, 1);
    if (x === endX && y === endY) break;
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

function visibleClipRect(
  owner: HTMLElement,
  boundary: HTMLElement,
  frameRect: DOMRect,
): IntegerLogicalRect | null {
  let clip: LogicalRect = Object.freeze({
    left: 0,
    top: 0,
    right: LOGICAL_WIDTH,
    bottom: LOGICAL_HEIGHT,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
  });
  let ancestor = owner.parentElement;
  while (ancestor && ancestor !== boundary) {
    const style = getComputedStyle(ancestor);
    const clips =
      style.overflow === "auto" ||
      style.overflow === "hidden" ||
      style.overflowX === "auto" ||
      style.overflowX === "hidden" ||
      style.overflowY === "auto" ||
      style.overflowY === "hidden";
    if (clips) {
      const ancestorRect = toLogicalRect(
        ancestor.getBoundingClientRect(),
        frameRect,
      );
      const left = Math.max(clip.left, ancestorRect.left);
      const top = Math.max(clip.top, ancestorRect.top);
      const right = Math.min(clip.right, ancestorRect.right);
      const bottom = Math.min(clip.bottom, ancestorRect.bottom);
      if (right <= left || bottom <= top) return null;
      clip = Object.freeze({
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
      });
    }
    ancestor = ancestor.parentElement;
  }
  return integerLogicalRect(clip);
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

function hasDirectLineBreak(element: HTMLElement): boolean {
  return [...element.children].some((child) => child.tagName === "BR");
}

function directTextWithLineBreaks(element: HTMLElement): string {
  return [...element.childNodes]
    .map((node) => (node.nodeName === "BR" ? "\n" : (node.textContent ?? "")))
    .join("")
    .replace(/[\t ]+/g, " ")
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
