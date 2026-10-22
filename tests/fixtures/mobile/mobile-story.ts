import { QuantumBoxShell } from "../../../src/ui/QuantumBoxShell";
import { QUANTUM_BOX_ASSETS } from "../../../src/assets/manifest";
import { createDefaultSave } from "../../../src/save/types";
import { STORY_TERMINAL_PAGES } from "../../../src/story/terminal";
import { InputController } from "../../../src/input/InputController";
import { TouchControls } from "../../../src/mobile/TouchControls";
import "../../../src/styles.css";
import "../../../src/display/brownBox.css";
import "../../../src/mobile/mobile.css";

// Layout-only fixture: no repository, score writes, unlocks, or game execution.
const root = document.querySelector<HTMLElement>("#app")!;
const picker = document.querySelector<HTMLSelectElement>("select")!;
const pages = Object.values(STORY_TERMINAL_PAGES);
const save = createDefaultSave();
const noAction = () => {};
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
    onStoryTerminalAction: () => {
      picker.selectedIndex = (picker.selectedIndex + 1) % pages.length;
      show();
    },
    onOpenTerminalTranscript: noAction,
    onRetryTerminalChapter: noAction,
    onLaunchArcade: noAction,
    onSettingChanged: noAction,
    onArcadeScoreInitialsSubmitted: noAction,
    onExportSave: noAction,
    onResetSave: noAction,
    onCabinetAction: noAction,
    onFluxballLobbyAction: noAction,
  },
);
const input = new InputController(window, document);
const touch = new TouchControls(root, input);
for (const [index, page] of pages.entries()) {
  const option = document.createElement("option");
  option.value = page.id;
  option.textContent = `${index + 1}/${pages.length} ${page.id}`;
  picker.append(option);
}
const requestedPanel = new URLSearchParams(location.search).get("panel");
if (requestedPanel && pages.some((page) => page.id === requestedPanel))
  picker.value = requestedPanel;
if (new URLSearchParams(location.search).has("capture"))
  picker.closest<HTMLElement>(".review-panel-picker")!.hidden = true;
function show() {
  const page = pages[picker.selectedIndex]!;
  shell.showStoryTerminal({ nodeId: page.id, page, transcript: false });
}
picker.addEventListener("change", show);
const style = document.createElement("style");
style.textContent = `.review-panel-picker { position: fixed; bottom: 8px; right: 16px; z-index: 60; display: flex; align-items: center; gap: 8px; color: #d6bd8b; background: #2b1c14; font: 12px monospace; } .review-panel-picker[hidden] { display: none; } .review-panel-picker select { height: 40px; max-width: 240px; color: inherit; background: inherit; border: 1px solid currentColor; }`;
document.head.append(style);
shell.enterInternal();
show();
window.addEventListener("beforeunload", () => {
  touch.destroy();
  input.dispose();
  shell.destroy();
});
