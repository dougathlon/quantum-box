import { QUAG_PLAYER_IDS, type QuagPlayerId, type QuagSnapshot } from "./types";

type MatchResult = Pick<QuagSnapshot, "winnerIds" | "sharedWins">;

export function quagMatchIsDraw(snapshot: MatchResult): boolean {
  const count = snapshot.winnerIds.length;
  return (
    count !== 1 &&
    (!snapshot.sharedWins || count === 0 || count === QUAG_PLAYER_IDS.length)
  );
}

export function quagPlayerWon(
  snapshot: MatchResult,
  playerId: QuagPlayerId,
): boolean {
  return !quagMatchIsDraw(snapshot) && snapshot.winnerIds.includes(playerId);
}
