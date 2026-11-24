import type {
  ResizableRootProps,
  ResizableRootExposes,
  ResizablePanelProps,
  ResizablePanelExposes,
  ResizableHandleProps,
  ResizableHandleExposes,
} from '@proto.ui/prototypes-base/resizable';
import { definePrototype, tw, delay, type RunHandle } from '@proto.ui/core';
import {
  asResizableRoot,
  asResizablePanel,
  asResizableHandle,
  RESIZABLE_CONTEXT,
} from '@proto.ui/prototypes-base/resizable';
export type * from '@proto.ui/prototypes-base/resizable';

export type Bootstrap232ResizableHandleProps = ResizableHandleProps & {
  /** Optional recessed grip badge inside the single handle owner. */
  withHandle?: boolean;
};

// Proto extension: no Resizable component existed in Bootstrap 2.3.2.
// Base retains its ratios, direction, keyboard input and host AxisInput lease.
export const resizableRoot = definePrototype<ResizableRootProps, ResizableRootExposes>({
  name: 'bootstrap-2-3-2-resizable-root',
  modules: asResizableRoot.modules,
  setup(def) {
    const inherited = asResizableRoot();
    def.feedback.style.use(
      tw(
        'h-full w-full min-w-0 min-h-0 max-w-full font-sans text-foreground text-[14px] leading-[20px]'
      )
    );
    return inherited.render;
  },
});
export { resizableRoot as bootstrap232ResizableRoot };

export const resizablePanel = definePrototype<ResizablePanelProps, ResizablePanelExposes>({
  name: 'bootstrap-2-3-2-resizable-panel',
  modules: asResizablePanel.modules,
  setup(def) {
    const inherited = asResizablePanel();
    def.feedback.style.use(tw('min-w-0 min-h-0 overflow-hidden text-inherit'));
    return inherited.render;
  },
});
export { resizablePanel as bootstrap232ResizablePanel };

export const resizableHandle = definePrototype<
  Bootstrap232ResizableHandleProps,
  ResizableHandleExposes
>({
  name: 'bootstrap-2-3-2-resizable-handle',
  modules: asResizableHandle.modules,
  setup(def) {
    const inherited = asResizableHandle();
    const state = inherited.stateHandles!;
    const axis = def.state.string('bootstrap232ResizableAxis', 'horizontal');
    let mounted = false;
    let pending: { cancel(): void } | null = null;
    const refresh = (run: RunHandle<Bootstrap232ResizableHandleProps>) => {
      if (!mounted) return;
      pending?.cancel();
      pending = delay(0, () => {
        pending = null;
        if (mounted) run.update();
      });
    };
    const syncAxis = (run: RunHandle<Bootstrap232ResizableHandleProps>) => {
      axis.set(run.context.read(RESIZABLE_CONTEXT).orientation, 'resizable owner axis');
      refresh(run);
    };
    def.context.subscribe(RESIZABLE_CONTEXT, syncAxis);
    def.lifecycle.onCreated(syncAxis);
    def.props.define({ withHandle: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ withHandle: false });
    def.props.watch(['withHandle'], refresh);
    def.feedback.style.use(
      tw(
        'relative flex shrink-0 items-center justify-center basis-[6px] border border-[#ccc] bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x] shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)] text-muted-foreground outline-none select-none touch-none transition-[border,box-shadow]'
      )
    );
    def.rule({
      when: (w) =>
        w.all(w.state(state.orientation).eq('vertical'), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('cursor-ew-resize')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state.orientation).eq('horizontal'), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('cursor-ns-resize')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'z-10 border-[rgb(82_168_236/80%)] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_8px_rgb(82_168_236/60%)] forced-colors-focus-outline'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[#e6e6e6] opacity-65 cursor-not-allowed shadow-none')),
    });
    def.lifecycle.onMounted(() => {
      mounted = true;
    });
    def.lifecycle.onUnmounted(() => {
      mounted = false;
      pending?.cancel();
      pending = null;
    });
    def.lifecycle.onBeforeDispose(() => {
      mounted = false;
      pending?.cancel();
      pending = null;
    });
    return (r) => {
      if (!r.read.props.get().withHandle) return inherited.render ? inherited.render(r) : r.slot();
      const vertical = axis.get() === 'vertical';
      return [
        r.el(
          'div',
          {
            style: vertical
              ? tw(
                  'z-10 flex shrink-0 h-3 w-5 items-center justify-center rounded-[3px] border border-[#bbb] bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x] shadow-[inset_0_1px_0_#fff] text-muted-foreground select-none'
                )
              : tw(
                  'z-10 flex shrink-0 h-5 w-3 items-center justify-center rounded-[3px] border border-[#bbb] bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x] shadow-[inset_0_1px_0_#fff] text-muted-foreground select-none'
                ),
          },
          r.el(
            'span',
            { style: tw('block size-2.5') },
            r.svg.root(
              {
                viewBox: '0 0 24 24',
                width: '100%',
                height: '100%',
                'aria-hidden': 'true',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2,
                strokeLinecap: 'round',
              },
              r.svg.path({
                d: vertical
                  ? 'M8 9h.01M12 9h.01M16 9h.01M8 15h.01M12 15h.01M16 15h.01'
                  : 'M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01',
              })
            )
          )
        ),
        r.slot(),
      ];
    };
  },
});
export { resizableHandle as bootstrap232ResizableHandle };
