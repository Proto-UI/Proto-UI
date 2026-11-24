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
import { BRUTALIST_FOCUS_TOKENS } from '../style';
export type * from '@proto.ui/prototypes-base/resizable';

export type BrutalistResizableRootProps = ResizableRootProps & {
  /** Top-level default carries the outer 5px frame and hard 4px shadow; nested groups stay borderless. */
  variant?: 'default' | 'nested';
};
export type BrutalistResizablePanelProps = ResizablePanelProps;
export type BrutalistResizableHandleProps = ResizableHandleProps & {
  /** Optional Neobrutalist grip badge inside the single handle owner. */
  withHandle?: boolean;
};

export const resizableRoot = definePrototype<BrutalistResizableRootProps, ResizableRootExposes>({
  name: 'brutalist-resizable-root',
  modules: asResizableRoot.modules,
  setup(def) {
    const behavior = asResizableRoot();
    def.props.define({
      variant: { type: 'enum', options: ['default', 'nested'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'default' });
    def.feedback.style.use(
      tw(
        'h-full w-full min-w-0 min-h-0 max-w-full overflow-hidden text-foreground font-sans font-medium'
      )
    );
    def.rule({
      when: (w) => w.prop('variant').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw('rounded-base border-2 border-black bg-secondary-background shadow-[4px_4px_0_0_#000]')
        ),
    });
    return behavior.render;
  },
});
export { resizableRoot as brutalistResizableRoot };

export const resizablePanel = definePrototype<BrutalistResizablePanelProps, ResizablePanelExposes>({
  name: 'brutalist-resizable-panel',
  modules: asResizablePanel.modules,
  setup(def) {
    const behavior = asResizablePanel();
    // Padding belongs to panel content so a collapsed panel can reach zero extent.
    def.feedback.style.use(
      tw('min-w-0 min-h-0 max-w-full overflow-hidden text-foreground font-sans font-medium')
    );
    return behavior.render;
  },
});
export { resizablePanel as brutalistResizablePanel };

export const resizableHandle = definePrototype<
  BrutalistResizableHandleProps,
  ResizableHandleExposes
>({
  name: 'brutalist-resizable-handle',
  modules: asResizableHandle.modules,
  setup(def) {
    const behavior = asResizableHandle();
    const state = behavior.stateHandles!;
    const axis = def.state.string('brutalistResizableAxis', 'horizontal');
    let mounted = false;
    let pending: { cancel(): void } | null = null;
    const refresh = (run: RunHandle<BrutalistResizableHandleProps>) => {
      if (!mounted) return;
      pending?.cancel();
      pending = delay(0, () => {
        pending = null;
        if (mounted) run.update();
      });
    };
    const syncAxis = (run: RunHandle<BrutalistResizableHandleProps>) => {
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
        'relative flex shrink-0 items-center justify-center bg-black text-foreground outline-none select-none touch-none'
      )
    );
    def.rule({
      when: (w) => w.state(axis).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('w-0.5 h-full')),
    });
    def.rule({
      when: (w) => w.state(axis).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-0.5 w-full')),
    });
    def.rule({
      when: (w) => w.all(w.state(axis).eq('horizontal'), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('cursor-ew-resize')),
    });
    def.rule({
      when: (w) => w.all(w.state(axis).eq('vertical'), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('cursor-ns-resize')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`z-10 ${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
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
      if (!r.read.props.get().withHandle) return behavior.render ? behavior.render(r) : r.slot();
      const vertical = axis.get() === 'vertical';
      return [
        r.el(
          'div',
          {
            style: vertical
              ? tw(
                  'z-10 flex shrink-0 h-3.5 w-5 items-center justify-center rounded-base border-2 border-black bg-main text-main-foreground select-none'
                )
              : tw(
                  'z-10 flex shrink-0 h-5 w-3.5 items-center justify-center rounded-base border-2 border-black bg-main text-main-foreground select-none'
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
export { resizableHandle as brutalistResizableHandle };
