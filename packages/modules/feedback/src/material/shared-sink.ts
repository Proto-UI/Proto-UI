import { cap, type MaterialIntentFrame } from '@proto.ui/core';

/** Complete unresolved intent input. The host must establish provenance,
 * source/geometry and atomic paint; receiving this is no support claim. */
export type VisualFeedbackFrame = Readonly<{
  view: number;
  revision: number;
  style: Readonly<{ kind: 'tw'; tokens: readonly string[] }>;
  material: MaterialIntentFrame;
}>;

export interface VisualFeedbackSink {
  commit(frame: VisualFeedbackFrame): void;
  release(view: number): void;
}

export const VISUAL_FEEDBACK_SINK_CAP = cap<VisualFeedbackSink>(
  '@proto.ui/feedback/visual-sink-v2'
);
