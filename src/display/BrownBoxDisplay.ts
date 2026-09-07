import Phaser from "phaser";
import { LEGACY_CABINET_PLANE } from "./BrownBoxTheme";
import { CANONICAL_RUNTIME_ASSETS } from "../assets/CanonicalRuntimeAssets";
import { QGRAPH_CABINET_RUNTIME_ASSETS } from "../assets/QGraphCabinetAssets";

export class BrownBoxDisplay {
  public constructor(private readonly scene: Phaser.Scene) {}

  public preload(): void {
    for (const asset of CANONICAL_RUNTIME_ASSETS) {
      if (this.scene.textures.exists(asset.textureKey)) continue;
      this.scene.load.image(asset.textureKey, asset.url);
    }
    for (const asset of QGRAPH_CABINET_RUNTIME_ASSETS) {
      if (this.scene.textures.exists(asset.textureKey)) continue;
      this.scene.load.image(asset.textureKey, asset.url);
    }
  }

  public createLegacyCabinetPlane(): Phaser.GameObjects.Graphics {
    return this.scene.add
      .graphics()
      .setScale(LEGACY_CABINET_PLANE.scale)
      .setDepth(0);
  }
}
