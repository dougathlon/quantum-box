import type { StoryChapterId, StoryStageId } from "../../games/registry";
import type {
  StoryNode,
  StoryOutcome,
  StoryTerminalActionId,
  StoryTerminalPage,
} from "./types";

const action = (
  id: StoryTerminalActionId,
  label: "CONTINUE" | "PLAY" | "RETRY",
) => Object.freeze({ id, label });

const page = (
  id: string,
  chapterId: StoryTerminalPage["chapterId"],
  header: readonly string[],
  body: readonly string[],
  actions: StoryTerminalPage["actions"],
): StoryTerminalPage =>
  Object.freeze({
    id,
    chapterId,
    header: Object.freeze([...header]),
    body: Object.freeze([...body]),
    actions: Object.freeze([...actions]),
  });

const CONTINUE = Object.freeze([action("continue", "CONTINUE")]);
const PLAY = Object.freeze([action("play", "PLAY")]);
const RETRY = Object.freeze([action("retry", "RETRY")]);
const RETRY_OR_CONTINUE = Object.freeze([
  action("retry", "RETRY"),
  action("continue", "CONTINUE"),
]);

const PAGES = [
  page(
    "intro-1",
    "intro",
    [
      "QUANTUM BOX",
      "DEMONSTRATION PROGRAM",
      "QBOX> RUN DEMO",
      "5 PROGRAMS FOUND",
      "DEMO SEQUENCE LOADED",
    ],
    [
      "WELCOME TO QUANTUM BOX.",
      "INSIDE, YOU WILL FIND\nTHE FUTURE OF ENTERTAINMENT.",
      "FIVE GAMES.\nFIVE EXPERIMENTS\nWITH QUANTUM COMPUTING.",
    ],
    CONTINUE,
  ),
  page(
    "intro-2",
    "intro",
    ["QUANTUM BOX", "DEMONSTRATION PROGRAM"],
    [
      "QUANTUM COMPUTERS HAVE BEEN\nBUILT FOR SERIOUS WORK.",
      "SCIENCE.\nINDUSTRY.\nSIMULATION.\nOPTIMIZATION.",
      "IT MIGHT SEEM SILLY\nTO USE ALL THAT COMPUTING POWER\nTO PLAY A GAME.",
    ],
    CONTINUE,
  ),
  page(
    "intro-3",
    "intro",
    ["QUANTUM BOX", "DEMONSTRATION PROGRAM"],
    [
      "BUT VIDEO GAMES HELPED\nMAKE CLASSICAL COMPUTING\nPERSONAL.",
      "IT'S TIME FOR QUANTUM TO HAVE\nITS MAGNAVOX ODYSSEY MOMENT.",
    ],
    CONTINUE,
  ),
  page(
    "qong-intro",
    "qong",
    [
      "QUANTUM BOX",
      "PROGRAM 01 / QONG",
      "QBOX> LOAD COIN-TOSS-V1",
      "ENGINE ................. COIN TOSS",
      "RESULT BANK ............ LOADED",
      "PROGRAM ................ READY",
    ],
    [
      "LET'S START WITH SOMETHING\nEVERYONE KNOWS.",
      "PONG HAS A BALL,\nTWO PADDLES,\nAND TWO GOALS.",
      "I'VE CHANGED ONE THING\n(OTHER THAN THE FIRST LETTER).",
      "THE QUANTUM COMPUTER DECIDES\nWHAT A GOAL MEANS.",
    ],
    CONTINUE,
  ),
  page(
    "qong-tutorial",
    "qong",
    ["QUANTUM BOX", "PROGRAM 01 / TUTORIAL"],
    [
      "EACH ROUND USES ONE\nOF TWO RULES.",
      "OPPOSITE:\nSCORE THROUGH THE OTHER GOAL.",
      "OWN:\nSCORE THROUGH YOUR OWN GOAL.",
      "THE RULE BEGINS UNRESOLVED.",
      "PRESS SPACE / A TO OBSERVE THE RULE.",
      "YOU GET THREE OBSERVATIONS\nACROSS SEVEN ROUNDS.",
      "OTHERWISE, YOU'LL HAVE TO WAIT FOR\nA GOAL TO FIND OUT WHO SCORED.",
    ],
    PLAY,
  ),
  page(
    "qong-loss-first",
    "qong",
    ["QUANTUM BOX", "PROGRAM 01 / QONG"],
    [
      "TRY THAT AGAIN.",
      "OPPOSITE:\nSCORE THROUGH THE OTHER GOAL.",
      "OWN:\nSCORE THROUGH YOUR OWN GOAL.",
      "PRESS SPACE / A TO OBSERVE THE RULE.",
      "THREE OBSERVATIONS\nACROSS SEVEN ROUNDS.",
    ],
    RETRY,
  ),
  page(
    "qong-loss-later",
    "qong",
    ["QUANTUM BOX", "PROGRAM 01 / QONG"],
    ["ALRIGHT, YOU GET THE IDEA."],
    RETRY_OR_CONTINUE,
  ),
  page(
    "qong-success",
    "qong",
    ["QUANTUM BOX", "PROGRAM 01 / QONG"],
    ["WELL DONE."],
    CONTINUE,
  ),
  page(
    "qong-debrief-1",
    "qong",
    ["QUANTUM BOX", "PROGRAM 01 / QONG"],
    [
      "THE BALL CAN CROSS A LINE\nBEFORE YOU KNOW\nWHAT THAT CROSSING MEANS.",
      "TWO POSSIBLE OUTCOMES.\nEACH EQUALLY LIKELY.",
      "ONLY WHEN THE QUBIT\nIS MEASURED\nDO YOU FIND OUT\nWHAT HAPPENED.",
      "THINK WHAT YOU COULD DO\nWITH THAT.",
    ],
    CONTINUE,
  ),
  page(
    "qong-debrief-2",
    "qong",
    ["QUANTUM BOX", "PROGRAM 01 / QONG"],
    [
      "YES, I KNOW.",
      "IT SOUNDS JUST LIKE\nA COIN TOSS.",
      "BUT THIS IS TRUE RANDOMNESS!\nQRNG™ (QUANTUM RANDOM NUMBER GENERATION)!",
      "BESIDES,\nI HAVE SOME MORE THINGS\nTO SHOW YOU.",
    ],
    CONTINUE,
  ),
  page(
    "load-skipixl",
    "skipixl",
    ["QBOX> LOAD PROGRAM 02"],
    ["SKIPIXL ................. LOADING"],
    CONTINUE,
  ),
  page(
    "skipixl-intro",
    "skipixl",
    [
      "QUANTUM BOX",
      "PROGRAM 02 / SKIPIXL",
      "QBOX> LOAD QPIXL-V1",
      "ENGINE ................. QPIXL",
      "RESULT FIELD ........... LOADED",
      "PROGRAM ................ READY",
    ],
    [
      "ONE QUANTUM RESULT\nCAN DECIDE AN OUTCOME.",
      "BUT WHY STOP THERE?",
      "THE QPIXL ENGINE RETURNS\nA WHOLE FIELD OF VALUES.",
      "ENOUGH TO BUILD\nTHE WORLD YOU CAN PLAY IN.",
      "SO I MADE A SKI SLOPE.",
    ],
    CONTINUE,
  ),
  page(
    "skipixl-feasible-tutorial",
    "skipixl",
    ["QUANTUM BOX", "PROGRAM 02 / TUTORIAL"],
    [
      "GET TO THE BOTTOM\nBEFORE THE TIMER RUNS OUT.",
      "PASS THROUGH THE GATES.",
      "LEFT / RIGHT:\nTURN.",
      "DOWN:\nGO FASTER.",
      "YOU HAVE 60 SECONDS.",
    ],
    PLAY,
  ),
  page(
    "skipixl-feasible-response",
    "skipixl",
    ["QUANTUM BOX", "PROGRAM 02 / SKIPIXL"],
    [
      "HERE'S WHAT YOU JUST PLAYED.",
      "I STARTED WITH\nA GRID OF PIXEL VALUES.",
      "QPIXL PROCESSED THE GRID\nAND RETURNED A NEW FIELD.",
      "WHERE THE RETURNED VALUES\nDIFFERED MOST FROM THE ORIGINAL,\nI PUT SOMETHING IN YOUR WAY.",
      "TREES.\nMOGULS.\nGATES.",
      "I CALL IT QTG™!\n(QUANTUM TERRAIN GENERATION)",
    ],
    CONTINUE,
  ),
  page(
    "skipixl-overloaded-intro",
    "skipixl",
    ["QUANTUM BOX", "PROGRAM 02 / SKIPIXL"],
    [
      "THAT WAS THE SENSIBLE VERSION.",
      "THEN I WONDERED\nWHAT WOULD HAPPEN\nIF I USED MORE OF THE FIELD.",
      "QUITE A LOT MORE.",
    ],
    CONTINUE,
  ),
  page(
    "skipixl-overloaded-tutorial",
    "skipixl",
    ["QUANTUM BOX", "PROGRAM 02 / TUTORIAL"],
    [
      "SAME RULES.",
      "GET TO THE BOTTOM.",
      "PASS THROUGH THE GATES.",
      "LEFT / RIGHT:\nTURN.",
      "DOWN:\nGO FASTER.",
      "60 SECONDS.",
    ],
    PLAY,
  ),
  page(
    "skipixl-overloaded-success",
    "skipixl",
    ["QUANTUM BOX", "PROGRAM 02 / SKIPIXL"],
    ["YOU ACTUALLY MADE IT.", "I'M IMPRESSED.", "WAS IT... ENJOYABLE?"],
    CONTINUE,
  ),
  page(
    "skipixl-overloaded-failure",
    "skipixl",
    ["QUANTUM BOX", "PROGRAM 02 / SKIPIXL"],
    ["SORRY.", "I MAY HAVE PUSHED\nTHAT ONE\nA LITTLE TOO FAR."],
    CONTINUE,
  ),
  page(
    "skipixl-debrief-1",
    "skipixl",
    ["QUANTUM BOX", "PROGRAM 02 / SKIPIXL"],
    [
      "OBVIOUSLY,\nTHIS IS JUST AN EXPERIMENT.",
      "I DON'T ACTUALLY THINK\nTHE BEST USE OF QPIXL\nIS FILLING A SKI SLOPE\nWITH TREES.",
      "IT'S MUCH BETTER\nWITH IMAGES.",
    ],
    CONTINUE,
  ),
  page(
    "skipixl-debrief-2",
    "skipixl",
    ["QUANTUM BOX", "PROGRAM 02 / SKIPIXL"],
    [
      "IN FACT,\nTHE BACKGROUND YOU'VE BEEN\nLOOKING AT THIS WHOLE TIME\nIS BUILT FROM QPIXL DATA.",
      "YOU CAN SEE MORE\nIN SETTINGS.",
      "THEY’RE RATHER IMPRESSIVE.",
      "RIGHT?",
    ],
    CONTINUE,
  ),
  page(
    "load-quantman",
    "quantman",
    ["QBOX> LOAD PROGRAM 03"],
    ["QUANTMAN ............... LOADING"],
    CONTINUE,
  ),
  page(
    "quantman-intro",
    "quantman",
    [
      "QUANTUM BOX",
      "PROGRAM 03 / QUANTMAN",
      "QBOX> LOAD LABYRINTH-V1",
      "ENGINE ................. LABYRINTH",
      "MAZE BANK .............. LOADED",
      "PROGRAM ................ READY",
    ],
    [
      "WITH SKIPIXL,\nI USED QUANTUM DATA\nTO BUILD A SURPRISING WORLD.",
      "BUT ONCE A LEVEL IS BUILT,\nIT STAYS THE SAME.",
      "IN QUANTMAN,\nTHE MAZE CHANGES\nWHILE YOU'RE INSIDE IT.",
    ],
    CONTINUE,
  ),
  page(
    "quantman-tutorial",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / TUTORIAL"],
    [
      "CLEAR THE MAZE.",
      "EAT THE DOTS.\nAVOID THE GHOSTS.",
      "WHAT YOU FACE\nSTAYS AS IT IS.",
      "LOOK AWAY\nAND IT MIGHT NOT STAY.",
      "USE YOUR GAZE\nTO HOLD A ROUTE OPEN\nOR KEEP A WALL CLOSED.",
    ],
    PLAY,
  ),
  page(
    "quantman-loss-first",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    [
      "TRY IT AGAIN.",
      "DON'T JUST REMEMBER\nTHE MAZE.",
      "MANAGE IT\nWITH YOUR GAZE.",
    ],
    RETRY,
  ),
  page(
    "quantman-loss-later",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    ["ALRIGHT.", "I THINK YOU GET THE IDEA."],
    RETRY_OR_CONTINUE,
  ),
  page(
    "quantman-success",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    ["WELL DONE.", "THAT WASN'T SO HARD,\nNOW WAS IT?"],
    CONTINUE,
  ),
  page(
    "quantman-explain-1",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    [
      "THERE WASN'T ONE\nTRUE MAZE\nHIDDEN UNDERNEATH.",
      "A MAZE IS REALLY\nA PATTERN OF CONNECTIONS.",
      "THIS ROOM LEADS\nTO THAT ONE.",
      "THIS ONE DOESN'T.",
      "CHANGE THE CONNECTIONS\nAND YOU CHANGE THE MAZE.",
    ],
    CONTINUE,
  ),
  page(
    "quantman-explain-2",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    [
      "IN QUANTMAN,\nEACH ROOM CORRESPONDS\nTO A QUBIT.",
      "MEASURE THEM TOGETHER\nAND EACH ROOM GETS\nA 0 OR 1.",
      "MATCHING NEIGHBOURS:\nPASSAGE.",
      "DIFFERENT NEIGHBOURS:\nWALL.",
      "EACH MEASURED PATTERN\nGIVES A COMPLETE\nMAZE CONFIGURATION.",
    ],
    CONTINUE,
  ),
  page(
    "quantman-explain-3",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    [
      "DURING PLAY,\nTHE GAME KEEPS MOVING\nAMONG THOSE CONFIGURATIONS.",
      "YOUR GAZE SETS\nA CONDITION:",
      "WHATEVER COMES NEXT,\nWHAT YOU'RE LOOKING AT\nHAS TO STAY THE SAME.",
    ],
    CONTINUE,
  ),
  page(
    "quantman-explain-4",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    [
      "FOCUSING ON SOMETHING\nDOESN'T JUST REVEAL\nPART OF THE WORLD.",
      "IT HELPS RESOLVE",
      "WHICH WORLD",
      "YOU HAVE TO INHABIT.",
      "TALK ABOUT\nA GAME OF LIFE!",
    ],
    CONTINUE,
  ),
  page(
    "quantman-explain-5",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    [
      "MAYBE QUANTUM COMPUTING\nDOESN'T JUST GIVE US\nNEW THINGS TO PLAY WITH.",
      "MAYBE IT GIVES US\nNEW ROLES TO PLAY.",
      "IN QUANTMAN,\nYOU PLAY THE OBSERVER.",
      "QRP™!",
      "QUANTUM ROLEPLAY.",
      "I THINK WE CAN DO\nMORE WITH THAT.",
    ],
    CONTINUE,
  ),
  page(
    "load-fluxball",
    "fluxball",
    ["QBOX> LOAD PROGRAM 04"],
    ["FLUXBALL ................ LOADING"],
    CONTINUE,
  ),
  page(
    "fluxball-global-pre",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["PLACEHOLDER"],
    PLAY,
  ),
  page(
    "fluxball-global-post-win",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["PLACEHOLDER"],
    CONTINUE,
  ),
  page(
    "fluxball-global-post-loss",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["PLACEHOLDER"],
    RETRY_OR_CONTINUE,
  ),
  page(
    "fluxball-individual-pre",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["PLACEHOLDER"],
    PLAY,
  ),
  page(
    "fluxball-individual-post-win",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["PLACEHOLDER"],
    CONTINUE,
  ),
  page(
    "fluxball-individual-post-loss",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["PLACEHOLDER"],
    RETRY_OR_CONTINUE,
  ),
  page(
    "quarry-pre",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / QUARRY"],
    ["PLACEHOLDER"],
    PLAY,
  ),
  page(
    "quarry-post-win",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / QUARRY"],
    ["PLACEHOLDER"],
    CONTINUE,
  ),
  page(
    "quarry-post-loss",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / QUARRY"],
    ["PLACEHOLDER"],
    RETRY_OR_CONTINUE,
  ),
] as const;

