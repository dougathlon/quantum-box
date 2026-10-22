import { expect, test, type Page } from "@playwright/test";

const games = [
  { title: "QONG", id: "qong", mode: "PLAYER / CPU" },
  { title: "SKIPIXL", id: "skipixl", mode: "EASY" },
  { title: "QUANTMAN", id: "quantman", mode: "HOLD" },
  { title: "FLUXBALL", id: "fluxball", mode: "4-WAY SPLIT" },
  { title: "QUARRY", id: "quag", mode: "1 PLAYER" },
] as const;

async function launch(page: Page, game: (typeof games)[number]) {
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await page.getByRole("button", { name: game.title, exact: true }).click();
  await page.getByRole("button", { name: game.mode, exact: true }).click();
  await expect(page.locator(".qb-shell")).toHaveAttribute(
    "data-view",
    "cabinet",
  );
}

test.beforeEach(async ({ page }, info) => {
  test.skip(
    info.project.name !== "desktop-1280x720",
    "Mobile cases set their own viewport.",
  );
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/?mobile=1");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
});

for (const size of [
  { width: 320, height: 480 },
  { width: 390, height: 664 },
  { width: 430, height: 740 },
  { width: 768, height: 1024 },
  { width: 667, height: 280 },
  { width: 844, height: 320 },
  { width: 932, height: 390 },
  { width: 1024, height: 768 },
]) {
  test(`all tutorials retain their header and back control at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.getByRole("button", { name: "ARCADE", exact: true }).click();
    for (const game of games) {
      await page.getByRole("button", { name: game.title, exact: true }).click();
      const header = page.locator(".qb-arcade-detail-header");
      const body = page.locator(".qb-arcade-detail-body");
      const back = page.getByRole("button", {
        name: "BACK · ⌫ / B",
        exact: true,
      });
      await expect(header).toBeInViewport();
      await expect(back).toBeInViewport();
      expect(await body.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
        true,
      );
      const lastMode = page.locator("[data-action='launch-arcade']").last();
      await lastMode.scrollIntoViewIfNeeded();
      expect((await lastMode.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(header).toBeInViewport();
      await expect(back).toBeInViewport();
      await back.click();
    }
  });
}

for (const game of games) {
  test(`${game.title} keeps portrait playable, releases touch on resize, and supports explicit pause`, async ({
    page,
  }) => {
    await launch(page, game);
    const touch = page.getByRole("navigation", { name: "Touch game controls" });
    const movement = touch.locator(".qb-touch-move");
    const box = (await movement.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(
      x + (game.id === "qong" ? 0 : -24),
      y + (game.id === "qong" ? -24 : 0),
    );
    await expect(movement).toHaveAttribute("data-held", "true");
    await page.setViewportSize({ width: 390, height: 600 });
    await expect(movement).toHaveAttribute("data-held", "false");
    await expect(page.locator(".qb-shell")).not.toHaveAttribute("inert", "");
    await expect(touch).toBeVisible();
    await page.mouse.up();
    await touch.getByRole("button", { name: "PAUSE", exact: true }).click();
    await expect(page.locator(".qb-game-ui")).toHaveAttribute(
      "data-phase",
      "paused",
    );
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator(".qb-game-ui")).toHaveAttribute(
      "data-phase",
      "paused",
    );
    await page.setViewportSize({ width: 390, height: 664 });
    await page
      .getByRole("button", { name: "RESUME · P / START", exact: true })
      .click();
    await expect(touch).toBeVisible();
    await expect(page.locator(".qb-game-ui")).not.toHaveAttribute(
      "data-phase",
      "paused",
    );
    await touch.getByRole("button", { name: "PAUSE", exact: true }).click();
    await page
      .getByRole("button", { name: "EXIT · ⌫ / B", exact: true })
      .click();
    await expect(page.locator(".qb-shell")).not.toHaveAttribute(
      "data-view",
      "cabinet",
    );
    await expect(page.locator(".qb-shell")).toHaveAttribute(
      "data-surface",
      "internal",
    );
  });
}

test("Qong shows the remaining allowance and disables a resolved reveal", async ({
  page,
}) => {
  await launch(page, games[0]);
  const reveal = page
    .getByRole("navigation", { name: "Touch game controls" })
    .getByRole("button", { name: "REVEAL", exact: true });
  await expect(reveal).toContainText("3 LEFT");
  await reveal.click();
  await expect(reveal).toContainText("2 LEFT");
  await expect(reveal).toBeDisabled();
});

test("tablet reading type does not push touch buttons outside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await launch(page, games[0]);
  const touch = page.getByRole("navigation", { name: "Touch game controls" });
  for (const button of await touch.getByRole("button").all()) {
    const box = (await button.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1024);
    expect(box.y + box.height).toBeLessThanOrEqual(768);
  }
});

test("Fluxball touch rule change spends its shared allowance once", async ({
  page,
}) => {
  await launch(page, games[3]);
  const change = page
    .getByRole("navigation", { name: "Touch game controls" })
    .getByRole("button", { name: "CHANGE", exact: true });
  await expect(change).toContainText("1 LEFT");
  await change.click();
  await expect(change).toContainText("0 LEFT");
  await expect(change).toBeDisabled();
});

test("mobile Story can finish typing by tapping text and return to the session menu", async ({
  page,
}) => {
  await page.getByRole("button", { name: "STORY", exact: true }).click();
  await page.locator("[data-action='new-story']").click();
  const panel = (await page.locator(".qb-terminal-page").boundingBox())!;
  await page.mouse.click(panel.x + 20, panel.y + 20);
  await expect(page.locator(".qb-terminal-page")).toHaveAttribute(
    "data-terminal-complete",
    "true",
  );
  await expect(page.locator(".qb-mobile-story-back")).toBeInViewport();
  await page.locator(".qb-mobile-story-back").click();
  await expect(
    page.getByRole("button", { name: "STORY", exact: true }),
  ).toBeVisible();
});

test("a touch device opens directly in portrait without a special URL or rotation step", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 664 },
    hasTouch: true,
    isMobile: true,
  });
  const phone = await context.newPage();
  try {
    await phone.goto(baseURL!);
    await expect(phone.locator("html")).toHaveAttribute("data-mobile", "true");
    await expect(
      phone.getByRole("button", { name: "PRESS START", exact: true }),
    ).toBeVisible();
    await phone
      .getByRole("button", { name: "PRESS START", exact: true })
      .click();
    await expect(
      phone.getByRole("button", { name: "STORY", exact: true }),
    ).toBeVisible();
    await expect(phone.locator(".qb-rotate-prompt")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("touch adapter releases and separates synthetic pointer inputs", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/mobile/mobile-input.html?mobile=1");
  await page
    .getByRole("button", { name: "Run touch checks", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("25/25 checks passed");
  await expect(page.locator("[data-result='fail']")).toHaveCount(0);
});

test("result and pause controls stay stable while their HUD redraws", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/mobile/mobile-results.html?mobile=1");
  await page
    .getByRole("button", { name: "Run result checks", exact: true })
    .click();
  await expect(page.locator("#summary")).toHaveText("16/16 checks passed");
  await expect(page.locator("[data-result='fail']")).toHaveCount(0);
  for (let count = 1; count <= 5; count++) {
    await page.getByRole("button", { name: "NEXT ROUND", exact: true }).click();
    await expect(page.locator("#actions")).toHaveText(
      `${count} cabinet actions`,
    );
  }
});

for (const size of [
  { width: 320, height: 480 },
  { width: 390, height: 664 },
  { width: 430, height: 740 },
  { width: 768, height: 1024 },
  { width: 667, height: 280 },
  { width: 844, height: 390 },
  { width: 844, height: 260 },
  { width: 1024, height: 768 },
]) {
  test(`mobile menus retain their content and expose scrolling at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/tests/fixtures/mobile/mobile-presentation.html?mobile=1");
    await page.getByRole("button", { name: "Run presentation checks" }).click();
    await expect(page.locator("#summary")).toContainText("checks passed at");
    await expect(page.locator("[data-result='fail']")).toHaveCount(0);
  });
}

