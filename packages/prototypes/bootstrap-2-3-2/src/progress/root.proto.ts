import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { type ProgressRootExposes, asProgressRoot } from '@proto.ui/prototypes-base/progress';
import {
  BOOTSTRAP_PROGRESS_CONTEXT,
  BOOTSTRAP_PROGRESS_VARIANTS,
  normalizeBootstrapProgressVariant,
  type BootstrapProgressRootProps,
} from './shared';
export default definePrototype<BootstrapProgressRootProps, ProgressRootExposes>({
  name: 'bootstrap-2-3-2-progress-root',
  modules: asProgressRoot.modules,
  setup(def) {
    const inherited = asProgressRoot();
    def.props.define({
      variant: {
        type: 'enum',
        options: [...BOOTSTRAP_PROGRESS_VARIANTS],
        empty: 'fallback',
      },
      dir: { type: 'enum', options: ['ltr', 'rtl'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'default' });
    def.context.provide(BOOTSTRAP_PROGRESS_CONTEXT, { variant: 'default' });
    const syncVariant = (run: RunHandle<BootstrapProgressRootProps>) => {
      const next = normalizeBootstrapProgressVariant(run.props.getRaw().variant) ?? 'default';
      if (run.context.tryRead(BOOTSTRAP_PROGRESS_CONTEXT)?.variant !== next) {
        run.context.update(BOOTSTRAP_PROGRESS_CONTEXT, { variant: next });
      }
    };
    def.context.trySubscribe(BOOTSTRAP_PROGRESS_CONTEXT);
    def.props.watchRaw(['variant'], syncVariant);
    def.lifecycle.onCreated(syncVariant);
    def.lifecycle.onMounted(syncVariant);
    def.lifecycle.onUpdated(syncVariant);
    // The semantic Root also carries .progress's 20px outer spacing. Label
    // and Value are Proto accessibility/readout parts, not upstream classes.
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 flex-wrap items-center gap-[5px] mb-[20px] font-sans text-[14px] leading-[20px] text-foreground'
      )
    );
    def.rule({
      when: (w) => w.prop('dir').eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('direction-rtl')),
    });
    def.rule({
      when: (w) => w.prop('dir').eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('direction-ltr')),
    });
    return inherited.render;
  },
});
