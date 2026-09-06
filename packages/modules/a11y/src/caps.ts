import { cap } from '@proto.ui/core';
import type { A11ySemanticObjectSnapshot } from '@proto.ui/core';

export type A11yProjector = {
  (snapshot: A11ySemanticObjectSnapshot): void;
  detach?(): void;
  dispose?(): void;
};

export const A11Y_PROJECT_CAP = cap<A11yProjector>('@proto.ui/a11y/project');
