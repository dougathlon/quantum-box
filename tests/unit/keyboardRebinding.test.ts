import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InputController,
  type InputSignal,
} from "../../src/input/InputController";
import {
  DEFAULT_KEYBOARD_BINDINGS,
  KEYBOARD_CONTROLS,
  validateKeyboardBindings,
} from "../../src/input/KeyboardBindings";
import { SaveRepository } from "../../src/save/SaveRepository";

afterEach(() => vi.unstubAllGlobals());
function harness() {
  vi.stubGlobal("HTMLElement", class {});
  const handlers = new Map<string, (event: unknown) => void>();
  const target = {
    addEventListener: (name: string, handler: (event: unknown) => void) =>
      handlers.set(name, handler),
    removeEventListener: () => {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  } as unknown as Window;
  const controller = new InputController(target, {} as Document);
  const signals: InputSignal[] = [];
  controller.subscribe((signal) => signals.push(signal));
  const fire = (type: string, code: string) =>
    handlers.get(type)!({
      code,
      repeat: false,
      target: null,
      preventDefault: () => {},
    });
  return { controller, signals, fire };
}
describe("live keyboard rebinding", () => {
  it("retains legacy C/D bindings without dispatching their keyboard inputs", () => {
    const { controller, signals, fire } = harness();
    for (const player of ["C", "D"] as const) {
      for (const code of Object.values(DEFAULT_KEYBOARD_BINDINGS[player])) {
        fire("keydown", code);
        fire("keyup", code);
      }
    }
    expect(signals).toEqual([]);
    for (const [player, number] of [
      ["A", 1],
      ["B", 2],
    ] as const) {
      fire("keydown", DEFAULT_KEYBOARD_BINDINGS[player].action);
      fire("keyup", DEFAULT_KEYBOARD_BINDINGS[player].action);
      expect(
        signals.slice(-2).map(({ action, pressed }) => [action, pressed]),
      ).toEqual([
        [`p${number}-action`, true],
        [`p${number}-action`, false],
      ]);
    }
    controller.dispose();
  });
  for (const [player, number] of [
    ["A", 1],
    ["B", 2],
  ] as const) {
    it.each(["KeyI", "KeyJ", "KeyK", "KeyL"])(
      `${player} can reuse inactive profile key %s without dispatching C/D`,
      (code) => {
        const bindings = validateKeyboardBindings({
          ...DEFAULT_KEYBOARD_BINDINGS,
          [player]: { ...DEFAULT_KEYBOARD_BINDINGS[player], up: code },
        });
        expect(bindings.C).toEqual(DEFAULT_KEYBOARD_BINDINGS.C);
        expect(bindings.D).toEqual(DEFAULT_KEYBOARD_BINDINGS.D);
        const { controller, signals, fire } = harness();
        controller.setKeyboardBindings(bindings);
        signals.length = 0;
        fire("keydown", code);
        fire("keyup", code);
        expect(signals.map(({ action, pressed }) => [action, pressed])).toEqual(
          [
            [`p${number}-up`, true],
            [`p${number}-up`, false],
          ],
        );
        controller.dispose();
      },
    );
  }
  it("still rejects conflicting active A/B keys when legacy profiles share them", () => {
    expect(() =>
      validateKeyboardBindings({
        ...DEFAULT_KEYBOARD_BINDINGS,
        A: { ...DEFAULT_KEYBOARD_BINDINGS.A, up: "KeyI" },
        B: { ...DEFAULT_KEYBOARD_BINDINGS.B, left: "KeyI" },
      }),
    ).toThrow("I is already assigned.");
  });
  it("keeps legacy profiles structurally complete with internally unambiguous keys", () => {
    expect(() =>
      validateKeyboardBindings({ ...DEFAULT_KEYBOARD_BINDINGS, D: undefined }),
    ).toThrow("Player D keyboard bindings are incomplete.");
    expect(() =>
      validateKeyboardBindings({
        ...DEFAULT_KEYBOARD_BINDINGS,
        C: { ...DEFAULT_KEYBOARD_BINDINGS.C, action: "KeyT" },
      }),
    ).toThrow("T is already assigned.");
  });
  for (const [player, number] of [
    ["A", 1],
    ["B", 2],
  ] as const) {
    for (const control of KEYBOARD_CONTROLS) {
      it(`${player} ${control}: new key works, old key stops, release is delivered`, () => {
        const { controller, signals, fire } = harness();
        const old = DEFAULT_KEYBOARD_BINDINGS[player][control];
        const action = `p${number}-${control}`;
        fire("keydown", old);
        expect(signals.at(-1)?.action).toBe(action);
        controller.setKeyboardBindings(
          validateKeyboardBindings({
            ...DEFAULT_KEYBOARD_BINDINGS,
            [player]: {
              ...DEFAULT_KEYBOARD_BINDINGS[player],
              [control]: "KeyZ",
            },
          }),
        );
        expect(signals.some((s) => s.action === action && !s.pressed)).toBe(
          true,
        );
        signals.length = 0;
        fire("keydown", old);
        fire("keyup", old);
        expect(signals).toEqual([]);
        fire("keydown", "KeyZ");
        fire("keyup", "KeyZ");
        expect(signals.map((s) => [s.action, s.pressed])).toEqual([
          [action, true],
          [action, false],
        ]);
        controller.dispose();
      });
    }
  }
  it("persists active remaps over inactive keys without changing legacy profiles", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } as unknown as Storage;
    const repo = new SaveRepository(storage, () => {});
    const bindings = validateKeyboardBindings({
      ...DEFAULT_KEYBOARD_BINDINGS,
      A: { ...DEFAULT_KEYBOARD_BINDINGS.A, up: "KeyI" },
      B: { ...DEFAULT_KEYBOARD_BINDINGS.B, action: "KeyR" },
    });
    repo.updateSettings({ keyboardBindings: bindings });
    const loaded = new SaveRepository(storage, () => {}).snapshot();
    expect(loaded.settings.keyboardBindings).toEqual(bindings);
    expect(loaded.settings.keyboardBindings.C).toEqual(
      DEFAULT_KEYBOARD_BINDINGS.C,
    );
    expect(loaded.settings.keyboardBindings.D).toEqual(
      DEFAULT_KEYBOARD_BINDINGS.D,
    );
  });
});
