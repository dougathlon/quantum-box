import { expect, test } from "@playwright/test";

import {
  captureExternalRequests,
  driveVisibleTutorialControls,
  expectLiveTutorialPalette,
  expectNativeDisplay,
  expectScreenFrameFits,
  expectTutorialFrameFits,
  SPATIAL_TUTORIAL_CASES,
} from "./support/spatialTutorial";

for (const entry of SPATIAL_TUTORIAL_CASES) {
  test.skip(`${entry.gameId} spatial room completes without clipping at both release desktop sizes`, async ({
    page,
  }, testInfo) => {
    test.skip(
      !["desktop-1280x720", "desktop-1920x1080"].includes(
        testInfo.project.name,
      ),
      "The release desktop frame matrix is 1280×720 and 1920×1080.",
    );
    const externalRequests = captureExternalRequests(page, testInfo);

    await page.goto(`/?qa=${entry.route}&palette=1`);
    const tutorial = page.getByRole("region", {
      name: "Spatial recovery tutorial",
    });
    await expect(tutorial).toBeVisible({ timeout: 10_000 });
    await expect(tutorial.locator("[data-tutorial='heading']")).toHaveText(
      entry.heading,
    );
    await expectNativeDisplay(page);
    await expectTutorialFrameFits(page, tutorial);
    await expectLiveTutorialPalette(page);
    await page.screenshot({
      path: testInfo.outputPath(
        `${testInfo.project.name}-${entry.gameId}-arrival.png`,
      ),
      fullPage: true,
    });

    const inspectedPhases = new Set<string>();
    const inspectedPhaseNames = new Set([
      "DIALOGUE",
      "MECHANISM INTERACTION",
      "DEMONSTRATED UNDERSTANDING",
    ]);
    const phases = await driveVisibleTutorialControls(
      tutorial,
      entry.actions,
      async (phase) => {
        if (!inspectedPhaseNames.has(phase) || inspectedPhases.has(phase))
          return;
        inspectedPhases.add(phase);
        await expectTutorialFrameFits(page, tutorial);
        await expectLiveTutorialPalette(page);
        if (phase === "DIALOGUE") {
          const dialogue = tutorial.locator("[data-tutorial='dialogue']");
          await expect(dialogue).not.toHaveAttribute("hidden", "");
          await expect(dialogue).toHaveText(/\S/);
        }
        await page.screenshot({
          path: testInfo.outputPath(
            `${testInfo.project.name}-${entry.gameId}-${phase
              .toLowerCase()
              .replaceAll(" ", "-")}.png`,
          ),
          fullPage: true,
        });
      },
    );
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
    expect([...inspectedPhases]).toEqual(
      expect.arrayContaining([...inspectedPhaseNames]),
    );
    await expect(page.getByRole("heading", { name: "WORKSHOP" })).toBeVisible();
    await expect(tutorial).toBeHidden();
    await expectNativeDisplay(page);
    await expectScreenFrameFits(page);
    await page.screenshot({
      path: testInfo.outputPath(
        `${testInfo.project.name}-${entry.gameId}-completion.png`,
      ),
      fullPage: true,
    });
    expect(externalRequests).toEqual([]);
  });
}

test.skip("reduced motion preserves direct entry and still opens the spatial workshop", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await expect(
    page.getByRole("heading", { name: "ARCHIVE INDEX" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /SETTINGS/ }).click();
  await page.getByRole("checkbox", { name: "REDUCED MOTION" }).check();

  await page.goto("/?qa=qong-designer", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page
      .getByRole("region", { name: "Spatial recovery tutorial" })
      .locator("[data-tutorial='heading']"),
  ).toHaveText("Qong Workshop", { timeout: 250 });
  await expect(page.locator(".qb-shell")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
});
