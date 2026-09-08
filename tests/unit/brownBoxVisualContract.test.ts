import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync("src/main.ts", "utf8");
const indexSource = readFileSync("index.html", "utf8");
const appSource = readFileSync("src/app/QuantumBoxApp.ts", "utf8");
const brownBoxCss = readFileSync("src/display/brownBox.css", "utf8");
const displaySource = readFileSync("src/display/BrownBoxDisplay.ts", "utf8");
const viewportFieldSource = readFileSync(
  "src/display/BrownBoxViewportField.ts",
  "utf8",
);
const screenSceneSource = readFileSync("src/game/ScreenScene.ts", "utf8");
const shellSource = readFileSync("src/ui/QuantumBoxShell.ts", "utf8");
const skiPixlViewSource = readFileSync(
  "src/display/views/SkiPixlView.ts",
  "utf8",
);
const qongViewSource = readFileSync("src/display/views/QongView.ts", "utf8");
const fluxballViewSource = readFileSync(
  "src/display/views/FluxballView.ts",
  "utf8",
);
const quantmanViewSource = readFileSync(
  "src/display/views/QuantmanView.ts",
  "utf8",
);
const quarryViewSource = readFileSync("src/display/views/QuagView.ts", "utf8");
const tutorialViewSource = readFileSync(
  "src/display/views/TutorialWorldView.ts",
  "utf8",
);
const pixelTextSource = readFileSync("src/display/PixelText.ts", "utf8");
const pixelHudSource = readFileSync("src/display/PixelHud.ts", "utf8");

