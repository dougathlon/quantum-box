import type { PlayerId } from "./standalone/modes";
import type { InterpretedRoundRules } from "./standalone/rules/types";
import type { FluxballCommittedPack } from "./fluxballControlPacks";
import type {
  FluxballDesignerAxisEvidence,
  FluxballDesignerEvidence,
  FluxballSnapshot,
} from "./types";

export function createFluxballDesignerEvidence(
  pack: FluxballCommittedPack,
  snapshot: FluxballSnapshot,
): FluxballDesignerEvidence {
  const reveal = snapshot.reveal;
  if (snapshot.phase !== "complete" || !reveal) {
    throw new Error(
      "Fluxball Designer evidence requires the completed final-round result.",
    );
  }
  if (snapshot.format.competitorCount !== reveal.trace.competitorCount) {
    throw new Error("Fluxball Designer evidence has a format mismatch.");
  }

  const axes = (["X", "Y", "Z"] as const).map(
    (context): FluxballDesignerAxisEvidence => {
      const axis = reveal.trace.axes[context];
      return Object.freeze({
        context,
        dimension: axis.dimension,
        outcome: axis.outcome,
        signs: Object.freeze({ ...axis.signs }),
        rules: rulesForDimension(
          reveal.rules,
          reveal.trace.activePlayerIds,
          axis.dimension,
        ),
        drawIndex: axis.drawIndex,
      });
    },
  );

  return deepFreeze({
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    source: pack.source,
    fixtureBankId: reveal.trace.fixtureBankId,
    fixtureId: reveal.trace.fixtureId,
    acquisitionSource: reveal.trace.acquisitionSource,
    samplingMethod: reveal.trace.samplingMethod,
    sourceMeasurementBasis:
      reveal.trace.sourceMeasurementBasis ?? "separate-pauli-contexts",
    providerProvenance: reveal.trace.providerProvenance ?? null,
    shotsPerCircuit: reveal.trace.shotsPerCircuit,
    roundNumber: reveal.roundNumber,
    activePlayerIds: [...reveal.trace.activePlayerIds],
    axes,
  });
}

function rulesForDimension(
  rules: InterpretedRoundRules,
  playerIds: readonly PlayerId[],
  dimension: "ACTION" | "INTERACTION" | "PURPOSE",
): Readonly<Partial<Record<PlayerId, string>>> {
  return Object.freeze(
    Object.fromEntries(
      playerIds.map((playerId) => {
        const playerRules = rules.players[playerId];
        if (!playerRules) {
          throw new Error(`Fluxball evidence is missing Player ${playerId}.`);
        }
        const rule =
          dimension === "ACTION"
            ? playerRules.action
            : dimension === "INTERACTION"
              ? playerRules.interaction
              : playerRules.purpose;
        return [playerId, rule];
      }),
    ) as Partial<Record<PlayerId, string>>,
  );
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
