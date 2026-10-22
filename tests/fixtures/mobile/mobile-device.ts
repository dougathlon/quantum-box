/** Test-only device entry: navigate the real app using its normal visible controls.
 * No saved Story data, runtime state, or QPU fixtures are injected. This file is
 * outside the production entry point. Audio autoplay may stay locked until touch.
 */
import "../../../src/main";

const query = new URLSearchParams(location.search);
const game = query.get("game") ?? "qong";
const review = document.querySelector<HTMLOutputElement>("#device-review")!;
const modes: Record<string, string> = {
  qong: "PLAYER / CPU",
  skipixl: "EASY",
  quantman: "HOLD",
  fluxball: "4-WAY SPLIT",
  quag: "1 PLAYER",
};
async function click(selector: string, visible = true): Promise<void> {
  const deadline = performance.now() + 10000;
  while (performance.now() < deadline) {
    const element = document.querySelector<HTMLButtonElement>(selector);
    if (
      element &&
      !element.disabled &&
      (!visible || element.getClientRects().length)
    ) {
      element.click();
      return;
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }
  throw new Error(`Device fixture could not find ${selector}`);
}
async function show(): Promise<void> {
  // The production start button stays disabled until the game canvas is ready.
  await click('[data-action="press-start"]');
  if (query.get("view") !== "home") {
    await click('[data-action="navigate"][data-page="arcade"]');
    if (query.get("view") !== "arcade") {
      await click(
        `[data-action="open-arcade-cabinet"][data-game-id="${game === "quag" ? "quarry" : game}"]`,
      );
      if (query.get("view") !== "tutorial") {
        const mode = query.get("mode") ?? modes[game];
        const button = [
          ...document.querySelectorAll<HTMLButtonElement>(
            '[data-action="launch-arcade"]',
          ),
        ].find((button) => button.textContent === mode);
        if (!button) throw new Error(`Unknown review mode ${mode}`);
        button.click();
        if (
          game === "fluxball" &&
          document.documentElement.dataset["mobile"] !== "true"
        )
          await click('[data-action="lobby-start"][data-human-count="1"]');
        // Some recorded assets load asynchronously after the launch button.
        // Wait for the visible game before using its normal pause action.
        const deadline = performance.now() + 10000;
        while (
          !document.querySelector(
            `.qb-shell[data-view="cabinet"] .qb-game-ui[data-cabinet="${game}"][data-phase]`,
          )
        ) {
          if (performance.now() > deadline)
            throw new Error("Game did not become ready");
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
        }
        if (query.get("pause") === "1")
          await click(`[data-action="${game}-pause"]`, false);
      }
    }
  }
  review.textContent = `QA ${innerWidth} × ${innerHeight}`;
}
window.addEventListener("resize", () => {
  review.textContent = `QA ${innerWidth} × ${innerHeight}`;
});
void show()
  .then(() => {
    if (query.has("audit")) requestAnimationFrame(inspectLayout);
  })
  .catch((error) => {
    review.textContent = String(error);
  });

// Geometry checks run on the real, unmodified game through its rendered DOM.
// Unlike the synthetic input fixture, this never injects game state or inputs.
function inspectLayout() {
  const errors: string[] = [];
  const shell = document.querySelector<HTMLElement>(".qb-shell");
  const frame = document.querySelector<HTMLElement>(".qb-screen-frame");
  const gameUi = document.querySelector<HTMLElement>(".qb-game-ui");
  if (shell?.dataset["view"] !== "cabinet" || !frame || !gameUi) return;
  const arena = frame.getBoundingClientRect();
  const hud = document.querySelector<HTMLElement>(".qb-mobile-hud")!;
  const within = (rect: DOMRect) =>
    rect.left >= -1 &&
    rect.top >= -1 &&
    rect.right <= innerWidth + 1 &&
    rect.bottom <= innerHeight + 1;
  const intersects = (a: DOMRect, b: DOMRect) =>
    a.left < b.right - 1 &&
    b.left < a.right - 1 &&
    a.top < b.bottom - 1 &&
    b.top < a.bottom - 1;
  if (!within(arena) || arena.height < 90 || arena.width < 150)
    errors.push("arena too small or outside viewport");
  if (shell.inert || getComputedStyle(shell).visibility === "hidden")
    errors.push("game blocked by orientation");
  if (hud.getBoundingClientRect().bottom > arena.top + 1)
    errors.push("scoreboard overlaps arena");
  const visible = (e: HTMLElement) => e.getClientRects().length && !e.hidden;
  const controls = [
    ...document.querySelectorAll<HTMLElement>(
      ".qb-touch-move, .qb-touch-controls button, .qb-game-ui footer button",
    ),
  ].filter(visible);
  for (const [i, control] of controls.entries()) {
    const rect = control.getBoundingClientRect();
    if (!within(rect) || rect.width < 44 || rect.height < 44)
      errors.push(
        `${control.getAttribute("aria-label") ?? control.textContent}: clipped or undersized`,
      );
    if (intersects(rect, arena)) errors.push("touch target overlaps arena");
    if (
      controls
        .slice(i + 1)
        .some((other) => intersects(rect, other.getBoundingClientRect()))
    )
      errors.push("touch targets overlap");
  }
  for (const e of hud.querySelectorAll<HTMLElement>(
    "strong, span:not([hidden]), p",
  )) {
    if (!e.textContent || !visible(e)) continue;
    const rect = e.getBoundingClientRect();
    if (!within(rect) || e.scrollWidth > e.clientWidth + 1)
      errors.push(`HUD clipped: ${e.textContent}`);
    if (intersects(rect, arena))
      errors.push(`HUD overlaps arena: ${e.textContent}`);
  }
  if (innerHeight > innerWidth && gameUi.dataset["navigation"] === "false") {
    const movement = document.querySelector<HTMLElement>(".qb-touch-move")!;
    if (movement.getBoundingClientRect().top < arena.bottom)
      errors.push("portrait movement is not below the arena");
  }
  const canvas = frame.querySelector(".qb-canvas-host canvas");
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    if (Math.abs(rect.width / rect.height - 320 / 180) > 0.01)
      errors.push("game geometry stretched");
  }
  review.dataset["layoutResult"] = errors.length ? "fail" : "pass";
  review.dataset["layoutPhase"] = gameUi.dataset["phase"] ?? "";
  review.dataset["layoutErrors"] = JSON.stringify(errors);
  review.textContent = `QA ${innerWidth} × ${innerHeight} · ${errors.length ? errors.join("; ") : "LAYOUT PASS"}`;
}
if (query.has("audit")) {
  const observer = new ResizeObserver(() =>
    requestAnimationFrame(inspectLayout),
  );
  observer.observe(document.querySelector("#app")!);
  const hud = document.querySelector(".qb-mobile-hud")!;
  const changes = new MutationObserver(() =>
    requestAnimationFrame(inspectLayout),
  );
  changes.observe(hud, { childList: true, subtree: true, characterData: true });
  // A READY game may never mutate the HUD again after its async launch.
  // Audit entry and pause transitions even when neither size nor score changes.
  changes.observe(document.querySelector("#app")!, {
    subtree: true,
    attributes: true,
    attributeFilter: ["data-view", "data-phase", "data-navigation"],
  });
  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    changes.disconnect();
  });
}
