import type { GameId } from "../games/registry";
import type { FluxballDesignerEvidence } from "../games/fluxball/types";
import type { QuantmanDesignerEvidence } from "../games/quantman/types";
import type { SkiPixlDesignerEvidence } from "../games/skipixl/types";
import type { SemanticAction } from "../input/InputController";
import type { QongDesignerState } from "./QongDesignerLesson";

export type DesignerEncounterPhase =
  | "approach"
  | "dialogue"
  | "mechanism"
  | "recovered";

export interface DesignerEncounterSnapshot {
  readonly gameId: GameId;
  readonly phase: DesignerEncounterPhase;
  readonly playerX: number;
  readonly dialogueIndex: number;
  readonly mechanismStep: number;
  readonly mechanismValue: number;
  readonly heading: string;
  readonly speaker: string;
  readonly message: string;
  readonly prompt: string;
  readonly completed: boolean;
  readonly qongEvidence: QongDesignerState | null;
  readonly skipixlEvidence: SkiPixlDesignerEvidence | null;
  readonly quantmanEvidence: QuantmanDesignerEvidence | null;
  readonly fluxballEvidence: FluxballDesignerEvidence | null;
}

export interface DesignerEncounterEvidence {
  readonly qong?: QongDesignerState;
  readonly skipixl?: SkiPixlDesignerEvidence;
  readonly quantman?: QuantmanDesignerEvidence;
  readonly fluxball?: FluxballDesignerEvidence;
}

const DESIGNER_X = 470;
const APPROACH_DISTANCE = 92;
const PLAYER_STEP = 52;

const ENCOUNTERS: Readonly<
  Record<
    GameId,
    Readonly<{
      heading: string;
      dialogue: readonly string[];
      mechanismPrompt: string;
      mechanismSteps: number;
      recovered: string;
    }>
  >
> = Object.freeze({
  qong: {
    heading: "RULE STATE",
    dialogue: [
      "WELL DONE. LET ME SHOW YOU SOMETHING. THE CROSSING WAS PHYSICAL; WHAT IT COUNTED AS REMAINED UNRESOLVED UNTIL MEASUREMENT.",
      "ONE RECORDED HARDWARE COIN BECAME ONE BIT. THE BIT DID NOT MOVE THE PADDLE. IT RESOLVED WHICH SCORING LAW CONSTITUTED THE ROUND.",
      "BUILD THAT PATH YOURSELF: OUTCOME, BIT, RULE STATE, ROUND.",
    ],
    mechanismPrompt: "LEFT OPPOSITE · RIGHT OWN · SPACE COMMIT",
    mechanismSteps: 2,
    recovered:
      "RULE STATE RECOVERED. THE COIN IS EVIDENCE; THE RULE MAPPING IS THE GAME.",
  },
  skipixl: {
    heading: "RESIDUAL DESCENT",
    dialogue: [
      "WELL DONE. LET ME SHOW YOU SOMETHING. THE MACHINE DID NOT DRAW THIS MOUNTAIN.",
      "QPIXL RETURNED THREE TWENTY-BY-TWENTY NUMBER FIELDS. A LOCAL DECODER COMPARED EVERY RETURNED CELL WITH THE SUBMITTED IMAGE.",
      "EVERY ABSOLUTE DIFFERENCE ABOVE THE BANK CUT BECOMES A HAZARD. POSITIVE DIFFERENCES BECOME TREES; NEGATIVE DIFFERENCES BECOME MOGULS. SOME ROWS REMAIN OPEN. OTHERS CLOSE.",
    ],
    mechanismPrompt: "LEFT / RIGHT CELL · SPACE COMMIT GRID",
    mechanismSteps: 3,
    recovered:
      "RESIDUAL DESCENT RECOVERED. RETURNED VALUES NOW ALTER THE COURSE, NOT THE CONTROLS.",
  },
  fluxball: {
    heading: "RELATIONAL RULEFIELD",
    dialogue: [
      "BEFORE PLAY, RECORDED QGRAPH RESULTS BECOME HIDDEN MOVE, BALL, AND GOAL RULES.",
      "GLOBAL FLUXBALL HAS ONE SHARED RULE STATE. INDIVIDUAL FLUXBALL GIVES EACH PLAYER DIFFERENT HIDDEN RULES COUPLED THROUGH ONE JOINT QGRAPH STATE.",
      "ONCE PER ROUND, ONE HUMAN MAY CHANGE RULES. THE JOINT STATE ADVANCES AND EVERY INDIVIDUAL RULE CHANGES, BUT THE OLD AND NEW RULES STAY HIDDEN.",
    ],
    mechanismPrompt: "LEFT / RIGHT PLAYER · SPACE RESOLVE RELATION",
    mechanismSteps: 3,
    recovered:
      "RELATIONAL RULEFIELD RECOVERED. CHANGE IS THE TACTICAL MOVE; THE RECORDED DISTRIBUTION REMAINS OFFLINE EVIDENCE.",
  },
  quantman: {
    heading: "CORRELATED MAZE",
    dialogue: [
      "THE PASSAGES ARE NOT TWENTY INDEPENDENT COIN TOSSES.",
      "LABYRINTH RETURNED WHOLE TWENTY-BIT STATES. EQUAL ENDPOINT BITS OPEN A MAPPED DOOR. FACING ONE LOCAL PASSAGE FILTERS THE BANK BEFORE ANOTHER WHOLE STATE IS CHOSEN.",
      "TURN TWICE. WATCH THE PASSAGE IN VIEW HOLD WHILE DISTANT SHORTCUTS MOVE.",
    ],
    mechanismPrompt: "LEFT / RIGHT DOOR · SPACE REPLAY WHOLE-STATE SHIFT",
    mechanismSteps: 2,
    recovered:
      "CORRELATED MAZE RECOVERED. LOCAL OBSERVATION CONSTRAINS A SHARED, CHANGING TOPOLOGY.",
  },
});

