import type { QongOpponent, QongSnapshot } from "./types";

export interface QongHudModel {
  readonly leftLabel: "YOU" | "P1";
  readonly rightLabel: "CPU" | "P2";
  readonly leftScore: string;
  readonly rightScore: string;
  readonly round: string;
  readonly ruleState: string;
  readonly goal: string;
  readonly winner: string;
  readonly notice: string;
}

export function qongHudModel(
  snapshot: QongSnapshot,
  opponent: QongOpponent,
  paused: boolean,
): QongHudModel {
  return Object.freeze({
    leftLabel: opponent === "cpu" ? "YOU" : "P1",
    rightLabel: opponent === "cpu" ? "CPU" : "P2",
    leftScore: String(snapshot.leftScore),
    rightScore: String(snapshot.rightScore),
    round: `ROUND: ${snapshot.rallyNumber}/${snapshot.totalRallies}`,
    ruleState: `RULE STATE: ${snapshot.measurementState.toUpperCase()}`,
    goal: `GOAL: ${snapshot.goalRule.toUpperCase()}`,
    winner: `WINNER: ${qongWinnerLabel(snapshot, opponent)}`,
    notice: paused ? "PAUSED" : "",
  });
}

function qongWinnerLabel(
  snapshot: QongSnapshot,
  opponent: QongOpponent,
): string {
  const winner =
    snapshot.phase === "complete"
      ? snapshot.winner
      : snapshot.phase === "between-rallies"
        ? (snapshot.rallyReveal?.pointWinner ?? null)
        : null;
  if (winner === null) return "UNRESOLVED";
  if (winner === "left") return opponent === "cpu" ? "YOU" : "PLAYER 1";
  return opponent === "cpu" ? "CPU" : "PLAYER 2";
}