test("short landscape keeps readable content and navigation clear of safe areas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 260 });
  await page.goto(
    "/tests/fixtures/mobile/mobile-presentation.html?mobile=1&safearea=1",
  );
  await page.getByRole("button", { name: "Run presentation checks" }).click();
  await expect(page.locator("#summary")).toContainText("checks passed at");
  await expect(page.locator("[data-result='fail']")).toHaveCount(0);
});

for (const size of [
  { width: 320, height: 480 },
  { width: 390, height: 664 },
  { width: 430, height: 740 },
  { width: 768, height: 1024 },
]) {
  for (const game of games) {
    test(`${game.title} keeps its arena and touch controls separate at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto(
        `/tests/fixtures/mobile/mobile-device.html?mobile=1&game=${game.id}&audit=1`,
      );
      await expect(page.locator("#device-review")).toHaveAttribute(
        "data-layout-result",
        "pass",
      );
      await page.getByRole("button", { name: "PAUSE", exact: true }).click();
      await expect(page.locator(".qb-game-ui")).toHaveAttribute(
        "data-phase",
        "paused",
      );
      await expect(page.locator("#device-review")).toHaveAttribute(
        "data-layout-result",
        "pass",
      );
    });
  }
}

test("portrait reading and actions stay clear of phone safe areas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto(
    "/tests/fixtures/mobile/mobile-presentation.html?mobile=1&safearea=1",
  );
  await page.getByRole("button", { name: "Run presentation checks" }).click();
  await expect(page.locator("#summary")).toContainText("checks passed at");
  await expect(page.locator("[data-result='fail']")).toHaveCount(0);
});
