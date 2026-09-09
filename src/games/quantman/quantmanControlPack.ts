import archiveMazePayload from "./packs/archive-maze-v1.json" with { type: "json" };
import labyrinthPreview from "./packs/moth-labyrinth-emu-4x5-preview-v1.json" with { type: "json" };
import { PACK_SCHEMA_VERSION, type CommittedPack } from "../../packs/types";
import { validateCommittedPack } from "../../packs/validatePack";
import {
  QUANTMAN_RULES_VERSION,
  type QuantmanCell,
  type QuantmanFragment,
  type QuantmanLabyrinthAcquisition,
  type QuantmanLabyrinthEnsemble,
  type QuantmanLabyrinthState,
  type QuantmanPackPayload,
  type QuantmanPursuerDefinition,
  type QuantmanTopologyDoor,
} from "./types";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export const QUANTMAN_MAZE_SOURCE_SHA256 =
  "2854e4fa16287d827ee48b930298cea2dd4cf5039ad85065760ea340dd8b05b2";
export const QUANTMAN_LABYRINTH_PREVIEW_BYTES_SHA256 =
  "a30e43609fc2c7f966f842f717f68b2a992155c7976125f6344e04644e303ffd";
export const QUANTMAN_CONTROL_PACK_SHA256 =
  "8ac6dc4030cab6d70a1a019ab2d7ccd47e1d2c405312da930a5db4930440be98";

export type QuantmanCommittedPack = CommittedPack<QuantmanPackPayload>;

const payload = validateQuantmanPayload({
  ...expandArchiveMaze(archiveMazePayload),
  labyrinthEnsemble: labyrinthPreview,
});

export const QUANTMAN_CONTROL_PACK: QuantmanCommittedPack =
  validateCommittedPack<QuantmanPackPayload>(
    {
      schemaVersion: PACK_SCHEMA_VERSION,
      packId: "quantman-moth-labyrinth-emu-4x5-v2",
      gameId: "quantman",
      engineId: "labyrinth-v1",
      source: "moth-api-emulator",
      contentSha256: QUANTMAN_CONTROL_PACK_SHA256,
      rulesVersion: QUANTMAN_RULES_VERSION,
      warnings: [
        "The source ensemble is authentic Moth API output from remote Aer emulation; it is not QPU or hardware evidence.",
        "The bit order and parity decoder are result-specific implementation evidence, not a provider-published general schema.",
        "The original maze-chase board remains traversable while parity-derived doors create and remove optional shortcuts after accepted turns.",
        "Runtime topology selection is a deterministic local simulation over the installed remote-Aer ensemble; it is not a live provider request or QPU evidence.",
      ],
      mothEvidence: {
        engineId: payload.labyrinthEnsemble.acquisition.engineId,
        engineUpdatedAt: payload.labyrinthEnsemble.acquisition.engineUpdatedAt,
        canonicalEngineRecordSha256:
          payload.labyrinthEnsemble.acquisition.engineCanonicalSha256,
        apiSpecificationCanonicalSha256:
          payload.labyrinthEnsemble.acquisition.apiSpecificationCanonicalSha256,
        jobId: null,
        jobIdentitySha256:
          payload.labyrinthEnsemble.acquisition.jobIdentitySha256,
        observedStatuses: ["queued", "processing", "completed"],
        rawResultSha256: payload.labyrinthEnsemble.acquisition.rawResultSha256,
        executionMode: payload.labyrinthEnsemble.acquisition.mode,
      },
      payload,
    },
    validateQuantmanPayload,
  );

