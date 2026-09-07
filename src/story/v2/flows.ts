import { storyTerminal } from "./terminalModels";
import type {
  StoryV2AssetCue,
  StoryV2PresentationBeat,
  StoryV2PresentationFlow,
  StoryV2PresentationFlowId,
} from "./types";

const beat = (
  id: string,
  kind: StoryV2PresentationBeat["kind"],
  lines: readonly string[],
  options: Readonly<{
    speaker?: "THE DESIGNER" | null;
    assetCue?: StoryV2AssetCue | null;
    terminalPageId?: string | null;
  }> = {},
): StoryV2PresentationBeat =>
  Object.freeze({
    id,
    kind,
    speaker: options.speaker ?? null,
    lines: Object.freeze([...lines]),
    assetCue: options.assetCue ?? null,
    terminalPageId: options.terminalPageId ?? null,
    prompt: "SPACE · CONTINUE" as const,
  });

const terminalBeats = (
  chapterId: Parameters<typeof storyTerminal>[0],
): readonly StoryV2PresentationBeat[] =>
  storyTerminal(chapterId).pages.map((terminalPage) =>
    beat(
      `${chapterId}-terminal-${terminalPage.id}`,
      "terminal",
      terminalPage.lines,
      { terminalPageId: terminalPage.id },
    ),
  );

