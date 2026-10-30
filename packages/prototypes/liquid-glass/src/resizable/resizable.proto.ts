import type {
  ResizableRootProps,
  ResizableRootExposes,
  ResizablePanelProps,
  ResizablePanelExposes,
  ResizableHandleProps,
  ResizableHandleExposes,
} from '@proto.ui/prototypes-base/resizable';
import { definePrototype, tw } from '@proto.ui/core';
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
        'min-w-0 max-w-full text-foreground rounded-2xl border border-border bg-background overflow-hidden'
      )
    );
    return behavior.render;
  },
});
export { resizableRoot as liquidGlassResizableRoot };
export const resizablePanel = definePrototype<ResizablePanelProps, ResizablePanelExposes>({
  name: 'liquid-glass-resizable-panel',
  setup(def) {
    const behavior = asResizablePanel();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground p-4'));
    return behavior.render;
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
    const states = behavior.stateHandles!;
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-default')),
    });
    return behavior.render;
  },
});
export { resizableHandle as liquidGlassResizableHandle };
