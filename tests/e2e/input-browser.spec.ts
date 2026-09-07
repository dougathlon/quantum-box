import { expect, test, type Page } from "@playwright/test";

import { captureExternalRequests } from "./support/spatialTutorial";

test("keyboard held action changes each cabinet and keyup applies cabinet release semantics", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "Cross-cabinet input semantics need one deterministic desktop execution.",
  );
  const externalRequests = captureExternalRequests(page, testInfo);
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /ARCADE/ }).click();

  for (const cabinet of [
    {
      gameId: "qong",
      launch: "PLAYER / CPU",
      region: "Qong game",
      movementKeys: ["w"],
      probe: {
        fileId: "qong-paddle",
        frameIds: ["paddle"],
        search: { left: 0, top: 20, right: 64, bottom: 150 },
      },
      release: "stop-position",
    },
    {
      gameId: "skipixl",
      launch: "EASY",
      region: "SkiPixl game",
      movementKeys: ["a"],
      probe: {
        fileId: "skipixl-steering-seven-angle-strip",
        frameIds: [
          "hard-left",
          "mid-left",
          "soft-left",
          "neutral",
          "soft-right",
          "mid-right",
          "hard-right",
        ],
        search: { left: 40, top: 30, right: 260, bottom: 68 },
      },
      release: "hold-steering-state",
    },
    {
      gameId: "fluxball",
      launch: "2P SHARED",
      region: "Fluxball game",
      movementKeys: ["w"],
      probe: {
        fileId: "fluxball-family-strip",
        frameIds: ["fluxball-player-a"],
        search: { left: 76, top: 62, right: 122, bottom: 104 },
      },
      release: "stop-position",
    },
    {
      gameId: "quantman",
      launch: "HOLD",
      region: "Quantman QPU-derived gaze maze",
      // A measured Labyrinth state may close any particular neighboring
      // passage. Try the four semantic directions and require one traversable
      // route rather than baking one capture's local wall into this browser
      // contract.
      movementKeys: ["d", "s", "a", "w"],
      probe: {
        fileId: "quantman-player-directional-strip",
        frameIds: ["right", "down", "left", "up"],
        search: { left: 134, top: 120, right: 188, bottom: 158 },
      },
      release: "continue-direction",
    },
  ] as const) {
    await page
      .locator(`section[aria-labelledby='arcade-${cabinet.gameId}']`)
      .getByRole("button", { name: cabinet.launch, exact: true })
      .click();
    if (cabinet.gameId === "fluxball") {
      await page.getByRole("button", { name: "X · START" }).click();
    } else if (cabinet.gameId === "quantman") {
      await page.keyboard.press("Space");
    }
    const region = page.getByRole("region", { name: cabinet.region });
    await expect(region).toBeVisible();
    await expect(page.locator("[data-ui='game']")).toHaveAttribute(
      "data-phase",
      "active",
      { timeout: 5_000 },
    );

    let before = await expectCanonicalSprite(page, cabinet.probe);
    const beforePress = await inputSampleCount(page);
    let held = before;
    let beforeRelease = beforePress;
    let heldMovementKey: string | null = null;
    let lastMovementError: unknown = null;
    for (const movementKey of cabinet.movementKeys) {
      before = await expectCanonicalSprite(page, cabinet.probe);
      await page.keyboard.down(movementKey);
      try {
        await expect
          .poll(
            async () => {
              held = await expectCanonicalSprite(page, cabinet.probe);
              return spriteDistance(before, held);
            },
            {
              message: `${cabinet.gameId} should respond to ${movementKey}`,
              timeout: cabinet.movementKeys.length === 1 ? 5_000 : 1_500,
            },
          )
          .toBeGreaterThan(0.75);
        heldMovementKey = movementKey;
        break;
      } catch (error) {
        lastMovementError = error;
        await page.keyboard.up(movementKey);
      }
    }
    if (!heldMovementKey) {
      throw new Error(
        `${cabinet.gameId} did not move along any tested direction: ${String(lastMovementError)}`,
      );
    }
    try {
      await expect
        .poll(() => inputSampleCount(page))
        .toBeGreaterThan(beforePress);
      beforeRelease = await inputSampleCount(page);
    } finally {
      await page.keyboard.up(heldMovementKey);
    }
    await page.waitForTimeout(80);
    const afterRelease = await inputSampleCount(page);
    expect(afterRelease).toBeGreaterThanOrEqual(beforeRelease);
    const releaseStart = await expectCanonicalSprite(page, cabinet.probe);
    await page.waitForTimeout(220);
    const releaseEnd = await expectCanonicalSprite(page, cabinet.probe);
    expect(await inputSampleCount(page)).toBe(afterRelease);
    if (cabinet.release === "stop-position") {
      expect(spriteDistance(releaseStart, releaseEnd)).toBeLessThanOrEqual(
        0.75,
      );
    } else if (cabinet.release === "hold-steering-state") {
      expect(releaseEnd.frameId).toBe(releaseStart.frameId);
    } else {
      // Quantman retains its travel direction after keyup, but the selected
      // measured topology may put a wall less than 300 ms ahead. The runtime
      // suite verifies continued travel on a controlled open crossing.
      expect(releaseEnd.frameId).toBe(releaseStart.frameId);
    }

    await page.keyboard.press("p");
    await expect(page.locator("[data-ui='game']")).toHaveAttribute(
      "data-phase",
      "paused",
    );
    await region.getByRole("button", { name: "PAUSE · P" }).click();
    await expect(page.locator("[data-ui='game']")).not.toHaveAttribute(
      "data-phase",
      "paused",
    );
    await region.getByRole("button", { name: "RETURN · ESC" }).click();
    await expect(region).toBeHidden();
  }

  expect(externalRequests).toEqual([]);
});

