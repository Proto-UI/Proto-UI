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

// Proto extension, not a Bootstrap 2.3.2 collection widget. Materialization and
// logical collection state stay in Base and its existing public host boundary.
export const virtualListRoot = definePrototype<VirtualListRootProps, VirtualListRootExposes>({
  name: 'bootstrap-2-3-2-virtual-list-root',
  modules: asVirtualListRoot.modules,
  setup(def) {
    const inherited = asVirtualListRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 min-h-0 max-w-full overflow-hidden rounded-[4px] border border-border bg-background text-foreground font-sans text-[14px] leading-[20px] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)] grid gap-0'
      )
    );
    return inherited.render;
  },
});
export { virtualListRoot as bootstrap232VirtualListRoot };

export const virtualListViewport = definePrototype<
  VirtualListViewportProps,
  VirtualListViewportExposes
>({
  name: 'bootstrap-2-3-2-virtual-list-viewport',
  modules: asVirtualListViewport.modules,
  setup(def) {
    const inherited = asVirtualListViewport();
    const viewport = inherited.getAsHookHandle!('as-scroll-area-viewport');
    if (!viewport?.stateHandles)
      throw new Error('[bootstrap-2-3-2-virtual-list-viewport] Base focus facts required.');
    def.feedback.style.use(tw('min-w-0 min-h-0 max-w-full overflow-auto outline-none'));
    def.rule({
      when: (w) => w.state(viewport.stateHandles!.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-inset forced-colors-focus-outline')),
    });
    return inherited.render;
  },
});
export { virtualListViewport as bootstrap232VirtualListViewport };

export const virtualListContent = definePrototype<
  VirtualListContentProps,
  VirtualListContentExposes
>({
  name: 'bootstrap-2-3-2-virtual-list-content',
  modules: asVirtualListContent.modules,
  setup(def) {
    const inherited = asVirtualListContent();
    def.feedback.style.use(tw('relative min-w-0 min-h-0 text-inherit'));
    return inherited.render;
  },
});
export { virtualListContent as bootstrap232VirtualListContent };
