import Phaser from "phaser";

import { QUANTUM_BOX_ASSETS } from "../assets/manifest";
import { SynthAudio, type BackgroundCueId } from "../audio/SynthAudio";
import {
  isArcadeScoreEligible,
  type ArcadeLaunchOptions,
  type ArcadeRunOrigin,
} from "./arcade";
import { persistSkiPixlStoryResult } from "./StoryResultPersistence";
import {
  createReplayBundle,
  serializeReplayBundle,
  type ReplayBundle,
} from "../core/replay";
import { createRunContext, type RunContext } from "../core/run";
import { FrameMonitor } from "../core/FrameMonitor";
import {
  InputResponseMonitor,
  type InputResponseReport,
} from "../core/InputResponseMonitor";
import { DeveloperAudit } from "../debug/DeveloperAudit";
import {
  ScreenScene,
  LOGICAL_SCREEN,
  SCREEN_SCENE_KEY,
} from "../game/ScreenScene";
import {
  isShippedArcadeCabinetId,
  type ArcadeCabinetId,
  type StoryStageId,
} from "../games/registry";
import {
  QongStoryBankUnavailableError,
  loadInstalledQongStoryBank,
  selectQongArcadePack,
  selectQongStoryPack,
  type QongStoryPackBank,
  type QongStoryPackSelection,
} from "../games/qong/qongStoryPackBank";
import { QongRuntime } from "../games/qong/QongRuntime";
import type {
  QongInput,
  QongOpponent,
  QongSnapshot,
} from "../games/qong/types";
import {
  selectArcadeSkiPixlCuts,
  selectStorySkiPixlPack,
  type SkiPixlCommittedPack,
} from "../games/skipixl/SkiPixlCourseAdapter";
import { SkiPixlRuntime } from "../games/skipixl/SkiPixlRuntime";
import type {
  SkiPixlInput,
  SkiPixlPackPayload,
  SkiPixlSnapshot,
} from "../games/skipixl/types";
import { FluxballRuntime } from "../games/fluxball/FluxballRuntime";
import {
  fluxballRulePackFor,
  type FluxballCommittedPack,
} from "../games/fluxball/fluxballControlPacks";
import {
  isCertifiedFluxballStorySeed,
  selectFluxballStorySeed,
} from "../games/fluxball/FluxballStorySeed";
import type {
  FluxballFormat,
  FluxballHumanInput,
  FluxballSnapshot,
} from "../games/fluxball/types";
import type { PlayerId } from "../games/fluxball/standalone/modes";
import {
  QUANTMAN_QPU_RULES_VERSION,
  QuantmanSyntheticMainGameRuntime,
  loadInstalledQuantmanQpuBank,
  resolveQuantmanQpuFixtureForRun,
  selectQuantmanArcadeQpuFixture,
  selectQuantmanQpuFixture,
  selectQuantmanQpuFixtureForTopology,
  selectQuantmanStoryQpuFixture,
  type QuantmanQpuBank,
  type QuantmanSyntheticMechanic,
  type QuantmanSyntheticReplayTape,
  type QuantmanSyntheticRuntimeSnapshot,
} from "../games/quantmanSynthetic";
import type { QuantmanQpuFixtureSelection } from "../games/quantmanSynthetic/labyrinth/types";
import { QuagRuntime } from "../games/quag/QuagRuntime";
import { quagCompletionCue } from "../games/quag/QuagFeedback";
import {
  QUAG_RULES_VERSION,
  type QuagInput,
  type QuagPlayerId,
  type QuagSnapshot,
} from "../games/quag/types";
import {
  findInstalledQuarryQpuPack,
  loadInstalledQuarryQpuBank,
  selectQuarryQpuPack,
  type QuarryQpuBank,
  type QuarryQpuPackSelection,
} from "../games/qgraph/quarryQpuBank";
import { InputController, type InputSignal } from "../input/InputController";
import {
  SAVE_EXPORT_FILENAME,
  SaveRepository,
  type StoryAttemptSource,
} from "../save/SaveRepository";
import { quantmanArcadeOverallBoard } from "../save/ArcadeRecords";
import type { QuantumBoxSettings } from "../save/types";
import {
  QuantumBoxShell,
  type ArcadeScoreboardRequest,
  type ShellPage,
} from "../ui/QuantumBoxShell";
import type { CommittedPack } from "../packs/types";
import type { QongPackPayload } from "../games/qong/types";
import {
  TERMINAL_TRANSCRIPT_PAGE_IDS,
  earliestUnclearedStage,
  storyNode,
  storyTerminalPage,
  type StoryOutcome,
  type StoryTerminalActionId,
  type StoryTerminalView,
} from "../story/terminal";
import type { StoryChapterId } from "../games/registry";

export interface QuantumBoxTestApi {
  readonly enterInternal: () => void;
  readonly navigate: (page: ShellPage) => void;
  readonly getPage: () => ShellPage | "title" | "cabinet";
  readonly getSave: () => ReturnType<SaveRepository["snapshot"]>;
  readonly getInputResponse: () => InputResponseReport;
  readonly captureCabinetFrame: () => Promise<string>;
}

declare global {
  interface Window {
    __QUANTUM_BOX_TEST__?: QuantumBoxTestApi;
  }
}

export class QuantumBoxApp {
  private readonly saveRepository: SaveRepository;
  private readonly shell: QuantumBoxShell;
  private readonly input: InputController;
  private readonly game: Phaser.Game;
  private readonly audio: SynthAudio;
  private readonly frameMonitor = new FrameMonitor();
  private readonly inputResponseMonitor = new InputResponseMonitor();
  private readonly developerAudit: DeveloperAudit | null;
  private monitorFrameId = 0;
  private readonly inputPresentationFrameIds = new Set<number>();
  private qongRuntime: QongRuntime | null = null;
  private readonly qongStoryBankPromise: Promise<QongStoryPackBank>;
  private readonly quarryQpuBankPromise: Promise<QuarryQpuBank>;
  private readonly quantmanQpuBankPromise: Promise<QuantmanQpuBank>;
  private activeQongPack: CommittedPack<QongPackPayload> | null = null;
  private activeQongSelection: QongStoryPackSelection | null = null;
  private skipixlRuntime: SkiPixlRuntime | null = null;
  private fluxballRuntime: FluxballRuntime | null = null;
  private quantmanRuntime: QuantmanSyntheticMainGameRuntime | null = null;
  private quagRuntime: QuagRuntime | null = null;
  private activeRun: RunContext | null = null;
  private activeStoryReplay = false;
  private activeStoryAttemptSource: StoryAttemptSource = "main-story";
  private activeTerminalView: StoryTerminalView | null = null;
  private storyTerminalTransitionInFlight = false;
  private storyPresentationGeneration = 0;
  private terminalTranscript: Readonly<{
    chapterId: StoryChapterId;
    pageIds: readonly string[];
    index: number;
  }> | null = null;
  private activeArcadeRunOrigin: ArcadeRunOrigin | null = null;
  private qongOpponent: QongOpponent | null = null;
  private qongRecording: readonly QongInput[] | null = null;
  private qongIsReplay = false;
  private qongLastStoryQualified: boolean | null = null;
  private activeSkiPixlPack: SkiPixlCommittedPack | null = null;
  private skipixlRecording: readonly SkiPixlInput[] | null = null;
  private skipixlIsReplay = false;
  private pendingStorySkiPixlPack: SkiPixlCommittedPack | null = null;
  private activeFluxballFormat: FluxballFormat | null = null;
  private activeFluxballPack: FluxballCommittedPack | null = null;
  private fluxballRecording: readonly FluxballHumanInput[] | null = null;
  private fluxballIsReplay = false;
  private fluxballLastHumanWon: boolean | null = null;
  private pendingArcadeScoreboard: ArcadeScoreboardRequest | null = null;
  private fluxballLobby: {
    readonly mode: string;
    readonly runSeed: number;
    readonly competitorCount: 2 | 4;
    readonly ruleMode: "global" | "individual";
    readonly humanPlayerIds: Set<PlayerId>;
  } | null = null;
  private activeQuantmanMechanic: QuantmanSyntheticMechanic | null = null;
  private activeQuantmanFixture: QuantmanQpuFixtureSelection | null = null;
  private quantmanRecording: QuantmanSyntheticReplayTape | null = null;
  private quantmanArcadeCourseCursor = 0;
  private quagRecording: readonly QuagInput[] | null = null;
  private quagIsReplay = false;
  private activeQuarryHumanPlayerIds: readonly QuagPlayerId[] = ["A"];
  private activeQuarrySelection: QuarryQpuPackSelection | null = null;
  private completedReplay: ReplayBundle | null = null;
  private unsubscribeInput: (() => void) | null = null;
  private unsubscribeDevices: (() => void) | null = null;
  private stopCanvasPaletteAudit: (() => void) | null = null;

