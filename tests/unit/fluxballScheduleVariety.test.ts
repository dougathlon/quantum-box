import { describe, expect, it } from "vitest";
import { buildFluxballRuleSchedule } from "../../src/games/fluxball/FluxballRuleBank";
import { FLUXBALL_FIXTURE_CATALOG } from "../../src/games/fluxball/fluxballControlPacks";
import { interpretRoundRules } from "../../src/games/fluxball/standalone/rules/interpretRoundRules";

describe("four-player acquisition variety", () => {
  it("uses three distinct categories per match and reaches all four in every round position", () => {
    const byRound = [new Set<number>(), new Set<number>(), new Set<number>()];
    let matching = 0;
    let total = 0;
    for (let runSeed = 1; runSeed <= 200; runSeed++) {
      const categories = [];
      for (let round = 1; round <= 3; round++) {
        const options = {
          catalog: FLUXBALL_FIXTURE_CATALOG,
          competitorCount: 4 as const,
          runSeed,
          gameplayRoundNumber: round,
          stateCount: 2 as const,
          varyAcquisitionCategories: true,
        };
        const states = buildFluxballRuleSchedule(options);
        expect(buildFluxballRuleSchedule(options)).toEqual(states);
        const bucket = states[0]!.sourceRoundBuckets[0];
        categories.push(bucket);
        byRound[round - 1]!.add(bucket);
        expect(states[0]!.trace.fixtureId).not.toBe(states[1]!.trace.fixtureId);
        for (const { trace } of states) {
          expect(trace.acquisitionSource).toBe("moth-qgraph-qpu");
          const rules = interpretRoundRules(trace, "individual");
          for (const id of trace.activePlayerIds) {
            expect(rules.players[id]!.interaction).toBe(
              trace.axes.Y.signs[id] === "+" ? "CARRY" : "STRIKE",
            );
          }
          matching +=
            new Set(Object.values(rules.players).map((p) => p!.interaction))
              .size === 1
              ? 1
              : 0;
          total++;
        }
      }
      expect(new Set(categories).size).toBe(3);
    }
    for (const reached of byRound)
      expect([...reached].sort()).toEqual([1, 3, 5, 7]);
    console.info(
      `4P varied schedule audit: ${matching}/${total} all-player interaction matches`,
    );
    expect(matching).toBeGreaterThan(0);
    expect(matching).toBeLessThan(total);
  });
});
