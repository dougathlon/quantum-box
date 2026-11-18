import { requiresComputerNotice } from "./entry/deviceSupport";

if (
  requiresComputerNotice({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    finePointer: matchMedia("(any-pointer: fine)").matches,
  })
) {
  const { showComputerNotice } = await import("./entry/ComputerNotice");
  showComputerNotice();
} else {
  await import("./entry/startGame");
}
