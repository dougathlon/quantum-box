import { describe, expect, it } from "vitest";

import {
  adaptFluxballClubhouseEvidence,
  createFluxballClubhouse,
  FLUXBALL_CLUBHOUSE_COMPLETION_SCRIPT,
} from "../../src/tutorials/fluxballClubhouse";
import {
  adaptQongWorkshopEvidence,
  createQongWorkshop,
  qongWorkshopCompletionScript,
} from "../../src/tutorials/qongWorkshop";
import {
  adaptQuantmanTopologyRoomEvidence,
  createQuantmanTopologyRoom,
  quantmanTopologyRoomCompletionScript,
} from "../../src/tutorials/quantmanTopologyRoom";
import {
  adaptSkiPixlLodgeEvidence,
  createSkiPixlLodge,
  SKIPIXL_LODGE_COMPLETION_SCRIPT,
} from "../../src/tutorials/skiPixlLodge";
import {
  fluxballClubhouseFixtureInput,
  qongWorkshopRunInput,
  quantmanTopologyRoomFixtureInput,
  skiPixlLodgeRunInput,
} from "./tutorialWorldEvidenceFixtures";

describe("tutorial evidence fail-closed boundary", () => {
  it("keeps every mechanism and Story completion closed when run evidence is absent", () => {
    const cases = [
      {
        gate: adaptQongWorkshopEvidence(null),
        world: createQongWorkshop(),
        script: qongWorkshopCompletionScript("direct"),
      },
      {
        gate: adaptSkiPixlLodgeEvidence(null),
        world: createSkiPixlLodge(),
        script: SKIPIXL_LODGE_COMPLETION_SCRIPT,
      },
      {
        gate: adaptFluxballClubhouseEvidence(null),
        world: createFluxballClubhouse(),
        script: FLUXBALL_CLUBHOUSE_COMPLETION_SCRIPT,
      },
      {
        gate: adaptQuantmanTopologyRoomEvidence(null),
        world: createQuantmanTopologyRoom(),
        script: quantmanTopologyRoomCompletionScript(1),
      },
    ] as const;

    for (const entry of cases) {
      expect(entry.gate).toMatchObject({
        status: "unavailable",
        storyProgressEligible: false,
        value: null,
      });
      for (const action of entry.script) entry.world.dispatch(action);
      expect(entry.world.snapshot().phase).not.toBe("completion");
      expect(entry.world.snapshot().completion.storyProgressGranted).toBe(
        false,
      );
    }
  });

  it("rejects incomplete or mismatched completed-run qualification", async () => {
    const qong = await qongWorkshopRunInput();
    expect(
      adaptQongWorkshopEvidence({
        ...qong,
        snapshot: { ...qong.snapshot, winner: "right" },
      }).status,
    ).toBe("unavailable");

    const skiPixl = skiPixlLodgeRunInput();
    expect(
      adaptSkiPixlLodgeEvidence({
        ...skiPixl,
        snapshot: { ...skiPixl.snapshot, storyQualified: false },
      }).status,
    ).toBe("unavailable");

    const fluxball = fluxballClubhouseFixtureInput();
    expect(
      adaptFluxballClubhouseEvidence({
        ...fluxball,
        origin: "completed-story-run",
        snapshot: { ...fluxball.snapshot, humanWon: false },
      }).status,
    ).toBe("unavailable");

    const quantman = quantmanTopologyRoomFixtureInput();
    expect(
      adaptQuantmanTopologyRoomEvidence({
        ...quantman,
        snapshot: {
          ...quantman.snapshot,
          observationCount: quantman.snapshot.observationCount + 1,
        },
      }).status,
    ).toBe("unavailable");
  });
});
