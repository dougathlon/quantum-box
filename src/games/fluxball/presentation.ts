import type { PlayerId } from "./standalone/modes";
import type { FluxballSnapshot } from "./types";

export interface FluxballHudModel {
  readonly round: string;
  readonly time: string;
  readonly goals: Readonly<Record<PlayerId, string>>;
  readonly roundWins: Readonly<Record<PlayerId, string>>;
  readonly activePlayerIds: readonly PlayerId[];
  readonly notice: string;
  readonly ruleChange: "PRESS SPACE / A TO CHANGE RULES" | "";
}

export function fluxballHudModel(
  snapshot: FluxballSnapshot,
  paused: boolean,
): FluxballHudModel {
  return Object.freeze({
    round: `R ${snapshot.roundNumber}/${snapshot.totalRounds}`,
    time: String(
      Math.max(0, Math.ceil(snapshot.sport?.secondsRemaining ?? 0)),
    ).padStart(2, "0"),
    goals: scoreStrings(snapshot.roundGoals),
    roundWins: scoreStrings(snapshot.roundWins),
    activePlayerIds: Object.freeze([
      ...(snapshot.sport?.activePlayerIds ?? []),
    ]),
    notice: fluxballNotice(snapshot, paused),
    ruleChange:
      snapshot.phase === "active" && snapshot.remainingRuleChanges === 1
        ? "PRESS SPACE / A TO CHANGE RULES"
        : "",
  });
}

export function fluxballCompletionLabel(
  playMode: "story" | "arcade",
  humanWon: boolean,
): string {
  if (playMode === "arcade") return "MATCH COMPLETE";
  return humanWon ? "YOU WIN" : "MATCH LOST";
}

function scoreStrings(
  score: Readonly<Partial<Record<PlayerId, number>>>,
): Readonly<Record<PlayerId, string>> {
  return Object.freeze({
    A: String(score.A ?? 0),
    B: String(score.B ?? 0),
    C: String(score.C ?? 0),
    D: String(score.D ?? 0),
  });
}

function fluxballNotice(snapshot: FluxballSnapshot, paused: boolean): string {
  if (paused) return "PAUSED";
  if (snapshot.phase === "active") {
    const goal = snapshot.sport?.latestGoal;
    if (goal && (snapshot.sport?.goalFreezeTicksRemaining ?? 0) > 0) {
      const awarded = goal.awardedPlayerIds.join("+") || "NO ONE";
      return `GOAL ${goal.physicalGoal} · ${awarded} SCORES`;
    }
    return "";
  }
  if (snapshot.phase === "reveal") {
    const winner = snapshot.reveal?.roundWinnerIds[0];
    return winner
      ? `R${snapshot.roundNumber} · ${winner} WINS`
      : `R${snapshot.roundNumber} · DRAW`;
  }
  const winners = snapshot.winnerIds.join(" / ");
  if (snapshot.winnerIds.length > 1) return `MATCH DRAW · ${winners}`;
  return snapshot.humanWon
    ? `YOU WIN · PLAYER ${winners}`
    : `MATCH COMPLETE · PLAYER ${winners || "NONE"} WINS`;
}
