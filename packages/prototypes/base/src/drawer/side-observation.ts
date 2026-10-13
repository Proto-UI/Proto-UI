import type { BorrowedStateHandle } from '@proto.ui/core';
import type { DrawerAcceptedSideObservation, DrawerSide } from './types';

export function drawerSideValue(value: string): DrawerSide | null {
  return value === 'top' || value === 'right' || value === 'bottom' || value === 'left'
    ? value
    : null;
}

/** Do not forward State identity or mutation methods through this observation boundary. */
export function observeDrawerSide<P extends object>(
  state: BorrowedStateHandle<string, P>
): DrawerAcceptedSideObservation {
  return Object.freeze({
    read: () => drawerSideValue(state.get()),
    observe: (listener: (side: DrawerSide | null) => void) =>
      state.watch((_run, event) => {
        if (event.type === 'next') listener(drawerSideValue(event.next));
      }),
  });
}
