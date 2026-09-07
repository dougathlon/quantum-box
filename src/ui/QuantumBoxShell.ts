import type {
  ArcadeCabinetId,
  GameId,
  ShippedArcadeCabinetId,
  StoryChapterId,
  StoryStageId,
} from "../games/registry";
import {
  ARCADE_CABINET_DEFINITIONS,
  ARCADE_CABINET_IDS,
  GAME_DEFINITIONS,
  GAME_IDS,
  STORY_CHAPTER_DEFINITIONS,
  STORY_CHAPTER_IDS,
  STORY_SEQUENCE,
  isArcadeCabinetId,
} from "../games/registry";
import type { QuantumBoxSave, QuantumBoxSettings } from "../save/types";
import { quantmanArcadeOverallBoard } from "../save/ArcadeRecords";
import { type QongOpponent, type QongSnapshot } from "../games/qong/types";
import { qongHudModel } from "../games/qong/presentation";
import type { SkiPixlSnapshot } from "../games/skipixl/types";
import {
  findInstalledSkiPixlPack,
  selectStorySkiPixlPack,
} from "../games/skipixl/SkiPixlCourseAdapter";
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
import quantmanQpuBankArtifact from "../games/quantmanSynthetic/data/quantman-labyrinth-ibm-fez-bank-v3.json";
import { quantmanSyntheticHudModel } from "../display/views/QuantmanSyntheticView";
import type { FrameReport } from "../core/FrameMonitor";
import type { InputResponseReport } from "../core/InputResponseMonitor";
import {
  DEFAULT_ARCADE_RUN_SEED,
  parseArcadeRunSeed,
  type ArcadeRunOrigin,
  type ArcadeLaunchOptions,
} from "../app/arcade";
import { DESIGNER_FRAGMENTS } from "../story/storyContent";
import type { QuantumBoxTitleAssets } from "../display/BrownBoxAssetManifest";
import {
  workshopBayViews,
  type WorkshopBayView,
} from "../display/views/WorkshopView";
import { BitmapDomTextRenderer } from "../display/BitmapDomText";
import {
  requireCanonicalAsset,
  requireCanonicalFrame,
} from "../assets/CanonicalRuntimeAssets";
import {
  requireDesignerProfessorAsset,
  requireDesignerProfessorFrame,
  resolveStoryV2AssetCue,
} from "../assets/designer-professor";
import {
  storyV2SceneKind,
  storyV2SpritePlayback,
  storyTerminal,
  storyV2TerminalPresentation,
  StoryV2WalkMachine,
  type QongStoryDirection,
  type QongStorySequenceSnapshot,
  type StoryV2AssetCue,
  type StoryV2PresentationBeat,
  type StoryV2PresentationEvidence,
  type StoryV2PresentationSnapshot,
  type StoryV2TerminalDatum,
  type StoryV2WalkDirection,
  type StoryV2WalkSnapshot,
} from "../story/v2";
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
import { quagHudModel } from "../games/quag/presentation";
import { requireQGraphCabinetFrame } from "../assets/QGraphCabinetAssets";
import {
  DEFAULT_KEYBOARD_BINDINGS,
  KEYBOARD_CONTROLS,
  KEYBOARD_PLAYERS,
  displayKeyCode,
  validateKeyboardBindings,
  type KeyboardControl,
} from "../input/KeyboardBindings";

export type ShellPage =
  | "main"
  | "story"
  | "story-brief"
  | "help"
  | "arcade"
  | "workshop"
  | "formula"
  | "interlude"
  | "settings"
  | "developer"
  | "credits";

export interface QuantumBoxShellActions {
  readonly onStartGesture: () => void;
  readonly onInternalEntered: () => void;
  readonly onTitleReturned: () => void;
  readonly onLaunchStory: (stage: StoryStageId, replay: boolean) => void;
  readonly onLaunchArcade: (
    gameId: ArcadeCabinetId,
    mode: string,
    options: ArcadeLaunchOptions,
  ) => void;
  readonly onSettingChanged: (change: Partial<QuantumBoxSettings>) => void;
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
  readonly onStoryPresentationContinue: () => void;
  readonly onStoryPresentationExited: () => void;
  readonly onFirstLossHelpContinue: (gameId: "qong" | "fluxball") => void;
  readonly onStoryWalkStep: () => void;
  readonly onQongStoryAction: (
    action:
      | Readonly<{ kind: "step"; direction: QongStoryDirection }>
      | Readonly<{ kind: "use" }>,
  ) => void;
  readonly onFluxballLobbyAction: (
    action:
      | Readonly<{ kind: "toggle"; playerId: PlayerId }>
      | Readonly<{ kind: "start" | "cancel" }>,
  ) => void;
}

const PAGE_TITLES: Readonly<Record<ShellPage, string>> = {
  main: "HOME",
  story: "STORY",
  "story-brief": "STORY",
  help: "HOW TO PLAY",
  arcade: "ARCADE",
  workshop: "WORKSHOP",
  formula: "FORMULA",
  interlude: "STORY",
  settings: "SETTINGS",
  developer: "DEVELOPER",
  credits: "SOURCE",
};

type SettingsSection = "display" | "background" | "controls" | "data";

export class QuantumBoxShell {
  private readonly shell: HTMLElement;
  private readonly title: HTMLElement;
  private readonly internal: HTMLElement;
  private readonly pageRoot: HTMLElement;
  private readonly screenHeader: HTMLElement;
  private readonly screenFooter: HTMLElement;
  private readonly gameUi: HTMLElement;
  private readonly qongUi: HTMLElement;
  private readonly qongStoryUi: HTMLElement;
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
  private selectedFormula: GameId | null = null;
  private storyPresentation: StoryV2PresentationSnapshot | null = null;
  private storyWalkMachine: StoryV2WalkMachine | null = null;
  private settingsSection: SettingsSection = "display";
  private settingsPlayerId: PlayerId = "A";
  private arcadeRunSeed = DEFAULT_ARCADE_RUN_SEED;
  private arcadeRunOrigin: ArcadeRunOrigin =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has("qa")
      ? "developer-qa"
      : "player-arcade";
  private storyUnavailableMessage: string | null = null;
  private gameHelp: Readonly<{
    gameId: "qong" | "fluxball";
    context: "arcade" | "story-loss";
  }> | null = null;
  private fluxballLobbyOpen = false;
  private backgroundActivationGeneration = 0;
  private pendingBinding: {
    readonly playerId: PlayerId;
    readonly control: KeyboardControl;
  } | null = null;

  public constructor(
    private readonly root: HTMLElement,
    titleAssets: QuantumBoxTitleAssets,
    fieldAssets: readonly BrownBoxViewportFieldAsset[],
    initialSave: QuantumBoxSave,
    private readonly actions: QuantumBoxShellActions,
  ) {
    this.save = initialSave;
    root.innerHTML = shellMarkup();
    this.shell = required(root, ".qb-shell");
    this.title = required(root, ".qb-title");
    this.internal = required(root, ".qb-internal");
    this.pageRoot = required(root, "[data-ui='page']");
    this.screenHeader = required(root, ".qb-screen-header");
    this.screenFooter = required(root, ".qb-screen-footer");
    this.gameUi = required(root, "[data-ui='game']");
    this.qongUi = required(this.gameUi, "[data-cabinet='qong']");
    this.qongStoryUi = required(this.gameUi, "[data-cabinet='qong-story']");
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
      required(root, ".qb-screen-frame"),
      titleAssets.screenMask,
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
    this.shell.style.setProperty(
      "--qb-title-device",
      `url(${JSON.stringify(titleAssets.device)})`,
    );
    this.shell.style.setProperty(
      "--qb-title-copy-layer",
      `url(${JSON.stringify(titleAssets.sharpLocalLayer)})`,
    );
    this.shell.dataset["reducedMotion"] = String(
      initialSave.settings.reducedMotion,
    );
    this.shell.dataset["flicker"] = String(initialSave.settings.crtFlicker);
    this.shell.dataset["page"] = this.page;
    root.addEventListener("click", this.onClick);
    root.addEventListener("change", this.onChange);
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
    if (page !== "help") this.gameHelp = null;
    if (page === "workshop") {
      this.page = "main";
      this.renderPage();
      this.focusPageTarget();
      this.announce("Workshop remains locked during this demo.");
      return;
    }
    if (page !== "interlude") this.storyWalkMachine = null;
    this.page = page;
    this.renderPage();
    this.focusPageTarget();
  }

  public showStoryUnavailable(message: string): void {
    if (!this.entered || this.cabinetActive) return;
    this.status.textContent = "";
    this.storyUnavailableMessage = message;
    this.page = "story-brief";
    this.renderPage();
    this.focusPageTarget();
  }

  public showFirstLossHelp(gameId: "qong" | "fluxball"): void {
    if (!this.entered || this.cabinetActive) return;
    this.status.textContent = "";
    this.storyUnavailableMessage = null;
    this.gameHelp = Object.freeze({ gameId, context: "story-loss" });
    this.page = "help";
    this.renderPage();
    this.focusPageTarget();
  }

  public showFluxballLobby(
    format: FluxballFormat,
    humanPlayerIds: readonly PlayerId[],
  ): void {
    if (!this.entered || this.cabinetActive) return;
    this.fluxballLobbyOpen = true;
    this.page = "arcade";
    this.shell.dataset["page"] = "arcade";
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

  public activateFocusedControl(): void {
    if (!this.entered || this.cabinetActive) return;
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && this.root.contains(active)) {
      active.click();
      return;
    }
    this.focusPageTarget();
  }

  public moveMenuFocus(direction: -1 | 1): void {
    if (!this.entered || this.cabinetActive) return;
    const controls = [
      ...this.root.querySelectorAll<HTMLButtonElement>("button"),
    ].filter(
      (button) =>
        !button.hidden && !button.disabled && button.offsetParent !== null,
    );
    if (controls.length === 0) return;
    const current = document.activeElement;
    const currentIndex =
      current instanceof HTMLButtonElement ? controls.indexOf(current) : -1;
    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : controls.length - 1
        : (currentIndex + direction + controls.length) % controls.length;
    const next = controls[nextIndex];
    next?.focus();
    next?.scrollIntoView({ block: "nearest" });
  }

  public showFormula(gameId: GameId): void {
    if (
      !this.entered ||
      this.cabinetActive ||
      !this.save.story.recoveredFormulae.includes(gameId)
    ) {
      return;
    }
    this.selectedFormula = gameId;
    this.showPage("formula");
  }

  public showDevelopmentFormula(gameId: GameId): void {
    if (!import.meta.env.DEV || !this.entered || this.cabinetActive) return;
    this.selectedFormula = gameId;
    this.showPage("formula");
  }

  public showStoryPresentation(snapshot: StoryV2PresentationSnapshot): void {
    if (!this.entered || this.cabinetActive || snapshot.beat === null) return;
    if (snapshot.beat.kind === "explore") {
      if (this.storyWalkMachine?.snapshot().beatId !== snapshot.beat.id) {
        this.storyWalkMachine = new StoryV2WalkMachine(snapshot.beat.id);
      }
    } else {
      this.storyWalkMachine = null;
    }
    this.storyPresentation = snapshot;
    this.showPage("interlude");
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
    else if (this.page === "story-brief") this.showPage("story");
    else if (this.page === "help") {
      const destination =
        this.gameHelp?.context === "arcade" ? "arcade" : "story";
      this.showPage(destination);
    } else if (this.page === "formula") this.showPage("main");
    else if (this.page === "developer" || this.page === "credits") {
      this.showPage("settings");
    } else if (this.page === "interlude") {
      this.storyPresentation = null;
      this.storyWalkMachine = null;
      this.actions.onStoryPresentationExited();
      this.showPage("story");
    } else this.showPage("main");
  }

  public updateSave(save: QuantumBoxSave): void {
    this.save = save;
    this.shell.dataset["reducedMotion"] = String(save.settings.reducedMotion);
    this.titleField.setReducedMotion(save.settings.reducedMotion);
    this.viewportField.setReducedMotion(save.settings.reducedMotion);
    this.shell.dataset["flicker"] = String(save.settings.crtFlicker);
    this.renderPage();
  }

