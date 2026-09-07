import type { RunContext } from "../core/run";
import { qualifiesQongStory } from "../games/qong/storyQualification";
import type { QongSnapshot } from "../games/qong/types";
import type { QongDesignerState } from "../story/QongDesignerLesson";
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
  requireSha256,
  requireStoryRunContext,
  type TutorialAdapterBaseInput,
} from "./evidence";

export type QongRuleStation = "direct" | "invert";

export interface QongWorkshopEvidence {
  readonly packId: string;
  readonly result: Readonly<{
    rallyId: string;
    outcome: "heads" | "tails";
    bit: 0 | 1;
    rule: QongRuleStation;
    mothJobId: string;
    hardwareJobId: string;
    backendName: string;
    shots: number;
    heads: number;
    tails: number;
  }>;
  readonly selection: Readonly<{
    bits: readonly [0 | 1, 0 | 1];
    bitIndices: readonly [number, number];
    selectedPackIndex: number;
    selectedPackId: string;
    selectorPackId: string;
  }>;
}

export interface QongWorkshopAdapterInput extends TutorialAdapterBaseInput {
  readonly context: RunContext;
  readonly snapshot: QongSnapshot;
  readonly evidence: QongDesignerState;
}

export type QongWorkshopReading =
  | Readonly<{
      station: "coin-result";
      result: QongWorkshopEvidence["result"];
    }>
  | Readonly<{
      station: "selection";
      selection: QongWorkshopEvidence["selection"];
    }>;

export interface QongWorkshopMechanism {
  readonly inspectedResult: boolean;
  readonly inspectedSelection: boolean;
  readonly selectedRule: QongRuleStation | null;
  readonly mappingCorrect: boolean;
  readonly operationPerformed: boolean;
  readonly lastReading: QongWorkshopReading | null;
}

export const QONG_WORKSHOP_DEFINITION: TutorialWorldDefinition = deepFreeze({
  worldId: "qong-workshop",
  title: "Qong Workshop",
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
    initialRole: "qong-paddle",
    finalRole: "designer-wizard",
    morphSteps: 3,
  },
  interactionZones: [
    { zoneId: "designer", label: "Designer", tiles: [{ row: 1, col: 5 }] },
    {
      zoneId: "coin-result",
      label: "Recorded coin result",
      tiles: [{ row: 3, col: 2 }],
    },
    {
      zoneId: "selection",
      label: "Recorded pack selection",
      tiles: [{ row: 3, col: 8 }],
    },
    {
      zoneId: "direct",
      label: "OPPOSITE GOAL rule station",
      tiles: [{ row: 5, col: 3 }],
    },
    {
      zoneId: "invert",
      label: "OWN GOAL rule station",
      tiles: [{ row: 5, col: 7 }],
    },
  ],
  dialogue: [
    "These stations hold the result that governed your rallies.",
    "Read the recorded coin and selector, then stand on the rule it produced.",
  ],
});

const INITIAL_MECHANISM: QongWorkshopMechanism = deepFreeze({
  inspectedResult: false,
  inspectedSelection: false,
  selectedRule: null,
  mappingCorrect: false,
  operationPerformed: false,
  lastReading: null,
});