export const STORY_TERMINAL_PAGES: Readonly<Record<string, StoryTerminalPage>> =
  Object.freeze(
    Object.fromEntries(PAGES.map((candidate) => [candidate.id, candidate])),
  );

const terminal = (
  id: string,
  pageId: string,
  transitions: Readonly<Partial<Record<StoryTerminalActionId, string>>>,
  kind:
    | "terminal-page"
    | "loading-transition"
    | "placeholder" = "terminal-page",
): StoryNode =>
  Object.freeze({
    id,
    kind,
    pageId,
    transitions: Object.freeze({ ...transitions }),
  });
const game = (stageId: StoryStageId, outcomeNodeId: string): StoryNode =>
  Object.freeze({
    id: `game-${stageId}`,
    kind: "game-launch",
    stageId,
    outcomeNodeId,
  });
const outcome = (
  stageId: StoryStageId,
  branches: Extract<StoryNode, { kind: "outcome-branch" }>["branches"],
): StoryNode =>
  Object.freeze({
    id: `outcome-${stageId}`,
    kind: "outcome-branch",
    stageId,
    branches: Object.freeze({ ...branches }),
  });

const NODES: readonly StoryNode[] = Object.freeze([
  terminal("intro-1", "intro-1", { continue: "intro-2" }),
  terminal("intro-2", "intro-2", { continue: "intro-3" }),
  terminal("intro-3", "intro-3", { continue: "qong-intro" }),
  terminal("qong-intro", "qong-intro", { continue: "qong-tutorial" }),
  terminal("qong-tutorial", "qong-tutorial", { play: "game-qong" }),
  game("qong", "outcome-qong"),
  outcome("qong", {
    won: "qong-success",
    lost: "qong-loss-later",
    firstLoss: "qong-loss-first",
  }),
  terminal("qong-loss-first", "qong-loss-first", { retry: "game-qong" }),
  terminal("qong-loss-later", "qong-loss-later", {
    retry: "game-qong",
    continue: "qong-debrief-1",
  }),
  terminal("qong-success", "qong-success", { continue: "qong-debrief-1" }),
  terminal("qong-debrief-1", "qong-debrief-1", { continue: "qong-debrief-2" }),
  terminal("qong-debrief-2", "qong-debrief-2", { continue: "load-skipixl" }),
  terminal(
    "load-skipixl",
    "load-skipixl",
    { continue: "skipixl-intro" },
    "loading-transition",
  ),
  terminal("skipixl-intro", "skipixl-intro", {
    continue: "skipixl-feasible-tutorial",
  }),
  terminal("skipixl-feasible-tutorial", "skipixl-feasible-tutorial", {
    play: "game-skipixl-feasible",
  }),
  game("skipixl-feasible", "outcome-skipixl-feasible"),
  outcome("skipixl-feasible", {
    won: "skipixl-feasible-response",
    lost: "skipixl-feasible-response",
  }),
  terminal("skipixl-feasible-response", "skipixl-feasible-response", {
    continue: "skipixl-overloaded-intro",
  }),
  terminal("skipixl-overloaded-intro", "skipixl-overloaded-intro", {
    continue: "skipixl-overloaded-tutorial",
  }),
  terminal("skipixl-overloaded-tutorial", "skipixl-overloaded-tutorial", {
    play: "game-skipixl-overloaded",
  }),
  game("skipixl-overloaded", "outcome-skipixl-overloaded"),
  outcome("skipixl-overloaded", {
    won: "skipixl-overloaded-success",
    lost: "skipixl-overloaded-failure",
  }),
  terminal("skipixl-overloaded-success", "skipixl-overloaded-success", {
    continue: "skipixl-debrief-1",
  }),
  terminal("skipixl-overloaded-failure", "skipixl-overloaded-failure", {
    continue: "skipixl-debrief-1",
  }),
  terminal("skipixl-debrief-1", "skipixl-debrief-1", {
    continue: "skipixl-debrief-2",
  }),
  terminal("skipixl-debrief-2", "skipixl-debrief-2", {
    continue: "load-quantman",
  }),
  terminal(
    "load-quantman",
    "load-quantman",
    { continue: "quantman-intro" },
    "loading-transition",
  ),
  terminal("quantman-intro", "quantman-intro", {
    continue: "quantman-tutorial",
  }),
  terminal("quantman-tutorial", "quantman-tutorial", {
    play: "game-quantman-hold",
  }),
  game("quantman-hold", "outcome-quantman-hold"),
  outcome("quantman-hold", {
    won: "quantman-success",
    lost: "quantman-loss-later",
    firstLoss: "quantman-loss-first",
  }),
  terminal("quantman-loss-first", "quantman-loss-first", {
    retry: "game-quantman-hold",
  }),
  terminal("quantman-loss-later", "quantman-loss-later", {
    retry: "game-quantman-hold",
    continue: "quantman-explain-1",
  }),
  terminal("quantman-success", "quantman-success", {
    continue: "quantman-explain-1",
  }),
  terminal("quantman-explain-1", "quantman-explain-1", {
    continue: "quantman-explain-2",
  }),
  terminal("quantman-explain-2", "quantman-explain-2", {
    continue: "quantman-explain-3",
  }),
  terminal("quantman-explain-3", "quantman-explain-3", {
    continue: "quantman-explain-4",
  }),
  terminal("quantman-explain-4", "quantman-explain-4", {
    continue: "quantman-explain-5",
  }),
  terminal("quantman-explain-5", "quantman-explain-5", {
    continue: "load-fluxball",
  }),
  terminal(
    "load-fluxball",
    "load-fluxball",
    { continue: "fluxball-global-pre" },
    "loading-transition",
  ),
  terminal(
    "fluxball-global-pre",
    "fluxball-global-pre",
    { play: "game-fluxball-global" },
    "placeholder",
  ),
  game("fluxball-global", "outcome-fluxball-global"),
  outcome("fluxball-global", {
    won: "fluxball-global-post-win",
    lost: "fluxball-global-post-loss",
  }),
  terminal(
    "fluxball-global-post-win",
    "fluxball-global-post-win",
    { continue: "fluxball-individual-pre" },
    "placeholder",
  ),
  terminal(
    "fluxball-global-post-loss",
    "fluxball-global-post-loss",
    { retry: "game-fluxball-global", continue: "fluxball-individual-pre" },
    "placeholder",
  ),
  terminal(
    "fluxball-individual-pre",
    "fluxball-individual-pre",
    { play: "game-fluxball-individual" },
    "placeholder",
  ),
  game("fluxball-individual", "outcome-fluxball-individual"),
  outcome("fluxball-individual", {
    won: "fluxball-individual-post-win",
    lost: "fluxball-individual-post-loss",
  }),
  terminal(
    "fluxball-individual-post-win",
    "fluxball-individual-post-win",
    { continue: "quarry-pre" },
    "placeholder",
  ),
  terminal(
    "fluxball-individual-post-loss",
    "fluxball-individual-post-loss",
    { retry: "game-fluxball-individual", continue: "quarry-pre" },
    "placeholder",
  ),
  terminal("quarry-pre", "quarry-pre", { play: "game-quarry" }, "placeholder"),
  game("quarry", "outcome-quarry"),
  outcome("quarry", { won: "quarry-post-win", lost: "quarry-post-loss" }),
  terminal(
    "quarry-post-win",
    "quarry-post-win",
    { continue: "story-complete" },
    "placeholder",
  ),
  terminal(
    "quarry-post-loss",
    "quarry-post-loss",
    { retry: "game-quarry", continue: "story-complete" },
    "placeholder",
  ),
  Object.freeze({ id: "story-complete", kind: "completion" }),
]);

