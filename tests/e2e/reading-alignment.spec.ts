import { expect, test, type Page } from "@playwright/test";

async function checkReadingChoices(page: Page) {
  const choices = page
    .locator("button:visible")
    .filter({ has: page.locator(".qb-reading-choice") });
  const direct = page.locator("button.qb-reading-choice:visible");
  for (const collection of [choices, direct]) {
    for (let i = 0; i < (await collection.count()); i++) {
      const button = collection.nth(i);
      if (!(await button.isEnabled())) continue;
      await button.focus();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const report = await button.evaluate((control) => {
        const frame = document
          .querySelector(".qb-screen-frame")!
          .getBoundingClientRect();
        const anchor = control.matches("[data-bitmap-flow]")
          ? control
          : control.querySelector("[data-bitmap-flow]")!;
        const box = control.getBoundingClientRect(),
          text = anchor.getBoundingClientRect();
        const scale = frame.width / 320;
        const x = Math.floor((box.left - frame.left) / scale) - 3;
        const top = Math.round((text.top - frame.top) / scale);
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-ui="bitmap-text"]',
        )!;
        const c = canvas.getContext("2d")!;
        const cream = (y: number) => {
          const p = c.getImageData(x * 2, y * 2, 1, 1).data;
          return p[0] === 214 && p[1] === 189 && p[2] === 139 && p[3] === 255;
        };
        const inkAligned =
          x < 0 || [1, 2, 3, 4, 5].every((d) => cream(top + d));
        return {
          inkAligned,
          textFits:
            text.bottom <= box.bottom + 1 &&
            text.left >= box.left - 1 &&
            text.right <= box.right + 1,
          audit: canvas.dataset["explicitTextFitAudit"],
        };
      });
      expect(report, (await button.textContent()) ?? "").toEqual({
        inkAligned: true,
        textFits: true,
        audit: "pass",
      });
    }
  }
}

test("reading choices align their selectors and fit in every menu", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await checkReadingChoices(page);
  await page.getByRole("button", { name: "STORY", exact: true }).click();
  await checkReadingChoices(page);
  await page
    .getByRole("button", { name: "BACK · ESC / B", exact: true })
    .click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await checkReadingChoices(page);
  for (const game of ["qong", "skipixl", "quantman", "fluxball", "quarry"]) {
    await page
      .locator(`[data-action="open-arcade-cabinet"][data-game-id="${game}"]`)
      .click();
    await checkReadingChoices(page);
    await page
      .getByRole("button", { name: "BACK · ESC / B", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "BACK · ESC / B", exact: true })
    .click();
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  for (const section of ["display", "background", "controls", "data"]) {
    await page
      .locator(
        `[data-action="settings-section"][data-settings-section="${section}"]`,
      )
      .click();
    await checkReadingChoices(page);
  }
  await expect(page.locator(".qb-settings-data .qb-action").first()).toHaveCSS(
    "border-bottom-style",
    "dotted",
  );
});

test("Terminal and Arcade share number and title columns", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  const arcade = await page
    .locator(".qb-arcade-select-row")
    .first()
    .evaluate((row) => ({
      number: row
        .querySelector(".qb-arcade-select-number")!
        .getBoundingClientRect().left,
      title: row.querySelector("strong")!.getBoundingClientRect().left,
    }));
  await page
    .getByRole("button", { name: "BACK · ESC / B", exact: true })
    .click();
  await page.getByRole("button", { name: "TERMINAL", exact: true }).click();
  for (const row of await page.locator(".qb-terminal-index li").all()) {
    const terminal = await row.evaluate((el) => ({
      number: el.querySelector("span")!.getBoundingClientRect().left,
      title: el.querySelector("strong")!.getBoundingClientRect().left,
    }));
    expect(terminal).toEqual(arcade);
  }
});

test("WASD navigates Settings inputs exactly like arrows", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await page.locator('[data-settings-section="background"]').click();
  const radios = page.locator('.qb-settings-panel input[type="radio"]');
  await radios.first().focus();
  await page.keyboard.press("KeyS");
  await expect(radios.nth(1)).toBeFocused();
  await page.keyboard.press("KeyW");
  await expect(radios.first()).toBeFocused();
  for (const [letter, arrow] of [
    ["KeyA", "ArrowLeft"],
    ["KeyD", "ArrowRight"],
  ]) {
    await radios.first().focus();
    await page.keyboard.press(letter!);
    const letterTarget = await page.evaluate(
      () => document.activeElement?.outerHTML,
    );
    await radios.first().focus();
    await page.keyboard.press(arrow!);
    expect(await page.evaluate(() => document.activeElement?.outerHTML)).toBe(
      letterTarget,
    );
  }
  await radios.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(radios.nth(1)).toBeFocused();
});

test("right footer cursor follows its painted label", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START", exact: true }).click();
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  const footer = page.locator('[data-action="activate-page-control"]');
  await footer.focus();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const gap = await footer.evaluate((el) => {
    const frame = document
      .querySelector(".qb-screen-frame")!
      .getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const scale = frame.width / 320;
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-ui="bitmap-text"]',
    )!;
    const ctx = canvas.getContext("2d")!;
    const y = Math.round((box.top + box.height / 2 - frame.top) / scale);
    const start = Math.ceil((box.left - frame.left) / scale);
    const end = Math.floor((box.right - frame.left) / scale);
    const ink: number[] = [];
    for (let x = start; x < end; x++) {
      const p = ctx.getImageData(x * 2, y * 2, 1, 1).data;
      if (p[0] === 214 && p[1] === 189 && p[2] === 139 && p[3] === 255)
        ink.push(x);
    }
    return ink[0]! - start;
  });
  expect(gap).toBeGreaterThan(20);
});
