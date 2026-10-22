import { QuantumBoxShell } from "../../../src/ui/QuantumBoxShell";
import { QUANTUM_BOX_ASSETS } from "../../../src/assets/manifest";
import { createDefaultSave } from "../../../src/save/types";
import { STORY_TERMINAL_PAGES } from "../../../src/story/terminal";
import { InputController } from "../../../src/input/InputController";
import { TouchControls } from "../../../src/mobile/TouchControls";
import "../../../src/styles.css";
import "../../../src/display/brownBox.css";
import "../../../src/mobile/mobile.css";

// Real menu rendering with an in-memory save: no repository or gameplay writes.
document.documentElement.dataset["mobile"] = "true";
const root = document.querySelector<HTMLElement>("#app")!;
const summary = document.querySelector<HTMLOutputElement>("#summary")!;
const results = document.querySelector<HTMLOListElement>("#results")!;
const noAction = () => {};
let terminalAction = "";
let submittedInitials = "";
// Approximate the notch and home indicator independently of browser chrome.
if (new URLSearchParams(location.search).has("safearea")) {
  const style = document.createElement("style");
  style.textContent = `html[data-mobile="true"] .qb-internal { padding: 8px 44px 21px; } @media (orientation: portrait) { html[data-mobile="true"] .qb-internal { padding: 44px 8px 34px; } }`;
  document.head.append(style);
}
const save = createDefaultSave();
const shell = new QuantumBoxShell(
  root,
  QUANTUM_BOX_ASSETS.display,
  { ...save, settings: { ...save.settings, reducedMotion: true } },
  {
    onStartGesture: noAction,
    onInternalEntered: noAction,
    onTitleReturned: noAction,
    onPageChanged: noAction,
    onContinueStory: noAction,
    onNewStory: noAction,
    onStoryTerminalAction: (action) => {
      terminalAction = action;
    },
    onOpenTerminalTranscript: noAction,
    onRetryTerminalChapter: noAction,
    onLaunchArcade: noAction,
    onSettingChanged: noAction,
    onArcadeScoreInitialsSubmitted: (_sequence, initials) => {
      submittedInitials = initials;
    },
    onExportSave: noAction,
    onResetSave: noAction,
    onCabinetAction: noAction,
    onFluxballLobbyAction: noAction,
  },
);
const input = new InputController(window, document);
const touch = new TouchControls(root, input);
shell.enterInternal();
const settle = async () => {
  await document.fonts.ready;
  for (let i = 0; i < 3; i++)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
};
const visible = (element: HTMLElement | null) =>
  !!element && element.getClientRects().length > 0 && !element.hidden;
