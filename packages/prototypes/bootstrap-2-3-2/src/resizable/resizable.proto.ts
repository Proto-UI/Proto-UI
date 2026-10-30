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

// Proto extension: no Resizable component existed in Bootstrap 2.3.2.
// Base retains its ratios, direction, keyboard input and host AxisInput lease.
export const resizableRoot = definePrototype<ResizableRootProps, ResizableRootExposes>({
  name: 'bootstrap-2-3-2-resizable-root',
  setup(def) {
    const inherited = asResizableRoot();
    def.feedback.style.use(
      tw('min-w-0 min-h-0 max-w-full text-foreground text-[14px] leading-[20px]')
    );
    return inherited.render;
  },
});
export { resizableRoot as bootstrap232ResizableRoot };

export const resizablePanel = definePrototype<ResizablePanelProps, ResizablePanelExposes>({
  name: 'bootstrap-2-3-2-resizable-panel',
  setup(def) {
    const inherited = asResizablePanel();
    def.feedback.style.use(tw('min-w-0 min-h-0 text-inherit'));
    return inherited.render;
  },
});
export { resizablePanel as bootstrap232ResizablePanel };

export const resizableHandle = definePrototype<ResizableHandleProps, ResizableHandleExposes>({
  name: 'bootstrap-2-3-2-resizable-handle',
  setup(def) {
    const inherited = asResizableHandle();
    const state = inherited.stateHandles!;
    def.feedback.style.use(tw('shrink-0 basis-[5px] border border-[#ccc] bg-[#eee] outline-none'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('cursor-ew-resize')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('cursor-ns-resize')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-inset forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-default')),
    });
    return inherited.render;
  },
});
export { resizableHandle as bootstrap232ResizableHandle };
