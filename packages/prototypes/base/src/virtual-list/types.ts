import type { ExposeMethod, ExposeState, State } from '@proto.ui/core';
import type {
  asScrollAreaRoot,
  asScrollAreaViewport,
  ScrollAreaRootExposes,
  ScrollAreaViewportExposes,
} from '../scroll-area';
import type { WindowedCollection, WindowSnapshot } from './model';
export interface VirtualListRootProps {
  itemKeys?: readonly string[];
  overscanItems?: number;
  maxMaterializedItems?: number;
  a11yLabel?: string;
}
export type VirtualListViewportProps = Record<string, never>;
export type VirtualListContentProps = Record<string, never>;
export type VirtualListRootExposes = ScrollAreaRootExposes & {
  logicalCount: ExposeState<number>;
  getCollection: ExposeMethod<() => WindowedCollection>;
  getWindow: ExposeMethod<() => WindowSnapshot>;
};
export type VirtualListViewportExposes = ScrollAreaViewportExposes;
export type VirtualListContentExposes = Record<string, never>;
export type VirtualListRootAsHookContract = {
  state: { a11yLabel: State<string>; logicalCount: State<number> };
  asHooks: { 'as-scroll-area-root': ReturnType<typeof asScrollAreaRoot> };
};
export type VirtualListViewportAsHookContract = {
  asHooks: { 'as-scroll-area-viewport': ReturnType<typeof asScrollAreaViewport> };
};
export type VirtualListContentAsHookContract = {};
