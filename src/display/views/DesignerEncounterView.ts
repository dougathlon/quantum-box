import Phaser from "phaser";
import type { DesignerEncounterSnapshot } from "../../story/DesignerEncounter";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import {
  CANONICAL_SPRITE_PIXEL_SCALE,
  drawCanonicalSprite,
} from "../CanonicalSpriteRaster";

export function renderDesignerEncounter(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
): void {
  const g = graphics.clear();
  switch (snapshot.gameId) {
    case "qong":
      renderQongEncounter(g, snapshot);
      return;
    case "skipixl":
      renderSkiPixlEncounter(g, snapshot);
      return;
    case "fluxball":
      renderFluxballEncounter(g, snapshot);
      return;
    case "quantman":
      renderQuantmanEncounter(g, snapshot);
      return;
  }
}

function renderQongEncounter(
  g: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
): void {
  if (isWorldPhase(snapshot)) {
    drawQongCourt(g);
    drawPlayer(g, snapshot, snapshot.playerX, 278);
    drawMorphingDesigner(g, snapshot, "qong-paddle-to-wizard", 486, 258);
    drawApproachLine(g, snapshot, 448, 244);
    return;
  }

  drawQongServiceBay(g);
  drawPlayer(g, snapshot, 92, 278);
  drawWizard(g, snapshot, 532, 274);
  drawMechanism(g, snapshot);
}

function renderFluxballEncounter(
  g: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
): void {
  if (isWorldPhase(snapshot)) {
    drawFluxballPitch(g);
    drawPlayer(g, snapshot, snapshot.playerX, 278);
    drawMorphingDesigner(g, snapshot, "fluxball-player-a-to-wizard", 482, 270);
    drawApproachLine(g, snapshot, 442, 244);
    return;
  }

  drawFluxballClubhouse(g);
  drawPlayer(g, snapshot, 92, 278);
  drawWizard(g, snapshot, 530, 274);
  drawMechanism(g, snapshot);
}

function renderQuantmanEncounter(
  g: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
): void {
  if (isWorldPhase(snapshot)) {
    drawQuantmanMaze(g);
    drawPlayer(g, snapshot, snapshot.playerX, 278);
    drawMorphingDesigner(g, snapshot, "quantman-ghost-c-to-wizard", 482, 270);
    drawApproachLine(g, snapshot, 442, 244);
    return;
  }

  drawQuantmanObservationRoom(g);
  drawPlayer(g, snapshot, 92, 278);
  drawWizard(g, snapshot, 530, 274);
  drawMechanism(g, snapshot);
}

function isWorldPhase(snapshot: DesignerEncounterSnapshot): boolean {
  return snapshot.phase === "approach" || snapshot.phase === "dialogue";
}

function drawMorphingDesigner(
  g: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
  fileId:
    | "qong-paddle-to-wizard"
    | "fluxball-player-a-to-wizard"
    | "quantman-ghost-c-to-wizard",
  x: number,
  baseline: number,
): void {
  const frame = designerMorphFrame(snapshot.phase, snapshot.dialogueIndex);
  drawCanonicalSprite(g, fileId, `morph-${frame}`, {
    pixel: CANONICAL_SPRITE_PIXEL_SCALE,
    centerX: x,
    bottomY: baseline,
  });
}

export function designerMorphFrame(
  phase: DesignerEncounterSnapshot["phase"],
  dialogueIndex: number,
): number {
  if (phase === "approach") return 0;
  if (phase === "dialogue") return Math.min(6, 2 + dialogueIndex * 2);
  return 6;
}

function drawPlayer(
  g: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
  x: number,
  baseline: number,
): void {
  const frameId =
    snapshot.phase === "approach"
      ? Math.floor(snapshot.playerX / 52) % 2 === 0
        ? "right-idle"
        : "right-walk"
      : "front-idle";
  drawCanonicalSprite(g, "player-c-four-direction-walk-strip", frameId, {
    pixel: CANONICAL_SPRITE_PIXEL_SCALE,
    centerX: x,
    bottomY: baseline,
  });
}

