import type { RunContext } from "../core/run";
import type { QuantmanSyntheticMechanic } from "../games/quantmanSynthetic";
import type { ArcadeRunOrigin } from "./arcade";

export interface QuantmanRetryRequest {
  readonly playMode: RunContext["playMode"];
  readonly mechanic: QuantmanSyntheticMechanic;
  readonly runSeed: number;
  readonly storyReplay: boolean;
  readonly arcadeRunOrigin: ArcadeRunOrigin;
}

/** Preserve replay authority and determinism while replacing only the run. */
export function createQuantmanRetryRequest(
  context: RunContext,
  mechanic: QuantmanSyntheticMechanic,
  storyReplay: boolean,
  arcadeRunOrigin: ArcadeRunOrigin | null,
  nextRunSeed: number,
): QuantmanRetryRequest {
  return Object.freeze({
    playMode: context.playMode,
    mechanic,
    runSeed: nextRunSeed,
    storyReplay,
    arcadeRunOrigin: arcadeRunOrigin ?? "developer-qa",
  });
}
