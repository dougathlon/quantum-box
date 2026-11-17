import { describe, expect, it } from "vitest";
import {
  CabinetResultInput,
  CABINET_RESULT_SETTLE_MS,
} from "../../src/ui/CabinetResultInput";

describe("final cabinet result input", () => {
  it("blocks the last gameplay presses briefly, without extending on every render", () => {
    const gate = new CabinetResultInput();
    gate.update(false, 100);
    expect(gate.isSettling(100)).toBe(false);
    gate.update(true, 200);
    expect(gate.isSettling(200)).toBe(true);
    gate.update(true, 200 + CABINET_RESULT_SETTLE_MS - 1);
    expect(gate.isSettling(200 + CABINET_RESULT_SETTLE_MS - 1)).toBe(true);
    gate.update(true, 200 + CABINET_RESULT_SETTLE_MS);
    expect(gate.isSettling(200 + CABINET_RESULT_SETTLE_MS)).toBe(false);
  });
  it("resets on exit, replay or next maze and protects the next final result", () => {
    const gate = new CabinetResultInput();
    gate.update(true, 0);
    gate.update(false, 100);
    expect(gate.isSettling(100)).toBe(false);
    gate.update(true, 150);
    expect(gate.isSettling(700)).toBe(true);
    expect(gate.isSettling(750)).toBe(false);
  });
  it("protects Quarry round results for three seconds without changing final-result timing", () => {
    const gate = new CabinetResultInput();
    gate.update(true, 100, 3000);
    gate.update(true, 2000, 3000);
    expect(gate.isSettling(3099)).toBe(true);
    expect(gate.isSettling(3100)).toBe(false);
    gate.update(false, 4000);
    gate.update(true, 5000);
    expect(gate.isSettling(5599)).toBe(true);
    expect(gate.isSettling(5600)).toBe(false);
  });
});
