import { expect, test, type Page } from "@playwright/test";

const E2E_ORIGIN = `http://127.0.0.1:${process.env["QUANTUM_BOX_E2E_PORT"] ?? "4390"}`;

async function openArcadeCabinet(page: Page, gameId: string) {
  await page
    .locator(`[data-action="open-arcade-cabinet"][data-game-id="${gameId}"]`)
    .click();
  return page.locator(`[data-arcade-detail="${gameId}"]`);
}

async function installLegacyFormulaAccess(
  page: Page,
  recoveredFormulae: readonly string[],
): Promise<void> {
  await page.addInitScript((formulae) => {
    localStorage.setItem(
      "quantum-box/save-v1",
      JSON.stringify({
        schemaVersion: "quantum-box-save-v1",
        story: {
          currentStage: "qong",
          completedStages: [],
          recoveredFormulae: formulae,
          attempts: {},
        },
        settings: {
          reducedMotion: true,
          crtFlicker: false,
          soundMuted: true,
        },
      }),
    );
  }, recoveredFormulae);
}

function designerFixture() {
  const packHash = "d".repeat(64);
  const selectorHash = "e".repeat(64);
  const pack = {
    schemaVersion: "quantum-box-pack-v1",
    packSchemaVersion: "quantum-box-qong-play-pack-v1",
    packId: "qong-e2e-qpu-play-01",
    gameId: "qong",
    engineId: "coin-toss-v1",
    source: "moth-api-qpu",
    contentSha256: packHash,
    rulesVersion: "qong-rules-v1",
    warnings: ["E2E FIXTURE ONLY · NO PROVIDER CLAIM"],
    mothEvidence: null,
    payload: {
      directProbability: 4 / 7,
      rallyPolarities: [
        "direct",
        "invert",
        "direct",
        "invert",
        "direct",
        "invert",
        "direct",
      ],
    },
    qpuProvenance: {
      acquisitionClass: "moth-acquired",
      engineUpdatedAt: "2026-08-27T00:00:00Z",
      canonicalEngineRecordSha256: "b".repeat(64),
      apiSpecificationCanonicalSha256: "c".repeat(64),
      acquiredAt: "2026-08-27T00:05:00Z",
      adapterVersion: "qong-coin-bank-adapter-v1",
      resultContract: "single-formatted-outcome-per-job-v1",
      jobs: Array.from({ length: 7 }, (_, index) => {
        const heads = index % 2 === 0;
        return {
          itemId: `r${String(index + 1).padStart(2, "0")}`,
          mothJobId: `e2e-moth-${index}`,
          hardwareJobId: `e2e-hardware-${index}`,
          backendName: "e2e_qpu_fixture",
          executionMode: "qpu",
          shots: 1,
          heads: heads ? 1 : 0,
          tails: heads ? 0 : 1,
          outcome: heads ? "heads" : "tails",
          requestSha256: "a".repeat(64),
          rawResultSha256: index.toString(16).padStart(64, "0"),
        };
      }),
    },
  };
  return {
    pack,
    receipt: {
      schemaVersion: "quantum-box-qong-selection-receipt-v1",
      bankId: "qong-e2e-bank",
      bankContentSha256: "f".repeat(64),
      selectorPackId: "qong-e2e-selector",
      selectorContentSha256: selectorHash,
      selectionMethod: "two-recorded-bits-to-four-pack-index-v1",
      selectorCursorBefore: 0,
      selectorCursorAfter: 2,
      selectorCycle: 0,
      selectorCycleAfter: 0,
      selectorBitIndices: [0, 1],
      selectorBits: [0, 0],
      selectedPackIndex: 0,
      selectedPackId: pack.packId,
      selectedPackContentSha256: packHash,
      reusedSelectorBits: false,
    },
  };
}

