import type { Page, TestInfo } from "@playwright/test";

export function captureExternalRequests(
  page: Page,
  testInfo: TestInfo,
): string[] {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("Playwright project requires a string baseURL.");
  }

  const allowedOrigin = new URL(baseURL).origin;
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== allowedOrigin) {
      requests.push(request.url());
    }
  });
  return requests;
}
