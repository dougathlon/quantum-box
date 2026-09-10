import { storyTextLayout } from "../display/StoryTextLayout";
import { terminalTextWidth } from "../display/TerminalTypeface";
import { ARCADE_INSTRUCTIONS } from "./ArcadeInstructions";
import type {
  ArcadeCabinetId,
  GameId,
  ShippedArcadeCabinetId,
  StoryChapterId,
} from "../games/registry";
import {
  ARCADE_CABINET_DEFINITIONS,
  ARCADE_CABINET_IDS,
  STORY_CHAPTER_DEFINITIONS,
  STORY_CHAPTER_IDS,
  isArcadeCabinetId,
  isShippedArcadeCabinetId,
} from "../games/registry";
import type { QuantumBoxSave, QuantumBoxSettings } from "../save/types";
import {
  ARCADE_RECORD_LIMIT,
  quantmanArcadeOverallBoard,
  type QuantmanArcadeMechanic,
  type QuantmanArcadeRecord,
  type SkiPixlArcadeDifficulty,
  type SkiPixlArcadeRecord,
} from "../save/ArcadeRecords";
import { type QongOpponent, type QongSnapshot } from "../games/qong/types";
import { qongHudModel } from "../games/qong/presentation";
import type { SkiPixlSnapshot } from "../games/skipixl/types";
import { findInstalledSkiPixlPack } from "../games/skipixl/SkiPixlCourseAdapter";
import {
  formatSkiPixlTime,
  skiPixlNotice,
} from "../games/skipixl/presentation";
import type { FluxballFormat, FluxballSnapshot } from "../games/fluxball/types";
import {
  fluxballCompletionLabel,
  fluxballHudModel,
} from "../games/fluxball/presentation";
import type { PlayerId } from "../games/fluxball/standalone/modes";
import type { QuantmanSyntheticRuntimeSnapshot } from "../games/quantmanSynthetic";
import quantmanQpuBankArtifact from "../games/quantmanSynthetic/data/quantman-labyrinth-ibm-fez-bank-v3.json" with { type: "json" };
import { quantmanSyntheticHudModel } from "../display/views/QuantmanSyntheticView";
import type { FrameReport } from "../core/FrameMonitor";
import type { InputResponseReport } from "../core/InputResponseMonitor";
import {
  DEFAULT_ARCADE_RUN_SEED,
  parseArcadeRunSeed,
  type ArcadeRunOrigin,
  type ArcadeLaunchOptions,
} from "../app/arcade";
import { BitmapDomTextRenderer } from "../display/BitmapDomText";
import { requireCanonicalAsset } from "../assets/CanonicalRuntimeAssets";
import {
  BrownBoxViewportField,
  type BrownBoxViewportFieldAsset,
} from "../display/BrownBoxViewportField";
import { BrownBoxTitleField } from "../display/BrownBoxTitleField";
import {
  BROWN_BOX_BACKGROUND_PROGRAMMES,
  type BrownBoxBackgroundProgrammeId,
} from "../display/backgrounds/BrownBoxBackgroundPrograms";
import type { QuagSnapshot } from "../games/quag/types";
import { quagHudModel, quagHuntRows } from "../games/quag/presentation";
import { requireQGraphCabinetFrame } from "../assets/QGraphCabinetAssets";
import {
  DEFAULT_KEYBOARD_BINDINGS,
  KEYBOARD_CONTROLS,
  KEYBOARD_PLAYERS,
  displayKeyCode,
  validateKeyboardBindings,
  type KeyboardControl,
} from "../input/KeyboardBindings";
import {
  chapterStages,
  earliestUnclearedStage,
  type StoryTerminalActionId,
  type StoryTerminalView,
} from "../story/terminal";

export type ShellPage =
  | "main"
  | "story-start"
  | "arcade"
  | "arcade-detail"
  | "scores"
  | "terminal"
  | "story-terminal"
  | "settings"
  | "developer"
  | "credits";

export interface QuantumBoxShellActions {
  readonly onStartGesture: () => void;
  readonly onInternalEntered: () => void;
  readonly onTitleReturned: () => void;
  readonly onPageChanged: (page: ShellPage) => void;
  readonly onContinueStory: () => void;
  readonly onNewStory: () => void;
  readonly onStoryTerminalAction: (
    action: StoryTerminalActionId,
    nodeId: string,
  ) => void;
  readonly onOpenTerminalTranscript: (chapterId: StoryChapterId) => void;
  readonly onRetryTerminalChapter: (chapterId: StoryChapterId) => void;
  readonly onLaunchArcade: (
    gameId: ArcadeCabinetId,
    mode: string,
    options: ArcadeLaunchOptions,
  ) => void;
  readonly onSettingChanged: (change: Partial<QuantumBoxSettings>) => void;
  readonly onArcadeScoreInitialsSubmitted: (
    recordedSequence: number,
    initials: string,
  ) => void;
  readonly onExportSave: () => void;
  readonly onResetSave: () => void;
  readonly onCabinetAction: (
    action:
      | "observe"
      | "continue"
      | "replay"
      | "restart"
      | "export"
      | "pause"
      | "back",
  ) => void;
  readonly onFluxballLobbyAction: (
    action:
      | Readonly<{ kind: "toggle"; playerId: PlayerId }>
      | Readonly<{ kind: "start" | "cancel" }>,
  ) => void;
}

const PAGE_TITLES: Readonly<Record<ShellPage, string>> = {
  main: "HOME",
  "story-start": "STORY",
  arcade: "ARCADE",
  "arcade-detail": "ARCADE",
  scores: "SCORES",
  terminal: "TERMINAL",
  "story-terminal": "STORY",
  settings: "SETTINGS",
  developer: "DEVELOPER",
  credits: "SOURCE",
};

type SettingsSection = "display" | "background" | "controls" | "data";

export type MenuDirection = "up" | "down" | "left" | "right";

const SCORE_INITIAL_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";

export interface ArcadeScoreboardRequest {
  readonly gameId: "skipixl" | "quantman";
  readonly mode: string;
  readonly highlightRecordSequence: number | null;
  readonly resultLabel: string | null;
  readonly initialsEditable: boolean;
}

export class QuantumBoxShell {
  private readonly shell: HTMLElement;
  private readonly title: HTMLElement;
  private readonly internal: HTMLElement;
  private readonly pageRoot: HTMLElement;
  private readonly screenHeader: HTMLElement;
  private readonly screenFooter: HTMLElement;
  private readonly gameUi: HTMLElement;
  private readonly qongUi: HTMLElement;
  private readonly skipixlUi: HTMLElement;
  private readonly fluxballUi: HTMLElement;
  private readonly quantmanUi: HTMLElement;
  private readonly quagUi: HTMLElement;
  private readonly status: HTMLOutputElement;
  private readonly bitmapText: BitmapDomTextRenderer;
  private readonly titleField: BrownBoxTitleField;
  private readonly viewportField: BrownBoxViewportField;
  private readonly scrollPositionObserver: ResizeObserver;
  private save: QuantumBoxSave;
  private page: ShellPage = "main";
  private entered = false;
  private cabinetActive = false;
  private cabinetPlayMode: "story" | "arcade" = "arcade";
  private terminalView: StoryTerminalView | null = null;
  private terminalSheets: readonly StoryTerminalView[] = [];
  private terminalSheetIndex = 0;
  private terminalVisibleCharacters = 0;
  private terminalTypingTimer: number | null = null;
  private settingsSection: SettingsSection = "display";
  private settingsPlayerId: PlayerId = "A";
  private arcadeRunSeed = DEFAULT_ARCADE_RUN_SEED;
  private arcadeRunOrigin: ArcadeRunOrigin =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has("qa")
      ? "developer-qa"
      : "player-arcade";
  private storyUnavailableMessage: string | null = null;
  private arcadeScoreboard: ArcadeScoreboardRequest | null = null;
  private arcadeInitialsDraft: [string, string, string];
  private arcadeInitialsSlot = 0;
  private selectedArcadeCabinet: ShippedArcadeCabinetId | null = null;
  private fluxballLobbyOpen = false;
  private backgroundActivationGeneration = 0;
  private pendingBinding: {
    readonly playerId: PlayerId;
    readonly control: KeyboardControl;
  } | null = null;
  private lastContentControl: HTMLElement | null = null;

  public constructor(
    private readonly root: HTMLElement,
    fieldAssets: readonly BrownBoxViewportFieldAsset[],
    initialSave: QuantumBoxSave,
    private readonly actions: QuantumBoxShellActions,
  ) {
    this.save = initialSave;
    this.arcadeInitialsDraft = initialsCharacters(
      initialSave.settings.arcadeInitials,
    );
    root.innerHTML = shellMarkup();
    this.shell = required(root, ".qb-shell");
    this.title = required(root, ".qb-title");
    this.internal = required(root, ".qb-internal");
    this.pageRoot = required(root, "[data-ui='page']");
    this.screenHeader = required(root, ".qb-screen-header");
    this.screenFooter = required(root, ".qb-screen-footer");
    this.gameUi = required(root, "[data-ui='game']");
    this.qongUi = required(this.gameUi, "[data-cabinet='qong']");
    this.skipixlUi = required(this.gameUi, "[data-cabinet='skipixl']");
    this.fluxballUi = required(this.gameUi, "[data-cabinet='fluxball']");
    this.quantmanUi = required(this.gameUi, "[data-cabinet='quantman']");
    this.quagUi = required(this.gameUi, "[data-cabinet='quag']");
    this.status = required(root, "[data-ui='status']");
    this.viewportField = new BrownBoxViewportField(
      this.internal,
      required(root, ".qb-screen-frame"),
      fieldAssets,
      initialSave.settings.reducedMotion,
    );
    this.titleField = new BrownBoxTitleField(
      required(this.title, ".qb-title-layers"),
      fieldAssets,
      initialSave.settings.reducedMotion,
    );
    this.bitmapText = new BitmapDomTextRenderer(
      required(root, ".qb-screen-frame"),
      required(root, "[data-ui='bitmap-text']"),
      Object.freeze([
        this.screenHeader,
        this.pageRoot,
        this.screenFooter,
        this.gameUi,
        this.status,
      ]),
    );
    this.shell.dataset["reducedMotion"] = String(
      initialSave.settings.reducedMotion,
    );
    this.shell.dataset["flicker"] = String(initialSave.settings.crtFlicker);
    this.shell.dataset["page"] = this.page;
    root.addEventListener("click", this.onClick);
    root.addEventListener("change", this.onChange);
    root.addEventListener("submit", this.onSubmit);
    root.addEventListener("scroll", this.onScroll, true);
    root.addEventListener("focusin", this.onFocusIn);
    root.addEventListener("keydown", this.onKeyDown);
    this.scrollPositionObserver = new ResizeObserver(() =>
      this.updateScrollPosition(),
    );
    this.renderPage();
    if (
      initialSave.settings.backgroundProgrammeId !== "current-four-state-v1"
    ) {
      void this.activateBackgroundProgramme(
        initialSave.settings.backgroundProgrammeId,
      ).catch((error: unknown) => {
        this.announce(
          error instanceof Error
            ? `Background field retained STANDARD · ${error.message}`
            : "Background field retained STANDARD.",
        );
      });
    }
  }

  public async activateBackgroundProgramme(
    programmeId: BrownBoxBackgroundProgrammeId,
  ): Promise<boolean> {
    const generation = ++this.backgroundActivationGeneration;
    const loaded = await import(
      "../display/backgrounds/BrownBoxBackgroundPrograms"
    ).then(({ preloadBrownBoxBackgroundProgramme }) =>
      preloadBrownBoxBackgroundProgramme(programmeId),
    );
    if (generation !== this.backgroundActivationGeneration) return false;
    const startedAtMs = performance.now();
    this.titleField.setProgramme(loaded, startedAtMs);
    this.viewportField.setProgramme(loaded, startedAtMs);
    return true;
  }

  public enterInternal(): void {
    if (this.entered) return;
    this.status.textContent = "";
    this.actions.onStartGesture();
    this.entered = true;
    this.shell.dataset["surface"] = "internal";
    this.title.hidden = true;
    this.internal.hidden = false;
    this.actions.onInternalEntered();
    this.focusPageTarget();
    this.bitmapText.renderNow();
  }

  public returnToTitle(): void {
    if (!this.entered || this.cabinetActive) return;
    this.status.textContent = "";
    this.entered = false;
    this.page = "main";
    this.storyUnavailableMessage = null;
    this.shell.dataset["surface"] = "title";
    this.internal.hidden = true;
    this.title.hidden = false;
    this.actions.onTitleReturned();
    required<HTMLButtonElement>(
      this.title,
      "[data-action='press-start']",
    ).focus();
  }