test("title enters the internal archive and exposes every channel", async ({
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
  await expect(titleField).toHaveAttribute(
    "data-field-programme",
    "current-four-state-v1",
  );
  await expect(titleField).toHaveAttribute(
    "data-field-pixel-scale",
    /^[1-9]\d*$/,
  );
  const titlePixelScale = await titleField.getAttribute(
    "data-field-pixel-scale",
  );
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator(".qb-shell")).toHaveAttribute(
    "data-surface",
    "internal",
  );
  await expect(page.locator(".qb-title")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "ARCHIVE INDEX" }),
  ).toBeVisible();
  const internalField = page.locator(".qb-field-surface");
  await expect(internalField).toHaveAttribute(
    "data-field-programme",
    "current-four-state-v1",
  );
  await expect(internalField).toHaveAttribute(
    "data-field-pixel-scale",
    titlePixelScale!,
  );
  for (const channel of ["STORY", "ARCADE", "WORKSHOP", "SETTINGS"]) {
    await expect(
      page.getByRole("button", { name: new RegExp(channel) }),
    ).toBeVisible();
  }
  for (const removed of ["RECOVER", "PLAY", "FORMULA", "LOCAL"]) {
    await expect(
      page.locator(".qb-index").getByText(removed, { exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "ARCADE", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("button", { name: /CREDITS/ })).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});

test("Space enters the archive and the default Arcade route activates from the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "ARCADE", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.locator('[data-action="open-arcade-cabinet"][data-game-id="qong"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-action="open-arcade-cabinet"][data-game-id="qong"]'),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "PLAYER / CPU", exact: true }),
  ).toBeFocused();
});

test("launch and Arcade previews stay inside the fixed Brown Box palette", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();

  const launchPalette = await page.locator(".qb-shell").evaluate((shell) => {
    const style = getComputedStyle(shell);
    return {
      dark: style.getPropertyValue("--qb-charcoal").trim(),
      tan: style.getPropertyValue("--qb-muted-tan").trim(),
      cream: style.getPropertyValue("--qb-cream").trim(),
    };
  });
  expect(launchPalette).toEqual({
    dark: "#2b1c14",
    tan: "#564330",
    cream: "#d6bd8b",
  });

  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  const previewStyles = await page
    .locator(".qb-arcade-preview")
    .evaluateAll((previews) =>
      previews.map((preview) => ({
        className: preview.className,
        backgroundColor: getComputedStyle(preview).backgroundColor,
        backgroundImage: getComputedStyle(preview).backgroundImage,
      })),
    );
  expect(previewStyles).toHaveLength(5);
  expect(previewStyles).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        className: expect.stringContaining("qb-arcade-preview--skipixl"),
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "none",
      }),
      expect.objectContaining({
        className: expect.stringContaining("qb-arcade-preview--quantman"),
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "none",
      }),
    ]),
  );
});

test("Story reuses the five canonical Arcade thumbnails and Arcade stays visually reduced", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "STORY", exact: true }).click();

  await expect(
    page.locator(".qb-story-select-row .qb-arcade-preview"),
  ).toHaveCount(5);
  await expect(page.locator(".qb-story-select > h1")).toHaveClass(
    "qb-visually-hidden",
  );
  await expect(page.locator(".qb-story-select > header")).toHaveCount(0);
  await expect(page.getByText("GAME LIBRARY")).toHaveCount(0);
  await expect(
    page.getByText(
      /MOTH COIN TOSS QPU BANK|IBM FEZ QPIXL PACK|LOCAL AER CONTROL|MOTH LABYRINTH AER/,
    ),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "RETURN · ESC" }).click();
  await page.getByRole("button", { name: "ARCADE", exact: true }).click();
  await expect(page.locator(".qb-arcade-library-heading")).toHaveCount(0);
  await expect(page.locator(".qb-arcade-game h2 small")).toHaveCount(0);
  await expect(page.locator(".qb-arcade-select-row")).toHaveCount(5);
  const qong = await openArcadeCabinet(page, "qong");
  await expect(qong.locator("[data-action='launch-arcade']")).toHaveText([
    "PLAYER / CPU",
    "PLAYER / PLAYER",
  ]);
  await page.getByRole("button", { name: "RETURN · ESC" }).click();
  const fluxball = await openArcadeCabinet(page, "fluxball");
  await expect(fluxball.locator("[data-action='launch-arcade']")).toHaveText([
    "2P SHARED",
    "2P SPLIT",
    "4P SHARED",
    "4P SPLIT",
  ]);
  const launchHeights = await page
    .locator(".qb-arcade-detail [data-action='launch-arcade']")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height),
    );
  expect(new Set(launchHeights).size).toBe(1);
});

