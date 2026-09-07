import { expect, test } from "@playwright/test";

test("Reduced Motion freezes title and internal fields on state one", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One desktop execution proves the shared reduced-motion state.",
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "quantum-box/save-v1",
      JSON.stringify({
        schemaVersion: "quantum-box-save-v1",
        story: {
          currentStage: "qong",
          completedStages: [],
          recoveredFormulae: [],
          attempts: {},
        },
        settings: {
          reducedMotion: true,
          crtFlicker: false,
          soundMuted: true,
        },
      }),
    );
  });

  await page.goto("/");
  const titleField = page.locator(".qb-title-field-surface");
  await expect(titleField).toHaveAttribute("data-field-state", "state-1");
  await expect(titleField).toHaveAttribute("data-field-boundary", "0");
  await expect(titleField).toHaveAttribute(
    "data-field-following-state",
    "state-2",
  );
  await page.waitForTimeout(5_800);
  await expect(titleField).toHaveAttribute("data-field-state", "state-1");

  await page.getByRole("button", { name: "PRESS START" }).click();
  const internalField = page.locator(".qb-field-surface");
  await expect(internalField).toHaveAttribute("data-field-state", "state-1");
  await expect(internalField).toHaveAttribute("data-field-boundary", "0");
  await expect(internalField).toHaveAttribute(
    "data-field-following-state",
    "state-2",
  );
});

test("switching programmes keeps hidden title and internal fields on one epoch", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "One desktop execution proves the shared programme epoch.",
  );

  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "SETTINGS" }).click();
  await page.getByRole("button", { name: "02 FIELD" }).click();
  await page.getByLabel("ADAPTIVE DIRECT", { exact: true }).click();

  const fields = page.locator(".qb-title-field-surface, .qb-field-surface");
  await expect(fields).toHaveCount(2);
  await expect
    .poll(async () => {
      const snapshots = await fields.evaluateAll((elements) =>
        elements.map((element) => ({
          programme: element.getAttribute("data-field-programme"),
          epoch: element.getAttribute("data-field-epoch"),
          tick: element.getAttribute("data-field-tick"),
          state: element.getAttribute("data-field-state"),
          following: element.getAttribute("data-field-following-state"),
          sourceBoundary: element.getAttribute("data-field-source-boundary"),
        })),
      );
      return snapshots[0]?.programme === "adaptive-direct-v1" &&
        snapshots[0]?.epoch === snapshots[1]?.epoch &&
        snapshots[0]?.tick === snapshots[1]?.tick &&
        snapshots[0]?.state === snapshots[1]?.state &&
        snapshots[0]?.following === snapshots[1]?.following &&
        snapshots[0]?.sourceBoundary === snapshots[1]?.sourceBoundary
        ? true
        : false;
    })
    .toBe(true);
});
