import { QUAG_PLAYER_IDS, type QuagPlayerId, type QuagSnapshot } from "./types";

export interface QuagRelationPresentation {
  readonly sourceId: QuagPlayerId;
  readonly targetId: QuagPlayerId;
  readonly sourceKind: "human" | "cpu";
}

export interface QuagHudModel {
  readonly time: string;
  readonly round: string;
  readonly score: string;
  readonly targets: string;
  readonly phase: string;
  readonly notice: string;
}

export function quagHudModel(
  snapshot: QuagSnapshot,
  paused: boolean,
): QuagHudModel {
  return Object.freeze({
    time: String(Math.max(0, Math.ceil(snapshot.secondsRemaining))).padStart(
      3,
      "0",
    ),
    round: `${snapshot.roundNumber}/${snapshot.totalRounds}`,
    score: scoreLine(snapshot),
    targets: quagHumanQuarrySummary(snapshot),
    phase: `STATE ${snapshot.graphPhase} · ${Math.ceil(snapshot.ticksUntilRemeasurement / 20)}S`,
    notice: paused
      ? "PAUSED"
      : snapshot.phase === "ready"
        ? `READY ${Math.max(1, Math.ceil(snapshot.readyTicksRemaining / 20))} · ${humanLabel(snapshot)}`
        : snapshot.phase === "round-break"
          ? roundOutcome(snapshot)
          : snapshot.phase === "complete"
            ? outcome(snapshot)
            : (recentEvent(snapshot) ?? "CATCH FROM ABOVE"),
  });
}

/**
 * Preserve each local player's outgoing relation instead of collapsing the
 * multiplayer HUD to the union of all human targets.
 */
export function quagHumanQuarrySummary(snapshot: QuagSnapshot): string {
  const relations = quagRelationPresentation(snapshot);
  if (snapshot.humanPlayerIds.length === 1) {
    const playerId = snapshot.humanPlayerIds[0]!;
    const targets = relations
      .filter((relation) => relation.sourceId === playerId)
      .map((relation) => relation.targetId);
    return targets.length > 0 ? targets.join("+") : "NONE";
  }
  return snapshot.humanPlayerIds
    .map((playerId) => {
      const targets = relations
        .filter((relation) => relation.sourceId === playerId)
        .map((relation) => relation.targetId)
        .join("");
      return `${playerId}>${targets || "-"}`;
    })
    .join(" ");
}

/** Fixed hunter order keeps changing relations readable without tracking birds. */
export function quagHuntRows(snapshot: QuagSnapshot): readonly string[] {
  const relations = quagRelationPresentation(snapshot);
  return QUAG_PLAYER_IDS.map((hunter) => {
    const targets = QUAG_PLAYER_IDS.filter((target) =>
      relations.some(
        (relation) =>
          relation.sourceId === hunter && relation.targetId === target,
      ),
    );
    return `${hunter} HUNTS ${targets.join("+") || "NONE"}`;
  });
}

export function quagRelationPresentation(
  snapshot: QuagSnapshot,
): readonly QuagRelationPresentation[] {
  const humans = new Set(snapshot.humanPlayerIds);
  return Object.freeze(
    snapshot.directedRelations.map((edge) => {
      const [sourceId, targetId] = edge.split(">") as [
        QuagPlayerId,
        QuagPlayerId,
      ];
      return Object.freeze({
        sourceId,
        targetId,
        sourceKind: humans.has(sourceId) ? "human" : "cpu",
      });
    }),
  );
}

function recentEvent(snapshot: QuagSnapshot): string | null {
  const event = snapshot.latestEvent;
  if (!event || snapshot.activeTick - event.tick >= 60) return null;
  return event.detail;
}

function scoreLine(snapshot: QuagSnapshot): string {
  const wins = snapshot.players
    .map((player) => `${player.id}${player.roundWins}`)
    .join(" ");
  const points = snapshot.players
    .map((player) => `${player.id}${String(player.score).padStart(2, "0")}`)
    .join(" ");
  return `W ${wins} · P ${points}`;
}

function roundOutcome(snapshot: QuagSnapshot): string {
  if (snapshot.roundWinnerIds.length !== 1) {
    return `ROUND ${snapshot.roundNumber} DRAW`;
  }
  return `ROUND ${snapshot.roundNumber} · ${snapshot.roundWinnerIds[0]} WINS`;
}

function outcome(snapshot: QuagSnapshot): string {
  if (snapshot.winnerIds.length > 1) {
    return snapshot.winnerIds.some((id) => snapshot.humanPlayerIds.includes(id))
      ? `DRAW · ${snapshot.winnerIds.join("/")}`
      : `CPU DRAW · ${snapshot.winnerIds.join("/")}`;
  }
  const winner = snapshot.winnerIds[0];
  if (winner && snapshot.humanPlayerIds.includes(winner)) {
    return snapshot.humanPlayerIds.length === 1 ? "YOU WIN" : `${winner} WINS`;
  }
  return `${winner ?? "CPU"} WINS · YOU LOSE`;
}

function humanLabel(snapshot: QuagSnapshot): string {
  return snapshot.humanPlayerIds.length === 1
    ? `YOU ARE ${snapshot.humanPlayerIds[0]}`
    : `LOCAL ${snapshot.humanPlayerIds.join("+")}`;
}