test("Qong Arcade is playable from the start but has no Story authority", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /ARCADE/ }).click();

  const saveBefore = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  const qong = await openArcadeCabinet(page, "qong");
  await expect(page.getByRole("heading", { name: "QONG" })).toBeVisible();
  await qong.getByRole("button", { name: "PLAYER / CPU" }).click();
  await expect(page.getByRole("region", { name: "Qong game" })).toBeVisible();
  await expect(page.getByText("RULE STATE: UNRESOLVED")).toBeVisible();
  await expect(page.getByText("GOAL: UNRESOLVED")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "PRESS SPACE TO OBSERVE RULES" }),
  ).toBeVisible();
  await expect(page.getByText("OBS 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "RETURN · ESC" }).click();
  await page.keyboard.press("m");
  await page.keyboard.press("m");
  await expect(page.locator(".qb-status")).toContainText("Sound restored");
  await page.getByRole("button", { name: "RETURN · ESC" }).click();
  await expect(page.locator(".qb-status")).toBeEmpty();
  const saveAfter = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );

  expect(saveAfter).toEqual(saveBefore);
});

test("Arcade cabinet sheets explain Qong and Fluxball before mode selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /ARCADE/ }).click();

  const qong = await openArcadeCabinet(page, "qong");
  await expect(qong.getByText("OBJECT", { exact: true })).toBeVisible();
  await expect(qong.getByText("CONDITION", { exact: true })).toBeVisible();
  await expect(qong.getByText(/LINE CROSSING COUNTS/)).toBeVisible();
  await page.getByRole("button", { name: "RETURN · ESC" }).click();

  const fluxball = await openArcadeCabinet(page, "fluxball");
  await expect(fluxball.getByText("CONTROLS", { exact: true })).toBeVisible();
  await expect(fluxball.getByText(/SHARED USES ONE RULE SET/)).toBeVisible();
  await expect(page.locator(".qb-arcade-help")).toHaveCount(0);
});

test("Workshop is selectable and presents five Story records without a floating MOTH link", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  const workshop = page.getByRole("button", { name: /WORKSHOP/ });
  await expect(workshop).toBeEnabled();
  await workshop.click();
  await expect(page.getByRole("heading", { name: "WORKSHOP" })).toBeVisible();
  await expect(page.locator(".qb-bay")).toHaveCount(5);
  await expect(page.locator(".qb-bay").nth(4)).toContainText("QUARRY");
  await expect(page.locator(".qb-bay").nth(4)).toContainText("UNRECOVERED");
  await expect(page.locator(".qb-workshop-access")).toHaveCount(0);
  await expect(page.getByText(/MOTH LINK/)).toHaveCount(0);
});

