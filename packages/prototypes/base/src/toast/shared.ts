import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
import type { ToastPosition, ToastSwipeDirection, ToastType } from './types';

export const TOAST_POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

export const TOAST_TYPES = ['default', 'success', 'info', 'warning', 'error', 'loading'] as const;

export const TOAST_SWIPE_DIRECTIONS = ['right', 'left', 'up', 'down', 'none'] as const;

export const TOAST_STACK_TIERS = ['front', 'second', 'third', 'back', 'overflow'] as const;

export const TOAST_FAMILY = createAnatomyFamily('base-toast', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    title: { cardinality: { min: 0, max: 1 } },
    description: { cardinality: { min: 0, max: 1 } },
    close: { cardinality: { min: 0, max: 1 } },
    action: { cardinality: { min: 0, max: '*' } },
  },
  relations: ['title', 'description', 'close', 'action'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});

export type ToastViewportContextValue = {
  position: ToastPosition;
  expanded: boolean;
  paused: boolean;
  visibleToasts: number;
  duration: number | null;
  swipeDirection: ToastSwipeDirection;
  dismissEpoch: number;
  dismissReason: string;
  openIds: string[];
};

export const TOAST_VIEWPORT_CONTEXT =
  createContextKey<ToastViewportContextValue>('base-toast-viewport');

export const TOAST_CONTEXT = createContextKey<{
  id: string;
  open: boolean;
  type: ToastType;
  dismissible: boolean;
}>('base-toast');

let nextId = 0;
export const createToastId = () => `pui-toast-${++nextId}`;

export function dismissToast(run: RunHandle<any>, reason: string) {
  const fn = run.anatomy.partsOf(TOAST_FAMILY, 'root')[0]?.getExpose('close');
  if (typeof fn === 'function') fn(reason);
}