  public showPage(page: ShellPage): void {
    if (!this.entered || this.cabinetActive) return;
    this.status.textContent = "";
    this.storyUnavailableMessage = null;
    if (page === "arcade") this.selectedArcadeCabinet = null;
    if (page !== "story-terminal") this.stopTerminalTyping();
    if (page !== "scores") this.arcadeScoreboard = null;
    this.page = page;
    this.actions.onPageChanged(page);
    this.renderPage();
    this.focusPageTarget();
  }

  public showStoryUnavailable(message: string): void {
    if (!this.entered || this.cabinetActive) return;
    this.status.textContent = "";
    this.storyUnavailableMessage = message;
    this.page = "story-terminal";
    this.actions.onPageChanged(this.page);
    this.terminalView = null;
    this.renderPage();
    this.focusPageTarget();
  }

  public showStoryTerminal(view: StoryTerminalView): void {
    if (!this.entered || this.cabinetActive) return;
    this.status.textContent = "";
    this.storyUnavailableMessage = null;
    const layout = storyTextLayout(view.page);
    this.terminalSheets = [
      { ...view, page: { ...view.page, body: layout.body } },
    ];
    this.terminalSheetIndex = 0;
    this.terminalView = this.terminalSheets[0]!;
    this.page = "story-terminal";
    this.actions.onPageChanged(this.page);
    this.startTerminalTyping();
  }

  public showFluxballLobby(
    format: FluxballFormat,
    humanPlayerIds: readonly PlayerId[],
  ): void {
    if (!this.entered || this.cabinetActive) return;
    this.fluxballLobbyOpen = true;
    this.selectedArcadeCabinet = "fluxball";
    this.page = "arcade-detail";
    this.actions.onPageChanged(this.page);
    this.shell.dataset["page"] = "arcade-detail";
    this.pageRoot.innerHTML = fluxballLobbyMarkup(
      format,
      humanPlayerIds,
      this.save,
    );
    required<HTMLButtonElement>(
      this.pageRoot,
      "[data-action='lobby-start']",
    ).focus();
    this.bitmapText.renderNow();
  }

  public closeFluxballLobby(): void {
    if (!this.fluxballLobbyOpen) return;
    this.fluxballLobbyOpen = false;
    this.renderPage();
    this.focusPageTarget();
  }

  public showArcadeScoreboard(request: ArcadeScoreboardRequest): void {
    if (!this.entered || this.cabinetActive) return;
    requireArcadeScoreboardMode(request.gameId, request.mode);
    this.arcadeScoreboard = Object.freeze({ ...request });
    if (request.initialsEditable) {
      this.arcadeInitialsDraft = initialsCharacters(
        this.save.settings.arcadeInitials,
      );
      this.arcadeInitialsSlot = 0;
    }
    this.page = "scores";
    this.actions.onPageChanged(this.page);
    this.renderPage();
    this.focusPageTarget();
  }

  public confirmArcadeScoreInitials(save: QuantumBoxSave): void {
    const scoreboard = this.arcadeScoreboard;
    if (!scoreboard || scoreboard.highlightRecordSequence === null) return;
    this.save = save;
    this.arcadeInitialsDraft = initialsCharacters(save.settings.arcadeInitials);
    this.arcadeScoreboard = Object.freeze({
      ...scoreboard,
      resultLabel: "SCORE RECORDED",
      initialsEditable: false,
    });
    this.renderPage();
    this.focusPageTarget();
  }

  public activateFocusedControl(): void {
    if (!this.entered || this.cabinetActive) return;
    if (this.page === "story-terminal" && !this.terminalTypingComplete()) {
      this.completeTerminalTyping();
      return;
    }
    const active = document.activeElement;
    if (
      (active instanceof HTMLButtonElement ||
        active instanceof HTMLInputElement ||
        active instanceof HTMLSelectElement) &&
      this.root.contains(active) &&
      isFocusableControl(active)
    ) {
      active.click();
      return;
    }
    this.focusPageTarget();
  }

  public moveMenuFocus(direction: MenuDirection): void {
    if (!this.entered || this.cabinetActive) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement &&
      active.type === "range" &&
      (direction === "left" || direction === "right")
    ) {
      if (direction === "right") active.stepUp();
      else active.stepDown();
      active.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (
      active instanceof HTMLButtonElement &&
      active.matches("[data-initial-slot]") &&
      (direction === "up" || direction === "down")
    ) {
      const slot = Number(active.dataset["initialSlot"]);
      if (Number.isInteger(slot)) {
        this.adjustInitialsSlot(slot, direction === "up" ? 1 : -1);
      }
      return;
    }
    const controls = this.focusableControls();
    if (controls.length === 0) return;
    const current = active instanceof HTMLElement ? active : null;
    const next =
      spatialFocusTarget(controls, current, direction) ?? controls[0];
    next?.focus();
    next?.scrollIntoView({ block: "nearest" });
  }

  private focusableControls(): HTMLElement[] {
    return [
      ...this.root.querySelectorAll<HTMLElement>(
        "button, input:not([type='hidden']), select, summary, [role='button'][tabindex]",
      ),
    ].filter((control) => isFocusableControl(control));
  }

  public handleBack(): void {
    if (!this.entered) return;
    if (this.fluxballLobbyOpen) {
      this.actions.onFluxballLobbyAction({ kind: "cancel" });
      return;
    }
    if (this.cabinetActive) {
      this.actions.onCabinetAction("back");
      return;
    }
    if (this.page === "main") this.returnToTitle();
    else if (this.page === "story-start") this.showPage("main");
    else if (this.page === "scores") this.returnFromArcadeSubpage();
    else if (this.page === "arcade-detail") this.showPage("arcade");
    else if (this.page === "developer" || this.page === "credits") {
      this.showPage("settings");
    } else if (this.page === "story-terminal") {
      this.terminalView = null;
      this.showPage("main");
    } else this.showPage("main");
  }

  private returnFromArcadeSubpage(): void {
    if (this.selectedArcadeCabinet) this.showPage("arcade-detail");
    else this.showPage("arcade");
  }

  public updateSave(save: QuantumBoxSave): void {
    const focusedIndex = this.focusableControls().indexOf(
      document.activeElement as HTMLElement,
    );
    this.save = save;
    this.shell.dataset["reducedMotion"] = String(save.settings.reducedMotion);
    this.titleField.setReducedMotion(save.settings.reducedMotion);
    this.viewportField.setReducedMotion(save.settings.reducedMotion);
    this.shell.dataset["flicker"] = String(save.settings.crtFlicker);
    this.renderPage();
    if (this.page === "settings" && focusedIndex >= 0) {
      this.focusableControls()[focusedIndex]?.focus();
    }
  }