test.skip("the legacy Qong QA lesson remains an explicit non-authoritative replay", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== E2E_ORIGIN) {
      externalRequests.push(request.url());
    }
  });
  const selection = designerFixture();

  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  const saveBefore = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  await page.evaluate((fixtureSelection) => {
    const legacyApi = window.__QUANTUM_BOX_TEST__ as
      | (typeof window.__QUANTUM_BOX_TEST__ & {
          openDesignerLesson(selection: never): void;
        })
      | undefined;
    legacyApi?.openDesignerLesson(fixtureSelection as never);
  }, selection);

  await expect(
    page.getByRole("heading", { name: "THE DESIGNER" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "NON-PRODUCTION QA SURFACE · FICTIONAL GUIDE · FACTUAL ENGINE EXPLANATION",
    ),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".qb-status")).toContainText(
    "Recovery remains locked",
  );
  for (const label of ["CONTINUE", "CONTINUE", "OPEN THE MECHANISM"]) {
    await page.getByRole("button", { name: label }).click();
  }
  await page.getByRole("button", { name: "PREPARE |0⟩" }).click();
  await expect(page.getByText("0 · 50%")).toBeVisible();
  await expect(page.getByText("1 · 50%")).toBeVisible();
  await page.getByRole("button", { name: "APPLY H" }).click();
  await expect(page.getByText("ACTIVE PLAY NETWORK · NONE")).toBeVisible();
  await page.getByRole("button", { name: "REVEAL RECORDED RESULT" }).click();
  await expect(page.getByText("0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /OWN GOAL/ }).click();
  await expect(page.locator(".qb-designer-feedback")).toContainText(
    "maps 0 / heads to OPPOSITE GOAL",
  );
  await page.getByRole("button", { name: /OPPOSITE GOAL/ }).click();
  await expect(
    page.getByRole("list", { name: "Seven recorded Qong round rules" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ASSEMBLE ROUND PACK" }).click();
  await expect(page.locator(".qb-selector-bits strong")).toHaveText("00");
  await expect(page.locator(".qb-selector-trace .is-selected")).toContainText(
    "PACK 1",
  );
  await page.getByRole("button", { name: "SHOW THE SELECTION" }).click();
  await expect(page.getByText("RECORDED QPU RESULTS")).toBeVisible();
  await page.getByRole("button", { name: "RECOVER RULE STATE" }).click();
  await expect(page.getByRole("heading", { name: "WORKSHOP" })).toBeVisible();
  await expect(page.locator(".qb-status")).toContainText(
    "No selector bits were consumed",
  );
  expect(
    await page.evaluate(() => window.__QUANTUM_BOX_TEST__?.getSave()),
  ).toEqual(saveBefore);
  expect(externalRequests).toEqual([]);
});

test("Story is a five-chapter direct-launch cabinet list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: "STORY", exact: true }).click();

  await expect(page.locator(".qb-story-select > h1")).toHaveClass(
    "qb-visually-hidden",
  );
  await expect(page.getByText("QONG", { exact: true })).toBeVisible();
  await expect(page.getByText("SKIPIXL", { exact: true })).toBeVisible();
  await expect(page.getByText("FLUXBALL", { exact: true })).toBeVisible();
  await expect(page.getByText("QUANTMAN", { exact: true })).toBeVisible();
  await expect(
    page.locator(".qb-story-select").getByText("QUARRY", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("SEQUENTIAL RECOVERY")).toHaveCount(0);
  await expect(page.getByText(/ATTEMPTS/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "QONG · UNLOCKED" }),
  ).toBeVisible();
  await expect(
    page.locator(".qb-story-select-row[data-status='locked']"),
  ).toHaveCount(4);
  await expect(
    page.locator(".qb-story-select-status[aria-label='unlocked']"),
  ).toHaveCount(1);
  await expect(
    page.locator(".qb-story-select-status[aria-label='locked']"),
  ).toHaveCount(4);
  await expect(page.locator("[data-scroll-position]")).toBeVisible();
  await expect(page.locator("[data-scroll-position]")).toHaveAttribute(
    "data-scroll-state",
    "start",
  );
  await page.getByRole("button", { name: "QONG · UNLOCKED" }).click();
  await expect(page.getByRole("region", { name: "Qong game" })).toBeVisible();
});

test("migrated Qong and SkiPixl formulae separate behavior, decoder, and evidence", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "quantum-box/save-v1",
      JSON.stringify({
        schemaVersion: "quantum-box-save-v1",
        story: {
          currentStage: "fluxball-two",
          completedStages: ["qong", "skipixl"],
          recoveredFormulae: ["qong", "skipixl"],
          attempts: { qong: 1, skipixl: 3 },
        },
        settings: {
          reducedMotion: true,
          crtFlicker: true,
          soundMuted: false,
        },
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.showFormulaForQa("qong"),
  );

  await expect(page.getByRole("heading", { name: "RULE STATE" })).toBeVisible();
  await expect(page.locator(".qb-source-class")).toContainText(
    "RECOVERY RECORD INCOMPLETE",
  );
  await expect(page.locator(".qb-source-class")).toContainText(
    "REPLAY UNAVAILABLE",
  );
  await expect(
    page.getByRole("button", { name: /tutorial replay unavailable/ }),
  ).toHaveCount(0);
  await expect(page.locator(".qb-source-class")).not.toContainText(
    "MOTH-ACQUIRED QPU PACK",
  );
  await expect(page.getByText("VISIBLE BEHAVIOR")).toBeVisible();
  await expect(page.getByText("CLASSICAL DECODER")).toBeVisible();
  await expect(page.getByText("RETURNED RESULT")).toBeVisible();
  await expect(page.getByText("SUBMITTED INPUT")).toBeVisible();
  await expect(page.getByText("ENGINE OPERATION")).toBeVisible();
  await expect(page.getByText("SOURCE EVIDENCE")).toBeVisible();
  await expect(
    page.locator("details[data-formula-layer='07'] summary"),
  ).toContainText("FICTION");
  const signalPath = page.getByRole("navigation", {
    name: "Formula signal path",
  });
  await expect(signalPath).toBeVisible();
  await signalPath.getByRole("button", { name: /MAPPING/ }).click();
  await expect(
    page.locator("details[data-formula-layer='02']"),
  ).toHaveJSProperty("open", true);
  await expect(signalPath).toContainText(
    "Inspect the local rule that turns fixed values into play.",
  );
  await signalPath.getByRole("button", { name: /NOTE \/ FICTION/ }).click();
  await expect(
    page.locator("details[data-formula-layer='07']"),
  ).toHaveJSProperty("open", true);
  await expect(signalPath).toContainText(
    "Read the recovered designer note without confusing its fiction with Moth history.",
  );
  await expect(page.getByText("RECOVERED MARGIN NOTE · 01")).toBeVisible();
  await expect(
    page.getByText(/learn to watch the rule, not only the ball/),
  ).toBeVisible();
  await page.getByRole("button", { name: "RETURN · ESC" }).click();
  await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.showFormulaForQa("skipixl"),
  );
  await expect(
    page.getByRole("heading", { name: "RESIDUAL DESCENT" }),
  ).toBeVisible();
  await expect(page.getByText("VISIBLE BEHAVIOR")).toBeVisible();
  await expect(page.getByText("CLASSICAL DECODER")).toBeVisible();
  await expect(page.getByText("RETURNED RESULT")).toBeVisible();
  await expect(page.getByText("SUBMITTED INPUT")).toBeVisible();
  await expect(page.getByText("ENGINE OPERATION")).toBeVisible();
  await expect(page.getByText("SOURCE EVIDENCE")).toBeVisible();
  await expect(
    page.locator("details[data-formula-layer='07'] summary"),
  ).toContainText("FICTION");
});

test("SkiPixl Arcade exposes the QPixl descent without Story authority", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /ARCADE/ }).click();
  const saveBefore = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  const skipixl = await openArcadeCabinet(page, "skipixl");
  await expect(skipixl.getByRole("button", { name: "EASY" })).toBeVisible();
  await expect(skipixl.getByRole("button", { name: "MEDIUM" })).toBeVisible();
  await expect(skipixl.getByRole("button", { name: "HARD" })).toBeVisible();
  await skipixl.getByRole("button", { name: "EASY" }).click();
  await expect(
    page.getByRole("region", { name: "SkiPixl game" }),
  ).toBeVisible();
  await expect(page.getByText(/READY · [123]/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "QPIXL RESIDUAL CUT" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "RETURN · ESC" }).click();
  const saveAfter = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  expect(saveAfter).toEqual(saveBefore);
});

