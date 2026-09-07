import {
  ARCADE_CABINET_DEFINITIONS,
  GAME_DEFINITIONS,
  GAME_IDS,
  type GameId,
} from "../../games/registry";
import type { QuantumBoxSave } from "../../save/types";

export type WorkshopFormulaId = GameId | "quarry";

export interface WorkshopBayView {
  readonly gameId: WorkshopFormulaId;
  readonly number: string;
  readonly title: string;
  readonly engineId: string;
  readonly recovered: boolean;
}

export function workshopBayViews(
  save: QuantumBoxSave,
): readonly WorkshopBayView[] {
  const bayIds: readonly WorkshopFormulaId[] = [...GAME_IDS, "quarry"];
  return Object.freeze(
    bayIds.map((gameId, index) => {
      const game = ARCADE_CABINET_DEFINITIONS[gameId];
      const recovered =
        gameId === "quarry"
          ? save.story.completedStages.includes("quarry")
          : save.story.recoveredFormulae.includes(gameId);
      const formulaTitle =
        gameId === "quarry"
          ? "PURSUIT ECOLOGY"
          : GAME_DEFINITIONS[gameId].formulaTitle;
      return Object.freeze({
        gameId,
        number: String(index + 1).padStart(2, "0"),
        title: recovered ? formulaTitle : game.title,
        engineId: game.engineId,
        recovered,
      });
    }),
  );
}
