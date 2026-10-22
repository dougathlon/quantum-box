import { expect, test } from "@playwright/test";

test("Quantman's corpus is deferred and a cancelled load cannot start a run", async ({
  page,
}) => {
  let requests = 0;
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/quantman-labyrinth-ibm-fez-bank-v3.json*",
    async (route) => {
      requests += 1;
      await hold;
      await route.continue();
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await page.getByRole("button", { name: "QUANTMAN", exact: true }).click();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "HOLD", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "LOADING", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => requests).toBe(1);
  await page.getByRole("button", { name: "BACK · ⌫ / B", exact: true }).click();
  // Start the replacement game while the first request is still suspended.
  await page.getByRole("button", { name: "QONG", exact: true }).click();
  await page.getByRole("button", { name: "PLAYER / CPU", exact: true }).click();
  await expect(page.locator(".qb-game-ui")).toHaveAttribute(
    "data-cabinet",
    "qong",
  );
  const loaded = page.waitForResponse(
    "**/quantman-labyrinth-ibm-fez-bank-v3.json*",
  );
  release();
  await (await loaded).finished();
  // Require ten successive observations after delivery, so this assertion
  // cannot succeed before the cancelled import and validation have settled.
  let observations = 0;
  await expect
    .poll(
      async () => {
        expect(
          await page.locator(".qb-game-ui").getAttribute("data-cabinet"),
        ).toBe("qong");
        return ++observations;
      },
      { intervals: [100] },
    )
    .toBe(10);
});

test("a first Quantman load opens a validated maze and a second launch reuses it", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("quantman-labyrinth-ibm-fez-bank-v3.json"))
      requests++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await page.getByRole("button", { name: "QUANTMAN", exact: true }).click();
  await page.getByRole("button", { name: "HOLD", exact: true }).click();
  await expect(page.locator(".qb-game-ui")).toHaveAttribute(
    "data-cabinet",
    "quantman",
  );
  expect(requests).toBe(1);
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "EXIT · ⌫ / B", exact: true }).click();
  await page.getByRole("button", { name: "INVERT", exact: true }).click();
  await expect(page.locator(".qb-game-ui")).toHaveAttribute(
    "data-cabinet",
    "quantman",
  );
  expect(requests).toBe(1);
});

test("an unavailable Quantman download offers a clear recovery instead of a partial game", async ({
  page,
}) => {
  await page.route("**/quantman-labyrinth-ibm-fez-bank-v3.json*", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await page.getByRole("button", { name: "QUANTMAN", exact: true }).click();
  await page.getByRole("button", { name: "HOLD", exact: true }).click();
  await expect(
    page.getByText(
      "Quantman's maze bank could not be loaded. Check your connection and reload the page.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.locator('.qb-game-ui[data-cabinet="quantman"]'),
  ).toHaveCount(0);
});
