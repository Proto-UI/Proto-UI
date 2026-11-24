import { cap, type StyleHandle, type ResidentMotionDeclaration } from '@proto.ui/core';
export type ResidentMotionFrame = Readonly<{
  view: number;
  revision: number;
  style: StyleHandle;
  declarations: readonly ResidentMotionDeclaration[];
  /** Exact exposed numeric State inputs, resolved by Feedback, never by a host CSS read. */
  numbers?: Readonly<Record<string, number>>;
  sourceDiagnostics?: readonly string[];
}>;
/** Projection owns only presentation. The frame retains the unmodified final target. */
export interface ResidentMotionSink {
  commit(frame: ResidentMotionFrame): void;
  release(view: number): void;
  diagnostics?(): readonly string[];
}
export const RESIDENT_MOTION_SINK_CAP = cap<ResidentMotionSink>(
  '@proto.ui/feedback/resident-motion-v1'
);
