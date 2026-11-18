import { describe, expect, it } from "vitest";
import {
  requiresComputerNotice,
  type DeviceSignals,
} from "../../src/entry/deviceSupport";
const signals = (
  userAgent: string,
  touch = 0,
  coarse = false,
  fine = true,
): DeviceSignals => ({
  userAgent,
  maxTouchPoints: touch,
  coarsePointer: coarse,
  finePointer: fine,
});
describe("computer-only entry", () => {
  it.each([
    signals("Windows NT 10.0; Win64; x64"),
    signals("Windows NT 10.0; Win64; x64", 10, true, false),
    signals("Macintosh; Intel Mac OS X 10_15_7"),
    signals("Macintosh; Intel Mac OS X 10_15_7", 5, false, true),
    signals("Macintosh; Intel Mac OS X 10_15_7", 5, true, true),
    signals("X11; Linux x86_64", 10, true, false),
    signals("X11; CrOS x86_64", 10, true, false),
    signals("Unknown", 10, true, false),
    signals("", 0, false, false),
  ])("keeps desktop, laptop and unknown identities playable: %j", (device) => {
    expect(requiresComputerNotice(device)).toBe(false);
  });
  it.each([
    signals("iPhone; CPU iPhone OS 18_0 like Mac OS X", 5, true, false),
    signals("iPad; CPU OS 18_0 like Mac OS X", 5, true, false),
    signals("Linux; Android 15; Pixel 9", 5, true, false),
    signals("Linux; Android 15; Tablet", 5, true, true),
    signals("Macintosh; Intel Mac OS X 10_15_7", 5, true, false),
    signals("Windows Phone 10.0", 5, true, false),
  ])("recognizes phone/tablet signals: %j", (device) => {
    expect(requiresComputerNotice(device)).toBe(true);
  });
});