function drawWizard(
  g: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
  x: number,
  baseline: number,
): void {
  const frameId =
    snapshot.phase === "dialogue"
      ? snapshot.dialogueIndex % 2 === 0
        ? "talk-a"
        : "talk-b"
      : snapshot.phase === "mechanism"
        ? snapshot.mechanismStep % 2 === 0
          ? "point-right"
          : "gesture-open"
        : snapshot.phase === "recovered"
          ? "gesture-raised"
          : "idle";
  drawCanonicalSprite(g, "designer-wizard-action-strip", frameId, {
    pixel: CANONICAL_SPRITE_PIXEL_SCALE,
    centerX: x,
    bottomY: baseline,
  });
}

function drawApproachLine(
  g: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
  destinationX: number,
  y: number,
): void {
  if (snapshot.phase !== "approach") return;
  g.lineStyle(3, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(snapshot.playerX + 24, y, destinationX, y);
}

function drawQongCourt(g: Phaser.GameObjects.Graphics): void {
  const cream = BROWN_BOX_PALETTE.cream;
  g.lineStyle(3, cream, 1).strokeRect(70, 42, 500, 214);
  for (let y = 48; y < 250; y += 20) g.fillRect(318, y, 4, 10);
  g.fillStyle(cream, 1).fillRect(92, 128, 8, 48);
  g.fillRect(302, 146, 12, 12);
  g.lineStyle(3, cream, 1).lineBetween(70, 278, 570, 278);
}

function drawQongServiceBay(g: Phaser.GameObjects.Graphics): void {
  drawMechanismRoom(g);
  const cream = BROWN_BOX_PALETTE.cream;
  g.lineStyle(3, cream, 1);
  g.lineBetween(44, 70, 172, 70);
  g.lineBetween(44, 92, 154, 92);
  g.strokeRect(476, 56, 106, 94);
  g.fillStyle(cream, 1).fillRect(492, 74, 10, 58);
  g.fillRect(552, 74, 10, 58);
}

function drawFluxballPitch(g: Phaser.GameObjects.Graphics): void {
  const cream = BROWN_BOX_PALETTE.cream;
  g.lineStyle(3, cream, 1).strokeRect(60, 42, 520, 214);
  g.lineBetween(320, 42, 320, 256);
  g.strokeCircle(320, 149, 48);
  g.strokeRect(60, 101, 42, 96);
  g.strokeRect(538, 101, 42, 96);
  g.fillStyle(cream, 1).fillCircle(320, 149, 8);
  g.lineStyle(3, cream, 1).lineBetween(60, 278, 580, 278);
}

function drawFluxballClubhouse(g: Phaser.GameObjects.Graphics): void {
  drawMechanismRoom(g);
  const cream = BROWN_BOX_PALETTE.cream;
  g.lineStyle(3, cream, 1).strokeRect(42, 52, 132, 98);
  g.lineBetween(42, 82, 174, 82);
  g.lineBetween(84, 82, 84, 150);
  g.lineBetween(132, 82, 132, 150);
  g.strokeCircle(534, 102, 40);
  g.lineBetween(494, 102, 574, 102);
  g.lineBetween(534, 62, 534, 142);
}

function drawQuantmanMaze(g: Phaser.GameObjects.Graphics): void {
  const cream = BROWN_BOX_PALETTE.cream;
  g.lineStyle(4, cream, 1).strokeRect(34, 34, 572, 240);
  g.lineBetween(34, 100, 216, 100);
  g.lineBetween(278, 100, 476, 100);
  g.lineBetween(536, 100, 606, 100);
  g.lineBetween(156, 100, 156, 206);
  g.lineBetween(156, 206, 318, 206);
  g.lineBetween(382, 206, 522, 206);
  g.lineBetween(522, 100, 522, 206);
  g.fillStyle(cream, 1).fillRect(238, 146, 8, 8);
  g.fillRect(396, 146, 8, 8);
  g.lineStyle(3, cream, 1).lineBetween(34, 292, 606, 292);
}

function drawQuantmanObservationRoom(g: Phaser.GameObjects.Graphics): void {
  drawMechanismRoom(g);
  const cream = BROWN_BOX_PALETTE.cream;
  g.lineStyle(3, cream, 1);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      g.strokeRect(42 + column * 30, 58 + row * 30, 23, 23);
    }
  }
  g.strokeRect(490, 54, 88, 98);
  g.lineBetween(534, 54, 534, 152);
  g.lineBetween(490, 103, 578, 103);
}