export class DesignerEncounter {
  private phase: DesignerEncounterPhase = "approach";
  private playerX = 76;
  private dialogueIndex = 0;
  private mechanismStep = 0;
  private mechanismValue = 0;
  private completed = false;

  public constructor(
    private readonly gameId: GameId,
    private readonly evidence: DesignerEncounterEvidence = {},
  ) {
    if (gameId !== "qong" && evidence.qong) {
      throw new Error("Only Qong can receive Qong Designer evidence.");
    }
    if (gameId !== "skipixl" && evidence.skipixl) {
      throw new Error("Only SkiPixl can receive SkiPixl Designer evidence.");
    }
    if (gameId !== "quantman" && evidence.quantman) {
      throw new Error("Only Quantman can receive Quantman Designer evidence.");
    }
    if (gameId !== "fluxball" && evidence.fluxball) {
      throw new Error("Only Fluxball can receive Fluxball Designer evidence.");
    }
  }

  public dispatch(action: SemanticAction): DesignerEncounterSnapshot {
    if (this.completed) return this.snapshot();
    if (this.phase === "approach") {
      if (action === "p1-right" || action === "p2-right") {
        this.playerX = Math.min(
          DESIGNER_X - APPROACH_DISTANCE,
          this.playerX + PLAYER_STEP,
        );
      } else if (action === "p1-left" || action === "p2-left") {
        this.playerX = Math.max(44, this.playerX - PLAYER_STEP);
      } else if (
        (action === "primary" || action === "start") &&
        this.playerX >= DESIGNER_X - APPROACH_DISTANCE
      ) {
        this.phase = "dialogue";
      }
      return this.snapshot();
    }
    if (this.phase === "dialogue") {
      if (action !== "primary" && action !== "start") return this.snapshot();
      const encounter = ENCOUNTERS[this.gameId];
      if (this.dialogueIndex < encounter.dialogue.length - 1) {
        this.dialogueIndex += 1;
      } else {
        this.phase = "mechanism";
      }
      return this.snapshot();
    }
    if (this.phase === "mechanism") {
      if (action === "p1-left" || action === "p2-left") {
        this.mechanismValue = Math.max(-2, this.mechanismValue - 1);
      } else if (action === "p1-right" || action === "p2-right") {
        this.mechanismValue = Math.min(2, this.mechanismValue + 1);
      } else if (action === "primary" || action === "start") {
        if (
          this.gameId === "qong" &&
          this.mechanismStep === 0 &&
          this.evidence.qong
        ) {
          const selected =
            this.mechanismValue < 0
              ? "direct"
              : this.mechanismValue > 0
                ? "invert"
                : null;
          if (selected !== this.evidence.qong.firstMeasurement.polarity) {
            return this.snapshot();
          }
        }
        this.mechanismStep += 1;
        if (this.mechanismStep >= ENCOUNTERS[this.gameId].mechanismSteps) {
          this.phase = "recovered";
        }
      }
      return this.snapshot();
    }
    if (action === "primary" || action === "start") this.completed = true;
    return this.snapshot();
  }