  public resetPlayerState(save: QuantumBoxSave): void {
    this.save = save;
    this.terminalView = null;
    this.stopTerminalTyping();
    this.settingsSection = "display";
    this.settingsPlayerId = "A";
    this.arcadeRunSeed = DEFAULT_ARCADE_RUN_SEED;
    this.arcadeRunOrigin =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).has("qa")
        ? "developer-qa"
        : "player-arcade";
    this.storyUnavailableMessage = null;
    this.arcadeScoreboard = null;
    this.selectedArcadeCabinet = null;
    this.fluxballLobbyOpen = false;
    this.pendingBinding = null;
    this.page = "main";
    this.shell.dataset["reducedMotion"] = String(save.settings.reducedMotion);
    this.titleField.setReducedMotion(save.settings.reducedMotion);
    this.viewportField.setReducedMotion(save.settings.reducedMotion);
    this.shell.dataset["flicker"] = String(save.settings.crtFlicker);
    this.renderPage();
    this.focusPageTarget();
  }

  public beginQong(
    opponent: QongOpponent,
    playMode: "story" | "arcade" = "arcade",
  ): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.cabinetPlayMode = playMode;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "qong";
    this.qongUi.hidden = false;
    this.skipixlUi.hidden = true;
    this.fluxballUi.hidden = true;
    this.quantmanUi.hidden = true;
    this.quagUi.hidden = true;
    required(this.gameUi, "[data-qong='left-label']").textContent =
      opponent === "cpu" ? "YOU" : "P1";
    required(this.gameUi, "[data-qong='right-label']").textContent =
      opponent === "cpu" ? "CPU" : "P2";
    required<HTMLButtonElement>(
      this.gameUi,
      "[data-action='qong-observe']",
    ).focus();
  }

  public beginSkiPixl(playMode: "story" | "arcade" = "arcade"): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.cabinetPlayMode = playMode;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "skipixl";
    this.qongUi.hidden = true;
    this.skipixlUi.hidden = false;
    this.fluxballUi.hidden = true;
    this.quantmanUi.hidden = true;
    this.quagUi.hidden = true;
    required<HTMLButtonElement>(
      this.skipixlUi,
      "[data-action='skipixl-pause']",
    ).focus();
  }

  public beginFluxball(playMode: "story" | "arcade" = "arcade"): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.cabinetPlayMode = playMode;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "fluxball";
    this.qongUi.hidden = true;
    this.skipixlUi.hidden = true;
    this.fluxballUi.hidden = false;
    this.quantmanUi.hidden = true;
    this.quagUi.hidden = true;
    clearFluxballReveal(this.fluxballUi);
    required<HTMLButtonElement>(
      this.fluxballUi,
      "[data-action='fluxball-pause']",
    ).focus();
  }

  public beginQuantman(playMode: "story" | "arcade" = "arcade"): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.cabinetPlayMode = playMode;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "quantman";
    this.qongUi.hidden = true;
    this.skipixlUi.hidden = true;
    this.fluxballUi.hidden = true;
    this.quantmanUi.hidden = false;
    this.quagUi.hidden = true;
    required<HTMLButtonElement>(
      this.quantmanUi,
      "[data-action='quantman-pause']",
    ).focus();
  }

  public updateQuantmanSyntheticHud(
    snapshot: QuantmanSyntheticRuntimeSnapshot,
    paused: boolean,
  ): void {
    if (!this.cabinetActive || this.gameUi.dataset["cabinet"] !== "quantman") {
      return;
    }
    const hud = quantmanSyntheticHudModel(snapshot, paused);
    this.gameUi.dataset["phase"] = hud.phase.toLowerCase().replaceAll(" ", "-");
    required(this.quantmanUi, "[data-quantman='fragments']").textContent =
      hud.remaining;
    required(this.quantmanUi, "[data-quantman='time']").textContent = hud.mode;
    required(this.quantmanUi, "[data-quantman='lives']").textContent =
      `LIVES ${hud.lives}`;
    required(this.quantmanUi, "[data-quantman='state']").textContent =
      `SCORE ${hud.score} · ${hud.phase}`;
    required(this.quantmanUi, "[data-quantman='focus']").textContent =
      `${hud.gaze} · ${hud.sourceClassification}`;
    required(this.quantmanUi, "[data-quantman='notice']").textContent =
      hud.announcement;
    const complete = snapshot.terminal !== null;
    const retry = required<HTMLButtonElement>(
      this.quantmanUi,
      "[data-action='quantman-replay']",
    );
    retry.textContent = "RETRY · X / X";
    retry.hidden = !complete || this.cabinetPlayMode === "story";
    required<HTMLButtonElement>(
      this.quantmanUi,
      "[data-action='quantman-continue']",
    ).hidden = !complete;
    required<HTMLButtonElement>(
      this.quantmanUi,
      "[data-action='quantman-pause']",
    ).hidden = complete;
  }

  public beginQuag(playMode: "story" | "arcade" = "arcade"): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.cabinetPlayMode = playMode;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "quag";
    this.qongUi.hidden = true;
    this.skipixlUi.hidden = true;
    this.fluxballUi.hidden = true;
    this.quantmanUi.hidden = true;
    this.quagUi.hidden = false;
    required<HTMLButtonElement>(
      this.quagUi,
      "[data-action='quag-pause']",
    ).focus();
  }

  public updateQuagHud(snapshot: QuagSnapshot, paused: boolean): void {
    if (!this.cabinetActive || this.gameUi.dataset["cabinet"] !== "quag")
      return;
    const hud = quagHudModel(snapshot, paused);
    this.gameUi.dataset["phase"] = paused ? "paused" : snapshot.phase;
    required(this.quagUi, "[data-quag='time']").textContent = hud.time;
    required(this.quagUi, "[data-quag='score']").textContent = hud.score;
    required(this.quagUi, "[data-quag='phase']").textContent = hud.phase;
    required(this.quagUi, "[data-quag='targets']").textContent =
      quagHuntRows(snapshot).join(" · ");
    required(this.quagUi, "[data-quag='notice']").textContent = hud.notice;
    const complete = snapshot.phase === "complete";
    required<HTMLButtonElement>(
      this.quagUi,
      "[data-action='quag-replay']",
    ).hidden = !complete || this.cabinetPlayMode === "story";
    required<HTMLButtonElement>(
      this.quagUi,
      "[data-action='quag-continue']",
    ).hidden = !complete;
    required<HTMLButtonElement>(
      this.quagUi,
      "[data-action='quag-restart']",
    ).hidden = !paused || complete;
    required<HTMLButtonElement>(
      this.quagUi,
      "[data-action='quag-pause']",
    ).hidden = complete;
    required<HTMLElement>(this.quagUi, "[data-quag='controls']").hidden =
      snapshot.phase !== "ready";
  }

  public updateFluxballHud(
    snapshot: FluxballSnapshot,
    paused: boolean,
    playMode: "story" | "arcade",
    _revealHistoryPage = 0,
  ): void {
    if (!this.cabinetActive || this.gameUi.dataset["cabinet"] !== "fluxball")
      return;
    const hud = fluxballHudModel(snapshot, paused);
    this.gameUi.dataset["phase"] = paused ? "paused" : snapshot.phase;
    required(this.fluxballUi, "[data-fluxball='round']").textContent =
      hud.round;
    required(this.fluxballUi, "[data-fluxball='time']").textContent = hud.time;
    required(this.fluxballUi, "[data-fluxball='format']").textContent = "";
    required(this.fluxballUi, "[data-fluxball='controls']").textContent =
      snapshot.phase === "active"
        ? fluxballControlSummary(snapshot, this.save)
        : "";
    for (const playerId of ["A", "B", "C", "D"] as const) {
      const score = required(
        this.fluxballUi,
        `[data-fluxball-score='${playerId}']`,
      );
      score.textContent = `G ${hud.goals[playerId]} · W ${hud.roundWins[playerId]}`;
      score.parentElement?.toggleAttribute(
        "hidden",
        !hud.activePlayerIds.includes(playerId),
      );
    }

    const notice = required(this.fluxballUi, "[data-fluxball='notice']");
    const pauseButton = required<HTMLButtonElement>(
      this.fluxballUi,
      "[data-action='fluxball-pause']",
    );
    const continueButton = required<HTMLButtonElement>(
      this.fluxballUi,
      "[data-action='fluxball-continue']",
    );
    const replayButton = required<HTMLButtonElement>(
      this.fluxballUi,
      "[data-action='fluxball-replay']",
    );
    pauseButton.hidden = snapshot.phase !== "active";
    continueButton.hidden = snapshot.phase === "active";
    replayButton.hidden =
      snapshot.phase !== "complete" || this.cabinetPlayMode === "story";

    if (snapshot.phase === "active") {
      renderFluxballLiveDisclosure(this.fluxballUi, snapshot);
      notice.textContent = hud.notice;
      return;
    }
    if (snapshot.phase === "reveal" && snapshot.reveal) {
      notice.textContent = hud.notice;
      continueButton.textContent =
        snapshot.roundNumber === snapshot.totalRounds
          ? "COMPLETE MATCH · SPACE / A"
          : "NEXT ROUND · SPACE / A";
      renderFluxballSemanticHistory(this.fluxballUi, snapshot);
      return;
    }
    clearFluxballReveal(this.fluxballUi);
    notice.textContent = hud.notice;
    const resultLabel = fluxballCompletionLabel(playMode, snapshot.humanWon);
    required(this.fluxballUi, "[data-fluxball='reveal']").innerHTML =
      `<section class="qb-fluxball-final"><strong>${resultLabel}</strong><span>${fluxballScoreLine(snapshot)}</span></section>`;
    continueButton.textContent =
      playMode === "story" ? "CONTINUE · SPACE / A" : "EXIT · SPACE / A";
  }

  public updateSkiPixlHud(snapshot: SkiPixlSnapshot, paused: boolean): void {
    if (!this.cabinetActive || this.gameUi.dataset["cabinet"] !== "skipixl")
      return;
    required(this.skipixlUi, "[data-skipixl='time']").textContent =
      formatSkiPixlTime(snapshot.elapsedSeconds);
    required(this.skipixlUi, "[data-skipixl='limit']").textContent =
      formatSkiPixlTime(snapshot.targetSeconds);
    required(this.skipixlUi, "[data-skipixl='distance']").textContent = String(
      Math.max(0, Math.ceil(snapshot.courseLength - snapshot.distance)),
    ).padStart(3, "0");
    required(this.skipixlUi, "[data-skipixl='notice']").textContent =
      skiPixlNotice(snapshot, paused);
    this.gameUi.dataset["phase"] = paused ? "paused" : snapshot.phase;
    const complete = snapshot.phase === "complete";
    required<HTMLButtonElement>(
      this.skipixlUi,
      "[data-action='skipixl-replay']",
    ).hidden = !complete || this.cabinetPlayMode === "story";
    required<HTMLButtonElement>(
      this.skipixlUi,
      "[data-action='skipixl-continue']",
    ).hidden = !complete;
    required<HTMLButtonElement>(
      this.skipixlUi,
      "[data-action='skipixl-pause']",
    ).hidden = complete;
  }

  public updateQongHud(
    snapshot: QongSnapshot,
    opponent: QongOpponent,
    paused: boolean,
  ): void {
    if (!this.cabinetActive) return;
    const hud = qongHudModel(snapshot, opponent, paused);
    required(this.gameUi, "[data-qong='left-score']").textContent =
      hud.leftScore;
    required(this.gameUi, "[data-qong='right-score']").textContent =
      hud.rightScore;
    required(this.gameUi, "[data-qong='round']").textContent = hud.round;
    required(this.gameUi, "[data-qong='rule-state']").textContent =
      hud.ruleState;
    required(this.gameUi, "[data-qong='goal']").textContent = hud.goal;
    required(this.gameUi, "[data-qong='winner']").textContent = hud.winner;
    const notice = required(this.gameUi, "[data-qong='notice']");
    notice.textContent = hud.notice;
    this.gameUi.dataset["phase"] = paused ? "paused" : snapshot.phase;
    const observeButton = required<HTMLButtonElement>(
      this.gameUi,
      "[data-action='qong-observe']",
    );
    const replayButton = required<HTMLButtonElement>(
      this.gameUi,
      "[data-action='qong-replay']",
    );
    observeButton.disabled =
      snapshot.phase !== "complete" &&
      (snapshot.phase === "between-rallies" ||
        snapshot.measurementState !== "unresolved" ||
        snapshot.observationsRemaining === 0);
    observeButton.textContent =
      snapshot.phase === "complete"
        ? this.cabinetPlayMode === "story"
          ? "CONTINUE · SPACE / A"
          : "RETRY · SPACE / A"
        : "PRESS SPACE / A TO OBSERVE RULES";
    required(this.qongUi, "[data-qong='observations']").textContent =
      snapshot.phase === "complete"
        ? ""
        : `OBS ${snapshot.observationsRemaining}`;
    replayButton.hidden =
      snapshot.phase !== "complete" || this.cabinetPlayMode === "story";
    required<HTMLElement>(
      this.qongUi,
      "[data-qong='movement-controls']",
    ).hidden = snapshot.phase === "complete";
    required<HTMLButtonElement>(
      this.qongUi,
      "[data-action='qong-pause']",
    ).hidden = snapshot.phase === "complete";
  }

  public exitCabinet(): void {
    if (!this.cabinetActive) return;
    this.cabinetActive = false;
    this.cabinetPlayMode = "arcade";
    this.shell.dataset["view"] = "menu";
    this.gameUi.hidden = true;
    this.qongUi.hidden = true;
    this.skipixlUi.hidden = true;
    this.fluxballUi.hidden = true;
    this.quantmanUi.hidden = true;
    this.quagUi.hidden = true;
    this.screenHeader.hidden = false;
    this.pageRoot.hidden = false;
    this.screenFooter.hidden = false;
    this.renderPage();
    this.focusPageTarget();
  }

  public announce(message: string): void {
    this.status.textContent = message;
  }

  public updatePerformance(report: FrameReport): void {
    this.shell.dataset["presentFps"] = report.framesPerSecond.toFixed(1);
    this.shell.dataset["meanFrameMs"] = report.meanFrameMs.toFixed(2);
    this.shell.dataset["worstFrameMs"] = report.worstFrameMs.toFixed(2);
    this.shell.dataset["frameBudgetMisses"] = String(report.frameBudgetMisses);
  }

  public updateInputResponse(report: InputResponseReport): void {
    this.shell.dataset["inputResponseSamples"] = String(report.sampleCount);
    this.shell.dataset["inputResponseMedianMs"] = report.medianMs.toFixed(2);
    this.shell.dataset["inputResponseP95Ms"] = report.p95Ms.toFixed(2);
    this.shell.dataset["inputResponseWorstMs"] = report.worstMs.toFixed(2);
  }

  public getPage(): ShellPage | "title" | "cabinet" {
    return this.cabinetActive ? "cabinet" : this.entered ? this.page : "title";
  }

  public getCanvasHost(): HTMLElement {
    return required(this.root, "#quantum-box-canvas");
  }

  public destroy(): void {
    this.stopTerminalTyping();
    this.titleField.destroy();
    this.viewportField.destroy();
    this.bitmapText.destroy();
    this.scrollPositionObserver.disconnect();
    this.root.removeEventListener("click", this.onClick);
    this.root.removeEventListener("change", this.onChange);
    this.root.removeEventListener("submit", this.onSubmit);
    this.root.removeEventListener("scroll", this.onScroll, true);
    this.root.removeEventListener("focusin", this.onFocusIn);
    this.root.removeEventListener("keydown", this.onKeyDown);
    this.root.replaceChildren();
  }

  private renderPage(): void {
    this.fluxballLobbyOpen = false;
    this.scrollPositionObserver.disconnect();
    this.shell.dataset["page"] = this.page;
    this.pageRoot.innerHTML = pageMarkup(
      this.page,
      this.save,
      this.terminalView,
      this.terminalVisibleCharacters,
      this.arcadeRunSeed,
      this.storyUnavailableMessage,
      this.arcadeScoreboard,
      this.selectedArcadeCabinet,
      this.settingsSection,
      this.settingsPlayerId,
      this.arcadeInitialsDraft.join(""),
    );
    // Primary choices share the terminal reading face; metadata stays compact.
    for (const element of this.pageRoot.querySelectorAll(
      ".qb-primary-menu-row > span, .qb-primary-menu-row strong, .qb-arcade-select-number, .qb-arcade-select-row > strong, .qb-arcade-mode > button, .qb-terminal-index li span, .qb-terminal-index li strong, .qb-settings-sections span, .qb-settings-sections strong, .qb-settings-panel h2, .qb-settings label > span, .qb-settings-page .qb-action, .qb-story-start nav button, .qb-page-panel h1:not(.qb-visually-hidden)",
    )) {
      element.setAttribute("data-bitmap-flow", "");
      element.classList.add("qb-reading-choice");
    }
    const breadcrumb = required(this.root, "[data-ui='breadcrumb']");
    breadcrumb.textContent = PAGE_TITLES[this.page];
    const terminalArticle =
      this.pageRoot.querySelector<HTMLElement>(".qb-terminal-page");
    if (terminalArticle) {
      terminalArticle.dataset["readingSheet"] = String(this.terminalSheetIndex);
      if (this.terminalSheets.length > 1) {
        const position = document.createElement("span");
        position.className = "qb-reading-position";
        position.textContent = `${this.terminalSheetIndex + 1} / ${this.terminalSheets.length}`;
        terminalArticle.append(position);
      }
    }
    const terminalLayout =
      this.page === "story-start" ||
      this.page === "story-terminal" ||
      this.page === "arcade-detail";
    this.screenHeader.hidden = terminalLayout;
    this.screenFooter.hidden = terminalLayout;
    const scrollList =
      this.pageRoot.querySelector<HTMLElement>("[data-scroll-list]");
    if (scrollList) this.scrollPositionObserver.observe(scrollList);
    window.requestAnimationFrame(() =>
      this.updateScrollPosition(scrollList ?? undefined),
    );
  }

  private focusPageTarget(): void {
    window.requestAnimationFrame(() => {
      const selector =
        this.page === "main"
          ? "button[data-page='story-start']"
          : this.page === "story-start"
            ? "button[data-action='continue-story']:not(:disabled), button[data-action='new-story']"
            : this.page === "arcade"
              ? "button[data-action='open-arcade-cabinet']"
              : this.page === "arcade-detail"
                ? "button[data-action='launch-arcade']"
                : this.page === "scores"
                  ? this.arcadeScoreboard?.initialsEditable
                    ? "button[data-initial-slot='0']"
                    : "button[data-action='close-arcade-scores']"
                  : this.page === "terminal"
                    ? "button[data-action='open-terminal-transcript'], button[data-action='retry-terminal-chapter']"
                    : this.page === "story-terminal" &&
                        this.terminalTypingComplete()
                      ? "button[data-action='story-terminal-action']"
                      : this.page === "settings"
                        ? "button[data-action='settings-section'][aria-selected='true']"
                        : this.storyUnavailableMessage
                          ? "button[data-page='arcade']"
                          : "h1";
      const target = this.pageRoot.querySelector<HTMLElement>(selector);
      target?.focus();
      target?.scrollIntoView({ block: "nearest" });
      this.updateScrollPosition();
    });
  }

  private readonly onScroll = (event: Event): void => {
    if (
      event.target instanceof HTMLElement &&
      event.target.matches("[data-scroll-list]")
    ) {
      this.updateScrollPosition(event.target);
    }
  };

  private readonly onFocusIn = (event: FocusEvent): void => {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.matches("[data-initial-slot]")) {
      this.arcadeInitialsSlot = Number(event.target.dataset["initialSlot"]);
    }
    if (
      !event.target.closest(
        "[data-action='back'], [data-action='activate-page-control']",
      )
    ) {
      this.lastContentControl = event.target;
    }
    const list = event.target.closest<HTMLElement>("[data-scroll-list]");
    if (!list) return;
    event.target.scrollIntoView({ block: "nearest" });
    window.requestAnimationFrame(() => this.updateScrollPosition(list));
  };

  private updateScrollPosition(
    list = this.pageRoot.querySelector<HTMLElement>("[data-scroll-list]"),
  ): void {
    const marker = this.pageRoot.querySelector<HTMLElement>(
      "[data-scroll-position]",
    );
    if (!list || !marker) return;
    const maximum = list.scrollHeight - list.clientHeight;
    marker.hidden = maximum <= 1;
    if (maximum <= 1) return;
    const thumb = required<HTMLElement>(marker, "i");
    const height = Math.max(
      12.5,
      (list.clientHeight / list.scrollHeight) * 100,
    );
    const progress = list.scrollTop / maximum;
    thumb.style.height = `${height}%`;
    thumb.style.top = `${progress * (100 - height)}%`;
    marker.dataset["scrollState"] =
      progress <= 0 ? "start" : progress >= 1 ? "end" : "middle";
  }

  private readonly onClick = (event: MouseEvent): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button")
        : null;
    if (!button || button.disabled || !this.root.contains(button)) return;
    const action = button.dataset["action"];
    if (action === "press-start") this.enterInternal();
    else if (action === "continue-story") this.actions.onContinueStory();
    else if (action === "new-story") this.actions.onNewStory();
    else if (action === "back") this.handleBack();
    else if (action === "activate-page-control") {
      this.activateLastContentControl();
    } else if (action === "initials-slot") {
      const slot = Number(button.dataset["initialSlot"]);
      if (Number.isInteger(slot)) this.advanceInitialsSlot(slot);
    } else if (action === "navigate" && isShellPage(button.dataset["page"])) {
      this.showPage(button.dataset["page"]);
    } else if (action === "story-terminal-action") {
      if (!this.terminalTypingComplete()) {
        this.completeTerminalTyping();
        return;
      }
      if (!button.isConnected) return;
      if (this.terminalSheetIndex < this.terminalSheets.length - 1) {
        this.terminalSheetIndex++;
        this.terminalView = this.terminalSheets[this.terminalSheetIndex]!;
        this.startTerminalTyping();
        return;
      }
      const terminalAction = button.dataset["terminalAction"];
      const terminalNode = button.dataset["terminalNode"];
      if (isStoryTerminalAction(terminalAction) && terminalNode) {
        this.actions.onStoryTerminalAction(terminalAction, terminalNode);
      }
    } else if (action === "open-terminal-transcript") {
      const chapterId = button.dataset["chapterId"];
      if (isStoryChapter(chapterId)) {
        this.actions.onOpenTerminalTranscript(chapterId);
      }
    } else if (action === "retry-terminal-chapter") {
      const chapterId = button.dataset["chapterId"];
      if (isStoryChapter(chapterId)) {
        this.actions.onRetryTerminalChapter(chapterId);
      }
    } else if (action === "settings-section") {
      const section = button.dataset["settingsSection"];
      if (isSettingsSection(section)) {
        this.settingsSection = section;
        this.renderPage();
        this.pageRoot
          .querySelector<HTMLButtonElement>(
            `[data-settings-section="${section}"]`,
          )
          ?.focus();
      }
    } else if (action === "settings-player") {
      const playerId = button.dataset["playerId"];
      if (isPlayerId(playerId)) {
        this.settingsPlayerId = playerId;
        this.renderPage();
        this.pageRoot
          .querySelector<HTMLButtonElement>(
            `[data-action="settings-player"][data-player-id="${playerId}"]`,
          )
          ?.focus();
      }
    } else if (action === "open-arcade-cabinet") {
      const gameId = button.dataset["gameId"];
      if (isShippedArcadeCabinetId(gameId)) {
        this.selectedArcadeCabinet = gameId;
        this.showPage("arcade-detail");
      }
    } else if (action === "launch-arcade") {
      const gameId = button.dataset["gameId"];
      const mode = button.dataset["mode"];
      if (isArcadeCabinetId(gameId) && mode) {
        try {
          this.actions.onLaunchArcade(gameId, mode, {
            runSeed: this.arcadeRunSeed,
            localPlayers: 1,
            runOrigin: this.arcadeRunOrigin,
          });
        } catch (error) {
          this.announce(
            error instanceof Error ? error.message : "Invalid Arcade setup.",
          );
        }
      }
    } else if (action === "open-arcade-scores") {
      const gameId = button.dataset["gameId"];
      const mode = button.dataset["mode"];
      if (
        (gameId === "skipixl" || gameId === "quantman") &&
        typeof mode === "string"
      ) {
        this.showArcadeScoreboard({
          gameId,
          mode,
          highlightRecordSequence: null,
          resultLabel: null,
          initialsEditable: false,
        });
      }
    } else if (action === "close-arcade-scores") {
      this.returnFromArcadeSubpage();
    } else if (action === "export-save") this.actions.onExportSave();
    else if (action === "lobby-toggle") {
      const playerId = button.dataset["playerId"];
      if (isPlayerId(playerId)) {
        this.actions.onFluxballLobbyAction({ kind: "toggle", playerId });
      }
    } else if (action === "lobby-start") {
      this.actions.onFluxballLobbyAction({ kind: "start" });
    } else if (action === "lobby-cancel") {
      this.actions.onFluxballLobbyAction({ kind: "cancel" });
    } else if (action === "rebind-key") {
      const playerId = button.dataset["playerId"];
      const control = button.dataset["control"];
      if (isPlayerId(playerId) && isKeyboardControl(control)) {
        this.pendingBinding = { playerId, control };
        button.textContent = "PRESS KEY · ESC CANCEL";
        button.setAttribute("aria-pressed", "true");
        this.announce(`Waiting for Player ${playerId} ${control} key.`);
      }
    } else if (action === "reset-keymap") {
      this.pendingBinding = null;
      this.actions.onSettingChanged({
        keyboardBindings: DEFAULT_KEYBOARD_BINDINGS,
      });
      this.announce("Keyboard bindings restored to defaults.");
    } else if (action === "reset-save") this.actions.onResetSave();
    else if (action === "qong-observe") this.actions.onCabinetAction("observe");
    else if (action === "qong-replay") this.actions.onCabinetAction("replay");
    else if (action === "qong-pause") this.actions.onCabinetAction("pause");
    else if (action === "skipixl-replay")
      this.actions.onCabinetAction("replay");
    else if (action === "skipixl-export")
      this.actions.onCabinetAction("export");
    else if (action === "skipixl-continue")
      this.actions.onCabinetAction("continue");
    else if (action === "skipixl-pause") this.actions.onCabinetAction("pause");
    else if (action === "fluxball-replay")
      this.actions.onCabinetAction("replay");
    else if (action === "fluxball-export")
      this.actions.onCabinetAction("export");
    else if (action === "fluxball-continue")
      this.actions.onCabinetAction("continue");
    else if (action === "fluxball-pause") this.actions.onCabinetAction("pause");
    else if (action === "quantman-replay")
      this.actions.onCabinetAction("replay");
    else if (action === "quantman-export")
      this.actions.onCabinetAction("export");
    else if (action === "quantman-continue")
      this.actions.onCabinetAction("continue");
    else if (action === "quantman-pause") this.actions.onCabinetAction("pause");
    else if (action === "quag-replay") this.actions.onCabinetAction("replay");
    else if (action === "quag-restart") this.actions.onCabinetAction("restart");
    else if (action === "quag-continue")
      this.actions.onCabinetAction("continue");
    else if (action === "quag-pause") this.actions.onCabinetAction("pause");
    else if (action === "cabinet-back") this.actions.onCabinetAction("back");
  };

  private readonly onSubmit = (event: SubmitEvent): void => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches("[data-arcade-score-form]")) return;
    event.preventDefault();
    const input = required<HTMLInputElement>(
      form,
      "[data-arcade-score-initials]",
    );
    const recordedSequence = Number(form.dataset["recordSequence"]);
    if (!Number.isSafeInteger(recordedSequence) || recordedSequence <= 0) {
      return;
    }
    try {
      this.actions.onArcadeScoreInitialsSubmitted(
        recordedSequence,
        input.value,
      );
    } catch (error) {
      this.announce(
        error instanceof Error ? error.message : "Initials were not saved.",
      );
      this.focusInitialsSlot(this.arcadeInitialsSlot);
    }
  };

  private readonly onChange = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.matches("[data-developer-run-seed]")) {
      try {
        this.arcadeRunSeed = parseArcadeRunSeed(input.value);
        this.arcadeRunOrigin = "developer-qa";
        this.announce(`Arcade run seed set to ${this.arcadeRunSeed}.`);
      } catch (error) {
        this.announce(
          error instanceof Error ? error.message : "Invalid Arcade run seed.",
        );
        input.value = String(this.arcadeRunSeed);
        input.focus();
      }
      return;
    }
    const setting = input.dataset["setting"];
    if (
      setting === "backgroundProgrammeId" &&
      input.type === "radio" &&
      input.checked
    ) {
      this.actions.onSettingChanged({
        backgroundProgrammeId: input.value as BrownBoxBackgroundProgrammeId,
      });
      return;
    }
    if (setting === "soundVolume" && input.type === "range") {
      this.actions.onSettingChanged({ soundVolume: Number(input.value) });
      return;
    }
    if (input.type !== "checkbox") return;
    if (
      setting === "reducedMotion" ||
      setting === "crtFlicker" ||
      setting === "soundMuted"
    ) {
      this.actions.onSettingChanged({ [setting]: input.checked });
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      this.entered &&
      !this.cabinetActive &&
      !this.pendingBinding &&
      this.page !== "scores" &&
      this.page !== "story-terminal"
    ) {
      const direction = (
        {
          ArrowUp: "up",
          ArrowDown: "down",
          ArrowLeft: "left",
          ArrowRight: "right",
        } as const
      )[event.code as "ArrowUp"];
      if (direction || event.code === "Enter" || event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        if (direction) this.moveMenuFocus(direction);
        else if (event.code === "Escape") this.handleBack();
        else this.activateFocusedControl();
        return;
      }
    }
    if (
      this.page === "scores" &&
      !this.cabinetActive &&
      this.arcadeScoreboard?.initialsEditable
    ) {
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.returnFromArcadeSubpage();
        return;
      }
      const typed = event.key.toUpperCase();
      if (event.key.length === 1 && SCORE_INITIAL_CHARACTERS.includes(typed)) {
        event.preventDefault();
        event.stopPropagation();
        this.setInitialsSlotCharacter(this.arcadeInitialsSlot, typed);
        this.advanceInitialsSlot(this.arcadeInitialsSlot);
        return;
      }
      if (event.code === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        const previous = Math.max(0, this.arcadeInitialsSlot - 1);
        this.setInitialsSlotCharacter(previous, "-");
        this.arcadeInitialsSlot = previous;
        this.focusInitialsSlot(previous);
        return;
      }
      if (
        event.code === "ArrowUp" ||
        event.code === "ArrowDown" ||
        event.code === "ArrowLeft" ||
        event.code === "ArrowRight"
      ) {
        event.preventDefault();
        event.stopPropagation();
        this.moveMenuFocus(
          event.code === "ArrowUp"
            ? "up"
            : event.code === "ArrowDown"
              ? "down"
              : event.code === "ArrowLeft"
                ? "left"
                : "right",
        );
        return;
      }
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) this.activateFocusedControl();
        return;
      }
    }
    const terminalActionKey =
      event.code === "Enter" ||
      KEYBOARD_PLAYERS.some(
        (playerId) =>
          this.save.settings.keyboardBindings[playerId].action === event.code,
      );
    if (
      this.page === "story-terminal" &&
      !this.cabinetActive &&
      terminalActionKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (!this.terminalTypingComplete()) {
        this.completeTerminalTyping();
        return;
      }
      this.activateFocusedControl();
      return;
    }
    if (!this.pendingBinding || this.page !== "settings") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.code === "Escape") {
      this.pendingBinding = null;
      this.renderPage();
      this.announce("Keyboard binding cancelled.");
      return;
    }
    const { playerId, control } = this.pendingBinding;
    try {
      const keyboardBindings = validateKeyboardBindings({
        ...this.save.settings.keyboardBindings,
        [playerId]: {
          ...this.save.settings.keyboardBindings[playerId],
          [control]: event.code,
        },
      });
      this.pendingBinding = null;
      this.actions.onSettingChanged({ keyboardBindings });
      this.announce(
        `Player ${playerId} ${control} set to ${displayKeyCode(event.code)}.`,
      );
    } catch (error) {
      this.announce(
        error instanceof Error ? error.message : "That key cannot be assigned.",
      );
    }
  };

  private activateLastContentControl(): void {
    const target = this.lastContentControl;
    if (!target?.isConnected || !isFocusableControl(target)) {
      this.focusPageTarget();
      return;
    }
    target.focus();
    if (
      target instanceof HTMLButtonElement ||
      (target instanceof HTMLInputElement &&
        (target.type === "checkbox" || target.type === "radio"))
    ) {
      target.click();
    }
  }

  private adjustInitialsSlot(slot: number, delta: -1 | 1): void {
    if (slot < 0 || slot >= this.arcadeInitialsDraft.length) return;
    const current = this.arcadeInitialsDraft[slot] ?? "A";
    const currentIndex = Math.max(0, SCORE_INITIAL_CHARACTERS.indexOf(current));
    const nextIndex =
      (currentIndex + delta + SCORE_INITIAL_CHARACTERS.length) %
      SCORE_INITIAL_CHARACTERS.length;
    this.arcadeInitialsSlot = slot;
    this.setInitialsSlotCharacter(slot, SCORE_INITIAL_CHARACTERS[nextIndex]!);
    this.focusInitialsSlot(slot);
  }

  private setInitialsSlotCharacter(slot: number, character: string): void {
    if (slot < 0 || slot >= this.arcadeInitialsDraft.length) return;
    this.arcadeInitialsDraft[slot] = character;
    const button = this.pageRoot.querySelector<HTMLButtonElement>(
      `[data-initial-slot="${slot}"]`,
    );
    if (button) {
      button.textContent = character;
      button.dataset["bitmapText"] = character;
      button.setAttribute(
        "aria-label",
        `Initial ${slot + 1}: ${character}. Up and down change character.`,
      );
    }
    const input = this.pageRoot.querySelector<HTMLInputElement>(
      "[data-arcade-score-initials]",
    );
    if (input) input.value = this.arcadeInitialsDraft.join("");
    this.bitmapText.renderNow();
  }

  private advanceInitialsSlot(slot: number): void {
    const next = Math.min(2, slot + 1);
    this.arcadeInitialsSlot = next;
    if (slot < 2) {
      this.focusInitialsSlot(next);
      return;
    }
    this.pageRoot
      .querySelector<HTMLButtonElement>("[data-action='save-initials']")
      ?.focus();
  }

  private focusInitialsSlot(slot: number): void {
    this.pageRoot
      .querySelector<HTMLButtonElement>(`[data-initial-slot="${slot}"]`)
      ?.focus();
  }

  private startTerminalTyping(): void {
    this.stopTerminalTyping();
    const view = this.terminalView;
    if (!view) return;
    this.terminalVisibleCharacters = this.save.settings.reducedMotion
      ? terminalCharacterCount(view)
      : 0;
    this.renderPage();
    this.focusPageTarget();
    if (this.terminalTypingComplete()) return;
    this.terminalTypingTimer = window.setInterval(() => {
      const total = this.terminalView
        ? terminalCharacterCount(this.terminalView)
        : 0;
      this.terminalVisibleCharacters = Math.min(
        total,
        this.terminalVisibleCharacters + 2,
      );
      this.renderPage();
      if (this.terminalVisibleCharacters >= total) {
        this.stopTerminalTyping();
        this.focusPageTarget();
      }
    }, 34);
  }

  private completeTerminalTyping(): void {
    if (!this.terminalView) return;
    this.terminalVisibleCharacters = terminalCharacterCount(this.terminalView);
    this.stopTerminalTyping();
    this.renderPage();
    this.focusPageTarget();
  }

  private terminalTypingComplete(): boolean {
    return (
      this.terminalView === null ||
      this.terminalVisibleCharacters >=
        terminalCharacterCount(this.terminalView)
    );
  }

  private stopTerminalTyping(): void {
    if (this.terminalTypingTimer !== null) {
      window.clearInterval(this.terminalTypingTimer);
      this.terminalTypingTimer = null;
    }
  }
}

