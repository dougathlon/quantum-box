import type { LabyrinthFixture } from "./types";

export function validateLabyrinthFixture(value: unknown): LabyrinthFixture {
  if (!isRecord(value)) throw new Error("Labyrinth fixture must be an object.");
  if (value["schemaVersion"] !== "labyrinth-measurement-bank-v1")
    throw new Error("Unsupported Labyrinth fixture schema.");
  if (!isNonEmptyString(value["fixtureId"]))
    throw new Error("Labyrinth fixture needs an id.");
  if (!Number.isInteger(value["width"]) || !Number.isInteger(value["height"]))
    throw new Error("Labyrinth dimensions must be integers.");
  const width = value["width"] as number;
  const height = value["height"] as number;
  if (width < 2 || height < 2)
    throw new Error("Labyrinth dimensions are too small.");
  if (value["bitOrder"] !== "row-major-room-index")
    throw new Error("Unsupported Labyrinth bit order.");
  if (value["parityRule"] !== "equal-open-unequal-wall")
    throw new Error("Unsupported Labyrinth parity rule.");
  if (
    typeof value["contentSha256"] !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value["contentSha256"])
  ) {
    throw new Error("Labyrinth fixture requires a SHA-256 content hash.");
  }
  if (!isProvenance(value["provenance"]))
    throw new Error("Labyrinth fixture provenance is incomplete.");
  if (!Array.isArray(value["records"]) || value["records"].length === 0)
    throw new Error("Labyrinth fixture has no measurement records.");
  const roomCount = width * height;
  for (const [index, record] of value["records"].entries()) {
    if (
      !isRecord(record) ||
      typeof record["bitstring"] !== "string" ||
      record["bitstring"].length !== roomCount ||
      /[^01]/u.test(record["bitstring"])
    ) {
      throw new Error(
        `Labyrinth record ${index} is not a ${roomCount}-bit state.`,
      );
    }
    if (
      !Number.isSafeInteger(record["weight"]) ||
      (record["weight"] as number) <= 0
    ) {
      throw new Error(
        `Labyrinth record ${index} has an invalid integer weight.`,
      );
    }
  }
  return value as unknown as LabyrinthFixture;
}

function isProvenance(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value["sourceType"] !== "synthetic" && value["sourceType"] !== "qpu")
    return false;
  if (
    !isNonEmptyString(value["label"]) ||
    !isNonEmptyString(value["generatorOrProvider"])
  )
    return false;
  if (!isNonEmptyString(value["acquisitionOrGenerationDate"])) return false;
  if (
    value["sourceType"] === "qpu" &&
    (value["engineId"] !== "labyrinth-v1" ||
      !isNonEmptyString(value["backend"]) ||
      !isNonEmptyString(value["jobId"]) ||
      !isNonEmptyString(value["mothJobId"]) ||
      !isNonEmptyString(value["hardwareJobId"]) ||
      value["jobId"] !== value["hardwareJobId"] ||
      typeof value["rawResultSha256"] !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value["rawResultSha256"]) ||
      !Number.isSafeInteger(value["shots"]) ||
      (value["shots"] as number) <= 0)
  ) {
    return false;
  }
  return (
    Array.isArray(value["limits"]) && value["limits"].every(isNonEmptyString)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