function drawMechanismRoom(g: Phaser.GameObjects.Graphics): void {
  const cream = BROWN_BOX_PALETTE.cream;
  g.lineStyle(3, cream, 1).strokeRect(24, 22, 592, 306);
  g.lineBetween(24, 278, 616, 278);
  g.fillStyle(cream, 1).fillRect(260, 238, 120, 8);
  g.fillRect(272, 246, 8, 32);
  g.fillRect(360, 246, 8, 32);
}

function renderSkiPixlEncounter(
  g: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
): void {
  if (snapshot.phase === "approach" || snapshot.phase === "dialogue") {
    drawLodgeExterior(g);
    drawPlayer(g, snapshot, snapshot.playerX, 272);
    drawWizard(g, snapshot, 470, 272);
    if (snapshot.phase === "approach") {
      g.lineStyle(3, BROWN_BOX_PALETTE.cream, 1);
      g.lineBetween(snapshot.playerX + 24, 240, 432, 240);
    }
    return;
  }

  drawLodgeInterior(g);
  drawPlayer(g, snapshot, 96, 276);
  drawWizard(g, snapshot, 526, 276);
  drawMechanism(g, snapshot);
}

function drawLodgeExterior(g: Phaser.GameObjects.Graphics): void {
  const cream = BROWN_BOX_PALETTE.cream;
  const dark = BROWN_BOX_PALETTE.ink;
  g.lineStyle(3, cream, 1).lineBetween(0, 272, 640, 272);

  // A compact, unmistakable lodge rather than the generic tutorial frame.
  g.fillStyle(dark, 1).fillRect(350, 126, 236, 146);
  g.lineStyle(4, cream, 1).strokeRect(350, 126, 236, 146);
  g.lineBetween(330, 128, 468, 58);
  g.lineBetween(468, 58, 606, 128);
  g.lineBetween(330, 128, 606, 128);
  g.strokeRect(444, 194, 48, 78);
  g.fillStyle(cream, 1).fillRect(477, 231, 5, 5);
  g.strokeRect(374, 156, 44, 35);
  g.strokeRect(518, 156, 44, 35);
  g.lineBetween(396, 156, 396, 191);
  g.lineBetween(540, 156, 540, 191);

  drawLodgeTree(g, 120, 272);
  drawLodgeTree(g, 246, 272);
  g.lineStyle(3, cream, 1);
  g.lineBetween(34, 310, 212, 310);
  g.lineBetween(226, 326, 332, 326);
}

function drawLodgeTree(
  g: Phaser.GameObjects.Graphics,
  x: number,
  baseline: number,
): void {
  const cream = BROWN_BOX_PALETTE.cream;
  g.lineStyle(4, cream, 1);
  g.lineBetween(x, baseline - 98, x - 30, baseline - 54);
  g.lineBetween(x, baseline - 98, x + 30, baseline - 54);
  g.lineBetween(x - 30, baseline - 54, x + 30, baseline - 54);
  g.lineBetween(x, baseline - 74, x - 42, baseline - 24);
  g.lineBetween(x, baseline - 74, x + 42, baseline - 24);
  g.lineBetween(x - 42, baseline - 24, x + 42, baseline - 24);
  g.fillStyle(cream, 1).fillRect(x - 4, baseline - 24, 8, 24);
}

function drawLodgeInterior(g: Phaser.GameObjects.Graphics): void {
  const cream = BROWN_BOX_PALETTE.cream;
  g.lineStyle(3, cream, 1).strokeRect(24, 22, 592, 304);
  g.lineBetween(24, 276, 616, 276);
  g.strokeRect(44, 54, 126, 92);
  g.lineBetween(107, 54, 107, 146);
  g.lineBetween(44, 100, 170, 100);
  g.strokeRect(470, 54, 108, 86);
  g.lineBetween(470, 96, 578, 96);
  g.lineBetween(524, 54, 524, 140);
  g.fillStyle(cream, 1).fillRect(260, 238, 120, 8);
  g.fillRect(272, 246, 8, 30);
  g.fillRect(360, 246, 8, 30);
}