function shellMarkup(): string {
  return `<main class="qb-shell" data-surface="title" data-reduced-motion="false" data-flicker="true">
    <section class="qb-title" aria-labelledby="qb-title-name">
      <h1 id="qb-title-name" class="qb-visually-hidden">Quantum Box</h1>
      <div class="qb-title-layers" aria-hidden="true"></div>
      <button class="qb-title-hit" type="button" data-action="press-start"><span>PRESS START</span></button>
      <p class="qb-title-help">PRESS ANY PLAYER ACTION KEY</p>
    </section>
    <section class="qb-internal" aria-label="Quantum Box internal screen" hidden>
      <div class="qb-screen-frame">
        <div id="quantum-box-canvas" class="qb-canvas-host" aria-hidden="true"></div>
        <div class="qb-crt" aria-hidden="true"></div>
        <canvas class="qb-bitmap-ui" data-ui="bitmap-text" width="320" height="180" aria-hidden="true"></canvas>
        <header class="qb-screen-header"><span>QUANTUM BOX</span><span data-ui="breadcrumb">ARCHIVE INDEX</span></header>
        <section class="qb-page" data-ui="page"></section>
        <footer class="qb-screen-footer"><button type="button" data-action="back" aria-label="BACK · ESC / B">ESC / B</button><button type="button" data-action="activate-page-control">SELECT · ENTER / A</button></footer>
        <section class="qb-game-ui" data-ui="game" hidden>
          <section class="qb-cabinet-ui" data-cabinet="qong" role="region" aria-label="Qong game" hidden>
            <header class="qb-qong-score qb-visually-hidden"><div><small data-qong="left-label">YOU</small><strong data-qong="left-score">0</strong></div><div><span data-qong="round">ROUND: 1/7</span><small data-qong="rule-state">RULE STATE: UNRESOLVED</small><small data-qong="goal">GOAL: UNRESOLVED</small><small data-qong="winner">WINNER: UNRESOLVED</small></div><div><small data-qong="right-label">CPU</small><strong data-qong="right-score">0</strong></div></header>
            <output class="qb-qong-notice qb-visually-hidden" data-qong="notice" aria-live="polite"></output>
            <footer class="qb-qong-controls"><button type="button" data-action="cabinet-back" aria-label="BACK · ESC / B">ESC / B</button><span data-qong="movement-controls">W / S</span><button type="button" data-action="qong-replay" hidden>RETRY · X / X</button><span data-qong="observations">OBS 3</span><button type="button" data-action="qong-observe">OBSERVE · SPACE / A</button><button type="button" data-action="qong-pause">PAUSE · P / START</button></footer>
          </section>
          <section class="qb-cabinet-ui" data-cabinet="skipixl" role="region" aria-label="SkiPixl game" hidden>
            <header class="qb-skipixl-score qb-visually-hidden"><div><small><span data-skipixl="distance">4270</span> M · LIMIT <span data-skipixl="limit">1:00.00</span></small><strong data-skipixl="time">0:00.00</strong></div></header>
            <output class="qb-skipixl-notice qb-visually-hidden" data-skipixl="notice" aria-live="polite">QPIXL COURSE READY</output>
            <footer class="qb-skipixl-controls"><button type="button" data-action="cabinet-back" aria-label="BACK · ESC / B">ESC / B</button><span>← → TURN · ↓ BOOST</span><button type="button" data-action="skipixl-replay" hidden>RETRY · X / X</button><button type="button" data-action="skipixl-continue" hidden>CONTINUE · SPACE / A</button><button type="button" data-action="skipixl-pause">PAUSE · P / START</button></footer>
          </section>
          <section class="qb-cabinet-ui" data-cabinet="fluxball" role="region" aria-label="Fluxball game" hidden>
            <header class="qb-fluxball-hud qb-visually-hidden">
              <div class="qb-fluxball-score qb-fluxball-score--a"><small>A</small><strong data-fluxball-score="A">0</strong></div>
              <div class="qb-fluxball-score qb-fluxball-score--b"><strong data-fluxball-score="B">0</strong><small>B</small></div>
              <div class="qb-fluxball-score qb-fluxball-score--c"><small>C</small><strong data-fluxball-score="C">0</strong></div>
              <div class="qb-fluxball-score qb-fluxball-score--d"><small>D</small><strong data-fluxball-score="D">0</strong></div>
              <div class="qb-fluxball-clock"><small data-fluxball="round">R 1/4</small><strong data-fluxball="time">40</strong><span data-fluxball="format">2P · INDIVIDUAL</span></div>
            </header>
            <output class="qb-fluxball-notice qb-visually-hidden" data-fluxball="notice" aria-live="polite"></output>
            <div class="qb-fluxball-reveal" data-fluxball="reveal"></div>
            <footer class="qb-fluxball-controls"><button type="button" data-action="cabinet-back" aria-label="BACK · ESC / B">ESC / B</button><span class="qb-visually-hidden" data-fluxball="controls">PRESS SPACE / A TO CHANGE RULES</span><button type="button" data-action="fluxball-replay" hidden>RETRY · X / X</button><button type="button" data-action="fluxball-continue" hidden>NEXT ROUND · SPACE / A</button><button type="button" data-action="fluxball-pause">PAUSE · P / START</button></footer>
          </section>
          <section class="qb-cabinet-ui" data-cabinet="quantman" role="region" aria-label="Quantman QPU-derived gaze maze" hidden>
            <header class="qb-quantman-hud qb-visually-hidden"><div><small>REMAINING</small><strong data-quantman="fragments">100</strong></div><div><span data-quantman="lives">LIVES 3</span><span data-quantman="state">SCORE 00000 · READY</span><span data-quantman="focus">GAZE READY · RECORDED IBM FEZ RETURN</span></div><div><small>MODE</small><strong data-quantman="time">HOLD</strong></div></header>
            <output class="qb-quantman-notice qb-visually-hidden" data-quantman="notice" aria-live="polite">RECORDED IBM FEZ RETURN READY</output>
            <footer class="qb-quantman-controls"><button type="button" data-action="cabinet-back" aria-label="BACK · ESC / B">ESC / B</button><span>ARROWS / WASD · MOVE</span><button type="button" data-action="quantman-replay" hidden>RETRY · X / X</button><button type="button" data-action="quantman-continue" hidden>CONTINUE · SPACE / A</button><button type="button" data-action="quantman-pause">PAUSE · P / START</button></footer>
          </section>
          <section class="qb-cabinet-ui" data-cabinet="quag" role="region" aria-label="Quarry directed aerial hunt arena" hidden>
            <div class="qb-visually-hidden"><h2>QUARRY</h2><p data-quag="score">YOU A0 · B0 C0 D0</p><p data-quag="time">100</p><p data-quag="phase">STATE 1</p><p data-quag="targets">NO TARGET</p><output data-quag="notice" aria-live="polite">READY · YOU ARE A</output></div>
            <footer class="qb-qgraph-controls"><button type="button" data-action="cabinet-back" aria-label="BACK · ESC / B">ESC / B</button><span data-quag="controls">A/D OR ARROWS · W/SPACE/UP FLAP</span><button type="button" data-action="quag-replay" hidden>RETRY · X / X</button><button type="button" data-action="quag-continue" hidden>CONTINUE · SPACE / A</button><button type="button" data-action="quag-restart" hidden>RESTART · X / X</button><button type="button" data-action="quag-pause">PAUSE · P / START</button></footer>
          </section>
        </section>
      </div>
    </section>
    <output class="qb-status qb-bitmap-status-mirror" data-ui="status" role="status" aria-live="polite"></output>
  </main>`;
}

