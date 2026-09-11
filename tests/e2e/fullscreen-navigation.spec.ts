import { expect, test } from "@playwright/test";

test("Backspace navigates while Escape belongs to fullscreen", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One desktop checks native fullscreen and keyboard behavior.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await page.getByRole("button", { name: "01 DISPLAY", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "02 SOUND", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("checkbox", { name: "FULL SCREEN" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "FULL SCREEN" }).check();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  await page
    .getByRole("button", { name: "BACK · ⌫ / B", exact: true })
    .press("Backspace");
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await page.getByRole("button", { name: "QONG", exact: true }).click();
  await page.getByRole("button", { name: "PLAYER / CPU", exact: true }).click();
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('[data-ui="game"]')).toHaveAttribute(
    "data-phase",
    "paused",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "EXIT · ⌫ / B" }),
  ).toBeVisible();
  await page.keyboard.press("p");
  await expect(
    page.getByRole("button", { name: "PAUSE · P / START" }),
  ).toBeVisible();
  await page.keyboard.press("Backspace");
  await expect(
    page.getByRole("button", { name: "RESUME · P / START" }),
  ).toBeVisible();
  await page.keyboard.press("Backspace");
  await expect(page.locator('[data-arcade-detail="qong"]')).toBeVisible();
});
