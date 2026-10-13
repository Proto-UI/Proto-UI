import { defineAsHook, type State, type RunHandle } from '@proto.ui/core';
import { DRAWER_CONTEXT } from './shared';
import { DRAWER_PRESENTATION_CONTEXT } from './presentation-context';
import { observeDrawerSide } from './side-observation';
import type { DrawerAcceptedSideObservation } from './types';

type Contract = { state: { acceptedSide: State<string> } };

/** Observe accepted Content direction only within the nearest logical Drawer Root. */
export const asDrawerAcceptedSide = defineAsHook<{}, {}, Contract, DrawerAcceptedSideObservation>({
  name: 'as-drawer-accepted-side',
  setup(def) {
    const side = def.state.string('acceptedSide', '');
    let active = true;
    const sync = (run: RunHandle<{}>) => {
      if (!active) return;
      const root = run.context.tryReadAncestor(DRAWER_CONTEXT);
      const presentation = run.context.tryReadAncestor(DRAWER_PRESENTATION_CONTEXT);
      side.set(
        root && presentation?.rootId === root.rootId ? presentation.side : '',
        'reason: drawer owner-scoped accepted direction'
      );
    };
    def.context.trySubscribeAncestor(DRAWER_CONTEXT, sync);
    def.context.trySubscribeAncestor(DRAWER_PRESENTATION_CONTEXT, sync);
    def.lifecycle.onCreated(sync);
    // Retained host reparenting updates the logical chain without a Context value change.
    def.lifecycle.onUpdated(sync);
    def.lifecycle.onMounted((run) => {
      active = true;
      sync(run);
    });
    def.lifecycle.onUnmounted(() => {
      active = false;
      side.set('', 'reason: drawer direction view detached');
    });
    def.lifecycle.onBeforeDispose(() => {
      active = false;
    });
  },
  projectHandle(result) {
    const side = result.getState?.('acceptedSide');
    if (!side) throw new Error('[as-drawer-accepted-side] missing captured direction.');
    return observeDrawerSide(side);
  },
});