function drawMechanism(
  g: Phaser.GameObjects.Graphics,
  snapshot: DesignerEncounterSnapshot,
): void {
  const x = 320;
  const y = 94;
  g.lineStyle(3, BROWN_BOX_PALETTE.cream, 1).strokeRect(
    x - 76,
    y - 40,
    152,
    118,
  );
  if (snapshot.gameId === "qong") drawQongMachine(g, x, y, snapshot);
  else if (snapshot.gameId === "skipixl") drawSkiMachine(g, x, y, snapshot);
  else if (snapshot.gameId === "fluxball") drawFluxMachine(g, x, y, snapshot);
  else drawMazeMachine(g, x, y, snapshot);
}

function drawQongMachine(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  snapshot: DesignerEncounterSnapshot,
): void {
  const evidence = snapshot.qongEvidence;
  g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillCircle(x - 42, y - 4, 15);
  g.fillStyle(BROWN_BOX_PALETTE.ink, 1).fillRect(x - 45, y - 8, 6, 9);
  g.lineStyle(3, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(x - 24, y - 4, x + 2, y - 4);
  g.strokeRect(x + 6, y - 23, 25, 38);
  g.lineBetween(x + 36, y - 4, x + 59, y - 4);
  g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(x + 52, y - 22, 6, 36);
  g.fillRect(x + 34, y - 7, 8, 8);
  if (!evidence) {
    g.lineStyle(3, BROWN_BOX_PALETTE.cream, 1);
    g.lineBetween(x - 12, y + 27, x + 12, y + 45);
    g.lineBetween(x + 12, y + 27, x - 12, y + 45);
    return;
  }
  if (snapshot.mechanismStep === 0) {
    const selectedX =
      snapshot.mechanismValue < 0
        ? x + 7
        : snapshot.mechanismValue > 0
          ? x + 27
          : x + 17;
    g.fillRect(selectedX, y + 30, 8, 8);
    if (evidence.firstMeasurement.bit === 1) {
      g.fillRect(x - 4, y + 27, 8, 14);
    } else {
      g.lineStyle(3, BROWN_BOX_PALETTE.cream, 1).strokeCircle(x, y + 34, 7);
    }
    return;
  }
  const leftBit = evidence.selection.bits[0];
  const rightBit = evidence.selection.bits[1];
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(x - 22, y + 25, 18, 18);
  g.strokeRect(x + 4, y + 25, 18, 18);
  if (leftBit === 1) g.fillRect(x - 16, y + 28, 6, 12);
  else g.strokeCircle(x - 13, y + 34, 5);
  if (rightBit === 1) g.fillRect(x + 10, y + 28, 6, 12);
  else g.strokeCircle(x + 13, y + 34, 5);
}

function drawSkiMachine(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  snapshot: DesignerEncounterSnapshot,
): void {
  const evidence = snapshot.skipixlEvidence;
  const sampleIndex = Math.max(0, Math.min(4, snapshot.mechanismValue + 2));
  const activeSegment = Math.min(snapshot.mechanismStep, 2);
  for (let segment = 0; segment < 3; segment += 1) {
    const rowY = y - 28 + segment * 18;
    const sample = evidence?.segments[segment]?.[sampleIndex];
    if (segment === activeSegment) {
      g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(
        x - 64,
        rowY - 3,
        128,
        11,
      );
    }
    for (let column = 0; column < 20; column += 1) {
      const selected = sample?.selectedHazards.some(
        (hazard) => hazard.column === column,
      );
      g.fillStyle(
        selected ? BROWN_BOX_PALETTE.cream : BROWN_BOX_PALETTE.tobacco,
        1,
      ).fillRect(x - 59 + column * 6, rowY, 4, 5);
    }
  }
  g.lineStyle(3, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(x - 57, y + 30, x + 57, y + 30);
  g.lineBetween(x, y + 30, x, y + 43);
  const activeSample = evidence?.segments[activeSegment]?.[sampleIndex];
  const primaryHazard = activeSample?.selectedHazards.reduce(
    (strongest, hazard) =>
      !strongest || hazard.absoluteResidual > strongest.absoluteResidual
        ? hazard
        : strongest,
    activeSample.selectedHazards[0],
  );
  if (primaryHazard?.kind === "tree") {
    g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillTriangle(
      x,
      y + 41,
      x - 11,
      y + 57,
      x + 11,
      y + 57,
    );
    g.fillRect(x - 2, y + 57, 4, 8);
  } else if (primaryHazard) {
    g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(x - 10, y + 50, 20, 5);
    g.fillRect(x - 6, y + 45, 12, 5);
  } else {
    g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(
      x - 8,
      y + 47,
      16,
      12,
    );
  }
}

function drawFluxMachine(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  snapshot: DesignerEncounterSnapshot,
): void {
  const evidence = snapshot.fluxballEvidence;
  const points = [
    [x, y - 28],
    [x + 44, y + 13],
    [x, y + 51],
    [x - 44, y + 13],
  ] as const;
  const playerCount = evidence?.activePlayerIds.length ?? 4;
  const selected = Math.max(
    0,
    Math.min(playerCount - 1, snapshot.mechanismValue + 2),
  );
  const axis = evidence?.axes[Math.min(snapshot.mechanismStep, 2)];
  const selectedId = evidence?.activePlayerIds[selected];
  for (let index = 0; index < playerCount; index += 1) {
    if (index === selected) continue;
    const playerId = evidence?.activePlayerIds[index];
    const related =
      axis && selectedId && playerId
        ? axis.signs[selectedId] === axis.signs[playerId]
        : false;
    const from = points[selected]!;
    const to = points[index]!;
    g.lineStyle(
      related ? 3 : 1,
      related ? BROWN_BOX_PALETTE.cream : BROWN_BOX_PALETTE.tobacco,
      1,
    ).lineBetween(from[0], from[1], to[0], to[1]);
  }
  for (let index = 0; index < points.length; index += 1) {
    const [nodeX, nodeY] = points[index]!;
    g.fillStyle(
      index === selected ? BROWN_BOX_PALETTE.cream : BROWN_BOX_PALETTE.tobacco,
      1,
    ).fillCircle(nodeX, nodeY, 10);
  }
}

function drawMazeMachine(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  snapshot: DesignerEncounterSnapshot,
): void {
  const evidence = snapshot.quantmanEvidence;
  const transition = evidence?.transitions[snapshot.mechanismValue + 2];
  const bitstring =
    snapshot.mechanismStep === 0
      ? transition?.beforeBitstring
      : transition?.afterBitstring;
  const sourceRooms = new Set(transition?.sourceRooms ?? []);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const cellX = x - 54 + col * 27;
      const cellY = y - 27 + row * 24;
      const room = row * 5 + col;
      const bit = bitstring?.[room] ?? "0";
      g.fillStyle(
        bit === "1" ? BROWN_BOX_PALETTE.cream : BROWN_BOX_PALETTE.tobacco,
        1,
      ).fillRect(cellX + 3, cellY + 3, 14, 11);
      g.lineStyle(
        sourceRooms.has(room) ? 3 : 1,
        BROWN_BOX_PALETTE.cream,
        1,
      ).strokeRect(cellX, cellY, 20, 17);
    }
  }
  if (!transition) return;
  const doorY = y + 57;
  g.lineStyle(3, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(x - 52, doorY, x - 10, doorY);
  g.lineBetween(x + 10, doorY, x + 52, doorY);
  if (
    snapshot.mechanismStep === 0
      ? transition.beforeDoorOpen
      : transition.afterDoorOpen
  ) {
    g.lineBetween(x - 9, doorY, x + 9, doorY);
  } else {
    g.lineBetween(x, doorY - 9, x, doorY + 9);
  }
}
