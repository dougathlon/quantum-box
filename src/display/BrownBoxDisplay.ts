import Phaser from "phaser";
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

  public createNativePixelPlane(): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics().setDepth(0);
    graphics.setDataEnabled();
    graphics.setData("nativeResolution", "320x180");
    graphics.setData("integerPixelContract", true);
    return graphics;
  }
}
