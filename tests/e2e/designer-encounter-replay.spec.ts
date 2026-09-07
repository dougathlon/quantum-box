import { expect, test } from "@playwright/test";

import {
  captureExternalRequests,
  driveVisibleTutorialControls,
  expectNativeDisplay,
  SPATIAL_TUTORIAL_CASES,
} from "./support/spatialTutorial";

for (const entry of SPATIAL_TUTORIAL_CASES) {
  test.skip(`${entry.gameId} spatial tutorial is interactive and development evidence stays non-authoritative`, async ({
    page,
  }, testInfo) => {
    const externalRequests = captureExternalRequests(page, testInfo);

    await page.goto(`/?qa=${entry.route}`);
    const tutorial = page.getByRole("region", {
      name: "Spatial recovery tutorial",
    });
    await expect(tutorial).toBeVisible({ timeout: 10_000 });
    await expect(tutorial.locator("[data-tutorial='heading']")).toHaveText(
      entry.heading,
    );
    await expect(tutorial.locator("[data-tutorial='phase']")).toHaveText(
      "APPROACH",
    );
    await expect(tutorial.locator("[data-tutorial='evidence']")).toContainText(
      "DEVELOPMENT FIXTURE · NO STORY PROGRESS",
    );
    await expect(page.locator("[data-ui='game']")).toHaveAttribute(
      "data-cabinet",
      "tutorial-world",
    );
    await expectNativeDisplay(page);

    const before = await page.evaluate(
      () => window.__QUANTUM_BOX_TEST__?.getSave() ?? null,
    );
    expect(before).not.toBeNull();
    if (entry.gameId === "qong") await page.keyboard.press("m");

    const phases = await driveVisibleTutorialControls(tutorial, entry.actions);
    expect(phases).toEqual(
      expect.arrayContaining([
        "DIALOGUE",
        "SPATIAL EXPLORATION",
        "MECHANISM INTERACTION",
        "DEMONSTRATED UNDERSTANDING",
      ]),
    );
    if (entry.hasTrueMorph) expect(phases).toContain("TRUE MORPH");
    else expect(phases).not.toContain("TRUE MORPH");

    await expect(page.getByRole("heading", { name: "WORKSHOP" })).toBeVisible();
    await expect(page.locator(".qb-status")).toContainText(
      "No Story progress was recorded",
    );
    const after = await page.evaluate(
      () => window.__QUANTUM_BOX_TEST__?.getSave() ?? null,
    );
    if (entry.gameId === "qong") {
      expect(after?.story).toEqual(before?.story);
      expect(after?.settings.soundMuted).toBe(!before?.settings.soundMuted);
    } else {
      expect(after).toEqual(before);
    }
    expect(externalRequests).toEqual([]);
  });
}
