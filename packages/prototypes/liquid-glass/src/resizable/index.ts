import type {
  ResizableRootProps,
  ResizableRootExposes,
  ResizablePanelProps,
  ResizablePanelExposes,
  ResizableHandleProps,
  ResizableHandleExposes,
} from '@proto.ui/prototypes-base/resizable';
import { definePrototype, tw, type State } from '@proto.ui/core';
import {
  asResizableRoot,
  asResizablePanel,
  asResizableHandle,
} from '@proto.ui/prototypes-base/resizable';
export type * from '@proto.ui/prototypes-base/resizable';
export const resizableRoot = definePrototype<ResizableRootProps, ResizableRootExposes>({
  name: 'liquid-glass-resizable-root',
  setup(def) {
    const behavior = asResizableRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-2xl border border-border bg-secondary shadow-lg overflow-hidden'
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
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { resizableRoot as liquidGlassResizableRoot };
export const resizablePanel = definePrototype<ResizablePanelProps, ResizablePanelExposes>({
  name: 'liquid-glass-resizable-panel',
  setup(def) {
    const behavior = asResizablePanel();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground p-4'));
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { resizablePanel as liquidGlassResizablePanel };
export const resizableHandle = definePrototype<ResizableHandleProps, ResizableHandleExposes>({
  name: 'liquid-glass-resizable-handle',
  setup(def) {
    const behavior = asResizableHandle();
    def.feedback.style.use(
      tw('min-w-0 max-w-full text-foreground shrink-0 basis-2 bg-border cursor-move')
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { resizableHandle as liquidGlassResizableHandle };
