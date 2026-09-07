import { expect, test } from "@playwright/test";

import { captureExternalRequests } from "./support/spatialTutorial";

test("Qong preserves its final court, enacts both morphs, and leads into a walkable office terminal", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One release desktop proves the interaction and presentation contract.",
  );
  const externalRequests = captureExternalRequests(page, testInfo);

  await page.goto("/?qa=story-v2-qong&beat=0");
  const qongStory = page.locator(
    "section.qb-cabinet-ui[data-cabinet='qong-story']",
  );
  await expect(qongStory).toBeVisible();
  await expect(page.locator(".qb-canvas-host canvas")).toBeVisible();
  await expect(qongStory.locator("[data-qong-story='player']")).toBeVisible();
  await expect(qongStory.locator("[data-qong-story='designer']")).toBeVisible();
  await expect(qongStory).not.toContainText("CHANGES SHAPE");
  await expect(qongStory).not.toContainText("SPACE · CONTINUE");
  await expect(qongStory).toHaveAttribute("data-phase", "court-walk", {
    timeout: 4_000,
  });
  await expect(qongStory.getByText("WALK TO THE OPEN DOOR")).toBeVisible();

  await page.goto("/?qa=story-v2-qong&beat=5");
  const room = page.locator("section.qb-cabinet-ui[data-cabinet='qong-story']");
  await expect(room).toBeVisible();
  await expect(room).toHaveAttribute("data-scene", "office");
  await expect(room.locator(".qb-office-desk")).toBeVisible();
  await expect(room.locator(".qb-office-computer")).toBeVisible();
  await expect(room.locator(".qb-office-chair")).toBeVisible();
  await expect(room.getByRole("button", { name: /USE/ })).toBeDisabled();
  const right = room.getByRole("button", { name: "RIGHT" });
  const up = room.getByRole("button", { name: "UP" });
  for (let step = 0; step < 101; step += 1) await right.click();
  for (let step = 0; step < 30; step += 1) await up.click();
  await expect(room.getByText("COMPUTER · SPACE TO SIT")).toBeVisible();
  const use = room.getByRole("button", { name: /USE/ });
  await expect(use).toBeEnabled();
  await use.click();
  await expect(page.getByText("COIN TOSS · STEP 1/7")).toBeVisible();
  await expect(
    page.getByText("REQUEST", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("1 QUBIT")).toBeVisible();
  await expect(page.getByText("TECHNICAL RECORD")).toBeVisible();
  await expect(
    page.locator(".qb-story-terminal-technical"),
  ).not.toHaveAttribute("open", "");
  expect(externalRequests).toEqual([]);
});

test("Locked Workshop and Settings retain the Brown Box hierarchy without stacked utility clutter", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One release desktop proves the utility menu hierarchy.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await expect(page.getByRole("button", { name: /WORKSHOP/ })).toBeDisabled();
  await page.getByRole("button", { name: /SETTINGS/ }).click();
  await expect(
    page.getByRole("navigation", { name: "Settings sections" }),
  ).toBeVisible();
  await expect(page.locator("[data-settings-panel='display']")).toBeVisible();
  await expect(page.getByLabel("ADAPTIVE DIRECT", { exact: true })).toHaveCount(
    0,
  );
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
  await expect(
    page.getByRole("region", { name: "Player A bindings" }),
  ).toHaveCount(0);
});

test("the final Story reward exposes MOTH only as an explicit external action", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One release desktop proves the final-link boundary.",
  );
  await page.goto("/?qa=story-v2-quarry&beat=7");
  const link = page.getByRole("link", { name: "OPEN MOTH PLATFORM" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute(
    "href",
    "https://platform.mothquantum.com/",
  );
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    page.getByRole("button", { name: "SPACE · CONTINUE" }),
  ).toBeVisible();
  await expect(page.locator("[data-story-moth-link]")).toHaveCount(1);
});