  public snapshot(): DesignerEncounterSnapshot {
    const encounter = ENCOUNTERS[this.gameId];
    const message =
      this.phase === "approach"
        ? "A FIGURE WAITS BESIDE AN OPEN MACHINE."
        : this.phase === "dialogue"
          ? encounter.dialogue[this.dialogueIndex]!
          : this.phase === "mechanism"
            ? mechanismMessage(
                this.gameId,
                this.mechanismStep,
                this.mechanismValue,
                this.evidence,
              )
            : encounter.recovered;
    const prompt =
      this.phase === "approach"
        ? this.playerX >= DESIGNER_X - APPROACH_DISTANCE
          ? "SPACE · SPEAK"
          : "RIGHT · APPROACH"
        : this.phase === "dialogue"
          ? "SPACE · CONTINUE"
          : this.phase === "mechanism"
            ? encounter.mechanismPrompt
            : "SPACE · RETURN TO WORKSHOP";
    return Object.freeze({
      gameId: this.gameId,
      phase: this.phase,
      playerX: this.playerX,
      dialogueIndex: this.dialogueIndex,
      mechanismStep: this.mechanismStep,
      mechanismValue: this.mechanismValue,
      heading: encounter.heading,
      speaker: this.phase === "approach" ? "" : "THE DESIGNER",
      message,
      prompt,
      completed: this.completed,
      qongEvidence: this.evidence.qong ?? null,
      skipixlEvidence: this.evidence.skipixl ?? null,
      quantmanEvidence: this.evidence.quantman ?? null,
      fluxballEvidence: this.evidence.fluxball ?? null,
    });
  }
}

