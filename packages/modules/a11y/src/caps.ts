import { cap } from '@proto.ui/core';
import type { A11ySemanticObjectSnapshot } from '@proto.ui/core';

export type A11yProjector = ((snapshot: A11ySemanticObjectSnapshot) => void) & {
  /** Whether the current view has accepted the snapshot on a physical binding. */
  isBound?(): boolean;
  detach?(): void;
  reactivate?(): void;
  dispose?(): void;
  clearHeadingLevel?(): void;
};

export const A11Y_PROJECT_CAP = cap<A11yProjector>('@proto.ui/a11y/project');
