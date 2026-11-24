import type {
  VirtualListRootProps,
  VirtualListRootExposes,
  VirtualListViewportProps,
  VirtualListViewportExposes,
  VirtualListContentProps,
  VirtualListContentExposes,
} from '@proto.ui/prototypes-base/virtual-list';
import { definePrototype, tw } from '@proto.ui/core';
import {
  asVirtualListRoot,
  asVirtualListViewport,
  asVirtualListContent,
} from '@proto.ui/prototypes-base/virtual-list';
import { BRUTALIST_PANEL_TOKENS } from '../style';
export type * from '@proto.ui/prototypes-base/virtual-list';

export const virtualListRoot = definePrototype<VirtualListRootProps, VirtualListRootExposes>({
  name: 'brutalist-virtual-list-root',
  modules: asVirtualListRoot.modules,
  setup(def) {
    const behavior = asVirtualListRoot();
    def.feedback.style.use(
      tw(`min-w-0 max-w-full overflow-hidden grid gap-0 ${BRUTALIST_PANEL_TOKENS}`)
    );
    return behavior.render;
  },
});
export { virtualListRoot as brutalistVirtualListRoot };

export const virtualListViewport = definePrototype<
  VirtualListViewportProps,
  VirtualListViewportExposes
>({
  name: 'brutalist-virtual-list-viewport',
  modules: asVirtualListViewport.modules,
  setup(def) {
    const behavior = asVirtualListViewport();
    const viewportState = behavior.getAsHookHandle?.('as-scroll-area-viewport')?.stateHandles;
    if (!viewportState)
      throw new Error('[brutalist-virtual-list] Required viewport focus state is unavailable.');
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full min-h-0 overflow-auto rounded-none text-foreground font-sans font-medium outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(viewportState.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-inset forced-colors-focus-outline')
        ),
    });
    return behavior.render;
  },
});
export { virtualListViewport as brutalistVirtualListViewport };

export const virtualListContent = definePrototype<
  VirtualListContentProps,
  VirtualListContentExposes
>({
  name: 'brutalist-virtual-list-content',
  modules: asVirtualListContent.modules,
  setup(def) {
    const behavior = asVirtualListContent();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground font-sans font-medium relative'));
    return behavior.render;
  },
});
export { virtualListContent as brutalistVirtualListContent };
