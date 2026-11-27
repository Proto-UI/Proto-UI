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
import { COMMAND_DISABLED, COMMAND_FOCUS } from '../interactive-surface';
export type * from '@proto.ui/prototypes-base/resizable';

export type LiquidGlassResizableRootProps = ResizableRootProps & {
  /** Top-level default applies concentric rounded-2xl framing; nested groups stay unframed to avoid chrome stacking. */
  variant?: 'default' | 'nested';
  /** Auto enables translucent layering when user preferences allow; opaque forces solid fallback fills. */
  material?: 'auto' | 'opaque';
};
export type LiquidGlassResizablePanelProps = ResizablePanelProps;
export type LiquidGlassResizableHandleProps = ResizableHandleProps & {
  /** Show a floating rounded-full capsule grabber inside the single handle owner. */
  withHandle?: boolean;
  /** Visual hierarchy for the grabber capsule. */
  prominence?: 'regular' | 'prominent';
  /** Auto enables translucent layering when user preferences allow; opaque forces solid fallback fills. */
  material?: 'auto' | 'opaque';
};

export const resizableRoot = definePrototype<LiquidGlassResizableRootProps, ResizableRootExposes>({
  name: 'liquid-glass-resizable-root',
  modules: asResizableRoot.modules,
  setup(def) {
    const behavior = asResizableRoot();
    def.props.define({
      variant: { type: 'enum', options: ['default', 'nested'], empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'default', material: 'auto' });
    def.feedback.style.use(
      tw('h-full w-full min-w-0 min-h-0 max-w-full overflow-hidden font-sans text-foreground')
    );
    // Keep content panes neutral (no glass material slot) so nested split layouts
    // never stack glass-on-glass and reduced-transparency fallbacks stay solid.
    def.rule({
      when: (w) => w.prop('variant').eq('default'),
      intent: (i) =>
        i.feedback.style.use(tw('rounded-2xl border border-border bg-secondary shadow-sm')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('default'),
          w.prop('material').eq('auto'),
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary/80 ring-1 ring-inset ring-border')),
    });
    return behavior.render;
  },
});
export { resizableRoot as liquidGlassResizableRoot };

export const resizablePanel = definePrototype<
  LiquidGlassResizablePanelProps,
  ResizablePanelExposes
>({
  name: 'liquid-glass-resizable-panel',
  modules: asResizablePanel.modules,
  setup(def) {
    const behavior = asResizablePanel();
    // Keep the sizing surface free of padding so zero means physically collapsed.
    def.feedback.style.use(
      tw('min-w-0 min-h-0 max-w-full overflow-hidden font-sans text-foreground')
    );
    return behavior.render;
  },
});
export { resizablePanel as liquidGlassResizablePanel };

export const resizableHandle = definePrototype<
  LiquidGlassResizableHandleProps,
  ResizableHandleExposes
>({
  name: 'liquid-glass-resizable-handle',
  modules: asResizableHandle.modules,
  setup(def) {
    const behavior = asResizableHandle();
    const states = behavior.stateHandles!;
    const axis = def.state.string('liquidGlassResizableAxis', 'horizontal');
    let mounted = false;
    let pending: { cancel(): void } | null = null;
    const refresh = (run: RunHandle<LiquidGlassResizableHandleProps>) => {
      if (!mounted) return;
      pending?.cancel();
      pending = delay(0, () => {
        pending = null;
        if (mounted) run.update();
      });
    };
    const syncAxis = (run: RunHandle<LiquidGlassResizableHandleProps>) => {
      const nextAxis = run.context.read(RESIZABLE_CONTEXT).orientation;
      if (axis.get() !== nextAxis) {
        axis.set(nextAxis, 'resizable owner axis');
        refresh(run);
      }
    };
    def.context.subscribe(RESIZABLE_CONTEXT, syncAxis);
    def.lifecycle.onCreated(syncAxis);
    def.props.define({
      withHandle: { type: 'boolean', empty: 'fallback' },
      prominence: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ withHandle: false, prominence: 'regular', material: 'auto' });
    def.props.watch(['withHandle', 'prominence', 'material'], refresh);
    def.feedback.style.use(
      tw(
        'relative flex shrink-0 items-center justify-center bg-border text-foreground outline-none select-none touch-none transition-colors'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.state(states.disabled).eq(false),
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-border/60')),
    });
    def.rule({
      when: (w) => w.state(axis).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('w-px h-full')),
    });
    def.rule({
      when: (w) => w.state(axis).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-px w-full')),
    });
    def.rule({
      when: (w) => w.all(w.state(axis).eq('horizontal'), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('cursor-ew-resize')),
    });
    def.rule({
      when: (w) => w.all(w.state(axis).eq('vertical'), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('cursor-ns-resize')),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(`z-10 bg-ring ${COMMAND_FOCUS}`)),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} bg-muted`)),
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
      const props = r.read.props.get();
      const vertical = axis.get() === 'vertical';
      const hitArea = r.el('span', {
        style: vertical
          ? tw('absolute block left-0 top-1/2 -translate-y-1/2 w-full h-4 z-10 select-none')
          : tw('absolute block top-0 left-1/2 -translate-x-1/2 h-full w-4 z-10 select-none'),
      });
      if (!props.withHandle) {
        const base = behavior.render ? behavior.render(r) : r.slot();
        return Array.isArray(base) ? [hitArea, ...base] : [hitArea, base];
      }
      const prominent = props.prominence === 'prominent';
      const opaque = props.material === 'opaque';
      const capsuleSurface = prominent
        ? opaque
          ? 'bg-primary text-primary-foreground'
          : 'bg-primary/90 text-primary-foreground ring-1 ring-inset ring-foreground/10'
        : opaque
          ? 'bg-secondary text-secondary-foreground'
          : 'bg-secondary/80 text-secondary-foreground ring-1 ring-inset ring-foreground/10';
      const barTone = prominent ? 'bg-primary-foreground/80' : 'bg-foreground/30';
      return [
        hitArea,
        r.el(
          'div',
          {
            style: tw(
              `z-10 flex shrink-0 items-center justify-center rounded-full border border-border shadow-md select-none ${
                vertical ? 'h-2.5 w-8' : 'h-8 w-2.5'
              } ${capsuleSurface}`
            ),
          },
          r.el('span', {
            style: tw(`block rounded-full ${vertical ? 'h-0.5 w-4' : 'h-4 w-0.5'} ${barTone}`),
          })
        ),
        r.slot(),
      ];
    };
  },
});
export { resizableHandle as liquidGlassResizableHandle };