test("standards-compliant Gamepad connect/hold/release/disconnect awaits browser device emulation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const boundary = await page.evaluate(() => {
    const gamepadConstructor = (
      window as Window & { Gamepad?: new () => Gamepad }
    ).Gamepad;
    let constructible = false;
    if (gamepadConstructor) {
      try {
        Reflect.construct(gamepadConstructor, []);
        constructible = true;
      } catch {
        constructible = false;
      }
    }
    return {
      getGamepads: typeof navigator.getGamepads === "function",
      constructorExposed: typeof gamepadConstructor === "function",
      constructible,
    };
  });
  const reason =
    "Playwright 1.54.2 exposes no physical or virtual Gamepad device API, " +
    `while Chromium reports getGamepads=${boundary.getGamepads}, ` +
    `constructorExposed=${boundary.constructorExposed}, ` +
    `constructible=${boundary.constructible}. Overriding navigator.getGamepads ` +
    "with plain objects would bypass the browser contract and is not accepted as " +
    "standards-compliant connect/disconnect evidence.";
  testInfo.annotations.push({ type: "browser-boundary", description: reason });
  test.skip(!boundary.constructible, reason);
  throw new Error(
    "Chromium now exposes a constructible Gamepad. Replace this boundary test " +
      "with real Playwright device connect/hold/release/disconnect coverage.",
  );
});

async function inputSampleCount(page: Page): Promise<number> {
  return page.evaluate(
    () => window.__QUANTUM_BOX_TEST__?.getInputResponse().sampleCount ?? 0,
  );
}

interface CanonicalSpriteProbe {
  readonly fileId: string;
  readonly frameIds: readonly string[];
  readonly search: Readonly<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>;
}

interface CanonicalSpriteObservation {
  readonly frameId: string;
  readonly x: number;
  readonly y: number;
  readonly score: number;
}

async function expectCanonicalSprite(
  page: Page,
  probe: CanonicalSpriteProbe,
): Promise<CanonicalSpriteObservation> {
  let observation: CanonicalSpriteObservation | null = null;
  await expect
    .poll(async () => {
      observation = await observeCanonicalSprite(page, probe);
      return observation?.score ?? 0;
    })
    .toBeGreaterThan(0.84);
  if (!observation) throw new Error(`Could not locate ${probe.fileId}.`);
  return observation;
}

