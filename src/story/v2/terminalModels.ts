import type { StoryV2ChapterId } from "./types";

export type StoryTerminalSourceStatus =
  | "recorded-moth-qpu"
  | "recorded-moth-platform-qpu-capture"
  | "recorded-moth-remote-aer"
  | "local-synthetic-control";

export type StoryTerminalEvidenceBinding =
  | "qong-pack-selection"
  | "skipixl-three-pass-receipt"
  | "fluxball-rule-epoch"
  | "quantman-qpu-mode-receipt"
  | "quarry-qpu-schedule-receipt";

export interface StoryTerminalPage {
  readonly id: string;
  readonly chapterId: StoryV2ChapterId;
  readonly heading: "INPUT" | "RETURN" | "GAME MAPPING" | "SOURCE NOTE";
  readonly lines: readonly string[];
  readonly sourceStatus: StoryTerminalSourceStatus;
  readonly evidenceBinding: StoryTerminalEvidenceBinding;
  readonly gameplayAuthority: boolean;
  readonly activePlayNetwork: "none";
}

export interface StoryTerminalModel {
  readonly chapterId: StoryV2ChapterId;
  readonly engineId: "coin-toss-v1" | "qpixl-v1" | "graph-v1" | "labyrinth-v1";
  readonly title: string;
  readonly pages: readonly StoryTerminalPage[];
}

const page = (input: Omit<StoryTerminalPage, "activePlayNetwork">) =>
  Object.freeze({ ...input, activePlayNetwork: "none" as const });

