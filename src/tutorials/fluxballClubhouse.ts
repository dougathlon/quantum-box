import type { RunContext } from "../core/run";
import type { PlayerId } from "../games/fluxball/standalone/modes";
import type {
  FluxballDesignerAxisEvidence,
  FluxballDesignerEvidence,
  FluxballSnapshot,
} from "../games/fluxball/types";
import {
  CONTINUE_ACTION,
  deepFreeze,
  INTERACT_ACTION,
  moveActions,
  SpatialTutorialMachine,
  unavailableTutorialEvidence,
  type SpatialTutorialConfig,
  type TutorialAction,
  type TutorialEvidenceGate,
  type TutorialInteractionResult,
  type TutorialWorldDefinition,
} from "./contracts";
import {
  adaptTutorialEvidence,
  requireNonEmptyString,
  requireStoryRunContext,
  type TutorialAdapterBaseInput,
} from "./evidence";

export interface FluxballClubhouseEvidence {
  readonly packId: string;
  readonly fixtureId: string;
  readonly players: readonly PlayerId[];
  readonly relationships: readonly FluxballDesignerAxisEvidence[];
}

export interface FluxballClubhouseAdapterInput
  extends TutorialAdapterBaseInput {
  readonly context: RunContext;
  readonly snapshot: FluxballSnapshot;
  readonly evidence: FluxballDesignerEvidence;
}

export interface FluxballRuleResolution {
  readonly relationshipIndex: number;
  readonly context: "X" | "Y" | "Z";
  readonly dimension: "ACTION" | "INTERACTION" | "PURPOSE";
  readonly outcome: string;
  readonly sign: "+" | "-";
  readonly rule: string;
}

export interface FluxballClubhouseMechanism {
  readonly inspectedRelationshipIndexes: readonly number[];
  readonly selectedPlayerId: PlayerId | null;
  readonly resolvedRelationshipIndexes: readonly number[];
  readonly ruleCard: readonly FluxballRuleResolution[];
  readonly lastRelationship: FluxballDesignerAxisEvidence | null;
  readonly operationPerformed: boolean;
}

export const FLUXBALL_CLUBHOUSE_DEFINITION: TutorialWorldDefinition =
  deepFreeze({
    worldId: "fluxball-clubhouse",
    title: "Fluxball Clubhouse",
    collisionRows: [
      "###########",
      "#.........#",
      "#.##...##.#",
      "#.........#",
      "#...#.#...#",
      "#.........#",
      "#.##...##.#",
      "#.........#",
      "###########",
    ],
    playerStart: { row: 7, col: 5 },
    playerRole: "player-candidate-c",
    designer: {
      approachZoneId: "designer",
      initialRole: "fluxball-player-a",
      finalRole: "designer-wizard",
      morphSteps: 3,
    },
    interactionZones: [
      { zoneId: "designer", label: "Designer", tiles: [{ row: 1, col: 5 }] },
      {
        zoneId: "relationship-0",
        label: "Action relation channel",
        tiles: [{ row: 3, col: 2 }],
      },
      {
        zoneId: "relationship-1",
        label: "Interaction relation channel",
        tiles: [{ row: 3, col: 5 }],
      },
      {
        zoneId: "relationship-2",
        label: "Purpose relation channel",
        tiles: [{ row: 3, col: 8 }],
      },
      { zoneId: "player-0", label: "Player A", tiles: [{ row: 5, col: 2 }] },
      { zoneId: "player-1", label: "Player B", tiles: [{ row: 5, col: 4 }] },
      { zoneId: "player-2", label: "Player C", tiles: [{ row: 5, col: 6 }] },
      { zoneId: "player-3", label: "Player D", tiles: [{ row: 5, col: 8 }] },
    ],
    dialogue: [
      "The three rule channels are decoded from joint player outcomes, not private player settings.",
      "Inspect each channel, choose a player, and rebuild that player's rules from the recorded signs.",
    ],
  });

const INITIAL_MECHANISM: FluxballClubhouseMechanism = deepFreeze({
  inspectedRelationshipIndexes: [],
  selectedPlayerId: null,
  resolvedRelationshipIndexes: [],
  ruleCard: [],
  lastRelationship: null,
  operationPerformed: false,
});

