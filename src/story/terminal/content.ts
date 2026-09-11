import type { StoryChapterId, StoryStageId } from "../../games/registry";
import type {
  StoryNode,
  StoryOutcome,
  StoryTerminalActionId,
  StoryTerminalPage,
} from "./types";

const action = (
  id: StoryTerminalActionId,
  label: "CONTINUE" | "PLAY" | "RETRY" | "FINISH",
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
      "INSIDE, YOU WILL FIND THE FUTURE OF ENTERTAINMENT.",
      "FIVE GAMES\nFIVE EXPERIENCES\nFIVE WAYS TO PLAY WITH THE POWER OF QUANTUM COMPUTING.",
      "THANK YOU FOR TAKING THE TIME TO\nREVIEW THIS PRODUCT DEMONSTRATION.",
    ],
    CONTINUE,
  ),
  page(
    "intro-2",
    "intro",
    ["QUANTUM BOX", "DEMONSTRATION PROGRAM"],
    [
      "I KNOW WHAT YOU’RE THINKING:\nQUANTUM COMPUTERS HAVE BEEN BUILT FOR SERIOUS WORK.",
      "SCIENCE\nINDUSTRY\nSIMULATION\nOPTIMIZATION",
      "ISN’T IT A BIT SILLY TO USE THEM TO PLAY GAMES?",
    ],
    CONTINUE,
  ),
  page(
    "intro-3",
    "intro",
    ["QUANTUM BOX", "DEMONSTRATION PROGRAM"],
    [
      "BUT IT WAS PLAY, NOT WORK, THAT TURNED MAINFRAME\nMONOLITHS INTO CONSUMER PRODUCTS.",
      "HIPPIES HACKING SPACEWAR! MADE COMPUTERS COOL.\nARCADES DEMANDING COINS MADE COMPUTERS COMMERCIAL.\nCONSOLES COMING HOME MADE COMPUTERS PART OF LIFE.",
      "THE VIDEO GAME MADE CLASSICAL COMPUTING PERSONAL.\nIT’S TIME FOR QUANTUM TO HAVE ITS MAGNAVOX ODYSSEY MOMENT.",
    ],
    CONTINUE,
  ),
  page(
    "qong-intro",
    "qong",
    [
      "QUANTUM BOX",
      "PROGRAM 01 / QONG",
      "QBOX> LOAD coin-toss-v1",
      "ENGINE ................. COIN TOSS",
      "RESULT BANK ............ LOADED",
      "PROGRAM ................ READY",
    ],
    [
      "LET'S START WITH SOMETHING EVERYONE KNOWS.",
      "PONG HAS A BALL,\nTWO PADDLES,\nAND TWO GOALS.",
      "I'VE CHANGED ONE THING (OTHER THAN THE FIRST LETTER).",
      "THE QUANTUM COMPUTER DECIDES WHAT A GOAL MEANS.",
    ],
    CONTINUE,
  ),
  page(
    "qong-tutorial",
    "qong",
    ["QUANTUM BOX", "PROGRAM 01 / TUTORIAL"],
    [
      "EACH ROUND USES ONE OF TWO RULES.",
      "OPPOSITE:\nSCORE THROUGH THE OTHER GOAL.",
      "OWN:\nSCORE THROUGH YOUR OWN GOAL.",
      "THE RULE BEGINS UNRESOLVED.",
      "PRESS ACTION TO OBSERVE THE RULE.",
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
      "PRESS ACTION TO OBSERVE THE RULE.",
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
      "QBOX> LOAD qpixl-v1",
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
      "I STARTED WITH A GRID OF PIXEL VALUES.\nI SENT IT THROUGH THE QUANTUM COMPUTER.",
      "WHAT CAME BACK WASN’T QUITE WHAT WENT IN.\nSO I TOOK THE DIFFERENCE.",
      "WHERE THE VALUES CHANGED MOST,\nI PUT SOMETHING IN YOUR WAY.",
      "TREES.\nMOGULS.",
      "THEN I SET A COURSE THROUGH THEM.",
      "QTG™!\n(QUANTUM TERRAIN GENERATION).",
    ],
    CONTINUE,
  ),
  page(
    "skipixl-feasible-failure",
    "skipixl",
    ["QUANTUM BOX", "PROGRAM 02 / SKIPIXL"],
    ["TRY THAT AGAIN."],
    RETRY_OR_CONTINUE,
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
    RETRY_OR_CONTINUE,
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
      "QBOX> LOAD labyrinth-v1",
      "ENGINE ................. LABYRINTH",
      "MAZE BANK .............. LOADED",
      "PROGRAM ................ READY",
    ],
    [
      "WITH SKIPIXL, THE QUANTUM DATA\nBUILT THE COURSE BEFORE YOU ARRIVED.\nHOWEVER SURPRISING IT WAS, THE LEVEL STAYED THE SAME.\nAND NOTHING YOU DID COULD CHANGE HOW IT WORKED.",
      "QUANTMAN IS DIFFERENT.\nTHE LEVEL CHANGES WHILE YOU'RE INSIDE IT.\nAND WHAT YOU DO CHANGES THE LEVEL.",
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
    ["WELL DONE."],
    CONTINUE,
  ),
  page(
    "quantman-explain-1",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    [
      "If YOU THINK ABOUT IT,\nA MAZE IS REALLY\nA PATTERN OF CONNECTIONS.",
      "THIS SPACE LEADS TO THAT ONE.",
      "THAT ONE DOESN’T LEAD TO THIS SPACE.",
      "CHANGE THE CONNECTIONS\nAND YOU CHANGE THE MAZE.",
    ],
    CONTINUE,
  ),
  page(
    "quantman-explain-2",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    [
      "IN QUANTMAN,\nEACH OF 100 SPATIAL UNITS CORRESPONDS\nTO A QUBIT (QUANTUM BIT)",
      "IN A MEASURED PATTERN, EACH SPACE GETS A 0 OR 1.",
      "MATCHING NEIGHBOURS = PASSAGE.\nDIFFERENT NEIGHBOURS = WALL.",
      "ONE PATTERN GIVES A COMPLETE MAZE.",
    ],
    CONTINUE,
  ),
  page(
    "quantman-explain-3",
    "quantman",
    ["QUANTUM BOX", "PROGRAM 03 / QUANTMAN"],
    [
      "DURING PLAY,\nTHE GAME KEEPS CYCLING\nTHROUGH THOSE CONFIGURATIONS.",
      "YOUR GAZE SETS\nA CONDITION:",
      "WHATEVER COMES NEXT,\nWHAT YOU'RE LOOKING AT\nHAS TO STAY THE SAME.",
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
      "QUANTUM ROLEPLAY!",
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
    "fluxball-intro",
    "fluxball",
    [
      "QUANTUM BOX",
      "PROGRAM 04 / FLUXBALL",
      "QBOX> LOAD graph-v1",
      "ENGINE ................. QGRAPH",
      "RESULT BANK ............ LOADED",
      "PROGRAM ................ READY",
    ],
    [
      "USUALLY, WHEN YOU START A GAME,\nYOU KNOW THE RULES.",
      "WHAT YOU DON'T KNOW\nIS HOW IT WILL END.",
      "BUT WHAT IF THE RULES\nWERE UNCERTAIN TOO?",
      "NOT JUST WHO WINS.",
      "HOW YOU MOVE.\nWHAT YOU CAN DO.\nWHAT COUNTS AS WINNING.",
    ],
    CONTINUE,
  ),
  page(
    "fluxball-shared-intro",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    [
      "GAMES ARE MADE OF RULES.",
      "CHANGE THE RULES\nAND YOU CHANGE THE GAME.",
      "SO LET'S TRY GENERATING THOSE.",
      "I'VE STARTED WITH SOMETHING SIMPLE:\nTWO PLAYERS AND A BALL.",
      "YOU BOTH PLAY BY THE SAME RULES.",
      "I JUST HAVEN'T TOLD YOU\nWHAT THEY ARE.",
    ],
    CONTINUE,
  ),
  page(
    "fluxball-global-pre",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / TUTORIAL"],
    [
      "MOVE:\nDIRECT OR INVERTED.",
      "TOUCH THE BALL:\nCARRY IT OR STRIKE IT.",
      "SCORE:\nTHROUGH THE OPPOSITE GOAL\nOR YOUR OWN.",
      "TEST WHAT WORKS.\nWATCH WHAT HAPPENS.",
      "PRESS ACTION TO CHANGE THE RULES.",
      "ONE CHANGE PER ROUND.\nSHARED BETWEEN BOTH PLAYERS.\nFIRST TO PRESS USES IT.",
      "THREE 40-SECOND ROUNDS.\nWIN MORE ROUNDS TO WIN THE MATCH.",
    ],
    PLAY,
  ),
  page(
    "fluxball-global-post-win",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["WELL DONE.", "SHALL WE MAKE IT\nMORE INTERESTING?"],
    CONTINUE,
  ),
  page(
    "fluxball-global-post-loss",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["ANOTHER GO?", "OR SHALL WE MAKE THINGS\nA LITTLE MORE INTERESTING?"],
    RETRY_OR_CONTINUE,
  ),
  page(
    "fluxball-split-intro",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    [
      "SO FAR, ONE RULEBOOK.\nBOTH PLAYERS FOLLOW IT.",
      "BUT WHY SHOULD THEY?",
      "WHAT IF YOU COULD CARRY THE BALL,\nWHILE I COULD ONLY STRIKE IT?",
      "WHAT IF THE GOAL THAT SCORED FOR YOU\nALSO SCORED FOR ME?",
      "SAME BALL.\nSAME FIELD.",
      "DIFFERENT GAMES.",
    ],
    CONTINUE,
  ),
  page(
    "fluxball-individual-pre",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / TUTORIAL"],
    [
      "NOW EACH PLAYER HAS THEIR OWN\nMOVEMENT, BALL AND SCORING RULES.",
      "WHAT WORKS FOR THE OTHER PLAYER\nMAY NOT WORK FOR YOU.",
      "FIND OUT BY PLAYING.",
      "WATCH YOUR SCORE:\nA GOAL CAN BENEFIT BOTH OF YOU.",
      "ACTION CHANGES BOTH PLAYERS' RULES.",
      "ONE SHARED CHANGE PER ROUND.",
      "SAME MATCH:\nTHREE 40-SECOND ROUNDS.",
    ],
    PLAY,
  ),
  page(
    "fluxball-individual-post-win",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["WELL DONE.", "LET ME SHOW YOU\nHOW I PUT THAT TOGETHER."],
    CONTINUE,
  ),
  page(
    "fluxball-individual-post-loss",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    ["WE CAN TRY THAT AGAIN.", "OR I CAN SHOW YOU\nHOW I PUT IT TOGETHER."],
    RETRY_OR_CONTINUE,
  ),
  page(
    "fluxball-explain-1",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    [
      "YOU WERE SHARING A WORLD\nWITHOUT NECESSARILY\nPLAYING THE SAME GAME.",
      "I USED THE QUANTUM GRAPH ENGINE\nTO RECORD MEASUREMENT RESULTS\nFOR BOTH PLAYERS TOGETHER.",
      "EACH RESULT CONTAINS\nA VALUE FOR EACH PLAYER.",
      "THE GAME DRAWS WHOLE PAIRS\nFROM THOSE RECORDED DISTRIBUTIONS.",
      "ONE PAIR FOR MOVEMENT.\nONE FOR THE BALL.\nONE FOR SCORING.",
    ],
    CONTINUE,
  ),
  page(
    "fluxball-explain-2",
    "fluxball",
    ["QUANTUM BOX", "PROGRAM 04 / FLUXBALL"],
    [
      "IN THE FIRST VERSION,\nI COMBINED EACH PAIR\nINTO A RULE YOU BOTH FOLLOWED.",
      "IN THE SECOND,\nEACH PLAYER GOT THEIR OWN\nPART OF THE PAIR.",
      "I STILL WROTE THE POSSIBLE RULES.",
      "THE QUANTUM RESULTS DETERMINE\nHOW THEY'RE COMBINED\nAND DISTRIBUTED BETWEEN PLAYERS.",
      "I CALL THIS QGG™!\nQUANTUM GAME GENERATION.",
      "THIS BALL GAME IS JUST THE START.",
      "IMAGINE THE POSSIBILITIES!",
    ],
    CONTINUE,
  ),
  page(
    "load-quarry",
    "quarry",
    ["QBOX> LOAD PROGRAM 05"],
    ["QUARRY ................. LOADING"],
    CONTINUE,
  ),
  page(
    "quarry-intro",
    "quarry",
    [
      "QUANTUM BOX",
      "PROGRAM 05 / QUARRY",
      "QBOX> LOAD graph-v1",
      "ENGINE ................. QGRAPH",
      "RESULT BANK ............ LOADED",
      "PROGRAM ................ READY",
    ],
    [
      "ONE LAST GAME.",
      "IN FLUXBALL,\nWE CHANGED THE RULES\nBETWEEN PLAYERS.",
      "NOW LET'S CHANGE\nWHAT THEY ARE\nTO ONE ANOTHER.",
      "SOMEONE CHASES.\nSOMEONE IS CHASED.",
      "I TRIED IT WITH DUCKS.",
    ],
    CONTINUE,
  ),
  page(
    "quarry-tutorial",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / TUTORIAL"],
    [
      "LEFT / RIGHT:\nMOVE.",
      "ACTION:\nFLAP.",
      "WATCH WHO YOU HUNT\nAND WHO HUNTS YOU.",
      "CATCH YOUR QUARRY\nFROM ABOVE TO SCORE.",
      "KEEP YOUR HUNTERS\nFROM GETTING ABOVE YOU.",
      "THE RELATIONSHIPS CHANGE\nEVERY 12 SECONDS.",
      "YOU CAN BE SOMEONE'S HUNTER\nAND SOMEONE ELSE'S QUARRY\nAT THE SAME TIME.",
    ],
    CONTINUE,
  ),
  page(
    "quarry-pre",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / TUTORIAL"],
    [
      "THREE 60-SECOND ROUNDS.",
      "EACH CATCH EARNS A POINT.",
      "MOST POINTS IN A ROUND\nEARNS ONE ROUND WIN.",
      "TIED LEADERS\nEACH EARN A WIN.",
      "POINTS RESET.\nROUND WINS STAY.",
      "WIN THE MOST ROUNDS\nTO WIN THE MATCH.",
    ],
    PLAY,
  ),
  page(
    "quarry-post-win",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / QUARRY"],
    ["WELL DONE.", "ONE MORE THING\nABOUT THE DUCKS."],
    CONTINUE,
  ),
  page(
    "quarry-post-loss",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / QUARRY"],
    ["ANOTHER GO?", "OR SHALL I EXPLAIN\nTHE DUCKS?"],
    RETRY_OR_CONTINUE,
  ),
  page(
    "quarry-explain-1",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / QUARRY"],
    [
      "REMEMBER QUANTMAN?",
      "WE COMPARED NEIGHBOURING BITS\nTO MAKE PASSAGES AND WALLS.",
      "HERE, EACH BIT STANDS\nFOR A RELATIONSHIP.",
      "FOUR DUCKS.\nTWELVE POSSIBLE DIRECTIONS\nOF PURSUIT.",
      "A HUNTS B.\nB HUNTS A.",
      "TWO DIFFERENT BITS.",
      "1: THE LINK IS ON.\n0: THE LINK IS OFF.",
    ],
    CONTINUE,
  ),
  page(
    "quarry-explain-2",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / QUARRY"],
    [
      "I USED THE QUANTUM GRAPH ENGINE\nTO RECORD TWELVE-BIT\nMEASUREMENT RESULTS.",
      "EACH RESULT DEFINES\nA WHOLE PATTERN OF PURSUIT.",
      "THE GAME DRAWS FROM\nTHOSE RECORDED PATTERNS,\nWEIGHTED BY HOW OFTEN\nTHEY APPEARED.",
      "NOT A SEPARATE DRAW\nFOR EVERY DUCK.",
      "ONE PATTERN THAT DETERMINES\nWHO HUNTS WHOM.",
    ],
    CONTINUE,
  ),
  page(
    "quarry-explain-3",
    "quarry",
    ["QUANTUM BOX", "PROGRAM 05 / QUARRY"],
    [
      "A HUNTS B.\nC HUNTS A.",
      "A IS BOTH\nHUNTER AND QUARRY.",
      "I DIDN'T ASSIGN A ROLE\nAND THEN FIND IT A RELATIONSHIP.",
      "THE RELATIONSHIPS\nDETERMINE THE ROLE.",
      "THE RELATIONS\nDETERMINE THE RELATA.",
      "QRG™!\nQUANTUM ROLE GENERATION.",
      "NOT JUST WHAT YOU CAN DO.",
      "WHAT YOU ARE\nTO ONE ANOTHER.",
    ],
    CONTINUE,
  ),
  page(
    "ending-1",
    "quarry",
    ["QUANTUM BOX", "DEMONSTRATION PROGRAM"],
    [
      "FIVE GAMES.",
      "I HOPE YOU CAN SEE\nMORE THAN FIVE GAMES HERE.",
      "AN OPPORTUNITY\nTO MAKE QUANTUM COMPUTING\nPERSONAL.",
      "A WHOLE NEW MARKET\nFOR A WHOLE NEW KIND\nOF ENTERTAINMENT.",
      "QUANTUM BOX\nIN HOMES ALL OVER THE WORLD.",
    ],
    CONTINUE,
  ),
  page(
    "ending-2",
    "quarry",
    ["QUANTUM BOX", "DEMONSTRATION PROGRAM"],
    [
      "I'M ASKING FOR AN INVESTMENT\nOF APPROXIMATELY [REDACTED]\nTO GET THINGS UP AND RUNNING.",
      "MOST OF THAT WILL GO TOWARDS\nACQUIRING THE QUANTUM DATA\nTHAT POWERS THE GAMES.",
      "ONCE WE HAVE THAT PIPELINE\nIN PLACE,\nWE CAN BUILD ON IT.",
      "MORE GAMES.\nOTHER APPLICATIONS.",
      "A PLATFORM FOR QUANTUM CREATIVITY",
    ],
    CONTINUE,
  ),
  page(
    "ending-3",
    "quarry",
    ["QUANTUM BOX", "DEMONSTRATION PROGRAM"],
    [
      "THANK YOU FOR YOUR TIME.",
      "YOU CAN CONTACT ME AT [REDACTED]",
      "I LOOK FORWARD\nTO DISCUSSING\nTHE NEXT STEPS.",
    ],
    CONTINUE,
  ),
  page(
    "ending-4",
    "quarry",
    ["QUANTUM BOX", "DEMONSTRATION COMPLETE"],
    ["QBOX> END DEMO"],
    CONTINUE,
  ),
  page(
    "postscript-1",
    "quarry",
    ["QUANTUM BOX", "POSTSCRIPT"],
    [
      "IF YOU'RE READING THIS,\nYOU BEAT THE DEMO.",
      "WELL DONE.",
      "UNFORTUNATELY,\nTHAT'S ALL THIS EVER WAS.",
      "PERHAPS IT WAS UNTIMELY.\nPERHAPS IT WAS RUBBISH.",
      "BOTH CAN BE TRUE.",
      ";)",
    ],
    CONTINUE,
  ),
  page(
    "postscript-2",
    "quarry",
    ["QUANTUM BOX", "POSTSCRIPT"],
    [
      "I'VE STORED ALL MY ENGINES HERE.",
      "I HOPE THE LINK STILL WORKS.",
      "[MOTH]",
      "IF YOU FIND A BETTER GAME\nIN ALL THIS,\nI'D LIKE TO PLAY IT.",
    ],
    [action("continue", "FINISH")],
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
    lost: "skipixl-feasible-failure",
  }),
  terminal("skipixl-feasible-failure", "skipixl-feasible-failure", {
    retry: "game-skipixl-feasible",
    continue: "skipixl-feasible-response",
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
    retry: "game-skipixl-overloaded",
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
    continue: "quantman-explain-5",
  }),
  terminal("quantman-explain-4", "quantman-explain-5", {
    continue: "load-fluxball",
  }),
  terminal("quantman-explain-5", "quantman-explain-5", {
    continue: "load-fluxball",
  }),
  terminal(
    "load-fluxball",
    "load-fluxball",
    { continue: "fluxball-intro" },
    "loading-transition",
  ),
  terminal("fluxball-intro", "fluxball-intro", {
    continue: "fluxball-shared-intro",
  }),
  terminal("fluxball-shared-intro", "fluxball-shared-intro", {
    continue: "fluxball-global-pre",
  }),
  terminal("fluxball-global-pre", "fluxball-global-pre", {
    play: "game-fluxball-global",
  }),
  game("fluxball-global", "outcome-fluxball-global"),
  outcome("fluxball-global", {
    won: "fluxball-global-post-win",
    lost: "fluxball-global-post-loss",
  }),
  terminal("fluxball-global-post-win", "fluxball-global-post-win", {
    continue: "fluxball-split-intro",
  }),
  terminal("fluxball-global-post-loss", "fluxball-global-post-loss", {
    retry: "game-fluxball-global",
    continue: "fluxball-split-intro",
  }),
  terminal("fluxball-individual-pre", "fluxball-individual-pre", {
    play: "game-fluxball-individual",
  }),
  game("fluxball-individual", "outcome-fluxball-individual"),
  outcome("fluxball-individual", {
    won: "fluxball-individual-post-win",
    lost: "fluxball-individual-post-loss",
  }),
  terminal("fluxball-individual-post-win", "fluxball-individual-post-win", {
    continue: "fluxball-explain-1",
  }),
  terminal("fluxball-individual-post-loss", "fluxball-individual-post-loss", {
    retry: "game-fluxball-individual",
    continue: "fluxball-explain-1",
  }),
  terminal("fluxball-split-intro", "fluxball-split-intro", {
    continue: "fluxball-individual-pre",
  }),
  terminal("fluxball-explain-1", "fluxball-explain-1", {
    continue: "fluxball-explain-2",
  }),
  terminal("fluxball-explain-2", "fluxball-explain-2", {
    continue: "load-quarry",
  }),
  terminal(
    "load-quarry",
    "load-quarry",
    { continue: "quarry-intro" },
    "loading-transition",
  ),
  terminal("quarry-intro", "quarry-intro", { continue: "quarry-tutorial" }),
  terminal("quarry-tutorial", "quarry-tutorial", { continue: "quarry-pre" }),
  terminal("quarry-pre", "quarry-pre", { play: "game-quarry" }),
  game("quarry", "outcome-quarry"),
  outcome("quarry", { won: "quarry-post-win", lost: "quarry-post-loss" }),
  terminal("quarry-post-win", "quarry-post-win", {
    continue: "quarry-explain-1",
  }),
  terminal("quarry-post-loss", "quarry-post-loss", {
    retry: "game-quarry",
    continue: "quarry-explain-1",
  }),
  terminal("quarry-explain-1", "quarry-explain-1", {
    continue: "quarry-explain-2",
  }),
  terminal("quarry-explain-2", "quarry-explain-2", {
    continue: "quarry-explain-3",
  }),
  terminal("quarry-explain-3", "quarry-explain-3", { continue: "ending-1" }),
  terminal("ending-1", "ending-1", { continue: "ending-2" }),
  terminal("ending-2", "ending-2", { continue: "ending-3" }),
  terminal("ending-3", "ending-3", { continue: "ending-4" }),
  terminal("ending-4", "ending-4", { continue: "postscript-1" }),
  terminal("postscript-1", "postscript-1", { continue: "postscript-2" }),
  terminal("postscript-2", "postscript-2", { continue: "story-complete" }),
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
    "quantman-explain-5",
  ]),
  fluxball: Object.freeze([
    "fluxball-intro",
    "fluxball-shared-intro",
    "fluxball-global-pre",
    "fluxball-global-post-win",
    "fluxball-split-intro",
    "fluxball-individual-pre",
    "fluxball-individual-post-win",
    "fluxball-explain-1",
    "fluxball-explain-2",
  ]),
  quarry: Object.freeze([
    "quarry-intro",
    "quarry-tutorial",
    "quarry-pre",
    "quarry-post-win",
    "quarry-explain-1",
    "quarry-explain-2",
    "quarry-explain-3",
    "ending-1",
    "ending-2",
    "ending-3",
    "ending-4",
  ]),
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
