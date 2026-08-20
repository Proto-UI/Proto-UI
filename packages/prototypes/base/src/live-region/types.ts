export type LiveRegionPoliteness = 'polite' | 'assertive';

export interface LiveRegionRootProps {
  politeness?: LiveRegionPoliteness;
  atomic?: boolean;
}

// P-BASE-LIVE-REGION-NO-INTERACTION: no exposes surface.
export type LiveRegionRootExposes = {};

export type LiveRegionRootStateHandles = {};

export type LiveRegionRootAsHookContract = { state: LiveRegionRootStateHandles };