  public resetPlayerState(save: QuantumBoxSave): void {
    this.save = save;
    this.selectedFormula = null;
    this.storyPresentation = null;
    this.storyWalkMachine = null;
    this.settingsSection = "display";
    this.settingsPlayerId = "A";
    this.arcadeRunSeed = DEFAULT_ARCADE_RUN_SEED;
    this.arcadeRunOrigin =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).has("qa")
        ? "developer-qa"
        : "player-arcade";
    this.storyUnavailableMessage = null;
    this.gameHelp = null;
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

  public beginQong(opponent: QongOpponent): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "qong";
    this.qongUi.hidden = false;
    this.qongStoryUi.hidden = true;
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

  public beginQongStory(snapshot: QongStorySequenceSnapshot): void {
    if (!this.entered) return;
    this.cabinetActive = true;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "qong-story";
    this.gameUi.dataset["phase"] = snapshot.phase;
    this.qongUi.hidden = true;
    this.qongStoryUi.hidden = false;
    this.skipixlUi.hidden = true;
    this.fluxballUi.hidden = true;
    this.quantmanUi.hidden = true;
    this.quagUi.hidden = true;
    this.updateQongStory(snapshot);
    required<HTMLElement>(
      this.qongStoryUi,
      "[data-qong-story='surface']",
    ).focus();
  }

  public updateQongStory(snapshot: QongStorySequenceSnapshot): void {
    if (
      !this.cabinetActive ||
      this.gameUi.dataset["cabinet"] !== "qong-story"
    ) {
      return;
    }
    this.gameUi.dataset["phase"] = snapshot.phase;
    this.qongStoryUi.dataset["phase"] = snapshot.phase;
    this.qongStoryUi.dataset["scene"] = snapshot.scene;
    this.qongStoryUi.dataset["moving"] = String(snapshot.moving);
    this.qongStoryUi.dataset["facing"] = snapshot.facing;
    this.qongStoryUi.dataset["atComputer"] = String(snapshot.atComputer);
    this.qongStoryUi.dataset["doorFrame"] = String(snapshot.doorFrame);
    const player = required<HTMLElement>(
      this.qongStoryUi,
      "[data-qong-story='player']",
    );
    const designer = required<HTMLElement>(
      this.qongStoryUi,
      "[data-qong-story='designer']",
    );
    setQongStoryPosition(player, snapshot.player);
    setQongStoryPosition(designer, snapshot.designer);
    const playerMorph = required<HTMLElement>(
      this.qongStoryUi,
      "[data-qong-story='player-morph']",
    );
    const designerMorph = required<HTMLElement>(
      this.qongStoryUi,
      "[data-qong-story='designer-morph']",
    );
    const morphOffset = qongStoryFrameOffset(snapshot.morphFrame, 20);
    playerMorph.style.transform = `translateX(${morphOffset})`;
    designerMorph.style.transform = `translateX(${morphOffset})`;
    required<HTMLElement>(
      this.qongStoryUi,
      "[data-qong-story='player-walk']",
    ).style.transform = `translateX(${qongStoryPlayerFrameOffset(snapshot)})`;
    required<HTMLElement>(
      this.qongStoryUi,
      "[data-qong-story='designer-action']",
    ).style.transform = `translateX(${qongStoryDesignerFrameOffset(snapshot)})`;
    required<HTMLElement>(
      this.qongStoryUi,
      "[data-qong-story='well-done']",
    ).hidden = !snapshot.showWellDone;
    const prompt = required<HTMLElement>(
      this.qongStoryUi,
      "[data-qong-story='prompt']",
    );
    if (prompt.textContent !== snapshot.prompt)
      prompt.textContent = snapshot.prompt;
    prompt.hidden = snapshot.prompt.length === 0;
    required<HTMLButtonElement>(
      this.qongStoryUi,
      "[data-action='qong-story-use']",
    ).disabled = !snapshot.atComputer;
  }

