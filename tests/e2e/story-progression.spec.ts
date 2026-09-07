import { expect, test, type Page } from "@playwright/test";

import { captureExternalRequests } from "./support/spatialTutorial";

test("Story Qong launches from the installed authenticated bank without an active-play request", async ({
  page,
}, testInfo) => {
  const externalRequests = captureExternalRequests(page, testInfo);
  await openStoryQong(page);

  await expect(page.getByRole("region", { name: "Qong game" })).toBeVisible();
  await expect(page.locator("[data-qong='round']")).toHaveText("ROUND: 1/7");
  await expect(page.locator("[data-qong='rule-state']")).toHaveText(
    "RULE STATE: UNRESOLVED",
  );
  await expect(page.locator("[data-qong='goal']")).toHaveText(
    "GOAL: UNRESOLVED",
  );
  await expect(page.locator("[data-qong='winner']")).toHaveText(
    "WINNER: UNRESOLVED",
  );
  expect(externalRequests).toEqual([]);
});

test("an observed, deliberately controlled Story Qong win opens the Story v2 den sequence", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const externalRequests = captureExternalRequests(page, testInfo);
  const sequence = page.locator(
    "section.qb-cabinet-ui[data-cabinet='qong-story']",
  );
  let qualified = false;

  for (let attempt = 0; attempt < 8 && !qualified; attempt += 1) {
    if (attempt === 0) await openStoryQong(page);
    else await reopenStoryQong(page);

    await page.getByRole("button", { name: /OBSERVE/ }).click();
    await applyDirectionalTrace(page);
    qualified = await sequence.isVisible();
    if (!qualified) {
      await expect(page.locator("[data-qong='winner']")).toHaveText(
        /WINNER: (YOU|CPU)/,
        { timeout: 45_000 },
      );
    }
  }

  expect(qualified).toBe(true);
  await expect(sequence).toBeVisible();
  await expect(sequence).not.toContainText("CHANGES SHAPE");
  await expect(sequence.locator("[data-qong-story='player']")).toBeVisible();
  await expect(sequence.locator("[data-qong-story='designer']")).toBeVisible();
  await expect(sequence).toHaveAttribute("data-phase", "court-walk", {
    timeout: 4_000,
  });
  expect(externalRequests).toEqual([]);
});

async function openStoryQong(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "STORY", exact: true }).click();
  await page.getByRole("button", { name: "QONG · UNLOCKED" }).click();
  await expect(page.getByRole("region", { name: "Qong game" })).toBeVisible();
}

async function reopenStoryQong(page: Page): Promise<void> {
  const qong = page.getByRole("region", { name: "Qong game" });
  await qong.getByRole("button", { name: "RETRY: SPACE", exact: true }).click();
  const firstLossRetry = page.getByRole("button", {
    name: "RETRY · SPACE",
    exact: true,
  });
  await expect(qong.or(firstLossRetry)).toBeVisible({ timeout: 15_000 });
  if (await firstLossRetry.isVisible()) await firstLossRetry.click();
  await expect(qong).toBeVisible({ timeout: 15_000 });
}

async function applyDirectionalTrace(page: Page): Promise<void> {
  const movedRallies = new Set<number>();
  const qongStory = page.locator(
    "section.qb-cabinet-ui[data-cabinet='qong-story']",
  );
  const retry = page.getByRole("button", { name: "RETRY: X" });
  while (!(await qongStory.isVisible()) && !(await retry.isVisible())) {
    const roundLabel = await page.locator("[data-qong='round']").textContent();
    const rallyNumber = Number(/ROUND: (\d+)\/7/.exec(roundLabel ?? "")?.[1]);
    if (
      Number.isInteger(rallyNumber) &&
      rallyNumber >= 1 &&
      rallyNumber <= 3 &&
      !movedRallies.has(rallyNumber)
    ) {
      movedRallies.add(rallyNumber);
      await page.keyboard.down("w");
      await page.waitForTimeout(140);
      await page.keyboard.up("w");
      await page.keyboard.down("s");
      await page.waitForTimeout(140);
      await page.keyboard.up("s");
    }
    await page.waitForTimeout(40);
  }
  expect(movedRallies.size).toBe(3);
}
