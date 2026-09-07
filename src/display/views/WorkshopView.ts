import { GAME_DEFINITIONS, GAME_IDS, type GameId } from "../../games/registry";
import type { QuantumBoxSave } from "../../save/types";

export interface WorkshopBayView {
  readonly gameId: GameId;
  readonly number: string;
  readonly title: string;
  readonly engineId: string;
  readonly recovered: boolean;
}

export function workshopBayViews(
  save: QuantumBoxSave,
): readonly WorkshopBayView[] {
  return Object.freeze(
    GAME_IDS.map((gameId, index) => {
      const game = GAME_DEFINITIONS[gameId];
      const recovered = save.story.recoveredFormulae.includes(gameId);
      return Object.freeze({
        gameId,
        number: String(index + 1).padStart(2, "0"),
        title: recovered ? game.formulaTitle : game.title,
        engineId: game.engineId,
        recovered,
      });
    }),
  );
}
