import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asRadioGroupRoot } from '@proto.ui/prototypes-base/radio-group';
import { setupShadcnStyleScope, SHADCN_STYLE_SCOPE, SHADCN_STYLE_IDS } from '../style-scope';
import type { ShadcnRadioGroupRootExposes, ShadcnRadioGroupRootProps } from './types';

const radioGroupRoot = definePrototype<ShadcnRadioGroupRootProps, ShadcnRadioGroupRootExposes>({
  name: 'shadcn-radio-group-root',
  setup(def) {
    asRadioGroupRoot();
    setupShadcnStyleScope(def);
    // Current compatibility source is the independently retained base-nova
    // snapshot, not New York. The shared scope resolver alone owns precedence.
    const style = def.state.enum('radioGroupVisualStyle', 'nova', { options: SHADCN_STYLE_IDS });
    const sync = (run: RunHandle<ShadcnRadioGroupRootProps>) => {
      style.set(
        run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? 'nova',
        'reason: Radio Group scoped presentation'
      );
    };
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, sync);
    def.lifecycle.onCreated(sync);
    def.lifecycle.onMounted(sync);
    def.lifecycle.onUpdated(sync);
    def.feedback.style.use(tw('grid w-full'));
    for (const profile of ['nova', 'lyra'] as const) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw('gap-2')),
      });
    }
    for (const profile of [
      'new-york-v4',
      'vega',
      'maia',
      'mira',
      'luma',
      'sera',
      'rhea',
    ] as const) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw('gap-3')),
      });
    }
  },
});

export default radioGroupRoot;