function expandArchiveMaze(input: typeof archiveMazePayload) {
  const powerCells = new Set(
    input.powerPellets.map((cell) => `${cell.row}:${cell.col}`),
  );
  const excludedCells = new Set([
    `${input.playerStart.row}:${input.playerStart.col}`,
    `${input.exit.row}:${input.exit.col}`,
    ...input.pursuers.map((pursuer) => `${pursuer.row}:${pursuer.col}`),
  ]);
  const fragments: QuantmanFragment[] = [];
  for (let row = 0; row < input.rows.length; row += 1) {
    for (let col = 0; col < input.width; col += 1) {
      const key = `${row}:${col}`;
      if (input.rows[row]?.[col] !== "." || excludedCells.has(key)) continue;
      fragments.push(
        Object.freeze({
          fragmentId: `pellet-${String(row).padStart(2, "0")}-${String(col).padStart(2, "0")}`,
          row,
          col,
          kind: powerCells.has(key) ? "power" : "pellet",
        }),
      );
    }
  }
  return {
    ...input,
    fragments,
    requiredFragments: fragments.length,
  };
}

export function validateQuantmanPayload(value: unknown): QuantmanPackPayload {
  if (!isRecord(value)) throw new Error("Quantman payload must be an object.");
  const mazeId = requireString(value, "mazeId");
  const mazeLabel = requireString(value, "mazeLabel");
  const width = requireInteger(value, "width", 9, 31);
  const height = requireInteger(value, "height", 7, 21);
  const tileSize = requireInteger(value, "tileSize", 16, 40);
  const originX = requireInteger(value, "originX", 0, 640);
  const originY = requireInteger(value, "originY", 0, 360);
  if (originX + width * tileSize > 640 || originY + height * tileSize > 360) {
    throw new Error("Quantman maze must fit inside the 640 by 360 screen.");
  }
  const rows = requireArray(value, "rows").map((row, index) => {
    if (typeof row !== "string" || row.length !== width || /[^#.]/.test(row)) {
      throw new Error(`Quantman maze row ${index} is invalid.`);
    }
    return row;
  });
  if (rows.length !== height) {
    throw new Error("Quantman maze height does not match its row count.");
  }
  const tunnelRows = requireArray(value, "tunnelRows").map((row, index) => {
    if (
      !Number.isSafeInteger(row) ||
      (row as number) <= 0 ||
      (row as number) >= height - 1
    ) {
      throw new Error(`Quantman tunnel row ${index} is invalid.`);
    }
    return row as number;
  });
  if (new Set(tunnelRows).size !== tunnelRows.length) {
    throw new Error("Quantman tunnel rows must be unique.");
  }
  if (
    rows[0] !== "#".repeat(width) ||
    rows[height - 1] !== "#".repeat(width) ||
    rows.some((row, index) =>
      tunnelRows.includes(index)
        ? row[0] !== "." || row[row.length - 1] !== "."
        : row[0] !== "#" || row[row.length - 1] !== "#",
    )
  ) {
    throw new Error(
      "Quantman maze requires a closed border except at paired tunnels.",
    );
  }

  const playerStart = validateCell(value["playerStart"], "playerStart");
  const exit = validateCell(value["exit"], "exit");
  const requiredFragments = requireInteger(value, "requiredFragments", 1, 400);
  const startingLives = requireInteger(value, "startingLives", 1, 9);
  const timeLimitSeconds = requireInteger(value, "timeLimitSeconds", 30, 600);
  const playerSpeed = requireNumber(value, "playerSpeed", 40, 180);
  const fragments = requireArray(value, "fragments").map((item, index) =>
    validateFragment(item, index),
  );
  if (requiredFragments > fragments.length) {
    throw new Error("Quantman requires more fragments than the maze contains.");
  }
  if (
    new Set(fragments.map((item) => item.fragmentId)).size !== fragments.length
  ) {
    throw new Error("Quantman fragment IDs must be unique.");
  }

  const labyrinthEnsemble = validateLabyrinthEnsemble(
    value["labyrinthEnsemble"],
  );
  const labyrinthBlueprint = deepFreeze({
    gridRows: labyrinthEnsemble.rows,
    gridCols: labyrinthEnsemble.columns,
    numQubits: labyrinthEnsemble.numQubits,
    roomOrder: "row-major" as const,
    couplingMap: labyrinthEnsemble.couplingMap.map(({ a, b }) =>
      Object.freeze([a, b] as const),
    ),
  });
  const topologyDoors = requireArray(value, "topologyDoors").map(
    (item, index) =>
      validateTopologyDoor(
        item,
        index,
        rows,
        labyrinthBlueprint.gridCols,
        labyrinthBlueprint.numQubits,
      ),
  );
  if (topologyDoors.length < 8) {
    throw new Error("Quantman requires at least eight topology doors.");
  }
  if (
    new Set(topologyDoors.map((door) => door.doorId)).size !==
      topologyDoors.length ||
    new Set(topologyDoors.map((door) => `${door.row}:${door.col}`)).size !==
      topologyDoors.length
  ) {
    throw new Error("Quantman topology doors must have unique IDs and cells.");
  }

  const pursuers = requireArray(value, "pursuers").map((item, index) =>
    validatePursuer(item, index),
  );
  if (pursuers.length !== 4) {
    throw new Error("Quantman requires four distinct pursuers.");
  }
  if (
    new Set(pursuers.map((pursuer) => pursuer.pursuerId)).size !==
    pursuers.length
  ) {
    throw new Error("Quantman pursuer IDs must be unique.");
  }
  const visualSeed = requireInteger(value, "visualSeed", 0, 0xffffffff);

  const requiredCells = [
    playerStart,
    exit,
    ...fragments,
    ...pursuers.flatMap((pursuer) => [pursuer, ...pursuer.patrol]),
  ];
  for (const cell of requiredCells) requireWalkable(rows, cell);
  const reachable = reachableCells(rows, playerStart);
  for (const cell of requiredCells) {
    if (!reachable.has(cellKey(cell))) {
      throw new Error(
        `Quantman required cell ${cell.row},${cell.col} is unreachable.`,
      );
    }
  }
  for (const state of labyrinthEnsemble.states) {
    const stateRows = topologyRows(rows, topologyDoors, state);
    const stateReachable = reachableCells(stateRows, playerStart);
    for (const cell of requiredCells) {
      if (!stateReachable.has(cellKey(cell))) {
        throw new Error(
          `Quantman Labyrinth state ${state.stateId} makes ${cell.row},${cell.col} unreachable.`,
        );
      }
    }
  }

  return deepFreeze({
    mazeId,
    mazeLabel,
    width,
    height,
    tileSize,
    originX,
    originY,
    rows,
    playerStart,
    exit,
    requiredFragments,
    startingLives,
    timeLimitSeconds,
    playerSpeed,
    fragments,
    tunnelRows,
    labyrinthBlueprint,
    topologyDoors,
    labyrinthEnsemble,
    pursuers,
    visualSeed,
  });
}

function validateLabyrinthEnsemble(value: unknown): QuantmanLabyrinthEnsemble {
  if (!isRecord(value)) {
    throw new Error("Quantman Labyrinth ensemble must be an object.");
  }
  if (
    value["schemaVersion"] !== "quantum-rat-race-fixture-v2" ||
    value["sourceClassification"] !== "moth-derived-preview" ||
    value["rows"] !== 4 ||
    value["columns"] !== 5 ||
    value["numQubits"] !== 20 ||
    value["roomNumbering"] !== "row-major" ||
    value["bitstringOrder"] !== "qubit-0-leftmost" ||
    value["requestedShots"] !== 128 ||
    value["effectiveShots"] !== 128 ||
    value["countSum"] !== 128
  ) {
    throw new Error("Quantman Labyrinth ensemble identity is unsupported.");
  }
  const decoder = value["decoder"];
  if (
    !isRecord(decoder) ||
    decoder["id"] !== "moth-labyrinth-zz-parity-v1" ||
    decoder["version"] !== "1"
  ) {
    throw new Error("Quantman Labyrinth decoder is unsupported.");
  }
  const acquisition = validateAcquisition(value["acquisition"]);
  const couplingMap = requireArray(value, "couplingMap").map((edge, index) => {
    if (!isRecord(edge)) {
      throw new Error(`Quantman Labyrinth edge ${index} is invalid.`);
    }
    const [a, b] = validateCoupling([edge["a"], edge["b"]], index, 5, 20);
    return Object.freeze({ a, b });
  });
  const states = requireArray(value, "states").map((state, index) =>
    validateLabyrinthState(state, index),
  );
  if (
    states.length !== 128 ||
    new Set(states.map((state) => state.bitstring)).size !== 128 ||
    new Set(states.map((state) => state.stateId)).size !== 128
  ) {
    throw new Error(
      "Quantman requires 128 distinct Labyrinth states and state IDs.",
    );
  }
  if (states.reduce((sum, state) => sum + state.count, 0) !== 128) {
    throw new Error("Quantman Labyrinth state counts must sum to 128.");
  }
  const warnings = requireArray(value, "warnings").map((warning, index) => {
    if (typeof warning !== "string" || warning.length === 0) {
      throw new Error(`Quantman Labyrinth warning ${index} is invalid.`);
    }
    return warning;
  });
  return deepFreeze({
    schemaVersion: "quantum-rat-race-fixture-v2",
    fixtureId: requireString(value, "fixtureId"),
    fixtureSha256: requireSha256(value, "fixtureSha256"),
    provenanceSha256: requireSha256(value, "provenanceSha256"),
    sourceClassification: "moth-derived-preview",
    rows: 4,
    columns: 5,
    numQubits: 20,
    roomNumbering: "row-major",
    bitstringOrder: "qubit-0-leftmost",
    requestedShots: 128,
    effectiveShots: 128,
    countSum: 128,
    decoder: { id: "moth-labyrinth-zz-parity-v1", version: "1" },
    couplingMap,
    states,
    acquisition,
    warnings,
  });
}

function validateAcquisition(value: unknown): QuantmanLabyrinthAcquisition {
  if (!isRecord(value)) {
    throw new Error("Quantman Labyrinth acquisition is missing.");
  }
  if (
    value["engineId"] !== "labyrinth-v1" ||
    value["mode"] !== "remote-simulator" ||
    value["backend"] !== "aer" ||
    value["mothApi"] !== true ||
    value["remoteService"] !== true ||
    value["qpu"] !== false ||
    value["requestedShots"] !== 128 ||
    value["effectiveShots"] !== 128 ||
    value["terminalStatus"] !== "completed"
  ) {
    throw new Error("Quantman Labyrinth acquisition claim is inconsistent.");
  }
  return deepFreeze({
    engineId: "labyrinth-v1",
    engineUpdatedAt: requireString(value, "engineUpdatedAt"),
    engineCanonicalSha256: requireSha256(value, "engineCanonicalSha256"),
    apiSpecificationCanonicalSha256: requireSha256(
      value,
      "apiSpecificationCanonicalSha256",
    ),
    jobIdentitySha256: requireSha256(value, "jobIdentitySha256"),
    rawResultSha256: requireSha256(value, "rawResultSha256"),
    requestSha256: requireSha256(value, "requestSha256"),
    normalizedCountsSha256: requireSha256(value, "normalizedCountsSha256"),
    mode: "remote-simulator",
    backend: "aer",
    mothApi: true,
    remoteService: true,
    qpu: false,
    requestedShots: 128,
    effectiveShots: 128,
    submittedAtUtc: requireString(value, "submittedAtUtc"),
    terminalObservedAtUtc: requireString(value, "terminalObservedAtUtc"),
    retrievedAtUtc: requireString(value, "retrievedAtUtc"),
    terminalStatus: "completed",
  });
}

function validateLabyrinthState(
  value: unknown,
  index: number,
): QuantmanLabyrinthState {
  if (!isRecord(value)) {
    throw new Error(`Quantman Labyrinth state ${index} is invalid.`);
  }
  const bitstring = requireString(value, "bitstring");
  if (bitstring.length !== 20 || /[^01]/.test(bitstring)) {
    throw new Error(`Quantman Labyrinth state ${index} needs twenty bits.`);
  }
  return Object.freeze({
    stateId: requireString(value, "stateId"),
    bitstring,
    count: requireInteger(value, "count", 1, 128),
    logicalStateSha256: requireSha256(value, "logicalStateSha256"),
  });
}

function validateTopologyDoor(
  value: unknown,
  index: number,
  rows: readonly string[],
  gridCols: number,
  numQubits: number,
): QuantmanTopologyDoor {
  if (!isRecord(value)) {
    throw new Error(`Quantman topology door ${index} is invalid.`);
  }
  const row = requireInteger(value, "row", 1, rows.length - 2);
  const col = requireInteger(value, "col", 1, rows[0]!.length - 2);
  if (rows[row]?.[col] !== "#") {
    throw new Error(`Quantman topology door ${index} must replace a wall.`);
  }
  const orientation = value["orientation"];
  if (orientation !== "horizontal" && orientation !== "vertical") {
    throw new Error(`Quantman topology door ${index} orientation is invalid.`);
  }
  const expectedOpening =
    orientation === "horizontal"
      ? rows[row]?.[col - 1] === "." && rows[row]?.[col + 1] === "."
      : rows[row - 1]?.[col] === "." && rows[row + 1]?.[col] === ".";
  if (!expectedOpening) {
    throw new Error(`Quantman topology door ${index} joins no corridor.`);
  }
  const sourceRooms = validateCoupling(
    value["sourceRooms"],
    index,
    gridCols,
    numQubits,
  );
  return Object.freeze({
    doorId: requireString(value, "doorId"),
    row,
    col,
    orientation,
    sourceRooms,
  });
}

function validateCell(value: unknown, label: string): QuantmanCell {
  if (!isRecord(value)) throw new Error(`Quantman ${label} is invalid.`);
  return Object.freeze({
    row: requireInteger(value, "row", 0, 100),
    col: requireInteger(value, "col", 0, 100),
  });
}

function validateFragment(value: unknown, index: number): QuantmanFragment {
  if (!isRecord(value)) {
    throw new Error(`Quantman fragment ${index} is invalid.`);
  }
  const kind = value["kind"];
  if (kind !== "pellet" && kind !== "power") {
    throw new Error(`Quantman fragment ${index} kind is unsupported.`);
  }
  return Object.freeze({
    fragmentId: requireString(value, "fragmentId"),
    kind,
    ...validateCell(value, `fragment ${index}`),
  });
}

function validatePursuer(
  value: unknown,
  index: number,
): QuantmanPursuerDefinition {
  if (!isRecord(value)) {
    throw new Error(`Quantman pursuer ${index} is invalid.`);
  }
  const cell = validateCell(value, `pursuer ${index}`);
  const tone = value["tone"];
  if (
    tone !== "orange" &&
    tone !== "avocado" &&
    tone !== "blue" &&
    tone !== "cream"
  ) {
    throw new Error(`Quantman pursuer ${index} tone is unsupported.`);
  }
  const role = value["role"];
  if (
    role !== "direct" &&
    role !== "ambush" &&
    role !== "flank" &&
    role !== "wander"
  ) {
    throw new Error(`Quantman pursuer ${index} role is unsupported.`);
  }
  const patrol = requireArray(value, "patrol").map((item, patrolIndex) =>
    validateCell(item, `pursuer ${index} patrol ${patrolIndex}`),
  );
  if (patrol.length < 2) {
    throw new Error(`Quantman pursuer ${index} requires a patrol route.`);
  }
  return Object.freeze({
    pursuerId: requireString(value, "pursuerId"),
    role,
    ...cell,
    speed: requireNumber(value, "speed", 20, 100),
    basePerceptionTiles: requireNumber(value, "basePerceptionTiles", 1, 40),
    decisionIntervalTicks: requireInteger(
      value,
      "decisionIntervalTicks",
      4,
      120,
    ),
    hesitationTicks: requireInteger(value, "hesitationTicks", 0, 120),
    tone,
    patrol,
  });
}

function validateCoupling(
  value: unknown,
  index: number,
  cols: number,
  numQubits: number,
): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`Quantman coupling ${index} is invalid.`);
  }
  const [left, right] = value;
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    (left as number) < 0 ||
    (right as number) >= numQubits ||
    (left as number) >= (right as number)
  ) {
    throw new Error(`Quantman coupling ${index} has invalid room IDs.`);
  }
  const distance =
    Math.abs(
      Math.floor((left as number) / cols) -
        Math.floor((right as number) / cols),
    ) + Math.abs(((left as number) % cols) - ((right as number) % cols));
  if (distance !== 1) {
    throw new Error(`Quantman coupling ${index} is not grid-adjacent.`);
  }
  return Object.freeze([left as number, right as number]);
}

