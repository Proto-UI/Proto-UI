import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToolbarRoot } from '@proto.ui/prototypes-base/toolbar';
import {
  SHADCN_STYLE_IDS,
  SHADCN_STYLE_SCOPE,
  setupShadcnStyleScope,
  type ShadcnStyleId,
} from '../style-scope';
import type { ShadcnToolbarRootProps, ShadcnToolbarRootExposes } from './types';

const ROOT_RADIUS_HORIZONTAL = {
  vega: 'rounded-lg',
  nova: 'rounded-xl',
  maia: 'rounded-[var(--pui-radius-4xl)]',
  lyra: 'rounded-none',
  mira: 'rounded-lg',
  luma: 'rounded-[var(--pui-radius-4xl)]',
  sera: 'rounded-none',
  rhea: 'rounded-[var(--pui-radius-2xl)]',
  'new-york-v4': 'rounded-lg',
} as const satisfies Record<ShadcnStyleId, string>;

const ROOT_RADIUS_VERTICAL = {
  vega: 'rounded-lg',
  nova: 'rounded-xl',
  maia: 'rounded-2xl',
  lyra: 'rounded-none',
  mira: 'rounded-lg',
  luma: 'rounded-2xl',
  sera: 'rounded-none',
  rhea: 'rounded-[var(--pui-radius-2xl)]',
  'new-york-v4': 'rounded-lg',
} as const satisfies Record<ShadcnStyleId, string>;

export default definePrototype<ShadcnToolbarRootProps, ShadcnToolbarRootExposes>({
  name: 'shadcn-toolbar-root',
  modules: asToolbarRoot.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', options: ['default', 'ghost'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'default' });

    const behavior = asToolbarRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toolbar] Root state unavailable.');

    setupShadcnStyleScope(def);
    const style = def.state.enum('shadcnToolbarRootStyle', 'rhea', {
      options: SHADCN_STYLE_IDS,
    });
    const syncStyle = (run: RunHandle<ShadcnToolbarRootProps>) => {
      const next = run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? 'rhea';
      style.set(next, 'reason: shadcn toolbar root style');
    };
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, syncStyle);
    def.lifecycle.onCreated(syncStyle);
    def.lifecycle.onMounted(syncStyle);
    def.lifecycle.onUpdated(syncStyle);

    def.feedback.style.use(tw('flex w-fit min-w-0 gap-1 text-foreground'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row items-center')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col items-stretch')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('default'),
      intent: (i) => i.feedback.style.use(tw('border border-border bg-background p-1 shadow-xs')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('ghost'),
      intent: (i) =>
        i.feedback.style.use(tw('border border-transparent bg-transparent p-0 shadow-none')),
    });
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('variant').eq('default'),
            w.state(style).eq(profile),
            w.state(state.orientation).eq('horizontal')
          ),
        intent: (i) => i.feedback.style.use(tw(ROOT_RADIUS_HORIZONTAL[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('variant').eq('default'),
            w.state(style).eq(profile),
            w.state(state.orientation).eq('vertical')
          ),
        intent: (i) => i.feedback.style.use(tw(ROOT_RADIUS_VERTICAL[profile])),
      });
    }
    def.rule({
      when: (w) => w.all(w.prop('variant').eq('default'), w.state(state.disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    return behavior.render;
  },
});