export const STORY_TERMINALS = deepFreeze({
  qong: {
    chapterId: "qong",
    engineId: "coin-toss-v1",
    title: "COIN TOSS / RULE STATE",
    pages: [
      page({
        id: "qong-input",
        chapterId: "qong",
        heading: "INPUT",
        lines: [
          "ASK THE COIN-TOSS ENGINE TO PREPARE AND MEASURE ONE QUBIT.",
          "THE REQUEST DOES NOT DECIDE WHERE THE BALL GOES.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "qong-pack-selection",
        gameplayAuthority: true,
      }),
      page({
        id: "qong-zero",
        chapterId: "qong",
        heading: "INPUT",
        lines: [
          "THE QUBIT BEGINS IN THE DEFINITE STATE 0.",
          "AT THIS POINT, MEASURING IT WOULD ALWAYS RETURN 0.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "qong-pack-selection",
        gameplayAuthority: true,
      }),
      page({
        id: "qong-hadamard",
        chapterId: "qong",
        heading: "INPUT",
        lines: [
          "A HADAMARD GATE CHANGES THAT DEFINITE STATE.",
          "AN IDEAL MEASUREMENT NOW HAS EQUAL CHANCES OF RETURNING 0 OR 1.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "qong-pack-selection",
        gameplayAuthority: true,
      }),
      page({
        id: "qong-measure",
        chapterId: "qong",
        heading: "RETURN",
        lines: [
          "MEASUREMENT PRODUCES ONE CLASSICAL RESULT: 0 OR 1.",
          "IT DOES NOT RETURN BOTH ANSWERS FOR US TO USE AT ONCE.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "qong-pack-selection",
        gameplayAuthority: true,
      }),
      page({
        id: "qong-return",
        chapterId: "qong",
        heading: "RETURN",
        lines: [
          "HERE IS ONE RESULT ACTUALLY RETURNED BY THE STORED HARDWARE RUN.",
          "QUONG USES THAT RECORDED BIT AS A CONSTITUTIVE RULE.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "qong-pack-selection",
        gameplayAuthority: true,
      }),
      page({
        id: "qong-mapping",
        chapterId: "qong",
        heading: "GAME MAPPING",
        lines: [
          "HEADS / 0 MEANS SCORE THROUGH THE OPPOSITE GOAL.",
          "TAILS / 1 MEANS SCORE THROUGH YOUR OWN GOAL.",
          "THE BALL CROSSING IS PHYSICAL. THE BIT DETERMINES WHAT IT COUNTS AS.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "qong-pack-selection",
        gameplayAuthority: true,
      }),
      page({
        id: "qong-play",
        chapterId: "qong",
        heading: "SOURCE NOTE",
        lines: [
          "THE HARDWARE RESULTS WERE ACQUIRED AND STORED BEFORE PLAY.",
          "DURING QUONG, THE RULE REMAINS UNRESOLVED IN THE FICTION UNTIL YOU OBSERVE IT OR A LINE CROSSING FORCES MEASUREMENT.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "qong-pack-selection",
        gameplayAuthority: true,
      }),
    ],
  },
  skipixl: {
    chapterId: "skipixl",
    engineId: "qpixl-v1",
    title: "QPIXL / RESIDUAL DESCENT",
    pages: [
      page({
        id: "skipixl-input",
        chapterId: "skipixl",
        heading: "INPUT",
        lines: [
          "THE RUN SELECTS THREE PRESERVED 20 BY 20 GRAYSCALE INPUT GRIDS.",
          "THE TERMINAL BINDS THE EXACT THREE SOURCE HASHES USED BY THE COURSE.",
        ],
        sourceStatus: "recorded-moth-platform-qpu-capture",
        evidenceBinding: "skipixl-three-pass-receipt",
        gameplayAuthority: true,
      }),
      page({
        id: "skipixl-return",
        chapterId: "skipixl",
        heading: "RETURN",
        lines: [
          "QPIXL RETURNED THREE 20 BY 20 NUMERIC FIELDS FROM THE PRESERVED IBM FEZ CAPTURES.",
          "THE MACHINE DID NOT RETURN A FINISHED SKI SLOPE.",
        ],
        sourceStatus: "recorded-moth-platform-qpu-capture",
        evidenceBinding: "skipixl-three-pass-receipt",
        gameplayAuthority: true,
      }),
      page({
        id: "skipixl-mapping",
        chapterId: "skipixl",
        heading: "GAME MAPPING",
        lines: [
          "A LOCAL DECODER SUBTRACTS EACH SUBMITTED VALUE FROM ITS RETURNED VALUE.",
          "MAGNITUDE SELECTS TERRAIN; SIGN SELECTS TREE OR MOGUL. GATES ARE LOCAL COURSE LOGIC.",
          "ONE SAVED CELL-TO-COURSE-OBJECT TRACE MAKES THAT LOCAL MAPPING CONCRETE.",
        ],
        sourceStatus: "recorded-moth-platform-qpu-capture",
        evidenceBinding: "skipixl-three-pass-receipt",
        gameplayAuthority: true,
      }),
    ],
  },
  fluxball: {
    chapterId: "fluxball",
    engineId: "graph-v1",
    title: "QGRAPH / RELATIONAL RULEFIELD",
    pages: [
      page({
        id: "fluxball-input",
        chapterId: "fluxball",
        heading: "INPUT",
        lines: [
          "THE PRESERVED BANK CONTAINS 40 IDENTIFIED IBM FEZ QGRAPH JOBS.",
          "EACH JOB SUBMITTED A COUPLING MAP AND REQUESTED RELATIONSHIPS BEFORE PLAY.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "fluxball-rule-epoch",
        gameplayAuthority: true,
      }),
      page({
        id: "fluxball-return",
        chapterId: "fluxball",
        heading: "RETURN",
        lines: [
          "MOTH RETURNED JOINT MEASUREMENT COUNTS AND RELATIONSHIP DATA.",
          "THE SAVED PRESENTATION RECEIPT IDENTIFIES THE EXACT RECORD USED FOR THE SHOWN RULE EPOCH.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "fluxball-rule-epoch",
        gameplayAuthority: true,
      }),
      page({
        id: "fluxball-mapping",
        chapterId: "fluxball",
        heading: "GAME MAPPING",
        lines: [
          "THREE ORDERED WEIGHTED DRAWS BECOME MOVE, BALL, AND GOAL RULES.",
          "GLOBAL MODE SHARES ONE TRIPLET. INDIVIDUAL MODE COUPLES DISTINCT PLAYER TRIPLETS.",
          "CHANGE RULES ADVANCES THE FROZEN SCHEDULE; ACTIVE PLAY NEVER CONTACTS MOTH.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "fluxball-rule-epoch",
        gameplayAuthority: true,
      }),
    ],
  },
  quantman: {
    chapterId: "quantman",
    engineId: "labyrinth-v1",
    title: "LABYRINTH / GAZE CONTROL",
    pages: [
      page({
        id: "quantman-input",
        chapterId: "quantman",
        heading: "INPUT",
        lines: [
          "THE DESIGNER SUBMITTED A 10 BY 10 / 100-QUBIT MAZE TARGET TO MOTH LABYRINTH.",
          "THE INPUT DESCRIBED THE PASSAGE RELATIONSHIPS THE HARDWARE WOULD MEASURE.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "quantman-qpu-mode-receipt",
        gameplayAuthority: true,
      }),
      page({
        id: "quantman-return",
        chapterId: "quantman",
        heading: "RETURN",
        lines: [
          "TWO INDEPENDENT IBM FEZ EXECUTIONS EACH RETURNED 4096 MEASURED 100-BIT STATES THROUGH MOTH.",
          "THE INSTALLED BANK PRESERVES EACH DISTRIBUTION AND ITS OWN PROVIDER RECEIPT.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "quantman-qpu-mode-receipt",
        gameplayAuthority: true,
      }),
      page({
        id: "quantman-mapping",
        chapterId: "quantman",
        heading: "GAME MAPPING",
        lines: [
          "THE LOCAL DECODER ADMITS ONLY WHOLE RETURNED STATES THAT PRODUCE A PLAYABLE MAZE.",
          "IT NEVER REPAIRS OR FABRICATES A BIT OR WALL; IT SAMPLES ADMITTED STATES BY THEIR ORIGINAL WEIGHTS.",
          "RETURNED BITS AND PARITY THEN MAP TO PASSAGE STATE.",
          "GAZE EITHER HOLDS OR INVERTS THAT STATE, DEPENDING ON THE MODE YOU CLEARED.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "quantman-qpu-mode-receipt",
        gameplayAuthority: true,
      }),
      page({
        id: "quantman-source",
        chapterId: "quantman",
        heading: "SOURCE NOTE",
        lines: [
          "THE MEASUREMENTS CAME FROM IBM FEZ; THE MAZE DECODER, GAZE RULES, GHOSTS, AND SCORING ARE LOCAL GAME CODE.",
          "ARCADE SELECTS FROM THE ADMISSIBLE HARDWARE CORPUS. STORY CARRIES ONE EXACT FIXTURE THROUGH BOTH GAZE MODES.",
          "ACTIVE PLAY NEVER MAKES A LIVE PROVIDER REQUEST.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "quantman-qpu-mode-receipt",
        gameplayAuthority: true,
      }),
    ],
  },
  quarry: {
    chapterId: "quarry",
    engineId: "graph-v1",
    title: "QGRAPH / PURSUIT ECOLOGY",
    pages: [
      page({
        id: "quarry-input",
        chapterId: "quarry",
        heading: "INPUT",
        lines: [
          "QGRAPH PREPARES AN ORDERED 12-QUBIT DIRECTED-RELATION STATE.",
          "EACH BIT NAMES ONE POSSIBLE HUNTER-TO-QUARRY EDGE AMONG A, B, C, AND D.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "quarry-qpu-schedule-receipt",
        gameplayAuthority: true,
      }),
      page({
        id: "quarry-return",
        chapterId: "quarry",
        heading: "RETURN",
        lines: [
          "MOTH RETURNED A RANKED SET OF MEASURED 12-BIT OUTCOMES FROM IBM FEZ.",
          "QUARRY SAMPLES ONLY THAT FROZEN RETURN; IT DOES NOT CALL THE PROVIDER DURING PLAY.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "quarry-qpu-schedule-receipt",
        gameplayAuthority: true,
      }),
      page({
        id: "quarry-mapping",
        chapterId: "quarry",
        heading: "GAME MAPPING",
        lines: [
          "DIRECTED EDGES DEFINE WHO CAN SCORE ON WHOM FOR EACH 12-SECOND PHASE.",
          "A CATCH SCORES, KNOCKS OUT THE TARGET, AND RETURNS IT WITH GRACE; IT DOES NOT RE-MEASURE.",
          "THE WHOLE PURSUIT ECOLOGY CHANGES ONLY ON SCHEDULE.",
          "THREE 60-SECOND ROUNDS DECIDE THE MATCH BY ROUNDS WON, THEN TOTAL POINTS; AN EXACT TIE IS A DRAW.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "quarry-qpu-schedule-receipt",
        gameplayAuthority: true,
      }),
      page({
        id: "quarry-contrast",
        chapterId: "quarry",
        heading: "SOURCE NOTE",
        lines: [
          "FLUXBALL USES A 40-RETURN QGRAPH BANK; QUARRY USES ITS OWN 24 12-QUBIT RETURNS.",
          "BOTH MAKE A RELATIONAL STATE CHANGE WHAT ONE ACTOR MAY BE TO ANOTHER.",
        ],
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "quarry-qpu-schedule-receipt",
        gameplayAuthority: true,
      }),
    ],
  },
} as const satisfies Readonly<Record<StoryV2ChapterId, StoryTerminalModel>>);

export function storyTerminal(chapterId: StoryV2ChapterId): StoryTerminalModel {
  return STORY_TERMINALS[chapterId];
}

export function storyTerminalPage(pageId: string): StoryTerminalPage {
  for (const terminal of Object.values(STORY_TERMINALS)) {
    const found = terminal.pages.find((candidate) => candidate.id === pageId);
    if (found) return found;
  }
  throw new Error(`Unknown Story terminal page: ${pageId}`);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
