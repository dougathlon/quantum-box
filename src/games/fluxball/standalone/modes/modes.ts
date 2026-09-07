export const PLAYER_IDS = ["A", "B", "C", "D"] as const;
export type PlayerId = (typeof PLAYER_IDS)[number];
export type CompetitorCount = 2 | 4;
export type RuleMode = "global" | "individual";

export interface MatchFormat {
  readonly competitorCount: CompetitorCount;
  readonly ruleMode: RuleMode;
}

export interface HumanControllerAssignment {
  readonly kind: "human";
  readonly controllerId: string;
  readonly label: string;
}

export interface ComputerControllerAssignment {
  readonly kind: "computer";
  readonly controllerId: null;
  readonly label: "CPU";
}

export type ControllerAssignment =
  | HumanControllerAssignment
  | ComputerControllerAssignment;

export type ActivePlayerMap<T> = Readonly<Partial<Record<PlayerId, T>>>;

export interface MatchSetup {
  readonly format: MatchFormat;
  readonly activePlayerIds: readonly PlayerId[];
  readonly controllers: ActivePlayerMap<ControllerAssignment>;
}

export interface LobbyController {
  readonly controllerId: string;
  readonly label: string;
}

export interface LobbySnapshot {
  readonly format: MatchFormat;
  readonly activePlayerIds: readonly PlayerId[];
  readonly joinedControllers: ActivePlayerMap<HumanControllerAssignment>;
  readonly canBegin: boolean;
}

export const COMPUTER_CONTROLLER: ComputerControllerAssignment = Object.freeze({
  kind: "computer",
  controllerId: null,
  label: "CPU",
});

export function activePlayerIdsFor(
  competitorCount: CompetitorCount,
): readonly PlayerId[] {
  return competitorCount === 2 ? PLAYER_IDS.slice(0, 2) : PLAYER_IDS;
}

export function isActivePlayer(
  activePlayerIds: readonly PlayerId[],
  playerId: PlayerId,
): boolean {
  return activePlayerIds.includes(playerId);
}

export function playerMapEntries<T>(
  activePlayerIds: readonly PlayerId[],
  values: ActivePlayerMap<T>,
): readonly (readonly [PlayerId, T])[] {
  return activePlayerIds.map((playerId) => {
    const value = values[playerId];
    if (value === undefined) {
      throw new Error(`Missing active Player ${playerId} value.`);
    }
    return [playerId, value] as const;
  });
}

function validateFormat(format: MatchFormat): void {
  if (format.competitorCount !== 2 && format.competitorCount !== 4) {
    throw new Error("Fluxball supports exactly two or four competitors.");
  }
  if (format.ruleMode !== "global" && format.ruleMode !== "individual") {
    throw new Error(`Unknown Fluxball rule mode ${String(format.ruleMode)}.`);
  }
}

export function createMatchSetup(
  format: MatchFormat,
  joinedControllers: ActivePlayerMap<HumanControllerAssignment>,
): MatchSetup {
  validateFormat(format);
  const activePlayerIds = activePlayerIdsFor(format.competitorCount);
  const controllerIds = new Set<string>();
  const controllers: Partial<Record<PlayerId, ControllerAssignment>> = {};
  let humanCount = 0;

  for (const playerId of activePlayerIds) {
    const joined = joinedControllers[playerId];
    if (!joined) {
      controllers[playerId] = COMPUTER_CONTROLLER;
      continue;
    }
    if (!joined.controllerId || !joined.label) {
      throw new Error(`Player ${playerId} has an invalid human controller.`);
    }
    if (controllerIds.has(joined.controllerId)) {
      throw new Error(`Controller ${joined.controllerId} is assigned twice.`);
    }
    controllerIds.add(joined.controllerId);
    controllers[playerId] = Object.freeze({ ...joined });
    humanCount += 1;
  }
  if (humanCount === 0) {
    throw new Error("At least one human controller must join Fluxball.");
  }

  return Object.freeze({
    format: Object.freeze({ ...format }),
    activePlayerIds: Object.freeze([...activePlayerIds]),
    controllers: Object.freeze(controllers),
  });
}

export function controllerForPlayer(
  setup: MatchSetup,
  playerId: PlayerId,
): ControllerAssignment {
  if (!isActivePlayer(setup.activePlayerIds, playerId)) {
    throw new Error(`Player ${playerId} is not active in this match.`);
  }
  const controller = setup.controllers[playerId];
  if (!controller) throw new Error(`Player ${playerId} has no controller.`);
  return controller;
}
