import Phaser from "phaser";
import type { QongOpponent, QongSnapshot } from "../games/qong/types";
import type {
  SkiPixlPackPayload,
  SkiPixlSnapshot,
} from "../games/skipixl/types";
import type { FluxballSnapshot } from "../games/fluxball/types";
import { BrownBoxDisplay } from "../display/BrownBoxDisplay";
import {
  BROWN_BOX_LOGICAL_SCREEN,
  BROWN_BOX_PALETTE,
} from "../display/BrownBoxTheme";
import { renderSkiPixl } from "../display/views/SkiPixlView";
import { renderQong } from "../display/views/QongView";
import { renderFluxball } from "../display/views/FluxballView";
import { renderQuantmanSynthetic } from "../display/views/QuantmanSyntheticView";
import type { QuantmanSyntheticRuntimeSnapshot } from "../games/quantmanSynthetic";
import type { QuagSnapshot } from "../games/quag/types";
import { drawQuagArena, renderQuag } from "../display/views/QuagView";
import { drawNativePixelLine } from "../display/NativePixelRaster";

export const SCREEN_SCENE_KEY = "quantum-box-screen";
export const LOGICAL_SCREEN = BROWN_BOX_LOGICAL_SCREEN;

const PALETTE = {
  cream: BROWN_BOX_PALETTE.cream,
} as const;

export class ScreenScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Graphics;
  private quagArena!: Phaser.GameObjects.Graphics;
  private activeSurface: "library" | "cabinet" | "quag" = "library";
  private readonly display = new BrownBoxDisplay(this);

  public constructor() {
    super({ key: SCREEN_SCENE_KEY });
  }

  public preload(): void {
    this.display.preload();
  }

  public create(): void {
    this.cameras.main.setRoundPixels(true);
    this.quagArena = this.display.createNativePixelPlane().setDepth(0);
    this.background = this.display.createNativePixelPlane().setDepth(1);
    this.drawLibraryField();
    this.game.canvas.setAttribute("aria-hidden", "true");
  }

  public showLibrary(): void {
    this.leaveQuag();
    this.activeSurface = "library";
    this.drawLibraryField();
  }

  public showQong(
    snapshot: QongSnapshot,
    opponent: QongOpponent,
    paused: boolean,
  ): void {
    this.leaveQuag();
    renderQong(this.background, snapshot, opponent, paused);
  }

  public showQongStoryCourt(
    snapshot: QongSnapshot,
    opponent: QongOpponent,
  ): void {
    this.leaveQuag();
    renderQong(this.background, snapshot, opponent, false, {
      hidePaddles: true,
    });
  }

  public showSkiPixl(
    snapshot: SkiPixlSnapshot,
    payload: SkiPixlPackPayload,
    paused: boolean,
  ): void {
    this.leaveQuag();
    renderSkiPixl(this.background, snapshot, payload, paused);
  }

  public showSkiPixlStorySlope(
    snapshot: SkiPixlSnapshot,
    payload: SkiPixlPackPayload,
  ): void {
    this.leaveQuag();
    renderSkiPixl(this.background, snapshot, payload, false, {
      hideCompletionPrompt: true,
    });
  }

  public showFluxball(snapshot: FluxballSnapshot, paused: boolean): void {
    this.leaveQuag();
    renderFluxball(this.background, snapshot, paused);
  }

  public showQuantmanSynthetic(
    snapshot: QuantmanSyntheticRuntimeSnapshot,
    paused: boolean,
  ): void {
    this.leaveQuag();
    renderQuantmanSynthetic(this.background, snapshot, paused);
  }

  public showQuag(
    snapshot: QuagSnapshot,
    paused: boolean,
    interpolationAlpha = 1,
  ): void {
    if (this.activeSurface !== "quag") {
      drawQuagArena(this.quagArena, snapshot.arenaId);
    }
    this.activeSurface = "quag";
    renderQuag(this.background, snapshot, paused, interpolationAlpha);
  }

  private leaveQuag(): void {
    if (this.activeSurface === "quag") this.quagArena.clear();
    this.activeSurface = "cabinet";
  }

  private drawLibraryField(): void {
    const g = this.background.clear();
    drawNativePixelLine(
      g,
      { x: 7, y: 5 },
      { x: 313, y: 5 },
      { colour: PALETTE.cream },
    );
    drawNativePixelLine(
      g,
      { x: 7, y: 5 },
      { x: 7, y: 175 },
      { colour: PALETTE.cream },
    );
    drawNativePixelLine(
      g,
      { x: 313, y: 5 },
      { x: 313, y: 175 },
      { colour: PALETTE.cream },
    );
    drawNativePixelLine(
      g,
      { x: 7, y: 175 },
      { x: 313, y: 175 },
      { colour: PALETTE.cream },
    );
  }
}
