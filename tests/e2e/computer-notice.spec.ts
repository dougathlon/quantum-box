import { expect, test } from "@playwright/test";
const desktopAgents = [
  [
    "Windows touch laptop",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    true,
  ],
  [
    "Mac laptop",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    false,
  ],
  [
    "ChromeOS touch laptop",
    "Mozilla/5.0 (X11; CrOS x86_64 16093.0.0) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    true,
  ],
  [
    "Linux desktop",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    false,
  ],
] as const;
for (const [label, userAgent, hasTouch] of desktopAgents) {
  test.describe(label, () => {
    test.use({ userAgent, hasTouch, viewport: { width: 434, height: 720 } });
    test("small desktop windows and touch laptops still start normally", async ({
      page,
    }) => {
      await page.goto("/?mobile=1");
      await expect(
        page.getByRole("button", { name: "PRESS START", exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".qb-computer-notice")).toHaveCount(0);
      await page
        .getByRole("button", { name: "PRESS START", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "ARCADE", exact: true }),
      ).toBeVisible();
    });
  });
}
const mobileAgents = [
  [
    "iPhone",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  ],
  [
    "Android phone",
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
  ],
  [
    "Android tablet",
    "Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
  ],
  [
    "iPad desktop identity",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
  ],
] as const;
for (const [label, userAgent] of mobileAgents) {
  test.describe(label, () => {
    test.use({
      userAgent,
      hasTouch: true,
      viewport: { width: 390, height: 700 },
    });
    test("shows notice before loading gameplay and keeps it after rotation", async ({
      page,
    }, info) => {
      const requests: string[] = [];
      page.on("request", (request) => requests.push(request.url()));
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "maxTouchPoints", {
          value: 5,
          configurable: true,
        });
      });
      await page.goto("/?returnTo=controls&controller=1");
      await expect(
        page.getByRole("main", { name: "Quantum Box requires a computer" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Copy game link" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "PRESS START", exact: true }),
      ).toHaveCount(0);
      expect(
        requests.filter((url) =>
          /QuantumBoxApp|startGame|phaser|\.wav(?:\?|$)|\.mp3(?:\?|$)/i.test(
            url,
          ),
        ),
      ).toEqual([]);
      expect(
        await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          viewport: innerWidth,
        })),
      ).toEqual({ width: 390, viewport: 390 });
      await page.screenshot({ path: info.outputPath("computer-notice.png") });
      await page.setViewportSize({ width: 700, height: 390 });
      await expect(
        page.getByRole("button", { name: "Copy game link" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Copy game link" })
        .scrollIntoViewIfNeeded();
      await expect(page.locator(".qb-shell")).toHaveCount(0);
    });
  });
}
test.describe("notice clipboard", () => {
  test.use({
    userAgent: mobileAgents[0][1],
    hasTouch: true,
    viewport: { width: 320, height: 580 },
  });
  for (const succeeds of [true, false])
    test(`copy link ${succeeds ? "success" : "failure fallback"}`, async ({
      page,
    }) => {
      await page.addInitScript((success) => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              if (!success) throw new Error("Clipboard unavailable");
              document.body.dataset["copiedLink"] = text;
            },
          },
        });
      }, succeeds);
      await page.goto("/");
      await page.getByRole("button", { name: "Copy game link" }).click();
      if (succeeds) {
        await expect(page.getByRole("status")).toHaveText("Link copied.");
        await expect(page.locator("body")).toHaveAttribute(
          "data-copied-link",
          "https://dougathlon.github.io/quantum-box/",
        );
      } else {
        await expect(page.locator(".qb-notice-link")).toBeVisible();
        await expect(page.locator(".qb-notice-link")).toHaveText(
          "https://dougathlon.github.io/quantum-box/",
        );
      }
    });
});