describe("Brown Box internal visual contract", () => {
  it("paints state one before the asynchronous title layers initialize", () => {
    const stateOnePath =
      "background-programs/current-four-state-v1/state-01.png";
    expect(indexSource).toContain(stateOnePath);
    expect(indexSource).toContain('rel="preload"');
    expect(indexSource).toContain("title-formica-device.png");
    expect(brownBoxCss).toContain(stateOnePath);
    expect(indexSource).not.toContain("#090a08");
    expect(brownBoxCss).toMatch(
      /\.qb-title\s*\{[^}]*background-image:\s*none;/s,
    );
  });

  it("imports the exact visual guard after every legacy stylesheet", () => {
    expect(
      mainSource.indexOf('import "./display/brownBox.css"'),
    ).toBeGreaterThan(mainSource.indexOf('import "./qongDesigner.css"'));
  });

  it("uses only the approved three literal colours in the final stylesheet", () => {
    const colours = new Set(
      [...brownBoxCss.matchAll(/#[0-9a-f]{6}\b/gi)].map(([value]) =>
        value.toLowerCase(),
      ),
    );
    expect([...colours].sort()).toEqual(["#2b1c14", "#564330", "#d6bd8b"]);
  });

  it("removes optical blending from every internal element without changing layout", () => {
    expect(brownBoxCss).toContain(".qb-internal *::after");
    expect(brownBoxCss).toContain("background-image: none !important");
    expect(brownBoxCss).toContain("box-shadow: none !important");
    expect(brownBoxCss).toContain("text-shadow: none !important");
    expect(brownBoxCss).toContain("filter: none !important");
    expect(brownBoxCss).toContain("opacity: 1 !important");
  });

  it("uses the approved field as the full internal substrate without opaque HUD masks", () => {
    expect(shellSource).toContain("new BrownBoxViewportField(");
    expect(shellSource).toContain("this.internal");
    expect(brownBoxCss).toContain(".qb-field-surface");
    expect(brownBoxCss).not.toContain("background-size: cover !important");
    expect(brownBoxCss).not.toContain("qb-internal-field-cycle");
    expect(screenSceneSource).not.toContain("createField()");
    expect(brownBoxCss).toContain("background-color: transparent !important");
    expect(pixelHudSource).not.toContain(
      ".fillStyle(BROWN_BOX_PALETTE.darkTobacco, 1)",
    );
    expect(quarryViewSource).not.toContain(
      ".fillStyle(BROWN_BOX_PALETTE.darkTobacco, 1)",
    );
    for (const source of [
      qongViewSource,
      skiPixlViewSource,
      fluxballViewSource,
      quantmanViewSource,
      tutorialViewSource,
    ]) {
      expect(source).not.toMatch(/fillRect\(0, 0, 640, 360\)/);
    }
  });

  it("boots Phaser transparently above the single viewport field", () => {
    expect(appSource).toContain("transparent: true");
    expect(appSource).not.toContain('backgroundColor: "#2b1c14"');
    expect(appSource).not.toContain('backgroundColor: "#171812"');
  });

  it("renders the 320 by 180 canvas with nearest-neighbour settings", () => {
    expect(appSource).toContain("width: LOGICAL_SCREEN.width");
    expect(appSource).toContain("height: LOGICAL_SCREEN.height");
    expect(appSource).toContain(
      "render: { antialias: false, pixelArt: true, roundPixels: true }",
    );
    expect(brownBoxCss).toContain("image-rendering: pixelated");
    expect(brownBoxCss).toContain("image-rendering: crisp-edges");
  });

  it("uses an opaque hard crop without an authored transition line", () => {
    expect(viewportFieldSource).toContain("this.context.clip()");
    expect(viewportFieldSource).toContain(
      "resolveBrownBoxViewportReplacementBoundary",
    );
    expect(viewportFieldSource).not.toMatch(
      /setAlpha|setBlendMode|lineStyle|gradient/i,
    );
    expect(displaySource).not.toContain("BrownBoxFieldCycle");
  });

  it("keeps the cream library boundary without decorative corner blocks", () => {
    expect(screenSceneSource).toContain(
      "g.lineStyle(1, PALETTE.cream, 1).strokeRect(13, 10, 614, 340)",
    );
    expect(screenSceneSource).not.toContain("fillRect(26, 24, 5, 5)");
    expect(screenSceneSource).not.toContain("fillRect(609, 24, 5, 5)");
    expect(screenSceneSource).not.toContain("fillRect(26, 333, 5, 5)");
    expect(screenSceneSource).not.toContain("fillRect(609, 333, 5, 5)");
  });

  it("keeps Designer dialogue out of antialiased Phaser text", () => {
    expect(screenSceneSource).not.toContain("GameObjects.Text");
    expect(screenSceneSource).not.toMatch(/this\.add\s*\.text\s*\(/);
    expect(shellSource).toContain('class="qb-story-dialogue"');
    expect(shellSource).toContain('class="qb-story-terminal"');
    expect(shellSource).toContain('data-story-beat="${escapeHtml(beat.id)}"');
    expect(shellSource).toContain("BitmapDomTextRenderer");
    expect(shellSource).toContain('data-ui="bitmap-text"');
  });

  it("routes menus, control bars, Designer dialogue and Fluxball reveals through the bitmap semantic layer", () => {
    for (const className of [
      "qb-screen-header",
      "qb-screen-footer",
      "qb-page",
      "qb-game-ui",
      "qb-story-dialogue",
      "qb-story-terminal",
      "qb-fluxball-reveal",
    ]) {
      expect(shellSource).toContain(className);
    }
    expect(brownBoxCss).toContain(".qb-bitmap-semantic");
    expect(brownBoxCss).toContain("-webkit-text-fill-color: transparent");
  });

  it("separates the five-cabinet Arcade index from each game's trial sheet", () => {
    expect(shellSource).toContain('data-action="open-arcade-cabinet"');
    expect(shellSource).toContain('class="qb-page-panel qb-arcade-detail');
    expect(shellSource).toContain("OBJECT");
    expect(shellSource).toContain("CONDITION");
    expect(shellSource).toContain("CONTROLS");
    expect(shellSource).toContain("SELECT TRIAL");
    expect(brownBoxCss).toContain(
      "grid-template-rows: repeat(5, minmax(0, 1fr))",
    );
    for (const label of [
      '"HUMAN / CPU": "PLAYER / CPU"',
      '"LOCAL TWO PLAYER": "PLAYER / PLAYER"',
      '"2 PLAYER / GLOBAL": "2P SHARED"',
      '"2 PLAYER / INDIVIDUAL": "2P SPLIT"',
    ]) {
      expect(shellSource).toContain(label);
    }
    expect(shellSource).not.toContain('"2 PLAYER / INDIVIDUAL": "2P LOCAL"');
    expect(shellSource).toContain('data-bitmap-text="SCORES"');
    expect(shellSource).not.toContain("data-quantman-topology");
    expect(brownBoxCss).not.toContain(".qb-quantman-course");
  });

  it("keeps Story sparse with compact bitmap lock states", () => {
    expect(shellSource).toContain(
      '<h1 class="qb-visually-hidden" tabindex="-1">STORY</h1>',
    );
    expect(shellSource).not.toContain(
      '<header><h1 tabindex="-1">STORY</h1></header>',
    );
    expect(brownBoxCss).toContain(
      "grid-template-columns: 13cqw 6cqw minmax(0, 1fr) 15cqw",
    );
    expect(brownBoxCss).toContain("width: 15cqw");
    expect(shellSource).toContain('data-bitmap-text="${statusText}"');
    expect(shellSource).not.toContain('class="qb-story-select-progress"');
    expect(shellSource).not.toContain('${current ? "OPEN" : "CLOSED"}');
    expect(brownBoxCss).toContain("text-align: right");
  });

  it("renders SkiPixl telemetry as framebuffer rectangles with hidden DOM mirrors", () => {
    expect(skiPixlViewSource).toContain("drawPixelText");
    expect(skiPixlViewSource).not.toContain("Phaser.GameObjects.Text");
    expect(pixelTextSource).toContain("graphics.fillRect(");
    expect(shellSource).toContain(
      'class="qb-skipixl-score qb-visually-hidden"',
    );
    expect(shellSource).toContain(
      'class="qb-skipixl-notice qb-visually-hidden"',
    );
  });

  it("renders the other cabinet telemetry as framebuffer rectangles with hidden DOM mirrors", () => {
    for (const source of [
      qongViewSource,
      fluxballViewSource,
      quantmanViewSource,
    ]) {
      expect(source).toContain("drawPixelText");
      expect(source).not.toContain("Phaser.GameObjects.Text");
    }
    for (const className of [
      "qb-qong-score qb-visually-hidden",
      "qb-qong-notice qb-visually-hidden",
      "qb-fluxball-hud qb-visually-hidden",
      "qb-fluxball-notice qb-visually-hidden",
      "qb-quantman-hud qb-visually-hidden",
      "qb-quantman-notice qb-visually-hidden",
    ]) {
      expect(shellSource).toContain(`class="${className}"`);
    }
  });
});
