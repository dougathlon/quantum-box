import type { GameId, StoryStageId } from "../games/registry";

export interface StoryBrief {
  readonly archiveNote: string;
  readonly ruleLevel: string;
  readonly installedSource: string;
  readonly objective: string;
  readonly question: string;
  readonly recovery: string;
}

export const STORY_BRIEFS = Object.freeze({
  qong: Object.freeze({
    archiveNote: "SERVICE NOTE 01 · AUTHOR UNKNOWN",
    ruleLevel: "GLOBAL BINARY",
    installedSource: "AUTHENTIC MOTH QPU BANK · 4 × 7 RALLIES INSTALLED",
    objective:
      "Use at least one observation, move deliberately in three rallies, and win the seven-round test. Each round begins with one unresolved rule: score through the opposite goal line or through your own. Press Space to observe it before a crossing, or let the crossing force measurement.",
    question:
      "What happens when a physical crossing is settled but its scoring meaning remains unresolved?",
    recovery:
      "A victory should expose the first formula and the device's method of turning a binary result into a rule.",
  }),
  skipixl: Object.freeze({
    archiveNote: "SERVICE NOTE 02 · PIXEL CHANNEL RECOVERED",
    ruleLevel: "QPIXL RESIDUAL COURSE",
    installedSource: "PRE-ACQUIRED IBM FEZ QPIXL PACK",
    objective:
      "Reach the bottom before this course's displayed limit. Every returned-versus-submitted QPixl residual above the bank threshold becomes a tree or mogul, so some generations are sparse enough to beat and others may close the mountain.",
    question:
      "How can a fixed hardware return materially compose a course without making the browser call hardware during play?",
    recovery:
      "A successful descent should expose the three ordered source/result pairs, the residual decoder, and the local deterministic simulation.",
  }),
  "skipixl-medium": Object.freeze({
    archiveNote: "SERVICE NOTE 02A · PIXEL CHANNEL RECOVERED",
    ruleLevel: "QPIXL RESIDUAL COURSE · MEDIUM",
    installedSource: "PRE-ACQUIRED IBM FEZ QPIXL PACK",
    objective:
      "Reach the bottom of the Medium descent. This first pass introduces the residual-derived hazards and gates before the denser Hard course.",
    question:
      "How can a stored hardware return become terrain while the browser remains provider-free?",
    recovery:
      "Completion checkpoints the descent and leads directly to the Designer's warning about the harder course.",
  }),
  "fluxball-two": Object.freeze({
    archiveNote: "SERVICE NOTE 03A · RELATION TEST",
    ruleLevel: "RELATIONAL GLOBAL",
    installedSource: "OFFLINE QGRAPH QPU BANK · PLAYABLE FALLBACKS",
    objective:
      "Win more of the four 40-second rounds than the CPU. Goals reset every round. Both players inhabit one hidden shared MOVE, BALL, and GOAL configuration. One shared CHANGE RULES action advances that global state without revealing either the old or new values.",
    question:
      "Can you infer one shared constitutive rule set from its consequences in play?",
    recovery:
      "The two-player test opens the larger court. The formula remains sealed until the four-player relation field is decoded.",
  }),
  "fluxball-four": Object.freeze({
    archiveNote: "SERVICE NOTE 03B · FULL COURT",
    ruleLevel: "RELATIONAL INDIVIDUAL",
    installedSource: "OFFLINE QGRAPH QPU BANK · PLAYABLE FALLBACKS",
    objective:
      "Win more of the four 60-second rounds than every CPU. Goals reset every round. One human may spend the round's shared CHANGE RULES action, advancing the joint QGraph state and changing every player's hidden individual rules without revealing them.",
    question:
      "What becomes of strategy when rules belong to relations rather than the game as a whole?",
    recovery:
      "A victory should expose the recorded QGraph evidence, its three ordered draws, and the distinct two- and four-player acquisition paths in the Workshop—not in the match HUD.",
  }),
  "quantman-stabilize": Object.freeze({
    archiveNote: "SERVICE NOTE 04 · MAZE MEMORY",
    ruleLevel: "RECORDED LABYRINTH FIELD · STABILIZE GAZE",
    installedSource: "MOTH / IBM FEZ 10 × 10 / 100-BIT RETURN",
    objective:
      "Clear the complete maze while gaze stabilizes the QPU-derived passages in view.",
    question:
      "Can looking become a deliberate way to stabilize a maze rather than merely reveal it?",
    recovery:
      "Clearance checkpoints the installed Labyrinth return and opens its inverse.",
  }),
  quantman: Object.freeze({
    archiveNote: "SERVICE NOTE 04B · INVERSE CONTROL",
    ruleLevel: "RECORDED LABYRINTH FIELD · INVERSE GAZE",
    installedSource: "MOTH / IBM FEZ 10 × 10 / 100-BIT RETURN",
    objective:
      "Clear the complete maze while gaze inverts the QPU-derived passages in view.",
    question:
      "What changes when the same measured field reverses the relation between looking and passage state?",
    recovery:
      "The debrief reveals how the recorded 100-bit IBM Fez return becomes passage states.",
  }),
  quarry: Object.freeze({
    archiveNote: "SERVICE NOTE 05 · PURSUIT ECOLOGY",
    ruleLevel: "RECORDED QGRAPH RELATION FIELD",
    installedSource: "24 MOTH / IBM FEZ QGRAPH RETURNS",
    objective:
      "Win the three-round match while the full predator–quarry ecology changes on its scheduled twelve-second measurement intervals.",
    question:
      "How does play change when the relations of hunting and fleeing are temporary properties of a whole ecology?",
    recovery:
      "The finale compares Quarry's 24 12-qubit QGraph returns with Fluxball's separate 40-return IBM Fez bank.",
  }),
} as const satisfies Readonly<Record<StoryStageId, StoryBrief>>);

export const DESIGNER_FRAGMENTS = Object.freeze({
  qong: Object.freeze({
    record: "RECOVERED MARGIN NOTE · 01",
    text: "Keep the goal familiar. Change what the goal means. The player must learn to watch the rule, not only the ball.",
  }),
  skipixl: Object.freeze({
    record: "RECOVERED MARGIN NOTE · 02",
    text: "Do not make the mountain fair. Let every strong returned difference become danger, then make the player wait for a field they can read and survive.",
  }),
  fluxball: Object.freeze({
    record: "RECOVERED MARGIN NOTE · 03",
    text: "Give nobody the whole rule. Let each actor learn the game from the consequences that pass between them.",
  }),
  quantman: Object.freeze({
    record: "RECOVERED MARGIN NOTE · 04",
    text: "Make looking costly and useful. Hold the passage in view, change the distant shortcuts, and let the chase teach the topology.",
  }),
} as const satisfies Readonly<
  Record<GameId, { readonly record: string; readonly text: string }>
>);
