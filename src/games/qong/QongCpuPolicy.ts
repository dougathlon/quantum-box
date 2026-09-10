import type {
  AgentBeliefState,
  AgentDecision,
  AgentObservation,
  AgentPolicy,
} from "../../agents/contracts";
import { Mulberry32, type Uint32Seed } from "../../core/determinism";
import type { QongGoalEvent, QongPublicState } from "./types";

export type QongCpuHypothesis = Record<string, never>;

export interface QongCpuAction {
  readonly axis: -1 | 0 | 1;
  readonly strategy: "defend" | "concede";
}

export type QongCpuBelief = AgentBeliefState<QongCpuHypothesis>;

export function createQongCpuBelief(): QongCpuBelief {
  return Object.freeze({
    revision: 0,
    hypotheses: Object.freeze({}),
    confidence: 0,
    lastProbeTick: null,
  });
}

export const QONG_CPU_REACTION_TICKS = 15; // 250 ms at 60 Hz.

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
  private revealedAtTick: number | null = null;

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
      this.revealedAtTick = null;
      this.committedStrategy = this.random.next() < 0.5 ? "defend" : "concede";
      this.aimOffset = (this.random.next() - 0.5) * 24;
    }

    if (state.goalRule !== "unresolved") {
      this.revealedAtTick ??= observation.tick;
      if (observation.tick - this.revealedAtTick >= QONG_CPU_REACTION_TICKS) {
        this.committedStrategy =
          state.goalRule === "opposite" ? "defend" : "concede";
      }
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
