import { describe, expect, expectTypeOf, it } from "vitest";

import { requireCanonicalAsset } from "../../src/assets/CanonicalRuntimeAssets";
import { GAME_IDS, type GameId } from "../../src/games/registry";
import { DEVELOPMENT_FIXTURE_LABEL } from "../../src/tutorials/contracts";
import type { FluxballClubhouseMechanism } from "../../src/tutorials/fluxballClubhouse";
import type { QongWorkshopMechanism } from "../../src/tutorials/qongWorkshop";
import type { QuantmanTopologyRoomMechanism } from "../../src/tutorials/quantmanTopologyRoom";
import {
  startTutorial,
  TUTORIAL_REGISTRY,
  type AnyTutorialRuntimeSnapshot,
  type TutorialEvidenceInput,
} from "../../src/tutorials/registry";
import type { SkiPixlLodgeMechanism } from "../../src/tutorials/skiPixlLodge";
import {
  fluxballClubhouseFixtureInput,
  qongWorkshopRunInput,
  quantmanTopologyRoomFixtureInput,
  skiPixlLodgeRunInput,
} from "./tutorialWorldEvidenceFixtures";

describe("spatial tutorial registry", () => {
  it("exhaustively maps every cabinet to its world and canonical morph", () => {
    expect(Object.keys(TUTORIAL_REGISTRY)).toEqual(GAME_IDS);
    expect(registryPresentation()).toEqual({
      qong: {
        worldId: "qong-workshop",
        title: "Qong Workshop",
        morphAssetId: "qong-paddle-to-wizard",
      },
      skipixl: {
        worldId: "skipixl-lodge",
        title: "SkiPixl Lodge",
        morphAssetId: null,
      },
      fluxball: {
        worldId: "fluxball-clubhouse",
        title: "Fluxball Clubhouse",
        morphAssetId: "fluxball-player-a-to-wizard",
      },
      quantman: {
        worldId: "quantman-topology-room",
        title: "Quantman Topology Room",
        morphAssetId: "quantman-ghost-c-to-wizard",
      },
    });

    for (const gameId of GAME_IDS) {
      const entry = TUTORIAL_REGISTRY[gameId];
      expect(entry.definition.worldId).toBe(entry.worldId);
      expect(entry.definition.title).toBe(entry.title);
      if (entry.morphAssetId === null) continue;
      expect(requireCanonicalAsset(entry.morphAssetId).kind).toBe(
        "runtime-morph-strip",
      );
    }
  });

  it("keeps every development fixture visible and ineligible for Story authority", async () => {
    const qongInput = await qongWorkshopRunInput();
    const sessions = [
      startTutorial({
        gameId: "qong",
        evidenceInput: { ...qongInput, origin: "development-fixture" },
      }),
      startTutorial({
        gameId: "skipixl",
        evidenceInput: skiPixlLodgeRunInput("development-fixture"),
      }),
      startTutorial({
        gameId: "fluxball",
        evidenceInput: fluxballClubhouseFixtureInput(),
      }),
      startTutorial({
        gameId: "quantman",
        evidenceInput: quantmanTopologyRoomFixtureInput(),
      }),
    ] as const;

    for (const session of sessions) {
      const snapshot = session.snapshot();
      expect(snapshot.gameId).toBe(session.gameId);
      expect(snapshot.worldId).toBe(session.worldId);
      expect(snapshot.evidence).toEqual({
        requestOrigin: "development-fixture",
        status: "development-fixture",
        authority: "development-fixture",
        label: DEVELOPMENT_FIXTURE_LABEL,
        reason: null,
        storyProgressEligible: false,
      });
      expect(snapshot.world.evidence.storyProgressEligible).toBe(false);
      expect(session.dispatch({ type: "move", direction: "left" }).gameId).toBe(
        session.gameId,
      );
      assertTypedSnapshot(snapshot);
    }
  });

  it("starts absent-evidence worlds in a shared fail-closed shape", () => {
    const sessions = [
      startTutorial({ gameId: "qong", evidenceInput: null }),
      startTutorial({ gameId: "skipixl", evidenceInput: null }),
      startTutorial({ gameId: "fluxball", evidenceInput: null }),
      startTutorial({ gameId: "quantman", evidenceInput: null }),
    ] as const;

    for (const session of sessions) {
      expect(session.snapshot().evidence).toMatchObject({
        requestOrigin: "none",
        status: "unavailable",
        authority: "unavailable",
        storyProgressEligible: false,
      });
    }
  });

  it("preserves exact evidence and mechanism types through the common API", async () => {
    expectTypeOf<TutorialEvidenceInput<"qong">>().toEqualTypeOf<
      Awaited<ReturnType<typeof qongWorkshopRunInput>>
    >();
    expectTypeOf<TutorialEvidenceInput<"skipixl">>().toEqualTypeOf<
      ReturnType<typeof skiPixlLodgeRunInput>
    >();
    expectTypeOf<TutorialEvidenceInput<"fluxball">>().toEqualTypeOf<
      ReturnType<typeof fluxballClubhouseFixtureInput>
    >();
    expectTypeOf<TutorialEvidenceInput<"quantman">>().toEqualTypeOf<
      ReturnType<typeof quantmanTopologyRoomFixtureInput>
    >();

    const qong = startTutorial({
      gameId: "qong",
      evidenceInput: await qongWorkshopRunInput(),
    });
    expectTypeOf(
      qong.snapshot().world.mechanism,
    ).toEqualTypeOf<QongWorkshopMechanism>();
    expect(qong.snapshot().evidence.authority).toBe("validated-story-run");
  });
});

function registryPresentation(): Readonly<
  Record<
    GameId,
    Readonly<{
      worldId: string;
      title: string;
      morphAssetId: string | null;
    }>
  >
> {
  return Object.fromEntries(
    GAME_IDS.map((gameId) => {
      const entry = TUTORIAL_REGISTRY[gameId];
      return [
        gameId,
        {
          worldId: entry.worldId,
          title: entry.title,
          morphAssetId: entry.morphAssetId,
        },
      ];
    }),
  ) as Record<
    GameId,
    Readonly<{
      worldId: string;
      title: string;
      morphAssetId: string | null;
    }>
  >;
}

function assertTypedSnapshot(snapshot: AnyTutorialRuntimeSnapshot): void {
  switch (snapshot.gameId) {
    case "qong":
      expectTypeOf(
        snapshot.world.mechanism,
      ).toEqualTypeOf<QongWorkshopMechanism>();
      break;
    case "skipixl":
      expectTypeOf(
        snapshot.world.mechanism,
      ).toEqualTypeOf<SkiPixlLodgeMechanism>();
      break;
    case "fluxball":
      expectTypeOf(
        snapshot.world.mechanism,
      ).toEqualTypeOf<FluxballClubhouseMechanism>();
      break;
    case "quantman":
      expectTypeOf(
        snapshot.world.mechanism,
      ).toEqualTypeOf<QuantmanTopologyRoomMechanism>();
      break;
  }
}
