import { describe, expect, it } from "vitest";

import type { QongSnapshot } from "../../src/games/qong/types";
import {
  QongStorySequenceMachine,
  qongStoryPhaseForBeat,
} from "../../src/story/v2";

const FINAL_COURT: QongSnapshot = Object.freeze({
  phase: "complete",
  tick: 733,
  rallyNumber: 7,
  totalRallies: 7,
  leftScore: 4,
  rightScore: 3,
  observationsRemaining: 1,
  measurementState: "resolved",
  goalRule: "own",
  ball: Object.freeze({ x: 320, y: 180 }),
  leftPaddleY: 134,
  rightPaddleY: 176,
  rallyReveal: null,
  winner: "left",
  storyEvidence: Object.freeze({
    humanObservationsUsed: 2,
    directionalRallyNumbers: Object.freeze([2, 5]),
  }),
});

describe("Qong spatial Story sequence", () => {
  it("starts both morphs at the exact final paddle anchors on one court", () => {
    const snapshot = new QongStorySequenceMachine(FINAL_COURT).snapshot();
    expect(snapshot).toMatchObject({
      phase: "morph",
      scene: "court",
      morphFrame: 0,
      player: { x: 17, y: 77 },
      designer: { x: 303, y: 98 },
    });
    expect(snapshot.showWellDone).toBe(false);
  });

  it("runs the morph and door opening automatically without continue slides", () => {
    const machine = new QongStorySequenceMachine(FINAL_COURT);
    for (let tick = 0; tick < 42; tick += 1) machine.advance();
    expect(machine.snapshot()).toMatchObject({
      phase: "designer-walk",
      morphFrame: 6,
      showWellDone: true,
      persistenceBeatId: "qong-well-done",
    });
    for (let tick = 0; tick < 30; tick += 1) machine.advance();
    expect(machine.snapshot()).toMatchObject({
      phase: "door-opening",
      persistenceBeatId: "qong-open-door",
    });
    for (let tick = 0; tick < 20; tick += 1) machine.advance();
    expect(machine.snapshot()).toMatchObject({
      phase: "court-walk",
      doorFrame: 4,
      prompt: "WALK TO THE OPEN DOOR",
    });
  });

  it("lets the player cross the court, enter the office, sit, and open the terminal", () => {
    const machine = new QongStorySequenceMachine(
      FINAL_COURT,
      "qong-walk-to-den",
    );

    machine.setDirection("right", true);
    for (let tick = 0; tick < 140; tick += 1) machine.advance();
    machine.setDirection("right", false);
    machine.setDirection("down", true);
    for (let tick = 0; tick < 40; tick += 1) machine.advance();
    machine.setDirection("down", false);
    while (machine.snapshot().phase === "threshold") machine.advance();

    expect(machine.snapshot()).toMatchObject({
      phase: "office-walk",
      scene: "office",
      prompt: "WALK TO THE COMPUTER",
    });

    machine.setDirection("right", true);
    for (let tick = 0; tick < 101; tick += 1) machine.advance();
    machine.setDirection("right", false);
    machine.setDirection("up", true);
    for (let tick = 0; tick < 30; tick += 1) machine.advance();
    machine.setDirection("up", false);
    expect(machine.snapshot()).toMatchObject({
      atComputer: true,
      prompt: "COMPUTER · SPACE TO SIT",
    });

    machine.queueAction();
    machine.advance();
    expect(machine.snapshot().phase).toBe("sitting");
    let enteredTerminal = false;
    for (let tick = 0; tick < 18; tick += 1) {
      enteredTerminal ||= machine.advance().terminalEntered;
    }
    expect(enteredTerminal).toBe(true);
    expect(machine.snapshot()).toMatchObject({
      phase: "terminal",
      persistenceBeatId: "qong-terminal-qong-input",
    });
  });

  it("maps old pending beat IDs into the corresponding spatial resume phase", () => {
    expect(qongStoryPhaseForBeat("qong-player-paddle-morph")).toBe("morph");
    expect(qongStoryPhaseForBeat("qong-open-door")).toBe("door-opening");
    expect(qongStoryPhaseForBeat("qong-den-access")).toBe("office-walk");
    expect(qongStoryPhaseForBeat("qong-terminal-qong-return")).toBe("terminal");
  });
});
