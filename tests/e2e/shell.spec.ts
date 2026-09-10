import { expect, test, type Page } from "@playwright/test";

const E2E_ORIGIN = `http://127.0.0.1:${process.env["QUANTUM_BOX_E2E_PORT"] ?? "4390"}`;

async function enterArcade(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
}

async function openArcadeCabinet(page: Page, gameId: string) {
  await page
    .locator(`[data-action="open-arcade-cabinet"][data-game-id="${gameId}"]`)
    .click();
  return page.locator(`[data-arcade-detail="${gameId}"]`);
}

test("title enters the internal archive and exposes the four current channels", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== E2E_ORIGIN) externalRequests.push(request.url());
  });

  await page.goto("/");
  const start = page.getByRole("button", { name: "PRESS START" });
  const titleField = page.locator(".qb-title-field-surface");
  await expect(start).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quantum Box" }),
  ).toBeAttached();
  await expect(titleField).toHaveAttribute(
    "data-field-programme",
    "current-four-state-v1",
  );
  const titlePixelScale = await titleField.getAttribute(
    "data-field-pixel-scale",
  );
  expect(titlePixelScale).toMatch(/^[1-9]\d*$/u);
  await start.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator(".qb-shell")).toHaveAttribute(
    "data-surface",
    "internal",
  );
  await expect(
    page.getByRole("heading", { name: "ARCHIVE INDEX" }),
  ).toBeVisible();
  await expect(page.locator(".qb-field-surface")).toHaveAttribute(
    "data-field-pixel-scale",
    titlePixelScale!,
  );
  for (const channel of ["STORY", "ARCADE", "TERMINAL", "SETTINGS"]) {
    await expect(
      page.getByRole("button", { name: channel, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByText("WORKSHOP", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "STORY" })).toBeFocused();
  expect(externalRequests).toEqual([]);
});

test("Space enters the archive and Enter opens the Story session menu", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "STORY" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "NEW STORY", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "CONTINUE", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-terminal-page="intro-1"]')).toBeVisible();
  await expect(page.locator(".qb-story-select")).toHaveCount(0);
});

test("main menu numbers and labels share the reading baseline", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  const rows = page.locator(".qb-primary-menu-row");
  await expect(rows).toHaveCount(4);
  for (let index = 0; index < 4; index++) {
    const row = rows.nth(index);
    await expect(row.locator("span")).toHaveAttribute("data-bitmap-flow", "");
    await expect(row.locator("strong")).toHaveAttribute("data-bitmap-flow", "");
    const number = await row.locator("span").boundingBox();
    const label = await row.locator("strong").boundingBox();
    expect(Math.abs(number!.y - label!.y)).toBeLessThanOrEqual(1);
  }
});