export const STORY_V2_PRESENTATION_FLOWS = deepFreeze({
  "qong-den": {
    id: "qong-den",
    stageId: "qong",
    beats: [
      beat("qong-opponent-paddle-morph", "morph", [], {
        assetCue: "qong-paddle-to-professor",
      }),
      beat("qong-player-paddle-morph", "morph", [], {
        assetCue: "qong-paddle-to-player-c",
      }),
      beat("qong-well-done", "dialogue", ["WELL DONE."], {
        speaker: "THE DESIGNER",
        assetCue: "professor-talk",
      }),
      beat("qong-open-door", "door", [], { assetCue: "professor-open-door" }),
      beat("qong-walk-to-den", "explore", [], {
        assetCue: "professor-idle",
      }),
      beat(
        "qong-den-access",
        "dialogue",
        [
          "I DID NOT BUILD MOTH OR ITS ENGINES.",
          "I WAS GIVEN AN OPAQUE KEY AND ACCESS TO THE MACHINE.",
        ],
        { speaker: "THE DESIGNER", assetCue: "professor-talk" },
      ),
      beat(
        "qong-den-method",
        "dialogue",
        [
          "I SUPPLY AN INPUT. MOTH RETURNS A RESULT.",
          "THEN I WRITE THE LOCAL RULE THAT MAKES THAT RESULT MATTER IN A GAME.",
        ],
        { speaker: "THE DESIGNER", assetCue: "professor-talk" },
      ),
      ...terminalBeats("qong"),
    ],
    completion: {
      kind: "return-to-menu",
      completedStageId: "qong",
      completedChapterId: "qong",
      workshopEngineId: "coin-toss-v1",
    },
  },
  "skipixl-medium-handoff": {
    id: "skipixl-medium-handoff",
    stageId: "skipixl-medium",
    beats: [
      beat("skipixl-medium-designer-waits", "dialogue", ["YOU MADE IT DOWN."], {
        speaker: "THE DESIGNER",
        assetCue: "professor-talk",
      }),
      beat(
        "skipixl-medium-harder-warning",
        "dialogue",
        [
          "WELL DONE. I HAVE A HARDER ONE FOR YOU.",
          "IT MAY NOT HAVE WORKED OUT PARTICULARLY WELL.",
        ],
        { speaker: "THE DESIGNER", assetCue: "professor-talk" },
      ),
    ],
    completion: {
      kind: "launch-stage",
      completedStageId: "skipixl-medium",
      nextStageId: "skipixl",
    },
  },
  "skipixl-cabin": {
    id: "skipixl-cabin",
    stageId: "skipixl",
    beats: [
      beat("skipixl-hard-dismount", "dismount", [], {
        assetCue: "player-c-front-idle",
      }),
      beat("skipixl-hard-cabin-door", "door", [], {
        assetCue: "professor-open-door",
      }),
      beat("skipixl-hard-enter-office", "explore", [], {
        assetCue: "professor-idle",
      }),
      ...terminalBeats("skipixl"),
    ],
    completion: {
      kind: "return-to-menu",
      completedStageId: "skipixl",
      completedChapterId: "skipixl",
      workshopEngineId: "qpixl-v1",
    },
  },
  "fluxball-two-handoff": {
    id: "fluxball-two-handoff",
    stageId: "fluxball-two",
    beats: [
      beat("fluxball-two-field-side", "walk", [], {
        assetCue: "professor-idle",
      }),
      beat(
        "fluxball-two-individual-rules",
        "dialogue",
        [
          "THAT GAME GAVE EVERYBODY ONE GLOBAL RULE SET.",
          "NOW EACH PLAYER CAN HAVE AN INDIVIDUAL HIDDEN RULE SET.",
        ],
        { speaker: "THE DESIGNER", assetCue: "professor-talk" },
      ),
      beat(
        "fluxball-two-change-rules",
        "dialogue",
        [
          "ONCE PER ROUND, CHANGE RULES ADVANCES THE SHARED CONFIGURATION.",
          "NOW FOR THE HARDER VERSION.",
        ],
        { speaker: "THE DESIGNER", assetCue: "professor-talk" },
      ),
    ],
    completion: {
      kind: "launch-stage",
      completedStageId: "fluxball-two",
      nextStageId: "fluxball-four",
    },
  },
  "fluxball-office": {
    id: "fluxball-office",
    stageId: "fluxball-four",
    beats: [
      beat("fluxball-four-designer-ball", "walk", [], {
        assetCue: "professor-walk",
      }),
      beat("fluxball-four-ball-touch", "transport", [], {
        assetCue: "professor-point",
      }),
      beat("fluxball-four-enter-office", "explore", [], {
        assetCue: "professor-idle",
      }),
      ...terminalBeats("fluxball"),
    ],
    completion: {
      kind: "return-to-menu",
      completedStageId: "fluxball-four",
      completedChapterId: "fluxball",
      workshopEngineId: "graph-v1",
    },
  },
  "quantman-stabilize-handoff": {
    id: "quantman-stabilize-handoff",
    stageId: "quantman-stabilize",
    beats: [
      beat(
        "quantman-stabilize-clear",
        "dialogue",
        [
          "SCREEN CLEARED.",
          "YOU HELD THE PASSAGES IN YOUR GAZE. NOW INVERT WHAT THE GAZE DOES.",
        ],
        { speaker: "THE DESIGNER", assetCue: "professor-talk" },
      ),
    ],
    completion: {
      kind: "launch-stage",
      completedStageId: "quantman-stabilize",
      nextStageId: "quantman",
    },
  },
  "quantman-ghost-den": {
    id: "quantman-ghost-den",
    stageId: "quantman",
    beats: [
      beat("quantman-ghost-c-morph", "morph", [], {
        assetCue: "quantman-ghost-c-to-professor",
      }),
      beat("quantman-ghost-den-walk", "explore", [], {
        assetCue: "professor-idle",
      }),
      beat("quantman-ghost-den-office", "door", [], {
        assetCue: "professor-open-door",
      }),
      ...terminalBeats("quantman"),
    ],
    completion: {
      kind: "return-to-menu",
      completedStageId: "quantman",
      completedChapterId: "quantman",
      workshopEngineId: "labyrinth-v1",
    },
  },
  "quarry-finale": {
    id: "quarry-finale",
    stageId: "quarry",
    beats: [
      beat("quarry-duck-d-morph", "morph", [], {
        assetCue: "quarry-duck-d-to-professor",
      }),
      beat("quarry-designer-walk-offscreen", "explore", [], {
        assetCue: "professor-idle",
      }),
      beat("quarry-final-workshop", "door", [], {
        assetCue: "professor-open-door",
      }),
      ...terminalBeats("quarry"),
      beat(
        "quarry-moth-link",
        "terminal",
        [
          "MOTH PLATFORM LINK READY.",
          "OPENING IT IS A SEPARATE USER ACTION. NO KEY OR CREDENTIAL IS STORED HERE.",
        ],
        { terminalPageId: null },
      ),
    ],
    completion: {
      kind: "complete-story",
      completedStageId: "quarry",
      completedChapterId: "quarry",
      workshopEngineId: "graph-v1",
      unlockExternalLinkId: "moth-platform",
    },
  },
} as const satisfies Readonly<
  Record<StoryV2PresentationFlowId, StoryV2PresentationFlow>
>);

export function storyV2PresentationFlow(
  flowId: StoryV2PresentationFlowId,
): StoryV2PresentationFlow {
  return STORY_V2_PRESENTATION_FLOWS[flowId];
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