  public constructor(private readonly root: HTMLElement) {
    this.saveRepository = new SaveRepository();
    this.audio = new SynthAudio(this.saveRepository.snapshot().settings);
    this.shell = new QuantumBoxShell(
      root,
      QUANTUM_BOX_ASSETS.display,
      this.saveRepository.snapshot(),
      {
        onStartGesture: () => {
          void this.audio.unlock();
        },
        onInternalEntered: () => {
          this.game.scale.refresh();
          this.audio.requestBackgroundCue("key-is-opaque");
        },
        onTitleReturned: () => this.audio.requestBackgroundCue(null),
        onPageChanged: (page) => {
          if (page !== "story-terminal") {
            this.storyPresentationGeneration += 1;
            this.storyTerminalTransitionInFlight = false;
            this.activeTerminalView = null;
          }
          this.audio.requestBackgroundCue(
            page === "story-terminal" ? "spare-key" : "key-is-opaque",
          );
        },
        onContinueStory: () => this.continueStory(),
        onNewStory: () => this.newStory(),
        onStoryTerminalAction: (action, nodeId) =>
          void this.handleStoryTerminalAction(action, nodeId),
        onOpenTerminalTranscript: (chapterId) =>
          this.openTerminalTranscript(chapterId),
        onRetryTerminalChapter: (chapterId) =>
          void this.retryTerminalChapter(chapterId),
        onLaunchArcade: (gameId, mode, options) =>
          void this.launchArcade(gameId, mode, options),
        onSettingChanged: (change) => this.updateSettings(change),
        onArcadeScoreInitialsSubmitted: (recordedSequence, initials) =>
          this.submitArcadeScoreInitials(recordedSequence, initials),
        onExportSave: () => this.exportSave(),
        onResetSave: () => this.resetSave(),
        onCabinetAction: (action) => this.handleCabinetAction(action),
        onFluxballLobbyAction: (action) =>
          this.handleFluxballLobbyAction(action),
      },
    );
    this.audio.requestBackgroundCue(null);
    this.qongStoryBankPromise = loadInstalledQongStoryBank();
    void this.qongStoryBankPromise.catch(() => undefined);
    this.quarryQpuBankPromise = loadInstalledQuarryQpuBank();
    void this.quarryQpuBankPromise.catch(() => undefined);
    this.quantmanQpuBankPromise = loadInstalledQuantmanQpuBank();
    void this.quantmanQpuBankPromise.catch(() => undefined);
    this.developerAudit =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("debug") === "beliefs"
        ? new DeveloperAudit(root)
        : null;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.shell.getCanvasHost(),
      width: LOGICAL_SCREEN.width * 2,
      height: LOGICAL_SCREEN.height * 2,
      transparent: true,
      scene: [ScreenScene],
      render: { antialias: false, pixelArt: true, roundPixels: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: LOGICAL_SCREEN.width * 2,
        height: LOGICAL_SCREEN.height * 2,
      },
      banner: false,
    });
    this.input = new InputController(
      window,
      document,
      this.saveRepository.snapshot().settings.keyboardBindings,
    );
    this.unsubscribeInput = this.input.subscribe(this.onInput);
    this.unsubscribeDevices = this.input.subscribeDevices((event) => {
      this.shell.announce(
        event.connected
          ? `${event.label} connected.`
          : `${event.label} disconnected. Held controls released.`,
      );
    });
    root.addEventListener("pointerdown", this.onAudioGesture, true);
    root.addEventListener("keydown", this.onAudioGesture, true);
    window.addEventListener("blur", this.onWindowBlur);
    window.addEventListener("focus", this.onAudioRecovery);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.monitorFrameId = requestAnimationFrame(this.monitorFrame);
    if (import.meta.env.DEV) {
      const qaParams = new URLSearchParams(window.location.search);
      const qaRoute = qaParams.get("qa");
      const paletteAuditEnabled =
        qaRoute === "palette-audit" || qaParams.get("palette") === "1";
      window.__QUANTUM_BOX_TEST__ = Object.freeze({
        enterInternal: () => this.shell.enterInternal(),
        navigate: (page: ShellPage) => this.shell.showPage(page),
        getPage: () => this.shell.getPage(),
        getSave: () => this.saveRepository.snapshot(),
        getInputResponse: () => this.inputResponseMonitor.report(),
        captureCabinetFrame: () =>
          new Promise<string>((resolve, reject) => {
            this.game.renderer.snapshot((snapshot) => {
              if (!(snapshot instanceof HTMLImageElement)) {
                reject(new Error("Cabinet snapshot did not return an image."));
                return;
              }
              resolve(snapshot.src);
            });
          }),
      });
      if (qaRoute === "palette-audit") this.shell.enterInternal();
      if (paletteAuditEnabled) {
        void import("../debug/BrownBoxCanvasAudit")
          .then(({ startBrownBoxCanvasAudit }) => {
            this.stopCanvasPaletteAudit?.();
            this.stopCanvasPaletteAudit = startBrownBoxCanvasAudit(
              this.game,
              this.root,
            );
          })
          .catch((error: unknown) => this.reportDevPaletteError(error));
      }
      if (qaRoute === "story-terminal") {
        requestAnimationFrame(() => {
          this.shell.enterInternal();
          this.continueStory();
        });
      }
    }
  }

  public destroy(): void {
    this.storyPresentationGeneration += 1;
    this.qongRuntime?.stop();
    this.skipixlRuntime?.stop();
    this.fluxballRuntime?.stop();
    this.quantmanRuntime?.stop();
    this.quagRuntime?.stop();
    this.unsubscribeInput?.();
    this.unsubscribeInput = null;
    this.unsubscribeDevices?.();
    this.unsubscribeDevices = null;
    this.stopCanvasPaletteAudit?.();
    this.stopCanvasPaletteAudit = null;
    this.input.dispose();
    this.root.removeEventListener("pointerdown", this.onAudioGesture, true);
    this.root.removeEventListener("keydown", this.onAudioGesture, true);
    window.removeEventListener("blur", this.onWindowBlur);
    window.removeEventListener("focus", this.onAudioRecovery);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    cancelAnimationFrame(this.monitorFrameId);
    this.monitorFrameId = 0;
    for (const frameId of this.inputPresentationFrameIds) {
      cancelAnimationFrame(frameId);
    }
    this.inputPresentationFrameIds.clear();
    this.audio.destroy();
    this.developerAudit?.destroy();
    this.game.destroy(true);
    this.shell.destroy();
    if (import.meta.env.DEV) delete window.__QUANTUM_BOX_TEST__;
  }

  private readonly onInput = (signal: InputSignal): void => {
    if (signal.pressed) void this.audio.unlock();
    if (signal.pressed && isTransitionAction(signal.action)) {
      this.input.latchUntilRelease(signal.action);
    }
    if (signal.pressed && signal.action === "mute") {
      this.toggleMute();
      return;
    }
    if (this.fluxballLobby) {
      if (!signal.pressed) return;
      const playerId = playerIdForAction(signal.action);
      if (signal.action === "primary" || signal.action === "start")
        this.shell.activateFocusedControl();
      else if (playerId) this.toggleFluxballLobbyPlayer(playerId);
      else if (signal.action === "secondary") this.startFluxballFromLobby();
      else if (signal.action.endsWith("-up")) this.shell.moveMenuFocus("up");
      else if (signal.action.endsWith("-down"))
        this.shell.moveMenuFocus("down");
      else if (signal.action.endsWith("-left"))
        this.shell.moveMenuFocus("left");
      else if (signal.action.endsWith("-right"))
        this.shell.moveMenuFocus("right");
      else if (signal.action === "back") this.cancelFluxballLobby();
      return;
    }
    if (
      signal.pressed &&
      (signal.action === "pause" || signal.action === "start") &&
      this.hasActiveCabinet()
    ) {
      this.toggleActivePause();
      return;
    }
    if (this.qongRuntime) {
      if (signal.pressed && signal.action === "back") this.exitCabinet();
      else this.qongRuntime.handleInput(legacyCabinetSignal(signal));
      return;
    }
    if (this.skipixlRuntime) {
      if (signal.pressed && signal.action === "back") {
        if (this.pendingArcadeScoreboard) this.continueSkiPixl();
        else this.exitCabinet();
      } else this.skipixlRuntime.handleInput(legacyCabinetSignal(signal));
      return;
    }
    if (this.fluxballRuntime) {
      if (signal.pressed && signal.action === "back") this.exitCabinet();
      else this.fluxballRuntime.handleInput(signal);
      return;
    }
    if (this.quantmanRuntime) {
      if (signal.pressed && signal.action === "back") {
        if (this.pendingArcadeScoreboard) this.continueQuantman();
        else this.exitCabinet();
      } else this.quantmanRuntime.handleInput(legacyCabinetSignal(signal));
      return;
    }
    if (this.quagRuntime) {
      if (signal.pressed && signal.action === "back") this.exitCabinet();
      else this.quagRuntime.handleInput(signal);
      return;
    }
    if (!signal.pressed) return;
    if (
      this.shell.getPage() === "title" &&
      (signal.action === "start" ||
        signal.action === "primary" ||
        signal.action.endsWith("-action"))
    ) {
      this.shell.enterInternal();
    } else if (
      signal.action === "start" ||
      signal.action === "primary" ||
      signal.action.endsWith("-action")
    ) {
      this.shell.activateFocusedControl();
    } else if (
      signal.action === "p1-up" ||
      signal.action === "p1-left" ||
      signal.action === "p2-up" ||
      signal.action === "p2-left" ||
      signal.action === "p3-up" ||
      signal.action === "p3-left" ||
      signal.action === "p4-up" ||
      signal.action === "p4-left"
    ) {
      this.shell.moveMenuFocus(signal.action.endsWith("-left") ? "left" : "up");
    } else if (
      signal.action === "p1-down" ||
      signal.action === "p1-right" ||
      signal.action === "p2-down" ||
      signal.action === "p2-right" ||
      signal.action === "p3-down" ||
      signal.action === "p3-right" ||
      signal.action === "p4-down" ||
      signal.action === "p4-right"
    ) {
      this.shell.moveMenuFocus(
        signal.action.endsWith("-right") ? "right" : "down",
      );
    } else if (signal.action === "back") {
      this.shell.handleBack();
    }
  };

  private readonly monitorFrame = (timestamp: number): void => {
    const report = this.frameMonitor.sample(timestamp);
    if (report) this.shell.updatePerformance(report);
    this.monitorFrameId = requestAnimationFrame(this.monitorFrame);
  };

  private readonly recordPresentedInput = (capturedAtMs: number): void => {
    let frameId = 0;
    frameId = requestAnimationFrame((presentedAtMs) => {
      this.inputPresentationFrameIds.delete(frameId);
      this.shell.updateInputResponse(
        this.inputResponseMonitor.sample(capturedAtMs, presentedAtMs),
      );
    });
    this.inputPresentationFrameIds.add(frameId);
  };

  private async launchArcade(
    gameId: ArcadeCabinetId,
    mode: string,
    options: ArcadeLaunchOptions,
  ): Promise<void> {
    if (gameId === "qong") {
      const opponent: QongOpponent =
        mode === "LOCAL TWO PLAYER" ? "local" : "cpu";
      try {
        const bank = await this.qongStoryBankPromise;
        const selection = selectQongArcadePack(bank, options.runSeed);
        this.startQong("arcade", opponent, options.runSeed, selection);
      } catch (error) {
        this.shell.showStoryUnavailable(
          error instanceof Error
            ? error.message
            : "The installed Qong QPU bank failed local validation.",
        );
      }
      return;
    }
    if (gameId === "skipixl") {
      const cutId = arcadeSkiPixlCutForMode(mode);
      if (!cutId) {
        this.unavailable(`SKIPIXL / ${mode} is not an installed descent.`);
        return;
      }
      const cutSet = selectArcadeSkiPixlCuts(options.runSeed);
      this.startSkiPixl(
        "arcade",
        cutSet.packs[cutId],
        options.runSeed,
        false,
        "skipixl-feasible",
        options.runOrigin,
      );
      return;
    }
    if (gameId === "fluxball") {
      const format = fluxballFormatForArcadeMode(mode, options.localPlayers);
      if (format) {
        this.fluxballLobby = {
          mode,
          runSeed: options.runSeed,
          competitorCount: format.competitorCount,
          ruleMode: format.ruleMode,
          humanPlayerIds: new Set(["A"]),
        };
        this.renderFluxballLobby();
        return;
      }
    }
    if (
      gameId === "quantman" &&
      (mode === "HOLD" ||
        mode === "INVERT" ||
        mode === "STABILIZE GAZE" ||
        mode === "INVERSE GAZE")
    ) {
      try {
        const bank = await this.quantmanQpuBankPromise;
        const fixture = this.selectNextQuantmanArcadeFixture(
          bank,
          options.runSeed,
        );
        this.startQuantman(
          "arcade",
          mode === "HOLD" || mode === "STABILIZE GAZE"
            ? "stabilize-gaze"
            : "inverse-gaze",
          fixture,
          options.runSeed,
          false,
          options.runOrigin,
        );
      } catch (error) {
        this.shell.showStoryUnavailable(
          error instanceof Error
            ? error.message
            : "The installed Quantman QPU bank failed local validation.",
        );
      }
      return;
    }
    if (gameId === "quarry") {
      const humanPlayerIds = quarryHumanPlayersForMode(mode);
      if (!humanPlayerIds) {
        this.unavailable(`QUARRY / ${mode} is not an installed arena format.`);
        return;
      }
      try {
        const bank = await this.quarryQpuBankPromise;
        const selection = selectQuarryQpuPack(bank, options.runSeed);
        this.startQuag("arcade", options.runSeed, humanPlayerIds, selection);
      } catch (error) {
        this.shell.showStoryUnavailable(
          error instanceof Error
            ? error.message
            : "The installed Quarry QPU bank failed local validation.",
        );
      }
      return;
    }
    if (gameId === "quag") {
      this.shell.showPage("arcade");
      this.shell.announce("Legacy Quag links now open Quarry from Arcade.");
      return;
    }
    if (isShippedArcadeCabinetId(gameId)) {
      this.unavailable(
        `${gameId.toUpperCase()} / ${mode} is not an installed Arcade format.`,
      );
      return;
    }
    this.shell.showPage("arcade");
    this.shell.announce("That legacy cabinet is not shipped in this build.");
  }

  private handleFluxballLobbyAction(
    action:
      | Readonly<{ kind: "toggle"; playerId: PlayerId }>
      | Readonly<{ kind: "start" | "cancel" }>,
  ): void {
    if (action.kind === "toggle")
      this.toggleFluxballLobbyPlayer(action.playerId);
    else if (action.kind === "start") this.startFluxballFromLobby();
    else this.cancelFluxballLobby();
  }

  private toggleFluxballLobbyPlayer(playerId: PlayerId): void {
    const lobby = this.fluxballLobby;
    if (!lobby) return;
    const active: readonly PlayerId[] =
      lobby.competitorCount === 2 ? ["A", "B"] : ["A", "B", "C", "D"];
    if (!active.includes(playerId)) return;
    if (lobby.humanPlayerIds.has(playerId))
      lobby.humanPlayerIds.delete(playerId);
    else lobby.humanPlayerIds.add(playerId);
    this.renderFluxballLobby();
  }

  private renderFluxballLobby(): void {
    const lobby = this.fluxballLobby;
    if (!lobby) return;
    const humanPlayerIds = [...lobby.humanPlayerIds].sort();
    this.shell.showFluxballLobby(
      {
        competitorCount: lobby.competitorCount,
        ruleMode: lobby.ruleMode,
        roundSeconds: 40,
        humanPlayerIds,
      },
      humanPlayerIds,
    );
  }

  private startFluxballFromLobby(): void {
    const lobby = this.fluxballLobby;
    if (!lobby) return;
    if (lobby.humanPlayerIds.size === 0) {
      this.shell.announce("At least one human must join Fluxball.");
      return;
    }
    const format: FluxballFormat = {
      competitorCount: lobby.competitorCount,
      ruleMode: lobby.ruleMode,
      roundSeconds: 40,
      humanPlayerIds: [...lobby.humanPlayerIds].sort(),
    };
    const runSeed = lobby.runSeed;
    this.fluxballLobby = null;
    this.startFluxball("arcade", format, runSeed);
  }

  private cancelFluxballLobby(): void {
    if (!this.fluxballLobby) return;
    this.fluxballLobby = null;
    this.shell.closeFluxballLobby();
  }

  private continueStory(): void {
    this.storyPresentationGeneration += 1;
    this.storyTerminalTransitionInFlight = false;
    this.terminalTranscript = null;
    void this.presentCurrentStoryNode();
  }

  private newStory(): void {
    this.storyPresentationGeneration += 1;
    this.storyTerminalTransitionInFlight = false;
    this.shell.updateSave(this.saveRepository.replayStoryFromStart());
    this.terminalTranscript = null;
    void this.presentCurrentStoryNode();
  }

  private async presentCurrentStoryNode(): Promise<void> {
    const node = storyNode(this.saveRepository.snapshot().story.currentNodeId);
    if (
      node.kind === "terminal-page" ||
      node.kind === "loading-transition" ||
      node.kind === "placeholder"
    ) {
      this.presentTerminal({
        nodeId: node.id,
        page: storyTerminalPage(node.pageId),
        transcript: false,
      });
      return;
    }
    if (node.kind === "game-launch") {
      await this.launchStoryStage(node.stageId, "main-story");
      return;
    }
    if (node.kind === "completion") {
      this.activeTerminalView = null;
      this.audio.requestBackgroundCue("key-is-opaque");
      this.shell.showPage("terminal");
      this.shell.announce(
        "Story complete. All cleared program transcripts are available in Terminal.",
      );
      return;
    }
    throw new Error(
      `Story cannot resume from unresolved outcome node ${node.id}.`,
    );
  }

  private presentTerminal(view: StoryTerminalView): void {
    this.activeTerminalView = Object.freeze(view);
    this.shell.showStoryTerminal(this.activeTerminalView);
    this.audio.requestBackgroundCue("spare-key");
  }

  private async handleStoryTerminalAction(
    action: StoryTerminalActionId,
    expectedNodeId: string,
  ): Promise<void> {
    const view = this.activeTerminalView;
    if (
      !view ||
      view.nodeId !== expectedNodeId ||
      this.storyTerminalTransitionInFlight
    ) {
      return;
    }
    if (view.transcript) {
      this.advanceTerminalTranscript();
      return;
    }
    this.storyTerminalTransitionInFlight = true;
    const generation = this.storyPresentationGeneration;
    this.activeTerminalView = null;
    try {
      const save = this.saveRepository.advanceStoryTerminal(action);
      this.shell.updateSave(save);
      await this.presentCurrentStoryNode();
    } finally {
      if (generation === this.storyPresentationGeneration) {
        this.storyTerminalTransitionInFlight = false;
      }
    }
  }

  private openTerminalTranscript(chapterId: StoryChapterId): void {
    const pageIds = TERMINAL_TRANSCRIPT_PAGE_IDS[chapterId];
    this.shell.updateSave(this.saveRepository.markTranscriptSeen(chapterId));
    this.terminalTranscript = Object.freeze({ chapterId, pageIds, index: 0 });
    this.presentTranscriptPage();
  }

  private presentTranscriptPage(): void {
    const transcript = this.terminalTranscript;
    if (!transcript) return;
    const sourcePage = storyTerminalPage(transcript.pageIds[transcript.index]!);
    const last = transcript.index === transcript.pageIds.length - 1;
    this.presentTerminal({
      nodeId: `transcript-${transcript.chapterId}-${transcript.index}`,
      page: Object.freeze({
        ...sourcePage,
        actions: Object.freeze([
          Object.freeze({
            id: "continue" as const,
            label: "CONTINUE" as const,
          }),
        ]),
      }),
      transcript: true,
      transcriptPosition: Object.freeze({
        index: transcript.index,
        count: transcript.pageIds.length,
      }),
    });
    if (last)
      this.shell.announce("Final archived page. Continue returns to Terminal.");
  }

  private advanceTerminalTranscript(): void {
    const transcript = this.terminalTranscript;
    if (!transcript) return;
    if (transcript.index + 1 >= transcript.pageIds.length) {
      this.terminalTranscript = null;
      this.activeTerminalView = null;
      this.audio.requestBackgroundCue("key-is-opaque");
      this.shell.showPage("terminal");
      return;
    }
    this.terminalTranscript = Object.freeze({
      ...transcript,
      index: transcript.index + 1,
    });
    this.presentTranscriptPage();
  }

  private async retryTerminalChapter(chapterId: StoryChapterId): Promise<void> {
    const stage = earliestUnclearedStage(
      chapterId,
      this.saveRepository.snapshot().story.clearedStages,
    );
    if (!stage) return;
    await this.launchStoryStage(stage, "terminal-retry");
  }

  private async launchStoryStage(
    stage: StoryStageId,
    source: StoryAttemptSource,
  ): Promise<void> {
    const generation = this.storyPresentationGeneration;
    if (this.hasActiveCabinet()) return;
    this.activeStoryAttemptSource = source;
    const story = this.saveRepository.snapshot().story;
    try {
      if (stage === "qong") {
        const bank = await this.qongStoryBankPromise;
        if (
          generation !== this.storyPresentationGeneration ||
          this.hasActiveCabinet()
        )
          return;
        const selection = selectQongStoryPack(bank, story.qongSelector);
        this.startQong("story", "cpu", undefined, selection, false);
        return;
      }
      if (stage === "skipixl-feasible" || stage === "skipixl-overloaded") {
        const pack = selectStorySkiPixlPack(
          story.skipixlCuts.tripletCursor,
          stage === "skipixl-feasible" ? "P84" : "P78",
          story.skipixlCuts.tripletId ?? undefined,
        );
        this.startSkiPixl("story", pack, undefined, false, stage);
        return;
      }
      if (stage === "quantman-hold") {
        const bank = await this.quantmanQpuBankPromise;
        if (
          generation !== this.storyPresentationGeneration ||
          this.hasActiveCabinet()
        )
          return;
        const runSeed = resolveRunSeed(undefined);
        this.startQuantman(
          "story",
          "stabilize-gaze",
          selectQuantmanStoryQpuFixture(
            bank,
            story.attempts[stage] ?? 0,
            runSeed,
          ),
          runSeed,
        );
        return;
      }
      if (stage === "fluxball-global" || stage === "fluxball-individual") {
        this.startFluxball("story", {
          competitorCount: 2,
          ruleMode: stage === "fluxball-global" ? "global" : "individual",
          roundSeconds: 40,
          humanPlayerIds: ["A"],
        });
        return;
      }
      const bank = await this.quarryQpuBankPromise;
      if (
        generation !== this.storyPresentationGeneration ||
        this.hasActiveCabinet()
      )
        return;
      const runSeed = resolveRunSeed(undefined);
      this.startQuag(
        "story",
        runSeed,
        ["A"],
        selectQuarryQpuPack(bank, runSeed),
      );
    } catch (error) {
      if (generation !== this.storyPresentationGeneration) return;
      this.shell.showStoryUnavailable(
        error instanceof Error
          ? error.message
          : "The installed hardware bank failed local validation.",
      );
    }
  }

  private startQong(
    playMode: "story" | "arcade",
    opponent: QongOpponent,
    requestedRunSeed?: number,
    selection?: QongStoryPackSelection,
    storyReplay = false,
  ): void {
    if (
      this.qongRuntime ||
      this.skipixlRuntime ||
      this.fluxballRuntime ||
      this.quantmanRuntime ||
      this.quagRuntime
    )
      return;
    if (selection === undefined) {
      throw new Error("Qong cannot start without a verified QPU selection.");
    }
    const pack: CommittedPack<QongPackPayload> = selection.pack;
    const runSeed = resolveRunSeed(requestedRunSeed);
    const context = createRunContext({
      gameId: "qong",
      storyStage: playMode === "story" ? "qong" : null,
      playMode,
      rulesVersion: pack.rulesVersion,
      runSeed,
      pack: {
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.source,
      },
      packSelection: selection.receipt,
    });
    this.activeRun = context;
    this.activeStoryReplay = storyReplay;
    this.completedReplay = null;
    this.qongOpponent = opponent;
    this.activeQongPack = pack;
    this.activeQongSelection = selection;
    this.pendingStorySkiPixlPack = null;
    this.qongRecording = null;
    this.qongIsReplay = false;
    this.qongLastStoryQualified = null;
    if (playMode === "story" && !storyReplay) {
      this.shell.updateSave(
        this.saveRepository.recordStoryAttempt(
          context,
          this.activeStoryAttemptSource,
        ),
      );
    }
    this.shell.beginQong(opponent, playMode);
    this.beginCabinetAudio();
    this.qongRuntime = this.createQongRuntime(context, pack, opponent);
    this.qongRuntime.start();
  }

  private createQongRuntime(
    context: RunContext,
    pack: CommittedPack<QongPackPayload>,
    opponent: QongOpponent,
    replayInputs: readonly QongInput[] | null = null,
  ): QongRuntime {
    return new QongRuntime(
      context,
      pack.payload,
      opponent,
      this.screenScene(),
      this.shell,
      {
        onCompleted: (snapshot, recording) =>
          this.completeQong(snapshot, recording),
        onContinue: () => this.continueQong(),
        onReplay: () =>
          context.playMode === "story"
            ? this.returnFromStoryCabinet()
            : this.retryQong(),
        onFeedbackEvent: (event) =>
          this.audio.play(
            event === "paddle-contact"
              ? "qong-paddle"
              : event === "wall-contact"
                ? "qong-wall"
                : event === "measurement-start"
                  ? "qong-observe"
                  : "qong-goal",
          ),
        onInputApplied: this.recordPresentedInput,
        onAudit: (evidence) =>
          this.developerAudit?.update("QONG CPU", evidence),
      },
      replayInputs,
    );
  }

  private completeQong(
    snapshot: QongSnapshot,
    recording: readonly QongInput[],
  ): void {
    const humanWon = snapshot.winner === "left";
    this.qongLastStoryQualified = humanWon;
    if (!this.qongIsReplay) {
      this.qongRecording = recording;
      this.captureReplay(
        recording,
        snapshot,
        humanWon,
        String(snapshot.winner),
      );
    }
    this.audio.setPaused(false);
    this.audio.play(humanWon ? "qong-match-win" : "qong-match-loss");
    if (this.qongIsReplay) {
      this.shell.announce(
        `Deterministic replay complete · ${this.activeRun?.runId ?? "unknown run"}.`,
      );
      return;
    }
    if (this.activeRun?.playMode === "story") {
      this.recordActiveStoryOutcome(humanWon ? "won" : "lost");
      this.shell.announce(
        humanWon
          ? "Qong won. Continue to the terminal."
          : "Qong lost. Continue to the terminal.",
      );
    } else {
      this.shell.announce("Arcade result recorded locally.");
    }
  }

  private replayQong(): void {
    if (
      !this.qongRuntime?.isComplete() ||
      !this.activeRun ||
      !this.activeQongPack ||
      !this.qongOpponent ||
      !this.qongRecording
    ) {
      return;
    }
    this.qongRuntime.stop();
    this.qongIsReplay = true;
    this.shell.announce(
      `Replaying ${this.activeRun.runId} from its fixed-step input tape.`,
    );
    this.qongRuntime = this.createQongRuntime(
      this.activeRun,
      this.activeQongPack,
      this.qongOpponent,
      this.qongRecording,
    );
    this.qongRuntime.start();
  }

  private retryQong(): void {
    if (!this.activeRun || !this.qongOpponent) return;
    const storyStage = this.activeRun.storyStage;
    const storySource = this.activeStoryAttemptSource;
    const opponent = this.qongOpponent;
    this.exitCabinet(null);
    if (storyStage && isCurrentStoryStage(storyStage)) {
      void this.launchStoryStage(storyStage, storySource);
    } else {
      void this.launchArcade(
        "qong",
        opponent === "local" ? "LOCAL TWO PLAYER" : "PLAYER / CPU",
        {
          runSeed: resolveRunSeed(),
          localPlayers: opponent === "local" ? 2 : 1,
          runOrigin: "player-arcade",
        },
      );
    }
  }

  private continueQong(): void {
    if (
      this.activeRun?.playMode === "story" &&
      this.qongRuntime?.isComplete()
    ) {
      this.returnFromStoryCabinet();
      return;
    }
    this.retryQong();
  }

  private startSkiPixl(
    playMode: "story" | "arcade",
    pack: SkiPixlCommittedPack,
    requestedRunSeed?: number,
    storyReplay = false,
    storyStage: Extract<
      StoryStageId,
      "skipixl-feasible" | "skipixl-overloaded"
    > = "skipixl-feasible",
    arcadeRunOrigin: ArcadeRunOrigin = "player-arcade",
  ): void {
    if (
      this.qongRuntime ||
      this.skipixlRuntime ||
      this.fluxballRuntime ||
      this.quantmanRuntime ||
      this.quagRuntime
    )
      return;
    const runSeed = resolveRunSeed(requestedRunSeed);
    const context = createRunContext({
      gameId: "skipixl",
      storyStage: playMode === "story" ? storyStage : null,
      playMode,
      rulesVersion: pack.rulesVersion,
      runSeed,
      pack: {
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.source,
      },
    });
    this.activeRun = context;
    this.activeStoryReplay = storyReplay;
    this.activeArcadeRunOrigin = playMode === "arcade" ? arcadeRunOrigin : null;
    this.completedReplay = null;
    this.activeSkiPixlPack = pack;
    this.pendingArcadeScoreboard = null;
    this.pendingStorySkiPixlPack = null;
    this.skipixlRecording = null;
    this.skipixlIsReplay = false;
    if (playMode === "story" && !storyReplay) {
      this.shell.updateSave(
        this.saveRepository.recordStoryAttempt(
          context,
          this.activeStoryAttemptSource,
        ),
      );
    }
    this.shell.beginSkiPixl(playMode);
    this.beginCabinetAudio();
    this.skipixlRuntime = this.createSkiPixlRuntime(context, pack);
    this.skipixlRuntime.start();
  }

  private createSkiPixlRuntime(
    context: RunContext,
    pack: SkiPixlCommittedPack,
    replayInputs: readonly SkiPixlInput[] | null = null,
  ): SkiPixlRuntime {
    return new SkiPixlRuntime(
      context,
      pack.payload,
      this.screenScene(),
      this.shell,
      {
        onCompleted: (snapshot, recording) =>
          this.completeSkiPixl(snapshot, recording),
        onContinue: () => this.continueSkiPixl(),
        onReplay: () =>
          context.playMode === "story"
            ? this.returnFromStoryCabinet()
            : this.retrySkiPixl(),
        onFeedback: (event) => {
          if (event.type === "gate") {
            this.audio.play(event.passed ? "ski-gate-clear" : "ski-gate-miss");
            return;
          }
          this.audio.play(
            event.kind === "tree" ? "ski-tree-impact" : "ski-mogul-impact",
          );
        },
        onCarve: (intensity) => this.audio.setSkiCarve(intensity),
        onInputApplied: this.recordPresentedInput,
      },
      replayInputs,
    );
  }

  private completeSkiPixl(
    snapshot: SkiPixlSnapshot,
    recording: readonly SkiPixlInput[],
  ): void {
    if (!this.skipixlIsReplay) {
      this.skipixlRecording = recording;
      this.captureReplay(
        recording,
        snapshot,
        snapshot.storyQualified,
        `${snapshot.elapsedSeconds.toFixed(2)} seconds · ${snapshot.collisions.length} collisions`,
      );
    }
    this.audio.setSkiCarve(0);
    this.audio.setPaused(false);
    this.audio.play(snapshot.storyQualified ? "ski-finish" : "failure");
    if (this.skipixlIsReplay) {
      this.shell.announce(
        `Deterministic SkiPixl replay complete · ${this.activeRun?.runId ?? "unknown run"}.`,
      );
      return;
    }
    let recordedSequence: number | null = null;
    if (
      this.activeRun &&
      isArcadeScoreEligible(
        this.activeRun.playMode,
        this.activeArcadeRunOrigin,
      ) &&
      snapshot.storyQualified &&
      this.activeSkiPixlPack?.payload.difficulty
    ) {
      const recordSequence =
        this.saveRepository.snapshot().arcadeRecords.nextSequence;
      const save = this.saveRepository.recordSkiPixlArcadeScore(
        {
          kind: "skipixl",
          difficulty: this.activeSkiPixlPack.payload.difficulty,
          runId: this.activeRun.runId,
          rulesVersion: this.activeRun.rulesVersion,
          pack: this.activeRun.pack,
          officialTimeMs: Math.max(
            1,
            Math.round(snapshot.elapsedSeconds * 1_000),
          ),
          missedGates: snapshot.gateResults.filter((gate) => !gate.passed)
            .length,
          collisions: snapshot.collisions.length,
        },
        this.saveRepository.snapshot().settings.arcadeInitials,
      );
      this.shell.updateSave(save);
      if (
        save.arcadeRecords.skipixl[
          this.activeSkiPixlPack.payload.difficulty
        ].some((entry) => entry.recordedSequence === recordSequence)
      ) {
        recordedSequence = recordSequence;
      }
    }
    if (this.activeRun?.playMode === "story") {
      if (!this.activeSkiPixlPack) {
        throw new Error("SkiPixl Story completion lost its committed pack.");
      }
      const save = persistSkiPixlStoryResult(
        this.saveRepository,
        this.activeRun,
        this.activeSkiPixlPack,
        snapshot,
      );
      this.shell.updateSave(save);
      if (!this.activeSkiPixlPack) {
        throw new Error("Completed SkiPixl run lost its frozen course pack.");
      }
      this.shell.announce(
        snapshot.storyQualified
          ? `${this.activeRun.storyStage === "skipixl-feasible" ? "FEASIBLE" : "OVERLOADED"} descent cleared. Continue to the terminal.`
          : `${this.activeRun.storyStage === "skipixl-feasible" ? "FEASIBLE" : "OVERLOADED"} descent complete. Continue to the terminal.`,
      );
      this.recordActiveStoryOutcome(
        snapshot.storyQualified ? "finished" : "failed",
      );
    } else {
      if (
        this.activeRun?.playMode === "arcade" &&
        this.activeSkiPixlPack?.payload.difficulty
      ) {
        this.pendingArcadeScoreboard = Object.freeze({
          gameId: "skipixl",
          mode: this.activeSkiPixlPack.payload.difficulty.toUpperCase(),
          highlightRecordSequence: recordedSequence,
          resultLabel: recordedSequence
            ? "NEW TOP FIVE SCORE"
            : this.activeArcadeRunOrigin === "developer-qa"
              ? "TEST RUN · SCORES NOT RECORDED"
              : "RUN COMPLETE · TOP FIVE UNCHANGED",
          initialsEditable: recordedSequence !== null,
        });
      }
      this.shell.announce(
        `Arcade descent completed on ${this.activeSkiPixlPack?.payload.courseLabel ?? "unknown course"} in ${snapshot.elapsedSeconds.toFixed(2)} seconds.`,
      );
    }
  }

  private replaySkiPixl(): void {
    if (
      !this.skipixlRuntime?.isComplete() ||
      !this.activeRun ||
      !this.activeSkiPixlPack ||
      !this.skipixlRecording
    ) {
      return;
    }
    this.skipixlRuntime.stop();
    this.skipixlIsReplay = true;
    this.shell.announce(
      `Replaying ${this.activeRun.runId} from its fixed-step input tape.`,
    );
    this.skipixlRuntime = this.createSkiPixlRuntime(
      this.activeRun,
      this.activeSkiPixlPack,
      this.skipixlRecording,
    );
    this.skipixlRuntime.start();
  }

  private retrySkiPixl(): void {
    if (!this.activeRun || !this.activeSkiPixlPack) return;
    const storyStage = this.activeRun.storyStage;
    const storySource = this.activeStoryAttemptSource;
    const difficulty = this.activeSkiPixlPack.payload.difficulty;
    const arcadeRunOrigin = this.activeArcadeRunOrigin;
    this.exitCabinet(null);
    if (storyStage && isCurrentStoryStage(storyStage)) {
      void this.launchStoryStage(storyStage, storySource);
      return;
    }
    const runSeed = resolveRunSeed();
    const cuts = selectArcadeSkiPixlCuts(runSeed);
    const cutId =
      difficulty === "easy" ? "P90" : difficulty === "medium" ? "P84" : "P78";
    this.startSkiPixl(
      "arcade",
      cuts.packs[cutId],
      runSeed,
      false,
      "skipixl-feasible",
      arcadeRunOrigin ?? "developer-qa",
    );
  }

  private continueSkiPixl(): void {
    if (this.activeRun?.playMode === "story") {
      this.returnFromStoryCabinet();
      return;
    }
    const scoreboard = this.pendingArcadeScoreboard;
    this.exitCabinet();
    if (scoreboard) this.shell.showArcadeScoreboard(scoreboard);
  }

  private startFluxball(
    playMode: "story" | "arcade",
    format: FluxballFormat,
    requestedRunSeed?: number,
    storyReplay = false,
  ): void {
    if (
      this.qongRuntime ||
      this.skipixlRuntime ||
      this.fluxballRuntime ||
      this.quantmanRuntime ||
      this.quagRuntime
    )
      return;
    const pack = fluxballRulePackFor(format.competitorCount);
    const storyStage =
      playMode === "story"
        ? format.ruleMode === "global"
          ? "fluxball-global"
          : "fluxball-individual"
        : null;
    const candidateRunSeed = resolveRunSeed(requestedRunSeed);
    const runSeed =
      playMode === "story"
        ? storyReplay
          ? candidateRunSeed
          : selectFluxballStorySeed(candidateRunSeed, format.competitorCount)
              .selectedRunSeed
        : candidateRunSeed;
    if (
      playMode === "story" &&
      storyReplay &&
      !isCertifiedFluxballStorySeed(runSeed, format.competitorCount)
    ) {
      throw new Error("Saved Fluxball Story seed is no longer certified.");
    }
    const context = createRunContext({
      gameId: "fluxball",
      storyStage,
      playMode,
      rulesVersion: pack.rulesVersion,
      runSeed,
      pack: {
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.source,
      },
    });
    this.activeRun = context;
    this.activeStoryReplay = storyReplay;
    this.completedReplay = null;
    this.activeFluxballFormat = Object.freeze({
      ...format,
      humanPlayerIds: Object.freeze([...format.humanPlayerIds]),
    });
    this.activeFluxballPack = pack;
    this.fluxballRecording = null;
    this.fluxballIsReplay = false;
    this.fluxballLastHumanWon = null;
    if (playMode === "story" && !storyReplay) {
      this.shell.updateSave(
        this.saveRepository.recordStoryAttempt(
          context,
          this.activeStoryAttemptSource,
        ),
      );
    }
    this.shell.beginFluxball(playMode);
    this.beginCabinetAudio();
    this.fluxballRuntime = this.createFluxballRuntime(
      context,
      this.activeFluxballFormat,
    );
    this.fluxballRuntime.start();
  }

  private createFluxballRuntime(
    context: RunContext,
    format: FluxballFormat,
    replayInputs: readonly FluxballHumanInput[] | null = null,
  ): FluxballRuntime {
    return new FluxballRuntime(
      context,
      format,
      this.screenScene(),
      this.shell,
      {
        onCompleted: (snapshot, recording) =>
          this.completeFluxball(snapshot, recording),
        onContinue: () => this.continueFluxball(),
        onReplay: () =>
          context.playMode === "story"
            ? this.returnFromStoryCabinet()
            : this.retryFluxball(),
        onFeedback: (event) => {
          if (event.type === "contact") {
            this.audio.play(
              event.consequence === "possession"
                ? "fluxball-carry"
                : event.consequence === "strike"
                  ? "fluxball-strike"
                  : event.consequence === "steal"
                    ? "fluxball-steal"
                    : "fluxball-dislodge",
            );
          } else if (event.type === "goal") {
            this.audio.play(
              event.outcome === "scored"
                ? "fluxball-goal"
                : "fluxball-no-award",
            );
          } else if (event.type === "rule-shift") {
            this.audio.play("fluxball-rule-shift");
          } else if (event.outcome === "draw") {
            this.audio.play("fluxball-round-draw");
          } else {
            this.audio.play(
              event.winnerId && format.humanPlayerIds.includes(event.winnerId)
                ? "fluxball-round-win"
                : "fluxball-round-loss",
            );
          }
        },
        onInputApplied: this.recordPresentedInput,
        onAudit: (evidence) =>
          this.developerAudit?.update("FLUXBALL CPU", evidence),
      },
      replayInputs,
    );
  }

  private completeFluxball(
    snapshot: FluxballSnapshot,
    recording: readonly FluxballHumanInput[],
  ): void {
    this.fluxballLastHumanWon = snapshot.humanWon;
    if (!this.fluxballIsReplay) {
      this.fluxballRecording = recording;
      this.captureReplay(
        recording,
        snapshot,
        snapshot.humanWon,
        `winner ${snapshot.winnerIds.join("/") || "none"}`,
      );
    }
    this.audio.setPaused(false);
    this.audio.play(
      snapshot.humanWon ? "fluxball-match-win" : "fluxball-match-loss",
    );
    if (this.fluxballIsReplay) {
      this.shell.announce(
        `Deterministic Fluxball replay complete · ${this.activeRun?.runId ?? "unknown run"}.`,
      );
      return;
    }
    if (this.activeRun?.playMode === "story") {
      this.recordActiveStoryOutcome(snapshot.humanWon ? "won" : "lost");
      this.shell.announce(
        snapshot.humanWon
          ? "Fluxball won. Continue to the terminal."
          : "Fluxball lost. Continue to the terminal.",
      );
    } else {
      this.shell.announce("Arcade Fluxball result recorded locally.");
    }
  }

  private replayFluxball(): void {
    if (
      !this.fluxballRuntime?.isComplete() ||
      !this.activeRun ||
      !this.activeFluxballFormat ||
      !this.fluxballRecording
    ) {
      return;
    }
    this.fluxballRuntime.stop();
    this.fluxballIsReplay = true;
    this.shell.announce(
      `Replaying ${this.activeRun.runId} from its fixed-step input tape.`,
    );
    this.fluxballRuntime = this.createFluxballRuntime(
      this.activeRun,
      this.activeFluxballFormat,
      this.fluxballRecording,
    );
    this.fluxballRuntime.start();
  }

  private retryFluxball(): void {
    if (!this.activeRun || !this.activeFluxballFormat) return;
    const storyStage = this.activeRun.storyStage;
    const storySource = this.activeStoryAttemptSource;
    const format = this.activeFluxballFormat;
    this.exitCabinet(null);
    if (storyStage && isCurrentStoryStage(storyStage)) {
      void this.launchStoryStage(storyStage, storySource);
    } else {
      this.startFluxball("arcade", format);
    }
  }

  private continueFluxball(): void {
    if (this.activeRun?.playMode === "story") {
      this.returnFromStoryCabinet();
      return;
    }
    this.exitCabinet();
  }

  private startQuantman(
    playMode: "story" | "arcade",
    mechanic: QuantmanSyntheticMechanic,
    selection: QuantmanQpuFixtureSelection,
    requestedRunSeed?: number,
    storyReplay = false,
    arcadeRunOrigin: ArcadeRunOrigin = "player-arcade",
  ): void {
    if (
      this.qongRuntime ||
      this.skipixlRuntime ||
      this.fluxballRuntime ||
      this.quantmanRuntime ||
      this.quagRuntime
    )
      return;
    const runSeed = resolveRunSeed(requestedRunSeed);
    const { fixture } = selection;
    const context = createRunContext({
      gameId: "quantman",
      storyStage: playMode === "story" ? "quantman-hold" : null,
      playMode,
      rulesVersion: QUANTMAN_QPU_RULES_VERSION,
      runSeed,
      pack: {
        packId: fixture.fixtureId,
        contentSha256: fixture.contentSha256,
        schemaVersion: fixture.schemaVersion,
        source: "moth-api-qpu",
      },
    });
    this.activeRun = context;
    this.activeStoryReplay = storyReplay;
    this.activeArcadeRunOrigin = playMode === "arcade" ? arcadeRunOrigin : null;
    this.completedReplay = null;
    this.activeQuantmanMechanic = mechanic;
    this.pendingArcadeScoreboard = null;
    this.activeQuantmanFixture = selection;
    this.quantmanRecording = null;
    if (playMode === "story" && !storyReplay) {
      this.shell.updateSave(
        this.saveRepository.recordStoryAttempt(
          context,
          this.activeStoryAttemptSource,
        ),
      );
    }
    this.shell.beginQuantman(playMode);
    this.beginCabinetAudio();
    this.quantmanRuntime = this.createQuantmanRuntime(
      context,
      mechanic,
      selection,
    );
    this.quantmanRuntime.start();
  }

  private createQuantmanRuntime(
    context: RunContext,
    mechanic: QuantmanSyntheticMechanic,
    selection: QuantmanQpuFixtureSelection,
  ): QuantmanSyntheticMainGameRuntime {
    const { fixture, authority } = selection;
    return new QuantmanSyntheticMainGameRuntime(
      {
        playMode: context.playMode,
        runSeed: context.runSeed,
        mechanic,
        fixture,
        qpuAuthority: authority,
        rulesVersion: QUANTMAN_QPU_RULES_VERSION,
      },
      {
        present: (snapshot, paused) => {
          this.screenScene().showQuantmanSynthetic(snapshot, paused);
          this.shell.updateQuantmanSyntheticHud(snapshot, paused);
        },
      },
      {
        onCompleted: (snapshot, recording) =>
          this.completeQuantman(snapshot, recording),
        onContinue: () => this.continueQuantman(),
        onExit: () => {
          if (
            this.activeRun?.playMode === "story" &&
            this.quantmanRuntime?.isComplete()
          )
            this.returnFromStoryCabinet();
          else this.exitCabinet();
        },
        onFreshRunRequested: () =>
          context.playMode === "story"
            ? this.returnFromStoryCabinet()
            : this.retryQuantman(),
        onPauseChanged: (paused) => {
          this.audio.setPaused(paused);
          this.audio.play(paused ? "pause" : "resume");
        },
        onFeedback: (event) =>
          this.audio.play(
            event === "collectible"
              ? "success"
              : event === "caught"
                ? "warning"
                : event === "cleared"
                  ? "recover"
                  : "reveal",
          ),
        onInputApplied: this.recordPresentedInput,
      },
    );
  }

  private completeQuantman(
    snapshot: QuantmanSyntheticRuntimeSnapshot,
    recording: QuantmanSyntheticReplayTape,
  ): void {
    this.quantmanRecording = recording;
    const terminal = snapshot.terminal;
    if (!terminal || !this.activeRun) return;
    this.captureReplay(
      recording.inputs,
      snapshot,
      terminal.cleared,
      `${terminal.outcome} · score ${terminal.score}`,
    );
    this.playCompletionCue(terminal.cleared);
    let recordedSequence: number | null = null;
    if (
      isArcadeScoreEligible(
        this.activeRun.playMode,
        this.activeArcadeRunOrigin,
      ) &&
      this.activeQuantmanFixture
    ) {
      const recordSequence =
        this.saveRepository.snapshot().arcadeRecords.nextSequence;
      const save = this.saveRepository.recordQuantmanArcadeScore(
        {
          kind: "quantman",
          mechanic: terminal.mechanic,
          runId: this.activeRun.runId,
          rulesVersion: this.activeRun.rulesVersion,
          pack: this.activeRun.pack,
          topologyId: this.activeQuantmanFixture.topology.topologyId,
          topologyLabel: this.activeQuantmanFixture.topology.label,
          authoredTopologySha256:
            this.activeQuantmanFixture.topology.authoredTopologySha256,
          score: terminal.score,
          outcome: terminal.cleared ? "won" : "lost",
          remainingLives: terminal.remainingLives,
          activeTicks: terminal.activeTicks,
        },
        this.saveRepository.snapshot().settings.arcadeInitials,
      );
      this.shell.updateSave(save);
      if (
        quantmanArcadeOverallBoard(save.arcadeRecords, terminal.mechanic).some(
          (entry) => entry.recordedSequence === recordSequence,
        )
      ) {
        recordedSequence = recordSequence;
      }
      this.pendingArcadeScoreboard = Object.freeze({
        gameId: "quantman",
        mode: terminal.mechanic === "stabilize-gaze" ? "HOLD" : "INVERT",
        highlightRecordSequence: recordedSequence,
        resultLabel: recordedSequence
          ? "NEW TOP FIVE SCORE"
          : "RUN COMPLETE · TOP FIVE UNCHANGED",
        initialsEditable: recordedSequence !== null,
      });
      this.shell.announce(
        `${terminal.cleared ? "Screen cleared" : "Run lost"}. Quantman ${terminal.mechanic} score recorded locally.`,
      );
    } else if (this.activeRun.playMode === "story") {
      this.recordActiveStoryOutcome(terminal.cleared ? "won" : "lost");
      this.shell.announce(
        terminal.cleared
          ? "Quantman cleared. Continue to the terminal."
          : "Quantman lost. Continue to the terminal.",
      );
    }
    if (this.activeRun.playMode === "arcade" && !this.pendingArcadeScoreboard) {
      this.pendingArcadeScoreboard = Object.freeze({
        gameId: "quantman",
        mode: terminal.mechanic === "stabilize-gaze" ? "HOLD" : "INVERT",
        highlightRecordSequence: null,
        resultLabel:
          this.activeArcadeRunOrigin === "developer-qa"
            ? "TEST RUN · SCORES NOT RECORDED"
            : "RUN COMPLETE · TOP FIVE UNCHANGED",
        initialsEditable: false,
      });
    }
  }

  private async retryQuantman(): Promise<void> {
    if (!this.activeRun || !this.activeQuantmanMechanic) return;
    const playMode = this.activeRun.playMode;
    const stage = this.activeRun.storyStage;
    const source = this.activeStoryAttemptSource;
    const mechanic = this.activeQuantmanMechanic;
    const arcadeRunOrigin = this.activeArcadeRunOrigin;
    this.quantmanRuntime?.stop();
    this.quantmanRuntime = null;
    this.activeRun = null;
    this.activeQuantmanMechanic = null;
    this.activeQuantmanFixture = null;
    this.quantmanRecording = null;
    this.shell.exitCabinet();
    this.screenScene().showLibrary();
    if (playMode === "story" && stage && isCurrentStoryStage(stage)) {
      await this.launchStoryStage(stage, source);
      return;
    }
    try {
      const bank = await this.quantmanQpuBankPromise;
      const runSeed = resolveRunSeed();
      const fixture = this.selectNextQuantmanArcadeFixture(bank, runSeed);
      this.startQuantman(
        "arcade",
        mechanic,
        fixture,
        runSeed,
        false,
        arcadeRunOrigin ?? "player-arcade",
      );
    } catch (error) {
      this.shell.showStoryUnavailable(
        error instanceof Error
          ? error.message
          : "The installed Quantman QPU bank failed local validation.",
      );
    }
  }

  private selectNextQuantmanArcadeFixture(
    bank: QuantmanQpuBank,
    runSeed: number,
  ): QuantmanQpuFixtureSelection {
    const courseIndex = this.quantmanArcadeCourseCursor;
    const fixture = selectQuantmanArcadeQpuFixture(bank, courseIndex, runSeed);
    this.quantmanArcadeCourseCursor = courseIndex + 1;
    return fixture;
  }

  private continueQuantman(): void {
    if (this.activeRun?.playMode === "story") {
      this.returnFromStoryCabinet();
      return;
    }
    const scoreboard = this.pendingArcadeScoreboard;
    this.exitCabinet();
    if (scoreboard) this.shell.showArcadeScoreboard(scoreboard);
  }

  private startQuag(
    playMode: "story" | "arcade",
    requestedRunSeed: number,
    humanPlayerIds: readonly QuagPlayerId[],
    selection: QuarryQpuPackSelection,
    storyReplay = false,
  ): void {
    if (this.hasActiveCabinet()) return;
    const pack = selection.pack;
    const context = createRunContext({
      gameId: "quarry",
      storyStage: playMode === "story" ? "quarry" : null,
      playMode,
      rulesVersion: QUAG_RULES_VERSION,
      runSeed: requestedRunSeed,
      pack: {
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.sourceClassification,
      },
    });
    this.activeRun = context;
    this.activeStoryReplay = storyReplay;
    this.activeQuarryHumanPlayerIds = Object.freeze([...humanPlayerIds]);
    this.activeQuarrySelection = selection;
    this.completedReplay = null;
    this.quagRecording = null;
    this.quagIsReplay = false;
    if (playMode === "story" && !storyReplay) {
      this.shell.updateSave(
        this.saveRepository.recordStoryAttempt(
          context,
          this.activeStoryAttemptSource,
        ),
      );
    }
    this.shell.beginQuag(playMode);
    this.beginCabinetAudio();
    this.quagRuntime = this.createQuagRuntime(context);
    this.quagRuntime.start();
  }

  private createQuagRuntime(
    context: RunContext,
    replayInputs: readonly QuagInput[] | null = null,
  ): QuagRuntime {
    if (!this.activeQuarrySelection) {
      throw new Error("Quarry cannot start without a selected QPU record.");
    }
    return new QuagRuntime(
      context,
      this.activeQuarrySelection.pack,
      this.screenScene(),
      this.shell,
      {
        onCompleted: (snapshot, recording) =>
          this.completeQuag(snapshot, recording),
        onExit: () => {
          if (
            this.activeRun?.playMode === "story" &&
            this.quagRuntime?.isComplete()
          )
            this.returnFromStoryCabinet();
          else this.exitCabinet();
        },
        onRestart: () => this.restartQuag(),
        onReplay: () =>
          context.playMode === "story"
            ? this.returnFromStoryCabinet()
            : void this.retryQuarry(),
        onFeedbackEvent: (event) => {
          this.audio.play(
            event.type === "flap"
              ? "quag-flap"
              : event.type === "land"
                ? "quag-land"
                : event.type === "wrap"
                  ? "quag-wrap"
                  : event.type === "capture"
                    ? "quag-capture"
                    : "quag-shift",
          );
        },
        onInputApplied: this.recordPresentedInput,
      },
      replayInputs,
      { humanPlayerIds: this.activeQuarryHumanPlayerIds },
    );
  }

  private completeQuag(
    snapshot: QuagSnapshot,
    recording: readonly QuagInput[],
  ): void {
    if (!this.quagIsReplay) {
      this.quagRecording = recording;
      this.captureReplay(
        recording,
        snapshot,
        snapshot.winnerIds.length === 1 && snapshot.winnerIds[0] === "A",
        `winner ${snapshot.winnerIds.join("/") || "tie"}`,
      );
    }
    this.audio.setPaused(false);
    this.audio.play(quagCompletionCue(snapshot));
    const storyQualified =
      snapshot.winnerIds.length === 1 && snapshot.winnerIds[0] === "A";
    if (this.quagIsReplay) {
      this.shell.announce(
        `Deterministic Quarry replay complete · ${this.activeRun?.runId ?? "unknown run"}.`,
      );
      return;
    }
    if (this.activeRun?.playMode === "story") {
      this.recordActiveStoryOutcome(storyQualified ? "won" : "lost");
      this.shell.announce(
        storyQualified
          ? "Quarry won. Continue to the terminal."
          : "Quarry lost. Continue to the terminal.",
      );
      return;
    }
    this.shell.announce(`Quarry complete · ${quagHumanResult(snapshot)}.`);
  }

  private restartQuag(): void {
    if (
      !this.quagRuntime ||
      !this.activeRun ||
      this.activeRun.gameId !== "quarry"
    )
      return;
    this.quagRuntime.stop();
    this.completedReplay = null;
    this.quagRecording = null;
    this.quagIsReplay = false;
    this.audio.setPaused(false);
    this.audio.play("launch");
    this.shell.announce(
      `Restarted ${this.activeRun.runId} from its fixed seed.`,
    );
    this.quagRuntime = this.createQuagRuntime(this.activeRun);
    this.quagRuntime.start();
  }

  private replayQuag(): void {
    if (
      !this.quagRuntime?.isComplete() ||
      !this.activeRun ||
      !this.quagRecording
    )
      return;
    this.quagRuntime.stop();
    this.quagIsReplay = true;
    this.shell.announce(
      `Replaying ${this.activeRun.runId} from its fixed-step input tape.`,
    );
    this.quagRuntime = this.createQuagRuntime(
      this.activeRun,
      this.quagRecording,
    );
    this.quagRuntime.start();
  }

  private async retryQuarry(): Promise<void> {
    if (!this.activeRun) return;
    const storyStage = this.activeRun.storyStage;
    const storySource = this.activeStoryAttemptSource;
    const humanPlayerIds = this.activeQuarryHumanPlayerIds;
    this.exitCabinet(null);
    if (storyStage && isCurrentStoryStage(storyStage)) {
      void this.launchStoryStage(storyStage, storySource);
    } else {
      try {
        const runSeed = resolveRunSeed(undefined);
        const bank = await this.quarryQpuBankPromise;
        this.startQuag(
          "arcade",
          runSeed,
          humanPlayerIds,
          selectQuarryQpuPack(bank, runSeed),
        );
      } catch (error) {
        this.shell.showStoryUnavailable(
          error instanceof Error
            ? error.message
            : "The installed Quarry QPU bank failed local validation.",
        );
      }
    }
  }

  private requireActiveQuarrySelection(): QuarryQpuPackSelection {
    if (!this.activeQuarrySelection) {
      throw new Error("Quarry has no active QPU record.");
    }
    return this.activeQuarrySelection;
  }

  private reportDevPaletteError(error: unknown): void {
    this.unavailable(
      error instanceof Error
        ? `PALETTE AUDIT LOCKED · ${error.message}`
        : "PALETTE AUDIT LOCKED · audit module failed.",
    );
  }

  private handleCabinetAction(
    action:
      | "observe"
      | "continue"
      | "replay"
      | "restart"
      | "export"
      | "pause"
      | "back",
  ): void {
    if (action === "export") {
      this.exportReplay();
      return;
    }
    if (action === "pause") {
      this.toggleActivePause();
      return;
    }
    if (this.qongRuntime) {
      if (action === "back") {
        if (
          this.qongRuntime.isComplete() &&
          this.activeRun?.playMode === "story"
        )
          this.returnFromStoryCabinet();
        else this.exitCabinet();
      } else if (action === "continue") this.continueQong();
      else if (action === "replay") {
        if (
          this.activeRun?.playMode === "story" &&
          this.qongRuntime.isComplete()
        )
          this.returnFromStoryCabinet();
        else this.retryQong();
      } else if (this.qongRuntime.isComplete()) this.continueQong();
      else this.qongRuntime.requestObserve();
      return;
    }
    if (this.skipixlRuntime) {
      if (action === "back") {
        if (this.pendingArcadeScoreboard) this.continueSkiPixl();
        else this.exitCabinet();
      } else if (action === "continue") this.continueSkiPixl();
      else if (action === "replay") {
        if (this.activeRun?.playMode === "story") this.returnFromStoryCabinet();
        else this.retrySkiPixl();
      }
      return;
    }
    if (this.fluxballRuntime) {
      if (action === "back") {
        if (
          this.fluxballRuntime.isComplete() &&
          this.activeRun?.playMode === "story"
        )
          this.returnFromStoryCabinet();
        else this.exitCabinet();
      } else if (action === "continue") {
        if (this.fluxballRuntime.isComplete()) this.continueFluxball();
        else this.fluxballRuntime.continueRound();
      } else if (action === "replay") {
        if (
          this.activeRun?.playMode === "story" &&
          this.fluxballRuntime.isComplete()
        )
          this.returnFromStoryCabinet();
        else this.retryFluxball();
      }
      return;
    }
    if (this.quantmanRuntime) {
      if (action === "back") {
        if (this.pendingArcadeScoreboard) this.continueQuantman();
        else this.exitCabinet();
      } else if (action === "continue") this.continueQuantman();
      else if (action === "replay") {
        if (
          this.activeRun?.playMode === "story" &&
          this.quantmanRuntime.isComplete()
        )
          this.returnFromStoryCabinet();
        else this.quantmanRuntime.requestRetry();
      }
      return;
    }
    if (this.quagRuntime) {
      if (action === "back" || action === "continue") {
        if (
          this.quagRuntime.isComplete() &&
          this.activeRun?.playMode === "story"
        )
          this.returnFromStoryCabinet();
        else this.exitCabinet();
      } else if (action === "restart") this.quagRuntime.requestRestart();
      else if (action === "replay") {
        if (
          this.activeRun?.playMode === "story" &&
          this.quagRuntime.isComplete()
        )
          this.returnFromStoryCabinet();
        else void this.retryQuarry();
      }
      return;
    }
  }

  private recordActiveStoryOutcome(outcome: StoryOutcome): void {
    const run = this.activeRun;
    if (!run || run.playMode !== "story" || this.activeStoryReplay) return;
    this.shell.updateSave(
      this.saveRepository.recordStoryOutcome(
        run,
        outcome,
        this.activeStoryAttemptSource,
      ),
    );
  }

  private returnFromStoryCabinet(): void {
    if (this.activeRun?.playMode !== "story") return;
    const source = this.activeStoryAttemptSource;
    this.exitCabinet(source === "main-story" ? "spare-key" : "key-is-opaque");
    if (source === "main-story") {
      void this.presentCurrentStoryNode();
      return;
    }
    this.activeTerminalView = null;
    this.audio.requestBackgroundCue("key-is-opaque");
    this.shell.showPage("terminal");
  }

  private exitCabinet(nextCue: BackgroundCueId | null = "key-is-opaque"): void {
    this.qongRuntime?.stop();
    this.skipixlRuntime?.stop();
    this.fluxballRuntime?.stop();
    this.quantmanRuntime?.stop();
    this.quagRuntime?.stop();
    this.qongRuntime = null;
    this.skipixlRuntime = null;
    this.fluxballRuntime = null;
    this.quantmanRuntime = null;
    this.quagRuntime = null;
    this.activeRun = null;
    this.activeStoryReplay = false;
    this.activeStoryAttemptSource = "main-story";
    this.activeArcadeRunOrigin = null;
    this.qongOpponent = null;
    this.activeQongPack = null;
    this.activeQongSelection = null;
    this.qongRecording = null;
    this.qongIsReplay = false;
    this.qongLastStoryQualified = null;
    this.activeSkiPixlPack = null;
    this.pendingStorySkiPixlPack = null;
    this.skipixlRecording = null;
    this.skipixlIsReplay = false;
    this.activeFluxballFormat = null;
    this.activeFluxballPack = null;
    this.fluxballRecording = null;
    this.fluxballIsReplay = false;
    this.fluxballLastHumanWon = null;
    this.activeQuantmanMechanic = null;
    this.activeQuantmanFixture = null;
    this.quantmanRecording = null;
    this.quagRecording = null;
    this.quagIsReplay = false;
    this.activeQuarryHumanPlayerIds = ["A"];
    this.activeQuarrySelection = null;
    this.pendingArcadeScoreboard = null;
    this.audio.setSkiCarve(0);
    this.audio.setPaused(false);
    this.audio.requestBackgroundCue(nextCue);
    this.audio.play("select");
    this.screenScene().showLibrary();
    this.developerAudit?.clear();
    this.shell.exitCabinet();
  }

  private screenScene(): ScreenScene {
    return this.game.scene.getScene(SCREEN_SCENE_KEY) as ScreenScene;
  }

  private async updateSettings(
    change: Partial<QuantumBoxSettings>,
  ): Promise<void> {
    if (change.backgroundProgrammeId !== undefined) {
      try {
        const activated = await this.shell.activateBackgroundProgramme(
          change.backgroundProgrammeId,
        );
        if (!activated) return;
      } catch (error) {
        this.shell.announce(
          error instanceof Error
            ? `Background field unchanged · ${error.message}`
            : "Background field unchanged.",
        );
        return;
      }
    }
    const save = this.saveRepository.updateSettings(change);
    this.input.setKeyboardBindings(save.settings.keyboardBindings);
    this.audio.setSettings(save.settings);
    this.audio.play("select");
    this.shell.updateSave(save);
    this.shell.announce(
      change.backgroundProgrammeId
        ? `Background field set to ${change.backgroundProgrammeId}.`
        : "Signal settings saved locally.",
    );
  }

  private submitArcadeScoreInitials(
    recordedSequence: number,
    initials: string,
  ): void {
    const save = this.saveRepository.updateArcadeScoreInitials(
      recordedSequence,
      initials,
    );
    this.audio.setSettings(save.settings);
    this.audio.play("select");
    this.shell.confirmArcadeScoreInitials(save);
  }

  private resetSave(): void {
    const save = this.saveRepository.reset();
    void this.shell.activateBackgroundProgramme(
      save.settings.backgroundProgrammeId,
    );
    this.input.setKeyboardBindings(save.settings.keyboardBindings);
    this.audio.setSettings(save.settings);
    this.audio.setPaused(false);
    this.audio.requestBackgroundCue("key-is-opaque");
    this.audio.play("select");
    this.activeTerminalView = null;
    this.terminalTranscript = null;
    this.completedReplay = null;
    this.fluxballLobby = null;
    this.pendingStorySkiPixlPack = null;
    this.pendingArcadeScoreboard = null;
    this.shell.resetPlayerState(save);
    this.shell.announce("Local Quantum Box save reset.");
  }

  private toggleMute(): void {
    const muted = !this.saveRepository.snapshot().settings.soundMuted;
    this.updateSettings({ soundMuted: muted });
    this.shell.announce(muted ? "Sound muted." : "Sound restored.");
  }

  private hasActiveCabinet(): boolean {
    return Boolean(
      this.qongRuntime ||
        this.skipixlRuntime ||
        this.fluxballRuntime ||
        this.quantmanRuntime ||
        this.quagRuntime,
    );
  }

  private toggleActivePause(): void {
    const paused =
      this.qongRuntime?.togglePause() ??
      this.skipixlRuntime?.togglePause() ??
      this.fluxballRuntime?.togglePause() ??
      this.quantmanRuntime?.togglePause() ??
      this.quagRuntime?.togglePause() ??
      null;
    if (paused === null) return;
    if (paused) {
      this.audio.play("pause");
      this.audio.setPaused(true);
    } else {
      this.audio.setPaused(false);
      this.audio.play("resume");
    }
  }

  private readonly onWindowBlur = (): void => {
    const paused =
      this.qongRuntime?.pause() ??
      this.skipixlRuntime?.pause() ??
      this.fluxballRuntime?.pause() ??
      this.quantmanRuntime?.pause() ??
      this.quagRuntime?.pause() ??
      false;
    if (!paused) return;
    this.audio.play("pause");
    this.audio.setPaused(true);
    this.shell.announce("Paused after focus left the Quantum Box.");
  };

  private readonly onAudioGesture = (): void => {
    void this.audio.unlock();
  };

  private readonly onAudioRecovery = (): void => {
    this.audio.recoverFromBrowserInterruption();
  };

  private readonly onVisibilityChange = (): void => {
    const visible = document.visibilityState === "visible";
    this.audio.setDocumentVisible(visible);
    if (visible) this.onAudioRecovery();
  };

  private playCompletionCue(success: boolean): void {
    this.audio.setPaused(false);
    this.audio.play(success ? "recover" : "failure");
  }

  private beginCabinetAudio(): void {
    this.audio.setSkiCarve(0);
    this.audio.requestBackgroundCue(null);
    this.audio.setPaused(false);
    this.audio.play("launch");
  }

  private exportSave(): void {
    this.downloadJson(SAVE_EXPORT_FILENAME, this.saveRepository.exportJson());
    this.shell.announce("Save exported.");
  }

  private captureReplay<TInput, TFinalState>(
    recording: readonly TInput[],
    finalState: TFinalState,
    succeeded: boolean,
    outcome: string,
  ): void {
    if (!this.activeRun) return;
    this.completedReplay = createReplayBundle({
      run: this.activeRun,
      completion: { succeeded, outcome },
      inputTape: recording,
      finalState,
    });
  }

  private exportReplay(): void {
    if (!this.completedReplay || !this.activeRun) return;
    this.downloadJson(
      `quantum-box-${this.activeRun.gameId}-${this.activeRun.runId}-replay-v1.json`,
      serializeReplayBundle(this.completedReplay),
    );
    this.shell.announce(
      `Replay artifact exported for ${this.activeRun.runId}.`,
    );
  }

  private downloadJson(filename: string, contents: string): void {
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private unavailable(message: string): void {
    this.shell.announce(message);
  }
}

