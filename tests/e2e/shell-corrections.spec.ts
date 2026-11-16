import { expect, test } from "@playwright/test";
import { captureExternalRequests } from "./support/network";

test("Arcade, scores, initials and adjacent screens render correctly at six desktop sizes", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.endsWith("1280x720"),
    "Fixture supplies its own six viewport sizes.",
  );
  test.setTimeout(180_000);
  const external = captureExternalRequests(page, testInfo);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tests/fixtures/release/shell-corrections.html");
  await page.getByRole("button", { name: "RUN CHECKS", exact: true }).click();
  await expect(page.locator("#fixture-status")).toHaveAttribute(
    "data-state",
    /^(passed|failed)$/,
    { timeout: 150_000 },
  );
  await expect(page.locator("#fixture-status")).toHaveAttribute(
    "data-state",
    "passed",
  );
  await expect(page.locator("#fixture-results li")).toHaveCount(84);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("shell-corrections.png"),
    fullPage: true,
  });
});
