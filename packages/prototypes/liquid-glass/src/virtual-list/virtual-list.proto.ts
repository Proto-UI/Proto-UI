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
export type * from '@proto.ui/prototypes-base/virtual-list';
export const virtualListRoot = definePrototype<VirtualListRootProps, VirtualListRootExposes>({
  name: 'liquid-glass-virtual-list-root',
  setup(def) {
    const behavior = asVirtualListRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-2xl border border-border bg-background grid gap-0'
      )
    );
    return behavior.render;
  },
});
export { virtualListRoot as liquidGlassVirtualListRoot };
export const virtualListViewport = definePrototype<
  VirtualListViewportProps,
  VirtualListViewportExposes
>({
  name: 'liquid-glass-virtual-list-viewport',
  setup(def) {
    const behavior = asVirtualListViewport();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground min-h-0'));
    const states = behavior.getAsHookHandle?.('as-scroll-area-viewport')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-virtual-list] Required viewport focus state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    return behavior.render;
  },
});
export { virtualListViewport as liquidGlassVirtualListViewport };
export const virtualListContent = definePrototype<
  VirtualListContentProps,
  VirtualListContentExposes
>({
  name: 'liquid-glass-virtual-list-content',
  setup(def) {
    const behavior = asVirtualListContent();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground relative'));
    return behavior.render;
  },
});
export { virtualListContent as liquidGlassVirtualListContent };
