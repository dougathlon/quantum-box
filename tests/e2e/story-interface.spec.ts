import { expect, test } from "@playwright/test";

import { captureExternalRequests } from "./support/network";

test("Story types an exact terminal page, completes it on action, and resumes the persisted next page", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One release desktop proves the terminal interaction contract.",
  );
  const externalRequests = captureExternalRequests(page, testInfo);

  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "STORY", exact: true }).click();
  await page.getByRole("button", { name: "NEW STORY", exact: true }).click();

  const first = page.locator('[data-terminal-page="intro-1"]');
  await expect(first).toBeVisible();
  await expect(first).toHaveAttribute("data-terminal-complete", "false");
  await expect(first.getByRole("button", { name: /CONTINUE/ })).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(first).toHaveAttribute("data-terminal-complete", "true");
  await expect(first).toContainText("WELCOME TO QUANTUM BOX.");
  await expect(first.locator(".qb-terminal-top-rule")).toHaveCount(1);
  await expect(first.locator(".qb-terminal-bottom-rule")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.locator('[data-terminal-page="intro-2"]')).toBeVisible();

  const savedNode = await page.evaluate(
    () => window.__QUANTUM_BOX_TEST__?.getSave().story.currentNodeId,
  );
  expect(savedNode).toBe("intro-2");
  await page.reload();
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "STORY", exact: true }).click();
  await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
  await expect(page.locator('[data-terminal-page="intro-2"]')).toBeVisible();
  await expect(page.locator("[data-qong-story='player']")).toHaveCount(0);
  await expect(page.locator("[data-qong-story='designer']")).toHaveCount(0);
  await expect(page.locator(".qb-office-computer, .qb-workshop")).toHaveCount(
    0,
  );
  expect(externalRequests).toEqual([]);
});

test("Terminal presents five program records and never exposes a physical Workshop", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "TERMINAL", exact: true }).click();

  await expect(page.getByRole("heading", { name: "TERMINAL" })).toBeVisible();
  const rows = page.locator(".qb-terminal-index li");
  await expect(rows).toHaveCount(5);
  await expect(rows).toContainText([
    "QONG",
    "SKIPIXL",
    "QUANTMAN",
    "FLUXBALL",
    "QUARRY",
  ]);
  await expect(rows).toContainText([
    "UNOPENED",
    "UNOPENED",
    "UNOPENED",
    "UNOPENED",
    "UNOPENED",
  ]);
  await expect(page.getByText("WORKSHOP", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/MOTH LINK/)).toHaveCount(0);
});

test("Settings retain the Brown Box hierarchy without stacked utility clutter", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One release desktop proves the utility menu hierarchy.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /SETTINGS/ }).click();
  await expect(
    page.getByRole("navigation", { name: "Settings sections" }),
  ).toBeVisible();
  await expect(page.locator("[data-settings-panel='display']")).toBeVisible();
  await page.getByRole("button", { name: "02 FIELD" }).click();
  await expect(
    page.locator("[data-settings-panel='background']"),
  ).toBeVisible();
  await expect(
    page.getByLabel("ADAPTIVE DIRECT", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "03 CONTROLS" }).click();
  const profiles = page.getByRole("navigation", {
    name: "Player key profiles",
  });
  await expect(profiles).toBeVisible();
  await profiles.getByRole("button", { name: "C", exact: true }).click();
  const playerC = page.getByRole("region", { name: "Player C bindings" });
  await expect(playerC).toBeVisible();
  await expect(playerC.getByRole("button")).toHaveCount(5);
});
