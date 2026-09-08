import Phaser from "phaser";

import { QUANTUM_BOX_ASSETS } from "../assets/manifest";
import { SynthAudio, type SynthCue } from "../audio/SynthAudio";
import {
  isArcadeScoreEligible,
  type ArcadeLaunchOptions,
  type ArcadeRunOrigin,
} from "./arcade";
import {
  isInstalledQuantmanStoryRun,
  isInstalledQuarryStoryRun,
  isInstalledFluxballStoryRun,
  persistSkiPixlStoryResult,
  resolveInstalledQongStoryRun,
  resolveInstalledSkiPixlStoryRun,
  resolveStoryRetryLaunch,
} from "./StoryResultPersistence";
import { createQuantmanRetryRequest } from "./QuantmanRetry";
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
  type GameId,
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
import { qualifiesQongStory } from "../games/qong/storyQualification";
import {
  createSkiPixlDesignerEvidence,
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
import { createFluxballDesignerEvidence } from "../games/fluxball/FluxballDesignerEvidence";
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
import { SAVE_EXPORT_FILENAME, SaveRepository } from "../save/SaveRepository";
import { quantmanArcadeOverallBoard } from "../save/ArcadeRecords";
import type {
  PendingStoryNarrativeBeat,
  QuantumBoxSettings,
} from "../save/types";
import {
  QuantumBoxShell,
  type ArcadeScoreboardRequest,
  type ShellPage,
} from "../ui/QuantumBoxShell";
import type { CommittedPack } from "../packs/types";
import type { QongPackPayload } from "../games/qong/types";
import { sha256CanonicalJsonSync } from "../tutorials/recovery";
import {
  STORY_V2_VERSION,
  StoryV2PresentationMachine,
  createFluxballPresentationEvidenceDetail,
  createQongPresentationEvidenceDetail,
  createQuantmanPresentationEvidenceDetail,
  createQuarryPresentationEvidenceDetail,
  createSkiPixlPresentationEvidenceDetail,
  createStoryV2PresentationEvidence,
  parseStoryV2ResumeToken,
  isStoryV2StageId,
  storyV2Stage,
  type StoryV2PresentationEvidenceDetail,
  type StoryV2PresentationEvidence,
  type StoryV2PresentationCompletion,
  type StoryV2PresentationBeat,
  QongStoryRuntime,
  qongStoryPhaseForBeat,
} from "../story/v2";

export interface QuantumBoxTestApi {
  readonly enterInternal: () => void;
  readonly navigate: (page: ShellPage) => void;
  readonly getPage: () => ShellPage | "title" | "cabinet";
  readonly getSave: () => ReturnType<SaveRepository["snapshot"]>;
  readonly getInputResponse: () => InputResponseReport;
  readonly captureCabinetFrame: () => Promise<string>;
  readonly showFormulaForQa: (gameId: GameId) => void;
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
  private qongStoryRuntime: QongStoryRuntime | null = null;
  private readonly qongStoryBankPromise: Promise<QongStoryPackBank>;
  private readonly quarryQpuBankPromise: Promise<QuarryQpuBank>;
  private readonly quantmanQpuBankPromise: Promise<QuantmanQpuBank>;
  private activeQongPack: CommittedPack<QongPackPayload> | null = null;
  private activeQongSelection: QongStoryPackSelection | null = null;
  private storyPresentationMachine: StoryV2PresentationMachine | null = null;
  private skipixlRuntime: SkiPixlRuntime | null = null;
  private fluxballRuntime: FluxballRuntime | null = null;
  private quantmanRuntime: QuantmanSyntheticMainGameRuntime | null = null;
  private quagRuntime: QuagRuntime | null = null;
  private activeRun: RunContext | null = null;
  private activeStoryReplay = false;
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
  private pendingFirstLossRetry: Readonly<{
    gameId: "qong" | "fluxball";
    stage: StoryStageId;
  }> | null = null;
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
  private recoveredFormulaAfterCabinet: GameId | null = null;
  private completedReplay: ReplayBundle | null = null;
  private unsubscribeInput: (() => void) | null = null;
  private unsubscribeDevices: (() => void) | null = null;
  private stopCanvasPaletteAudit: (() => void) | null = null;

  public constructor(private readonly root: HTMLElement) {
    this.saveRepository = new SaveRepository();
    this.audio = new SynthAudio(this.saveRepository.snapshot().settings);
    this.shell = new QuantumBoxShell(
      root,
      QUANTUM_BOX_ASSETS.shell,
      QUANTUM_BOX_ASSETS.display,
      this.saveRepository.snapshot(),
      {
        onStartGesture: () => {
          void this.audio.unlock().then((unlocked) => {
            if (unlocked) this.audio.play("boot");
          });
        },
        onInternalEntered: () => {
          this.game.scale.refresh();
          // Preserve the direct title cut while leaving the boot chirp a
          // distinct attack before the approved menu loop starts.
          this.audio.setMenuMusic(true, 0.24);
        },
        onTitleReturned: () => this.audio.setMenuMusic(false),
        onLaunchStory: (stage, replay) => void this.launchStory(stage, replay),
        onLaunchArcade: (gameId, mode, options) =>
          void this.launchArcade(gameId, mode, options),
        onSettingChanged: (change) => this.updateSettings(change),
        onArcadeScoreInitialsSubmitted: (recordedSequence, initials) =>
          this.submitArcadeScoreInitials(recordedSequence, initials),
        onExportSave: () => this.exportSave(),
        onResetSave: () => this.resetSave(),
        onCabinetAction: (action) => this.handleCabinetAction(action),
        onStoryPresentationContinue: () =>
          this.handleStoryPresentationContinue(),
        onStoryPresentationExited: () => {
          this.screenScene().showLibrary();
          this.audio.setMenuMusic(true);
        },
        onFirstLossHelpContinue: (gameId) => this.continueFirstLossHelp(gameId),
        onStoryWalkStep: () => this.audio.play("story-step"),
        onQongStoryAction: (action) => {
          if (action.kind === "step") {
            this.qongStoryRuntime?.nudge(action.direction);
          } else {
            this.qongStoryRuntime?.use();
          }
        },
        onFluxballLobbyAction: (action) =>
          this.handleFluxballLobbyAction(action),
      },
    );
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
      width: LOGICAL_SCREEN.width,
      height: LOGICAL_SCREEN.height,
      transparent: true,
      scene: [ScreenScene],
      render: { antialias: false, pixelArt: true, roundPixels: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: LOGICAL_SCREEN.width,
        height: LOGICAL_SCREEN.height,
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
        showFormulaForQa: (gameId: GameId) =>
          this.shell.showDevelopmentFormula(gameId),
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
      const storyV2StageId = devStoryV2StageIdFromRoute(qaRoute);
      if (storyV2StageId) {
        const openQaStory = () => {
          if (!this.game.scene.isActive(SCREEN_SCENE_KEY)) {
            requestAnimationFrame(openQaStory);
            return;
          }
          this.shell.enterInternal();
          void this.openStoryV2PresentationForQa(
            storyV2StageId,
            parseDevStoryV2BeatIndex(qaParams.get("beat")),
          ).catch((error: unknown) =>
            this.unavailable(
              error instanceof Error
                ? `STORY QA UNAVAILABLE · ${error.message}`
                : "STORY QA UNAVAILABLE",
            ),
          );
        };
        requestAnimationFrame(openQaStory);
      }
    }
  }

  public destroy(): void {
    this.qongRuntime?.stop();
    this.qongStoryRuntime?.stop();
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
      if (playerId) this.toggleFluxballLobbyPlayer(playerId);
      else if (signal.action === "secondary") this.startFluxballFromLobby();
      else if (signal.action === "back") this.cancelFluxballLobby();
      return;
    }
    if (this.qongStoryRuntime) {
      this.qongStoryRuntime.handleInput(signal);
      return;
    }
    if (
      signal.pressed &&
      signal.action === "pause" &&
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
      this.shell.moveMenuFocus(-1);
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
      this.shell.moveMenuFocus(1);
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
        "skipixl",
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
      (mode === "STABILIZE GAZE" || mode === "INVERSE GAZE")
    ) {
      try {
        const bank = await this.quantmanQpuBankPromise;
        const fixture = this.selectNextQuantmanArcadeFixture(
          bank,
          options.runSeed,
        );
        this.startQuantman(
          "arcade",
          mode === "STABILIZE GAZE" ? "stabilize-gaze" : "inverse-gaze",
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
        roundSeconds: 60,
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
      roundSeconds: 60,
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

  private async launchStory(
    stage: StoryStageId,
    replay: boolean,
  ): Promise<void> {
    this.pendingFirstLossRetry = null;
    const story = this.saveRepository.snapshot().story;
    if (
      replay
        ? !story.completedStages.includes(stage)
        : story.currentStage !== stage
    ) {
      this.unavailable("That Story level is not available in this save.");
      return;
    }
    if (!replay && story.pendingNarrativeBeat?.stage === stage) {
      this.resumeStoryPresentation(story.pendingNarrativeBeat);
      return;
    }
    if (stage === "qong") {
      try {
        const bank = await this.qongStoryBankPromise;
        const selector = story.qongSelector;
        const savedRun = replay ? (story.qualifiedRuns.qong ?? null) : null;
        if (replay && !savedRun) {
          throw new Error(
            "The completed Qong level has no exact qualified-run evidence.",
          );
        }
        const selection = replay
          ? resolveInstalledQongStoryRun(bank, savedRun)
          : selectQongStoryPack(bank, selector);
        if (!selection) {
          throw new Error(
            "The completed Qong level no longer matches its installed QPU pack and selector receipt.",
          );
        }
        this.startQong(
          "story",
          "cpu",
          replay ? savedRun?.runSeed : undefined,
          selection,
          replay,
        );
      } catch (error) {
        const detail =
          error instanceof QongStoryBankUnavailableError
            ? error.message
            : error instanceof Error
              ? error.message
              : "The installed Qong QPU bank failed local validation.";
        this.shell.showStoryUnavailable(detail);
      }
      return;
    }
    if (stage === "skipixl-medium" || stage === "skipixl") {
      const cutId = stage === "skipixl-medium" ? "P84" : "P78";
      const savedRun = replay ? (story.qualifiedRuns[stage] ?? null) : null;
      if (replay && !savedRun) {
        this.unavailable(
          "The completed SkiPixl level has no exact qualified-run evidence.",
        );
        return;
      }
      const pack = replay
        ? resolveInstalledSkiPixlStoryRun(savedRun, stage)
        : selectStorySkiPixlPack(
            story.skipixlCuts.tripletCursor,
            cutId,
            story.skipixlCuts.tripletId ?? undefined,
          );
      if (!pack) {
        this.unavailable(
          "The completed SkiPixl level no longer matches its saved QPixl pack.",
        );
        return;
      }
      this.startSkiPixl(
        "story",
        pack,
        replay ? savedRun?.runSeed : undefined,
        replay,
        stage,
      );
      return;
    }
    if (stage === "fluxball-two" || stage === "fluxball-four") {
      const recovery = story.tutorialRecoveries.fluxball;
      const savedRun =
        story.qualifiedRuns[stage] ??
        (recovery?.run.storyStage === stage ? recovery.run : null);
      const format: FluxballFormat = {
        competitorCount: stage === "fluxball-two" ? 2 : 4,
        ruleMode: stage === "fluxball-two" ? "global" : "individual",
        roundSeconds: 60,
        humanPlayerIds: ["A"],
      };
      if (replay && !savedRun) {
        this.unavailable(
          "The completed Fluxball level predates saved qualified-run evidence and cannot be replayed exactly.",
        );
        return;
      }
      if (replay && !isInstalledFluxballStoryRun(savedRun, stage, format)) {
        this.unavailable(
          "The completed Fluxball level no longer matches the installed deterministic rule pack.",
        );
        return;
      }
      this.startFluxball(
        "story",
        format,
        replay ? savedRun?.runSeed : undefined,
        replay,
      );
      return;
    }
    if (stage === "quantman-stabilize" || stage === "quantman") {
      const savedRun = replay ? (story.qualifiedRuns[stage] ?? null) : null;
      if (replay && !savedRun) {
        this.unavailable(
          "The completed Quantman level has no exact qualified-run evidence.",
        );
        return;
      }
      try {
        const bank = await this.quantmanQpuBankPromise;
        const runSeed = replay ? savedRun!.runSeed : resolveRunSeed(undefined);
        const selection = replay
          ? resolveQuantmanQpuFixtureForRun(bank, runSeed, {
              fixtureId: savedRun!.pack.packId,
              contentSha256: savedRun!.pack.contentSha256,
            })
          : selectQuantmanStoryQpuFixture(
              bank,
              stage === "quantman-stabilize" ? 0 : 1,
              runSeed,
            );
        if (
          replay &&
          !isInstalledQuantmanStoryRun(savedRun, stage, selection.fixture)
        ) {
          this.unavailable(
            "The completed Quantman level no longer matches the installed QPU record.",
          );
          return;
        }
        this.startQuantman(
          "story",
          stage === "quantman-stabilize" ? "stabilize-gaze" : "inverse-gaze",
          selection,
          runSeed,
          replay,
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
    if (stage === "quarry") {
      const savedRun = replay ? (story.qualifiedRuns.quarry ?? null) : null;
      if (replay && !savedRun) {
        this.unavailable(
          "The completed Quarry level has no exact qualified-run evidence.",
        );
        return;
      }
      try {
        const bank = await this.quarryQpuBankPromise;
        const runSeed = replay ? savedRun!.runSeed : resolveRunSeed(undefined);
        const selection = replay
          ? findInstalledQuarryQpuPack(
              bank,
              savedRun!.pack.packId,
              savedRun!.pack.contentSha256,
            )
          : selectQuarryQpuPack(bank, runSeed);
        if (
          !selection ||
          (replay && !isInstalledQuarryStoryRun(savedRun, selection.pack))
        ) {
          this.unavailable(
            "The completed Quarry level no longer matches the installed QPU record.",
          );
          return;
        }
        this.startQuag("story", runSeed, ["A"], selection, replay);
      } catch (error) {
        this.shell.showStoryUnavailable(
          error instanceof Error
            ? error.message
            : "The installed Quarry QPU bank failed local validation.",
        );
      }
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
      this.shell.updateSave(this.saveRepository.recordStoryAttempt(context));
    }
    this.shell.beginQong(opponent);
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
        onContinue: () => this.retryQong(),
        onReplay: () => this.retryQong(),
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
    const storyQualified = qualifiesQongStory(snapshot, recording);
    this.qongLastStoryQualified = storyQualified;
    if (!this.qongIsReplay) {
      this.qongRecording = recording;
      this.captureReplay(
        recording,
        snapshot,
        this.activeRun?.playMode === "story" ? storyQualified : humanWon,
        String(snapshot.winner),
      );
    }
    this.audio.setPaused(false);
    this.audio.play(
      (this.activeRun?.playMode === "story" ? storyQualified : humanWon)
        ? "qong-match-win"
        : "qong-match-loss",
    );
    if (this.qongIsReplay) {
      this.shell.announce(
        `Deterministic replay complete · ${this.activeRun?.runId ?? "unknown run"}.`,
      );
      return;
    }
    if (this.finishStoryReplay("qong", storyQualified)) return;
    if (this.activeRun?.playMode === "story" && storyQualified) {
      if (!this.activeQongSelection) {
        throw new Error(
          "Qualified Qong Story victory lost its frozen QPU selection.",
        );
      }
      this.queueStoryPresentation(
        this.activeRun,
        snapshot.tick,
        createQongPresentationEvidenceDetail(
          this.activeQongSelection,
          snapshot,
        ),
        snapshot,
      );
      this.shell.announce(
        "Qong accepted. Continue into the Designer sequence.",
      );
    } else if (this.activeRun?.playMode === "story") {
      this.shell.announce(
        humanWon
          ? "Qong match won, but the paddle was not operated in enough rounds to recover a formula."
          : "Qong recovery failed. The Story stage remains available.",
      );
    } else {
      this.shell.announce(
        "Arcade result recorded locally with no Story authority.",
      );
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
    if (
      this.qongLastStoryQualified === false &&
      this.maybeShowFirstLossHelp("qong")
    ) {
      return;
    }
    const storyRetry = resolveStoryRetryLaunch(
      this.activeRun,
      this.activeStoryReplay,
    );
    const opponent = this.qongOpponent;
    this.exitCabinet();
    if (storyRetry) {
      void this.launchStory(storyRetry.stage, storyRetry.replay);
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

  private startSkiPixl(
    playMode: "story" | "arcade",
    pack: SkiPixlCommittedPack,
    requestedRunSeed?: number,
    storyReplay = false,
    storyStage: Extract<StoryStageId, "skipixl-medium" | "skipixl"> = "skipixl",
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
      this.shell.updateSave(this.saveRepository.recordStoryAttempt(context));
    }
    this.shell.beginSkiPixl();
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
        onReplay: () => this.retrySkiPixl(),
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
    if (this.finishStoryReplay("skipixl", snapshot.storyQualified)) return;
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
          ? `${this.activeRun.storyStage === "skipixl-medium" ? "MEDIUM" : "HARD"} descent cleared. Story transition ready.`
          : `${this.activeRun.storyStage === "skipixl-medium" ? "MEDIUM" : "HARD"} descent completed outside the qualification limit. The recorded return and outcome remain authoritative; Story continues.`,
      );
      this.queueStoryPresentation(
        this.activeRun,
        snapshot.tick,
        createSkiPixlPresentationEvidenceDetail(
          this.activeSkiPixlPack,
          snapshot,
        ),
        undefined,
        {
          snapshot,
          payload: this.activeSkiPixlPack.payload,
        },
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
        `Arcade descent completed on ${this.activeSkiPixlPack?.payload.courseLabel ?? "unknown course"} in ${snapshot.elapsedSeconds.toFixed(2)} seconds with no Story authority.`,
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
    const storyRetry = resolveStoryRetryLaunch(
      this.activeRun,
      this.activeStoryReplay,
    );
    const difficulty = this.activeSkiPixlPack.payload.difficulty;
    const arcadeRunOrigin = this.activeArcadeRunOrigin;
    this.exitCabinet();
    if (storyRetry) {
      void this.launchStory(storyRetry.stage, storyRetry.replay);
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
      "skipixl",
      arcadeRunOrigin ?? "developer-qa",
    );
  }

  private continueSkiPixl(): void {
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
        ? format.competitorCount === 2
          ? "fluxball-two"
          : "fluxball-four"
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
      this.shell.updateSave(this.saveRepository.recordStoryAttempt(context));
    }
    this.shell.beginFluxball();
    if (playMode === "story") {
      this.shell.announce(
        "Playable rule bank fixed before RUN_STARTED. Each round prefers recorded QPU evidence, then falls back with its actual source labelled. No network occurs during play.",
      );
    }
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
        onReplay: () => this.retryFluxball(),
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
    if (this.finishStoryReplay("fluxball", snapshot.humanWon)) return;
    if (this.activeRun?.playMode === "story" && snapshot.humanWon) {
      if (!this.activeFluxballPack) {
        throw new Error("Qualified Fluxball run lost its frozen rule pack.");
      }
      this.queueStoryPresentation(
        this.activeRun,
        snapshot.sport?.tick ?? 0,
        createFluxballPresentationEvidenceDetail(
          this.activeFluxballPack,
          snapshot,
        ),
      );
      this.shell.announce(
        "Fluxball accepted. Continue into the Designer sequence.",
      );
    } else if (this.activeRun?.playMode === "story") {
      this.shell.announce(
        "Fluxball recovery failed. Player A must win more rounds than every CPU.",
      );
    } else {
      this.shell.announce(
        "Arcade Fluxball result recorded locally with no Story authority.",
      );
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
    if (
      this.fluxballLastHumanWon === false &&
      this.maybeShowFirstLossHelp("fluxball")
    ) {
      return;
    }
    const storyRetry = resolveStoryRetryLaunch(
      this.activeRun,
      this.activeStoryReplay,
    );
    const format = this.activeFluxballFormat;
    this.exitCabinet();
    if (storyRetry) {
      void this.launchStory(storyRetry.stage, storyRetry.replay);
    } else {
      this.startFluxball("arcade", format);
    }
  }

  private continueFluxball(): void {
    if (
      this.fluxballLastHumanWon === false &&
      this.activeRun?.playMode === "story"
    ) {
      this.retryFluxball();
      return;
    }
    this.exitCabinet();
  }

  private maybeShowFirstLossHelp(gameId: "qong" | "fluxball"): boolean {
    const run = this.activeRun;
    if (
      run?.playMode !== "story" ||
      run.storyStage === null ||
      this.activeStoryReplay ||
      this.saveRepository.snapshot().story.firstLossExplanations[gameId]
    ) {
      return false;
    }
    this.pendingFirstLossRetry = Object.freeze({
      gameId,
      stage: run.storyStage,
    });
    this.shell.updateSave(
      this.saveRepository.markFirstLossExplanationSeen(gameId),
    );
    this.exitCabinet();
    this.audio.setMenuMusic(false);
    this.shell.showFirstLossHelp(gameId);
    return true;
  }

  private continueFirstLossHelp(gameId: "qong" | "fluxball"): void {
    const retry = this.pendingFirstLossRetry;
    if (!retry || retry.gameId !== gameId) {
      this.shell.showPage("story");
      this.audio.setMenuMusic(true);
      return;
    }
    this.pendingFirstLossRetry = null;
    this.shell.showPage("story");
    void this.launchStory(retry.stage, false);
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
      storyStage:
        playMode === "story"
          ? mechanic === "stabilize-gaze"
            ? "quantman-stabilize"
            : "quantman"
          : null,
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
      this.shell.updateSave(this.saveRepository.recordStoryAttempt(context));
    }
    this.shell.beginQuantman();
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
        onExit: () => this.exitCabinet(),
        onFreshRunRequested: () => this.retryQuantman(),
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
        mode:
          terminal.mechanic === "stabilize-gaze"
            ? "STABILIZE GAZE"
            : "INVERSE GAZE",
        highlightRecordSequence: recordedSequence,
        resultLabel: recordedSequence
          ? "NEW TOP FIVE SCORE"
          : "RUN COMPLETE · TOP FIVE UNCHANGED",
        initialsEditable: recordedSequence !== null,
      });
      this.shell.announce(
        `${terminal.cleared ? "Screen cleared" : "Run lost"}. Quantman ${terminal.mechanic} score recorded locally.`,
      );
    } else if (terminal.cleared && this.activeRun.playMode === "story") {
      const selection = this.activeQuantmanFixture;
      if (!selection) {
        throw new Error("Quantman completed without its frozen QPU fixture.");
      }
      this.queueStoryPresentation(
        this.activeRun,
        snapshot.simulation.activeTick,
        createQuantmanPresentationEvidenceDetail(selection, snapshot),
      );
    } else if (this.activeRun?.playMode === "story") {
      this.shell.announce(
        "Quantman Story requires complete screen clearance. Retry starts a fresh run from the installed QPU bank.",
      );
    }
    if (this.activeRun.playMode === "arcade" && !this.pendingArcadeScoreboard) {
      this.pendingArcadeScoreboard = Object.freeze({
        gameId: "quantman",
        mode:
          terminal.mechanic === "stabilize-gaze"
            ? "STABILIZE GAZE"
            : "INVERSE GAZE",
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
    const frozenStoryFixture = this.activeQuantmanFixture;
    const retry = createQuantmanRetryRequest(
      this.activeRun,
      this.activeQuantmanMechanic,
      this.activeStoryReplay,
      this.activeArcadeRunOrigin,
      resolveRunSeed(),
    );
    this.quantmanRuntime?.stop();
    this.quantmanRuntime = null;
    this.activeRun = null;
    this.activeQuantmanMechanic = null;
    this.activeQuantmanFixture = null;
    this.quantmanRecording = null;
    this.shell.exitCabinet();
    this.screenScene().showLibrary();
    try {
      const bank = await this.quantmanQpuBankPromise;
      const fixture =
        retry.playMode === "story"
          ? frozenStoryFixture
          : this.selectNextQuantmanArcadeFixture(bank, retry.runSeed);
      if (!fixture) {
        throw new Error("Quantman Story retry lost its frozen QPU fixture.");
      }
      this.startQuantman(
        retry.playMode,
        retry.mechanic,
        fixture,
        retry.runSeed,
        retry.storyReplay,
        retry.arcadeRunOrigin,
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
      this.shell.updateSave(this.saveRepository.recordStoryAttempt(context));
    }
    this.shell.beginQuag();
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
        onExit: () => this.exitCabinet(),
        onRestart: () => this.restartQuag(),
        onReplay: () => void this.retryQuarry(),
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
    if (this.finishStoryReplay("quarry", storyQualified)) return;
    if (this.activeRun?.playMode === "story") {
      if (storyQualified) {
        this.queueStoryPresentation(
          this.activeRun,
          snapshot.activeTick,
          createQuarryPresentationEvidenceDetail(
            this.requireActiveQuarrySelection(),
            snapshot,
            this.activeRun.runSeed,
          ),
        );
        this.shell.announce(
          "Quarry accepted. Continue into the final Workshop.",
        );
      } else {
        this.shell.announce(
          "Quarry Story requires Player A to win the three-round match outright.",
        );
      }
      return;
    }
    this.shell.announce(
      `Quarry complete · ${quagHumanResult(snapshot)} · recorded QPU relation bank; no Story authority.`,
    );
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
    const storyRetry = resolveStoryRetryLaunch(
      this.activeRun,
      this.activeStoryReplay,
    );
    const humanPlayerIds = this.activeQuarryHumanPlayerIds;
    this.exitCabinet();
    if (storyRetry) {
      void this.launchStory(storyRetry.stage, storyRetry.replay);
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

  private async openStoryV2PresentationForQa(
    stageId: StoryStageId,
    requestedBeatIndex: number,
  ): Promise<void> {
    if (!import.meta.env.DEV) return;
    let evidence: StoryV2PresentationEvidence | null = null;
    if (stageId === "qong") {
      const bank = await this.qongStoryBankPromise;
      const selection = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
      const run = createRunContext({
        gameId: "qong",
        storyStage: "qong",
        playMode: "story",
        rulesVersion: selection.pack.rulesVersion,
        runSeed: 101,
        pack: {
          packId: selection.pack.packId,
          contentSha256: selection.pack.contentSha256,
          schemaVersion: selection.pack.schemaVersion,
          source: selection.pack.source,
        },
        packSelection: selection.receipt,
      });
      const court = qaQongCompletedSnapshot();
      evidence = createStoryV2PresentationEvidence(
        {
          stageId: "qong",
          run,
          activeTick: court.tick,
          evidenceSha256: "0".repeat(64),
        },
        createQongPresentationEvidenceDetail(selection, court),
      );
    }
    const machine = new StoryV2PresentationMachine(stageId, null, evidence);
    const opening = machine.snapshot();
    const beatIndex = Math.min(
      Math.max(0, requestedBeatIndex),
      opening.beatCount - 1,
    );
    for (let index = 0; index < beatIndex; index += 1) {
      machine.dispatch("continue");
    }
    this.storyPresentationMachine = machine;
    const snapshot = machine.snapshot();
    if (
      stageId === "qong" &&
      snapshot.beat &&
      qongStoryPhaseForBeat(snapshot.beat.id) !== "terminal"
    ) {
      this.startQongStorySequence(
        qaQongCompletedSnapshot(),
        snapshot.beat.id,
        false,
      );
    } else {
      this.shell.showStoryPresentation(snapshot);
    }
    this.audio.setMenuMusic(false);
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
    if (this.qongStoryRuntime) {
      if (action === "back") this.exitCabinet();
      return;
    }
    if (this.qongRuntime) {
      if (action === "back") this.exitCabinet();
      else if (action === "continue") this.retryQong();
      else if (action === "replay") this.qongRuntime.requestReplay();
      else if (this.qongRuntime.isComplete()) this.retryQong();
      else this.qongRuntime.requestObserve();
      return;
    }
    if (this.skipixlRuntime) {
      if (action === "back") {
        if (this.pendingArcadeScoreboard) this.continueSkiPixl();
        else this.exitCabinet();
      } else if (action === "continue") this.continueSkiPixl();
      else if (action === "replay") this.skipixlRuntime.requestReplay();
      return;
    }
    if (this.fluxballRuntime) {
      if (action === "back") this.exitCabinet();
      else if (action === "continue") this.fluxballRuntime.continueRound();
      else if (action === "replay") this.fluxballRuntime.requestReplay();
      return;
    }
    if (this.quantmanRuntime) {
      if (action === "back") {
        if (this.pendingArcadeScoreboard) this.continueQuantman();
        else this.exitCabinet();
      } else if (action === "continue") this.continueQuantman();
      else if (action === "replay") this.quantmanRuntime.requestRetry();
      return;
    }
    if (this.quagRuntime) {
      if (action === "back" || action === "continue") this.exitCabinet();
      else if (action === "restart") this.quagRuntime.requestRestart();
      else if (action === "replay") this.quagRuntime.requestReplay();
      return;
    }
  }

  private completeStoryAndQueueFormula(context: RunContext): void {
    const before = this.saveRepository.snapshot().story.recoveredFormulae;
    const after = this.saveRepository.completeStoryRun(context, null);
    this.recoveredFormulaAfterCabinet =
      after.story.recoveredFormulae.find(
        (gameId) => !before.includes(gameId),
      ) ?? null;
    this.shell.updateSave(after);
  }

  private queueStoryPresentation(
    context: RunContext,
    activeTick: number,
    detail: StoryV2PresentationEvidenceDetail,
    qongCourt?: QongSnapshot,
    skiSlope?: Readonly<{
      snapshot: SkiPixlSnapshot;
      payload: SkiPixlPackPayload;
    }>,
  ): void {
    const stage = context.storyStage;
    if (context.playMode !== "story" || stage === null) {
      throw new Error(
        "Only a qualified Story run can open a Story transition.",
      );
    }
    const evidenceSha256 = sha256CanonicalJsonSync(
      this.completedReplay ?? {
        run: context,
        completion: { succeeded: true, outcome: "qualified" },
      },
    );
    const presentationEvidence = createStoryV2PresentationEvidence(
      {
        stageId: stage,
        run: context,
        activeTick,
        evidenceSha256,
      },
      detail,
    );
    const machine = new StoryV2PresentationMachine(
      stage,
      null,
      presentationEvidence,
    );
    const snapshot = machine.snapshot();
    const beat = snapshot.beat;
    if (!beat) throw new Error(`Story stage ${stage} has no opening beat.`);
    const save = this.saveRepository.recordPendingNarrativeBeat(context, {
      beatId: beat.id,
      kind: storyNarrativeBeatKind(stage),
      activeTick,
      evidenceSha256,
      presentationEvidence,
    });
    this.shell.updateSave(save);
    this.storyPresentationMachine = machine;
    if (stage === "qong" && qongCourt) {
      this.startQongStorySequence(qongCourt, beat.id, true);
      return;
    }
    this.exitCabinet();
    if (skiSlope) {
      this.screenScene().showSkiPixlStorySlope(
        skiSlope.snapshot,
        skiSlope.payload,
      );
    }
    this.shell.showStoryPresentation(snapshot);
    this.audio.play(storyPresentationCue(beat));
  }

  private startQongStorySequence(
    court: QongSnapshot,
    resumeBeatId: string | null,
    persistProgress: boolean,
  ): void {
    this.qongRuntime?.stop();
    this.qongRuntime = null;
    this.qongStoryRuntime?.stop();
    this.audio.setMenuMusic(false);
    this.audio.setPaused(false);
    this.qongStoryRuntime = new QongStoryRuntime(
      court,
      this.qongOpponent ?? "cpu",
      resumeBeatId,
      this.saveRepository.snapshot().settings.reducedMotion,
      this.screenScene(),
      this.shell,
      {
        onPhaseChanged: (_phase, beatId) =>
          this.advanceQongPresentationTo(beatId, persistProgress),
        onTerminal: () => this.openQongStoryTerminal(persistProgress),
        onBack: () => this.exitCabinet(),
        onCue: (cue) => this.audio.play(cue),
      },
    );
    this.qongStoryRuntime.start();
  }

  private advanceQongPresentationTo(
    beatId: string,
    persistProgress: boolean,
  ): void {
    const machine = this.storyPresentationMachine;
    if (!machine) {
      throw new Error("Qong Story sequence lost its presentation machine.");
    }
    let snapshot = machine.snapshot();
    while (snapshot.beat?.id !== beatId) {
      const result = machine.dispatch("continue");
      if (result.completion || result.snapshot.beat === null) {
        throw new Error(`Qong Story cannot advance to ${beatId}.`);
      }
      snapshot = result.snapshot;
    }
    if (!persistProgress) return;
    const pending = this.saveRepository.snapshot().story.pendingNarrativeBeat;
    if (pending?.beatId === beatId) return;
    this.shell.updateSave(
      this.saveRepository.updatePendingNarrativeBeat(beatId),
    );
  }

  private openQongStoryTerminal(persistProgress: boolean): void {
    this.advanceQongPresentationTo("qong-terminal-qong-input", persistProgress);
    const snapshot = this.storyPresentationMachine?.snapshot();
    if (!snapshot?.beat) {
      throw new Error("Qong terminal has no active presentation beat.");
    }
    this.qongStoryRuntime?.stop();
    this.qongStoryRuntime = null;
    this.exitCabinet();
    this.shell.showStoryPresentation(snapshot);
    this.audio.setMenuMusic(false);
    this.audio.play(storyPresentationCue(snapshot.beat));
  }

  private resumeStoryPresentation(pending: PendingStoryNarrativeBeat): void {
    const stage = storyV2Stage(pending.stage);
    const token = parseStoryV2ResumeToken({
      schemaVersion: STORY_V2_VERSION,
      stageId: pending.stage,
      flowId: stage.presentationFlowId,
      beatId: pending.beatId,
    });
    const machine = new StoryV2PresentationMachine(
      pending.stage,
      token,
      pending.presentationEvidence,
    );
    this.storyPresentationMachine = machine;
    const snapshot = machine.snapshot();
    if (
      pending.stage === "qong" &&
      snapshot.beat &&
      qongStoryPhaseForBeat(snapshot.beat.id) !== "terminal"
    ) {
      this.startQongStorySequence(
        qongCourtFromPresentationEvidence(pending.presentationEvidence),
        snapshot.beat.id,
        true,
      );
      return;
    }
    this.shell.showStoryPresentation(snapshot);
    if (snapshot.beat) this.audio.play(storyPresentationCue(snapshot.beat));
    this.audio.setMenuMusic(false);
  }

  private handleStoryPresentationContinue(): void {
    const pending = this.saveRepository.snapshot().story.pendingNarrativeBeat;
    if (!pending) {
      if (!import.meta.env.DEV || !this.storyPresentationMachine) {
        this.storyPresentationMachine = null;
        this.shell.showPage("story");
        return;
      }
      const qaResult = this.storyPresentationMachine.dispatch("continue");
      if (qaResult.completion || qaResult.snapshot.beat === null) {
        this.storyPresentationMachine = null;
        this.shell.showPage("story");
        return;
      }
      this.shell.showStoryPresentation(qaResult.snapshot);
      this.audio.play(storyPresentationCue(qaResult.snapshot.beat));
      return;
    }
    if (!this.storyPresentationMachine) {
      this.resumeStoryPresentation(pending);
      return;
    }
    const result = this.storyPresentationMachine.dispatch("continue");
    if (result.completion) {
      this.finishStoryPresentation(result.completion, pending);
      return;
    }
    const beatId = result.snapshot.resumeToken?.beatId;
    if (!beatId) {
      throw new Error("Active Story transition lost its resume beat.");
    }
    const save = this.saveRepository.updatePendingNarrativeBeat(beatId);
    this.shell.updateSave(save);
    this.shell.showStoryPresentation(result.snapshot);
    if (result.snapshot.beat) {
      this.audio.play(storyPresentationCue(result.snapshot.beat));
    }
  }

  private finishStoryPresentation(
    completion: StoryV2PresentationCompletion,
    pending: PendingStoryNarrativeBeat,
  ): void {
    if (completion.completedStageId !== pending.stage) {
      throw new Error(
        "Story transition completion does not match its qualified run.",
      );
    }
    const save = this.saveRepository.completeStoryRun(
      pending.qualifiedRun,
      null,
    );
    this.shell.updateSave(save);
    this.storyPresentationMachine = null;
    this.screenScene().showLibrary();
    this.audio.play("recover");
    if (completion.kind === "launch-stage") {
      this.shell.showPage("story");
      void this.launchStory(completion.nextStageId, false);
      return;
    }
    if (completion.kind === "complete-story") {
      this.shell.showPage("story");
      this.audio.setMenuMusic(true);
      this.shell.announce(
        "Story complete. All five Workshop records are recovered; the Quarry record contains the user-initiated MOTH platform link.",
      );
      return;
    }
    this.shell.showPage("story");
    this.audio.setMenuMusic(true);
    this.shell.announce(
      `${completion.completedChapterId.toUpperCase()} debrief complete. Workshop material unlocked.`,
    );
  }

  private finishStoryReplay(
    gameId: ArcadeCabinetId,
    qualified: boolean,
  ): boolean {
    if (this.activeRun?.playMode !== "story" || !this.activeStoryReplay) {
      return false;
    }
    this.shell.announce(
      qualified
        ? `${gameId.toUpperCase()} Story replay complete. Story progress is unchanged.`
        : `${gameId.toUpperCase()} Story replay ended without recovery. Story progress is unchanged.`,
    );
    return true;
  }

  private exitCabinet(): void {
    const recoveredFormula = this.recoveredFormulaAfterCabinet;
    this.recoveredFormulaAfterCabinet = null;
    this.qongRuntime?.stop();
    this.qongStoryRuntime?.stop();
    this.skipixlRuntime?.stop();
    this.fluxballRuntime?.stop();
    this.quantmanRuntime?.stop();
    this.quagRuntime?.stop();
    this.qongRuntime = null;
    this.qongStoryRuntime = null;
    this.skipixlRuntime = null;
    this.fluxballRuntime = null;
    this.quantmanRuntime = null;
    this.quagRuntime = null;
    this.activeRun = null;
    this.activeStoryReplay = false;
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
    this.audio.setMenuMusic(true);
    this.audio.play("select");
    this.screenScene().showLibrary();
    this.developerAudit?.clear();
    this.shell.exitCabinet();
    if (recoveredFormula) this.shell.showFormula(recoveredFormula);
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
    this.audio.setMenuMusic(true);
    this.audio.play("select");
    this.storyPresentationMachine = null;
    this.completedReplay = null;
    this.recoveredFormulaAfterCabinet = null;
    this.fluxballLobby = null;
    this.pendingStorySkiPixlPack = null;
    this.pendingFirstLossRetry = null;
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
        this.qongStoryRuntime ||
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
    if (document.visibilityState === "visible") this.onAudioRecovery();
  };

  private playCompletionCue(success: boolean): void {
    this.audio.setPaused(false);
    this.audio.play(success ? "recover" : "failure");
  }

  private beginCabinetAudio(): void {
    this.audio.setSkiCarve(0);
    this.audio.setMenuMusic(false);
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

function qongCourtFromPresentationEvidence(
  evidence: StoryV2PresentationEvidence,
): QongSnapshot {
  const court =
    evidence.completeness === "bound" && evidence.detail?.kind === "qong"
      ? evidence.detail.finalCourt
      : undefined;
  if (!court) return qaQongCompletedSnapshot();
  return Object.freeze({
    phase: "complete",
    tick: court.tick,
    rallyNumber: court.rallyNumber,
    totalRallies: court.totalRallies,
    leftScore: court.leftScore,
    rightScore: court.rightScore,
    observationsRemaining: court.observationsRemaining,
    measurementState: court.measurementState,
    goalRule: court.goalRule,
    ball: Object.freeze({ ...court.ball }),
    leftPaddleY: court.leftPaddleY,
    rightPaddleY: court.rightPaddleY,
    rallyReveal: null,
    winner: court.winner,
    storyEvidence: Object.freeze({
      humanObservationsUsed: 0,
      directionalRallyNumbers: Object.freeze([]),
    }),
  });
}

function qaQongCompletedSnapshot(): QongSnapshot {
  return Object.freeze({
    phase: "complete",
    tick: 733,
    rallyNumber: 7,
    totalRallies: 7,
    leftScore: 4,
    rightScore: 3,
    observationsRemaining: 1,
    measurementState: "resolved",
    goalRule: "own",
    ball: Object.freeze({ x: 320, y: 180 }),
    leftPaddleY: 134,
    rightPaddleY: 176,
    rallyReveal: null,
    winner: "left",
    storyEvidence: Object.freeze({
      humanObservationsUsed: 2,
      directionalRallyNumbers: Object.freeze([2, 5]),
    }),
  });
}

function requireFluxballPack(
  pack: FluxballCommittedPack | null,
): FluxballCommittedPack {
  if (!pack) throw new Error("Fluxball recovery lost its committed pack.");
  return pack;
}

function storyNarrativeBeatKind(
  stage: StoryStageId,
): PendingStoryNarrativeBeat["kind"] {
  if (stage === "quarry") return "finale";
  if (
    stage === "skipixl-medium" ||
    stage === "fluxball-two" ||
    stage === "quantman-stabilize"
  ) {
    return "interlude";
  }
  return "debrief";
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
    roundSeconds: 60,
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

function storyPresentationCue(beat: StoryV2PresentationBeat): SynthCue {
  switch (beat.kind) {
    case "morph":
    case "dismount":
      return "story-morph";
    case "door":
      return "story-door";
    case "transport":
      return "story-transport";
    case "terminal":
    case "workshop":
      return "reveal";
    case "explore":
    case "walk":
    case "dialogue":
      return "select";
  }
}

function devStoryV2StageIdFromRoute(route: string | null): StoryStageId | null {
  if (!route?.startsWith("story-v2-")) return null;
  const stageId = route.slice("story-v2-".length);
  return isStoryV2StageId(stageId) ? stageId : null;
}

function parseDevStoryV2BeatIndex(value: string | null): number {
  if (value === null) return 0;
  const beatIndex = Number(value);
  return Number.isSafeInteger(beatIndex) && beatIndex >= 0 ? beatIndex : 0;
}
