import type {
  ResizableRootProps,
  ResizableRootExposes,
  ResizablePanelProps,
  ResizablePanelExposes,
  ResizableHandleExposes,
} from '@proto.ui/prototypes-base/resizable';
import { definePrototype, tw, delay, type RunHandle } from '@proto.ui/core';
import {
  asResizableRoot,
  asResizablePanel,
  asResizableHandle,
  RESIZABLE_CONTEXT,
} from '@proto.ui/prototypes-base/resizable';
import {
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  SHADCN_STYLE_SCOPE,
  type ShadcnStyleProps,
} from '../style-scope';
export type * from '@proto.ui/prototypes-base/resizable';
export type ShadcnResizableRootProps = ResizableRootProps & ShadcnStyleProps;
export type ShadcnResizablePanelProps = ResizablePanelProps & ShadcnStyleProps;
export type ShadcnResizableHandleProps = ShadcnStyleProps & {
  /** Optional inert grip paint, not another drag/focus target. */
  withHandle?: boolean;
};

export const resizableRoot = definePrototype<ShadcnResizableRootProps, ResizableRootExposes>({
  name: 'shadcn-resizable-root',
  modules: asResizableRoot.modules,
  setup(def) {
    const inherited = asResizableRoot();
    setupShadcnStyleScope(def);
    // Both pinned upstream groups use flex h-full w-full. Borders and panel
    // padding belong to their examples, not to the Resizable primitive.
    def.feedback.style.use(tw('h-full w-full'));
    return inherited.render;
  },
});
export { resizableRoot as shadcnResizableRoot };

export const resizablePanel = definePrototype<ShadcnResizablePanelProps, ResizablePanelExposes>({
  name: 'shadcn-resizable-panel',
  modules: asResizablePanel.modules,
  setup(def) {
    const inherited = asResizablePanel();
    setupShadcnStyleSelection(def, 'new-york-v4');
    // Base owns complementary size and its percentage flex basis. The
    // upstream Panel is deliberately unstyled; never overwrite that basis.
    return inherited.render;
  },
});
export { resizablePanel as shadcnResizablePanel };

export const resizableHandle = definePrototype<ShadcnResizableHandleProps, ResizableHandleExposes>({
  name: 'shadcn-resizable-handle',
  modules: asResizableHandle.modules,
  setup(def) {
    const inherited = asResizableHandle();
    const state = inherited.stateHandles!;
    const style = setupShadcnStyleSelection(def, 'new-york-v4');
    const axis = def.state.string('shadcnResizableAxis', 'horizontal');
    let mounted = false;
    let pending: { cancel(): void } | null = null;
    const refresh = (run: RunHandle<ShadcnResizableHandleProps>) => {
      if (!mounted) return;
      pending?.cancel();
      pending = delay(0, () => {
        pending = null;
        if (mounted) run.update();
      });
    };
    const syncAxis = (run: RunHandle<ShadcnResizableHandleProps>) => {
      axis.set(run.context.read(RESIZABLE_CONTEXT).orientation, 'resizable owner axis');
      refresh(run);
    };
    def.context.subscribe(RESIZABLE_CONTEXT, syncAxis);
    def.lifecycle.onCreated(syncAxis);
    // Observe selector inputs after setupShadcnStyleSelection; its own State
    // is not an author-watchable borrowed handle.
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, refresh);
    def.props.watchRaw(['styleProfile'], refresh);
    def.props.define({ withHandle: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ withHandle: false });
    def.feedback.style.use(
      tw(
        'relative flex shrink-0 items-center justify-center bg-border ring-offset-background outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(axis).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('w-px h-full')),
    });
    def.rule({
      when: (w) => w.state(axis).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-px w-full')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-1 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.focusVisible).eq(true), w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('ring-offset-1')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    // Ordinary decorative containers preserve the one inherited input owner.
    // Upstream's .25rem pseudo hit-slop is not replaced with a wider layout
    // separator. Exact expansion around 1px needs a mixed-unit self inset;
    // the current public hit-inset vocabulary accepts only a px or rem length.
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
      if (style.get() === 'new-york-v4') {
        return [
          r.el(
            'div',
            {
              style: vertical
                ? tw(
                    'pointer-events-none z-10 flex h-3 w-4 items-center justify-center rounded-xs border border-border bg-border'
                  )
                : tw(
                    'pointer-events-none z-10 flex h-4 w-3 items-center justify-center rounded-xs border border-border bg-border'
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
      }
      const square = style.get() === 'lyra' || style.get() === 'sera';
      return [
        r.el('div', {
          style: vertical
            ? square
              ? tw('pointer-events-none z-10 flex shrink-0 h-1 w-6 rounded-none bg-border')
              : tw('pointer-events-none z-10 flex shrink-0 h-1 w-6 rounded-lg bg-border')
            : square
              ? tw('pointer-events-none z-10 flex shrink-0 h-6 w-1 rounded-none bg-border')
              : tw('pointer-events-none z-10 flex shrink-0 h-6 w-1 rounded-lg bg-border'),
        }),
        r.slot(),
      ];
    };
  },
});
export { resizableHandle as shadcnResizableHandle };