test("Arcade fits five cabinet rows and gives each cabinet a separate trial sheet", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /ARCADE/ }).click();

  await expect(page.locator("canvas[data-ui='bitmap-text']")).toHaveAttribute(
    "data-explicit-text-fit-audit",
    "pass",
  );

  const cabinetRows = page.locator(".qb-arcade-select-row");
  await expect(cabinetRows).toHaveCount(5);
  const listBox = await page.locator(".qb-arcade-list").boundingBox();
  const lastBox = await cabinetRows.last().boundingBox();
  expect(listBox).not.toBeNull();
  expect(lastBox).not.toBeNull();
  expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(
    listBox!.y + listBox!.height + 1,
  );

  for (const [cabinet, expectedModes] of [
    ["skipixl", 3],
    ["quantman", 2],
  ] as const) {
    const detail = await openArcadeCabinet(page, cabinet);
    await expect(detail.getByText("OBJECT", { exact: true })).toBeVisible();
    await expect(detail.getByText("CONDITION", { exact: true })).toBeVisible();
    await expect(detail.getByText("CONTROLS", { exact: true })).toBeVisible();
    const modes = detail.locator(".qb-arcade-mode");
    await expect(modes).toHaveCount(expectedModes);
    const xPositions: number[] = [];
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
      xPositions.push(launchBox!.x);
    }
    expect(xPositions).toEqual([...xPositions].sort((a, b) => a - b));
    expect(new Set(xPositions.map(Math.round)).size).toBe(expectedModes);
    await page.getByRole("button", { name: "RETURN · ESC" }).click();
  }

  for (const cabinet of ["fluxball", "quarry"]) {
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
    await page.getByRole("button", { name: "RETURN · ESC" }).click();
  }
});

