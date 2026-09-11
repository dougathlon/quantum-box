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

/** Observe actual fullscreen exits; repeated events must never toggle pause. */
export function observeFullscreenExit(
  document: Document,
  onExit: () => void,
): () => void {
  let wasFullscreen = Boolean(document.fullscreenElement);
  const onChange = (): void => {
    const fullscreen = Boolean(document.fullscreenElement);
    const exited = wasFullscreen && !fullscreen;
    wasFullscreen = fullscreen;
    if (exited) onExit();
  };
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}
