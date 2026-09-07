import type {
  StoryV2PresentationBeat,
  StoryV2PresentationFlowId,
} from "./types";

export type StoryV2SceneKind =
  | "den"
  | "office"
  | "slope"
  | "field"
  | "ghost-den"
  | "arena"
  | "workshop";

export type StoryV2SpritePlayback =
  | "still"
  | "talk-loop"
  | "walk-loop"
  | "morph-once";

export function storyV2SpritePlayback(
  beat: StoryV2PresentationBeat,
): StoryV2SpritePlayback {
  if (beat.kind === "morph") return "morph-once";
  if (beat.assetCue === "professor-talk") return "talk-loop";
  if (beat.assetCue === "professor-walk") return "walk-loop";
  return "still";
}

export function storyV2SceneKind(
  flowId: StoryV2PresentationFlowId,
  beat: StoryV2PresentationBeat,
): StoryV2SceneKind {
  if (beat.kind === "workshop") return "workshop";
  switch (flowId) {
    case "qong-den":
      return beat.id === "qong-walk-to-den" ||
        beat.id.startsWith("qong-den-") ||
        beat.kind === "terminal"
        ? "den"
        : "field";
    case "skipixl-medium-handoff":
      return "slope";
    case "skipixl-cabin":
      return beat.id === "skipixl-hard-enter-office" || beat.kind === "terminal"
        ? "office"
        : "slope";
    case "fluxball-two-handoff":
      return "field";
    case "fluxball-office":
      return beat.kind === "terminal" || beat.kind === "explore"
        ? "office"
        : "field";
    case "quantman-stabilize-handoff":
      return "ghost-den";
    case "quantman-ghost-den":
      return beat.id === "quantman-ghost-den-office" || beat.kind === "terminal"
        ? "office"
        : "ghost-den";
    case "quarry-finale":
      return beat.id === "quarry-designer-walk-offscreen" ||
        beat.id === "quarry-final-workshop" ||
        beat.kind === "terminal"
        ? "workshop"
        : "arena";
  }
}
