import type { GameId } from "../games/registry";
import { validateInstalledQongRecoveryAuthority } from "../games/qong/qongStoryPackBank";
import {
  deepFreeze,
  type SpatialTutorialMachine,
  type TutorialAction,
  type TutorialEvidenceGate,
  type TutorialSnapshot,
} from "./contracts";
import {
  TUTORIAL_REGISTRY,
  type TutorialEvidence,
  type TutorialMechanism,
  type TutorialMorphAssetFor,
  type TutorialRegistryEntry,
  type TutorialRuntimeSnapshot,
  type TutorialTitleFor,
  type TutorialWorldIdFor,
} from "./registry";
import {
  validateTutorialRecoveryRecord,
  type TutorialRecoveryRecord,
} from "./recovery";

export const TUTORIAL_REPLAY_AUTHORITY = "saved-recovery-replay";
export const TUTORIAL_REPLAY_REASON =
  "Saved recovery replay is interactive but cannot grant Story progress.";

export interface TutorialReplayEvidence {
  readonly requestOrigin: "saved-recovery";
  readonly status: "validated-run";
  readonly authority: typeof TUTORIAL_REPLAY_AUTHORITY;
  readonly label: string;
  readonly reason: typeof TUTORIAL_REPLAY_REASON;
  readonly storyProgressEligible: false;
  readonly sourceRunId: string;
  readonly sourceEvidenceSha256: string;
}

export type TutorialReplaySnapshot<G extends GameId> = Readonly<
  Omit<TutorialRuntimeSnapshot<G>, "evidence"> & {
    evidence: TutorialReplayEvidence;
  }
>;

export interface TutorialReplaySession<G extends GameId> {
  readonly gameId: G;
  readonly worldId: TutorialWorldIdFor<G>;
  readonly title: TutorialTitleFor<G>;
  readonly morphAssetId: TutorialMorphAssetFor<G>;
  readonly source: Readonly<{
    gameId: G;
    worldId: TutorialWorldIdFor<G>;
    runId: string;
    evidenceSha256: string;
    evidenceLabel: string;
  }>;
  dispatch(action: TutorialAction): TutorialReplaySnapshot<G>;
  snapshot(): TutorialReplaySnapshot<G>;
}

export type AnyTutorialReplaySession = {
  [G in GameId]: TutorialReplaySession<G>;
}[GameId];

export type AnyTutorialReplaySnapshot = {
  [G in GameId]: TutorialReplaySnapshot<G>;
}[GameId];

/**
 * Replays start only after the persisted record's run identity and evidence
 * hash have been validated. The resulting session owns a fresh deterministic
 * world and deliberately exposes no save/progression mutation dependency.
 */
export async function startTutorialReplay(
  input: unknown,
): Promise<AnyTutorialReplaySession> {
  const record = await validateTutorialRecoveryRecord(input);
  switch (record.gameId) {
    case "qong": {
      const qongRecord = record as TutorialRecoveryRecord<"qong">;
      await validateInstalledQongRecoveryAuthority({
        rulesVersion: qongRecord.run.rulesVersion,
        pack: qongRecord.run.pack,
        packSelection: qongRecord.run.packSelection,
        firstResult: qongRecord.evidence.result,
      });
      return startKnownTutorialReplay(TUTORIAL_REGISTRY.qong, qongRecord);
    }
    case "skipixl":
      return startKnownTutorialReplay(
        TUTORIAL_REGISTRY.skipixl,
        record as TutorialRecoveryRecord<"skipixl">,
      );
    case "fluxball":
      return startKnownTutorialReplay(
        TUTORIAL_REGISTRY.fluxball,
        record as TutorialRecoveryRecord<"fluxball">,
      );
    case "quantman":
      return startKnownTutorialReplay(
        TUTORIAL_REGISTRY.quantman,
        record as TutorialRecoveryRecord<"quantman">,
      );
  }
}

class RecoveryTutorialReplaySession<G extends GameId>
  implements TutorialReplaySession<G>
{
  public readonly gameId: G;
  public readonly worldId: TutorialWorldIdFor<G>;
  public readonly title: TutorialTitleFor<G>;
  public readonly morphAssetId: TutorialMorphAssetFor<G>;
  public readonly source: TutorialReplaySession<G>["source"];
  private readonly replayEvidence: TutorialReplayEvidence;

  public constructor(
    entry: TutorialRegistryEntry<G>,
    record: TutorialRecoveryRecord<G>,
    private readonly world: SpatialTutorialMachine<
      TutorialMechanism<G>,
      TutorialEvidence<G>
    >,
  ) {
    if (entry.worldId !== record.worldId) {
      throw new Error(`${entry.gameId} replay world identity drifted.`);
    }
    this.gameId = entry.gameId;
    this.worldId = entry.worldId;
    this.title = entry.title;
    this.morphAssetId = entry.morphAssetId;
    this.source = deepFreeze({
      gameId: record.gameId,
      worldId: record.worldId,
      runId: record.run.runId,
      evidenceSha256: record.evidenceSha256,
      evidenceLabel: record.evidenceLabel,
    });
    this.replayEvidence = deepFreeze({
      requestOrigin: "saved-recovery",
      status: "validated-run",
      authority: TUTORIAL_REPLAY_AUTHORITY,
      label: replayLabel(record.evidenceLabel),
      reason: TUTORIAL_REPLAY_REASON,
      storyProgressEligible: false,
      sourceRunId: record.run.runId,
      sourceEvidenceSha256: record.evidenceSha256,
    });
  }

  public dispatch(action: TutorialAction): TutorialReplaySnapshot<G> {
    return this.wrap(this.world.dispatch(action));
  }

  public snapshot(): TutorialReplaySnapshot<G> {
    return this.wrap(this.world.snapshot());
  }

  private wrap(
    world: TutorialSnapshot<TutorialMechanism<G>>,
  ): TutorialReplaySnapshot<G> {
    if (world.completion.storyProgressGranted) {
      throw new Error("Saved tutorial replay acquired Story authority.");
    }
    return deepFreeze({
      gameId: this.gameId,
      worldId: this.worldId,
      title: this.title,
      definition: TUTORIAL_REGISTRY[this.gameId].definition,
      morphAssetId: this.morphAssetId,
      evidence: this.replayEvidence,
      world,
    }) as TutorialReplaySnapshot<G>;
  }
}

function startKnownTutorialReplay<G extends GameId>(
  entry: TutorialRegistryEntry<G>,
  record: TutorialRecoveryRecord<G>,
): TutorialReplaySession<G> {
  const gate: TutorialEvidenceGate<TutorialEvidence<G>> = deepFreeze({
    status: "validated-run",
    label: replayLabel(record.evidenceLabel),
    storyProgressEligible: false,
    reason: TUTORIAL_REPLAY_REASON,
    value: record.evidence,
  });
  return new RecoveryTutorialReplaySession(
    entry,
    record,
    entry.createWorld(gate),
  );
}

function replayLabel(sourceLabel: string): string {
  return `SAVED RECOVERY REPLAY · ${sourceLabel}`;
}
