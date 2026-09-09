import Phaser from "phaser";
import { requireCanonicalFrame } from "../assets/CanonicalRuntimeAssets";
import { requireRuntimePixelFrame } from "../assets/RuntimePixelFrames";
import {
  drawPixelSprite,
  type PixelSprite,
  type PixelSpriteOptions,
} from "./PixelSprites";

/** One canonical asset pixel is one native 320x180 framebuffer pixel. */
export const CANONICAL_SPRITE_PIXEL_SCALE = 1;

export function drawCanonicalSprite(
  graphics: Phaser.GameObjects.Graphics,
  fileId: string,
  frameId: string,
  options: PixelSpriteOptions,
): void {
  const { frame } = requireCanonicalFrame(fileId, frameId);
  drawPixelSprite(
    graphics,
    canonicalSpriteFrame(fileId, frameId),
    canonicalSpritePlacement(
      frame.rect.width,
      frame.rect.height,
      frame.anchor.x,
      frame.anchor.y,
      options,
    ),
  );
}

export function canonicalSpritePlacement(
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
  options: PixelSpriteOptions,
): PixelSpriteOptions {
  return Object.freeze({
    ...options,
    centerX: Math.round(
      options.centerX + (width / 2 - anchorX) * options.pixel,
    ),
    bottomY: Math.round(options.bottomY + (height - anchorY) * options.pixel),
  });
}

export function canonicalSpriteFrame(
  fileId: string,
  frameId: string,
): PixelSprite {
  return requireRuntimePixelFrame("canonical-runtime-v2", fileId, frameId).rows;
}
