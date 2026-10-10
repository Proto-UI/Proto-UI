import { definePrototype, tw, type State } from '@proto.ui/core';
import {
  asResizableRoot,
  asResizablePanel,
  asResizableHandle,
} from '@proto.ui/prototypes-base/resizable';
export type * from '@proto.ui/prototypes-base/resizable';
export const resizableRoot = definePrototype({
  name: 'bootstrap-2-3-2-resizable-root',
  setup(def) {
    const behavior = asResizableRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-[4px] border border-border bg-background shadow-sm overflow-hidden'
      )
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
export { resizableRoot as bootstrap232ResizableRoot };
export const resizablePanel = definePrototype({
  name: 'bootstrap-2-3-2-resizable-panel',
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
export { resizablePanel as bootstrap232ResizablePanel };
export const resizableHandle = definePrototype({
  name: 'bootstrap-2-3-2-resizable-handle',
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
export { resizableHandle as bootstrap232ResizableHandle };
