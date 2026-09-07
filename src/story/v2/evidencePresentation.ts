import {
  storyTerminal,
  storyTerminalPage,
  type StoryTerminalPage,
  type StoryTerminalSourceStatus,
} from "./terminalModels";
import type {
  StoryV2PresentationEvidence,
  StoryV2PresentationEvidenceDetail,
} from "./types";

export interface StoryV2TerminalDatum {
  readonly label: string;
  readonly value: string;
}

export interface StoryV2TerminalPresentation {
  readonly page: StoryTerminalPage;
  readonly title: string;
  readonly sourceStatus: StoryTerminalSourceStatus | "unbound-legacy";
  readonly evidenceStatus: "bound" | "legacy-identity-only" | "missing";
  readonly sourceLabel: string;
  readonly authorityLabel: string;
  readonly lines: readonly string[];
  readonly identity: readonly StoryV2TerminalDatum[];
  readonly details: readonly StoryV2TerminalDatum[];
}

/**
 * Resolves a terminal page entirely from the frozen qualification receipt.
 * Static terminal models define the conceptual page order; they never invent
 * run-specific provider details when an old save has no bound receipt.
 */
export function storyV2TerminalPresentation(
  pageId: string,
  evidence: StoryV2PresentationEvidence | null,
): StoryV2TerminalPresentation {
  const page = storyTerminalPage(pageId);
  const terminal = storyTerminal(page.chapterId);
  const identity = evidence ? identityData(evidence) : [];

  if (!evidence) {
    return deepFreeze({
      page,
      title: terminal.title,
      sourceStatus: "unbound-legacy",
      evidenceStatus: "missing",
      sourceLabel: "NO QUALIFICATION RECEIPT",
      authorityLabel: "GAMEPLAY AUTHORITY NOT DISPLAYABLE",
      lines: [
        "THIS PRESENTATION HAS NO SAVED QUALIFICATION RECEIPT.",
        "NO PROVIDER, PACK, OR RESULT IDENTITY IS INFERRED.",
      ],
      identity,
      details: [],
    });
  }

  if (evidence.completeness !== "bound" || evidence.detail === null) {
    return deepFreeze({
      page,
      title: terminal.title,
      sourceStatus: "unbound-legacy",
      evidenceStatus: "legacy-identity-only",
      sourceLabel: "LEGACY RUN IDENTITY ONLY",
      authorityLabel: "STAGE RECEIPT UNAVAILABLE",
      lines: evidence.limitations,
      identity,
      details: [],
    });
  }

  const resolved = presentationForDetail(page, evidence.detail);
  return deepFreeze({
    page,
    title: terminal.title,
    sourceStatus: resolved.sourceStatus,
    evidenceStatus: "bound",
    sourceLabel: sourceStatusLabel(resolved.sourceStatus),
    authorityLabel: resolved.gameplayAuthority
      ? "GAMEPLAY AUTHORITY"
      : "COMPARISON ONLY · NOT GAMEPLAY AUTHORITY",
    lines: resolved.lines,
    identity,
    details: resolved.details,
  });
}

function presentationForDetail(
  page: StoryTerminalPage,
  detail: StoryV2PresentationEvidenceDetail,
): Readonly<{
  sourceStatus: StoryTerminalSourceStatus;
  gameplayAuthority: boolean;
  lines: readonly string[];
  details: readonly StoryV2TerminalDatum[];
}> {
  switch (detail.kind) {
    case "qong":
      return qongPresentation(page, detail);
    case "skipixl":
      return skiPixlPresentation(page, detail);
    case "fluxball":
      return fluxballPresentation(page, detail);
    case "quantman":
      return quantmanPresentation(page, detail);
    case "quarry":
      return quarryPresentation(page, detail);
  }
}

