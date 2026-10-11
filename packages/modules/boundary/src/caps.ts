import { cap } from '@proto.ui/core';
import type { BoundaryClassification, BoundaryRegion, BoundarySample } from '@proto.ui/core';

export type BoundaryHostBridge = {
  /** Proves current host focus from a focus event; unsupported hosts return no sample. */
  sampleFocus?(nativeEvent: unknown): BoundarySample | null;
  classify(args: {
    regions: readonly BoundaryRegion[];
    sample?: BoundarySample;
  }): BoundaryClassification;
};

export const BOUNDARY_HOST_BRIDGE_CAP = cap<BoundaryHostBridge>('@proto.ui/boundary/hostBridge');
