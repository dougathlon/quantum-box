import type { ActivePlayerMap, PlayerId } from "../modes";
import type { PlayerRules, PurposeRule } from "../rules/types";

export type GoalId = PlayerId;
export type ScoreBoard = ActivePlayerMap<number>;

const OPPOSITE_GOAL: Readonly<Record<PlayerId, GoalId>> = Object.freeze({
  A: "B",
  B: "A",
  C: "D",
  D: "C",
});

export interface GoalEvaluation {
  readonly physicalGoal: GoalId;
  readonly purposeByPlayer: ActivePlayerMap<PurposeRule>;
  readonly scoringGoalByPlayer: ActivePlayerMap<GoalId>;
  readonly awards: ActivePlayerMap<boolean>;
  readonly scoreBefore: ScoreBoard;
  readonly scoreAfter: ScoreBoard;
}

export function ownGoalFor(playerId: PlayerId): GoalId {
  return playerId;
}

export function oppositeGoalFor(playerId: PlayerId): GoalId {
  return OPPOSITE_GOAL[playerId];
}

export function scoringGoalFor(
  playerId: PlayerId,
  purpose: PurposeRule,
): GoalId {
  return purpose === "OWN" ? ownGoalFor(playerId) : oppositeGoalFor(playerId);
}

export function createScoreBoard(
  activePlayerIds: readonly PlayerId[],
  initial: ScoreBoard = {},
): ScoreBoard {
  return Object.freeze(
    Object.fromEntries(
      activePlayerIds.map((playerId) => [playerId, initial[playerId] ?? 0]),
    ) as Partial<Record<PlayerId, number>>,
  );
}

export function evaluatePhysicalGoal(
  physicalGoal: GoalId,
  activePlayerIds: readonly PlayerId[],
  rules: ActivePlayerMap<PlayerRules>,
  scoreBefore: ScoreBoard,
): GoalEvaluation {
  const purposeByPlayer: Partial<Record<PlayerId, PurposeRule>> = {};
  const scoringGoalByPlayer: Partial<Record<PlayerId, GoalId>> = {};
  const awards: Partial<Record<PlayerId, boolean>> = {};
  const scoreAfter: Partial<Record<PlayerId, number>> = {};
  for (const playerId of activePlayerIds) {
    const playerRules = rules[playerId];
    if (!playerRules)
      throw new Error(`Player ${playerId} has no PURPOSE rule.`);
    const scoringGoal = scoringGoalFor(playerId, playerRules.purpose);
    const awarded = scoringGoal === physicalGoal;
    purposeByPlayer[playerId] = playerRules.purpose;
    scoringGoalByPlayer[playerId] = scoringGoal;
    awards[playerId] = awarded;
    scoreAfter[playerId] = (scoreBefore[playerId] ?? 0) + Number(awarded);
  }
  return Object.freeze({
    physicalGoal,
    purposeByPlayer: Object.freeze(purposeByPlayer),
    scoringGoalByPlayer: Object.freeze(scoringGoalByPlayer),
    awards: Object.freeze(awards),
    scoreBefore: createScoreBoard(activePlayerIds, scoreBefore),
    scoreAfter: createScoreBoard(activePlayerIds, scoreAfter),
  });
}
