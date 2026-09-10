import { expect, test } from "@playwright/test";

for (const [cabinet, mode] of [
  ["qong", "PLAYER / CPU"],
  ["skipixl", "EASY"],
  ["quantman", "HOLD"],
  ["fluxball", "4P SPLIT"],
  ["quarry", "1 PLAYER"],
] as const) {
  test(`${cabinet} shows Resume only while paused`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "PRESS START" }).click();
    await page.getByRole("button", { name: "ARCADE", exact: true }).click();
    await page
      .locator(`[data-action="open-arcade-cabinet"][data-game-id="${cabinet}"]`)
      .click();
    await page.getByRole("button", { name: mode, exact: true }).click();
    if (cabinet === "fluxball") {
      await page
        .getByRole("button", { name: "START · ENTER / A", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "PAUSE · ESC / B", exact: true })
      .click();
    await expect(page.locator('[data-ui="game"]')).toHaveAttribute(
      "data-phase",
      "paused",
    );
    await page
      .getByRole("button", { name: "RESUME · P / START", exact: true })
      .click();
    await expect(page.locator('[data-ui="game"]')).not.toHaveAttribute(
      "data-phase",
      "paused",
    );
    await expect(
      page.getByRole("button", { name: "PAUSE · ESC / B", exact: true }),
    ).toBeVisible();
  });
}
