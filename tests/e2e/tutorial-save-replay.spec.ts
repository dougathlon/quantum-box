import { expect, test, type Page } from "@playwright/test";

import { openSkiPixlSavedReplay } from "./support/savedReplay";
import {
  captureExternalRequests,
  driveVisibleTutorialControls,
  SPATIAL_TUTORIAL_CASES,
} from "./support/spatialTutorial";

const SKIPIXL_TUTORIAL = SPATIAL_TUTORIAL_CASES.find(
  ({ gameId }) => gameId === "skipixl",
);

if (!SKIPIXL_TUTORIAL) {
  throw new Error("SkiPixl spatial tutorial case is missing.");
}

test.skip("saved SkiPixl replay permits mute changes while preserving Story authority", async ({
  page,
}, testInfo) => {
  const externalRequests = captureExternalRequests(page, testInfo);
  await page.goto("/");
  await openSkiPixlSavedReplay(page);

  const tutorial = page.getByRole("region", {
    name: "Spatial recovery tutorial",
  });
  await expect(tutorial).toBeVisible();
  await expect(tutorial.locator("[data-tutorial='heading']")).toHaveText(
    SKIPIXL_TUTORIAL.heading,
  );
  await expect(tutorial.locator("[data-tutorial='evidence']")).toContainText(
    "SAVED RECOVERY REPLAY",
  );
  await expect(tutorial.locator("[data-tutorial='completion']")).toContainText(
    "STORY PROGRESS NOT GRANTED",
  );

  const before = await currentSave(page);
  await page.keyboard.press("m");
  const afterMute = await currentSave(page);
  expect(afterMute.story).toEqual(before.story);
  expect(afterMute.settings.soundMuted).toBe(!before.settings.soundMuted);

  await driveVisibleTutorialControls(tutorial, SKIPIXL_TUTORIAL.actions);
  await expect(page.getByRole("heading", { name: "WORKSHOP" })).toBeVisible();
  await expect(page.locator(".qb-status")).toContainText(
    "No Story progress was recorded",
  );
  const afterCompletion = await currentSave(page);
  expect(afterCompletion.story).toEqual(before.story);
  expect(afterCompletion.settings).toEqual(afterMute.settings);

  await page.reload();
  const reloaded = await currentSave(page);
  expect(reloaded).toEqual(afterCompletion);
  expect(externalRequests).toEqual([]);
});

test.skip("canceling a saved replay after muting preserves Story authority", async ({
  page,
}) => {
  await page.goto("/");
  await openSkiPixlSavedReplay(page);

  const before = await currentSave(page);
  await page.keyboard.press("m");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("heading", { name: "WORKSHOP" })).toBeVisible();
  await expect(page.locator(".qb-status")).toContainText(
    "No Story progress was recorded",
  );
  const after = await currentSave(page);
  expect(after.story).toEqual(before.story);
  expect(after.settings.soundMuted).toBe(!before.settings.soundMuted);
});

async function currentSave(page: Page) {
  const save = await page.evaluate(
    () => window.__QUANTUM_BOX_TEST__?.getSave() ?? null,
  );
  if (!save) throw new Error("Quantum Box test save API is unavailable.");
  return save;
}
