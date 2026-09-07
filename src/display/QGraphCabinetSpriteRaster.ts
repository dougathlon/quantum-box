import Phaser from "phaser";
import { requireQGraphCabinetFrame } from "../assets/QGraphCabinetAssets";
import { requireRuntimePixelFrame } from "../assets/RuntimePixelFrames";
import {
  drawPixelSprite,
  type PixelSprite,
  type PixelSpriteOptions,
} from "./PixelSprites";
import { canonicalSpritePlacement } from "./CanonicalSpriteRaster";

export function drawQGraphCabinetSprite(
  graphics: Phaser.GameObjects.Graphics,
  fileId: string,
  frameId: string,
  options: PixelSpriteOptions,
): void {
  const { frame } = requireQGraphCabinetFrame(fileId, frameId);
  drawPixelSprite(
    graphics,
    qgraphCabinetSpriteFrame(fileId, frameId),
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
  fileId: string,
  frameId: string,
): PixelSprite {
  return requireRuntimePixelFrame("qgraph-cabinet-v1", fileId, frameId).rows;
}