  public beginSkiPixl(): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "skipixl";
    this.qongUi.hidden = true;
    this.qongStoryUi.hidden = true;
    this.skipixlUi.hidden = false;
    this.fluxballUi.hidden = true;
    this.quantmanUi.hidden = true;
    this.quagUi.hidden = true;
    required<HTMLButtonElement>(
      this.skipixlUi,
      "[data-action='skipixl-pause']",
    ).focus();
  }

  public beginFluxball(): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "fluxball";
    this.qongUi.hidden = true;
    this.qongStoryUi.hidden = true;
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

  public beginQuantman(): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "quantman";
    this.qongUi.hidden = true;
    this.qongStoryUi.hidden = true;
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
    retry.textContent = "RETRY · X";
    retry.hidden = !complete;
    required<HTMLButtonElement>(
      this.quantmanUi,
      "[data-action='quantman-continue']",
    ).hidden = !complete;
    required<HTMLButtonElement>(
      this.quantmanUi,
      "[data-action='quantman-pause']",
    ).hidden = complete;
  }

  public beginQuag(): void {
    if (!this.entered || this.cabinetActive) return;
    this.cabinetActive = true;
    this.status.textContent = "";
    this.shell.dataset["view"] = "cabinet";
    this.screenHeader.hidden = true;
    this.pageRoot.hidden = true;
    this.screenFooter.hidden = true;
    this.gameUi.hidden = false;
    this.gameUi.dataset["cabinet"] = "quag";
    this.qongUi.hidden = true;
    this.qongStoryUi.hidden = true;
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
    required(this.quagUi, "[data-quag='targets']").textContent = hud.targets;
    required(this.quagUi, "[data-quag='notice']").textContent = hud.notice;
    const complete = snapshot.phase === "complete";
    required<HTMLButtonElement>(
      this.quagUi,
      "[data-action='quag-replay']",
    ).hidden = !complete;
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
    replayButton.hidden = snapshot.phase !== "complete";

    if (snapshot.phase === "active") {
      renderFluxballLiveDisclosure(this.fluxballUi, snapshot);
      notice.textContent = hud.notice;
      return;
    }
    if (snapshot.phase === "reveal" && snapshot.reveal) {
      notice.textContent = hud.notice;
      continueButton.textContent =
        snapshot.roundNumber === snapshot.totalRounds
          ? "COMPLETE MATCH · SPACE"
          : "NEXT ROUND · SPACE";
      renderFluxballSemanticHistory(this.fluxballUi, snapshot);
      return;
    }
    clearFluxballReveal(this.fluxballUi);
    notice.textContent = hud.notice;
    const resultLabel = fluxballCompletionLabel(playMode, snapshot.humanWon);
    required(this.fluxballUi, "[data-fluxball='reveal']").innerHTML =
      `<section class="qb-fluxball-final"><strong>${resultLabel}</strong><span>${fluxballScoreLine(snapshot)}</span></section>`;
    continueButton.textContent =
      playMode === "story" && !snapshot.humanWon
        ? "RETRY · SPACE"
        : "EXIT · SPACE";
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
    ).hidden = !complete;
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
        ? "RETRY: SPACE"
        : "PRESS SPACE TO OBSERVE RULES";
    required(this.qongUi, "[data-qong='observations']").textContent =
      snapshot.phase === "complete"
        ? ""
        : `OBS ${snapshot.observationsRemaining}`;
    replayButton.hidden = snapshot.phase !== "complete";
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
    this.shell.dataset["view"] = "menu";
    this.gameUi.hidden = true;
    this.qongUi.hidden = true;
    this.qongStoryUi.hidden = true;
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
    this.titleField.destroy();
    this.viewportField.destroy();
    this.bitmapText.destroy();
    this.scrollPositionObserver.disconnect();
    this.root.removeEventListener("click", this.onClick);
    this.root.removeEventListener("change", this.onChange);
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
      this.selectedFormula,
      this.storyPresentation,
      this.storyWalkMachine?.snapshot() ?? null,
      this.arcadeRunSeed,
      this.storyUnavailableMessage,
      this.gameHelp,
      this.settingsSection,
      this.settingsPlayerId,
    );
    const breadcrumb = required(this.root, "[data-ui='breadcrumb']");
    breadcrumb.textContent = PAGE_TITLES[this.page];
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
          ? "button[data-page='arcade']"
          : this.page === "arcade"
            ? "button[data-action='launch-arcade']"
            : this.page === "story"
              ? "button[data-action='launch-story']"
              : this.page === "help"
                ? "button[data-action='help-continue']"
                : this.page === "interlude" && this.storyWalkMachine
                  ? "[data-story-walk-room]"
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
    else if (action === "back") this.handleBack();
    else if (action === "navigate" && isShellPage(button.dataset["page"])) {
      this.showPage(button.dataset["page"]);
    } else if (
      action === "launch-story" &&
      isStoryStage(button.dataset["storyStage"])
    ) {
      this.actions.onLaunchStory(
        button.dataset["storyStage"],
        button.dataset["storyReplay"] === "true",
      );
    } else if (action === "story-v2-continue") {
      this.actions.onStoryPresentationContinue();
    } else if (action === "story-walk-step") {
      const direction = button.dataset["direction"];
      if (isStoryWalkDirection(direction)) this.moveStoryWalk(direction);
    } else if (action === "story-walk-use") {
      this.useStoryWalk();
    } else if (action === "qong-story-step") {
      const direction = button.dataset["direction"];
      if (isQongStoryDirection(direction)) {
        this.actions.onQongStoryAction({ kind: "step", direction });
      }
    } else if (action === "qong-story-use") {
      this.actions.onQongStoryAction({ kind: "use" });
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
    } else if (action === "formula-step") this.openFormulaStep(button);
    else if (action === "inspect-formula") {
      const gameId = button.dataset["gameId"];
      if (
        isGameId(gameId) &&
        this.save.story.recoveredFormulae.includes(gameId)
      ) {
        this.selectedFormula = gameId;
        this.showPage("formula");
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
    } else if (action === "how-to-play") {
      const gameId = button.dataset["gameId"];
      if (gameId === "qong" || gameId === "fluxball") {
        this.gameHelp = Object.freeze({ gameId, context: "arcade" });
        this.page = "help";
        this.renderPage();
        this.focusPageTarget();
      }
    } else if (action === "help-continue" && this.gameHelp) {
      const help = this.gameHelp;
      if (help.context === "arcade") this.showPage("arcade");
      else this.actions.onFirstLossHelpContinue(help.gameId);
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
    if (setting === "arcadeInitials" && input.type === "text") {
      const initials = input.value.trim().toUpperCase();
      if (!/^[A-Z0-9-]{3}$/.test(initials)) {
        input.value = this.save.settings.arcadeInitials;
        this.announce(
          "Arcade initials must be exactly three letters, digits, or dashes.",
        );
        return;
      }
      input.value = initials;
      this.actions.onSettingChanged({ arcadeInitials: initials });
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
    if (this.page === "interlude" && this.storyWalkMachine) {
      const direction = storyWalkDirectionForCode(
        event.code,
        this.save.settings.keyboardBindings,
      );
      const action = KEYBOARD_PLAYERS.some(
        (playerId) =>
          this.save.settings.keyboardBindings[playerId].action === event.code,
      );
      if (direction || action) {
        event.preventDefault();
        event.stopPropagation();
        if (direction) this.moveStoryWalk(direction);
        else this.useStoryWalk();
        return;
      }
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

  private moveStoryWalk(direction: StoryV2WalkDirection): void {
    if (!this.storyWalkMachine) return;
    const result = this.storyWalkMachine.step(direction);
    if (result.moved) this.actions.onStoryWalkStep();
    this.updateStoryWalkDom(result.snapshot);
  }

  private useStoryWalk(): void {
    if (!this.storyWalkMachine) return;
    if (!this.storyWalkMachine.canContinue()) {
      const destination =
        this.storyWalkMachine.snapshot().room.destinationLabel;
      this.announce(
        `Walk to the ${destination.toLowerCase()}, then use your action key.`,
      );
      return;
    }
    this.actions.onStoryPresentationContinue();
  }

  private updateStoryWalkDom(snapshot: StoryV2WalkSnapshot): void {
    const room = this.pageRoot.querySelector<HTMLElement>(
      "[data-story-walk-room]",
    );
    const player = this.pageRoot.querySelector<HTMLElement>(
      "[data-story-walk-player]",
    );
    const playerImage = player?.querySelector<HTMLElement>("img");
    const use = this.pageRoot.querySelector<HTMLButtonElement>(
      "[data-action='story-walk-use']",
    );
    const hint = this.pageRoot.querySelector<HTMLElement>(
      "[data-story-walk-hint]",
    );
    if (!room || !player || !playerImage || !use || !hint) return;
    room.dataset["atDestination"] = String(snapshot.atDestination);
    player.dataset["facing"] = snapshot.facing;
    player.style.setProperty(
      "--qb-walk-left",
      storyWalkCoordinate(snapshot.position.x, snapshot.room.columns),
    );
    player.style.setProperty(
      "--qb-walk-top",
      storyWalkCoordinate(snapshot.position.y, snapshot.room.rows),
    );
    player.style.setProperty(
      "--qb-walk-frame-x",
      `${-storyWalkFrameX(snapshot) * (100 / 320)}cqw`,
    );
    use.disabled = !snapshot.atDestination;
    hint.textContent = snapshot.atDestination
      ? `${snapshot.room.destinationLabel} · USE`
      : `${snapshot.room.label} · FIND THE ${snapshot.room.destinationLabel}`;
    this.bitmapText.renderNow();
  }

  private openFormulaStep(button: HTMLButtonElement): void {
    const layerId = button.dataset["formulaLayer"];
    if (!layerId || !/^0[1-7]$/.test(layerId)) return;
    const layer = this.pageRoot.querySelector<HTMLDetailsElement>(
      `.qb-formula-layer[data-formula-layer="${layerId}"]`,
    );
    if (!layer) return;
    for (const candidate of this.pageRoot.querySelectorAll<HTMLDetailsElement>(
      ".qb-formula-layer",
    )) {
      candidate.open = candidate === layer;
    }
    for (const step of this.pageRoot.querySelectorAll<HTMLButtonElement>(
      "[data-action='formula-step']",
    )) {
      step.setAttribute("aria-pressed", String(step === button));
    }
    layer.open = true;
    const status = this.pageRoot.querySelector<HTMLOutputElement>(
      "[data-formula-path-status]",
    );
    if (status) status.textContent = button.dataset["description"] ?? "";
    layer.scrollIntoView({
      block: "start",
      behavior: this.save.settings.reducedMotion ? "auto" : "smooth",
    });
    layer.querySelector<HTMLElement>("summary")?.focus({
      preventScroll: true,
    });
  }
}

function shellMarkup(): string {
  return `<main class="qb-shell" data-surface="title" data-reduced-motion="false" data-flicker="true">
    <section class="qb-title" aria-labelledby="qb-title-name">
      <h1 id="qb-title-name" class="qb-visually-hidden">Quantum Box</h1>
      <div class="qb-title-layers" aria-hidden="true"><span class="qb-title-layer qb-title-layer--device"></span><span class="qb-title-layer qb-title-layer--copy"></span></div>
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
        <footer class="qb-screen-footer"><button type="button" data-action="back" aria-label="RETURN · ESC">ESC</button><span>SELECT · ENTER / A</span></footer>
        <section class="qb-game-ui" data-ui="game" hidden>
          <section class="qb-cabinet-ui" data-cabinet="qong" role="region" aria-label="Qong game" hidden>
            <header class="qb-qong-score qb-visually-hidden"><div><small data-qong="left-label">YOU</small><strong data-qong="left-score">0</strong></div><div><span data-qong="round">ROUND: 1/7</span><small data-qong="rule-state">RULE STATE: UNRESOLVED</small><small data-qong="goal">GOAL: UNRESOLVED</small><small data-qong="winner">WINNER: UNRESOLVED</small></div><div><small data-qong="right-label">CPU</small><strong data-qong="right-score">0</strong></div></header>
            <output class="qb-qong-notice qb-visually-hidden" data-qong="notice" aria-live="polite"></output>
            <footer class="qb-qong-controls"><button type="button" data-action="cabinet-back" aria-label="RETURN · ESC">ESC</button><span data-qong="movement-controls">W / S</span><button type="button" data-action="qong-replay" hidden>RETRY: X</button><span data-qong="observations">OBS 3</span><button type="button" data-action="qong-observe">PRESS SPACE TO OBSERVE RULES</button><button type="button" data-action="qong-pause">PAUSE · P</button></footer>
          </section>
          ${qongStoryMarkup()}
          <section class="qb-cabinet-ui" data-cabinet="skipixl" role="region" aria-label="SkiPixl game" hidden>
            <header class="qb-skipixl-score qb-visually-hidden"><div><small><span data-skipixl="distance">4270</span> M · LIMIT <span data-skipixl="limit">1:18.00</span></small><strong data-skipixl="time">0:00.00</strong></div></header>
            <output class="qb-skipixl-notice qb-visually-hidden" data-skipixl="notice" aria-live="polite">QPIXL COURSE READY</output>
            <footer class="qb-skipixl-controls"><button type="button" data-action="cabinet-back" aria-label="RETURN · ESC">ESC</button><span>← → TURN SKIS</span><button type="button" data-action="skipixl-replay" hidden>RETRY · X</button><button type="button" data-action="skipixl-continue" hidden>CONTINUE · SPACE</button><button type="button" data-action="skipixl-pause">PAUSE · P</button></footer>
          </section>
          <section class="qb-cabinet-ui" data-cabinet="fluxball" role="region" aria-label="Fluxball game" hidden>
            <header class="qb-fluxball-hud qb-visually-hidden">
              <div class="qb-fluxball-score qb-fluxball-score--a"><small>A</small><strong data-fluxball-score="A">0</strong></div>
              <div class="qb-fluxball-score qb-fluxball-score--b"><strong data-fluxball-score="B">0</strong><small>B</small></div>
              <div class="qb-fluxball-score qb-fluxball-score--c"><small>C</small><strong data-fluxball-score="C">0</strong></div>
              <div class="qb-fluxball-score qb-fluxball-score--d"><small>D</small><strong data-fluxball-score="D">0</strong></div>
              <div class="qb-fluxball-clock"><small data-fluxball="round">R 1/4</small><strong data-fluxball="time">60</strong><span data-fluxball="format">2P · INDIVIDUAL</span></div>
            </header>
            <output class="qb-fluxball-notice qb-visually-hidden" data-fluxball="notice" aria-live="polite"></output>
            <div class="qb-fluxball-reveal" data-fluxball="reveal"></div>
            <footer class="qb-fluxball-controls"><button type="button" data-action="cabinet-back" aria-label="RETURN · ESC">ESC</button><span class="qb-visually-hidden" data-fluxball="controls">WASD · SPACE: CHANGE RULES</span><button type="button" data-action="fluxball-replay" hidden>RETRY · X</button><button type="button" data-action="fluxball-continue" hidden>NEXT ROUND · SPACE</button><button type="button" data-action="fluxball-pause">PAUSE · P</button></footer>
          </section>
          <section class="qb-cabinet-ui" data-cabinet="quantman" role="region" aria-label="Quantman QPU-derived gaze maze" hidden>
            <header class="qb-quantman-hud qb-visually-hidden"><div><small>REMAINING</small><strong data-quantman="fragments">100</strong></div><div><span data-quantman="lives">LIVES 3</span><span data-quantman="state">SCORE 00000 · READY</span><span data-quantman="focus">GAZE READY · RECORDED IBM FEZ RETURN</span></div><div><small>MODE</small><strong data-quantman="time">STABILIZE GAZE</strong></div></header>
            <output class="qb-quantman-notice qb-visually-hidden" data-quantman="notice" aria-live="polite">RECORDED IBM FEZ RETURN READY</output>
            <footer class="qb-quantman-controls"><button type="button" data-action="cabinet-back" aria-label="RETURN · ESC">ESC</button><span>ARROWS / WASD · MOVE</span><button type="button" data-action="quantman-replay" hidden>RETRY · X</button><button type="button" data-action="quantman-continue" hidden>CONTINUE · SPACE</button><button type="button" data-action="quantman-pause">PAUSE · P</button></footer>
          </section>
          <section class="qb-cabinet-ui" data-cabinet="quag" role="region" aria-label="Quarry directed aerial hunt arena" hidden>
            <div class="qb-visually-hidden"><h2>QUARRY</h2><p data-quag="score">YOU A0 · B0 C0 D0</p><p data-quag="time">100</p><p data-quag="phase">STATE 1</p><p data-quag="targets">NO TARGET</p><output data-quag="notice" aria-live="polite">READY · YOU ARE A</output></div>
            <footer class="qb-qgraph-controls"><button type="button" data-action="cabinet-back" aria-label="RETURN · ESC">ESC</button><span data-quag="controls">A/D OR ARROWS · W/SPACE/UP FLAP</span><button type="button" data-action="quag-replay" hidden>RETRY · X</button><button type="button" data-action="quag-continue" hidden>EXIT · SPACE</button><button type="button" data-action="quag-restart" hidden>RESTART · X</button><button type="button" data-action="quag-pause">PAUSE · P</button></footer>
          </section>
        </section>
      </div>
    </section>
    <output class="qb-status qb-bitmap-status-mirror" data-ui="status" role="status" aria-live="polite"></output>
  </main>`;
}

function qongStoryMarkup(): string {
  const playerMorph = requireDesignerProfessorAsset("qong-paddle-to-player-c");
  const designerMorph = requireDesignerProfessorAsset(
    "qong-paddle-to-professor",
  );
  const playerWalk = requireCanonicalAsset(
    "player-c-four-direction-walk-strip",
  );
  const designerAction = requireDesignerProfessorAsset(
    "professor-action-strip",
  );
  const designerDoor = requireDesignerProfessorAsset("professor-open-door");
  return `<section class="qb-cabinet-ui qb-qong-story" data-cabinet="qong-story" data-phase="morph" data-scene="court" role="region" aria-label="Qong story transition" hidden>
    <div class="qb-qong-story-surface" data-qong-story="surface" role="application" aria-label="The completed Qong court. Both paddles are transforming. Walk to the door, then explore the Designer's office." tabindex="0">
      <div class="qb-qong-story-court" aria-hidden="true">
        <i class="qb-qong-story-door"><i></i></i>
      </div>
      <div class="qb-qong-story-office" aria-hidden="true">
        <i class="qb-office-wall qb-office-wall--top"></i>
        <i class="qb-office-window"><i></i></i>
        <i class="qb-office-bookshelf"><i></i><b></b></i>
        <i class="qb-office-rug"></i>
        <i class="qb-office-side-table"></i>
        <i class="qb-office-desk"><i class="qb-office-computer"><b></b></i><i class="qb-office-keyboard"></i></i>
        <i class="qb-office-chair"></i>
        <i class="qb-office-entry"></i>
      </div>
      <span class="qb-qong-story-actor qb-qong-story-player" data-qong-story="player" aria-hidden="true">
        <span class="qb-qong-story-frame qb-qong-story-frame--morph"><img data-qong-story="player-morph" src="${escapeHtml(playerMorph.url)}" alt="" style="width:${playerMorph.dimensions.width * (100 / 320)}cqw"/></span>
        <span class="qb-qong-story-frame qb-qong-story-frame--player"><img data-qong-story="player-walk" src="${escapeHtml(playerWalk.url)}" alt="" style="width:${playerWalk.dimensions.width * (100 / 320)}cqw"/></span>
      </span>
      <span class="qb-qong-story-actor qb-qong-story-designer" data-qong-story="designer" aria-hidden="true">
        <span class="qb-qong-story-frame qb-qong-story-frame--morph"><img data-qong-story="designer-morph" src="${escapeHtml(designerMorph.url)}" alt="" style="width:${designerMorph.dimensions.width * (100 / 320)}cqw"/></span>
        <span class="qb-qong-story-frame qb-qong-story-frame--designer"><img data-qong-story="designer-action" src="${escapeHtml(designerAction.url)}" alt="" style="width:${designerAction.dimensions.width * (100 / 320)}cqw"/></span>
        <span class="qb-qong-story-frame qb-qong-story-frame--door"><img src="${escapeHtml(designerDoor.url)}" alt=""/></span>
      </span>
      <output class="qb-qong-story-speech" data-qong-story="well-done" aria-live="polite" hidden>WELL DONE.</output>
      <p class="qb-qong-story-prompt" data-qong-story="prompt" aria-live="polite" hidden></p>
      <nav class="qb-qong-story-controls" aria-label="Story movement">
        <button type="button" data-action="cabinet-back" aria-label="RETURN · ESC">ESC</button>
        <button type="button" data-action="qong-story-step" data-direction="up">UP</button>
        <button type="button" data-action="qong-story-step" data-direction="left">LEFT</button>
        <button type="button" data-action="qong-story-step" data-direction="down">DOWN</button>
        <button type="button" data-action="qong-story-step" data-direction="right">RIGHT</button>
        <button type="button" data-action="qong-story-use" disabled>USE · SPACE</button>
      </nav>
    </div>
  </section>`;
}

function setQongStoryPosition(
  element: HTMLElement,
  point: Readonly<{ x: number; y: number }>,
): void {
  element.style.setProperty("--qb-qong-story-x", `${(point.x / 320) * 100}cqw`);
  element.style.setProperty("--qb-qong-story-y", `${(point.y / 180) * 100}cqh`);
}

function qongStoryFrameOffset(frame: number, width: number): string {
  return `${-(frame * width) * (100 / 320)}cqw`;
}

function qongStoryPlayerFrameOffset(
  snapshot: QongStorySequenceSnapshot,
): string {
  const direction =
    snapshot.facing === "down"
      ? "front"
      : snapshot.facing === "up"
        ? "back"
        : snapshot.facing;
  const frame = requireCanonicalFrame(
    "player-c-four-direction-walk-strip",
    `${direction}-${snapshot.moving && snapshot.phaseTick % 8 >= 4 ? "walk" : "idle"}`,
  ).frame;
  return `${-frame.rect.x * (100 / 320)}cqw`;
}

function qongStoryDesignerFrameOffset(
  snapshot: QongStorySequenceSnapshot,
): string {
  const frameId =
    snapshot.phase === "designer-walk" && snapshot.phaseTick % 8 >= 4
      ? "walk-b"
      : snapshot.phase === "designer-walk"
        ? "walk-a"
        : snapshot.phase === "office-walk" && snapshot.phaseTick % 18 >= 9
          ? "talk-b"
          : "idle";
  const frame = requireDesignerProfessorFrame(
    "professor-action-strip",
    frameId,
  ).frame;
  return `${-frame.rect.x * (100 / 320)}cqw`;
}

function isQongStoryDirection(
  value: string | undefined,
): value is QongStoryDirection {
  return (
    value === "up" || value === "down" || value === "left" || value === "right"
  );
}

function pageMarkup(
  page: ShellPage,
  save: QuantumBoxSave,
  selectedFormula: GameId | null,
  storyPresentation: StoryV2PresentationSnapshot | null,
  storyWalk: StoryV2WalkSnapshot | null,
  arcadeRunSeed: number,
  storyUnavailableMessage: string | null,
  gameHelp: Readonly<{
    gameId: "qong" | "fluxball";
    context: "arcade" | "story-loss";
  }> | null,
  settingsSection: SettingsSection,
  settingsPlayerId: PlayerId,
): string {
  switch (page) {
    case "main":
      return `<div class="qb-page-panel qb-index"><h1 class="qb-visually-hidden" tabindex="-1">ARCHIVE INDEX</h1><nav aria-label="Quantum Box channels">
        ${primaryMenuButton("story", "01", "STORY")}
        ${primaryMenuButton("arcade", "02", "ARCADE")}
        ${lockedPrimaryMenuButton("03", "WORKSHOP")}
        ${primaryMenuButton("settings", "04", "SETTINGS")}
      </nav></div>`;
    case "story":
      return storySelectionMarkup(save);
    case "story-brief": {
      return storyUnavailableMessage
        ? storyUnavailableMarkup(storyUnavailableMessage)
        : storySelectionMarkup(save);
    }
    case "help":
      return gameHelp
        ? howToPlayMarkup(gameHelp.gameId, gameHelp.context)
        : storySelectionMarkup(save);
    case "arcade":
      return `<div class="qb-page-panel qb-arcade-library"><h1 class="qb-visually-hidden" tabindex="-1">ARCADE</h1><p class="qb-visually-hidden">All channels open. Arcade runs do not grant Story authority.</p><div class="qb-arcade-list" data-scroll-list>${ARCADE_CABINET_IDS.map((id) => arcadeGameMarkup(id, save)).join("")}</div>${scrollPositionMarkup()}</div>`;
    case "workshop":
      return workshopMarkup(save);
    case "formula":
      return formulaMarkup(selectedFormula, save);
    case "interlude":
      return storyV2PresentationMarkup(storyPresentation, storyWalk);
    case "settings":
      return settingsMarkup(save, settingsSection, settingsPlayerId);
    case "developer":
      return `<div class="qb-page-panel qb-scroll qb-developer-page"><p class="qb-kicker">EXPLICIT TEST CONTROLS</p><h1 tabindex="-1">DEVELOPER SURFACE</h1><p>These controls never grant Story authority or write completion evidence.</p><fieldset class="qb-settings"><legend>Arcade setup</legend><label><span>RUN SEED</span><input type="number" min="0" max="4294967295" step="1" value="${arcadeRunSeed}" data-developer-run-seed/></label></fieldset><p>Story v2 presentation beats are available through the development-only QA URL.</p></div>`;
    case "credits":
      return `<div class="qb-page-panel qb-scroll"><p class="qb-kicker">PROVISIONAL RECORD</p><h1 tabindex="-1">SOURCE RECORD</h1><dl class="qb-record"><div><dt>DEVICE</dt><dd>QUANTUM BOX · QB-00</dd></div><div><dt>FORM</dt><dd>EARLY-1970S COLOUR RASTER ANTHOLOGY</dd></div><div><dt>ENGINES</dt><dd>COIN TOSS · QPIXL · QUANTUM GRAPH · LABYRINTH</dd></div><div><dt>BOUNDARY</dt><dd>TIMED PLAY IS CLASSICAL AND LOCAL. COMMITTED ENGINE PACKS FREEZE BEFORE PLAY.</dd></div><div><dt>DESIGNER</dt><dd>A FICTIONAL EXPERIMENTER GIVEN ACCESS TO MOTH; NOT ITS INVENTOR AND NOT MOTH COMPANY HISTORY.</dd></div><div><dt>MENU AUDIO</dt><dd>FLUXBALL · OPEN FIELD · 65% · REGION 3. EXACT APPROVED QRC / QISKIT AER-DERIVED WAV; NOT QPU AUDIO.</dd></div></dl></div>`;
  }
}

function primaryMenuButton(
  page: "story" | "arcade" | "settings",
  number: string,
  label: string,
): string {
  return `<button class="qb-primary-menu-row" type="button" data-action="navigate" data-page="${page}" aria-label="${label}"><span>${number}</span><strong>${label}</strong></button>`;
}

function lockedPrimaryMenuButton(number: string, label: string): string {
  return `<button class="qb-primary-menu-row is-locked" type="button" disabled aria-disabled="true" aria-label="${label} · LOCKED"><span>${number}</span><strong>${label}</strong><small>STORY LOCKED</small></button>`;
}

function storyUnavailableMarkup(message: string): string {
  return `<div class="qb-page-panel qb-story-unavailable"><h1 tabindex="-1">QONG</h1><p class="qb-story-closed" role="status" aria-label="${escapeHtml(message)}">APPROVED QPU BANK REQUIRED</p><button class="qb-action" data-action="navigate" data-page="arcade">ARCADE</button></div>`;
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
        "SPACE OBSERVES THE RULE EARLY. A GOAL-LINE CROSSING OBSERVES IT AUTOMATICALLY.",
        "YOU HAVE THREE OBSERVATIONS ACROSS SEVEN ROUNDS.",
      ]
    : [
        "THE BALL MAY CROSS ANY PHYSICAL GOAL. THE HIDDEN GOAL RULE DECIDES WHO RECEIVES THE POINT.",
        "GLOBAL SHARES ONE RULE SET. INDIVIDUAL GIVES EACH PLAYER A COUPLED HIDDEN SET.",
        "ONCE PER ROUND, THE FIRST HUMAN TO CHANGE RULES ADVANCES THE WHOLE RULEFIELD.",
      ];
  const action =
    context === "story-loss" ? "RETRY · SPACE" : "BACK TO ARCADE · SPACE";
  return `<div class="qb-page-panel qb-game-help"><p class="qb-kicker">HOW TO PLAY</p><h1 tabindex="-1">${title}</h1>${lines.map((line) => `<p>${line}</p>`).join("")}<button class="qb-action" type="button" data-action="help-continue">${action}</button></div>`;
}

function storySelectionMarkup(save: QuantumBoxSave): string {
  return `<div class="qb-page-panel qb-story-select"><h1 class="qb-visually-hidden" tabindex="-1">STORY</h1><div class="qb-story-select-list" data-scroll-list>${STORY_CHAPTER_IDS.map((chapterId) => storySelectionRow(chapterId, save)).join("")}</div>${scrollPositionMarkup()}</div>`;
}

function storyV2PresentationMarkup(
  snapshot: StoryV2PresentationSnapshot | null,
  storyWalk: StoryV2WalkSnapshot | null,
): string {
  const beat = snapshot?.beat;
  if (!snapshot || !beat) {
    return `<div class="qb-page-panel qb-story-interlude"><h1 tabindex="-1">STORY TRANSITION</h1><p>No qualified transition is currently loaded.</p></div>`;
  }
  if (beat.id === "quarry-moth-link") {
    return storyV2MothLinkMarkup(snapshot, beat);
  }
  const speaker = beat.speaker
    ? `<strong class="qb-story-speaker">${escapeHtml(beat.speaker)}</strong>`
    : "";
  if (beat.kind === "terminal" && beat.terminalPageId !== null) {
    return storyV2TerminalMarkup(snapshot, beat);
  }
  if (beat.kind === "explore") {
    if (!storyWalk || storyWalk.beatId !== beat.id) {
      throw new Error(`Story walk state is missing for ${beat.id}.`);
    }
    return storyV2WalkMarkup(snapshot, beat, storyWalk);
  }
  const lines = storyV2BeatLines(snapshot, beat);
  const dialogue = lines.length
    ? `<section class="qb-story-dialogue" aria-live="polite">${speaker}${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</section>`
    : "";
  return `<div class="qb-page-panel qb-story-interlude ${lines.length ? "has-dialogue" : "is-action"}" data-story-beat="${escapeHtml(beat.id)}" data-story-kind="${beat.kind}" data-story-scene="${storyV2SceneKind(snapshot.flowId, beat)}"><h1 class="qb-visually-hidden" tabindex="-1">${escapeHtml(snapshot.stageId.toUpperCase())} STORY TRANSITION</h1>${storyV2SceneMarkup(snapshot, beat)}${dialogue}<button class="qb-action qb-story-continue" type="button" data-action="story-v2-continue">${beat.prompt}</button></div>`;
}

function storyV2MothLinkMarkup(
  snapshot: StoryV2PresentationSnapshot,
  beat: StoryV2PresentationBeat,
): string {
  return `<div class="qb-page-panel qb-story-interlude is-terminal qb-story-moth-link" data-story-beat="${escapeHtml(beat.id)}" data-story-kind="terminal" data-story-scene="workshop"><h1 class="qb-visually-hidden" tabindex="-1">MOTH PLATFORM</h1><section class="qb-story-moth-card"><p class="qb-kicker">FINAL WORKSHOP</p><strong>MOTH PLATFORM</strong><p>THE DESIGNER'S EXPERIMENT ENDS AT THE REAL MOTH PLATFORM.</p><p>OPENING IT IS YOUR CHOICE. QUANTUM BOX STORES NO KEY OR CREDENTIAL.</p><a href="https://platform.mothquantum.com/" target="_blank" rel="noopener noreferrer" data-story-moth-link>OPEN MOTH PLATFORM</a></section><button class="qb-action qb-story-continue" type="button" data-action="story-v2-continue">${beat.prompt}</button><span class="qb-visually-hidden">${escapeHtml(snapshot.stageId.toUpperCase())} FINAL REWARD</span></div>`;
}

function storyV2BeatLines(
  snapshot: StoryV2PresentationSnapshot,
  beat: StoryV2PresentationBeat,
): readonly string[] {
  const detail = snapshot.evidence?.detail;
  if (detail?.kind !== "skipixl" || !detail.attempt) return beat.lines;
  if (beat.id === "skipixl-medium-harder-warning") {
    return detail.attempt.qualified
      ? beat.lines
      : [
          "YOU REACHED THE BOTTOM, BUT MISSED THE LIMIT.",
          "I HAVE A HARDER ONE. IT MAY NOT HAVE WORKED OUT PARTICULARLY WELL.",
        ];
  }
  if (beat.id === "skipixl-hard-dismount") {
    return detail.attempt.qualified
      ? ["YOU MADE IT. LEAVE THE SKIS HERE."]
      : [
          "YOU REACHED THE CABIN. THE COURSE WON THIS ONE.",
          "LEAVE THE SKIS HERE.",
        ];
  }
  return beat.lines;
}

function storyV2WalkMarkup(
  snapshot: StoryV2PresentationSnapshot,
  beat: StoryV2PresentationBeat,
  walk: StoryV2WalkSnapshot,
): string {
  const room = walk.room;
  const fixtures = room.fixtures
    .map(
      (fixture) =>
        `<i class="qb-story-walk-fixture qb-story-walk-fixture--${fixture.kind}" style="left:${(fixture.x / room.columns) * 100}%;top:${(fixture.y / room.rows) * 100}%;width:${(fixture.width / room.columns) * 100}%;height:${(fixture.height / room.rows) * 100}%"></i>`,
    )
    .join("");
  return `<div class="qb-page-panel qb-story-interlude is-walk" data-story-beat="${escapeHtml(beat.id)}" data-story-kind="explore" data-story-scene="${storyV2SceneKind(snapshot.flowId, beat)}"><h1 class="qb-visually-hidden" tabindex="-1">${escapeHtml(room.label)}</h1><div class="qb-story-walk-room" data-story-walk-room data-room="${room.roomId}" data-destination="${room.destinationLabel.toLowerCase()}" data-at-destination="${walk.atDestination}" tabindex="0" role="application" aria-label="${escapeHtml(room.label)}. Walk to the ${room.destinationLabel.toLowerCase()} and use an action key."><div class="qb-story-walk-floor" aria-hidden="true">${fixtures}<i class="qb-story-walk-destination" style="--qb-walk-left:${storyWalkCoordinate(room.destination.x, room.columns)};--qb-walk-top:${storyWalkCoordinate(room.destination.y, room.rows)}"></i>${storyV2WalkDesignerMarkup(walk)}${storyV2WalkPlayerMarkup(walk)}</div><p class="qb-story-walk-hint" data-story-walk-hint>${walk.atDestination ? `${room.destinationLabel} · USE` : `${escapeHtml(room.label)} · FIND THE ${room.destinationLabel}`}</p><nav class="qb-story-walk-controls" aria-label="Story movement"><button type="button" data-action="story-walk-step" data-direction="up">UP</button><button type="button" data-action="story-walk-step" data-direction="left">LEFT</button><button type="button" data-action="story-walk-step" data-direction="down">DOWN</button><button type="button" data-action="story-walk-step" data-direction="right">RIGHT</button><button type="button" data-action="story-walk-use" ${walk.atDestination ? "" : "disabled"}>USE</button></nav></div></div>`;
}

function storyV2TerminalMarkup(
  snapshot: StoryV2PresentationSnapshot,
  beat: StoryV2PresentationBeat,
): string {
  if (beat.terminalPageId === null) {
    throw new Error(`Terminal beat ${beat.id} has no terminal page.`);
  }
  const terminal = storyV2TerminalPresentation(
    beat.terminalPageId,
    snapshot.evidence,
  );
  const runId = snapshot.evidence?.identity.runId ?? "unbound";
  const evidenceSha =
    snapshot.evidence?.identity.qualificationEvidenceSha256 ?? "unbound";
  const terminalModel = storyTerminal(snapshot.chapterId);
  const terminalStep = terminalModel.pages.findIndex(
    (candidate) => candidate.id === terminal.page.id,
  );
  const kicker =
    snapshot.chapterId === "qong"
      ? `COIN TOSS · STEP ${terminalStep + 1}/${terminalModel.pages.length}`
      : `${snapshot.stageId.toUpperCase()} · ${snapshot.beatIndex + 1}/${snapshot.beatCount}`;
  const status =
    snapshot.chapterId === "qong" && terminal.evidenceStatus === "bound"
      ? `<div class="qb-story-terminal-status"><span>RECORDED HARDWARE RESULT</span><span>OFFLINE DURING PLAY</span></div>`
      : `<div class="qb-story-terminal-status"><span>${escapeHtml(terminal.sourceLabel)}</span><span>${escapeHtml(terminal.authorityLabel)}</span></div>`;
  const technicalRecord =
    terminal.identity.length + terminal.details.length > 0
      ? `<details class="qb-story-terminal-technical"><summary>TECHNICAL RECORD</summary>${storyV2TerminalDataMarkup("RUN RECEIPT", terminal.identity)}${storyV2TerminalDataMarkup("PAGE EVIDENCE", terminal.details)}</details>`
      : "";
  return `<div class="qb-page-panel qb-story-interlude is-terminal" data-story-beat="${escapeHtml(beat.id)}" data-story-kind="terminal" data-story-scene="${storyV2SceneKind(snapshot.flowId, beat)}" data-story-run-id="${escapeHtml(runId)}" data-story-evidence-sha="${escapeHtml(evidenceSha)}" data-story-source-status="${escapeHtml(terminal.sourceStatus)}" data-story-evidence-status="${terminal.evidenceStatus}"><p class="qb-kicker">${escapeHtml(kicker)}</p><article class="qb-story-terminal" aria-labelledby="story-terminal-title" tabindex="0"><header><p>${escapeHtml(terminal.page.heading)}</p><h1 id="story-terminal-title" tabindex="-1">${escapeHtml(terminal.title)}</h1>${status}</header>${storyV2QongTerminalVisualMarkup(terminal.page.id, snapshot.evidence)}<section class="qb-story-terminal-readout" aria-live="polite">${terminal.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</section>${technicalRecord}</article><button class="qb-action qb-story-continue" type="button" data-action="story-v2-continue">${beat.prompt}</button></div>`;
}

function storyV2QongTerminalVisualMarkup(
  pageId: string,
  evidence: StoryV2PresentationEvidence | null,
): string {
  if (!pageId.startsWith("qong-")) return "";
  const detail =
    evidence?.completeness === "bound" && evidence.detail?.kind === "qong"
      ? evidence.detail
      : null;
  const result = detail?.storedResult;
  const stages: Readonly<Record<string, string>> = {
    "qong-input": `<span class="qb-terminal-node">REQUEST</span><i></i><span class="qb-terminal-node">1 QUBIT</span>`,
    "qong-zero": `<span class="qb-terminal-node is-active">0</span><i></i><span class="qb-terminal-note">DEFINITE START</span>`,
    "qong-hadamard": `<span class="qb-terminal-node">0</span><i></i><span class="qb-terminal-gate">H</span><i></i><span class="qb-terminal-node is-active">0 / 1</span><span class="qb-terminal-note">50 / 50 IDEALLY</span>`,
    "qong-measure": `<span class="qb-terminal-node">0 / 1</span><i></i><span class="qb-terminal-gate">MEASURE</span><i></i><span class="qb-terminal-node is-active">?</span>`,
    "qong-return": `<span class="qb-terminal-node">?</span><i></i><span class="qb-terminal-node is-active">BIT ${escapeHtml(String(result?.bit ?? "?"))}</span><span class="qb-terminal-note">${escapeHtml(result?.outcome.toUpperCase() ?? "STORED RESULT")}</span>`,
    "qong-mapping": `<span class="qb-terminal-map">0 / HEADS</span><i></i><span class="qb-terminal-map">OPPOSITE</span><span class="qb-terminal-map">1 / TAILS</span><i></i><span class="qb-terminal-map">OWN</span>`,
    "qong-play": `<span class="qb-terminal-node">LINE CROSSING</span><b>+</b><span class="qb-terminal-node">RULE BIT</span><b>=</b><span class="qb-terminal-node is-active">WINNER</span>`,
  };
  return `<div class="qb-story-terminal-visual" data-terminal-step="${escapeHtml(pageId)}">${stages[pageId] ?? ""}</div>`;
}

function storyV2TerminalDataMarkup(
  heading: string,
  data: readonly StoryV2TerminalDatum[],
): string {
  if (data.length === 0) return "";
  return `<section class="qb-story-terminal-data"><h2>${heading}</h2><dl>${data.map(({ label, value }) => `<div><dt>${escapeHtml(label)}</dt><dd title="${escapeHtml(value)}">${escapeHtml(value)}</dd></div>`).join("")}</dl></section>`;
}

function storyV2SceneMarkup(
  snapshot: StoryV2PresentationSnapshot,
  beat: StoryV2PresentationBeat,
): string {
  const scene = storyV2SceneKind(snapshot.flowId, beat);
  const props =
    scene === "den" || scene === "office"
      ? `<i class="qb-story-prop qb-story-prop--window"></i><i class="qb-story-prop qb-story-prop--desk"></i><i class="qb-story-prop qb-story-prop--terminal"></i>`
      : scene === "slope"
        ? `<i class="qb-story-prop qb-story-prop--cabin"><i class="qb-story-prop--cabin-window"></i><i class="qb-story-prop--cabin-door"></i></i><i class="qb-story-prop qb-story-prop--ski-rack"></i>`
        : scene === "field"
          ? `<i class="qb-story-prop qb-story-prop--goal-left"></i><i class="qb-story-prop qb-story-prop--goal-right"></i><i class="qb-story-prop qb-story-prop--ball"></i>`
          : scene === "ghost-den"
            ? `<i class="qb-story-prop qb-story-prop--maze"></i><i class="qb-story-prop qb-story-prop--ghost-door"></i>`
            : scene === "arena"
              ? `<i class="qb-story-prop qb-story-prop--arena-left"></i><i class="qb-story-prop qb-story-prop--arena-right"></i><i class="qb-story-prop qb-story-prop--arena-platform"></i>`
              : `<i class="qb-story-prop qb-story-prop--threshold"></i>`;
  return `<div class="qb-story-scene qb-story-scene--${scene}" aria-hidden="true">${props}${storyV2AssetMarkup(beat)}${storyV2CompanionMarkup(beat)}${beat.kind === "door" ? `<i class="qb-story-door"></i>` : ""}</div>`;
}

function storyV2AssetMarkup(beat: StoryV2PresentationBeat): string {
  const cue = beat.assetCue;
  if (!cue) return `<span class="qb-story-machine" aria-hidden="true">▦</span>`;
  const resolved = resolveStoryV2AssetCue(cue);
  const playback = storyV2SpritePlayback(beat);
  if (resolved.source === "canonical-runtime-v2") {
    const { asset, frame } = requireCanonicalFrame(
      resolved.fileId,
      resolved.frameIds[0],
    );
    return storySpriteSheet(
      asset.url,
      asset.dimensions.width,
      frame.rect.x,
      frame.rect.x,
      1,
      playback,
    );
  }
  const asset = requireDesignerProfessorAsset(resolved.fileId);
  const frames = resolved.frameIds.map(
    (frameId) => requireDesignerProfessorFrame(resolved.fileId, frameId).frame,
  );
  return storySpriteSheet(
    asset.url,
    asset.dimensions.width,
    frames[0]?.rect.x ?? 0,
    frames.at(-1)?.rect.x ?? 0,
    frames.length,
    playback,
  );
}

function storyV2CompanionMarkup(beat: StoryV2PresentationBeat): string {
  if (
    beat.id !== "qong-walk-to-den" &&
    beat.id !== "quarry-designer-walk-offscreen"
  ) {
    return "";
  }
  const idle = requireCanonicalFrame(
    "player-c-four-direction-walk-strip",
    "right-idle",
  );
  const walk = requireCanonicalFrame(
    "player-c-four-direction-walk-strip",
    "right-walk",
  );
  return storySpriteSheet(
    idle.asset.url,
    idle.asset.dimensions.width,
    idle.frame.rect.x,
    walk.frame.rect.x,
    2,
    "walk-loop",
    "qb-story-companion",
  );
}

function storyV2WalkDesignerMarkup(walk: StoryV2WalkSnapshot): string {
  const { asset, frame } = requireDesignerProfessorFrame(
    "professor-idle",
    "idle",
  );
  return `<span class="qb-story-walk-actor qb-story-walk-designer" style="--qb-walk-left:${storyWalkCoordinate(walk.room.designer.x, walk.room.columns)};--qb-walk-top:${storyWalkCoordinate(walk.room.designer.y, walk.room.rows)}"><span class="qb-story-walk-professor-frame"><img src="${escapeHtml(asset.url)}" alt="" style="width:${asset.dimensions.width * (100 / 320)}cqw;transform:translateX(${-frame.rect.x * (100 / 320)}cqw)"/></span></span>`;
}

function storyV2WalkPlayerMarkup(walk: StoryV2WalkSnapshot): string {
  const asset = requireCanonicalAsset("player-c-four-direction-walk-strip");
  return `<span class="qb-story-walk-actor qb-story-walk-player" data-story-walk-player data-facing="${walk.facing}" style="--qb-walk-left:${storyWalkCoordinate(walk.position.x, walk.room.columns)};--qb-walk-top:${storyWalkCoordinate(walk.position.y, walk.room.rows)};--qb-walk-frame-x:${-storyWalkFrameX(walk) * (100 / 320)}cqw"><span class="qb-story-walk-player-frame"><img src="${escapeHtml(asset.url)}" alt="" style="width:${asset.dimensions.width * (100 / 320)}cqw"/></span></span>`;
}

function storyWalkCoordinate(value: number, extent: number): string {
  return `${((value + 0.5) / extent) * 100}%`;
}

function storyWalkFrameX(walk: StoryV2WalkSnapshot): number {
  const movingFrame = walk.stepSequence % 2 === 1;
  const frameId = `${storyWalkFrameDirection(walk.facing)}-${movingFrame ? "walk" : "idle"}`;
  return requireCanonicalFrame("player-c-four-direction-walk-strip", frameId)
    .frame.rect.x;
}

function storyWalkFrameDirection(
  direction: StoryV2WalkDirection,
): "front" | "back" | "left" | "right" {
  if (direction === "down") return "front";
  if (direction === "up") return "back";
  return direction;
}

function storySpriteSheet(
  url: string,
  sheetWidth: number,
  firstFrameX: number,
  lastFrameX: number,
  frameCount: number,
  playback: ReturnType<typeof storyV2SpritePlayback>,
  extraClass = "",
): string {
  const pixelCqw = 100 / 320;
  const classes = [
    "qb-story-sprite",
    `qb-story-sprite--${playback}`,
    extraClass,
  ]
    .filter(Boolean)
    .join(" ");
  return `<span class="${classes}" data-frame-count="${frameCount}"><img src="${escapeHtml(url)}" alt="" style="width:${sheetWidth * pixelCqw}cqw;--qb-story-from:${-firstFrameX * pixelCqw}cqw;--qb-story-to:${-lastFrameX * pixelCqw}cqw;--qb-story-steps:${Math.max(1, frameCount - 1)}"/></span>`;
}

function scrollPositionMarkup(): string {
  return `<span class="qb-scroll-position" data-scroll-position data-scroll-state="start" aria-hidden="true" hidden><i></i></span>`;
}

function storySelectionRow(
  chapterId: StoryChapterId,
  save: QuantumBoxSave,
): string {
  const chapter = STORY_CHAPTER_DEFINITIONS[chapterId];
  const selection = storySelectionForChapter(chapterId, save);
  const status = selection.locked ? "locked" : "unlocked";
  const icon = selection.locked ? "🔒" : "🔓";
  const completed = chapter.storyStages.filter((stage) =>
    save.story.completedStages.includes(stage),
  ).length;
  const progress =
    chapter.storyStages.length > 1
      ? `<small class="qb-story-select-progress">${completed}/${chapter.storyStages.length}</small>`
      : "";
  const content = `${arcadePreview(chapterId)}<span class="qb-story-select-number">${chapter.model.slice(-2)}</span><strong>${chapter.title}</strong>${progress}<span class="qb-story-select-status" role="img" aria-label="${status}" data-bitmap-text="${icon}">${icon}</span>`;
  return selection.stage
    ? `<button class="qb-story-select-row" type="button" data-status="unlocked" data-action="launch-story" data-story-stage="${selection.stage}" data-story-replay="${selection.replay}" aria-label="${chapter.title} · UNLOCKED">${content}</button>`
    : `<div class="qb-story-select-row" data-status="locked" aria-label="${chapter.title} · LOCKED">${content}</div>`;
}

export function storySelectionForChapter(
  chapterId: StoryChapterId,
  save: QuantumBoxSave,
): Readonly<{
  locked: boolean;
  replay: boolean;
  stage: StoryStageId | null;
}> {
  const chapter = STORY_CHAPTER_DEFINITIONS[chapterId];
  const current = save.story.currentStage;
  if (
    current !== "complete" &&
    chapter.storyStages.some((stage) => stage === current)
  ) {
    return Object.freeze({ locked: false, replay: false, stage: current });
  }
  const completed = [...chapter.storyStages]
    .reverse()
    .find((stage) => save.story.completedStages.includes(stage));
  return completed
    ? Object.freeze({ locked: false, replay: true, stage: completed })
    : Object.freeze({ locked: true, replay: false, stage: null });
}

export function storySelectionForGame(
  gameId: GameId,
  save: QuantumBoxSave,
): Readonly<{
  locked: boolean;
  replay: boolean;
  stage: StoryStageId | null;
}> {
  return storySelectionForChapter(gameId, save);
}

function arcadeGameMarkup(
  gameId: ShippedArcadeCabinetId,
  save: QuantumBoxSave,
): string {
  const game = ARCADE_CABINET_DEFINITIONS[gameId];
  const help =
    gameId === "qong" || gameId === "fluxball"
      ? `<button class="qb-arcade-help" type="button" data-action="how-to-play" data-game-id="${gameId}">HOW TO PLAY</button>`
      : "";
  return `<section class="qb-arcade-game qb-arcade-game--${gameId}" aria-labelledby="arcade-${gameId}" aria-describedby="arcade-${gameId}-source"><div class="qb-arcade-identity">${arcadePreview(gameId)}<h2 id="arcade-${gameId}">${game.title}</h2><span class="qb-visually-hidden" id="arcade-${gameId}-source">${game.model} · ${game.sourceLabel}</span>${help}</div><div class="qb-arcade-play"><div class="qb-arcade-launches">${game.arcadeModes
    .map((mode) => {
      const label = arcadeModeLabel(mode);
      return `<span class="qb-arcade-mode"><button type="button" data-action="launch-arcade" data-game-id="${game.id}" data-mode="${escapeHtml(mode)}" data-bitmap-text="${label}">${label}</button>${arcadeScoreboardMarkup(gameId, mode, save)}</span>`;
    })
    .join("")}</div></div></section>`;
}

function arcadeScoreboardMarkup(
  gameId: ShippedArcadeCabinetId,
  mode: string,
  save: QuantumBoxSave,
): string {
  const entries =
    gameId === "skipixl"
      ? save.arcadeRecords.skipixl[
          mode.toLowerCase() as "easy" | "medium" | "hard"
        ]
      : gameId === "quantman"
        ? quantmanArcadeOverallBoard(
            save.arcadeRecords,
            mode === "STABILIZE GAZE" ? "stabilize-gaze" : "inverse-gaze",
          )
        : null;
  if (!entries) return "";
  const rows = entries.length
    ? entries
        .map((entry, index) => {
          const result =
            entry.kind === "skipixl"
              ? `${(entry.officialTimeMs / 1_000).toFixed(2)} · G${entry.missedGates} · C${entry.collisions}`
              : `${escapeHtml(entry.topologyLabel)} · ${String(entry.score).padStart(5, "0")} · ${entry.outcome === "won" ? "CLEAR" : "LOST"}`;
          return `<li title="${escapeHtml(`${entry.runId} · ${entry.rulesVersion} · ${entry.pack.packId} · ${entry.pack.contentSha256}`)}"><span>${index + 1}</span><strong>${escapeHtml(entry.initials)}</strong><small>${result}</small></li>`;
        })
        .join("")
    : `<li class="qb-arcade-scores-empty">NO SCORES</li>`;
  return `<details class="qb-arcade-scores"><summary>SCORE</summary><ol>${rows}</ol></details>`;
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

function workshopBaysMarkup(save: QuantumBoxSave): string {
  return workshopBayViews(save)
    .map((view) => workshopBay(view, save))
    .join("");
}

function workshopMarkup(save: QuantumBoxSave): string {
  const platformAccess =
    save.story.currentStage === "complete"
      ? `<a class="qb-workshop-access" href="https://platform.mothquantum.com/" target="_blank" rel="noopener noreferrer">MOTH PLATFORM</a>`
      : `<span class="qb-workshop-access is-locked">MOTH LINK · STORY LOCKED</span>`;
  return `<div class="qb-page-panel qb-workshop-page"><h1 class="qb-visually-hidden" tabindex="-1">WORKSHOP</h1><p class="qb-visually-hidden">Inspect recovered engine formulae.</p><ol class="qb-workshop" data-scroll-list>${workshopBaysMarkup(save)}</ol>${scrollPositionMarkup()}${platformAccess}</div>`;
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
      return `<fieldset class="qb-settings"><legend>LOCAL PRESENTATION</legend>${setting("reducedMotion", "REDUCED MOTION", save.settings.reducedMotion)}${setting("crtFlicker", "DISPLAY FLICKER", save.settings.crtFlicker)}${setting("soundMuted", "SOUND MUTED · M", save.settings.soundMuted)}${volumeSetting(save.settings.soundVolume)}${arcadeInitialsSetting(save.settings.arcadeInitials)}</fieldset>`;
    case "background":
      return backgroundProgrammeSettings(save);
    case "controls":
      return `${keyboardSettings(save, playerId)}<button class="qb-action qb-settings-reset-keys" data-action="reset-keymap">RESTORE DEFAULT KEYS</button>`;
    case "data":
      return `<div class="qb-settings-data"><button class="qb-action" data-action="export-save">EXPORT SAVE</button><button class="qb-action" data-action="navigate" data-page="credits">SOURCE RECORD</button><button class="qb-action qb-action--danger" data-action="reset-save">RESET SAVE</button><p>SAVES, SCORES, STORY PROGRESS, AND SETTINGS STAY ON THIS DEVICE.</p></div>`;
  }
}

function workshopBay(view: WorkshopBayView, save: QuantumBoxSave): string {
  return `<li class="qb-bay ${view.recovered ? "is-recovered" : ""}"><span>${view.number}</span><div><strong>${view.title}</strong><small>${view.recovered ? `RECOVERED · ${view.engineId}` : "UNRECOVERED"}</small></div>${view.recovered ? `<nav aria-label="${view.title} recovery actions"><button type="button" data-action="inspect-formula" data-game-id="${view.gameId}">INSPECT</button></nav>` : ""}</li>`;
}

function formulaMarkup(
  selectedFormula: GameId | null,
  save: QuantumBoxSave,
): string {
  if (
    selectedFormula === null ||
    !save.story.recoveredFormulae.includes(selectedFormula)
  ) {
    return `<div class="qb-page-panel"><p class="qb-kicker">ACCESS REFUSED</p><h1 tabindex="-1">NO FORMULA SELECTED</h1><p>Only recovered formulae can be inspected.</p></div>`;
  }
  if (selectedFormula === "skipixl") {
    return skipixlFormulaMarkup(save);
  }
  if (selectedFormula === "fluxball") {
    return `<div class="qb-page-panel qb-scroll qb-formula"><p class="qb-kicker">BAY 03 · RECOVERED</p><h1 tabindex="-1">RELATIONAL RULEFIELD</h1>${sourceClass("QPU-FIRST PRE-ACQUIRED BANK", "PLAYABLE FALLBACKS ENABLED")}<p class="qb-formula-lead">At RUN_STARTED, a frozen source resolver prepares every hidden rule state for the four-round match. It prefers recorded QGraph hardware output but never makes missing QPU coverage a condition of play.</p>${formulaPath()}${formulaLayer("01", "VISIBLE BEHAVIOR", "Global Fluxball gives everybody one shared MOVE, BALL, and GOAL state. Individual Fluxball gives each player their own hidden MOVE, BALL, and GOAL state, coupled through a joint QGraph state. Players infer Individual rules through movement, contact, and scoring consequences. Once per round, the first human to use CHANGE RULES spends the shared opportunity: the joint state advances and every individual rule changes without the old or new values being disclosed. Goals reset between timed rounds; a unique goal leader earns one round win.", true)}${formulaLayer("02", "CLASSICAL DECODER", "The four gameplay rounds pair acquisition buckets 1–2, 3–4, 5–6, and 7–8. A seeded local shuffle selects two states for every round: the opening state and the possible successor. Each state makes three ordered weighted draws for MOVE, BALL, and GOAL from one selected returned joint distribution. The complete schedule is frozen before play; sport, CPU observation, physics, scoring, rule changes, and replay remain classical, deterministic, provider-free, and local.")}${formulaLayer("03", "RETURNED RESULT", "The installed bank contains 40 completed IBM Fez distributions: 16 for two-player matches and 24 for four-player matches. Every old acquisition bucket has two eligible 2P captures and three eligible 4P captures. The four gameplay rounds draw from paired buckets without altering any returned byte. Fifteen 2P captures and all 4P captures contain 4,096 shots; the earlier 2P equal round-one capture contains 1,024.")}${formulaLayer("04", "SUBMITTED INPUT", "Two-player jobs related qubits 0 and 1. Four-player jobs used one of three disjoint pairings: 0–1 with 2–3, 0–2 with 1–3, or 0–3 with 1–2. Each paired relationship requested either equal or opposed XX, YY, and ZZ structure, with mode qpu and backend ibm_fez. Credentials are absent from every committed artifact, and the browser makes no provider request during play.")}${formulaLayer("05", "ENGINE OPERATION", "graph-v1 returned one computational-basis joint distribution per completed job. Every record preserves the physical player order used for that submission; the browser remaps it to canonical Players A through D before seeded weighted sampling. Three ordered draws produce MOVE, BALL, and GOAL from the selected joint distribution. They are not presented as separately measured X, Y, and Z hardware axes.")}${formulaLayer("06", "SOURCE EVIDENCE", `<dl><div><dt>RULE BANK</dt><dd>fluxball-qgraph-qpu-bank-v2</dd></div><div><dt>RUNTIME SHA-256</dt><dd>e5564fcb5d229c766505fa4e8db5965945afeec214119517bc30c109187d4f45</dd></div><div><dt>HARDWARE CAPTURES</dt><dd>40 exact Moth graph-v1 / IBM Fez results</dd></div><div><dt>2P COVERAGE</dt><dd>16 captures · 2 per acquisition bucket · 8 buckets</dd></div><div><dt>4P COVERAGE</dt><dd>24 captures · 3 per acquisition bucket · 8 buckets</dd></div><div><dt>GAMEPLAY SCHEDULE</dt><dd>4 rounds · paired acquisition buckets · 2 hidden states per round</dd></div><div><dt>EVIDENCE INDEX</dt><dd>compiler/quantum_box_moth/evidence/fluxball-qgraph-qpu-bank-v2/index-v1.json</dd></div><div><dt>TWO-PLAYER FALLBACK</dt><dd>fluxball-aer-two-qubit-v1 · af91a70fc633ef4808e658268309ad67d7b808b1d10d77e5e36fcf35090feedb</dd></div><div><dt>FOUR-PLAYER FALLBACK</dt><dd>fluxball-aer-four-qubit-hybrid-v1 · ba9afa9d257d9a2f6e11d1b23cb3a21bf1a10f87e2c9ea6d54cde92873fe0db3</dd></div><div><dt>ACTIVE-ROUND NETWORK</dt><dd>none</dd></div></dl>`)}${fictionLayer("fluxball")}</div>`;
  }
  if (selectedFormula === "quantman") {
    return quantmanFormulaMarkup();
  }
  const receipt = save.story.qongSelector.recoveredSelection;
  const qongSource = receipt
    ? sourceClass("MOTH-ACQUIRED QPU PACK", "FROZEN BEFORE PLAY")
    : sourceClass("RECOVERY RECORD INCOMPLETE", "REPLAY UNAVAILABLE");
  const qongLead = receipt
    ? "Seven recorded hardware results supply the seven possible round rules. Two additional recorded bits chose that seven-result pack from a bank of four. Within Quong, each rule remains unresolved until observation or a goal-line crossing forces measurement."
    : "This migrated bay retains the RULE STATE explanation, but the save contains no validated recovery record or selected QPU pack. It grants no provider claim and cannot replay the room.";
  const returnedResult = receipt
    ? "Each round result came from a separately identified Moth Coin Toss QPU job acquired before play. The game does not reconstruct an ordered sequence from aggregate counts."
    : "No returned-result identity is attached to this migrated save. Recover Qong from a complete validated installed bank to establish this layer.";
  const submittedInput = receipt
    ? "No input was submitted during play. Developer-side tooling acquired, validated, normalized, and hashed the results before they entered the public game bundle."
    : "No provider submission record is attached to this migrated save. The browser cannot infer one from prior progression state.";
  const record = receipt
    ? `<dl><div><dt>PLAY PACK</dt><dd>${escapeHtml(receipt.selectedPackId)}</dd></div><div><dt>PLAY PACK SHA-256</dt><dd>${receipt.selectedPackContentSha256}</dd></div><div><dt>SELECTOR PACK</dt><dd>${escapeHtml(receipt.selectorPackId)}</dd></div><div><dt>SELECTOR SHA-256</dt><dd>${receipt.selectorContentSha256}</dd></div><div><dt>RECORDED SELECTOR BITS</dt><dd>${receipt.selectorBits.join("")} → PACK ${receipt.selectedPackIndex + 1} OF 4</dd></div><div><dt>BIT POSITIONS</dt><dd>${receipt.selectorBitIndices.join(" / ")}</dd></div><div><dt>SELECTOR CYCLE</dt><dd>${receipt.selectorCycle}${receipt.reusedSelectorBits ? " · RECORDED BITS REUSED" : " · FIRST PASS"}</dd></div><div><dt>ACTIVE-PLAY NETWORK</dt><dd>none</dd></div></dl>`
    : `<p>This save predates the required QPU selection receipt. Replay is unavailable until Qong is recovered from a validated installed bank.</p>`;
  return `<div class="qb-page-panel qb-scroll qb-formula"><p class="qb-kicker">BAY 01 · RECOVERED</p><h1 tabindex="-1">RULE STATE</h1>${qongSource}<p class="qb-formula-lead">${qongLead}</p>${formulaPath()}${formulaLayer("01", "VISIBLE BEHAVIOR", "Each round begins with one unresolved constitutive rule: score through the opposite goal line, or score through your own. A physical crossing is determinate, but what that crossing counts as remains unresolved until observation. Pressing Space observes early; an unresolved crossing forces measurement and resolves the rule and point together.", true)}${formulaLayer("02", "CLASSICAL DECODER", "The browser decodes each frozen recorded result with a fixed table: 0 or heads becomes OPPOSITE GOAL; 1 or tails becomes OWN GOAL. Paddle physics, opponent behavior, scoring, and replay are entirely classical and local. Active play makes no provider request.")}${formulaLayer("03", "RETURNED RESULT", returnedResult)}${formulaLayer("04", "SUBMITTED INPUT", submittedInput)}${formulaLayer("05", "ENGINE OPERATION", "Coin Toss prepares a qubit in |0⟩, applies Hadamard to produce equal measurement probabilities in the computational basis, then measures. This supplies hardware-derived randomness, not evidence of quantum advantage; a fair coin toss is classically simulable.")}${formulaLayer("06", "SOURCE EVIDENCE", record)}${fictionLayer("qong")}</div>`;
}

function skipixlFormulaMarkup(save: QuantumBoxSave): string {
  const recoveredPass = save.story.skipixlCuts.successfulPasses.at(-1);
  const pack = recoveredPass
    ? (findInstalledSkiPixlPack(
        recoveredPass.packId,
        recoveredPass.contentSha256,
      ) ?? selectStorySkiPixlPack(0))
    : selectStorySkiPixlPack(0);
  const receipt = pack.payload.receipt;
  const segmentEvidence = receipt.segments
    .map(
      (segment) =>
        `<div><dt>SEGMENT ${segment.order + 1}</dt><dd>${escapeHtml(segment.segmentId)} · MOTH ${escapeHtml(segment.mothJobId)} · IBM ${escapeHtml(segment.ibmJobId)}</dd></div><div><dt>RESULT ARTIFACT SHA-256</dt><dd>${segment.resultArtifactSha256}</dd></div><div><dt>SUBMITTED SOURCE SHA-256</dt><dd>${segment.sourceSha256}</dd></div>`,
    )
    .join("");
  const passEvidence = save.story.skipixlCuts.successfulPasses.length
    ? `<div><dt>STORY CUTS</dt><dd>${save.story.skipixlCuts.successfulPasses.map((pass) => `${pass.cutId} · ${escapeHtml(pass.tripletId)} · ${pass.elapsedSeconds.toFixed(2)}S`).join("<br/>")}</dd></div>`
    : "";
  const cutEvidence =
    receipt.schemaVersion === "skipixl-course-receipt-v4" ||
    receipt.schemaVersion === "skipixl-course-receipt-v5" ||
    receipt.schemaVersion === "skipixl-course-receipt-v6" ||
    receipt.schemaVersion === "skipixl-course-receipt-v7"
      ? `<div><dt>RESIDUAL CUT</dt><dd>${receipt.cutId} · ${receipt.obstacleCount} SELECTED CELLS · THRESHOLD ${receipt.selectionThreshold.toFixed(6)}</dd></div><div><dt>SPATIAL RULE</dt><dd>${escapeHtml(receipt.spatialOffsetRule)}</dd></div>${receipt.schemaVersion === "skipixl-course-receipt-v5" || receipt.schemaVersion === "skipixl-course-receipt-v6" || receipt.schemaVersion === "skipixl-course-receipt-v7" ? `<div><dt>GATE RULE</dt><dd>${escapeHtml(receipt.gateRule)}</dd></div>` : ""}${receipt.schemaVersion === "skipixl-course-receipt-v6" || receipt.schemaVersion === "skipixl-course-receipt-v7" ? `<div><dt>COURSE LENGTH</dt><dd>${escapeHtml(receipt.courseLengthRule)}</dd></div>` : ""}`
      : `<div><dt>LEGACY DECODER</dt><dd>${escapeHtml(receipt.decoderVersion)}</dd></div>`;
  const evidence = `<dl><div><dt>COURSE PACK</dt><dd>${escapeHtml(pack.packId)}</dd></div><div><dt>COURSE PAYLOAD SHA-256</dt><dd>${pack.contentSha256}</dd></div><div><dt>SEGMENT BANK SHA-256</dt><dd>${receipt.bankContentSha256}</dd></div>${cutEvidence}${passEvidence}${segmentEvidence}<div><dt>CAPTURE BOUNDARY</dt><dd>COMPLETED PROVIDER UI PAYLOAD CAPTURE · NOT DIRECT HTTP RESPONSE-BODY DOWNLOAD</dd></div><div><dt>ACTIVE-PLAY NETWORK</dt><dd>NONE</dd></div></dl>`;
  return `<div class="qb-page-panel qb-scroll qb-formula"><p class="qb-kicker">BAY 02 · RECOVERED</p><h1 tabindex="-1">RESIDUAL DESCENT</h1>${sourceClass("IBM FEZ QPIXL CAPTURES", "FROZEN BEFORE PLAY")}<p class="qb-formula-lead">Three recorded 20 × 20 QPixl transformations become one sixty-row descent. EASY, MEDIUM, and HARD are player-facing names for three nested local residual cuts through the same returned triplet—not three separate QPU executions.</p>${formulaPath()}${formulaLayer("01", "VISIBLE BEHAVIOR", "Reach the bottom within 60 seconds on Easy or 75 seconds on Medium and Hard. Easy compresses the same sixty QPixl rows into a shorter hill; Medium and Hard retain the full-length hill. Story begins on MEDIUM and proceeds directly to HARD. Both Story stages include QPixl-positioned slalom gates; missed gates add time. A successful Medium pass carries the same triplet into Hard, while failure retries the current stage on the next deterministic triplet. Dense fields may be impossible, so qualification depends on steering and receiving a favorable recorded field.", true)}${formulaLayer("02", "CLASSICAL DECODER", `For the selected triplet, the browser computes returned value minus submitted grayscale value for all 1,200 cells. It selects cells at or above the chosen absolute-residual percentile: P90, P84, or P78. Magnitude selects the hazard; residual sign selects tree or mogul. Neighboring residuals deterministically stagger horizontal and downhill position across the full source-row interval while every obstacle retains its exact source-cell linkage. Easy uses 47 distance units per source row; Medium and Hard use 70. Gate positions are likewise anchored to identified selected cells. This shown course uses threshold ${receipt.selectionThreshold.toFixed(6)} and contains ${receipt.obstacleCount} hazards.`)}${formulaLayer("03", "RETURNED RESULT", "Each installed segment contains 400 values captured from a completed QPixl qpu-mode job on IBM Fez. Three distinct segments are concatenated in a fixed order. Twenty validated triplets provide sixty local cut variants without inventing provider output.")}${formulaLayer("04", "SUBMITTED INPUT", "Each segment began as one explicitly identified 20 × 20 grayscale B3 source: 400 values submitted before the game was built. The runtime preserves the exact source-pixel hash beside the returned-value hash so every residual can be recomputed.")}${formulaLayer("05", "ENGINE OPERATION", "QPixl accepts a numeric value field and returns a field of the same length. These recorded runs used 4,096 shots, qpu mode, IBM Fez, no discretization, and min/average/max dynamic-range handling. SkiPixl does not claim quantum advantage; it demonstrates a literal, inspectable source-to-hardware-return-to-gameplay mapping. QRC remains deferred.")}${formulaLayer("06", "SOURCE EVIDENCE", evidence)}${fictionLayer("skipixl")}</div>`;
}

function quantmanFormulaMarkup(): string {
  const topologyEvidence = quantmanQpuBankArtifact.topologies
    .map((topology) => {
      const captures = topology.captureFixtureIds
        .map((fixtureId) => {
          const fixtureIndex = quantmanQpuBankArtifact.fixtures.findIndex(
            (fixture) => fixture.fixtureId === fixtureId,
          );
          const authority =
            quantmanQpuBankArtifact.fixtureAuthorities[fixtureIndex];
          if (!authority) return "";
          return `${escapeHtml(authority.targetId)} · MOTH ${escapeHtml(authority.mothJobId)} · IBM ${escapeHtml(authority.hardwareJobId)}`;
        })
        .filter(Boolean)
        .join("<br/>");
      return `<div><dt>${escapeHtml(topology.label)} · ${topology.captureFixtureIds.length} HARDWARE ${topology.captureFixtureIds.length === 1 ? "CAPTURE" : "CAPTURES"}</dt><dd>${captures}</dd></div>`;
    })
    .join("");
  const qpuEvidence = `<dl><div><dt>CORPUS</dt><dd>${escapeHtml(quantmanQpuBankArtifact.bankId)}</dd></div><div><dt>BANK SHA-256</dt><dd>${quantmanQpuBankArtifact.contentSha256}</dd></div><div><dt>LEVELS / CAPTURES</dt><dd>${quantmanQpuBankArtifact.topologies.length} DISTINCT AUTHORED MAZES · ${quantmanQpuBankArtifact.fixtures.length} IBM FEZ EXECUTIONS</dd></div><div><dt>FILTER</dt><dd>quantman-demo-playability-v1 · WHOLE MEASURED STATES ONLY</dd></div>${topologyEvidence}<div><dt>ACTIVE-PLAY NETWORK</dt><dd>NONE</dd></div></dl>`;
  return `<div class="qb-page-panel qb-scroll qb-formula"><p class="qb-kicker">BAY 04 · RECOVERED</p><h1 tabindex="-1">CORRELATED MAZE</h1>${sourceClass("MOTH LABYRINTH / IBM FEZ", "FROZEN BEFORE PLAY")}<p class="qb-formula-lead">The installed corpus contains seven distinct authored 10 × 10 maze topologies backed by eight independent 4,096-shot IBM Fez executions. The original topology has two hardware captures; each of Maps 01–06 has one. Arcade advances automatically to the next maze course on each run. Story advances through distinct courses without exposing a selector.</p>${formulaPath()}${formulaLayer("01", "VISIBLE BEHAVIOR", "Clear every collectible while passages respond to the direction Quantman faces. STABILIZE GAZE holds the passage in view while other parity-controlled passages may change. INVERSE GAZE inverts the passage in view. Both Story screens must be cleared before progression.", true)}${formulaLayer("02", "CLASSICAL DECODER", "For a mapped pair of rooms, equal endpoint bits mean the passage is open and unequal bits mean it is a wall. Before play, the local decoder indexes only whole returned states that avoid a dead start, release the ghosts into a viable region, limit severe fragmentation, and collectively support every playable room and passage in both modes. It samples those intact states by their original returned weights. It never repairs, splices, or fabricates a bit or wall.")}${formulaLayer("03", "SUBMITTED INPUT", "Each course is one authored connected 99-edge maze coupling map over 100 rooms. That topology is submitted input, not measured output. Independent executions of the same submitted topology remain separate hardware captures beneath one course.")}${formulaLayer("04", "RETURNED RESULT", "Each installed Moth Labyrinth execution returned a separate distribution of 4,096 measured 100-bit states from IBM Fez. Failed bulk acquisitions are excluded. The admissible-state index is a separate, disclosed local operation over each intact provider return.")}${formulaLayer("05", "BIT TO PASSAGE", "The local mapping reads the two endpoint bits for a candidate passage. 00 and 11 have equal parity and open it; 01 and 10 have unequal parity and close it. Stabilize and Inverse change how the viewed passage constrains the next whole-state selection.")}${formulaLayer("06", "SOURCE EVIDENCE", qpuEvidence)}${fictionLayer("quantman")}</div>`;
}

function sourceClass(source: string, transport: string): string {
  return `<p class="qb-source-class"><strong>INSTALLED SOURCE · ${source}</strong><span>${transport} · ACTIVE PLAY LOCAL</span></p>`;
}

function formulaPath(): string {
  const steps = [
    ["01", "PLAYED", "Start with what the cabinet made you do and notice."],
    [
      "02",
      "MAPPING",
      "Inspect the local rule that turns fixed values into play.",
    ],
    [
      "03",
      "ARTIFACT",
      "Ask what result or control is actually installed here.",
    ],
    [
      "05",
      "ENGINE",
      "Only then inspect what the intended engine is documented to do.",
    ],
    [
      "07",
      "NOTE / FICTION",
      "Read the recovered designer note without confusing its fiction with Moth history.",
    ],
  ] as const;
  return `<nav class="qb-formula-path" aria-label="Formula signal path"><p>SIGNAL PATH · FOLLOW THE OPERATION DOWN</p><div>${steps.map(([layer, label, description], index) => `<button type="button" data-action="formula-step" data-formula-layer="${layer}" data-description="${escapeHtml(description)}" aria-controls="formula-layer-${layer}" aria-pressed="${index === 0}"><span>${layer}</span>${label}</button>`).join("")}</div><output data-formula-path-status aria-live="polite">Start with what the cabinet made you do and notice.</output></nav>`;
}

function fictionLayer(gameId: GameId): string {
  const fragment = DESIGNER_FRAGMENTS[gameId];
  return formulaLayer(
    "07",
    "FICTION",
    `<p class="qb-designer-fragment"><strong>${escapeHtml(fragment.record)}</strong><q>${escapeHtml(fragment.text)}</q></p><p>The vanished designer, recovered formula, and Quantum Box device are fictional. They are not Moth company history.</p>`,
  );
}

function formulaLayer(
  depth: string,
  title: string,
  body: string,
  open = false,
): string {
  return `<details id="formula-layer-${depth}" class="qb-formula-layer" data-formula-layer="${depth}" ${open ? "open" : ""}><summary tabindex="-1"><span>${depth}</span>${title}</summary><div>${body}</div></details>`;
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
  return `<fieldset class="qb-settings qb-keymap"><legend>PLAYER ${playerId}</legend><nav class="qb-keymap-players" aria-label="Player key profiles">${playerTabs}</nav><section aria-label="Player ${playerId} bindings">${bindings}</section><p>ESC / P / M / X are reserved. Each key can belong to only one player control.</p></fieldset>`;
}

function backgroundProgrammeSettings(save: QuantumBoxSave): string {
  return `<fieldset class="qb-settings qb-background-programmes"><legend>BACKGROUND FIELD</legend>${BROWN_BOX_BACKGROUND_PROGRAMMES.map(
    (programme) =>
      `<label><input type="radio" name="background-programme" data-setting="backgroundProgrammeId" value="${programme.programmeId}" ${save.settings.backgroundProgrammeId === programme.programmeId ? "checked" : ""}/><span>${escapeHtml(programme.label)}</span></label>`,
  ).join(
    "",
  )}<p>Recorded endpoints and local derivations retain their source classifications. Selecting a field makes no provider request.</p></fieldset>`;
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
    )}</div><p class="qb-fluxball-lobby-mode">${format.ruleMode.toUpperCase()} RULEFIELD · CPU FILLS OPEN SLOTS</p><div class="qb-actions"><button class="qb-action" type="button" data-action="lobby-cancel">ESC · BACK</button><button class="qb-action" type="button" data-action="lobby-start">X · START</button></div></div>`;
}

function volumeSetting(volume: number): string {
  const percent = Math.round(volume * 100);
  return `<label class="qb-volume"><span>SOUND LEVEL</span><input type="range" min="0" max="1" step="0.05" value="${volume}" data-setting="soundVolume" aria-label="Sound level"/><output>${percent}%</output></label>`;
}

function arcadeInitialsSetting(initials: string): string {
  return `<label class="qb-arcade-initials"><span>ARCADE INITIALS</span><input type="text" maxlength="3" inputmode="text" autocomplete="off" spellcheck="false" value="${escapeHtml(initials)}" data-setting="arcadeInitials" aria-label="Arcade scoreboard initials"/></label>`;
}

function isShellPage(value: string | undefined): value is ShellPage {
  return (
    value === "main" ||
    value === "story" ||
    value === "story-brief" ||
    value === "arcade" ||
    value === "workshop" ||
    value === "formula" ||
    value === "interlude" ||
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

function isStoryWalkDirection(
  value: string | undefined,
): value is StoryV2WalkDirection {
  return (
    value === "up" || value === "down" || value === "left" || value === "right"
  );
}

function storyWalkDirectionForCode(
  code: string,
  bindings: QuantumBoxSettings["keyboardBindings"],
): StoryV2WalkDirection | null {
  for (const playerId of KEYBOARD_PLAYERS) {
    for (const direction of ["up", "down", "left", "right"] as const) {
      if (bindings[playerId][direction] === code) return direction;
    }
  }
  return null;
}

function isGameId(value: string | undefined): value is GameId {
  return value !== undefined && GAME_IDS.includes(value as GameId);
}

function isPlayerId(value: string | undefined): value is PlayerId {
  return value !== undefined && KEYBOARD_PLAYERS.includes(value as PlayerId);
}

function isKeyboardControl(
  value: string | undefined,
): value is KeyboardControl {
  return (
    value !== undefined && KEYBOARD_CONTROLS.includes(value as KeyboardControl)
  );
}

function isStoryStage(value: string | undefined): value is StoryStageId {
  return value !== undefined && STORY_SEQUENCE.includes(value as StoryStageId);
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
  return `${actions.join(" / ")}: CHANGE RULES · ${snapshot.remainingRuleChanges === 1 ? "AVAILABLE" : "USED"}`;
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