const get = (selector: string) => root.querySelector<HTMLElement>(selector)!;
let total = 0;
let passed = 0;
function record(name: string, success: boolean) {
  total++;
  if (success) passed++;
  const item = document.createElement("li");
  item.dataset["result"] = success ? "pass" : "fail";
  item.textContent = `${success ? "PASS" : "FAIL"}: ${name}`;
  results.append(item);
}
function intersects(a: DOMRect, b: DOMRect) {
  return (
    a.left < b.right - 1 &&
    b.left < a.right - 1 &&
    a.top < b.bottom - 1 &&
    b.top < a.bottom - 1
  );
}
function storyLayoutErrors() {
  const body = get(".qb-terminal-body");
  const bodyRect = body.getBoundingClientRect();
  const frameRect = get(".qb-screen-frame").getBoundingClientRect();
  const navigation = [
    get(".qb-mobile-story-back"),
    ...root.querySelectorAll<HTMLElement>(
      ".qb-terminal-actions button, .qb-mobile-scroll-controls button",
    ),
  ].filter(visible);
  const errors: string[] = [];
  if (bodyRect.height < 90) errors.push("reading area too short");
  if (get(".qb-page").scrollHeight > get(".qb-page").clientHeight + 1)
    errors.push("outer page scrolls");
  for (const [i, button] of navigation.entries()) {
    const rect = button.getBoundingClientRect();
    if (
      rect.height < 44 ||
      rect.top < bodyRect.bottom - 1 ||
      rect.bottom > frameRect.bottom ||
      rect.left < frameRect.left ||
      rect.right > frameRect.right
    )
      errors.push("navigation outside its reserved row");
    if (
      navigation
        .slice(i + 1)
        .some((other) => intersects(rect, other.getBoundingClientRect()))
    )
      errors.push("navigation overlaps");
  }
  for (const paragraph of body.querySelectorAll<HTMLElement>("p")) {
    if (paragraph.scrollHeight > paragraph.clientHeight + 1)
      errors.push("paragraph lines overlap");
  }
  return errors;
}
async function checkScrolling(name: string, target: HTMLElement) {
  await settle();
  const down = get('[aria-label="Scroll down to see more"]');
  const up = get('[aria-label="Scroll up"]');
  const overflow = target.scrollHeight > target.clientHeight + 2;
  record(
    `${name}: More below accurately signals overflow`,
    visible(down) === overflow,
  );
  for (let i = 0; i < 20 && visible(down); i++) {
    down.click();
    await settle();
  }
  record(
    `${name}: last content is reachable and downward cue clears`,
    target.scrollTop + target.clientHeight >= target.scrollHeight - 2 &&
      !visible(down),
  );
  record(
    `${name}: Above appears only after scrolling`,
    visible(up) === overflow,
  );
  for (let i = 0; i < 20 && visible(up); i++) {
    up.click();
    await settle();
  }
  record(
    `${name}: Above returns to the start`,
    target.scrollTop < 2 && !visible(up),
  );
  record(
    `${name}: no horizontal content clipping`,
    target.scrollWidth <= target.clientWidth + 1,
  );
}
async function run() {
  total = passed = 0;
  results.replaceChildren();
  shell.showPage("terminal");
  await settle();
  const terminalRows = [
    ...root.querySelectorAll<HTMLElement>(".qb-terminal-index li"),
  ];
  record(
    "Terminal distributes its five rows through the page",
    terminalRows.length === 5 &&
      terminalRows[4]!.getBoundingClientRect().bottom >=
        get(".qb-page").getBoundingClientRect().bottom - 2,
  );
  shell.updateSave({
    ...save,
    story: { ...save.story, storyCompleted: true },
    settings: { ...save.settings, reducedMotion: true },
  });
  shell.showPage("story-start");
  await settle();
  record(
    "Completed Story offers Terminal rather than a dead Continue",
    !root.querySelector('[data-action="continue-story"]') &&
      document.activeElement === root.querySelector('[data-page="terminal"]'),
  );
  const storyBack = get(
    '.qb-story-start [data-action="back"]',
  ).getBoundingClientRect();
  record(
    "Story session keeps Back at the foot of the frame",
    get(".qb-screen-frame").getBoundingClientRect().bottom - storyBack.bottom <
      24,
  );
  get('.qb-story-start [data-page="terminal"]').click();
  record("Completed Story opens Terminal", shell.getPage() === "terminal");
  shell.updateSave({
    ...save,
    settings: { ...save.settings, reducedMotion: true },
  });
  shell.showPage("settings");
  get('[data-settings-section="display"]').click();
  await settle();
  record(
    "All four Settings sections remain inside the reading area",
    [
      ...root.querySelectorAll<HTMLElement>('[data-action="settings-section"]'),
    ].every((button) => {
      const rect = button.getBoundingClientRect();
      const pageRect = get(".qb-page").getBoundingClientRect();
      return rect.top >= pageRect.top - 1 && rect.bottom <= pageRect.bottom + 1;
    }),
  );
  record(
    "Display retains both preferences and all six backgrounds",
    root.querySelectorAll('.qb-settings input[type="checkbox"]').length === 2 &&
      root.querySelectorAll('.qb-settings input[type="radio"]').length === 6,
  );
  const selected = get('[data-settings-section="display"]');
  const marker = getComputedStyle(selected, "::before");
  record(
    "Settings cursor has its own gutter before the number",
    selected.querySelector("span")!.getBoundingClientRect().left >=
      selected.getBoundingClientRect().left +
        parseFloat(marker.left) +
        parseFloat(marker.width) +
        3,
  );
  const displayRect = get(".qb-settings-scroll").getBoundingClientRect();
  record(
    "Display shows at least three complete options before scrolling",
    [...root.querySelectorAll<HTMLElement>(".qb-settings label")].filter(
      (label) => {
        const rect = label.getBoundingClientRect();
        return (
          rect.top >= displayRect.top - 1 &&
          rect.bottom <= displayRect.bottom + 1
        );
      },
    ).length >= 3,
  );
  record(
    "Display uses at least half the available screen height for options",
    displayRect.height >= innerHeight / 2,
  );
  await checkScrolling("Display", get(".qb-settings-scroll"));
  for (const section of ["sound", "controls", "data"]) {
    get(`[data-settings-section="${section}"]`).click();
    await settle();
    await checkScrolling(section, get(".qb-settings-scroll"));
    if (section === "sound")
      record(
        "Sound retains Mute and Volume",
        !!root.querySelector('input[type="checkbox"]') &&
          !!root.querySelector('input[type="range"]'),
      );
    if (section === "controls") {
      record(
        "Controls offers one player, five optional key bindings and controller setup",
        root.querySelectorAll('[data-action="settings-player"]').length === 1 &&
          root.querySelectorAll('[data-action="rebind-key"]').length === 5 &&
          !!root.querySelector('[data-action="controller-setup"]'),
      );
      get('[data-action="controller-setup"]').click();
      await settle();
      record(
        "Controller setup begins with its instructions in view",
        get(".qb-settings-scroll").scrollTop === 0,
      );
      await checkScrolling("Controller setup", get(".qb-settings-scroll"));
    }
  }
  shell.showPage("arcade");
  await settle();
  record(
    "Arcade retains five numbered rows and canonical previews",
    root.querySelectorAll(".qb-arcade-select-row").length === 5 &&
      [
        ...root.querySelectorAll<HTMLElement>(
          ".qb-arcade-select-row .qb-arcade-preview",
        ),
      ].every(visible),
  );
  const quantmanPreview = get(".qb-arcade-preview--quantman");
  record(
    "Every Quantman icon fits completely in its preview",
    [...quantmanPreview.querySelectorAll("img")].every((image) => {
      const rect = image.getBoundingClientRect();
      const preview = quantmanPreview.getBoundingClientRect();
      return rect.left >= preview.left - 1 && rect.right <= preview.right + 1;
    }),
  );
  await checkScrolling("Arcade", get(".qb-page"));
  for (const game of ["qong", "skipixl", "quantman", "fluxball", "quarry"]) {
    get(`[data-action="open-arcade-cabinet"][data-game-id="${game}"]`).click();
    await settle();
    await checkScrolling(`${game} tutorial`, get(".qb-arcade-tutorial"));
    record(
      `${game}: mobile offers no second human`,
      !root.querySelector(
        '[data-mode="LOCAL TWO PLAYER"], [data-mode="2 PLAYER"]',
      ),
    );
    if (game === "fluxball")
      record(
        "Fluxball retains all four CPU match formats",
        root.querySelectorAll('[data-action="launch-arcade"]').length === 4,
      );
    record(
      `${game}: play options stay visible below the reading area`,
      [
        ...root.querySelectorAll<HTMLElement>('[data-action="launch-arcade"]'),
      ].every((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.height >= 44 &&
          rect.bottom <= innerHeight - 44 &&
          rect.left >= 0 &&
          rect.right <= innerWidth
        );
      }),
    );
    shell.showPage("arcade");
    await settle();
  }
  for (const gameId of ["skipixl", "quantman"] as const) {
    shell.showArcadeScoreboard({
      gameId,
      mode: gameId === "skipixl" ? "EASY" : "HOLD",
      highlightRecordSequence: null,
      resultLabel: null,
      initialsEditable: false,
    });
    await settle();
    record(
      `${gameId}: all five score rows remain present`,
      root.querySelectorAll(".qb-scoreboard-table li").length === 5,
    );
    await checkScrolling(`${gameId} scores`, get(".qb-page"));
    shell.showArcadeScoreboard({
      gameId,
      mode: gameId === "skipixl" ? "EASY" : "HOLD",
      highlightRecordSequence: 1,
      resultLabel: null,
      initialsEditable: true,
    });
    await settle();
    if (
      new URLSearchParams(location.search).get("review") ===
      `${gameId}-initials`
    ) {
      summary.textContent = `Reviewing ${gameId} initials`;
      return;
    }
    const initial = () => get('[data-mobile-initial-slot="0"]').textContent;
    const original = initial();
    get('[aria-label="Increase initial 1"]').click();
    record(`${gameId}: touch can change initials`, initial() !== original);
    get('[aria-label="Decrease initial 1"]').click();
    record(`${gameId}: touch can correct initials`, initial() === original);
    await checkScrolling(`${gameId} initials`, get(".qb-page"));
    const expectedInitials = root.querySelector<HTMLInputElement>(
      "[data-arcade-score-initials]",
    )!.value;
    get('[data-action="save-initials"]').click();
    record(
      `${gameId}: touch Save submits the visible initials`,
      submittedInitials === expectedInitials,
    );
  }
  const storyFailures: string[] = [];
  const navigationFailures: string[] = [];
  for (const candidate of Object.values(STORY_TERMINAL_PAGES)) {
    shell.showStoryTerminal({
      nodeId: candidate.id,
      page: candidate,
      transcript: false,
    });
    await settle();
    const reading = get(".qb-page");
    if (
      reading.scrollWidth > reading.clientWidth + 1 ||
      [
        ...root.querySelectorAll<HTMLElement>(".qb-terminal-actions button"),
      ].some((button) => button.getBoundingClientRect().height < 44)
    )
      storyFailures.push(candidate.id);
    const layoutErrors = storyLayoutErrors();
    if (layoutErrors.length)
      navigationFailures.push(`${candidate.id}: ${layoutErrors.join(", ")}`);
  }
  record(
    `All ${Object.keys(STORY_TERMINAL_PAGES).length} Story panels fit horizontally and retain touch-sized actions${storyFailures.length ? `: ${storyFailures.join(", ")}` : ""}`,
    storyFailures.length === 0,
  );
  record(
    `All Story panels retain readable paragraphs and separate navigation${navigationFailures.length ? `: ${navigationFailures.join("; ")}` : ""}`,
    navigationFailures.length === 0,
  );
  const page = Object.values(STORY_TERMINAL_PAGES).reduce(
    (longest, candidate) =>
      candidate.body.join(" ").length > longest.body.join(" ").length
        ? candidate
        : longest,
  );
  shell.showStoryTerminal({ nodeId: page.id, page, transcript: false });
  await settle();
  await checkScrolling("Long Story panel", get(".qb-terminal-body"));
  const retryPage = Object.values(STORY_TERMINAL_PAGES).find(
    (candidate) => candidate.actions.length === 2,
  )!;
  shell.showStoryTerminal({
    nodeId: retryPage.id,
    page: retryPage,
    transcript: false,
  });
  await settle();
  for (const action of retryPage.actions) {
    get(`[data-terminal-action="${action.id}"]`).click();
    record(
      `Story ${action.label} remains independently selectable`,
      terminalAction === action.id,
    );
  }
  const back = get(".qb-mobile-story-back");
  back.click();
  await settle();
  record(
    "Story Back returns to Home",
    get(".qb-shell").dataset["page"] === "main",
  );
  shell.updateSave({
    ...save,
    settings: { ...save.settings, reducedMotion: false },
  });
  shell.showStoryTerminal({ nodeId: page.id, page, transcript: false });
  await settle();
  record(
    "Story Back stays the same target while text types",
    get(".qb-mobile-story-back") === back,
  );
  back.click();
  await settle();
  record(
    "Story Back works during typing",
    get(".qb-shell").dataset["page"] === "main",
  );
  shell.updateSave({
    ...save,
    settings: { ...save.settings, reducedMotion: true },
  });
  shell.showPage("settings");
  await settle();
  shell.beginQong("cpu", "arcade");
  await settle();
  record(
    "Reading cues do not overlay gameplay",
    !visible(get(".qb-mobile-scroll-controls")),
  );
  shell.exitCabinet();
  shell.showPage("settings");
  await settle();
  document.documentElement.dataset["mobile"] = "false";
  await settle();
  record(
    "Desktop retains its own presentation without mobile cues",
    !visible(get(".qb-mobile-scroll-controls")),
  );
  document.documentElement.dataset["mobile"] = "true";
  await settle();
  summary.textContent = `${passed}/${total} checks passed at ${innerWidth} × ${innerHeight}`;
}
document
  .querySelector<HTMLButtonElement>("#run")!
  .addEventListener("click", () => {
    summary.textContent = "Running";
    void run().catch((error) => {
      summary.textContent = String(error);
    });
  });
window.addEventListener("beforeunload", () => {
  touch.destroy();
  input.dispose();
  shell.destroy();
});
