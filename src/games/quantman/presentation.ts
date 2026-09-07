import type { QuantmanSnapshot } from "./types";

export interface QuantmanHudModel {
  readonly fragments: string;
  readonly time: string;
  readonly lives: string;
  readonly state: string;
  readonly focus: string;
  readonly notice: string;
}

export function quantmanHudModel(
  snapshot: QuantmanSnapshot,
  paused: boolean,
): QuantmanHudModel {
  return Object.freeze({
    fragments: `${snapshot.fragmentsCollected} / ${snapshot.requiredFragments}`,
    time: String(Math.max(0, Math.ceil(snapshot.secondsRemaining))).padStart(
      3,
      "0",
    ),
    lives: `LIVES ${snapshot.lives}`,
    state: `SCORE ${String(snapshot.score).padStart(5, "0")} · TURN ${snapshot.observationCount}`,
    focus: `LOOK ${snapshot.focusedDoorId.toUpperCase()} ${snapshot.focusedDoorOpen ? "OPEN" : "CLOSED"} · LOCAL SIM`,
    notice: quantmanNotice(snapshot, paused),
  });
}

export function quantmanNotice(
  snapshot: QuantmanSnapshot,
  paused: boolean,
): string {
  if (paused) return "PAUSED";
  if (snapshot.phase === "won") {
    return "ARCHIVE CHANNEL RECOVERED · X REPLAYS";
  }
  if (snapshot.phase === "lost") {
    return "SIGNAL LOST · X REPLAYS";
  }
  if (!snapshot.started) return "READY · MOVE";
  if (snapshot.frightenedTicks > 0) {
    return `POWER ${Math.ceil(snapshot.frightenedTicks / 60)} · CHASE THEM`;
  }
  if (snapshot.latestEvent) return snapshot.latestEvent.detail;
  return `${snapshot.requiredFragments - snapshot.fragmentsCollected} PELLETS LEFT`;
}
