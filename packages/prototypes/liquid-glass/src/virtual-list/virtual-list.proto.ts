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
import { COMMAND_FOCUS_INSET } from '../interactive-surface';
export type * from '@proto.ui/prototypes-base/virtual-list';

// Scrolling content stays opaque/grouped without a glass-coated viewport.
// Floating Liquid Glass controls belong strictly on the companion control layer.
export const virtualListRoot = definePrototype<VirtualListRootProps, VirtualListRootExposes>({
  name: 'liquid-glass-virtual-list-root',
  modules: asVirtualListRoot.modules,
  setup(def) {
    const behavior = asVirtualListRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-secondary text-secondary-foreground font-sans text-sm shadow-sm grid gap-0'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedTransparency').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('shadow-none border-foreground')),
    });
    def.rule({
      when: (w) => w.meta('preference.forcedColors').eq('active'),
      intent: (i) => i.feedback.style.use(tw('shadow-none border-foreground')),
    });
    return behavior.render;
  },
});
export { virtualListRoot as liquidGlassVirtualListRoot };

export const virtualListViewport = definePrototype<
  VirtualListViewportProps,
  VirtualListViewportExposes
>({
  name: 'liquid-glass-virtual-list-viewport',
  modules: asVirtualListViewport.modules,
  setup(def) {
    const behavior = asVirtualListViewport();
    const states = behavior.getAsHookHandle?.('as-scroll-area-viewport')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-virtual-list] Required viewport focus state is unavailable.');
    def.feedback.style.use(
      tw('min-w-0 max-w-full min-h-0 overflow-auto rounded-[inherit] text-inherit outline-none')
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('no-preference'),
      intent: (i) => i.feedback.style.use(tw('transition-[color,box-shadow]')),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
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
  modules: asVirtualListContent.modules,
  setup(def) {
    const behavior = asVirtualListContent();
    def.feedback.style.use(tw('min-w-0 max-w-full text-inherit relative'));
    return behavior.render;
  },
});
export { virtualListContent as liquidGlassVirtualListContent };
