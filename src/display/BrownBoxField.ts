import {
  DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME,
  type BrownBoxBackgroundProgramme,
  type BrownBoxBackgroundState,
} from "./backgrounds/BrownBoxBackgroundPrograms";
import { BROWN_BOX_LOGICAL_SCREEN } from "./BrownBoxTheme";

export type BrownBoxFieldStateId = BrownBoxBackgroundState["stateId"];
export type BrownBoxFieldStateProvenance = BrownBoxBackgroundState;

export interface BrownBoxFieldFrame {
  readonly loopTick: number;
  readonly currentStateIndex: number;
  readonly followingStateIndex: number;
  readonly currentTextureKey: string;
  readonly followingTextureKey: string;
  readonly replacementBoundaryX: number;
}

const defaultTiming = DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME.timing;

// Compatibility exports for callers and audits that target the default field.
export const BROWN_BOX_FIELD_FRAME_DURATION_MS = defaultTiming.frameDurationMs;
export const BROWN_BOX_FIELD_HOLD_FRAME_COUNT = defaultTiming.holdFrameCount;
export const BROWN_BOX_FIELD_SWEEP_STEP_COUNT = defaultTiming.sweepStepCount;
export const BROWN_BOX_FIELD_SWEEP_FRAME_COUNT = defaultTiming.sweepFrameCount;
export const BROWN_BOX_FIELD_PHASE_FRAME_COUNT = defaultTiming.phaseFrameCount;
export const BROWN_BOX_FIELD_LOOP_FRAME_COUNT = defaultTiming.loopFrameCount;
export const BROWN_BOX_FIELD_LOOP_DURATION_MS = defaultTiming.loopDurationMs;

export const BROWN_BOX_FIELD_STATES =
  DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME.states;

export const BROWN_BOX_FIELD_PROVENANCE = Object.freeze({
  programmeId: DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME.programmeId,
  lane: "B2+B3+B4",
  schedule: "original-hybrid-programme",
  width: DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME.width,
  height: DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME.height,
  palette: DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME.palette,
  frameDurationMs: defaultTiming.frameDurationMs,
  holdFrameCount: defaultTiming.holdFrameCount,
  sweepStepCount: defaultTiming.sweepStepCount,
  sweepFrameCount: defaultTiming.sweepFrameCount,
  phaseFrameCount: defaultTiming.phaseFrameCount,
  loopFrameCount: defaultTiming.loopFrameCount,
  loopDurationMs: defaultTiming.loopDurationMs,
  transition: DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME.transition,
  sourceManifest:
    DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME.provenance.sourceManifest,
  classification:
    DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME.provenance.classification,
  pixelHandling:
    "All four endpoints are imported byte-for-byte and replaced at discrete 100 ms boundaries without blending, opacity, filtering, or an authored scan line.",
  states: BROWN_BOX_FIELD_STATES,
});

export function resolveBrownBoxFieldFrame(
  elapsedMs: number,
  programme: BrownBoxBackgroundProgramme = DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME,
): BrownBoxFieldFrame {
  if (!Number.isFinite(elapsedMs)) {
    throw new Error("Brown Box field time must be finite.");
  }
  const { timing, states } = programme;
  const wrappedMs = positiveModulo(elapsedMs, timing.loopDurationMs);
  const loopTick = Math.floor(wrappedMs / timing.frameDurationMs);
  const currentStateIndex = Math.floor(loopTick / timing.phaseFrameCount);
  const phaseTick = loopTick % timing.phaseFrameCount;
  const followingStateIndex = (currentStateIndex + 1) % states.length;
  const replacementBoundaryX = resolveReplacementBoundaryX(phaseTick, timing);
  return Object.freeze({
    loopTick,
    currentStateIndex,
    followingStateIndex,
    currentTextureKey: states[currentStateIndex]!.textureKey,
    followingTextureKey: states[followingStateIndex]!.textureKey,
    replacementBoundaryX,
  });
}

/**
 * Resolves a programme frame from the one shared activation epoch used by all
 * Brown Box surfaces. requestAnimationFrame timestamps and performance.now()
 * share a time origin, so callers must pass either of those clock values here.
 */
export function resolveBrownBoxFieldFrameAtEpoch(
  frameTimeMs: number,
  programmeStartedAtMs: number,
  reducedMotion: boolean,
  programme: BrownBoxBackgroundProgramme = DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME,
): BrownBoxFieldFrame {
  if (!Number.isFinite(programmeStartedAtMs)) {
    throw new Error("Brown Box background start time must be finite.");
  }
  return resolveBrownBoxFieldFrame(
    reducedMotion ? 0 : frameTimeMs - programmeStartedAtMs,
    programme,
  );
}

/**
 * Keeps non-visual state inspection synchronized even when a surface has no
 * layout because its containing title/internal layer is currently hidden.
 */
export function updateBrownBoxFieldStateDataset(
  canvas: Pick<HTMLCanvasElement, "dataset">,
  programme: BrownBoxBackgroundProgramme,
  frame: BrownBoxFieldFrame,
  programmeStartedAtMs: number,
): void {
  canvas.dataset["fieldProgramme"] = programme.programmeId;
  canvas.dataset["fieldEpoch"] = String(programmeStartedAtMs);
  canvas.dataset["fieldTick"] = String(frame.loopTick);
  canvas.dataset["fieldState"] =
    programme.states[frame.currentStateIndex]!.stateId;
  canvas.dataset["fieldFollowingState"] =
    programme.states[frame.followingStateIndex]!.stateId;
  canvas.dataset["fieldSourceBoundary"] = String(frame.replacementBoundaryX);
}

function resolveReplacementBoundaryX(
  phaseTick: number,
  timing: BrownBoxBackgroundProgramme["timing"],
): number {
  if (phaseTick < timing.holdFrameCount) return 0;
  const sweepFrame = phaseTick - timing.holdFrameCount;
  const sweepStep = sweepFrame + timing.firstSweepStep;
  return Math.round(
    (sweepStep * BROWN_BOX_LOGICAL_SCREEN.width) / timing.sweepStepCount,
  );
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
