import { expect, test } from "@playwright/test";

test("controller calibration returns directly to Controls", async ({
  page,
}) => {
  await page.goto("/?returnTo=controls");
  await expect(
    page.getByRole("heading", { name: "PLAYER KEYS" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "CONTROLLER SETUP" }).click();
  await expect(
    page.getByRole("heading", { name: "CONTROLLER SETUP", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PLAYER KEYS", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "PLAYER KEYS" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "PRESS START" }),
  ).not.toBeVisible();
  await expect(page).not.toHaveURL(/returnTo=/);
});

for (const count of [1, 2]) {
  test(`Fluxball starts with ${count} humans and retains four competitors`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "PRESS START", exact: true })
      .click();
    await page.getByRole("button", { name: "ARCADE", exact: true }).click();
    await page.getByRole("button", { name: "FLUXBALL", exact: true }).click();
    await page
      .getByRole("button", { name: "4-WAY SPLIT", exact: true })
      .click();
    await expect(page.locator('[data-action="lobby-toggle"]')).toHaveCount(0);
    await page.keyboard.press("r");
    await page.keyboard.press("o");
    await expect(
      page.getByRole("heading", { name: "FLUXBALL PLAYERS" }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: count === 1 ? "1 PLAYER" : "2 PLAYERS",
        exact: true,
      })
      .press("Enter");
    await expect(
      page.getByRole("region", { name: "Fluxball game" }),
    ).toBeVisible();
  });
}
test("Quarry and keyboard setup expose only two human profiles", async ({
  page,
}) => {
  await page.goto("/?returnTo=controls");
  await expect(page.locator('[data-action="settings-player"]')).toHaveCount(2);
  await expect(page.locator('[data-action="settings-player"]')).toHaveText([
    "A",
    "B",
  ]);
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await page.getByRole("button", { name: "QUARRY", exact: true }).click();
  await expect(page.locator('[data-action="launch-arcade"]')).toHaveText([
    "1 PLAYER",
    "2 PLAYER",
  ]);
});

test("key capture stays compact and Backspace does not leave Controls", async ({
  page,
}) => {
  await page.goto("/?returnTo=controls");
  await page.getByRole("button", { name: "UP W", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "UP PRESS KEY", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Backspace");
  await expect(
    page.getByRole("heading", { name: "PLAYER KEYS" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "UP PRESS KEY", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("KeyZ");
  await expect(
    page.getByRole("button", { name: "UP Z", exact: true }),
  ).toBeVisible();
});

test("remapped Qong action ignores native Space clicks and uses the new key", async ({
  page,
}) => {
  await page.goto("/?returnTo=controls");
  await page.getByRole("button", { name: "ACTION SPACE", exact: true }).click();
  await page.keyboard.press("KeyV");
  await page.goto("/?returnTo=controls");
  await expect(
    page.getByRole("button", { name: "ACTION V", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "BACK · ⌫ / B", exact: true }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await page.getByRole("button", { name: "QONG", exact: true }).click();
  await page.getByRole("button", { name: "PLAYER / CPU", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(
    page.getByText("REVEALS LEFT 3/3", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("KeyV");
  await expect(
    page.getByText("REVEALS LEFT 2/3", { exact: true }),
  ).toBeVisible();
});
