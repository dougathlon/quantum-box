import type { GameId } from "../../games/registry";

export interface LibraryEntryView {
  readonly gameId: GameId;
  readonly number: string;
  readonly status: "available" | "story-locked" | "recovered";
}

export const LIBRARY_ORDER: readonly GameId[] = Object.freeze([
  "qong",
  "skipixl",
  "fluxball",
  "quantman",
]);
