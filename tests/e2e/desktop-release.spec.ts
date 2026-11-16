import { expect, test } from "@playwright/test";
import { captureExternalRequests } from "./support/network";

for (const [id, label] of [
  [
    "read-ledger",
    "records read pages only after full display and preserves reload",
  ],
  [
    "archive",
    "Cleared Terminal chapters open canonical transcripts without rewriting read history",
  ],
  ["outcomes", "Story outcome choices follow success and first-failure rules"],
  [
    "old-complete",
    "old completed saves can read both Postscript pages without replay",
  ],
  [
    "retry",
    "Terminal retries show introduction and tutorial independently of the Story cursor",
  ],
] as const) {
  test(label, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === "narrow-434x720",
      "Release checks target the established desktop presentation.",
    );
    const fixtureTimeout = id === "outcomes" ? 270_000 : 150_000;
    test.setTimeout(fixtureTimeout + 30_000);
    const external = captureExternalRequests(page, testInfo);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/tests/fixtures/release/desktop-release.html?case=${id}`);
    await page.getByRole("button", { name: "RUN CHECKS", exact: true }).click();
    await expect(page.locator("#fixture-status")).toHaveAttribute(
      "data-state",
      /^(passed|failed)$/,
      { timeout: fixtureTimeout },
    );
    const result = page.locator(`[data-check="${id}"]`);
    await expect(result, (await result.textContent()) ?? label).toHaveAttribute(
      "data-state",
      "passed",
    );
    await page.screenshot({
      path: testInfo.outputPath(`desktop-release-${id}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await page
      .getByRole("button", { name: "CLEAR TEST DATA", exact: true })
      .click();
  });
}
