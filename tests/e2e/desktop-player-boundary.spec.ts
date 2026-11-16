import { expect, test } from "@playwright/test";

test("retired mobile URLs keep desktop controls and expose only two human profiles", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One desktop execution verifies the retired route and local player boundary.",
  );
  await page.goto("/?mobile=1&returnTo=controls");
  const players = page.locator('[data-action="settings-player"]');
  await expect(players).toHaveText(["A", "B"]);
  await expect(page.locator("html")).not.toHaveAttribute("data-mobile");
  await expect(
    page.locator('[class*="qb-mobile"], [class*="qb-touch"]'),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "CONTROLLER SETUP", exact: true })
    .click();
  await expect(page.locator(".qb-controller-setup")).toContainText(
    "CONTROLLER 1: PLAYER A",
  );
  await expect(page.locator(".qb-controller-setup")).toContainText(
    "CONTROLLER 2: PLAYER B",
  );
  await expect(page.locator(".qb-controller-setup")).not.toContainText(
    "PLAYER C",
  );
  await expect(page.locator(".qb-controller-setup")).not.toContainText(
    "PLAYER D",
  );

  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await page
    .locator('[data-action="open-arcade-cabinet"][data-game-id="fluxball"]')
    .click();
  await page.getByRole("button", { name: "4-WAY SPLIT", exact: true }).click();
  await expect(page.locator('[data-action="lobby-start"]')).toHaveText([
    "1 PLAYER",
    "2 PLAYERS",
  ]);
  await page.getByRole("button", { name: "2 PLAYERS", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Fluxball game", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Backspace");
  await page.getByRole("button", { name: "EXIT · ⌫ / B", exact: true }).click();
  await page.keyboard.press("Backspace");
  await page
    .locator('[data-action="open-arcade-cabinet"][data-game-id="quarry"]')
    .click();
  await expect(
    page.locator('[data-arcade-detail="quarry"] [data-action="launch-arcade"]'),
  ).toHaveText(["1 PLAYER", "2 PLAYER"]);
});
