export const DISPLAY = Object.freeze({
  width: 320,
  height: 180,
  boardLeft: 90,
  boardTop: 20,
  cellSize: 14,
});

export const TUNING = Object.freeze({
  simulationHz: 60,
  topologyPeriodTicks: 12,
  topologyChangeCueTicks: 6,
  observationRangeRooms: 2,
  observationConeWidthDoubled: 1,
  playerRoomsPerSecond: 3.2,
  ghostRoomsPerSecond: 1.65,
  ghostTunnelSpeedMultiplier: 0.5,
  wallPassTicks: 300,
  ghostEatTicks: 420,
  ghostRespawnTicks: 60,
  respawnInvulnerabilityTicks: 120,
  startingLives: 3,
  pelletScore: 10,
  powerScore: 50,
  levelClearScore: 1_000,
  lifeBonusScore: 500,
  ghostComboScores: Object.freeze([200, 400, 800, 1_600]),
  topologyDiagnosticLimit: 8,
});

export const PALETTE = Object.freeze({
  ink: 0x2b1c14,
  mutedTan: 0x564330,
  cream: 0xd6bd8b,
  inkCss: "#2B1C14",
  mutedTanCss: "#564330",
  creamCss: "#D6BD8B",
});

export const SYNTHETIC_LABEL =
  "SYNTHETIC LABYRINTH GAMEPLAY · CANONICAL QPIXL FIELD IS VISUAL ONLY";
