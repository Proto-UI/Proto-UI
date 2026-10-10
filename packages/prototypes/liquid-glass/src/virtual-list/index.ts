import type {
  VirtualListRootProps,
  VirtualListRootExposes,
  VirtualListViewportProps,
  VirtualListViewportExposes,
  VirtualListContentProps,
  VirtualListContentExposes,
} from '@proto.ui/prototypes-base/virtual-list';
import { definePrototype, tw, type State } from '@proto.ui/core';
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
        'min-w-0 max-w-full text-foreground rounded-2xl border border-border bg-secondary shadow-lg grid gap-0'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.feedback.material.use({ intent: 'liquid-glass' });
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
export { virtualListRoot as liquidGlassVirtualListRoot };
export const virtualListViewport = definePrototype<
  VirtualListViewportProps,
  VirtualListViewportExposes
>({
  name: 'liquid-glass-virtual-list-viewport',
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
export { virtualListViewport as liquidGlassVirtualListViewport };
export const virtualListContent = definePrototype<
  VirtualListContentProps,
  VirtualListContentExposes
>({
  name: 'liquid-glass-virtual-list-content',
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
export { virtualListContent as liquidGlassVirtualListContent };
