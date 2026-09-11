import { expect, type Page, test } from "@playwright/test";

const LOGICAL_WIDTH = 320;
const LOGICAL_HEIGHT = 180;

test("the complete menu framebuffer enlarges as uniform logical-pixel blocks", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One browser project drives the explicit 1x through 6x viewport matrix.",
  );

  for (const scale of [1, 2, 4, 6] as const) {
    await page.setViewportSize({
      width: LOGICAL_WIDTH * scale,
      height: LOGICAL_HEIGHT * scale,
    });
    await page.goto(`/?build=native-grid-${scale}x`);
    await expect(
      page.getByRole("button", { name: "PRESS START" }),
    ).toBeVisible();
    await expect(page.locator(".qb-title-field-surface")).toHaveAttribute(
      "data-field-pixel-scale",
      String(scale),
    );
    await assertUniformLogicalBlocks(page, scale, ".qb-title");
    await page.getByRole("button", { name: "PRESS START" }).click();
    await expect(
      page.getByRole("heading", { name: "ARCHIVE INDEX" }),
    ).toBeVisible();
    await expect(page.locator(".qb-field-surface")).toHaveAttribute(
      "data-field-pixel-scale",
      String(scale),
    );
    await assertUniformLogicalBlocks(page, scale);
  }
});

test("moving frames from all five cabinets remain on the native grid", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "The moving-frame audit uses the exact 4x release presentation.",
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?build=native-moving-frames");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();

  for (const cabinet of [
    { id: "qong", launch: "PLAYER / CPU", key: "w" },
    { id: "skipixl", launch: "EASY", key: "ArrowLeft" },
    { id: "fluxball", launch: "2P SHARED", key: "d" },
    { id: "quantman", launch: "HOLD", key: "ArrowRight" },
    { id: "quarry", launch: "1 PLAYER", key: "w" },
  ] as const) {
    await page
      .locator(
        `[data-action="open-arcade-cabinet"][data-game-id="${cabinet.id}"]`,
      )
      .click();
    await page
      .getByRole("button", { name: cabinet.launch, exact: true })
      .click();
    if (cabinet.id === "fluxball") {
      await page.getByRole("button", { name: "START · ENTER / A" }).click();
    }
    await page.keyboard.down(cabinet.key);
    await page.waitForTimeout(180);
    await page.keyboard.up(cabinet.key);
    await page.waitForTimeout(40);
    await assertUniformLogicalBlocks(page, 4);
    await page
      .getByRole("button", { name: "PAUSE · P / START", exact: true })
      .click();
    await page
      .getByRole("button", { name: "EXIT · ⌫ / B", exact: true })
      .click();
    await page
      .getByRole("button", { name: "BACK · ⌫ / B", exact: true })
      .click();
  }
});

async function assertUniformLogicalBlocks(
  page: Page,
  expectedScale: number,
  surface = ".qb-screen-frame",
): Promise<void> {
  if (surface === ".qb-screen-frame") {
    const bitmapUi = page.locator("canvas[data-ui='bitmap-text']");
    await expect(bitmapUi).toHaveAttribute("data-palette-audit", "pass");
    await expect(bitmapUi).toHaveAttribute("data-alpha-audit", "pass");
    await expect(bitmapUi).toHaveAttribute(
      "data-fractional-placement-audit",
      "pass",
    );
    await expect(bitmapUi).toHaveAttribute(
      "data-visible-dom-paint-audit",
      "pass",
    );
  }

  const png = await page.locator(surface).screenshot({
    animations: "disabled",
  });
  const report = await page.evaluate(
    async ({ base64, scale, logicalWidth, logicalHeight }) => {
      const response = await fetch(`data:image/png;base64,${base64}`);
      const image = await createImageBitmap(await response.blob());
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Pixel-grid audit context is unavailable.");
      context.drawImage(image, 0, 0);
      image.close();
      if (
        canvas.width !== logicalWidth * scale ||
        canvas.height !== logicalHeight * scale
      ) {
        return {
          passed: false,
          reason: `unexpected screenshot ${canvas.width}x${canvas.height}`,
        };
      }
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      for (let logicalY = 0; logicalY < logicalHeight; logicalY += 1) {
        for (let logicalX = 0; logicalX < logicalWidth; logicalX += 1) {
          const first =
            (logicalY * scale * canvas.width + logicalX * scale) * 4;
          for (let offsetY = 0; offsetY < scale; offsetY += 1) {
            for (let offsetX = 0; offsetX < scale; offsetX += 1) {
              const index =
                ((logicalY * scale + offsetY) * canvas.width +
                  logicalX * scale +
                  offsetX) *
                4;
              for (let channel = 0; channel < 4; channel += 1) {
                if (pixels[index + channel] !== pixels[first + channel]) {
                  return {
                    passed: false,
                    reason: `mixed block at ${logicalX},${logicalY}`,
                  };
                }
              }
            }
          }
        }
      }
      return { passed: true, reason: null };
    },
    {
      base64: png.toString("base64"),
      // At 1x the raster is downsampled; even scales preserve the finer pixels.
      scale: expectedScale === 1 ? 1 : expectedScale / 2,
      logicalWidth: expectedScale === 1 ? LOGICAL_WIDTH : LOGICAL_WIDTH * 2,
      logicalHeight: expectedScale === 1 ? LOGICAL_HEIGHT : LOGICAL_HEIGHT * 2,
    },
  );
  expect(report).toEqual({ passed: true, reason: null });
}
