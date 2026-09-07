import { PACK_SCHEMA_VERSION, type CommittedPack } from "../../packs/types";
import { validateCommittedPack } from "../../packs/validatePack";
import { QONG_RULES_VERSION, type QongPackPayload } from "./types";

const authoredPack: CommittedPack<QongPackPayload> = {
  schemaVersion: PACK_SCHEMA_VERSION,
  packId: "qong-synthetic-control-v1",
  gameId: "qong",
  engineId: "coin-toss-v1",
  source: "synthetic-control",
  contentSha256:
    "d23fcbf35d80fd452739204b05214f3dcae15d67d148c12b9c7d89b9b8b06230",
  rulesVersion: QONG_RULES_VERSION,
  warnings: [
    "Synthetic equal-weight Direct/Invert control. No Moth job has been submitted or claimed.",
  ],
  mothEvidence: null,
  payload: { directProbability: 0.5 },
};

export const QONG_CONTROL_PACK = validateCommittedPack(
  authoredPack,
  validateQongPayload,
);

function validateQongPayload(value: unknown): QongPackPayload {
  if (
    value === null ||
    typeof value !== "object" ||
    !("directProbability" in value) ||
    typeof value.directProbability !== "number" ||
    !Number.isFinite(value.directProbability) ||
    value.directProbability < 0 ||
    value.directProbability > 1
  ) {
    throw new Error("Qong pack requires a bounded directProbability.");
  }
  const rallyPolarities =
    "rallyPolarities" in value && value.rallyPolarities !== undefined
      ? validateRallyPolarities(value.rallyPolarities)
      : undefined;
  return Object.freeze({
    directProbability: value.directProbability,
    ...(rallyPolarities === undefined ? {} : { rallyPolarities }),
  });
}

function validateRallyPolarities(
  value: unknown,
): readonly ("direct" | "invert")[] {
  if (
    !Array.isArray(value) ||
    value.length !== 7 ||
    value.some((item) => item !== "direct" && item !== "invert")
  ) {
    throw new Error("Qong pack rallyPolarities must contain seven regimes.");
  }
  return Object.freeze([...value]);
}
