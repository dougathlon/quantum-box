import { describe, expect, it } from "vitest";
import { cabinetBackIntent } from "../../src/app/CabinetBackIntent";

describe("cabinet Back navigation", () => {
  it.each([false, true])(
    "Backspace/B opens pause during play, story=%s",
    (story) => {
      expect(cabinetBackIntent(false, false, story)).toBe("pause");
    },
  );
  it("Backspace/B exits paused Story to session continuation", () => {
    expect(cabinetBackIntent(false, true, true)).toBe("story-session");
  });
  it("Backspace/B exits paused Arcade through its normal return route", () => {
    expect(cabinetBackIntent(false, true, false)).toBe("back");
  });
  it.each([false, true])("completed results retain Back, story=%s", (story) => {
    expect(cabinetBackIntent(true, false, story)).toBe("back");
  });
});
