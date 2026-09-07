import type { CommittedPack } from "./types";

export interface PackPreparationRequest {
  readonly recipeId: string;
  readonly requestedSeed: number | null;
}

export interface PackBrokerCapability {
  readonly enabled: boolean;
  readonly mode: "disabled" | "server-broker";
  readonly reason: string;
}

export interface PreMatchPackBroker {
  readonly capability: PackBrokerCapability;
  prepare(request: PackPreparationRequest): Promise<CommittedPack<unknown>>;
}

const DISABLED_REASON =
  "PREPARE MATCH requires an approved server-side Moth broker; the static browser build cannot hold a provider credential.";

export class DisabledPreMatchPackBroker implements PreMatchPackBroker {
  public readonly capability = Object.freeze({
    enabled: false,
    mode: "disabled" as const,
    reason: DISABLED_REASON,
  });

  public prepare(_request: PackPreparationRequest): Promise<never> {
    return Promise.reject(new Error(DISABLED_REASON));
  }
}
