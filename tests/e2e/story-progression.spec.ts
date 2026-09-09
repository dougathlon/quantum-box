import { expect, test, type Page } from "@playwright/test";

import { captureExternalRequests } from "./support/network";

test("fresh Story advances through the terminal introduction and launches Qong from captured hardware", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One release desktop proves the deterministic Story launch boundary.",
  );
  const externalRequests = captureExternalRequests(page, testInfo);
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "STORY", exact: true }).click();
  await page.getByRole("button", { name: "NEW STORY", exact: true }).click();

  for (const [pageId, action] of [
    ["intro-1", "CONTINUE"],
    ["intro-2", "CONTINUE"],
    ["intro-3", "CONTINUE"],
    ["qong-intro", "CONTINUE"],
    ["qong-tutorial", "PLAY"],
  ] as const) {
    await completeTerminalPage(page, pageId, action);
  }

  const qong = page.getByRole("region", { name: "Qong game" });
  await expect(qong).toBeVisible();
  await expect(page.locator("[data-qong='round']")).toHaveText("ROUND: 1/7");
  await expect(page.locator("[data-qong='rule-state']")).toHaveText(
    "RULE STATE: UNRESOLVED",
  );
  const save = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  expect(save?.story.currentNodeId).toBe("game-qong");
  expect(save?.story.experiencedStages).toContain("qong");
  expect(save?.story.attempts.qong).toBe(1);
  expect(externalRequests).toEqual([]);
});

async function completeTerminalPage(
  page: Page,
  pageId: string,
  action: "CONTINUE" | "PLAY",
): Promise<void> {
  const terminal = page.locator(`[data-terminal-page="${pageId}"]`);
  await expect(terminal).toBeVisible();
  await page.keyboard.press("Space");
  await expect(terminal).toHaveAttribute("data-terminal-complete", "true");
  await terminal.getByRole("button", { name: new RegExp(action) }).click();
}