export function adaptFluxballClubhouseEvidence(
  input: FluxballClubhouseAdapterInput | null,
): TutorialEvidenceGate<FluxballClubhouseEvidence> {
  return adaptTutorialEvidence(
    "fluxball-clubhouse",
    input,
    "VALIDATED FLUXBALL STORY RUN · OFFLINE QGRAPH RULEFIELD",
    () => {
      if (input === null) throw new Error("Fluxball Story evidence is absent.");
      const { context, snapshot, evidence, origin } = input;
      requireStoryRunContext(
        context,
        "fluxball",
        evidence.packId,
        evidence.contentSha256,
      );
      if (
        snapshot.phase !== "complete" ||
        snapshot.reveal === null ||
        context.pack.source !== evidence.source ||
        evidence.roundNumber !== snapshot.totalRounds ||
        evidence.axes.length !== 3 ||
        evidence.activePlayerIds.length !== 4
      ) {
        throw new Error(
          "Fluxball tutorial requires the completed four-player final-round result.",
        );
      }
      if (origin === "completed-story-run" && !snapshot.humanWon) {
        throw new Error(
          "Fluxball Story progress requires a completed human-winning run.",
        );
      }
      requireNonEmptyString(evidence.fixtureBankId, "Fluxball fixture-bank ID");
      requireNonEmptyString(evidence.fixtureId, "Fluxball fixture ID");
      const reveal = snapshot.reveal;
      if (
        reveal.roundNumber !== evidence.roundNumber ||
        reveal.trace.fixtureBankId !== evidence.fixtureBankId ||
        reveal.trace.fixtureId !== evidence.fixtureId ||
        reveal.trace.acquisitionSource !== evidence.acquisitionSource ||
        reveal.trace.shotsPerCircuit !== evidence.shotsPerCircuit ||
        reveal.trace.activePlayerIds.join(":") !==
          evidence.activePlayerIds.join(":")
      ) {
        throw new Error(
          "Fluxball tutorial evidence does not match the completed final-round result.",
        );
      }
      if (
        !Number.isSafeInteger(evidence.shotsPerCircuit) ||
        evidence.shotsPerCircuit <= 0
      ) {
        throw new Error("Fluxball shot evidence is invalid.");
      }
      const expected = [
        ["X", "ACTION"],
        ["Y", "INTERACTION"],
        ["Z", "PURPOSE"],
      ] as const;
      evidence.axes.forEach((axis, index) => {
        const identity = expected[index];
        if (
          !identity ||
          axis.context !== identity[0] ||
          axis.dimension !== identity[1] ||
          axis.outcome !== reveal.trace.axes[axis.context].outcome ||
          axis.drawIndex !== reveal.trace.axes[axis.context].drawIndex
        ) {
          throw new Error(
            "Fluxball rule channels are incomplete or reordered.",
          );
        }
        requireNonEmptyString(axis.outcome, `Fluxball ${axis.context} outcome`);
        for (const playerId of evidence.activePlayerIds) {
          const sign = axis.signs[playerId];
          const rule = axis.rules[playerId];
          const revealAxis = reveal.trace.axes[axis.context];
          const playerRules = reveal.rules.players[playerId];
          const revealedRule =
            axis.dimension === "ACTION"
              ? playerRules?.action
              : axis.dimension === "INTERACTION"
                ? playerRules?.interaction
                : playerRules?.purpose;
          if (
            (sign !== "+" && sign !== "-") ||
            sign !== revealAxis.signs[playerId] ||
            !rule ||
            rule !== revealedRule
          ) {
            throw new Error(
              `Fluxball ${axis.context} evidence is missing Player ${playerId}.`,
            );
          }
        }
      });
      return deepFreeze({
        packId: evidence.packId,
        fixtureId: evidence.fixtureId,
        players: [...evidence.activePlayerIds],
        relationships: [...evidence.axes],
      });
    },
  );
}

export function createFluxballClubhouse(
  evidence: TutorialEvidenceGate<FluxballClubhouseEvidence> = unavailableTutorialEvidence(
    "Fluxball Clubhouse requires a completed final-round QGraph result.",
  ),
): SpatialTutorialMachine<
  FluxballClubhouseMechanism,
  FluxballClubhouseEvidence
> {
  return new SpatialTutorialMachine({
    definition: FLUXBALL_CLUBHOUSE_DEFINITION,
    evidence,
    initialMechanism: INITIAL_MECHANISM,
    interact: fluxballInteraction,
  });
}

export const FLUXBALL_CLUBHOUSE_COMPLETION_SCRIPT: readonly TutorialAction[] =
  deepFreeze([
    ...moveActions("up", 6),
    INTERACT_ACTION,
    CONTINUE_ACTION,
    CONTINUE_ACTION,
    CONTINUE_ACTION,
    CONTINUE_ACTION,
    CONTINUE_ACTION,
    ...moveActions("down", 2),
    ...moveActions("left", 3),
    INTERACT_ACTION,
    ...moveActions("right", 3),
    INTERACT_ACTION,
    ...moveActions("right", 3),
    INTERACT_ACTION,
    ...moveActions("down", 2),
    ...moveActions("left", 6),
    INTERACT_ACTION,
    ...moveActions("up", 2),
    INTERACT_ACTION,
    ...moveActions("right", 3),
    INTERACT_ACTION,
    ...moveActions("right", 3),
    INTERACT_ACTION,
    ...moveActions("left", 3),
    ...moveActions("up", 2),
    INTERACT_ACTION,
  ]);

