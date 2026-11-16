import { expect, test } from "@playwright/test";
import { captureExternalRequests } from "./support/network";

for (const id of [
  "modes",
  "controls",
  "scores",
  "soak",
  "completion-qong",
  "completion-skipixl",
  "completion-quantman",
  "completion-fluxball",
  "completion-quarry",
] as const) {
  test(`Arcade release: ${id}`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-1280x720",
      "Live timing and 17 repeated launches run once at the reference desktop size.",
    );
    test.setTimeout(
      id === "soak" || id === "completion-quarry" ? 300_000 : 240_000,
    );
    const external = captureExternalRequests(page, testInfo);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/tests/fixtures/release/arcade-qa.html?case=${id}`);
    await page.getByRole("button", { name: "RUN CHECKS", exact: true }).click();
    await expect(page.locator("#fixture-status")).toHaveAttribute(
      "data-state",
      /^(passed|failed)$/,
      {
        timeout:
          id === "soak" || id === "completion-quarry" ? 270_000 : 210_000,
      },
    );
    const result = page.locator(`[data-check="${id}"]`);
    await testInfo.attach(`arcade-${id}-evidence`, {
      body: (await result.textContent()) ?? "No evidence",
      contentType: "text/plain",
    });
    await page.screenshot({
      path: testInfo.outputPath(`arcade-${id}.png`),
      fullPage: true,
    });
    await expect(result, (await result.textContent()) ?? id).toHaveAttribute(
      "data-state",
      "passed",
    );
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await page
      .getByRole("button", { name: "CLEAR TEST DATA", exact: true })
      .click();
  });
}