function qongPresentation(
  page: StoryTerminalPage,
  detail: Extract<StoryV2PresentationEvidenceDetail, { kind: "qong" }>,
) {
  const selector = detail.selector;
  const result = detail.storedResult;
  if (page.id === "qong-input") {
    return boundPage(detail.sourceStatus, true, page.lines, [
      datum("SELECTOR PACK", selector.selectorPackId),
      datum("SELECTOR SHA-256", selector.selectorContentSha256),
      datum("SELECTOR BITS", selector.bits.join("")),
      datum("SELECTOR INDICES", selector.bitIndices.join(" / ")),
      datum("SELECTED INDEX", String(selector.selectedPackIndex + 1)),
      datum("SELECTED PACK", selector.selectedPackId),
      datum("SELECTED PACK SHA-256", selector.selectedPackContentSha256),
    ]);
  }
  if (
    page.id === "qong-zero" ||
    page.id === "qong-hadamard" ||
    page.id === "qong-measure"
  ) {
    return boundPage(detail.sourceStatus, true, page.lines, []);
  }
  if (page.id === "qong-return") {
    return boundPage(
      detail.sourceStatus,
      true,
      [
        `THE STORED HARDWARE RESULT WAS ${result.outcome.toUpperCase()} / BIT ${result.bit}.`,
        `FOR THIS RALLY, THAT RESULT MEANS ${result.mappedGoal}.`,
      ],
      [
        datum("MOTH JOB", result.mothJobId),
        datum("HARDWARE JOB", result.hardwareJobId),
        datum("BACKEND", result.backendName),
        datum("RAW RESULT SHA-256", result.rawResultSha256),
      ],
    );
  }
  if (page.id === "qong-mapping") {
    return boundPage(detail.sourceStatus, true, page.lines, [
      datum("PLAYED MAPPING", `${result.bit} → ${result.mappedGoal}`),
    ]);
  }
  return boundPage(detail.sourceStatus, true, page.lines, [
    datum("BACKEND", result.backendName),
    datum("ACTIVE PLAY NETWORK", "NONE"),
  ]);
}

function skiPixlPresentation(
  page: StoryTerminalPage,
  detail: Extract<StoryV2PresentationEvidenceDetail, { kind: "skipixl" }>,
) {
  if (page.id === "skipixl-input") {
    return boundPage(
      detail.sourceStatus,
      true,
      [
        `TRIPLET ${detail.tripletId} · CUT ${detail.cutId} · THRESHOLD ${formatNumber(detail.selectionThreshold)}.`,
        "THREE PRESERVED 20 BY 20 SOURCE GRIDS WERE SELECTED BEFORE PLAY.",
      ],
      [
        ...(detail.attempt
          ? [
              datum(
                "ATTEMPT OUTCOME",
                detail.attempt.qualified ? "QUALIFIED" : "LIMIT MISSED",
              ),
              datum(
                "ATTEMPT",
                `${formatNumber(detail.attempt.elapsedSeconds)} SEC · ${detail.attempt.collisionCount} COLLISIONS`,
              ),
              datum(
                "GATES",
                `${detail.attempt.passedGateCount} PASSED · ${detail.attempt.missedGateCount} MISSED`,
              ),
            ]
          : []),
        datum("BANK", detail.bankId),
        datum("BANK SHA-256", detail.bankContentSha256),
        ...detail.segments.flatMap((segment, index) => [
          datum(`SOURCE ${index + 1}`, segment.segmentId),
          datum(`SOURCE ${index + 1} SHA-256`, segment.sourceSha256),
        ]),
      ],
    );
  }
  if (page.id === "skipixl-return") {
    return boundPage(
      detail.sourceStatus,
      true,
      [
        "QPIXL RETURNED THREE NUMERIC FIELDS. IT DID NOT RETURN A FINISHED SLOPE.",
        "THE JOB IDENTITIES AND RETURN HASHES BELOW ARE THE ONES USED BY THIS COURSE.",
      ],
      detail.segments.flatMap((segment, index) => [
        datum(`RETURN ${index + 1}`, segment.returnedValuesSha256),
        datum(`MOTH JOB ${index + 1}`, segment.mothJobId),
        datum(`IBM JOB ${index + 1}`, segment.ibmJobId),
      ]),
    );
  }
  const example = detail.mappedExample;
  return boundPage(
    detail.sourceStatus,
    true,
    [
      `CELL ${example.cellIndex} OF ${example.segmentId} HAS RESIDUAL ${formatNumber(example.residual)}.`,
      `THE LOCAL ${detail.decoderVersion} DECODER PLACED ${example.obstacleId} (${example.kind.toUpperCase()}) AT X ${formatNumber(example.x)}, DISTANCE ${formatNumber(example.distance)}.`,
      example.gateId
        ? `THAT COURSE OBJECT IS LINKED TO GATE ${example.gateId}.`
        : "THIS COURSE OBJECT IS NOT LINKED TO A GATE.",
    ],
    [
      datum("SOURCE CELL", `${example.segmentId}:${example.cellIndex}`),
      datum("COURSE OBJECT", example.obstacleId),
      datum("GATE", example.gateId ?? "NONE"),
    ],
  );
}