function pageMarkup(
  page: ShellPage,
  save: QuantumBoxSave,
  terminalView: StoryTerminalView | null,
  terminalVisibleCharacters: number,
  arcadeRunSeed: number,
  storyUnavailableMessage: string | null,
  arcadeScoreboard: ArcadeScoreboardRequest | null,
  selectedArcadeCabinet: ShippedArcadeCabinetId | null,
  settingsSection: SettingsSection,
  settingsPlayerId: PlayerId,
  arcadeInitialsDraft: string,
): string {
  switch (page) {
    case "main":
      return `<div class="qb-page-panel qb-index"><h1 class="qb-visually-hidden" tabindex="-1">ARCHIVE INDEX</h1><nav aria-label="Quantum Box channels">
        ${primaryMenuButton("story-start", "01", "STORY")}
        ${primaryMenuButton("arcade", "02", "ARCADE")}
        ${primaryMenuButton("terminal", "03", "TERMINAL")}
        ${primaryMenuButton("settings", "04", "SETTINGS")}
      </nav></div>`;
    case "story-start":
      return storyStartMarkup(save);
    case "arcade":
      return arcadeSelectionMarkup();
    case "arcade-detail":
      return selectedArcadeCabinet
        ? arcadeGameMarkup(selectedArcadeCabinet)
        : arcadeSelectionMarkup();
    case "scores":
      return arcadeScoreboard
        ? arcadeScoreboardPageMarkup(
            arcadeScoreboard,
            save,
            arcadeInitialsDraft,
          )
        : `<div class="qb-page-panel qb-scoreboard-page"><h1 tabindex="-1">SCORES</h1><p>CHOOSE A SCORE BOARD FROM ARCADE.</p><button type="button" data-action="close-arcade-scores">ARCADE · ENTER / A</button></div>`;
    case "terminal":
      return terminalIndexMarkup(save);
    case "story-terminal":
      return storyUnavailableMessage
        ? storyUnavailableMarkup(storyUnavailableMessage)
        : terminalView
          ? terminalPageMarkup(
              terminalView,
              terminalVisibleCharacters,
              save.settings.reducedMotion,
            )
          : `<div class="qb-page-panel qb-story-unavailable"><h1 tabindex="-1">STORY</h1><p>NO TERMINAL PAGE IS LOADED.</p><button type="button" data-action="navigate" data-page="main">HOME</button></div>`;
    case "settings":
      return settingsMarkup(save, settingsSection, settingsPlayerId);
    case "developer":
      return `<div class="qb-page-panel qb-scroll qb-developer-page"><p class="qb-kicker">EXPLICIT TEST CONTROLS</p><h1 tabindex="-1">DEVELOPER SURFACE</h1><p>These controls never grant Story authority or write completion evidence.</p><fieldset class="qb-settings"><legend>Arcade setup</legend><label><span>RUN SEED</span><input type="number" min="0" max="4294967295" step="1" value="${arcadeRunSeed}" data-developer-run-seed/></label></fieldset><p>Story terminals use the same persisted graph as release play.</p></div>`;
    case "credits":
      return `<div class="qb-page-panel qb-scroll"><p class="qb-kicker">PROVISIONAL RECORD</p><h1 tabindex="-1">SOURCE RECORD</h1><dl class="qb-record"><div><dt>DEVICE</dt><dd>QUANTUM BOX · QB-00</dd></div><div><dt>FORM</dt><dd>EARLY-1970S COLOUR RASTER ANTHOLOGY</dd></div><div><dt>ENGINES</dt><dd>COIN TOSS · QPIXL · LABYRINTH · QUANTUM GRAPH</dd></div><div><dt>BOUNDARY</dt><dd>TIMED PLAY IS CLASSICAL AND LOCAL. COMMITTED ENGINE PACKS FREEZE BEFORE PLAY.</dd></div><div><dt>DESIGNER</dt><dd>A FICTIONAL EXPERIMENTER GIVEN ACCESS TO MOTH; NOT ITS INVENTOR AND NOT MOTH COMPANY HISTORY.</dd></div><div><dt>AUDIO</dt><dd>MENU AND TERMINAL MUSIC ARE APPROVED LOCAL COMPOSITIONS. THE TITLE IS SILENT. GAMES ARE EFFECTS-ONLY. AUDIO IS NOT QPU OUTPUT.</dd></div></dl></div>`;
  }
}

