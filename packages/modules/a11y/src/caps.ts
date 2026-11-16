import { cap } from '@proto.ui/core';
import type { A11ySemanticObjectRef, A11ySemanticObjectSnapshot } from '@proto.ui/core';

/** Privileged physical facts supplied by the current ControlLabel pair lease. */
export type A11yControlLabelView = Readonly<{ identity: object; scope: object }>;
export type A11yControlLabelSourceLease = Readonly<{
  objectRef: A11ySemanticObjectRef;
  isActive(): boolean;
  dispose(): void;
}>;

export type A11yProjector = ((snapshot: A11ySemanticObjectSnapshot) => void) & {
  /** Whether the current view has accepted the snapshot on a physical binding. */
  isBound?(): boolean;
  detach?(): void;
  reactivate?(): void;
  dispose?(): void;
  clearHeadingLevel?(): void;
  /** Host-authored naming, excluding this projector's owned contributions. */
  hasAuthoredName?(): boolean;
  /** Translate only the current rendered Label into this target's projection registry. */
  acquireControlLabelSource?(
    semanticRef: object,
    view: A11yControlLabelView
  ): A11yControlLabelSourceLease | null;
};

export const A11Y_PROJECT_CAP = cap<A11yProjector>('@proto.ui/a11y/project');
