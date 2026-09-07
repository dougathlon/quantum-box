export const DEFAULT_ARCADE_RUN_SEED = 260_823;

export type ArcadeRunOrigin = "player-arcade" | "developer-qa";

export interface ArcadeLaunchOptions {
  readonly runSeed: number;
  readonly localPlayers: 1 | 2;
  readonly runOrigin: ArcadeRunOrigin;
}

export function isArcadeScoreEligible(
  playMode: "story" | "arcade",
  runOrigin: ArcadeRunOrigin | null,
): boolean {
  return playMode === "arcade" && runOrigin === "player-arcade";
}

export function parseArcadeRunSeed(value: string): number {
  if (value.trim() === "") {
    throw new Error("Arcade run seed must be an integer from 0 to 4294967295.");
  }
  const seed = Number(value);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new Error("Arcade run seed must be an integer from 0 to 4294967295.");
  }
  return seed >>> 0;
}