function primaryMenuButton(
  page: "story-start" | "arcade" | "terminal" | "settings",
  number: string,
  label: string,
): string {
  return `<button class="qb-primary-menu-row" type="button" data-action="navigate" data-page="${page}" aria-label="${label}"><span>${number}</span><strong>${label}</strong></button>`;
}

function storyUnavailableMarkup(message: string): string {
  return `<div class="qb-page-panel qb-story-unavailable"><h1 tabindex="-1">STORY UNAVAILABLE</h1><p class="qb-story-closed" role="status">${escapeHtml(message)}</p><button class="qb-action" data-action="navigate" data-page="main">HOME</button></div>`;
}

function storyStartMarkup(save: QuantumBoxSave): string {
  const progress = save.story.storyCompleted
    ? "DEMONSTRATION COMPLETE"
    : save.story.currentNodeId === "intro-1"
      ? "NO ACTIVE SESSION"
      : "SESSION AVAILABLE";
  return `<section class="qb-page-panel qb-terminal-menu qb-story-start"><header><p>QBOX&gt; STORY</p><h1 tabindex="-1">DEMONSTRATION PROGRAM</h1></header><div class="qb-terminal-top-rule" aria-hidden="true"></div><div class="qb-story-start-body"><p>${progress}</p><nav aria-label="Story session"><button type="button" data-action="continue-story" ${save.story.currentNodeId === "intro-1" || save.story.storyCompleted ? "disabled" : ""}>CONTINUE</button><button type="button" data-action="new-story">NEW STORY</button></nav></div>${terminalFooterMarkup()}</section>`;
}

function terminalFooterMarkup(): string {
  return `<footer class="qb-terminal-footer"><button type="button" data-action="back" aria-label="BACK · ESC / B">ESC / B</button><button type="button" data-action="activate-page-control">SELECT · ENTER / A</button></footer>`;
}

function terminalIndexMarkup(save: QuantumBoxSave): string {
  const rows = STORY_CHAPTER_IDS.map((chapterId, index) => {
    const chapter = STORY_CHAPTER_DEFINITIONS[chapterId];
    const stages = chapterStages(chapterId);
    const experienced = stages.some((stage) =>
      save.story.experiencedStages.includes(stage),
    );
    const cleared = stages.every((stage) =>
      save.story.clearedStages.includes(stage),
    );
    const transcriptSeen = save.story.transcriptSeen.includes(chapterId);
    const number = String(index + 1).padStart(2, "0");
    if (cleared) {
      return `<li><button type="button" data-action="open-terminal-transcript" data-chapter-id="${chapterId}" aria-label="${escapeHtml(chapter.title)} transcript"><span>${number}</span><strong>${escapeHtml(chapter.title)}</strong><small>${transcriptSeen ? "TRANSCRIPT READ" : "TRANSCRIPT READY"}</small></button></li>`;
    }
    if (
      experienced &&
      earliestUnclearedStage(chapterId, save.story.clearedStages)
    ) {
      return `<li><button type="button" data-action="retry-terminal-chapter" data-chapter-id="${chapterId}" aria-label="Retry ${escapeHtml(chapter.title)}"><span>${number}</span><strong>${escapeHtml(chapter.title)}</strong><small>RETRY REQUIRED</small></button></li>`;
    }
    return `<li><div aria-label="${escapeHtml(chapter.title)} unopened"><span>${number}</span><strong>${escapeHtml(chapter.title)}</strong><small>UNOPENED</small></div></li>`;
  }).join("");
  return `<div class="qb-page-panel qb-terminal-index"><h1 class="qb-visually-hidden" tabindex="-1">TERMINAL</h1><p class="qb-visually-hidden">Completed Story program transcripts and independent retries.</p><ol data-scroll-list>${rows}</ol>${scrollPositionMarkup()}</div>`;
}

function terminalBodyTop(header: readonly string[]): number {
  return (
    5 +
    header.reduce((count, line) => count + line.split("\n").length, 0) * 6 +
    10
  );
}

function terminalPageMarkup(
  view: StoryTerminalView,
  visibleCharacters: number,
  reducedMotion: boolean,
): string {
  const page = view.page;
  const headerCount = textGroupCharacterCount(page.header);
  const bodyCount = textGroupCharacterCount(page.body);
  const total = headerCount + bodyCount;
  const visible = Math.max(0, Math.min(total, visibleCharacters));
  const visibleHeader = sliceTerminalLines(page.header, visible);
  const visibleBody = sliceTerminalLines(
    page.body,
    Math.max(0, visible - headerCount),
  );
  const headerFinished = visible >= headerCount;
  const complete = visible >= total;
  const transcriptPosition = view.transcriptPosition
    ? `<span class="qb-terminal-position">${view.transcriptPosition.index + 1}/${view.transcriptPosition.count}</span>`
    : "";
  const actions = complete
    ? page.actions
        .map(
          ({ id, label }) =>
            `<button type="button" data-action="story-terminal-action" data-terminal-action="${id}" data-terminal-node="${escapeHtml(view.nodeId)}" aria-label="${label} · ENTER / A"><span data-bitmap-flow class="qb-terminal-prompt-label" style="width: ${(terminalTextWidth("> " + label) + 4) / 3.2}cqw">&gt; ${label}</span><span class="qb-terminal-cursor" aria-hidden="true"></span></button>`,
        )
        .join("")
    : "";
  const accessible = [...page.header, ...page.body]
    .join("\n\n")
    .replaceAll("\n", " ");
  return `<article class="qb-page-panel qb-terminal-page" data-terminal-page="${escapeHtml(page.id)}" style="--story-gap: ${(storyTextLayout(page).gap / 1.8).toFixed(4)}cqh; --reading-top: ${(terminalBodyTop(page.header) / 1.8).toFixed(4)}cqh; --reading-rule: ${((terminalBodyTop(page.header) - 6) / 1.8).toFixed(4)}cqh" data-terminal-density="${terminalDensity(page)}" data-terminal-complete="${complete}" data-reduced-motion="${reducedMotion}" aria-label="${escapeHtml(accessible)}"><header aria-hidden="true">${visibleHeader.map((text) => terminalTextBlock(text)).join("")}${transcriptPosition}</header><div class="qb-terminal-top-rule" aria-hidden="true" data-visible="${headerFinished}"></div><div class="qb-terminal-reading"><section class="qb-terminal-body" aria-hidden="true">${visibleBody.map((text) => terminalTextBlock(text, true)).join("")}</section><div class="qb-terminal-actions">${actions}</div></div><p class="qb-visually-hidden">${escapeHtml(accessible)}</p></article>`;
}

function terminalDensity(
  page: StoryTerminalView["page"],
): "short" | "medium" | "long" {
  const lines = page.body.reduce(
    (count, paragraph) => count + paragraph.split("\n").length,
    0,
  );
  if (lines <= 5) return "short";
  if (lines <= 10) return "medium";
  return "long";
}

function terminalTextBlock(value: string, reading = false): string {
  return `<p ${reading ? "data-bitmap-flow" : ""} ${bitmapTextAttribute(value)}>${escapeHtml(value).replaceAll("\n", "<br>")}</p>`;
}

function textGroupCharacterCount(lines: readonly string[]): number {
  return lines.reduce((total, line) => total + line.length, 0);
}

function terminalCharacterCount(view: StoryTerminalView): number {
  return (
    textGroupCharacterCount(view.page.header) +
    textGroupCharacterCount(view.page.body)
  );
}

function sliceTerminalLines(
  lines: readonly string[],
  visibleCharacters: number,
): readonly string[] {
  let remaining = visibleCharacters;
  const result: string[] = [];
  for (const line of lines) {
    if (remaining <= 0) break;
    const visible = line.slice(0, remaining);
    result.push(visible);
    remaining -= line.length;
  }
  return result;
}

function isStoryTerminalAction(
  value: string | undefined,
): value is StoryTerminalActionId {
  return value === "continue" || value === "play" || value === "retry";
}

function howToPlayMarkup(
  gameId: "qong" | "fluxball",
  context: "arcade" | "story-loss",
): string {
  const qong = gameId === "qong";
  const title = qong ? "QONG · UNRESOLVED RULE" : "FLUXBALL · HIDDEN RULES";
  const lines = qong
    ? [
        "EVERY ROUND IS EITHER OPPOSITE GOAL OR OWN GOAL.",
        "SPACE / A OBSERVES THE RULE EARLY. A GOAL-LINE CROSSING OBSERVES IT AUTOMATICALLY.",
        "YOU HAVE THREE OBSERVATIONS ACROSS SEVEN ROUNDS.",
      ]
    : [
        "THE BALL MAY CROSS ANY PHYSICAL GOAL. THE HIDDEN GOAL RULE DECIDES WHO RECEIVES THE POINT.",
        "GLOBAL SHARES ONE RULE SET. INDIVIDUAL GIVES EACH PLAYER A COUPLED HIDDEN SET.",
        "ONCE PER ROUND, THE FIRST HUMAN TO CHANGE RULES ADVANCES THE WHOLE RULEFIELD.",
      ];
  const action =
    context === "story-loss"
      ? "RETRY · ENTER / A"
      : "BACK TO ARCADE · ENTER / A";
  return `<div class="qb-page-panel qb-game-help"><p class="qb-kicker">TUTORIAL</p><h1 tabindex="-1">${title}</h1>${lines.map((line) => `<p>${line}</p>`).join("")}<button class="qb-action" type="button" data-action="help-continue">${action}</button></div>`;
}

