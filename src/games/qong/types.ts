export const QONG_RULES_VERSION = "qong-rules-v1";
export const QONG_TOTAL_RALLIES = 7;
export const QONG_STARTING_OBSERVATIONS = 3;

export type QongPolarity = "direct" | "invert";
export type QongSide = "left" | "right";
export type QongOpponent = "cpu" | "local";
export type QongPhase = "active" | "between-rallies" | "complete";
export type QongMeasurementState = "unresolved" | "measuring" | "resolved";
export type QongGoalRule = "unresolved" | "opposite" | "own";

export interface QongPackPayload {
  readonly directProbability: number;
  readonly rallyPolarities?: readonly QongPolarity[];
}

export interface QongInput {
  readonly leftAxis: -1 | 0 | 1;
  readonly rightAxis: -1 | 0 | 1;
  readonly observePressed?: boolean;
  /** Legacy qong-rules-v1 replay input. New recordings use observePressed. */
  readonly scanPressed?: boolean;
}

export interface QongPublicState {
  readonly goalRule: QongGoalRule;
  readonly rallyNumber: number;
  readonly ball: {
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
  };
  readonly leftPaddleY: number;
  readonly rightPaddleY: number;
  readonly leftScore: number;
  readonly rightScore: number;
}

export interface QongGoalEvent {
  readonly kind: "goal";
  readonly rallyNumber: number;
  readonly goalSide: QongSide;
  readonly pointWinner: QongSide;
}

export interface QongRallyReveal {
  readonly polarity: QongPolarity;
  readonly goalSide: QongSide;
  readonly pointWinner: QongSide;
}

export interface QongStoryEvidence {
  readonly humanObservationsUsed: number;
  readonly directionalRallyNumbers: readonly number[];
}

export interface QongSnapshot {
  readonly phase: QongPhase;
  readonly tick: number;
  readonly rallyNumber: number;
  readonly totalRallies: number;
  readonly leftScore: number;
  readonly rightScore: number;
  readonly observationsRemaining: number;
  readonly measurementState: QongMeasurementState;
  readonly goalRule: QongGoalRule;
  readonly ball: { readonly x: number; readonly y: number };
  readonly leftPaddleY: number;
  readonly rightPaddleY: number;
  readonly rallyReveal: QongRallyReveal | null;
  readonly winner: QongSide | null;
  readonly storyEvidence: QongStoryEvidence;
}