export function adaptQongWorkshopEvidence(
  input: QongWorkshopAdapterInput | null,
): TutorialEvidenceGate<QongWorkshopEvidence> {
  return adaptTutorialEvidence(
    "qong-workshop",
    input,
    "VALIDATED MOTH COIN TOSS STORY RUN",
    () => {
      if (input === null) throw new Error("Qong Story evidence is absent.");
      const { context, snapshot, evidence } = input;
      requireStoryRunContext(
        context,
        "qong",
        evidence.selection.selectedPackId,
        evidence.provenance.playPackSha256,
      );
      if (
        context.pack.source !== "moth-api-qpu" ||
        !qualifiesQongStory(snapshot, []) ||
        snapshot.phase !== "complete"
      ) {
        throw new Error(
          "Qong tutorial evidence requires a qualified completed QPU Story run.",
        );
      }
      const receipt = context.packSelection;
      if (
        receipt === null ||
        receipt.selectedPackId !== evidence.selection.selectedPackId ||
        receipt.selectedPackContentSha256 !==
          evidence.provenance.playPackSha256 ||
        receipt.selectorPackId !== evidence.selection.selectorPackId ||
        receipt.selectorContentSha256 !==
          evidence.provenance.selectorPackSha256 ||
        receipt.selectedPackIndex !== evidence.selection.selectedPackIndex ||
        receipt.selectorBitIndices[0] !== evidence.selection.bitIndices[0] ||
        receipt.selectorBitIndices[1] !== evidence.selection.bitIndices[1] ||
        receipt.selectorBits[0] !== evidence.selection.bits[0] ||
        receipt.selectorBits[1] !== evidence.selection.bits[1]
      ) {
        throw new Error(
          "Qong tutorial selector evidence does not match the frozen run receipt.",
        );
      }
      if (
        evidence.provenance.engineId !== "coin-toss-v1" ||
        evidence.rallies.length !== 7
      ) {
        throw new Error("Qong tutorial requires seven Coin Toss results.");
      }
      requireSha256(
        evidence.provenance.engineRecordSha256,
        "Qong engine-record hash",
      );
      requireSha256(
        evidence.provenance.apiSpecificationSha256,
        "Qong API-specification hash",
      );
      requireSha256(
        evidence.provenance.selectorPackSha256,
        "Qong selector-pack hash",
      );
      const result = evidence.firstMeasurement;
      const expectedBit = result.outcome === "heads" ? 0 : 1;
      const expectedRule = result.outcome === "heads" ? "direct" : "invert";
      const firstRally = evidence.rallies[0];
      if (
        !firstRally ||
        firstRally.rallyId !== result.rallyId ||
        firstRally.outcome !== result.outcome ||
        firstRally.bit !== result.bit ||
        firstRally.polarity !== result.polarity ||
        result.bit !== expectedBit ||
        result.polarity !== expectedRule ||
        !Number.isSafeInteger(result.shots) ||
        result.shots <= 0 ||
        result.heads + result.tails !== result.shots
      ) {
        throw new Error("Qong recorded Coin Toss result is inconsistent.");
      }
      requireNonEmptyString(result.rallyId, "Qong rally ID");
      requireNonEmptyString(result.mothJobId, "Qong Moth job ID");
      requireNonEmptyString(result.hardwareJobId, "Qong hardware job ID");
      requireNonEmptyString(result.backendName, "Qong backend name");
      return deepFreeze({
        packId: evidence.selection.selectedPackId,
        result: {
          rallyId: result.rallyId,
          outcome: result.outcome,
          bit: result.bit,
          rule: result.polarity,
          mothJobId: result.mothJobId,
          hardwareJobId: result.hardwareJobId,
          backendName: result.backendName,
          shots: result.shots,
          heads: result.heads,
          tails: result.tails,
        },
        selection: {
          bits: [...evidence.selection.bits] as [0 | 1, 0 | 1],
          bitIndices: [...evidence.selection.bitIndices] as [number, number],
          selectedPackIndex: evidence.selection.selectedPackIndex,
          selectedPackId: evidence.selection.selectedPackId,
          selectorPackId: evidence.selection.selectorPackId,
        },
      });
    },
  );
}

export function createQongWorkshop(
  evidence: TutorialEvidenceGate<QongWorkshopEvidence> = unavailableTutorialEvidence(
    "Qong Workshop requires authenticated Coin Toss run evidence.",
  ),
): SpatialTutorialMachine<QongWorkshopMechanism, QongWorkshopEvidence> {
  const config: SpatialTutorialConfig<
    QongWorkshopMechanism,
    QongWorkshopEvidence
  > = {
    definition: QONG_WORKSHOP_DEFINITION,
    evidence,
    initialMechanism: INITIAL_MECHANISM,
    interact: qongInteraction,
  };
  return new SpatialTutorialMachine(config);
}

