import { afterEach, expect, it, vi } from "vitest";
import { ControllerSetup } from "../../src/ui/ControllerSetup";
import { readGamepad } from "../../src/input/GamepadMapping";
afterEach(() => vi.unstubAllGlobals());
it("calibrates distinct buttons, refreshes cached mappings and waits for release", () => {
  let frame: FrameRequestCallback = () => {};
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const buttons = Array.from({ length: 4 }, () => ({
    pressed: false,
    value: 0,
  }));
  const pad = {
    id: "CALIBRATION TEST",
    index: 0,
    connected: true,
    mapping: "",
    axes: [0, 0],
    buttons,
  } as unknown as Gamepad;
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("navigator", { getGamepads: () => [pad] });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const status = { textContent: "" };
  const setup = new ControllerSetup({
    querySelector: () => status,
  } as unknown as HTMLElement);
  readGamepad(pad); // Cache defaults before remapping.
  setup.start();
  expect(setup.capturing).toBe(true);
  const press = (index: number) => {
    buttons.forEach((b) => (b.pressed = false));
    frame(0);
    buttons[index]!.pressed = true;
    frame(0);
  };
  press(1);
  press(1); // A duplicate must not advance.
  expect(status.textContent).toContain("ALREADY USED");
  press(0);
  press(3);
  press(2);
  expect(status.textContent).toContain("SAVED");
  expect(setup.capturing).toBe(true);
  buttons.forEach((b) => (b.pressed = false));
  frame(0);
  expect(setup.capturing).toBe(false);
  buttons[1]!.pressed = true;
  expect(readGamepad(pad).primary).toBe(true);
  setup.destroy();
});
