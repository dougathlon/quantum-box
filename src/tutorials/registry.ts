import type { GameId } from "../games/registry";
import {
  type SpatialTutorialMachine,
  type TutorialAction,
  type TutorialEvidenceGate,
  type TutorialEvidenceStatus,
  type TutorialSnapshot,
  type TutorialWorldDefinition,
  type TutorialWorldId,
} from "./contracts";
import type { TutorialEvidenceOrigin } from "./evidence";
import {
  adaptFluxballClubhouseEvidence,
  createFluxballClubhouse,
  FLUXBALL_CLUBHOUSE_DEFINITION,
  type FluxballClubhouseAdapterInput,
  type FluxballClubhouseEvidence,
  type FluxballClubhouseMechanism,
} from "./fluxballClubhouse";
import {
  adaptQongWorkshopEvidence,
  createQongWorkshop,
  QONG_WORKSHOP_DEFINITION,
  type QongWorkshopAdapterInput,
  type QongWorkshopEvidence,
  type QongWorkshopMechanism,
} from "./qongWorkshop";
import {
  adaptQuantmanTopologyRoomEvidence,
  createQuantmanTopologyRoom,
  QUANTMAN_TOPOLOGY_ROOM_DEFINITION,
  type QuantmanTopologyRoomAdapterInput,
  type QuantmanTopologyRoomEvidence,
  type QuantmanTopologyRoomMechanism,
} from "./quantmanTopologyRoom";
import {
  adaptSkiPixlLodgeEvidence,
  createSkiPixlLodge,
  SKIPIXL_LODGE_DEFINITION,
  type SkiPixlLodgeAdapterInput,
  type SkiPixlLodgeEvidence,
  type SkiPixlLodgeMechanism,
} from "./skiPixlLodge";

export type CanonicalTutorialMorphAssetId =
  | "qong-paddle-to-wizard"
  | "fluxball-player-a-to-wizard"
  | "quantman-ghost-c-to-wizard";

interface TutorialTypeMap {
  readonly qong: Readonly<{
    input: QongWorkshopAdapterInput;
    evidence: QongWorkshopEvidence;
    mechanism: QongWorkshopMechanism;
    worldId: "qong-workshop";
    title: "Qong Workshop";
    morphAssetId: "qong-paddle-to-wizard";
  }>;
  readonly skipixl: Readonly<{
    input: SkiPixlLodgeAdapterInput;
    evidence: SkiPixlLodgeEvidence;
    mechanism: SkiPixlLodgeMechanism;
    worldId: "skipixl-lodge";
    title: "SkiPixl Lodge";
    morphAssetId: null;
  }>;
  readonly fluxball: Readonly<{
    input: FluxballClubhouseAdapterInput;
    evidence: FluxballClubhouseEvidence;
    mechanism: FluxballClubhouseMechanism;
    worldId: "fluxball-clubhouse";
    title: "Fluxball Clubhouse";
    morphAssetId: "fluxball-player-a-to-wizard";
  }>;
  readonly quantman: Readonly<{
    input: QuantmanTopologyRoomAdapterInput;
    evidence: QuantmanTopologyRoomEvidence;
    mechanism: QuantmanTopologyRoomMechanism;
    worldId: "quantman-topology-room";
    title: "Quantman Topology Room";
    morphAssetId: "quantman-ghost-c-to-wizard";
  }>;
}

export type TutorialEvidenceInput<G extends GameId> =
  TutorialTypeMap[G]["input"];
export type TutorialEvidence<G extends GameId> = TutorialTypeMap[G]["evidence"];
export type TutorialMechanism<G extends GameId> =
  TutorialTypeMap[G]["mechanism"];
export type TutorialWorldIdFor<G extends GameId> =
  TutorialTypeMap[G]["worldId"];
export type TutorialTitleFor<G extends GameId> = TutorialTypeMap[G]["title"];
export type TutorialMorphAssetFor<G extends GameId> =
  TutorialTypeMap[G]["morphAssetId"];

export interface TutorialRegistryEntry<G extends GameId> {
  readonly gameId: G;
  readonly worldId: TutorialWorldIdFor<G>;
  readonly title: TutorialTitleFor<G>;
  readonly definition: TutorialWorldDefinition;
  readonly morphAssetId: TutorialMorphAssetFor<G>;
  readonly adaptEvidence: (
    input: TutorialEvidenceInput<G> | null,
  ) => TutorialEvidenceGate<TutorialEvidence<G>>;
  readonly createWorld: (
    evidence: TutorialEvidenceGate<TutorialEvidence<G>>,
  ) => SpatialTutorialMachine<TutorialMechanism<G>, TutorialEvidence<G>>;
}