export const STORY_NODES: Readonly<Record<string, StoryNode>> = Object.freeze(
  Object.fromEntries(NODES.map((candidate) => [candidate.id, candidate])),
);

export const STORY_OPENING_NODE_ID = "intro-1";

export const TERMINAL_TRANSCRIPT_PAGE_IDS: Readonly<
  Record<StoryChapterId, readonly string[]>
> = Object.freeze({
  qong: Object.freeze([
    "qong-intro",
    "qong-tutorial",
    "qong-success",
    "qong-debrief-1",
    "qong-debrief-2",
  ]),
  skipixl: Object.freeze([
    "skipixl-intro",
    "skipixl-feasible-tutorial",
    "skipixl-feasible-response",
    "skipixl-overloaded-intro",
    "skipixl-overloaded-tutorial",
    "skipixl-overloaded-success",
    "skipixl-debrief-1",
    "skipixl-debrief-2",
  ]),
  quantman: Object.freeze([
    "quantman-intro",
    "quantman-tutorial",
    "quantman-success",
    "quantman-explain-1",
    "quantman-explain-2",
    "quantman-explain-3",
    "quantman-explain-4",
    "quantman-explain-5",
  ]),
  fluxball: Object.freeze([
    "fluxball-global-pre",
    "fluxball-global-post-win",
    "fluxball-individual-pre",
    "fluxball-individual-post-win",
  ]),
  quarry: Object.freeze(["quarry-pre", "quarry-post-win"]),
});

