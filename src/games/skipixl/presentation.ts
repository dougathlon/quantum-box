import type { SkiPixlSnapshot } from "./types";

export function skiPixlDistanceLabel(snapshot: SkiPixlSnapshot): string {
  return `${String(
    Math.max(0, Math.ceil(snapshot.courseLength - snapshot.distance)),
  ).padStart(3, "0")} M`;
}

export function formatSkiPixlTime(elapsedSeconds: number): string {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = (elapsedSeconds - minutes * 60).toFixed(2).padStart(5, "0");
  return `${minutes}:${seconds}`;
}

export function skiPixlNotice(
  snapshot: SkiPixlSnapshot,
  paused: boolean,
): string {
  if (paused) return "PAUSED";
  if (snapshot.phase === "ready") {
    return `READY · ${Math.max(1, Math.ceil(snapshot.readyTicksRemaining / 60))} · LIMIT ${snapshot.targetSeconds} SEC`;
  }
  if (snapshot.phase === "complete") {
    return snapshot.storyQualified
      ? "WELL DONE. LET ME SHOW YOU SOMETHING."
      : "DESCENT COMPLETE. QUALIFICATION LIMIT MISSED.";
  }
  if (snapshot.latestGate) {
    return snapshot.latestGate.passed
      ? "SLALOM GATE CLEARED"
      : "SLALOM GATE MISSED. 2.5 SECOND PENALTY.";
  }
  return "";
}

export function skiPixlCanvasPrompt(
  snapshot: SkiPixlSnapshot,
  paused: boolean,
): string {
  if (paused) return "PAUSED";
  if (snapshot.phase === "ready") {
    return `READY ${Math.max(1, Math.ceil(snapshot.readyTicksRemaining / 60))} · ${snapshot.targetSeconds}S`;
  }
  if (snapshot.phase === "complete") {
    return snapshot.storyQualified ? "WELL DONE" : "RUN COMPLETE";
  }
  return "";
}
