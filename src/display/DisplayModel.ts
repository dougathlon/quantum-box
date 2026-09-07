import type { GameId } from "../games/registry";

export type BrownBoxSurface = "title" | "transition" | "internal";

export type BrownBoxView =
  | "library"
  | "story"
  | "arcade"
  | "workshop"
  | "settings"
  | "credits"
  | "formula"
  | "designer"
  | { readonly cabinet: GameId };

export interface DisplayModel {
  readonly surface: BrownBoxSurface;
  readonly view: BrownBoxView;
  readonly announcement: string;
}
