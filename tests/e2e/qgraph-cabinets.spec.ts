import { expect, test, type Browser, type Page } from "@playwright/test";

const E2E_ORIGIN = `http://127.0.0.1:${process.env["QUANTUM_BOX_E2E_PORT"] ?? "4390"}`;

async function openArcade(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
}

function quarryIndexRow(page: Page) {
  return page.locator(
    '[data-action="open-arcade-cabinet"][data-game-id="quarry"]',
  );
}

async function openQuarryCabinet(page: Page): Promise<void> {
  await quarryIndexRow(page).click();
  await page
    .locator('[data-arcade-detail="quarry"]')
    .getByRole("button", { name: "1 PLAYER" })
    .click();
}

function recordProviderRequests(page: Page): string[] {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (
      hostname.endsWith("mothquantum.com") ||
      hostname.endsWith("ibm.com") ||
      hostname.endsWith("ibmcloud.com")
    ) {
      providerRequests.push(request.url());
    }
  });
  return providerRequests;
}

test("Quarry pauses, restarts, exits, leaves Story unchanged, and stays provider-free", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "The cabinet lifecycle and save boundary need one deterministic desktop execution.",
  );
  const providerRequests = recordProviderRequests(page);
  await openArcade(page);
  const saveBefore = await page.evaluate(() =>
    JSON.stringify(window.__QUANTUM_BOX_TEST__?.getSave()),
  );

  await openQuarryCabinet(page);
  const region = page.getByRole("region", {
    name: "Quarry directed aerial hunt arena",
  });
  await expect(region).toBeVisible();
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "active",
    { timeout: 4_500 },
  );

  await region.getByRole("button", { name: "PAUSE · P / START" }).click();
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "paused",
  );
  await region.getByRole("button", { name: "RESUME · P / START" }).click();
  await expect(page.locator("[data-ui='game']")).not.toHaveAttribute(
    "data-phase",
    "paused",
  );

  await region.getByRole("button", { name: "PAUSE · P / START" }).click();
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "paused",
  );
  await region.getByRole("button", { name: "RESTART", exact: true }).click();
  await expect(region).toBeVisible();
  await region.getByRole("button", { name: "PAUSE · P / START" }).click();
  await region.getByRole("button", { name: "EXIT · ⌫ / B" }).click();
  await expect(region).toBeHidden();
  await expect(page.locator('[data-arcade-detail="quarry"]')).toBeVisible();

  const saveAfter = await page.evaluate(() =>
    JSON.stringify(window.__QUANTUM_BOX_TEST__?.getSave()),
  );
  expect(saveAfter).toBe(saveBefore);
  expect(providerRequests).toEqual([]);
});

test("the shipped roster launches Quarry and rejects a stale Enclose launch", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "The shipped and retired cabinet boundary needs one deterministic desktop execution.",
  );
  const providerRequests = recordProviderRequests(page);
  await openArcade(page);

  await expect(quarryIndexRow(page)).toBeVisible();
  await expect(page.getByText("QUAG", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ENCLOSE", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-game-id='enclose']")).toHaveCount(0);
  await expect(page.locator("[data-cabinet='enclose']")).toHaveCount(0);

  await page.locator("[data-ui='page']").evaluate((root) => {
    const staleLaunch = document.createElement("button");
    staleLaunch.type = "button";
    staleLaunch.dataset["action"] = "launch-arcade";
    staleLaunch.dataset["gameId"] = "enclose";
    staleLaunch.dataset["mode"] = "PLAYER / CPU";
    staleLaunch.textContent = "STALE ENCLOSE LINK";
    root.append(staleLaunch);
  });
  await page.getByRole("button", { name: "STALE ENCLOSE LINK" }).click();
  await expect(page.locator("[data-ui='status']")).toHaveText(
    "That legacy cabinet is not shipped in this build.",
  );
  await expect(page.locator("[data-ui='game']")).toBeHidden();
  await expect(page.locator(".qb-cabinet-index")).toBeVisible();

  await openQuarryCabinet(page);
  await expect(
    page.getByRole("region", {
      name: "Quarry directed aerial hunt arena",
    }),
  ).toBeVisible();
  expect(providerRequests).toEqual([]);
});

