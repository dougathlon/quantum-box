import { expect, type Page, test } from "@playwright/test";

interface LivePaletteReport {
  readonly schemaVersion: "quantum-box-live-palette-audit-v1";
  readonly surface: {
    readonly page: string | null;
    readonly view: string | null;
    readonly cabinet: string | null;
  };
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly logicalResolutionMatches: boolean;
    readonly colours: readonly Readonly<{
      readonly rgba: readonly [number, number, number, number];
      readonly count: number;
    }>[];
    readonly unexpectedColours: readonly unknown[];
    readonly passed: boolean;
  };
  readonly dom: {
    readonly violations: readonly unknown[];
    readonly passed: boolean;
  };
  readonly passed: boolean;
}

test("the live menu and every Arcade cabinet render inside the exact Brown Box palette", async ({
  page,
}) => {
  await page.goto("/?qa=palette-audit");

  await expect(
    page.getByRole("heading", { name: "ARCHIVE INDEX" }),
  ).toBeVisible();
  await assertCurrentSurface(page, { page: "main", cabinet: null });

  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await assertCurrentSurface(page, { page: "arcade", cabinet: null });

  for (const cabinet of [
    { button: "PLAYER / CPU", id: "qong", region: "Qong game" },
    { button: "EASY", id: "skipixl", region: "SkiPixl game" },
    { button: "2P SHARED", id: "fluxball", region: "Fluxball game" },
    {
      button: "HOLD",
      id: "quantman",
      region: "Quantman QPU-derived gaze maze",
    },
    {
      button: "1 PLAYER",
      id: "quarry",
      region: "Quarry directed aerial hunt arena",
    },
  ] as const) {
    await page
      .locator(
        `[data-action="open-arcade-cabinet"][data-game-id="${cabinet.id}"]`,
      )
      .click();
    await assertCurrentSurface(page, { page: "arcade-detail", cabinet: null });
    await page
      .getByRole("button", { name: cabinet.button, exact: true })
      .click();
    if (cabinet.id === "fluxball") {
      await page.getByRole("button", { name: "START · ENTER / A" }).click();
    }
    await expect(
      page.getByRole("region", { name: cabinet.region }),
    ).toBeVisible();
    await assertCurrentSurface(page, {
      page: "arcade-detail",
      cabinet: cabinet.id === "quarry" ? "quag" : cabinet.id,
    });
    await page
      .getByRole("button", { name: "BACK · ESC / B", exact: true })
      .click();
    await assertCurrentSurface(page, {
      page: "arcade-detail",
      cabinet: null,
    });
    await page
      .getByRole("button", { name: "BACK · ESC / B", exact: true })
      .click();
    await assertCurrentSurface(page, { page: "arcade", cabinet: null });
  }
});

async function assertCurrentSurface(
  page: Page,
  expected: { readonly page: string; readonly cabinet: string | null },
): Promise<void> {
  const output = page.locator("[data-qa-brown-box-palette]");
  await expect(output).toBeAttached();
  await expect
    .poll(async () => {
      const text = await output.textContent();
      if (!text) return null;
      const report = JSON.parse(text) as LivePaletteReport;
      return {
        page: report.surface?.page ?? null,
        cabinet: report.surface?.cabinet ?? null,
      };
    })
    .toEqual(expected);

  const report = JSON.parse(
    (await output.textContent()) ?? "{}",
  ) as LivePaletteReport;
  expect(report.schemaVersion).toBe("quantum-box-live-palette-audit-v1");
  expect(report.canvas).toMatchObject({
    width: 320,
    height: 180,
    logicalResolutionMatches: true,
    unexpectedColours: [],
    passed: true,
  });
  const canvasColours = report.canvas.colours.map(({ rgba }) => rgba.join(","));
  const allowedColours = new Set([
    "0,0,0,0",
    "43,28,20,255",
    "86,67,48,255",
    "214,189,139,255",
  ]);
  expect(canvasColours.every((colour) => allowedColours.has(colour))).toBe(
    true,
  );
  if (expected.cabinet !== null) {
    expect(canvasColours.some((colour) => colour !== "0,0,0,0")).toBe(true);
  }
  expect(report.dom).toMatchObject({ violations: [], passed: true });
  expect(report.passed).toBe(true);
}