function fluxballPresentation(
  page: StoryTerminalPage,
  detail: Extract<StoryV2PresentationEvidenceDetail, { kind: "fluxball" }>,
) {
  const provider = detail.provider;
  if (page.id === "fluxball-input") {
    return boundPage(
      detail.sourceStatus,
      true,
      [
        `ROUND ${detail.roundNumber}, EPOCH ${detail.stateIndex}: FIXTURE ${detail.fixtureId}.`,
        `THE RULE STATE DRAWS FROM SOURCE BUCKETS ${detail.sourceRoundBuckets.join(" AND ")}.`,
      ],
      [
        datum("FIXTURE BANK", detail.fixtureBankId),
        datum("ACQUISITION SOURCE", detail.acquisitionSource),
        datum("RULE MODE", detail.ruleMode.toUpperCase()),
      ],
    );
  }
  if (page.id === "fluxball-return") {
    return boundPage(
      detail.sourceStatus,
      true,
      provider
        ? [
            `THIS EPOCH USES RECORDED MOTH JOB ${provider.mothJobId}.`,
            "THE JOINT DISTRIBUTION WAS FROZEN BEFORE PLAY.",
          ]
        : [
            "THIS EPOCH USES THE INSTALLED LOCAL FALLBACK RECORD.",
            "NO MOTH OR IBM PROVIDER IDENTITY IS CLAIMED FOR THIS EPOCH.",
          ],
      provider
        ? [
            datum("MOTH JOB", provider.mothJobId),
            datum("IBM JOB", provider.ibmJobId ?? "NOT RECORDED"),
            datum("BACKEND", provider.backendName ?? "NOT RECORDED"),
            datum(
              "RAW RESULT SHA-256",
              provider.rawResultSha256 ?? "NOT RECORDED",
            ),
          ]
        : [datum("PROVIDER", "NONE · LOCAL FALLBACK")],
    );
  }
  return boundPage(
    detail.sourceStatus,
    true,
    [
      ...detail.mappedAxes.map(
        (axis) =>
          `${axis.dimension}: ${axis.outcome} → ${axis.playerRules.join(" · ")}.`,
      ),
      detail.ruleMode === "global"
        ? "GLOBAL MODE SHARES ONE RULE TRIPLET."
        : "INDIVIDUAL MODE COUPLES DISTINCT PLAYER RULE TRIPLETS.",
    ],
    [datum("FIXTURE", detail.fixtureId)],
  );
}

