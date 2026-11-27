import type {
  ResizableRootProps,
  ResizableRootExposes,
  ResizablePanelProps,
  ResizablePanelExposes,
  ResizableHandleExposes,
  ResizableHandleProps,
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
export type ShadcnResizableHandleProps = ResizableHandleProps &
  ShadcnStyleProps & {
    /** Optional decorative grip surface inside the single handle owner. */
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
    // Base owns complementary size and its percentage flex basis; clip panel
    // overflow so narrow or collapsed panels do not flash scrollbars.
    def.feedback.style.use(tw('overflow-hidden'));
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
      const nextAxis = run.context.read(RESIZABLE_CONTEXT).orientation;
      if (axis.get() !== nextAxis) {
        axis.set(nextAxis, 'resizable owner axis');
        refresh(run);
      }
    };
    def.context.subscribe(RESIZABLE_CONTEXT, syncAxis);
    def.lifecycle.onCreated(syncAxis);
    // Observe selector inputs after setupShadcnStyleSelection; its own State
    // is not an author-watchable borrowed handle.
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, refresh);
    def.props.watchRaw(['styleProfile'], refresh);
    def.props.define({ withHandle: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ withHandle: false });
    def.props.watch(['withHandle'], refresh);
    def.feedback.style.use(
      tw(
        'relative flex shrink-0 items-center justify-center bg-border ring-offset-background outline-none select-none touch-none transition-colors'
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
        i.feedback.style.use(tw('z-10 ring-1 ring-ring ring-offset-1 forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    // Ordinary decorative grip stays inside the single inherited input owner so
    // pointer grabs on the visible pill bubble directly to the handle host.
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
      const vertical = axis.get() === 'vertical';
      // Expanded transparent hit surface centered on the 1px visual separator
      // so pointer acquisition works along the full divider without altering
      // flex track layout or adding a second focus/accessibility owner.
      const hitArea = r.el('span', {
        style: vertical
          ? tw('absolute block left-0 top-1/2 -translate-y-1/2 w-full h-4 z-10 select-none')
          : tw('absolute block top-0 left-1/2 -translate-x-1/2 h-full w-4 z-10 select-none'),
      });
      if (!r.read.props.get().withHandle) {
        const base = inherited.render ? inherited.render(r) : r.slot();
        return Array.isArray(base) ? [hitArea, ...base] : [hitArea, base];
      }
      if (style.get() === 'new-york-v4') {
        return [
          hitArea,
          r.el(
            'div',
            {
              style: vertical
                ? tw(
                    'z-10 flex shrink-0 h-3 w-4 items-center justify-center rounded-xs border border-border bg-border text-foreground select-none'
                  )
                : tw(
                    'z-10 flex shrink-0 h-4 w-3 items-center justify-center rounded-xs border border-border bg-border text-foreground select-none'
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
        hitArea,
        r.el('div', {
          style: vertical
            ? square
              ? tw('z-10 flex shrink-0 h-1 w-6 rounded-none bg-border select-none')
              : tw('z-10 flex shrink-0 h-1 w-6 rounded-lg bg-border select-none')
            : square
              ? tw('z-10 flex shrink-0 h-6 w-1 rounded-none bg-border select-none')
              : tw('z-10 flex shrink-0 h-6 w-1 rounded-lg bg-border select-none'),
        }),
        r.slot(),
      ];
    };
  },
});
export { resizableHandle as shadcnResizableHandle };