export type TutorialRegistry = Readonly<{
  [G in GameId]: TutorialRegistryEntry<G>;
}>;

export const TUTORIAL_REGISTRY = Object.freeze({
  qong: Object.freeze({
    gameId: "qong",
    worldId: "qong-workshop",
    title: "Qong Workshop",
    definition: QONG_WORKSHOP_DEFINITION,
    morphAssetId: "qong-paddle-to-wizard",
    adaptEvidence: adaptQongWorkshopEvidence,
    createWorld: createQongWorkshop,
  }),
  skipixl: Object.freeze({
    gameId: "skipixl",
    worldId: "skipixl-lodge",
    title: "SkiPixl Lodge",
    definition: SKIPIXL_LODGE_DEFINITION,
    morphAssetId: null,
    adaptEvidence: adaptSkiPixlLodgeEvidence,
    createWorld: createSkiPixlLodge,
  }),
  fluxball: Object.freeze({
    gameId: "fluxball",
    worldId: "fluxball-clubhouse",
    title: "Fluxball Clubhouse",
    definition: FLUXBALL_CLUBHOUSE_DEFINITION,
    morphAssetId: "fluxball-player-a-to-wizard",
    adaptEvidence: adaptFluxballClubhouseEvidence,
    createWorld: createFluxballClubhouse,
  }),
  quantman: Object.freeze({
    gameId: "quantman",
    worldId: "quantman-topology-room",
    title: "Quantman Topology Room",
    definition: QUANTMAN_TOPOLOGY_ROOM_DEFINITION,
    morphAssetId: "quantman-ghost-c-to-wizard",
    adaptEvidence: adaptQuantmanTopologyRoomEvidence,
    createWorld: createQuantmanTopologyRoom,
  }),
} satisfies TutorialRegistry);

export type TutorialStartRequestFor<G extends GameId> = Readonly<{
  gameId: G;
  evidenceInput: TutorialEvidenceInput<G> | null;
}>;

export type TutorialStartRequest = {
  [G in GameId]: TutorialStartRequestFor<G>;
}[GameId];

export type TutorialRuntimeAuthority =
  | "validated-story-run"
  | "saved-recovery-replay"
  | "development-fixture"
  | "unavailable";

export type TutorialRuntimeOrigin =
  | TutorialEvidenceOrigin
  | "saved-recovery"
  | "none";

export interface TutorialRuntimeEvidence {
  readonly requestOrigin: TutorialRuntimeOrigin;
  readonly status: TutorialEvidenceStatus;
  readonly authority: TutorialRuntimeAuthority;
  readonly label: string;
  readonly reason: string | null;
  readonly storyProgressEligible: boolean;
}

export type TutorialRuntimeSnapshot<G extends GameId> = Readonly<{
  gameId: G;
  worldId: TutorialWorldIdFor<G>;
  title: TutorialTitleFor<G>;
  definition: TutorialWorldDefinition;
  morphAssetId: TutorialMorphAssetFor<G>;
  evidence: TutorialRuntimeEvidence;
  world: TutorialSnapshot<TutorialMechanism<G>>;
}>;

export interface TutorialSession<G extends GameId> {
  readonly gameId: G;
  readonly worldId: TutorialWorldIdFor<G>;
  readonly title: TutorialTitleFor<G>;
  readonly definition: TutorialWorldDefinition;
  readonly morphAssetId: TutorialMorphAssetFor<G>;
  readonly evidenceGate: TutorialEvidenceGate<TutorialEvidence<G>>;
  dispatch(action: TutorialAction): TutorialRuntimeSnapshot<G>;
  snapshot(): TutorialRuntimeSnapshot<G>;
}

export type AnyTutorialSession = {
  [G in GameId]: TutorialSession<G>;
}[GameId];

export type AnyTutorialRuntimeSnapshot = {
  [G in GameId]: TutorialRuntimeSnapshot<G>;
}[GameId];

class RegistryTutorialSession<G extends GameId> implements TutorialSession<G> {
  public readonly gameId: G;
  public readonly worldId: TutorialWorldIdFor<G>;
  public readonly title: TutorialTitleFor<G>;
  public readonly definition: TutorialWorldDefinition;
  public readonly morphAssetId: TutorialMorphAssetFor<G>;
  public readonly evidenceGate: TutorialEvidenceGate<TutorialEvidence<G>>;