test("Settings use concise field, initials, and reserved-key layouts", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /SETTINGS/ }).click();

  await expect(page.getByText("ARCADE SCORES", { exact: true })).toBeVisible();
  const initials = page.getByLabel("Arcade scoreboard initials");
  await expect(initials).toBeVisible();
  await expect(initials).toHaveValue("YOU");
  await expect(
    page.getByText("USED FOR NEW TOP-FIVE SCORES", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: /FIELD/ }).click();
  await expect(page.getByText("BACKGROUND FIELD", { exact: true })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("group", { name: "Background field options" }),
  ).toBeVisible();
  const fieldSummary = page.locator(".qb-background-summary");
  await expect(fieldSummary.locator("strong")).toHaveText("STANDARD");
  await expect(fieldSummary.locator("span")).toHaveText(
    "4 QPIXL-MAPPED STATES · 22.8S OFFLINE LOOP",
  );
  await expect(
    page.getByText(/Recorded endpoints and local derivations/),
  ).toHaveCount(0);

  await page.getByRole("button", { name: /CONTROLS/ }).click();
  await expect(
    page.getByText("ESC / P / M / X RESERVED · ONE CONTROL PER KEY", {
      exact: true,
    }),
  ).toBeVisible();
});

test("Arcade score controls open complete five-place boards", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /ARCADE/ }).click();

  const skipixl = await openArcadeCabinet(page, "skipixl");
  const easyMode = skipixl.locator(".qb-arcade-mode").first();
  await easyMode.getByRole("button", { name: "SCORES", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "SKIPIXL · EASY" }),
  ).toBeVisible();
  await expect(page.getByText("TOP FIVE", { exact: true })).toBeVisible();
  const scoreRows = page.locator(".qb-scoreboard-table ol > li");
  await expect(scoreRows).toHaveCount(5);
  await expect(scoreRows.first()).toContainText("1---");
  await expect(page.getByText("NO SCORES", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-arcade-score-initials]")).toHaveCount(0);

  await page
    .getByRole("button", { name: "ARCADE · SPACE", exact: true })
    .click();
  await expect(skipixl).toBeVisible();
});

