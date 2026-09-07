import type {
  AgentBeliefState,
  AgentDecision,
  AgentObservation,
  AgentPolicy,
} from "../../agents/contracts";
import { Mulberry32, type Uint32Seed } from "../../core/determinism";
import type { QongGoalEvent, QongPolarity, QongPublicState } from "./types";

export interface QongCpuHypothesis {
  readonly directEvidence: number;
  readonly invertEvidence: number;
  readonly repeatEvidence: number;
  readonly flipEvidence: number;
  readonly lastObservedPolarity: QongPolarity | null;
}

export interface QongCpuAction {
  readonly axis: -1 | 0 | 1;
  readonly strategy: "defend" | "concede";
}

export type QongCpuBelief = AgentBeliefState<QongCpuHypothesis>;

export function createQongCpuBelief(): QongCpuBelief {
  return Object.freeze({
    revision: 0,
    hypotheses: Object.freeze({
      directEvidence: 1,
      invertEvidence: 1,
      repeatEvidence: 1,
      flipEvidence: 1,
      lastObservedPolarity: null,
    }),
    confidence: 0,
    lastProbeTick: null,
  });
}

export function reviseQongCpuBelief(
  belief: QongCpuBelief,
  event: QongGoalEvent,
): QongCpuBelief {
  const observedDirect =
    (event.goalSide === "left" && event.pointWinner === "right") ||
    (event.goalSide === "right" && event.pointWinner === "left");
  const directEvidence =
    belief.hypotheses.directEvidence + (observedDirect ? 1 : 0);
  const invertEvidence =
    belief.hypotheses.invertEvidence + (observedDirect ? 0 : 1);
  const observedPolarity: QongPolarity = observedDirect ? "direct" : "invert";
  const previousPolarity = belief.hypotheses.lastObservedPolarity;
  const repeated = previousPolarity === observedPolarity;
  const repeatEvidence =
    belief.hypotheses.repeatEvidence +
    (previousPolarity !== null && repeated ? 1 : 0);
  const flipEvidence =
    belief.hypotheses.flipEvidence +
    (previousPolarity !== null && !repeated ? 1 : 0);
  const total = directEvidence + invertEvidence;
  const transitionTotal = repeatEvidence + flipEvidence;
  return Object.freeze({
    revision: belief.revision + 1,
    hypotheses: Object.freeze({
      directEvidence,
      invertEvidence,
      repeatEvidence,
      flipEvidence,
      lastObservedPolarity: observedPolarity,
    }),
    confidence: Math.max(
      Math.abs(directEvidence - invertEvidence) / total,
      Math.abs(repeatEvidence - flipEvidence) / transitionTotal,
    ),
    lastProbeTick: belief.lastProbeTick,
  });
}

export class QongCpuPolicy
  implements
    AgentPolicy<
      QongPublicState,
      QongGoalEvent,
      QongCpuHypothesis,
      QongCpuAction
    >
{
  private readonly random: Mulberry32;
  private committedRally = 0;
  private committedStrategy: "defend" | "concede" = "defend";
  private aimOffset = 0;

  public constructor(seed: Uint32Seed) {
    this.random = new Mulberry32(seed);
  }

  public decide(
    observation: AgentObservation<QongPublicState, QongGoalEvent>,
    belief: QongCpuBelief,
  ): AgentDecision<QongCpuAction, QongCpuHypothesis> {
    const state = observation.publicState;
    if (state.rallyNumber !== this.committedRally) {
      this.committedRally = state.rallyNumber;
      const evidence = belief.hypotheses;
      const directProbability =
        evidence.directEvidence /
        (evidence.directEvidence + evidence.invertEvidence);
      const repeatProbability =
        evidence.repeatEvidence /
        (evidence.repeatEvidence + evidence.flipEvidence);
      const transitionEstimate =
        evidence.lastObservedPolarity === "direct"
          ? repeatProbability
          : evidence.lastObservedPolarity === "invert"
            ? 1 - repeatProbability
            : directProbability;
      const publicEstimate =
        directProbability * 0.55 + transitionEstimate * 0.45;
      const fallibleEstimate = publicEstimate * 0.72 + 0.14;
      this.committedStrategy =
        this.random.next() < fallibleEstimate ? "defend" : "concede";
      this.aimOffset = (this.random.next() - 0.5) * 24;
    }

    const targetY =
      this.committedStrategy === "defend"
        ? state.ball.y + this.aimOffset
        : state.ball.y < state.rightPaddleY
          ? 310
          : 50;
    const error = targetY - state.rightPaddleY;
    const axis: -1 | 0 | 1 = Math.abs(error) < 8 ? 0 : error < 0 ? -1 : 1;

    return Object.freeze({
      action: Object.freeze({
        axis,
        strategy: this.committedStrategy,
      }),
      nextBelief: belief,
      rationaleCode: `qong-public-${this.committedStrategy}`,
    });
  }
}