test("Arcade overview contains five cabinets and every cabinet opens a terminal-style detail page", async ({
  page,
}) => {
  await enterArcade(page);
  const rows = page.locator(".qb-arcade-select-row");
  await expect(rows).toHaveCount(5);
  await expect(page.locator(".qb-arcade-select-status")).toHaveCount(0);
  for (let index = 0; index < 5; index++) {
    await expect(rows.nth(index).locator("strong")).toHaveAttribute(
      "data-bitmap-flow",
      "",
    );
    await expect(
      rows.nth(index).locator(".qb-arcade-select-number"),
    ).toHaveAttribute("data-bitmap-flow", "");
  }

  for (const [gameId, title, engineId] of [
    ["qong", "QONG", "COIN-TOSS-V1"],
    ["skipixl", "SKIPIXL", "QPIXL-V1"],
    ["fluxball", "FLUXBALL", "GRAPH-V1"],
    ["quantman", "QUANTMAN", "LABYRINTH-V1"],
    ["quarry", "QUARRY", "GRAPH-V1"],
  ] as const) {
    const detail = await openArcadeCabinet(page, gameId);
    await expect(detail.getByRole("heading", { name: title })).toBeVisible();
    await expect(detail).toContainText(engineId);
    await expect(detail.locator(".qb-arcade-tutorial p")).not.toHaveCount(0);
    await expect(detail.locator(".qb-tutorial-pagination")).toHaveCount(0);
    await expect(detail.locator(".qb-terminal-top-rule")).toHaveCount(1);
    await expect(detail.locator(".qb-terminal-bottom-rule")).toHaveCount(0);
    const titleBox = await detail
      .getByRole("heading", { name: title })
      .boundingBox();
    const previewBox = await detail.locator(".qb-arcade-preview").boundingBox();
    expect(titleBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(titleBox!.x).toBeLessThan(previewBox!.x);
    const back = detail.getByRole("button", {
      name: "BACK · ESC / B",
      exact: true,
    });
    await expect(back).toHaveText("ESC / B");
    await expect(
      detail.getByRole("button", { name: "SELECT · ENTER / A", exact: true }),
    ).toBeEnabled();
    await back.click();
  }
});

test("Arcade score and mode controls use the intended row hierarchy", async ({
  page,
}) => {
  await enterArcade(page);
  for (const [cabinet, expectedModes] of [
    ["skipixl", 3],
    ["quantman", 2],
  ] as const) {
    const detail = await openArcadeCabinet(page, cabinet);
    const modes = detail.locator(".qb-arcade-mode");
    await expect(modes).toHaveCount(expectedModes);
    for (let index = 0; index < expectedModes; index += 1) {
      const mode = modes.nth(index);
      const launchBox = await mode
        .locator(":scope > button[data-action='launch-arcade']")
        .boundingBox();
      const scoreBox = await mode
        .locator(":scope > button[data-action='open-arcade-scores']")
        .boundingBox();
      expect(launchBox).not.toBeNull();
      expect(scoreBox).not.toBeNull();
      expect(scoreBox!.y).toBeGreaterThanOrEqual(
        launchBox!.y + launchBox!.height,
      );
      expect(Math.abs(scoreBox!.x - launchBox!.x)).toBeLessThan(4);
    }
    await detail
      .getByRole("button", { name: "BACK · ESC / B", exact: true })
      .click();
  }

  for (const cabinet of ["fluxball", "quarry"] as const) {
    const detail = await openArcadeCabinet(page, cabinet);
    const modes = detail.locator(".qb-arcade-mode");
    await expect(modes).toHaveCount(4);
    for (const [upper, lower] of [
      [0, 2],
      [1, 3],
    ] as const) {
      const upperBox = await modes.nth(upper).boundingBox();
      const lowerBox = await modes.nth(lower).boundingBox();
      expect(upperBox).not.toBeNull();
      expect(lowerBox).not.toBeNull();
      expect(Math.abs(upperBox!.x - lowerBox!.x)).toBeLessThan(4);
      expect(lowerBox!.y).toBeGreaterThan(upperBox!.y);
    }
    await detail
      .getByRole("button", { name: "BACK · ESC / B", exact: true })
      .click();
  }
});

test("score controls always open a complete five-place board", async ({
  page,
}) => {
  await enterArcade(page);
  const skipixl = await openArcadeCabinet(page, "skipixl");
  await skipixl
    .locator(".qb-arcade-mode")
    .first()
    .getByRole("button", { name: "SCORES" })
    .click();
  await expect(
    page.getByRole("heading", { name: "SKIPIXL · EASY" }),
  ).toBeVisible();
  await expect(page.getByText("TOP FIVE", { exact: true })).toBeVisible();
  await expect(page.locator(".qb-scoreboard-table ol > li")).toHaveCount(5);
  await expect(page.getByText("NO SCORES", { exact: true })).toHaveCount(0);
});

test("Qong Arcade is playable without mutating Story authority", async ({
  page,
}) => {
  await enterArcade(page);
  const saveBefore = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  const detail = await openArcadeCabinet(page, "qong");
  await detail.getByRole("button", { name: "PLAYER / CPU" }).click();
  const game = page.getByRole("region", { name: "Qong game" });
  await expect(game).toBeVisible();
  await expect(game).toContainText("RULE STATE: UNRESOLVED");
  await expect(game).toContainText("OBS 3");
  await game.getByRole("button", { name: "BACK · ESC / B" }).click();
  expect(
    await page.evaluate(() => window.__QUANTUM_BOX_TEST__?.getSave()),
  ).toEqual(saveBefore);
});

test("SkiPixl and Quantman expose their installed modes without a maze selector", async ({
  page,
}) => {
  await enterArcade(page);
  const skipixl = await openArcadeCabinet(page, "skipixl");
  await expect(skipixl.locator("[data-action='launch-arcade']")).toHaveText([
    "EASY",
    "MEDIUM",
    "HARD",
  ]);
  await skipixl
    .getByRole("button", { name: "BACK · ESC / B", exact: true })
    .click();
  const quantman = await openArcadeCabinet(page, "quantman");
  await expect(quantman.locator("[data-action='launch-arcade']")).toHaveText([
    "HOLD",
    "INVERT",
  ]);
  await expect(
    quantman.getByRole("combobox", { name: "Quantman maze course" }),
  ).toHaveCount(0);
});

test("Fluxball uses four 40-second rounds and keeps hidden rule authority out of active DOM", async ({
  page,
}) => {
  await enterArcade(page);
  await openArcadeCabinet(page, "fluxball");
  for (const mode of [
    "2P SHARED",
    "2P SPLIT",
    "4P SHARED",
    "4P SPLIT",
  ] as const) {
    await page.getByRole("button", { name: mode }).click();
    await page.getByRole("button", { name: "START · ENTER / A" }).click();
    const game = page.getByRole("region", { name: "Fluxball game" });
    await expect(game).toBeVisible();
    await expect(game).toContainText("R 1/4");
    await expect(game).toContainText("40");
    await expect(game).toContainText("PRESS SPACE / A TO CHANGE RULES");
    await expect(game).not.toContainText(
      /\bDIRECT\b|\bINVERTED\b|\bCARRY\b|\bSTRIKE\b|\bOPPOSITE\b|\bOWN\b|\bFIXTURE\b/u,
    );
    await game.getByRole("button", { name: "BACK · ESC / B" }).click();
  }
});

test("Settings persist sound and motion and omit obsolete default initials", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "SETTINGS" }).click();
  await expect(page.getByText("DEFAULT INITIALS", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("REDUCED MOTION").check();
  await page.getByLabel("Sound level").fill("0.6");

  await page.getByRole("button", { name: "02 FIELD" }).click();
  await expect(page.getByText("BACKGROUND FIELD", { exact: true })).toHaveCount(
    1,
  );
  await expect(page.locator(".qb-background-summary strong")).toHaveText(
    "STANDARD",
  );
  await page.getByRole("button", { name: "03 CONTROLS" }).click();
  await expect(
    page.getByText(
      "SYSTEM KEYS CANNOT BE REBOUND. EACH CONTROL NEEDS ITS OWN KEY.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "SETTINGS" }).click();
  await expect(page.getByLabel("Arcade scoreboard initials")).toHaveCount(0);
  await expect(page.getByLabel("REDUCED MOTION")).toBeChecked();
  await expect(page.getByLabel("Sound level")).toHaveValue("0.6");
});