function quantmanPresentation(
  page: StoryTerminalPage,
  detail: Extract<StoryV2PresentationEvidenceDetail, { kind: "quantman" }>,
) {
  if (page.id === "quantman-source") {
    const provider = detail.provider;
    return boundPage(
      detail.sourceStatus,
      true,
      [
        "THE MEASUREMENTS CAME FROM IBM FEZ; MAZE DECODING, GAZE, GHOSTS, AND SCORING ARE LOCAL GAME CODE.",
        "ACTIVE PLAY READS THE INSTALLED RETURN AND DOES NOT CONTACT MOTH.",
      ],
      [
        datum("MOTH JOB", provider.mothJobId),
        datum("IBM JOB", provider.hardwareJobId),
        datum("BACKEND", provider.backendName),
        datum("RAW RESULT SHA-256", provider.rawResultSha256),
      ],
    );
  }
  if (page.id === "quantman-input") {
    return boundPage(
      detail.sourceStatus,
      true,
      [
        `THE CLEARED MODE WAS ${detail.mechanic.toUpperCase().replaceAll("-", " ")}.`,
        "THE PLAYED 10 BY 10 MAZE USES AN INSTALLED 100-BIT IBM FEZ RETURN.",
      ],
      [
        ...(detail.topology
          ? [
              datum("MAZE COURSE", detail.topology.label),
              datum("TOPOLOGY ID", detail.topology.topologyId),
              datum("TOPOLOGY SHA-256", detail.topology.authoredTopologySha256),
            ]
          : []),
        datum("FIXTURE", detail.fixtureId),
        datum("CONTENT SHA-256", detail.fixtureContentSha256),
        datum("ENGINE", detail.provider.engineId),
      ],
    );
  }
  if (page.id === "quantman-return") {
    const filtering = detail.filtering;
    return boundPage(
      detail.sourceStatus,
      true,
      [
        `MOTH RETURNED ${detail.provider.returnedMeasurementCount} MEASUREMENTS FROM ${detail.provider.requestedShots} SHOTS.`,
        `LOCAL FILTERING ADMITS ${filtering.admittedRecordCount} INTACT STATES (${filtering.admittedWeight} RETURNED WEIGHT).`,
        "EXCLUDED STATES REMAIN IN THE SOURCE FIXTURE. NO BIT OR WALL IS REPAIRED OR FABRICATED.",
      ],
      [
        ...(detail.bank
          ? [
              datum("BANK", detail.bank.bankId),
              datum("BANK SHA-256", detail.bank.contentSha256),
            ]
          : []),
        datum("MOTH JOB", detail.provider.mothJobId),
        datum("IBM JOB", detail.provider.hardwareJobId),
        datum("BACKEND", detail.provider.backendName),
        datum("FILTER", filtering.filterId),
        datum(
          "EXCLUDED",
          `${filtering.excludedRecordCount} STATES · ${filtering.excludedWeight} WEIGHT`,
        ),
      ],
    );
  }
  const example = detail.bitParityExample;
  return boundPage(
    detail.sourceStatus,
    true,
    [
      `RECORD ${example.recordIndex}: ROOM ${example.roomA} BIT ${example.bitA}; ROOM ${example.roomB} BIT ${example.bitB}.`,
      `${example.equalParity ? "EQUAL" : "UNEQUAL"} PARITY MAPS THAT PASSAGE TO ${example.passage}.`,
      detail.mechanic === "stabilize-gaze"
        ? "STABILIZE GAZE HOLDS THE OBSERVED PASSAGE STATE."
        : "INVERSE GAZE INVERTS THE OBSERVED PASSAGE STATE.",
    ],
    [
      datum(
        "PASSAGE",
        `${example.roomA} ↔ ${example.roomB}: ${example.passage}`,
      ),
    ],
  );
}

