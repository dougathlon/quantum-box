/** Called synchronously from a user action so the browser keeps its activation. */
export function toggleFullscreen(document: Document): Promise<void> {
  if (document.fullscreenElement) return document.exitFullscreen();
  if (
    !document.fullscreenEnabled ||
    !document.documentElement.requestFullscreen
  )
    return Promise.reject(
      new Error(
        "Fullscreen is unavailable in this browser. Open the game in a standalone browser window.",
      ),
    );
  return document.documentElement.requestFullscreen({ navigationUI: "hide" });
}
