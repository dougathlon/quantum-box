import { expect, test } from "@playwright/test";
import { captureExternalRequests } from "./support/network";

test("Terminal correction flows preserve main Story and qualify isolated test wins", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "narrow-434x720",
    "Desktop release only.",
  );
  test.setTimeout(180_000);
  const external = captureExternalRequests(page, testInfo);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tests/fixtures/release/story-correction-flow.html");
  await page.getByRole("button", { name: "RUN CHECKS", exact: true }).click();
  await expect(page.locator("#fixture-status")).toHaveAttribute(
    "data-state",
    /^(passed|failed)$/,
    { timeout: 150_000 },
  );
  for (const id of [
    "qong-failures",
    "qong-win",
    "skipixl-partial",
    "fluxball-partial",
  ]) {
    const result = page.locator(`[data-check='${id}']`);
    await expect(result, (await result.textContent()) ?? id).toHaveAttribute(
      "data-state",
      "passed",
    );
  }
  await page.screenshot({
    path: testInfo.outputPath("story-correction-flow.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page
    .getByRole("button", { name: "CLEAR TEST DATA", exact: true })
    .click();
});

test("All cabinets retain final results before Story choices or Arcade replay", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "narrow-434x720",
    "Desktop release only.",
  );
  test.setTimeout(240_000);
  const external = captureExternalRequests(page, testInfo);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tests/fixtures/release/cabinet-outcomes.html");
  await page.getByRole("button", { name: "RUN CHECKS", exact: true }).click();
  const status = page.locator("#fixture-status");
  await expect(status).toHaveAttribute("data-state", /^(passed|failed)$/, {
    timeout: 210_000,
  });
  await expect(
    status,
    await page.locator("#fixture-results").innerText(),
  ).toHaveText("PASSED: 32/32");
  await expect(
    page.locator("#fixture-results [data-state='passed']"),
  ).toHaveCount(32);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