function quarryPresentation(
  page: StoryTerminalPage,
  detail: Extract<StoryV2PresentationEvidenceDetail, { kind: "quarry" }>,
) {
  if (page.id === "quarry-input") {
    return boundPage(
      detail.sourceStatus,
      true,
      [
        `ARENA ${detail.arenaId} USES ${detail.sampledSchedule.length} FROZEN 12-BIT RELATION FRAMES.`,
        `BIT ORDER: ${detail.bitOrdering}.`,
      ],
      detail.sampledSchedule.map((phase) =>
        datum(
          `PHASE ${phase.phase} · ${phase.frameId}`,
          `${phase.bitstring} · ${phase.directedRelations.join(" / ") || "NO ACTIVE EDGE"}`,
        ),
      ),
    );
  }
  if (page.id === "quarry-return") {
    const provider = detail.provider;
    const corpusDetails =
      provider.selectedPackId &&
      provider.recipeFamily &&
      provider.realizationId &&
      provider.sourceBankId &&
      provider.sourceBankVersion &&
      provider.redactedRequestSha256
        ? [
            datum("HARDWARE PACK", provider.selectedPackId),
            datum(
              "RECIPE / REALIZATION",
              `${provider.recipeFamily} / ${provider.realizationId}`,
            ),
            datum(
              "SOURCE BANK",
              `${provider.sourceBankId} · ${provider.sourceBankVersion}`,
            ),
            datum("REQUEST SHA-256", provider.redactedRequestSha256),
          ]
        : [];
    return boundPage(
      detail.sourceStatus,
      true,
      [
        `MOTH RETURNED ${provider.returnedMeasurementCount} RANKED OUTCOMES COVERING ${provider.returnedShotCount} OF ${provider.requestedShots} REQUESTED SHOTS.`,
        detail.claimBoundary,
      ],
      [
        ...corpusDetails,
        datum("MOTH JOB", provider.mothJobId),
        datum("IBM JOB", provider.hardwareJobId),
        datum("BACKEND", provider.backendName),
        datum("RAW RESULT SHA-256", provider.rawResultSha256),
        datum(
          "RETURNED MASS",
          `${formatNumber(provider.returnedProbabilityMass)} · ${provider.distributionProjection}`,
        ),
      ],
    );
  }
  if (page.id === "quarry-contrast") {
    return boundPage(
      "recorded-moth-qpu",
      true,
      [
        "FLUXBALL'S SEPARATE BANK CONTAINS 40 RECORDED IBM FEZ QGRAPH RETURNS.",
        "QUARRY USES ONE OF ITS OWN 24 12-QUBIT IBM FEZ RETURNS FOR EACH RUN.",
      ],
      [datum("THIS RUN'S SOURCE", detail.provider.hardwareJobId)],
    );
  }
  const example = detail.relationExample;
  return boundPage(
    detail.sourceStatus,
    true,
    [
      `PHASE ${example.phase}, FRAME ${example.frameId}: ${example.edge.replace(">", " HUNTS ")}.`,
      `THE WHOLE PURSUIT ECOLOGY CHANGES EVERY ${detail.remeasurementIntervalTicks} FIXED TICKS.`,
      "A CAUGHT DUCK RESPAWNS; THE RELATION FRAME STILL WAITS FOR ITS TIMER.",
    ],
    [datum("DIRECTED RELATION", example.edge)],
  );
}

function identityData(
  evidence: StoryV2PresentationEvidence,
): readonly StoryV2TerminalDatum[] {
  const identity = evidence.identity;
  return [
    datum("QUALIFIED RUN", identity.runId),
    datum("STAGE", identity.stageId),
    datum("RULES VERSION", identity.rulesVersion),
    datum("RUN SEED", String(identity.runSeed)),
    datum("ACTIVE TICK", String(identity.activeTick)),
    datum("QUALIFICATION SHA-256", identity.qualificationEvidenceSha256),
    datum("PACK", `${identity.pack.packId} · ${identity.pack.schemaVersion}`),
    datum("PACK SHA-256", identity.pack.contentSha256),
    datum("PACK SOURCE", identity.pack.source),
  ];
}

function boundPage(
  sourceStatus: StoryTerminalSourceStatus,
  gameplayAuthority: boolean,
  lines: readonly string[],
  details: readonly StoryV2TerminalDatum[],
) {
  return { sourceStatus, gameplayAuthority, lines, details } as const;
}

function datum(label: string, value: string): StoryV2TerminalDatum {
  return Object.freeze({ label, value });
}

function sourceStatusLabel(status: StoryTerminalSourceStatus): string {
  switch (status) {
    case "recorded-moth-qpu":
      return "RECORDED MOTH QPU RETURN";
    case "recorded-moth-platform-qpu-capture":
      return "RECORDED MOTH PLATFORM QPU CAPTURE";
    case "recorded-moth-remote-aer":
      return "RECORDED MOTH REMOTE AER RETURN";
    case "local-synthetic-control":
      return "LOCAL SYNTHETIC CONTROL";
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
