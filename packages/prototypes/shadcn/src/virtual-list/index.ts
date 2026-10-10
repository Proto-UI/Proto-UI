import { definePrototype, tw, type State } from '@proto.ui/core';
import {
  asVirtualListRoot,
  asVirtualListViewport,
  asVirtualListContent,
} from '@proto.ui/prototypes-base/virtual-list';
export type * from '@proto.ui/prototypes-base/virtual-list';
export const virtualListRoot = definePrototype({
  name: 'shadcn-virtual-list-root',
  setup(def) {
    const behavior = asVirtualListRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-lg border border-border bg-background shadow-sm grid gap-0'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { virtualListRoot as shadcnVirtualListRoot };
export const virtualListViewport = definePrototype({
  name: 'shadcn-virtual-list-viewport',
  setup(def) {
    const behavior = asVirtualListViewport();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground min-h-0 overflow-auto'));
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { virtualListViewport as shadcnVirtualListViewport };
export const virtualListContent = definePrototype({
  name: 'shadcn-virtual-list-content',
  setup(def) {
    const behavior = asVirtualListContent();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground relative'));
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { virtualListContent as shadcnVirtualListContent };