  public constructor(
    entry: TutorialRegistryEntry<G>,
    private readonly world: SpatialTutorialMachine<
      TutorialMechanism<G>,
      TutorialEvidence<G>
    >,
    evidenceGate: TutorialEvidenceGate<TutorialEvidence<G>>,
    private readonly runtimeEvidence: TutorialRuntimeEvidence,
  ) {
    if (
      entry.definition.worldId !== entry.worldId ||
      entry.definition.title !== entry.title
    ) {
      throw new Error(`${entry.gameId} tutorial registry metadata drifted.`);
    }
    this.gameId = entry.gameId;
    this.worldId = entry.worldId;
    this.title = entry.title;
    this.definition = entry.definition;
    this.morphAssetId = entry.morphAssetId;
    this.evidenceGate = evidenceGate;
  }

  public dispatch(action: TutorialAction): TutorialRuntimeSnapshot<G> {
    return this.wrap(this.world.dispatch(action));
  }

  public snapshot(): TutorialRuntimeSnapshot<G> {
    return this.wrap(this.world.snapshot());
  }

  private wrap(
    world: TutorialSnapshot<TutorialMechanism<G>>,
  ): TutorialRuntimeSnapshot<G> {
    return Object.freeze({
      gameId: this.gameId,
      worldId: this.worldId,
      title: this.title,
      definition: this.definition,
      morphAssetId: this.morphAssetId,
      evidence: this.runtimeEvidence,
      world,
    });
  }
}

export function startTutorial(
  request: TutorialStartRequestFor<"qong">,
): TutorialSession<"qong">;
export function startTutorial(
  request: TutorialStartRequestFor<"skipixl">,
): TutorialSession<"skipixl">;
export function startTutorial(
  request: TutorialStartRequestFor<"fluxball">,
): TutorialSession<"fluxball">;
export function startTutorial(
  request: TutorialStartRequestFor<"quantman">,
): TutorialSession<"quantman">;
export function startTutorial(
  request: TutorialStartRequest,
): AnyTutorialSession;
export function startTutorial(
  request: TutorialStartRequest,
): AnyTutorialSession {
  switch (request.gameId) {
    case "qong":
      return startKnownTutorial(TUTORIAL_REGISTRY.qong, request.evidenceInput);
    case "skipixl":
      return startKnownTutorial(
        TUTORIAL_REGISTRY.skipixl,
        request.evidenceInput,
      );
    case "fluxball":
      return startKnownTutorial(
        TUTORIAL_REGISTRY.fluxball,
        request.evidenceInput,
      );
    case "quantman":
      return startKnownTutorial(
        TUTORIAL_REGISTRY.quantman,
        request.evidenceInput,
      );
  }
}

function startKnownTutorial<G extends GameId>(
  entry: TutorialRegistryEntry<G>,
  input: TutorialEvidenceInput<G> | null,
): TutorialSession<G> {
  const gate = entry.adaptEvidence(input);
  return new RegistryTutorialSession(
    entry,
    entry.createWorld(gate),
    gate,
    runtimeEvidence(input?.origin ?? "none", gate),
  );
}

function runtimeEvidence<T>(
  requestOrigin: TutorialRuntimeOrigin,
  gate: TutorialEvidenceGate<T>,
): TutorialRuntimeEvidence {
  if (
    requestOrigin === "development-fixture" &&
    (gate.status === "validated-run" || gate.storyProgressEligible)
  ) {
    throw new Error(
      "Development tutorial evidence cannot carry Story authority.",
    );
  }
  const authority: TutorialRuntimeAuthority =
    requestOrigin === "development-fixture" &&
    gate.status === "development-fixture"
      ? "development-fixture"
      : requestOrigin === "completed-story-run" &&
          gate.status === "validated-run" &&
          gate.storyProgressEligible
        ? "validated-story-run"
        : "unavailable";
  return Object.freeze({
    requestOrigin,
    status: gate.status,
    authority,
    label: gate.label,
    reason: gate.reason,
    storyProgressEligible:
      authority === "validated-story-run" && gate.storyProgressEligible,
  });
}

export function tutorialWorldId(gameId: GameId): TutorialWorldId {
  return TUTORIAL_REGISTRY[gameId].worldId;
}
