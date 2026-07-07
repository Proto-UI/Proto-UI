import type { PropsBaseType } from '@proto.ui/types';
import type { ObservedStateHandle } from './state';

export type VisibilityFacts = Readonly<{
  hidden: boolean;
}>;

export type HideableConfig = Readonly<{
  defaultHidden: boolean;
}>;

export interface HideableHandle<P extends PropsBaseType = PropsBaseType> {
  hidden: ObservedStateHandle<boolean, P>;

  setDefaultHidden(hidden: boolean): void;
  hide(): void;
  show(): void;
  setHidden(hidden: boolean): void;
}
