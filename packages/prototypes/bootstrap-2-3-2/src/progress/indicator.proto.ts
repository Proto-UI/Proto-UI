import { definePrototype, tw, type RunHandle, type StyleHandle } from '@proto.ui/core';
import { type ProgressPartExposes, asProgressIndicator } from '@proto.ui/prototypes-base/progress';
import {
  BOOTSTRAP_PROGRESS_CONTEXT,
  BOOTSTRAP_PROGRESS_VARIANTS,
  normalizeBootstrapProgressVariant,
  type BootstrapProgressPartProps,
  type BootstrapProgressVariant,
} from './shared';

const VARIANT_GRADIENTS: Record<BootstrapProgressVariant, StyleHandle> = {
  default: tw('bg-[#0e90d2_linear-gradient(#149bdf,#0480be)_0_0_repeat-x]'),
  info: tw('bg-[#49afcd_linear-gradient(#5bc0de,#2f96b4)_0_0_repeat-x]'),
  success: tw('bg-[#5eb95e_linear-gradient(#62c462,#57a957)_0_0_repeat-x]'),
  warning: tw('bg-[#faa732_linear-gradient(#fbb450,#f89406)_0_0_repeat-x]'),
  danger: tw('bg-[#dd514c_linear-gradient(#ee5f5b,#c43c35)_0_0_repeat-x]'),
};

export default definePrototype<BootstrapProgressPartProps, ProgressPartExposes>({
  name: 'bootstrap-2-3-2-progress-indicator',
  modules: asProgressIndicator.modules,
  setup(def) {
    const inherited = asProgressIndicator();
    def.props.define({
      variant: {
        type: 'enum',
        options: [...BOOTSTRAP_PROGRESS_VARIANTS, 'inherit'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({ variant: 'inherit' });
    const variant = def.state.enum('bootstrapProgressVariant', 'default', {
      options: BOOTSTRAP_PROGRESS_VARIANTS,
    });
    const syncVariant = (run: RunHandle<BootstrapProgressPartProps>) => {
      const explicit = normalizeBootstrapProgressVariant(run.props.getRaw().variant);
      const inheritedVariant = run.context.tryRead(BOOTSTRAP_PROGRESS_CONTEXT)?.variant ?? null;
      variant.set(explicit ?? inheritedVariant ?? 'default', 'reason: bootstrap progress variant');
    };
    def.context.trySubscribe(BOOTSTRAP_PROGRESS_CONTEXT, syncVariant);
    def.props.watchRaw(['variant'], syncVariant);
    def.lifecycle.onCreated(syncVariant);
    def.lifecycle.onMounted(syncVariant);
    def.lifecycle.onUpdated(syncVariant);
    def.feedback.style.use(
      tw(
        'block h-full box-border text-[12px] text-center text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] shadow-[inset_0_-1px_0_rgb(0_0_0/15%)]'
      )
    );
    for (const name of BOOTSTRAP_PROGRESS_VARIANTS) {
      def.rule({
        when: (w) => w.state(variant).eq(name),
        intent: (i) => i.feedback.style.use(VARIANT_GRADIENTS[name]),
      });
    }
    // The retained width token and Base percentage State remain the sole target.
    def.feedback.style.transition({
      properties: ['width'],
      durationMs: 600,
      easing: [0.25, 0.1, 0.25, 1],
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.indeterminate).eq(false),
      intent: (i) => i.feedback.style.use(tw('float-left w-[calc(var(--pui-percentage)*1%)]')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('w-1/3 ms-auto me-auto opacity-80')),
    });
    return inherited.render;
  },
});
