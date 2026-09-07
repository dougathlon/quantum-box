import { expect, test, type Browser, type Page } from "@playwright/test";

const E2E_ORIGIN = `http://127.0.0.1:${process.env["QUANTUM_BOX_E2E_PORT"] ?? "4390"}`;

async function openArcade(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
}

function quarryCabinet(page: Page) {
  return page.getByRole("region", { name: "QUARRY" }).getByRole("button", {
    name: "1 PLAYER",
  });
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

  await quarryCabinet(page).click();
  const region = page.getByRole("region", {
    name: "Quarry directed aerial hunt arena",
  });
  await expect(region).toBeVisible();
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "active",
    { timeout: 4_500 },
  );

  await region.getByRole("button", { name: "PAUSE · P" }).click();
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "paused",
  );
  await region.getByRole("button", { name: "PAUSE · P" }).click();
  await expect(page.locator("[data-ui='game']")).not.toHaveAttribute(
    "data-phase",
    "paused",
  );

  await region.getByRole("button", { name: "PAUSE · P" }).click();
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "paused",
  );
  await region.getByRole("button", { name: "RESTART · X" }).click();
  await expect(region).toBeVisible();
  await region.getByRole("button", { name: "RETURN · ESC" }).click();
  await expect(region).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "ARCADE", exact: true }),
  ).toBeVisible();

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

  await expect(page.getByRole("region", { name: "QUARRY" })).toBeVisible();
  await expect(page.getByRole("region", { name: "QUAG" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "ENCLOSE" })).toHaveCount(0);
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
  await expect(
    page.getByRole("heading", { name: "ARCADE", exact: true }),
  ).toBeVisible();

  await quarryCabinet(page).click();
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
  await quarryCabinet(page).click();
  const region = page.getByRole("region", {
    name: "Quarry directed aerial hunt arena",
  });
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "ready",
  );
  await expect(region.locator("[data-quag='time']")).toHaveText("060");
  await expect(region.locator("[data-quag='score']")).toHaveText(
    "W A0 B0 C0 D0 · P A00 B00 C00 D00",
    { timeout: 1_000 },
  );
  await expect(region.locator("[data-quag='targets']")).toHaveText(
    /[B-D](?:\+[B-D]){0,2}|NONE/,
  );
  await expect(region.locator("[data-quag='notice']")).toContainText(
    "YOU ARE A",
  );
  await expect(region.locator("[data-quag='controls']")).toHaveText(
    "A/D OR ARROWS · W/SPACE/UP FLAP",
  );
  await expect(region.locator("[data-quag='controls']")).toBeVisible();
  await expect(page.locator("[data-ui='game']")).toHaveAttribute(
    "data-phase",
    "active",
    { timeout: 4_500 },
  );
  await expect(region.locator("[data-quag='controls']")).toBeHidden();
});

test("wheel and keyboard navigation reach the fifth Arcade cabinet", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "The scroll routes need one deterministic desktop execution.",
  );
  await openArcade(page);
  const list = page.locator("[data-scroll-list]");
  const marker = page.locator("[data-scroll-position]");
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute("aria-hidden", "true");
  await list.hover();
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(marker).toHaveAttribute("data-scroll-state", /middle|end/);
  await expect(quarryCabinet(page)).toBeInViewport();

  await page.reload();
  await openArcade(page);
  const firstCabinet = page
    .getByRole("region", { name: "QONG" })
    .getByRole("button", { name: "PLAYER / CPU" });
  await expect(firstCabinet).toBeFocused();
  for (let step = 0; step < 20; step += 1) {
    if (
      await quarryCabinet(page).evaluate(
        (button) => document.activeElement === button,
      )
    ) {
      break;
    }
    await page.keyboard.press("ArrowDown");
  }
  await expect(quarryCabinet(page)).toBeFocused();
  await expect(quarryCabinet(page)).toBeInViewport();
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

test("native 320 by 180 touch scrolling reaches Quarry", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "The native touch route creates its own 320 by 180 context once.",
  );
  await verifyTouchScroll(browser);
});

async function verifyTouchScroll(browser: Browser): Promise<void> {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 320, height: 180 },
  });
  const page = await context.newPage();
  await page.goto(E2E_ORIGIN);
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  const list = page.locator("[data-scroll-list]");
  const bounds = await list.boundingBox();
  if (!bounds)
    throw new Error("Arcade scroll list has no native-screen bounds.");
  const client = await context.newCDPSession(page);
  const x = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height * 0.8;
  const endY = bounds.y + bounds.height * 0.2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: startY }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: endY }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(quarryCabinet(page)).toBeAttached();
  await expect(page.getByRole("region", { name: "ENCLOSE" })).toHaveCount(0);
  await context.close();
}