export function qongWorkshopCompletionScript(
  expectedRule: QongRuleStation,
): readonly TutorialAction[] {
  const fromSelectionToRule =
    expectedRule === "direct"
      ? [...moveActions("down", 2), ...moveActions("left", 5)]
      : [...moveActions("down", 2), ...moveActions("left", 1)];
  const fromRuleToDesigner =
    expectedRule === "direct"
      ? [...moveActions("right", 2), ...moveActions("up", 4)]
      : [...moveActions("left", 2), ...moveActions("up", 4)];
  return deepFreeze([
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
    ...moveActions("right", 6),
    INTERACT_ACTION,
    ...fromSelectionToRule,
    INTERACT_ACTION,
    ...fromRuleToDesigner,
    INTERACT_ACTION,
  ]);
}

function qongInteraction(
  context: Parameters<
    SpatialTutorialConfig<
      QongWorkshopMechanism,
      QongWorkshopEvidence
    >["interact"]
  >[0],
): TutorialInteractionResult<QongWorkshopMechanism> {
  const evidence = context.evidence.value;
  if (evidence === null) {
    return locked(context.mechanism, context.evidence.reason);
  }
  if (context.zoneId === "coin-result") {
    const mechanism = deepFreeze({
      ...context.mechanism,
      inspectedResult: true,
      lastReading: {
        station: "coin-result" as const,
        result: evidence.result,
      },
    });
    return {
      mechanism,
      nextPhase:
        mechanism.inspectedSelection && context.phase === "spatial-exploration"
          ? "mechanism-interaction"
          : context.phase,
      feedback: `${evidence.result.outcome.toUpperCase()} produced bit ${evidence.result.bit}.`,
      recordVisit: true,
    };
  }
  if (context.zoneId === "selection") {
    const mechanism = deepFreeze({
      ...context.mechanism,
      inspectedSelection: true,
      lastReading: {
        station: "selection" as const,
        selection: evidence.selection,
      },
    });
    return {
      mechanism,
      nextPhase:
        mechanism.inspectedResult && context.phase === "spatial-exploration"
          ? "mechanism-interaction"
          : context.phase,
      feedback: `Bits ${evidence.selection.bits.join("")} selected pack ${evidence.selection.selectedPackIndex + 1}.`,
      recordVisit: true,
    };
  }
  if (context.zoneId === "direct" || context.zoneId === "invert") {
    if (
      context.phase !== "mechanism-interaction" ||
      !context.mechanism.inspectedResult ||
      !context.mechanism.inspectedSelection
    ) {
      return {
        mechanism: context.mechanism,
        nextPhase: context.phase,
        feedback: "Read the coin-result and selection stations first.",
        recordVisit: true,
      };
    }
    const selectedRule: QongRuleStation = context.zoneId;
    const correct = selectedRule === evidence.result.rule;
    const mechanism = deepFreeze({
      ...context.mechanism,
      selectedRule,
      mappingCorrect: correct,
      operationPerformed: correct,
    });
    return {
      mechanism,
      nextPhase: correct
        ? "demonstrated-understanding"
        : "mechanism-interaction",
      feedback: correct
        ? `Correct: ${evidence.result.outcome} / ${evidence.result.bit} maps to ${selectedRule.toUpperCase()}.`
        : `That result maps to ${evidence.result.rule.toUpperCase()}, not ${selectedRule.toUpperCase()}.`,
      recordVisit: true,
    };
  }
  return {
    mechanism: context.mechanism,
    nextPhase: context.phase,
    feedback: "This station does not alter the Qong mapping.",
    recordVisit: false,
  };
}

function locked(
  mechanism: QongWorkshopMechanism,
  reason: string | null,
): TutorialInteractionResult<QongWorkshopMechanism> {
  return {
    mechanism,
    nextPhase: "spatial-exploration",
    feedback: reason ?? "Authenticated Qong run evidence is unavailable.",
    recordVisit: false,
  };
}
