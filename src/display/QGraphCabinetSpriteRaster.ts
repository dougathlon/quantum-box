import Phaser from "phaser";
import { requireQGraphCabinetFrame } from "../assets/QGraphCabinetAssets";
import {
  drawPixelSprite,
  type PixelSprite,
  type PixelSpriteOptions,
} from "./PixelSprites";
import { canonicalSpritePlacement } from "./CanonicalSpriteRaster";

const FRAME_CACHE = new WeakMap<
  Phaser.Textures.TextureManager,
  Map<string, PixelSprite>
>();

export function drawQGraphCabinetSprite(
  graphics: Phaser.GameObjects.Graphics,
  fileId: string,
  frameId: string,
  options: PixelSpriteOptions,
): void {
  const { frame } = requireQGraphCabinetFrame(fileId, frameId);
  drawPixelSprite(
    graphics,
    qgraphCabinetSpriteFrame(graphics.scene.textures, fileId, frameId),
    canonicalSpritePlacement(
      frame.rect.width,
      frame.rect.height,
      frame.anchor.x,
      frame.anchor.y,
      options,
    ),
  );
}

export function qgraphCabinetSpriteFrame(
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
  const { asset, frame } = requireQGraphCabinetFrame(fileId, frameId);
  if (!textures.exists(asset.textureKey)) {
    throw new Error(
      `QGraph cabinet texture was not loaded: ${asset.textureKey}`,
    );
  }
  const rows = Array.from({ length: frame.rect.height }, (_, row) =>
    Array.from({ length: frame.rect.width }, (_, column) => {
      const colour = textures.getPixel(
        frame.rect.x + column,
        frame.rect.y + row,
        asset.textureKey,
      );
      if (!colour || colour.alpha === 0) return ".";
      if (colour.red === 214 && colour.green === 189 && colour.blue === 139)
        return "C";
      if (colour.red === 86 && colour.green === 67 && colour.blue === 48)
        return "T";
      if (colour.red === 43 && colour.green === 28 && colour.blue === 20)
        return "D";
      throw new Error(
        `QGraph cabinet texture contains an off-palette pixel: ${fileId}/${frameId} at ${column},${row}.`,
      );
    }).join(""),
  );
  const result = Object.freeze(rows);
  cache.set(cacheKey, result);
  return result;
}