test("Fluxball Arcade exposes both formats and keeps hidden authority out of active DOM", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /ARCADE/ }).click();
  await openArcadeCabinet(page, "fluxball");
  const saveBefore = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  for (const [mode, seconds] of [
    ["2P SHARED", "60"],
    ["2P SPLIT", "60"],
    ["4P SHARED", "60"],
    ["4P SPLIT", "60"],
  ] as const) {
    await page.getByRole("button", { name: mode }).click();
    await expect(
      page.getByRole("heading", { name: "FLUXBALL JOIN" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "X · START" }).click();
    const game = page.getByRole("region", { name: "Fluxball game" });
    await expect(game).toBeVisible();
    await expect(game).toContainText("CHANGE RULES");
    await expect(game).toContainText("AVAILABLE");
    await expect(game).toContainText("R 1/4");
    await expect(game).toContainText(seconds);
    await expect(game).not.toContainText(/\bDIRECT\b/);
    await expect(game).not.toContainText(/\bINVERTED\b/);
    await expect(game).not.toContainText(/\bCARRY\b/);
    await expect(game).not.toContainText(/\bSTRIKE\b/);
    await expect(game).not.toContainText(/\bOPPOSITE\b/);
    await expect(game).not.toContainText(/\bOWN\b/);
    await expect(game).not.toContainText(/\bFIXTURE\b/);
    await page.keyboard.press("Space");
    await expect(game).toContainText("USED");
    await expect(
      game.getByText(
        mode.endsWith("SPLIT")
          ? /Player A used CHANGE RULES.*Every individual rule state changed.*old and new values remain hidden/i
          : /Player A used CHANGE RULES.*shared rule state changed.*old and new values remain hidden/i,
      ),
    ).toBeAttached();
    await expect(game).not.toContainText(/\bDIRECT\b|\bINVERTED\b/);
    await expect(game).not.toContainText(/\bCARRY\b|\bSTRIKE\b/);
    await expect(game).not.toContainText(/\bOPPOSITE\b|\bOWN\b/);
    await expect(game).not.toContainText(
      /PREVIOUS|LAST RULE|REVEAL|CPU PROBING|CPU TESTING/,
    );
    await page.getByRole("button", { name: "RETURN · ESC" }).click();
  }
  const saveAfter = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  expect(saveAfter).toEqual(saveBefore);
});

test("Arcade fixes the test seed and fills unclaimed Fluxball positions with CPUs", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.evaluate(() => window.__QUANTUM_BOX_TEST__?.navigate("developer"));
  await expect(
    page.getByRole("heading", { name: "DEVELOPER SURFACE" }),
  ).toBeVisible();
  await page.locator("[data-developer-run-seed]").fill("17");
  await page.locator("[data-developer-run-seed]").press("Tab");
  await page.evaluate(() => window.__QUANTUM_BOX_TEST__?.navigate("arcade"));
  const fluxball = await openArcadeCabinet(page, "fluxball");
  await fluxball.getByRole("button", { name: "2P SPLIT" }).click();
  await page.getByRole("button", { name: "X · START" }).click();

  const game = page.getByRole("region", { name: "Fluxball game" });
  await expect(game).toContainText("CHANGE RULES");
  await expect(game).toContainText("AVAILABLE");
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(game).toContainText("USED");
  await expect(
    game.getByText(
      /Player A used CHANGE RULES.*individual rule state changed/i,
    ),
  ).toBeAttached();
  await expect(game.getByText(/Player B used CHANGE RULES/)).toHaveCount(0);
});

