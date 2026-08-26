import type { ExposeState, ExposeEvent, State } from '@proto.ui/core';

export interface ImageRootProps {
  source?: string;
  alternativeText?: string;
  fit?: 'contain' | 'cover' | 'fill';
  defaultSource?: string;
}

export type ImageRootExposes = {
  source: ExposeState<string>;
  loadingStatus: ExposeState<string>;
  fit: ExposeState<string>;
  loadingStatusChange: ExposeEvent<{ status: string; previousStatus: string; source: string }>;
};

export type ImageRootStateHandles = {
  source: State<string>;
  loadingStatus: State<string>;
  fit: State<string>;
};
