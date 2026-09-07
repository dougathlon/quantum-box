import Phaser from "phaser";
import { requireCanonicalFrame } from "../assets/CanonicalRuntimeAssets";
import {
  drawPixelSprite,
  type PixelSprite,
  type PixelSpriteOptions,
} from "./PixelSprites";

const FRAME_CACHE = new WeakMap<
  Phaser.Textures.TextureManager,
  Map<string, PixelSprite>
>();

/** One canonical asset pixel becomes one 320x180 framebuffer pixel. */
export const CANONICAL_SPRITE_PIXEL_SCALE = 2;

export function drawCanonicalSprite(
  graphics: Phaser.GameObjects.Graphics,
  fileId: string,
  frameId: string,
  options: PixelSpriteOptions,
): void {
  const { frame } = requireCanonicalFrame(fileId, frameId);
  drawPixelSprite(
    graphics,
    canonicalSpriteFrame(graphics.scene.textures, fileId, frameId),
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
    centerX: options.centerX + (width / 2 - anchorX) * options.pixel,
    bottomY: options.bottomY + (height - anchorY) * options.pixel,
  });
}

export function canonicalSpriteFrame(
  textures: Phaser.Textures.TextureManager,
  fileId: string,
  frameId: string,
): PixelSprite {
  let cache = FRAME_CACHE.get(textures);
  if (!cache) {
    cache = new Map();
    FRAME_CACHE.set(textures, cache);
  }
  const cacheKey = `${fileId}/${frameId}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const { asset, frame } = requireCanonicalFrame(fileId, frameId);
  if (!textures.exists(asset.textureKey)) {
    throw new Error(`Canonical texture was not loaded: ${asset.textureKey}`);
  }
  const rows = Array.from({ length: frame.rect.height }, (_, row) =>
    Array.from({ length: frame.rect.width }, (_, column) => {
      const colour = textures.getPixel(
        frame.rect.x + column,
        frame.rect.y + row,
        asset.textureKey,
      );
      if (!colour || colour.alpha === 0) return ".";
      if (colour.red === 214 && colour.green === 189 && colour.blue === 139) {
        return "C";
      }
      if (colour.red === 86 && colour.green === 67 && colour.blue === 48) {
        return "T";
      }
      if (colour.red === 43 && colour.green === 28 && colour.blue === 20) {
        return "D";
      }
      throw new Error(
        `Canonical texture contains an off-palette pixel: ${fileId}/${frameId} at ${column},${row}.`,
      );
    }).join(""),
  );
  const result = Object.freeze(rows);
  cache.set(cacheKey, result);
  return result;
}