test("recovered Fluxball formula explains the complete hardware bank", async ({
  page,
}) => {
  await installLegacyFormulaAccess(page, ["fluxball"]);
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.showFormulaForQa("fluxball"),
  );
  await expect(
    page.getByRole("heading", { name: "RELATIONAL RULEFIELD" }),
  ).toBeVisible();
  await expect(page.getByText("VISIBLE BEHAVIOR")).toBeVisible();
  await expect(page.getByText("CLASSICAL DECODER")).toBeVisible();
  await expect(page.getByText("RETURNED RESULT")).toBeVisible();
  await expect(page.getByText("SUBMITTED INPUT")).toBeVisible();
  await expect(page.getByText("ENGINE OPERATION")).toBeVisible();
  await expect(page.getByText("SOURCE EVIDENCE")).toBeVisible();
  await expect(
    page.locator("details[data-formula-layer='07'] summary"),
  ).toContainText("FICTION");
  await page.getByText("CLASSICAL DECODER").click();
  await expect(page.getByText(/four gameplay rounds pair/)).toBeVisible();
  await page.getByText("RETURNED RESULT").click();
  await expect(
    page.getByText(/40 completed IBM Fez distributions/),
  ).toBeVisible();
  await page.getByText("SOURCE EVIDENCE").click();
  await expect(
    page.getByText("fluxball-qgraph-qpu-bank-v2", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/40 exact Moth graph-v1/)).toBeVisible();
});

test("Quantman Arcade is installed without Story authority and its formula is evidence-bounded", async ({
  page,
}) => {
  await installLegacyFormulaAccess(page, ["quantman"]);
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /ARCADE/ }).click();
  const quantmanCabinet = await openArcadeCabinet(page, "quantman");
  await expect(
    quantmanCabinet.getByRole("combobox", {
      name: "Quantman maze course",
    }),
  ).toHaveCount(0);
  const saveBefore = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  await quantmanCabinet.getByRole("button", { name: "HOLD" }).click();
  const cabinet = page.getByRole("region", {
    name: "Quantman QPU-derived gaze maze",
  });
  await expect(cabinet).toBeVisible();
  await expect(cabinet).toContainText("REMAINING");
  await expect(cabinet).toContainText("LIVES 3");
  await expect(cabinet).toContainText("RECORDED IBM FEZ RETURN");
  await page.getByRole("button", { name: "RETURN · ESC" }).click();
  await expect(quantmanCabinet).toBeVisible();
  await expect(
    quantmanCabinet.getByRole("button", { name: "HOLD" }),
  ).toBeVisible();
  const saveAfter = await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.getSave(),
  );
  expect(saveAfter).toEqual(saveBefore);

  await page.getByRole("button", { name: "RETURN · ESC" }).click();
  await page.evaluate(() =>
    window.__QUANTUM_BOX_TEST__?.showFormulaForQa("quantman"),
  );
  await expect(
    page.getByRole("heading", { name: "CORRELATED MAZE" }),
  ).toBeVisible();
  await page.getByText("RETURNED RESULT").click();
  await expect(
    page.getByText(/separate distribution of 4,096 measured 100-bit states/),
  ).toBeVisible();
  await page.getByText("CLASSICAL DECODER").click();
  await expect(
    page.getByText(/never repairs, splices, or fabricates a bit or wall/),
  ).toBeVisible();
});

test("signal settings persist and reduced motion removes the title delay", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PRESS START" }).click();
  await page.getByRole("button", { name: /SETTINGS/ }).click();
  await page.getByLabel("REDUCED MOTION").check();
  await page.getByLabel("Sound level").fill("0.6");
  await page.keyboard.press("m");

  await expect(page.locator(".qb-shell")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
  await page.reload();
  await page.getByRole("button", { name: "PRESS START" }).click();
  await expect(
    page.getByRole("heading", { name: "ARCHIVE INDEX" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /SETTINGS/ }).click();
  await expect(page.getByLabel("Sound level")).toHaveValue("0.6");
  await expect(page.getByLabel("SOUND MUTED · M")).toBeChecked();
});
