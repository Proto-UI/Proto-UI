import type {
  VirtualListRootProps,
  VirtualListRootExposes,
  VirtualListViewportExposes,
  VirtualListContentExposes,
} from '@proto.ui/prototypes-base/virtual-list';
import { definePrototype, tw } from '@proto.ui/core';
import {
  asVirtualListRoot,
  asVirtualListViewport,
  asVirtualListContent,
} from '@proto.ui/prototypes-base/virtual-list';
import {
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleProps,
} from '../style-scope';
export type * from '@proto.ui/prototypes-base/virtual-list';
export type ShadcnVirtualListRootProps = VirtualListRootProps & ShadcnStyleProps;
export type ShadcnVirtualListViewportProps = ShadcnStyleProps;
export type ShadcnVirtualListContentProps = ShadcnStyleProps;

// No Virtual List counterpart exists in shadcn-ui/ui@3d98900e's inventory.
// The existing neutral frame is a Proto extension for every style. Selection
// never manufactures item views or becomes a second collection/scroll owner.
export const virtualListRoot = definePrototype<ShadcnVirtualListRootProps, VirtualListRootExposes>({
  name: 'shadcn-virtual-list-root',
  modules: asVirtualListRoot.modules,
  setup(def) {
    const inherited = asVirtualListRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-lg border border-border bg-background shadow-sm grid gap-0'
      )
    );
    return inherited.render;
  },
});
export { virtualListRoot as shadcnVirtualListRoot };

export const virtualListViewport = definePrototype<
  ShadcnVirtualListViewportProps,
  VirtualListViewportExposes
>({
  name: 'shadcn-virtual-list-viewport',
  modules: asVirtualListViewport.modules,
  setup(def) {
    const inherited = asVirtualListViewport();
    setupShadcnStyleSelection(def, 'new-york-v4');
    const state = inherited.getAsHookHandle?.('as-scroll-area-viewport')?.stateHandles;
    if (!state)
      throw new Error('[shadcn-virtual-list] Required viewport focus state is unavailable.');
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground min-h-0 overflow-auto'));
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    return inherited.render;
  },
});
export { virtualListViewport as shadcnVirtualListViewport };

export const virtualListContent = definePrototype<
  ShadcnVirtualListContentProps,
  VirtualListContentExposes
>({
  name: 'shadcn-virtual-list-content',
  modules: asVirtualListContent.modules,
  setup(def) {
    const inherited = asVirtualListContent();
    setupShadcnStyleSelection(def, 'new-york-v4');
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground relative'));
    return inherited.render;
  },
});
export { virtualListContent as shadcnVirtualListContent };