function fluxballInteraction(
  context: Parameters<
    SpatialTutorialConfig<
      FluxballClubhouseMechanism,
      FluxballClubhouseEvidence
    >["interact"]
  >[0],
): TutorialInteractionResult<FluxballClubhouseMechanism> {
  const evidence = context.evidence.value;
  if (evidence === null) {
    return unchanged(
      context,
      context.evidence.reason ?? "Fluxball run evidence is unavailable.",
    );
  }
  const relationshipIndex = zoneIndex(context.zoneId, "relationship-");
  if (relationshipIndex !== null) {
    const relationship = evidence.relationships[relationshipIndex];
    if (!relationship) {
      return unchanged(context, "That QGraph relationship is absent.");
    }
    if (
      context.phase === "spatial-exploration" ||
      context.mechanism.selectedPlayerId === null
    ) {
      const inspected = addIndex(
        context.mechanism.inspectedRelationshipIndexes,
        relationshipIndex,
      );
      return {
        mechanism: deepFreeze({
          ...context.mechanism,
          inspectedRelationshipIndexes: inspected,
          lastRelationship: relationship,
        }),
        nextPhase: context.phase,
        feedback: `${relationship.context}/${relationship.dimension}: outcome ${relationship.outcome}.`,
        recordVisit: true,
      };
    }
    const playerId = context.mechanism.selectedPlayerId;
    const sign = relationship.signs[playerId];
    const rule = relationship.rules[playerId];
    if (!sign || !rule) {
      return unchanged(
        context,
        `The recorded relationship has no rule for Player ${playerId}.`,
      );
    }
    const resolved = addIndex(
      context.mechanism.resolvedRelationshipIndexes,
      relationshipIndex,
    );
    const ruleCard = context.mechanism.ruleCard.some(
      (entry) => entry.relationshipIndex === relationshipIndex,
    )
      ? context.mechanism.ruleCard
      : [
          ...context.mechanism.ruleCard,
          deepFreeze({
            relationshipIndex,
            context: relationship.context,
            dimension: relationship.dimension,
            outcome: relationship.outcome,
            sign,
            rule,
          }),
        ];
    const mechanism = deepFreeze({
      ...context.mechanism,
      resolvedRelationshipIndexes: resolved,
      ruleCard,
      lastRelationship: relationship,
      operationPerformed: resolved.length === 3,
    });
    return {
      mechanism,
      nextPhase:
        resolved.length === 3
          ? "demonstrated-understanding"
          : "mechanism-interaction",
      feedback: `Player ${playerId}: ${relationship.context} sign ${sign} produces ${rule}.`,
      recordVisit: true,
    };
  }
  const playerIndex = zoneIndex(context.zoneId, "player-");
  if (playerIndex !== null) {
    const playerId = evidence.players[playerIndex];
    if (!playerId) return unchanged(context, "That player is not in this run.");
    if (context.mechanism.inspectedRelationshipIndexes.length !== 3) {
      return unchanged(context, "Inspect all three rule channels first.");
    }
    return {
      mechanism: deepFreeze({
        ...context.mechanism,
        selectedPlayerId: playerId,
      }),
      nextPhase: "mechanism-interaction",
      feedback: `Player ${playerId} selected. Revisit X, Y, and Z to build the rule card.`,
      recordVisit: true,
    };
  }
  return unchanged(context, "This clubhouse station has no QGraph operation.");
}

function unchanged(
  context: Parameters<
    SpatialTutorialConfig<
      FluxballClubhouseMechanism,
      FluxballClubhouseEvidence
    >["interact"]
  >[0],
  feedback: string,
): TutorialInteractionResult<FluxballClubhouseMechanism> {
  return {
    mechanism: context.mechanism,
    nextPhase: context.phase,
    feedback,
    recordVisit: false,
  };
}

function addIndex(values: readonly number[], value: number): readonly number[] {
  return values.includes(value)
    ? values
    : Object.freeze([...values, value].sort((left, right) => left - right));
}

function zoneIndex(zoneId: string, prefix: string): number | null {
  if (!zoneId.startsWith(prefix)) return null;
  const value = Number(zoneId.slice(prefix.length));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
