import { createRunContext } from "../../src/core/run";
import { createDevDesignerEncounterFixture } from "../../src/debug/DesignerEncounterFixtures";
import { createFluxballDesignerEvidence } from "../../src/games/fluxball/FluxballDesignerEvidence";
import { FluxballSession } from "../../src/games/fluxball/FluxballSession";
import { FLUXBALL_PLAYABLE_RULE_BANK } from "../../src/games/fluxball/fluxballControlPacks";
import type {
  FluxballHumanInput,
  FluxballSnapshot,
} from "../../src/games/fluxball/types";
import {
  loadInstalledQongStoryBank,
  selectQongStoryPack,
} from "../../src/games/qong/qongStoryPackBank";
import type { QongSnapshot } from "../../src/games/qong/types";
import {
  createSkiPixlDesignerEvidence,
  selectStorySkiPixlPack,
} from "../../src/games/skipixl/SkiPixlCourseAdapter";
import type { SkiPixlSnapshot } from "../../src/games/skipixl/types";
import { QongDesignerLesson } from "../../src/story/QongDesignerLesson";
import type { FluxballClubhouseAdapterInput } from "../../src/tutorials/fluxballClubhouse";
import type { QongWorkshopAdapterInput } from "../../src/tutorials/qongWorkshop";
import type { QuantmanTopologyRoomAdapterInput } from "../../src/tutorials/quantmanTopologyRoom";
import type { SkiPixlLodgeAdapterInput } from "../../src/tutorials/skiPixlLodge";
export async function qongWorkshopRunInput(): Promise<QongWorkshopAdapterInput> {
  const bank = await loadInstalledQongStoryBank();
  const selection = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
  const context = createRunContext({
    gameId: "qong",
    storyStage: "qong",
    playMode: "story",
    rulesVersion: selection.pack.rulesVersion,
    runSeed: 17,
    pack: packIdentity(selection.pack),
    packSelection: selection.receipt,
  });
  const snapshot: QongSnapshot = {
    phase: "complete",
    tick: 9_001,
    rallyNumber: 7,
    totalRallies: 7,
    leftScore: 4,
    rightScore: 3,
    observationsRemaining: 2,
    measurementState: "resolved",
    goalRule: "own",
    ball: { x: 320, y: 180 },
    leftPaddleY: 180,
    rightPaddleY: 180,
    rallyReveal: null,
    winner: "left",
    storyEvidence: {
      humanObservationsUsed: 1,
      directionalRallyNumbers: [1, 3, 5],
    },
  };
  return {
    origin: "completed-story-run",
    context,
    snapshot,
    evidence: new QongDesignerLesson(
      selection.pack,
      selection.receipt,
    ).snapshot(),
  };
}

export function skiPixlLodgeRunInput(
  origin: SkiPixlLodgeAdapterInput["origin"] = "completed-story-run",
): SkiPixlLodgeAdapterInput {
  const pack = selectStorySkiPixlPack(0);
  const context = createRunContext({
    gameId: "skipixl",
    storyStage: "skipixl",
    playMode: "story",
    rulesVersion: pack.rulesVersion,
    runSeed: 23,
    pack: packIdentity(pack),
  });
  const snapshot: SkiPixlSnapshot = {
    phase: "complete",
    tick: 3_600,
    readyTicksRemaining: 0,
    elapsedTicks: 3_420,
    elapsedSeconds: 57,
    targetSeconds: pack.payload.winSeconds,
    secondsRemaining: pack.payload.winSeconds - 57,
    distance: pack.payload.courseLength,
    courseLength: pack.payload.courseLength,
    speed: pack.payload.cruiseSpeed,
    skierX: 320,
    lateralVelocity: 0,
    steeringAngle: 0,
    obstaclesResolved: pack.payload.obstacles.length,
    gatesResolved: pack.payload.gates?.length ?? 0,
    gatePenaltyTicks: 0,
    gateResults: [],
    latestGate: null,
    collisions: [],
    latestCollision: null,
    knockdownTicksRemaining: 0,
    storyQualified: true,
    finishedUnderPar: false,
    receipt: pack.payload.receipt,
  };
  return {
    origin,
    context,
    snapshot,
    evidence: createSkiPixlDesignerEvidence(pack),
    payload: pack.payload,
  };
}

export function fluxballClubhouseFixtureInput(): FluxballClubhouseAdapterInput {
  const pack = FLUXBALL_PLAYABLE_RULE_BANK;
  const context = createRunContext({
    gameId: "fluxball",
    storyStage: "fluxball-four",
    playMode: "story",
    rulesVersion: pack.rulesVersion,
    runSeed: 0,
    pack: packIdentity(pack),
  });
  const session = new FluxballSession(context, {
    competitorCount: 4,
    ruleMode: "individual",
    roundSeconds: 60,
    humanPlayerIds: ["A"],
  });
  const neutralInput: FluxballHumanInput = Object.freeze({ players: {} });
  let snapshot = session.snapshot();
  for (let round = 0; round < 4; round += 1) {
    while (snapshot.phase === "active") snapshot = session.step(neutralInput);
    snapshot = session.continueAfterReveal();
  }
  if (snapshot.phase !== "complete") {
    throw new Error("Fluxball tutorial fixture did not complete four rounds.");
  }
  return {
    origin: "development-fixture",
    context,
    snapshot,
    evidence: createFluxballDesignerEvidence(
      pack,
      snapshot as FluxballSnapshot,
    ),
  };
}

export function quantmanTopologyRoomFixtureInput(): QuantmanTopologyRoomAdapterInput {
  const fixture = createDevDesignerEncounterFixture("quantman");
  if (
    fixture.request.gameId !== "quantman" ||
    fixture.request.evidenceInput === null
  ) {
    throw new Error("Quantman development fixture returned the wrong game.");
  }
  return fixture.request.evidenceInput;
}

function packIdentity(pack: {
  readonly packId: string;
  readonly contentSha256: string;
  readonly schemaVersion: string;
  readonly source: string;
}) {
  return {
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    schemaVersion: pack.schemaVersion,
    source: pack.source,
  };
}