async function observeCanonicalSprite(
  page: Page,
  probe: CanonicalSpriteProbe,
): Promise<CanonicalSpriteObservation | null> {
  return page.evaluate(async (definition) => {
    interface RuntimeFrame {
      readonly frameId: string;
      readonly rect: Readonly<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    }
    interface RuntimeAsset {
      readonly url: string;
      readonly frames: readonly RuntimeFrame[];
    }

    const snapshotUrl =
      await window.__QUANTUM_BOX_TEST__?.captureCabinetFrame();
    if (!snapshotUrl)
      throw new Error("Quantum Box canvas snapshot is unavailable.");
    const sceneCanvas = document.createElement("canvas");
    const displayBitmap = await createImageBitmap(
      await (await fetch(snapshotUrl)).blob(),
    );
    sceneCanvas.width = displayBitmap.width;
    sceneCanvas.height = displayBitmap.height;
    const sceneContext = sceneCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!sceneContext)
      throw new Error("Canvas observation context is missing.");
    sceneContext.drawImage(displayBitmap, 0, 0);
    displayBitmap.close();
    const scene = sceneContext.getImageData(
      0,
      0,
      sceneCanvas.width,
      sceneCanvas.height,
    ).data;
    const pixelScale = sceneCanvas.width / 320;
    if (
      !Number.isInteger(pixelScale) ||
      pixelScale < 1 ||
      sceneCanvas.height !== 180 * pixelScale
    ) {
      throw new Error(
        `Unexpected cabinet snapshot size ${sceneCanvas.width}×${sceneCanvas.height}.`,
      );
    }

    const modulePath = "/src/assets/CanonicalRuntimeAssets.ts";
    const assetsModule = (await import(/* @vite-ignore */ modulePath)) as {
      readonly CANONICAL_RUNTIME_ASSET_BY_ID: ReadonlyMap<string, RuntimeAsset>;
    };
    const asset = assetsModule.CANONICAL_RUNTIME_ASSET_BY_ID.get(
      definition.fileId,
    );
    if (!asset)
      throw new Error(`Unknown canonical asset ${definition.fileId}.`);
    const response = await fetch(asset.url);
    if (!response.ok) {
      throw new Error(
        `Failed to load ${definition.fileId}: ${response.status}.`,
      );
    }
    const assetBitmap = await createImageBitmap(await response.blob());
    const assetCanvas = document.createElement("canvas");
    assetCanvas.width = assetBitmap.width;
    assetCanvas.height = assetBitmap.height;
    const assetContext = assetCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!assetContext) throw new Error("Asset observation context is missing.");
    assetContext.drawImage(assetBitmap, 0, 0);
    assetBitmap.close();
    const assetPixels = assetContext.getImageData(
      0,
      0,
      assetCanvas.width,
      assetCanvas.height,
    ).data;

    let best: CanonicalSpriteObservation | null = null;
    for (const frameId of definition.frameIds) {
      const frame = asset.frames.find(
        (candidate) => candidate.frameId === frameId,
      );
      if (!frame)
        throw new Error(`Unknown frame ${definition.fileId}/${frameId}.`);
      const points: Array<
        Readonly<{
          x: number;
          y: number;
          red: number;
          green: number;
          blue: number;
        }>
      > = [];
      for (let y = 0; y < frame.rect.height; y += 1) {
        for (let x = 0; x < frame.rect.width; x += 1) {
          const index =
            ((frame.rect.y + y) * assetCanvas.width + frame.rect.x + x) * 4;
          const red = assetPixels[index] ?? 0;
          const green = assetPixels[index + 1] ?? 0;
          const blue = assetPixels[index + 2] ?? 0;
          const alpha = assetPixels[index + 3] ?? 0;
          const isVisibleInk =
            alpha === 255 &&
            ((red === 214 && green === 189 && blue === 139) ||
              (red === 86 && green === 67 && blue === 48));
          if (isVisibleInk) {
            for (let scaledY = 0; scaledY < pixelScale; scaledY += 1) {
              for (let scaledX = 0; scaledX < pixelScale; scaledX += 1) {
                points.push({
                  x: x * pixelScale + scaledX,
                  y: y * pixelScale + scaledY,
                  red,
                  green,
                  blue,
                });
              }
            }
          }
        }
      }
      if (points.length < 4) {
        throw new Error(
          `Canonical frame ${definition.fileId}/${frameId} has too little visible ink to observe.`,
        );
      }

      const maxX = Math.min(
        definition.search.right * pixelScale,
        sceneCanvas.width - frame.rect.width * pixelScale,
      );
      const maxY = Math.min(
        definition.search.bottom * pixelScale,
        sceneCanvas.height - frame.rect.height * pixelScale,
      );
      for (
        let top = Math.max(0, definition.search.top * pixelScale);
        top <= maxY;
        top += 1
      ) {
        for (
          let left = Math.max(0, definition.search.left * pixelScale);
          left <= maxX;
          left += 1
        ) {
          let matches = 0;
          for (const point of points) {
            const index =
              ((top + point.y) * sceneCanvas.width + left + point.x) * 4;
            if (
              scene[index] === point.red &&
              scene[index + 1] === point.green &&
              scene[index + 2] === point.blue
            ) {
              matches += 1;
            }
          }
          const score = matches / points.length;
          if (!best || score > best.score) {
            best = {
              frameId,
              x: left + (frame.rect.width * pixelScale) / 2,
              y: top + (frame.rect.height * pixelScale) / 2,
              score,
            };
          }
        }
      }
    }
    return best;
  }, probe);
}

function spriteDistance(
  left: CanonicalSpriteObservation,
  right: CanonicalSpriteObservation,
): number {
  const positionDistance = Math.hypot(right.x - left.x, right.y - left.y);
  return left.frameId === right.frameId
    ? positionDistance
    : Math.max(1, positionDistance);
}
