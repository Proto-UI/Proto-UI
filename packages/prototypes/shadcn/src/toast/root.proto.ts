import { definePrototype, tw, type RendererHandle, type RunHandle } from '@proto.ui/core';
import {
  asToastRoot,
  type ToastRootExposes,
  type ToastType,
} from '@proto.ui/prototypes-base/toast';
import type { ToastRootProps } from './types';
import { SHADCN_STYLE_IDS, SHADCN_STYLE_SCOPE, setupShadcnStyleScope } from '../style-scope';
import { TOAST_RADIUS, TOAST_ROOT_RECIPES } from './recipes';

function renderToastIcon(r: RendererHandle<any>, kind: ToastType) {
  if (kind === 'default') return null;
  const svgBase = {
    viewBox: '0 0 24 24',
    width: '16',
    height: '16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': 'true' as const,
  };
  if (kind === 'success') {
    return r.el(
      'span',
      { style: tw('inline-flex shrink-0 items-center justify-center mt-0.5 text-foreground') },
      r.svg.root(svgBase, [
        r.svg.circle({ cx: 12, cy: 12, r: 10 }),
        r.svg.path({ d: 'm9 12 2 2 4-4' }),
      ])
    );
  }
  if (kind === 'info') {
    return r.el(
      'span',
      { style: tw('inline-flex shrink-0 items-center justify-center mt-0.5 text-foreground') },
      r.svg.root(svgBase, [
        r.svg.circle({ cx: 12, cy: 12, r: 10 }),
        r.svg.path({ d: 'M12 16v-4' }),
        r.svg.path({ d: 'M12 8h.01' }),
      ])
    );
  }
  if (kind === 'warning') {
    return r.el(
      'span',
      { style: tw('inline-flex shrink-0 items-center justify-center mt-0.5 text-foreground') },
      r.svg.root(svgBase, [
        r.svg.path({
          d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
        }),
        r.svg.path({ d: 'M12 9v4' }),
        r.svg.path({ d: 'M12 17h.01' }),
      ])
    );
  }
  if (kind === 'error') {
    return r.el(
      'span',
      { style: tw('inline-flex shrink-0 items-center justify-center mt-0.5 text-destructive') },
      r.svg.root(svgBase, [
        r.svg.circle({ cx: 12, cy: 12, r: 10 }),
        r.svg.path({ d: 'm15 9-6 6' }),
        r.svg.path({ d: 'm9 9 6 6' }),
      ])
    );
  }
  return r.el(
    'span',
    {
      style: tw(
        'inline-flex shrink-0 items-center justify-center mt-0.5 text-muted-foreground animate-spin'
      ),
    },
    r.svg.root(svgBase, [r.svg.path({ d: 'M21 12a9 9 0 1 1-6.219-8.56' })])
  );
}

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'shadcn-toast-root',
  setup(def) {
    const behavior = asToastRoot();
    const toastState = behavior.stateHandles!;
    setupShadcnStyleScope(def);
    def.props.define({
      richColors: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ richColors: false });
    // As in the existing Card scope owner, observe the already resolved scope;
    // do not declare a second choice/default resolver on the same Root.
    const style = def.state.enum('toastResolvedStyle', 'new-york-v4', {
      options: SHADCN_STYLE_IDS,
    });
    const selected = def.state.bool('toastHasStyleSelection', false);
    const sync = (run: RunHandle<ToastRootProps>) => {
      const next = run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? null;
      style.set(next ?? 'new-york-v4', 'reason: observe Toast style scope');
      selected.set(next !== null, 'reason: observe Toast style selection presence');
    };
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, sync);
    def.lifecycle.onCreated(sync);
    def.lifecycle.onMounted(sync);
    def.lifecycle.onUpdated(sync);
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.all(w.state(selected).eq(true), w.state(style).eq(profile)),
        intent: (i) => i.feedback.style.use(TOAST_RADIUS[profile], TOAST_ROOT_RECIPES[profile]),
      });
    }
    for (const profile of ['luma', 'rhea'] as const) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(selected).eq(true),
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
      });
    }
    def.rule({
      when: (w) => w.state(selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-popover text-popover-foreground')),
    });
    // The previously unpinned Proto Toast remains the compatibility fallback;
    // it is not presented as the separately selected New York recipe.
    def.rule({
      when: (w) => w.state(selected).eq(false),
      intent: (i) => i.feedback.style.use(tw('rounded-md bg-background text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(toastState.type).eq('error'), w.prop('richColors').eq(false)),
      intent: (i) => i.feedback.style.use(tw('border-destructive/50')),
    });
    def.rule({
      when: (w) => w.all(w.state(toastState.type).eq('error'), w.prop('richColors').eq(true)),
      intent: (i) =>
        i.feedback.style.use(tw('border-destructive bg-destructive text-destructive-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(toastState.type).eq('success'), w.prop('richColors').eq(true)),
      intent: (i) =>
        i.feedback.style.use(tw('border-primary/40 bg-secondary text-secondary-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(toastState.type).eq('info'), w.prop('richColors').eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-border bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(toastState.type).eq('warning'), w.prop('richColors').eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-ring/50 bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    def.feedback.style.use(
      tw(
        'border border-border shadow-lg flex items-start gap-3 min-w-0 w-full p-4 text-start transition-opacity duration-150'
      )
    );
    return (r) => {
      const icon = renderToastIcon(r, toastState.type.get());
      if (!icon) return r.el('div', { style: tw('grid gap-2 min-w-0 flex-1') }, r.slot());
      return [icon, r.el('div', { style: tw('grid gap-2 min-w-0 flex-1') }, r.slot())];
    };
  },
});