function arcadeSelectionMarkup(): string {
  return `<div class="qb-page-panel qb-arcade-library qb-cabinet-index"><h1 class="qb-visually-hidden" tabindex="-1">ARCADE</h1><p class="qb-visually-hidden">Choose one of five cabinets. Each cabinet opens a separate trial sheet before play.</p><div class="qb-arcade-list">${ARCADE_CABINET_IDS.map(arcadeSelectionRow).join("")}</div></div>`;
}

function arcadeSelectionRow(gameId: ShippedArcadeCabinetId): string {
  const game = ARCADE_CABINET_DEFINITIONS[gameId];
  return `<button class="qb-arcade-select-row" type="button" data-action="open-arcade-cabinet" data-game-id="${gameId}" aria-label="${escapeHtml(game.title)}">${arcadePreview(gameId)}<span class="qb-arcade-select-number">${game.model.slice(-2)}</span><strong>${escapeHtml(game.title)}</strong></button>`;
}

function scrollPositionMarkup(): string {
  return `<span class="qb-scroll-position" data-scroll-position data-scroll-state="start" aria-hidden="true" hidden><i></i></span>`;
}

function arcadeGameMarkup(gameId: ShippedArcadeCabinetId): string {
  const game = ARCADE_CABINET_DEFINITIONS[gameId];
  const engineLabel = `${game.model} / ${game.engineId.toUpperCase()}`;
  const tutorial = ARCADE_INSTRUCTIONS[gameId]
    .map((text) => terminalTextBlock(text, true))
    .join("");
  return `<section class="qb-page-panel qb-arcade-detail qb-arcade-detail--${gameId}" data-arcade-detail="${gameId}" aria-labelledby="arcade-${gameId}" aria-describedby="arcade-${gameId}-source"><header class="qb-arcade-detail-header"><div><h1 id="arcade-${gameId}" tabindex="-1" ${bitmapTextAttribute(game.title)}>${escapeHtml(game.title)}</h1><p ${bitmapTextAttribute(engineLabel)}>${escapeHtml(engineLabel)}</p></div>${arcadePreview(gameId)}</header><div class="qb-arcade-detail-rule qb-terminal-top-rule" aria-hidden="true"></div><div class="qb-arcade-detail-body"><section class="qb-arcade-tutorial" aria-label="Tutorial">${tutorial}</section><section class="qb-arcade-trials" aria-label="${escapeHtml(game.title)} trials"><h2 data-bitmap-text="PLAY">PLAY</h2><div class="qb-arcade-launches">${game.arcadeModes
    .map((mode, index) => {
      const label = arcadeModeLabel(mode);
      const placement = arcadeModePlacement(gameId, index);
      const scoreboard = arcadeScoreboardMarkup(gameId, mode);
      const classes = [
        "qb-arcade-mode",
        `qb-arcade-mode--column-${placement.column}`,
        `qb-arcade-mode--row-${placement.row}`,
        placement.span === 2 ? "qb-arcade-mode--span-2" : "",
        scoreboard ? "qb-arcade-mode--scored" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<span class="${classes}"><button type="button" data-action="launch-arcade" data-game-id="${game.id}" data-mode="${escapeHtml(mode)}" data-bitmap-text="${label}">${label}</button>${scoreboard}</span>`;
    })
    .join(
      "",
    )}</div></section></div>${terminalFooterMarkup()}<span class="qb-visually-hidden" id="arcade-${gameId}-source">${escapeHtml(game.model)} · ${escapeHtml(game.sourceLabel)}</span></section>`;
}

function arcadeModePlacement(
  gameId: ShippedArcadeCabinetId,
  index: number,
): Readonly<{ column: 1 | 2 | 3; row: 1 | 2; span: 1 | 2 }> {
  if (gameId === "fluxball" || gameId === "quarry") {
    return Object.freeze({
      column: ((index % 2) + 1) as 1 | 2,
      row: (Math.floor(index / 2) + 1) as 1 | 2,
      span: 1,
    });
  }
  return Object.freeze({
    column: (index + 1) as 1 | 2 | 3,
    row: 1,
    span: 1,
  });
}

function arcadeScoreboardMarkup(
  gameId: ShippedArcadeCabinetId,
  mode: string,
): string {
  if (gameId !== "skipixl" && gameId !== "quantman") return "";
  requireArcadeScoreboardMode(gameId, mode);
  return `<button class="qb-arcade-scores" type="button" data-action="open-arcade-scores" data-game-id="${gameId}" data-mode="${escapeHtml(mode)}" data-bitmap-text="SCORES">SCORES</button>`;
}

function arcadeScoreboardPageMarkup(
  request: ArcadeScoreboardRequest,
  save: QuantumBoxSave,
  initialsDraft: string,
): string {
  const board = arcadeScoreboardEntries(request, save);
  const rows: string[] = [];
  for (let index = 0; index < ARCADE_RECORD_LIMIT; index += 1) {
    const entry = board[index];
    if (!entry) {
      rows.push(
        `<li class="qb-scoreboard-empty" role="row"><span role="cell">${index + 1}</span><strong role="cell">---</strong><small role="cell">---</small></li>`,
      );
      continue;
    }
    const current = entry.recordedSequence === request.highlightRecordSequence;
    rows.push(
      `<li role="row"${current ? ' data-current="true"' : ""} title="${escapeHtml(`${entry.runId} · ${entry.rulesVersion} · ${entry.pack.packId} · ${entry.pack.contentSha256}`)}"><span role="cell">${index + 1}</span><strong role="cell">${escapeHtml(entry.initials)}</strong><small role="cell">${arcadeScoreResult(entry)}</small></li>`,
    );
  }
  const title =
    request.gameId === "skipixl"
      ? `SKIPIXL · ${request.mode}`
      : `QUANTMAN · ${arcadeModeLabel(request.mode)}`;
  const resultHeading =
    request.gameId === "skipixl"
      ? "TIME · MISSED · HITS"
      : "SCORE · RESULT · MAZE";
  const result = request.resultLabel
    ? `<p class="qb-scoreboard-result">${escapeHtml(request.resultLabel)}</p>`
    : "";
  const initials =
    request.initialsEditable && request.highlightRecordSequence !== null
      ? `<form class="qb-scoreboard-initials" data-arcade-score-form data-record-sequence="${request.highlightRecordSequence}"><span class="qb-scoreboard-initials-label">INITIALS</span><div class="qb-scoreboard-initial-slots" role="group" aria-label="Three character score initials">${[...initialsDraft].map((character, index) => `<button type="button" data-action="initials-slot" data-initial-slot="${index}" data-bitmap-text="${escapeHtml(character)}" aria-label="Initial ${index + 1}: ${escapeHtml(character)}. Up and down change character.">${escapeHtml(character)}</button>`).join("")}</div><input type="hidden" value="${escapeHtml(initialsDraft)}" data-arcade-score-initials/><button type="submit" data-action="save-initials">SAVE · ENTER / A</button><p class="qb-initials-help">UP / DOWN CHANGE · LEFT / RIGHT SLOT · ENTER / A NEXT</p></form>`
      : "";
  return `<div class="qb-page-panel qb-scoreboard-page"><header><p class="qb-kicker">TOP FIVE</p><h1 tabindex="-1">${escapeHtml(title)}</h1></header><div class="qb-scoreboard-table" role="table" aria-label="${escapeHtml(title)} top five scores"><div class="qb-scoreboard-columns" role="row"><span role="columnheader">RANK</span><span role="columnheader">INITIALS</span><span role="columnheader">${resultHeading}</span></div><ol role="rowgroup">${rows.join("")}</ol></div>${result}${initials}<button class="qb-scoreboard-close" type="button" data-action="close-arcade-scores">ARCADE · ENTER / A</button></div>`;
}

function arcadeScoreboardEntries(
  request: ArcadeScoreboardRequest,
  save: QuantumBoxSave,
): readonly (SkiPixlArcadeRecord | QuantmanArcadeRecord)[] {
  if (request.gameId === "skipixl") {
    return save.arcadeRecords.skipixl[skiPixlScoreDifficulty(request.mode)];
  }
  return quantmanArcadeOverallBoard(
    save.arcadeRecords,
    quantmanScoreMechanic(request.mode),
  );
}

function arcadeScoreResult(
  entry: SkiPixlArcadeRecord | QuantmanArcadeRecord,
): string {
  return entry.kind === "skipixl"
    ? `${(entry.officialTimeMs / 1_000).toFixed(2)} · ${entry.missedGates} · ${entry.collisions}`
    : `${String(entry.score).padStart(5, "0")} · ${entry.outcome === "won" ? "CLEAR" : "LOST"} · ${escapeHtml(entry.topologyLabel)}`;
}

function skiPixlScoreDifficulty(mode: string): SkiPixlArcadeDifficulty {
  const difficulty = mode.toLowerCase();
  if (
    difficulty === "easy" ||
    difficulty === "medium" ||
    difficulty === "hard"
  ) {
    return difficulty;
  }
  throw new Error(`Unsupported SkiPixl score board: ${mode}.`);
}

function quantmanScoreMechanic(mode: string): QuantmanArcadeMechanic {
  if (mode === "HOLD" || mode === "STABILIZE GAZE") return "stabilize-gaze";
  if (mode === "INVERT" || mode === "INVERSE GAZE") return "inverse-gaze";
  throw new Error(`Unsupported Quantman score board: ${mode}.`);
}

function requireArcadeScoreboardMode(
  gameId: ArcadeScoreboardRequest["gameId"],
  mode: string,
): void {
  if (gameId === "skipixl") skiPixlScoreDifficulty(mode);
  else quantmanScoreMechanic(mode);
}

function arcadeModeLabel(mode: string): string {
  const labels: Readonly<Record<string, string>> = {
    "HUMAN / CPU": "PLAYER / CPU",
    "LOCAL TWO PLAYER": "PLAYER / PLAYER",
    "2 PLAYER / GLOBAL": "2P SHARED",
    "2 PLAYER / INDIVIDUAL": "2P SPLIT",
    "4 PLAYER / GLOBAL": "4P SHARED",
    "4 PLAYER / INDIVIDUAL": "4P SPLIT",
    "STABILIZE GAZE": "HOLD",
    "INVERSE GAZE": "INVERT",
  };
  return labels[mode] ?? mode;
}

function arcadePreview(gameId: ShippedArcadeCabinetId): string {
  if (gameId === "quarry") {
    const { asset } = requireQGraphCabinetFrame(
      "quag-cabinet-thumbnail",
      "thumbnail",
    );
    return `<span class="qb-arcade-preview qb-arcade-preview--quarry" aria-hidden="true"><img src="${escapeHtml(asset.url)}" data-qgraph-cabinet-asset="quag-cabinet-thumbnail" alt=""/></span>`;
  }
  const assets: Readonly<Record<GameId, readonly string[]>> = {
    qong: ["qong-paddle", "qong-paddle"],
    skipixl: ["skipixl-neutral"],
    fluxball: ["fluxball-family-strip"],
    quantman: [
      "quantman-player-right",
      "quantman-ghost-right",
      "quantman-collectible",
    ],
  };
  const images = assets[gameId]
    .map((fileId) => {
      const asset = requireCanonicalAsset(fileId);
      return `<img src="${escapeHtml(asset.url)}" data-canonical-asset="${fileId}" alt=""/>`;
    })
    .join("");
  return `<span class="qb-arcade-preview qb-arcade-preview--${gameId}" aria-hidden="true">${images}<i></i></span>`;
}

function settingsMarkup(
  save: QuantumBoxSave,
  section: SettingsSection,
  playerId: PlayerId,
): string {
  const tabs = (
    [
      ["display", "01", "DISPLAY"],
      ["background", "02", "FIELD"],
      ["controls", "03", "CONTROLS"],
      ["data", "04", "DATA"],
    ] as const
  )
    .map(
      ([id, number, label]) =>
        `<button type="button" data-action="settings-section" data-settings-section="${id}" aria-selected="${id === section}"><span>${number}</span><strong>${label}</strong></button>`,
    )
    .join("");
  return `<div class="qb-page-panel qb-settings-page"><h1 class="qb-visually-hidden" tabindex="-1">SETTINGS</h1><nav class="qb-settings-sections" aria-label="Settings sections">${tabs}</nav><section class="qb-settings-panel" data-settings-panel="${section}"><h2>${settingsSectionTitle(section)}</h2><div class="qb-settings-scroll" data-scroll-list>${settingsSectionMarkup(save, section, playerId)}</div>${scrollPositionMarkup()}</section></div>`;
}

function settingsSectionTitle(section: SettingsSection): string {
  switch (section) {
    case "display":
      return "DISPLAY + SOUND";
    case "background":
      return "BACKGROUND FIELD";
    case "controls":
      return "PLAYER KEYS";
    case "data":
      return "LOCAL DATA";
  }
}

function settingsSectionMarkup(
  save: QuantumBoxSave,
  section: SettingsSection,
  playerId: PlayerId,
): string {
  switch (section) {
    case "display":
      return `<fieldset class="qb-settings"><legend>LOCAL PRESENTATION</legend>${setting("reducedMotion", "REDUCED MOTION", save.settings.reducedMotion)}${setting("crtFlicker", "DISPLAY FLICKER", save.settings.crtFlicker)}${setting("soundMuted", "SOUND MUTED · M / Y", save.settings.soundMuted)}${volumeSetting(save.settings.soundVolume)}</fieldset>`;
    case "background":
      return backgroundProgrammeSettings(save);
    case "controls":
      return `${keyboardSettings(save, playerId)}<button class="qb-action qb-settings-reset-keys" data-action="reset-keymap">RESTORE DEFAULT KEYS</button>`;
    case "data":
      return `<div class="qb-settings-data"><button class="qb-action" data-action="export-save">EXPORT SAVE</button><button class="qb-action" data-action="navigate" data-page="credits">SOURCE RECORD</button><button class="qb-action qb-action--danger" data-action="reset-save">RESET SAVE</button><p>SAVES, SCORES, STORY PROGRESS, AND SETTINGS STAY ON THIS DEVICE.</p></div>`;
  }
}

function setting(
  name: keyof QuantumBoxSettings,
  label: string,
  checked: boolean,
): string {
  return `<label><input type="checkbox" data-setting="${name}" ${checked ? "checked" : ""}/><span>${label}</span></label>`;
}

function keyboardSettings(save: QuantumBoxSave, playerId: PlayerId): string {
  const playerTabs = KEYBOARD_PLAYERS.map(
    (candidate) =>
      `<button type="button" data-action="settings-player" data-player-id="${candidate}" aria-selected="${candidate === playerId}">${candidate}</button>`,
  ).join("");
  const bindings = KEYBOARD_CONTROLS.map(
    (control) =>
      `<button type="button" class="qb-key-binding" data-action="rebind-key" data-player-id="${playerId}" data-control="${control}"><span>${control.toUpperCase()}</span><b>${escapeHtml(displayKeyCode(save.settings.keyboardBindings[playerId][control]))}</b></button>`,
  ).join("");
  return `<fieldset class="qb-settings qb-keymap"><legend>PLAYER ${playerId}</legend><nav class="qb-keymap-players" aria-label="Player key profiles">${playerTabs}</nav><section aria-label="Player ${playerId} bindings">${bindings}</section><p>SYSTEM KEYS CANNOT BE REBOUND. EACH CONTROL NEEDS ITS OWN KEY.</p></fieldset>`;
}

function backgroundProgrammeSettings(save: QuantumBoxSave): string {
  const selected =
    BROWN_BOX_BACKGROUND_PROGRAMMES.find(
      (programme) =>
        programme.programmeId === save.settings.backgroundProgrammeId,
    ) ?? BROWN_BOX_BACKGROUND_PROGRAMMES[0]!;
  return `<fieldset class="qb-settings qb-background-programmes" aria-label="Background field options">${BROWN_BOX_BACKGROUND_PROGRAMMES.map(
    (programme) =>
      `<label><input type="radio" name="background-programme" data-setting="backgroundProgrammeId" value="${programme.programmeId}" ${save.settings.backgroundProgrammeId === programme.programmeId ? "checked" : ""}/><span>${escapeHtml(programme.label)}</span></label>`,
  ).join(
    "",
  )}<output class="qb-background-summary" aria-live="polite"><strong>${escapeHtml(selected.label)}</strong><span>${escapeHtml(backgroundProgrammeSummary(selected.programmeId))}</span></output></fieldset>`;
}

function backgroundProgrammeSummary(
  programmeId: BrownBoxBackgroundProgrammeId,
): string {
  switch (programmeId) {
    case "current-four-state-v1":
      return "4 QPIXL-MAPPED STATES · 22.8S OFFLINE LOOP";
    case "adaptive-direct-v1":
    case "adaptive-restrained-v1":
    case "adaptive-stronger-v1":
      return "24 LOCAL KEYFRAME DERIVATIVES · 23.04S OFFLINE LOOP";
    case "amplified-four-state-v1":
      return "4 LOCAL PANEL COMPOSITES · 22.8S OFFLINE LOOP";
    case "seeded-sixteen-state-v1":
      return "16 CLASSICALLY ASSIGNED STATES · 91.2S OFFLINE LOOP";
  }
}

function fluxballLobbyMarkup(
  format: FluxballFormat,
  humanPlayerIds: readonly PlayerId[],
  save: QuantumBoxSave,
): string {
  const players =
    format.competitorCount === 2 ? (["A", "B"] as const) : KEYBOARD_PLAYERS;
  return `<div class="qb-page-panel qb-fluxball-lobby"><p class="qb-kicker">ARCADE · ${format.competitorCount} PLAYER</p><h1 tabindex="-1">FLUXBALL JOIN</h1><p>PRESS EACH PLAYER'S ACTION KEY TO TOGGLE HUMAN / CPU.</p><div class="qb-fluxball-lobby-slots">${players
    .map((playerId) => {
      const human = humanPlayerIds.includes(playerId);
      const key = displayKeyCode(
        save.settings.keyboardBindings[playerId].action,
      );
      return `<button type="button" data-action="lobby-toggle" data-player-id="${playerId}" aria-pressed="${human}"><strong>${playerId}</strong><span>${human ? "HUMAN" : "CPU"}</span><small>${escapeHtml(key)}</small></button>`;
    })
    .join(
      "",
    )}</div><p class="qb-fluxball-lobby-mode">${format.ruleMode.toUpperCase()} RULEFIELD · CPU FILLS OPEN SLOTS</p><div class="qb-actions"><button class="qb-action" type="button" data-action="lobby-cancel">BACK · ESC / B</button><button class="qb-action" type="button" data-action="lobby-start">START · ENTER / A</button></div></div>`;
}

function volumeSetting(volume: number): string {
  const percent = Math.round(volume * 100);
  return `<label class="qb-volume"><span>SOUND LEVEL</span><input type="range" min="0" max="1" step="0.05" value="${volume}" data-setting="soundVolume" aria-label="Sound level"/><output>${percent}%</output></label>`;
}

function isShellPage(value: string | undefined): value is ShellPage {
  return (
    value === "main" ||
    value === "story-start" ||
    value === "arcade" ||
    value === "arcade-detail" ||
    value === "scores" ||
    value === "terminal" ||
    value === "story-terminal" ||
    value === "settings" ||
    value === "developer" ||
    value === "credits"
  );
}

function isSettingsSection(
  value: string | undefined,
): value is SettingsSection {
  return (
    value === "display" ||
    value === "background" ||
    value === "controls" ||
    value === "data"
  );
}

function isPlayerId(value: string | undefined): value is PlayerId {
  return value !== undefined && KEYBOARD_PLAYERS.includes(value as PlayerId);
}

function initialsCharacters(value: string): [string, string, string] {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/gu, "")
    .padEnd(3, "-")
    .slice(0, 3);
  return [normalized[0]!, normalized[1]!, normalized[2]!];
}

function isFocusableControl(control: HTMLElement): boolean {
  if (control.hidden || control.offsetParent === null) return false;
  if (
    (control instanceof HTMLButtonElement ||
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement) &&
    control.disabled
  ) {
    return false;
  }
  const style = getComputedStyle(control);
  return style.display !== "none" && style.visibility !== "hidden";
}

function spatialFocusTarget(
  controls: readonly HTMLElement[],
  current: HTMLElement | null,
  direction: MenuDirection,
): HTMLElement | null {
  if (!current || !controls.includes(current)) return controls[0] ?? null;
  const currentRect = (
    current.closest("label") ?? current
  ).getBoundingClientRect();
  const currentX = currentRect.left + currentRect.width / 2;
  const currentY = currentRect.top + currentRect.height / 2;
  let best: Readonly<{ control: HTMLElement; score: number }> | null = null;
  for (const control of controls) {
    if (control === current) continue;
    const rect = (control.closest("label") ?? control).getBoundingClientRect();
    const deltaX = rect.left + rect.width / 2 - currentX;
    const deltaY = rect.top + rect.height / 2 - currentY;
    const primary =
      direction === "left"
        ? -deltaX
        : direction === "right"
          ? deltaX
          : direction === "up"
            ? -deltaY
            : deltaY;
    if (primary <= 1) continue;
    const secondary =
      direction === "left" || direction === "right"
        ? Math.abs(deltaY)
        : Math.abs(deltaX);
    const horizontal = direction === "left" || direction === "right";
    const overlaps = horizontal
      ? rect.top < currentRect.bottom && rect.bottom > currentRect.top
      : rect.left < currentRect.right && rect.right > currentRect.left;
    const score = primary + secondary * 4 + (overlaps ? 0 : 10000);
    if (!best || score < best.score) best = { control, score };
  }
  return best?.control ?? current;
}

function isKeyboardControl(
  value: string | undefined,
): value is KeyboardControl {
  return (
    value !== undefined && KEYBOARD_CONTROLS.includes(value as KeyboardControl)
  );
}

function isStoryChapter(value: string | undefined): value is StoryChapterId {
  return (
    value !== undefined && STORY_CHAPTER_IDS.includes(value as StoryChapterId)
  );
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Quantum Box shell is missing ${selector}.`);
  return element;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bitmapTextAttribute(value: string): string {
  return `data-bitmap-text="${escapeHtml(value).replaceAll("\n", "&#10;")}"`;
}