test("Quarry introduces Player A and freezes its 60-second clock during orientation", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "Quarry first-contact framing needs one deterministic desktop execution.",
  );
  await openArcade(page);
  await openQuarryCabinet(page);
  const region = page.getByRole("region", {
    name: "Quarry directed aerial hunt arena",
  });
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "ready",
  );
  await expect(region.locator("[data-quag='time']")).toHaveText("060");
  await expect(region.locator("[data-quag='score']")).toHaveText(
    "POINTS A00 B00 C00 D00 · WINS A0 B0 C0 D0",
    { timeout: 1_000 },
  );
  await expect(region.locator("[data-quag='targets']")).toHaveText(
    /[B-D](?:\+[B-D]){0,2}|NONE/,
  );
  await expect(region.locator("[data-quag='notice']")).toContainText(
    "YOU ARE A",
  );
  await expect(region.locator("[data-quag='controls']")).toHaveText(
    "MOVE · A/D / ←→",
  );
  await expect(region.locator("[data-quag='controls']")).toBeVisible();
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "active",
    { timeout: 4_500 },
  );
  await expect(region.locator("[data-quag='controls']")).toBeVisible();
  await expect(
    region.getByText("FLAP · SPACE / A", { exact: true }),
  ).toBeVisible();
});

test("all five Arcade cabinets fit and keyboard navigation reaches Quarry", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "The five-row route needs one deterministic desktop execution.",
  );
  await openArcade(page);
  const list = page.locator(".qb-arcade-list");
  const firstCabinet = page.locator(
    '[data-action="open-arcade-cabinet"][data-game-id="qong"]',
  );
  await expect(firstCabinet).toBeFocused();
  await expect(page.locator("[data-scroll-position]")).toHaveCount(0);
  await expect(quarryIndexRow(page)).toBeInViewport();
  expect(await list.evaluate((element) => element.scrollHeight)).toBe(
    await list.evaluate((element) => element.clientHeight),
  );
  for (let step = 0; step < 8; step += 1) {
    if (
      await quarryIndexRow(page).evaluate(
        (button) => document.activeElement === button,
      )
    ) {
      break;
    }
    await page.keyboard.press("ArrowDown");
  }
  await expect(quarryIndexRow(page)).toBeFocused();
  await expect(quarryIndexRow(page)).toBeInViewport();
});

test("the Quarry cabinet miniature renders at exact integer scale", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One native presentation scale is sufficient for the asset contract.",
  );
  await openArcade(page);
  const image = page.locator(
    "[data-qgraph-cabinet-asset='quag-cabinet-thumbnail']",
  );
  await expect(image).toBeVisible();
  const geometry = await image.evaluate((element) => {
    const imageElement = element as HTMLImageElement;
    const bounds = imageElement.getBoundingClientRect();
    return {
      naturalWidth: imageElement.naturalWidth,
      naturalHeight: imageElement.naturalHeight,
      renderedWidth: bounds.width,
      renderedHeight: bounds.height,
    };
  });
  expect(geometry.naturalWidth).toBe(40);
  expect(geometry.naturalHeight).toBe(24);
  expect(geometry.renderedWidth / geometry.naturalWidth).toBe(4);
  expect(geometry.renderedHeight / geometry.naturalHeight).toBe(4);
  await expect(
    page.locator("[data-qgraph-cabinet-asset='enclose-cabinet-thumbnail']"),
  ).toHaveCount(0);
});

test("native 320 by 180 keeps all five Arcade cabinets on one screen", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "The native fit route creates its own 320 by 180 context once.",
  );
  await verifyNativeFit(browser);
});

async function verifyNativeFit(browser: Browser): Promise<void> {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 320, height: 180 },
  });
  const page = await context.newPage();
  await page.goto(E2E_ORIGIN);
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  const list = page.locator(".qb-arcade-list");
  await expect(quarryIndexRow(page)).toBeInViewport();
  expect(await list.evaluate((element) => element.scrollHeight)).toBe(
    await list.evaluate((element) => element.clientHeight),
  );
  await expect(page.getByText("ENCLOSE", { exact: true })).toHaveCount(0);
  await context.close();
}
