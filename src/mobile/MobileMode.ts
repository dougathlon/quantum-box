/** Shared by presentation and launch routing so a hidden choice cannot start 2P. */
export function isMobilePresentation(): boolean {
  return document.documentElement.dataset["mobile"] === "true";
}

export function permitsArcadeMode(mode: string, mobile: boolean): boolean {
  return !mobile || (mode !== "LOCAL TWO PLAYER" && mode !== "2 PLAYER");
}