function quarryHumanPlayersForMode(
  mode: string,
): readonly QuagPlayerId[] | null {
  const count = Number(/^([1-4]) PLAYER$/.exec(mode)?.[1] ?? 0);
  if (count < 1 || count > 4) return null;
  return Object.freeze((["A", "B", "C", "D"] as const).slice(0, count));
}

function quagHumanResult(snapshot: QuagSnapshot): string {
  const humanWinners = snapshot.winnerIds.filter((playerId) =>
    snapshot.humanPlayerIds.includes(playerId),
  );
  const cpuWinners = snapshot.winnerIds.filter(
    (playerId) => !snapshot.humanPlayerIds.includes(playerId),
  );
  if (snapshot.winnerIds.length > 1) {
    if (humanWinners.length > 0 && cpuWinners.length > 0) {
      return `human/CPU draw between ${snapshot.winnerIds.join("/")}`;
    }
    return humanWinners.length > 0
      ? `human draw between ${humanWinners.join("/")}`
      : `CPU draw between ${cpuWinners.join("/")}`;
  }
  return humanWinners.length === 1
    ? `human ${humanWinners[0]} win`
    : `human loss to ${cpuWinners[0] ?? "CPU"}`;
}

function fluxballFormatForArcadeMode(
  mode: string,
  localPlayers: 1 | 2,
): FluxballFormat | null {
  const match = /^(2|4) PLAYER \/ (GLOBAL|INDIVIDUAL)$/.exec(mode);
  if (!match) return null;
  const competitorCount = Number(match[1]) as 2 | 4;
  return Object.freeze({
    competitorCount,
    ruleMode: match[2]?.toLowerCase() as "global" | "individual",
    roundSeconds: 40,
    humanPlayerIds: Object.freeze(
      localPlayers === 2 ? (["A", "B"] as const) : (["A"] as const),
    ),
  });
}

