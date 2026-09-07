import type { Context } from "../fixtures/types";
import type { ActivePlayerMap, PlayerId, RuleMode } from "../modes";
import type {
  ActionRule,
  GlobalParity,
  InteractionRule,
  InterpretedRoundRules,
  PlayerRules,
  PurposeRule,
  RoundRuleTrace,
  Sign,
} from "./types";

function actionRule(sign: Sign): ActionRule {
  return sign === "+" ? "DIRECT" : "INVERTED";
}

function interactionRule(sign: Sign): InteractionRule {
  return sign === "+" ? "CARRY" : "STRIKE";
}

function purposeRule(sign: Sign): PurposeRule {
  return sign === "+" ? "OPPOSITE" : "OWN";
}

export function parityForOutcome(outcome: string): GlobalParity {
  return (outcome.match(/-/g)?.length ?? 0) % 2 === 0 ? "+" : "-";
}

function parityByAxis(
  trace: RoundRuleTrace,
): Readonly<Record<Context, GlobalParity>> {
  return Object.freeze({
    X: trace.axes.X.globalParity,
    Y: trace.axes.Y.globalParity,
    Z: trace.axes.Z.globalParity,
  });
}

function signFor(
  trace: RoundRuleTrace,
  playerId: PlayerId,
  axis: "X" | "Y" | "Z",
): Sign {
  const sign = trace.axes[axis].signs[playerId];
  if (!sign)
    throw new Error(`Round trace is missing ${axis} sign for ${playerId}.`);
  return sign;
}

export function interpretIndividualRules(
  trace: RoundRuleTrace,
): InterpretedRoundRules {
  const players: Partial<Record<PlayerId, PlayerRules>> = {};
  for (const playerId of trace.activePlayerIds) {
    players[playerId] = Object.freeze({
      action: actionRule(signFor(trace, playerId, "X")),
      interaction: interactionRule(signFor(trace, playerId, "Y")),
      purpose: purposeRule(signFor(trace, playerId, "Z")),
    });
  }
  return Object.freeze({
    mode: "individual",
    activePlayerIds: Object.freeze([...trace.activePlayerIds]),
    players: Object.freeze(players),
    global: null,
    parityByAxis: parityByAxis(trace),
  });
}

export function interpretGlobalRules(
  trace: RoundRuleTrace,
): InterpretedRoundRules {
  const parity = parityByAxis(trace);
  const global: PlayerRules = Object.freeze({
    action: actionRule(parity.X),
    interaction: interactionRule(parity.Y),
    purpose: purposeRule(parity.Z),
  });
  const players: ActivePlayerMap<PlayerRules> = Object.freeze(
    Object.fromEntries(
      trace.activePlayerIds.map((playerId) => [playerId, global]),
    ) as Partial<Record<PlayerId, PlayerRules>>,
  );
  return Object.freeze({
    mode: "global",
    activePlayerIds: Object.freeze([...trace.activePlayerIds]),
    players,
    global,
    parityByAxis: parity,
  });
}

export function interpretRoundRules(
  trace: RoundRuleTrace,
  mode: RuleMode,
): InterpretedRoundRules {
  return mode === "global"
    ? interpretGlobalRules(trace)
    : interpretIndividualRules(trace);
}