export function storyNode(nodeId: string): StoryNode {
  const node = STORY_NODES[nodeId];
  if (!node) throw new Error(`Unknown Story node: ${nodeId}.`);
  return node;
}

export function storyTerminalPage(pageId: string): StoryTerminalPage {
  const candidate = STORY_TERMINAL_PAGES[pageId];
  if (!candidate) throw new Error(`Unknown Story terminal page: ${pageId}.`);
  return candidate;
}

export function branchStoryOutcome(
  node: Extract<StoryNode, { kind: "outcome-branch" }>,
  outcomeValue: StoryOutcome,
  firstLossAlreadyShown: boolean,
): string {
  const won = outcomeValue === "won" || outcomeValue === "finished";
  if (won) return node.branches.won;
  if (!firstLossAlreadyShown && node.branches.firstLoss)
    return node.branches.firstLoss;
  return node.branches.lost;
}

export function chapterStages(
  chapterId: StoryChapterId,
): readonly StoryStageId[] {
  switch (chapterId) {
    case "qong":
      return ["qong"];
    case "skipixl":
      return ["skipixl-feasible", "skipixl-overloaded"];
    case "quantman":
      return ["quantman-hold"];
    case "fluxball":
      return ["fluxball-global", "fluxball-individual"];
    case "quarry":
      return ["quarry"];
  }
}

export function earliestUnclearedStage(
  chapterId: StoryChapterId,
  clearedStages: readonly StoryStageId[],
): StoryStageId | null {
  return (
    chapterStages(chapterId).find((stage) => !clearedStages.includes(stage)) ??
    null
  );
}