function arcadeSkiPixlCutForMode(mode: string): "P90" | "P84" | "P78" | null {
  switch (mode) {
    case "EASY":
      return "P90";
    case "MEDIUM":
      return "P84";
    case "HARD":
      return "P78";
    default:
      return null;
  }
}

function skiPixlDifficultyForCut(cutId: "P90" | "P84" | "P78"): string {
  switch (cutId) {
    case "P90":
      return "EASY";
    case "P84":
      return "MEDIUM";
    case "P78":
      return "HARD";
  }
}

function resolveRunSeed(requestedRunSeed?: number): number {
  return requestedRunSeed ?? crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

function playerIdForAction(action: InputSignal["action"]): PlayerId | null {
  const match = /^p([1-4])-action$/.exec(action);
  return match
    ? ((["A", "B", "C", "D"] as const)[Number(match[1]) - 1] ?? null)
    : null;
}

function isTransitionAction(action: InputSignal["action"]): boolean {
  return (
    action === "primary" ||
    action === "secondary" ||
    action === "start" ||
    action.endsWith("-action")
  );
}

function legacyCabinetSignal(signal: InputSignal): InputSignal {
  if (signal.action === "p1-action") return { ...signal, action: "primary" };
  if (signal.action === "p2-action") return { ...signal, action: "start" };
  return signal;
}

function isCurrentStoryStage(value: string): value is StoryStageId {
  return [
    "qong",
    "skipixl-feasible",
    "skipixl-overloaded",
    "quantman-hold",
    "fluxball-global",
    "fluxball-individual",
    "quarry",
  ].includes(value);
}
