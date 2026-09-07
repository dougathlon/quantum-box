export interface AgentObservation<TPublicState, TPublicEvent> {
  readonly tick: number;
  readonly selfId: string;
  readonly publicState: Readonly<TPublicState>;
  readonly publicEvents: readonly Readonly<TPublicEvent>[];
}

export interface AgentBeliefState<THypothesis> {
  readonly revision: number;
  readonly hypotheses: Readonly<THypothesis>;
  readonly confidence: number;
  readonly lastProbeTick: number | null;
}

export interface AgentDecision<TAction, THypothesis> {
  readonly action: Readonly<TAction>;
  readonly nextBelief: AgentBeliefState<THypothesis>;
  readonly rationaleCode: string;
}

export interface AgentPolicy<TPublicState, TPublicEvent, THypothesis, TAction> {
  decide(
    observation: AgentObservation<TPublicState, TPublicEvent>,
    belief: AgentBeliefState<THypothesis>,
  ): AgentDecision<TAction, THypothesis>;
}

export function freezeObservation<TPublicState, TPublicEvent>(
  observation: AgentObservation<TPublicState, TPublicEvent>,
): AgentObservation<TPublicState, TPublicEvent> {
  return deepFreeze(structuredClone(observation));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
