import { describe, expect, it } from "vitest";

import { DisabledPreMatchPackBroker } from "../../src/packs/PackBroker";

describe("DisabledPreMatchPackBroker", () => {
  it("fails closed without issuing any request", async () => {
    const broker = new DisabledPreMatchPackBroker();

    expect(broker.capability.enabled).toBe(false);
    expect(broker.capability.mode).toBe("disabled");
    await expect(
      broker.prepare({ recipeId: "qong-seven-rallies", requestedSeed: 41 }),
    ).rejects.toThrow("approved server-side Moth broker");
  });
});