function clearFluxballReveal(root: HTMLElement): void {
  required(root, "[data-fluxball='reveal']").replaceChildren();
}

function renderFluxballSemanticHistory(
  root: HTMLElement,
  snapshot: FluxballSnapshot,
): void {
  const reveal = snapshot.reveal;
  if (!reveal) {
    clearFluxballReveal(root);
    return;
  }
  const score = reveal.roundWinnerIds[0]
    ? `Player ${reveal.roundWinnerIds[0]} won the round.`
    : "The round was a draw; no round win was awarded.";
  if (snapshot.format.ruleMode === "individual") {
    required(root, "[data-fluxball='reveal']").innerHTML =
      `<section class="qb-visually-hidden" aria-label="Round ${reveal.roundNumber} result"><p>${score} Individual rules and the joint QGraph state remain hidden.</p></section>`;
    return;
  }
  required(root, "[data-fluxball='reveal']").innerHTML =
    `<section class="qb-visually-hidden" aria-label="Round ${reveal.roundNumber} global rule history"><p>${score}</p><ol>${reveal.epochs
      .map((epoch) => {
        const rules = epoch.rules.global;
        if (!rules) return "";
        const providerJobId = epoch.trace.providerProvenance?.mothJobId;
        return `<li>Shared state ${epoch.stateIndex + 1}; ticks ${epoch.startTick} through ${Math.max(epoch.startTick, epoch.endTickExclusive - 1)}; MOVE ${rules.action}; BALL ${rules.interaction}; GOAL ${rules.purpose}; source record ${escapeHtml(epoch.trace.fixtureId)}; acquisition ${epoch.trace.acquisitionSource};${providerJobId ? ` provider job ${escapeHtml(providerJobId)};` : ""} active-play network none.</li>`;
      })
      .join("")}</ol></section>`;
}

function fluxballControlSummary(
  snapshot: FluxballSnapshot,
  save: QuantumBoxSave,
): string {
  const actions = snapshot.format.humanPlayerIds.map((playerId) => {
    const action = displayKeyCode(
      save.settings.keyboardBindings[playerId].action,
    );
    return snapshot.format.humanPlayerIds.length === 1
      ? action
      : `${playerId} ${action}`;
  });
  if (snapshot.remainingRuleChanges === 1) {
    return "PRESS SPACE / A TO CHANGE RULES";
  }
  return `${actions.join(" / ")} · RULE CHANGE USED`;
}

function renderFluxballLiveDisclosure(
  root: HTMLElement,
  snapshot: FluxballSnapshot,
): void {
  const events = snapshot.publicRuleChangeEvents
    .map((event) => {
      return `<li>Player ${event.playerId} used CHANGE RULES at tick ${event.tick + 1}. ${snapshot.format.ruleMode === "global" ? "The shared rule state changed." : "Every individual rule state changed."} The old and new values remain hidden.</li>`;
    })
    .join("");
  required(root, "[data-fluxball='reveal']").innerHTML = events
    ? `<section class="qb-visually-hidden" aria-label="Public rule changes"><ol>${events}</ol></section>`
    : "";
}

function fluxballScoreLine(snapshot: FluxballSnapshot): string {
  return (["A", "B", "C", "D"] as const)
    .filter((playerId) => snapshot.sport?.activePlayerIds.includes(playerId))
    .map(
      (playerId) =>
        `${playerId} ${snapshot.roundWins[playerId] ?? 0} ROUND${snapshot.roundWins[playerId] === 1 ? "" : "S"}`,
    )
    .join(" · ");
}
