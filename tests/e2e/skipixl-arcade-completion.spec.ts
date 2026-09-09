import { expect, test, type Page } from "@playwright/test";

import { captureExternalRequests } from "./support/network";
import {
  createArcadeSkiPixlBrowserPlan,
  type SkiPixlSteeringTransition,
} from "./support/skipixlStory";

// Keep browser tests independent of Vite-only production modules. These public
// contract values are asserted independently by the unit suite.
const DEFAULT_ARCADE_RUN_SEED = 260_823;
const SAVE_STORAGE_KEY = "quantum-box/save-v6";

test("Arcade SkiPixl completes the production QPixl descent without Story authority", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280x720",
    "The full real-time descent needs one deterministic desktop execution.",
  );
  test.slow();

  const externalRequests = captureExternalRequests(page, testInfo);
  await page.goto("/");
  const saveBefore = await readSaveState(page);
  expect(saveBefore.snapshot).toBeDefined();
  const plan = await createArcadeSkiPixlBrowserPlan(
    page,
    DEFAULT_ARCADE_RUN_SEED,
  );

  expect(plan.expected.completedUnderLimit).toBe(true);
  expect(plan.runSeed).toBe(DEFAULT_ARCADE_RUN_SEED);
  expect(plan.packSource).toBe("moth-platform-qpu-capture");

  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /ARCADE/ }).click();
  await page
    .locator('[data-action="open-arcade-cabinet"][data-game-id="skipixl"]')
    .click();
  const launch = page
    .locator('[data-arcade-detail="skipixl"]')
    .getByRole("button", {
      name: "EASY",
      exact: true,
    });
  await expect(launch).toBeVisible();

  await launch.click();
  const startedAt = Date.now();
  const cabinet = page.getByRole("region", { name: "SkiPixl game" });
  await expect(cabinet).toBeVisible();

  let heldSteer: -1 | 0 | 1 = 0;
  try {
    await page.keyboard.down("ArrowDown");
    for (const transition of plan.transitions) {
      await waitUntilPlanOffset(page, startedAt, transition.atMs);
      heldSteer = await applySteeringTransition(page, heldSteer, transition);
    }
    await expect(page.locator("[data-ui='game']")).toHaveAttribute(
      "data-phase",
      "complete",
      {
        timeout: Math.max(
          10_000,
          plan.durationMs - (Date.now() - startedAt) + 10_000,
        ),
      },
    );
  } finally {
    await page.keyboard.up("ArrowDown");
    await releaseSteering(page, heldSteer);
  }

  await expect(cabinet.locator("[data-skipixl='distance']")).toHaveText("000");
  await expect(cabinet.locator("[data-skipixl='notice']")).toHaveText(
    "WELL DONE. LET ME SHOW YOU SOMETHING.",
  );
  await expect(
    cabinet.getByRole("button", { name: "RETRY · X" }),
  ).toBeVisible();
  await expect(
    cabinet.getByRole("button", { name: "CONTINUE · SPACE / A" }),
  ).toBeVisible();
  await expect(cabinet.getByRole("button", { name: "EXPORT RUN" })).toHaveCount(
    0,
  );
  const arcadeCompletionStatus = await page.locator(".qb-status").textContent();

  const saveAfter = await readSaveState(page);
  expect(saveAfter.snapshot?.story).toEqual(saveBefore.snapshot?.story);
  const records = saveAfter.snapshot?.arcadeRecords.skipixl.easy ?? [];
  expect(records).toHaveLength(1);
  const record = records[0];
  expect(record).toBeDefined();
  if (!record) throw new Error("Completed SkiPixl run did not write a score.");
  await expect(cabinet.locator("[data-skipixl='time']")).toHaveText(
    formatSkiPixlTime(record.officialTimeMs / 1_000),
  );
  expect(arcadeCompletionStatus).toBe(
    `Arcade descent completed on ${plan.courseLabel} in ${(record.officialTimeMs / 1_000).toFixed(2)} seconds with no Story authority.`,
  );
  expect(record.officialTimeMs).toBeLessThanOrEqual(60_000);
  expect(
    Math.abs(record.officialTimeMs - plan.expected.elapsedSeconds * 1_000),
  ).toBeLessThan(5_000);
  expect(record).toMatchObject({
    kind: "skipixl",
    difficulty: "easy",
    initials: "YOU",
    rulesVersion: "skipixl-rules-v8",
    pack: {
      packId: plan.packId,
      contentSha256: plan.packContentSha256,
      source: plan.packSource,
    },
    missedGates: plan.expected.missedGates,
    recordedSequence: 1,
  });
  expect(Number.isInteger(record.collisions)).toBe(true);
  expect(record.collisions).toBeGreaterThanOrEqual(0);
  expect(record.runId).toMatch(/^run-[0-9a-f]{8}$/);

  await cabinet
    .getByRole("button", { name: "CONTINUE · SPACE / A", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "SKIPIXL · EASY" }),
  ).toBeVisible();
  const scoreRows = page.locator(".qb-scoreboard-table ol > li");
  await expect(scoreRows).toHaveCount(5);
  await expect(scoreRows.filter({ hasText: "YOU" })).toHaveAttribute(
    "data-current",
    "true",
  );
  const initials = page.locator("[data-arcade-score-initials]");
  await expect(initials).toHaveValue("YOU");
  await page.locator("[data-initial-slot='0']").pressSequentially("SKI");
  await page.getByRole("button", { name: "SAVE · ENTER / A" }).click();
  await expect(page.getByText("SCORE RECORDED", { exact: true })).toBeVisible();
  await expect(initials).toHaveCount(0);
  await expect(scoreRows.filter({ hasText: "SKI" })).toHaveAttribute(
    "data-current",
    "true",
  );
  const savedInitials = await readSaveState(page);
  expect(savedInitials.snapshot?.settings.arcadeInitials).toBe("SKI");
  expect(savedInitials.snapshot?.arcadeRecords.skipixl.easy[0]?.initials).toBe(
    "SKI",
  );
  expect(externalRequests).toEqual([]);
});

async function waitUntilPlanOffset(
  page: Page,
  startedAt: number,
  offsetMs: number,
): Promise<void> {
  const remainingMs = startedAt + offsetMs - Date.now();
  if (remainingMs > 0) await page.waitForTimeout(remainingMs);
}

async function applySteeringTransition(
  page: Page,
  current: -1 | 0 | 1,
  transition: SkiPixlSteeringTransition,
): Promise<-1 | 0 | 1> {
  await releaseSteering(page, current);
  if (transition.steer === -1) await page.keyboard.down("a");
  if (transition.steer === 1) await page.keyboard.down("d");
  return transition.steer;
}

async function releaseSteering(page: Page, steer: -1 | 0 | 1): Promise<void> {
  if (steer === -1) await page.keyboard.up("a");
  if (steer === 1) await page.keyboard.up("d");
}

function formatSkiPixlTime(elapsedSeconds: number): string {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = (elapsedSeconds - minutes * 60).toFixed(2).padStart(5, "0");
  return `${minutes}:${seconds}`;
}

async function readSaveState(page: Page) {
  return page.evaluate(
    (storageKey) => ({
      snapshot: window.__QUANTUM_BOX_TEST__?.getSave(),
      serialized: localStorage.getItem(storageKey),
    }),
    SAVE_STORAGE_KEY,
  );
}
