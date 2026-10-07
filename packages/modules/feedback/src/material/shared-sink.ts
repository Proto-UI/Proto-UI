import { cap, type MaterialIntentFrame } from '@proto.ui/core';
import type { FinalStyleSnapshot } from './final-style-sink';

/** Complete unresolved intent input. The host must establish provenance,
 * source/geometry and atomic paint; receiving this is no support claim. */
export type VisualFeedbackFrame = Readonly<{
  view: number;
  revision: number;
  style: FinalStyleSnapshot;
  material: MaterialIntentFrame;
}>;

export interface VisualFeedbackSink {
  commit(frame: VisualFeedbackFrame): void;
  release(view: number): void;
}

export const VISUAL_FEEDBACK_SINK_CAP = cap<VisualFeedbackSink>(
  '@proto.ui/feedback/visual-sink-v2'
);