function mechanismMessage(
  gameId: GameId,
  step: number,
  value: number,
  evidence: DesignerEncounterEvidence,
): string {
  if (gameId === "qong") {
    const qongEvidence = evidence.qong;
    if (!qongEvidence) {
      return "STORED COIN-TOSS QPU EVIDENCE UNAVAILABLE";
    }
    if (step === 0) {
      const first = qongEvidence.firstMeasurement;
      const selected =
        value < 0 ? "OPPOSITE GOAL" : value > 0 ? "OWN GOAL" : null;
      const selectedPolarity =
        value < 0 ? "direct" : value > 0 ? "invert" : null;
      const selection = qongEvidence.provenance.firstRallyPostselection;
      const disclosure = selection
        ? ` · TAIL ${selection.selectedTailRank + 1} SELECTED FROM ${selection.candidatePoolSize} RECORDED CANDIDATES`
        : "";
      return `${first.rallyId.toUpperCase()} · ${first.outcome.toUpperCase()} → BIT ${first.bit} · ${selected ? `${selected} ${selectedPolarity === first.polarity ? "MATCH" : "DOES NOT MATCH"}` : "CHOOSE OPPOSITE OR OWN"}${disclosure}`;
    }
    const selection = qongEvidence.selection;
    return `SELECTOR ${selection.bitIndices[0]}=${selection.bits[0]} · ${selection.bitIndices[1]}=${selection.bits[1]} → PACK ${selection.selectedPackIndex + 1} · ACTIVE PLAY NETWORK NONE`;
  }
  if (gameId === "skipixl") {
    const skipixlEvidence = evidence.skipixl ?? null;
    if (!skipixlEvidence) {
      return `QPIXL GRID ${step + 1}/3 · STORED PROVIDER EVIDENCE UNAVAILABLE`;
    }
    const segmentIndex = Math.min(step, skipixlEvidence.segments.length - 1);
    const sampleIndex = Math.max(0, Math.min(4, value + 2));
    const sample = skipixlEvidence.segments[segmentIndex]?.[sampleIndex];
    if (!sample) return "QPIXL ROW EVIDENCE IS INCOMPLETE";
    const primary = sample.selectedHazards.reduce(
      (strongest, hazard) =>
        !strongest || hazard.absoluteResidual > strongest.absoluteResidual
          ? hazard
          : strongest,
      sample.selectedHazards[0],
    );
    if (!primary) {
      return `GRID ${segmentIndex + 1}/3 · ROW ${sample.localRow + 1} · 0 CELLS REACH BANK CUT ${sample.selectionThreshold.toFixed(3)} · OPEN BAND · LIMIT ${skipixlEvidence.winSeconds}S`;
    }
    const sign = primary.residual >= 0 ? "+" : "";
    const kind = primary.kind === "rock" ? "MOGUL" : "TREE";
    return `GRID ${segmentIndex + 1}/3 · ROW ${sample.localRow + 1} · ${sample.selectedHazards.length} CELLS ≥ CUT ${sample.selectionThreshold.toFixed(3)} · PEAK COL ${primary.column + 1} · Δ ${sign}${primary.residual.toFixed(3)} → ${kind} · LIMIT ${skipixlEvidence.winSeconds}S`;
  }
  if (gameId === "fluxball") {
    const fluxballEvidence = evidence.fluxball;
    if (!fluxballEvidence) {
      return `RELATION ${step + 1}/3 · STORED FLUXBALL CONTROL EVIDENCE UNAVAILABLE`;
    }
    const playerIndex = Math.max(
      0,
      Math.min(fluxballEvidence.activePlayerIds.length - 1, value + 2),
    );
    const playerId = fluxballEvidence.activePlayerIds[playerIndex];
    const axis = fluxballEvidence.axes[Math.min(step, 2)];
    if (!playerId || !axis) return "FLUXBALL RELATION EVIDENCE IS INCOMPLETE";
    return `PLAYER ${playerId} · ${axis.context}/${axis.dimension} · OUTCOME ${axis.outcome} · SIGN ${axis.signs[playerId]} → ${axis.rules[playerId]}`;
  }
  const quantmanEvidence = evidence.quantman;
  if (!quantmanEvidence) {
    return `SHIFT ${step + 1}/2 · STORED LABYRINTH EVIDENCE UNAVAILABLE`;
  }
  const transition = quantmanEvidence.transitions[value + 2];
  if (!transition) return "LABYRINTH TRANSITION EVIDENCE IS INCOMPLETE";
  if (step === 0) {
    const [left, right] = transition.sourceRooms;
    const leftBit = transition.beforeBitstring[left];
    const rightBit = transition.beforeBitstring[right];
    return `${transition.doorId.toUpperCase()} · Q${left}=${leftBit} Q${right}=${rightBit} · ${leftBit === rightBit ? "EQUAL → OPEN" : "DIFFERENT → CLOSED"} · SPACE SHIFT`;
  }
  return `${transition.beforeStateId.toUpperCase()} → ${transition.afterStateId.toUpperCase()} · ${transition.doorId.toUpperCase()} HELD ${transition.afterDoorOpen ? "OPEN" : "CLOSED"} · ${transition.changedDoorIds.length} OTHER PASSAGES CHANGED`;
}