function reachableCells(
  rows: readonly string[],
  start: QuantmanCell,
): ReadonlySet<string> {
  const visited = new Set<string>([cellKey(start)]);
  const queue: QuantmanCell[] = [start];
  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell) continue;
    for (const [rowDelta, colDelta] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const next = { row: cell.row + rowDelta, col: cell.col + colDelta };
      const key = cellKey(next);
      if (visited.has(key) || rows[next.row]?.[next.col] !== ".") continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return visited;
}

function topologyRows(
  rows: readonly string[],
  doors: readonly QuantmanTopologyDoor[],
  state: QuantmanLabyrinthState,
): readonly string[] {
  const transformed = rows.map((row) => [...row]);
  for (const door of doors) {
    const [left, right] = door.sourceRooms;
    if (state.bitstring[left] === state.bitstring[right]) {
      transformed[door.row]![door.col] = ".";
    }
  }
  return transformed.map((row) => row.join(""));
}

function requireWalkable(rows: readonly string[], cell: QuantmanCell): void {
  if (rows[cell.row]?.[cell.col] !== ".") {
    throw new Error(
      `Quantman required cell ${cell.row},${cell.col} must be walkable.`,
    );
  }
}

function cellKey(cell: QuantmanCell): string {
  return `${cell.row}:${cell.col}`;
}

function requireArray(
  value: Record<string, unknown>,
  key: string,
): readonly unknown[] {
  const item = value[key];
  if (!Array.isArray(item)) {
    throw new Error(`Quantman ${key} must be an array.`);
  }
  return item;
}

function requireString(value: Record<string, unknown>, key: string): string {
  const item = value[key];
  if (typeof item !== "string" || item.trim().length === 0) {
    throw new Error(`Quantman ${key} must be a non-empty string.`);
  }
  return item;
}

function requireSha256(value: Record<string, unknown>, key: string): string {
  const item = requireString(value, key);
  if (!SHA256_PATTERN.test(item)) {
    throw new Error(`Quantman ${key} must be a SHA-256 digest.`);
  }
  return item;
}

function requireNumber(
  value: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const item = value[key];
  if (
    typeof item !== "number" ||
    !Number.isFinite(item) ||
    item < minimum ||
    item > maximum
  ) {
    throw new Error(
      `Quantman ${key} must be between ${minimum} and ${maximum}.`,
    );
  }
  return item;
}

function requireInteger(
  value: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const item = requireNumber(value, key, minimum, maximum);
  if (!Number.isSafeInteger(item)) {
    throw new Error(`Quantman ${key} must be an integer.`);
  }
  return item;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
