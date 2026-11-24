import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { type ProgressRootExposes, asProgressRoot } from '@proto.ui/prototypes-base/progress';
import {
  LIQUID_GLASS_PROGRESS_CONTEXT,
  LIQUID_GLASS_PROGRESS_PROMINENCES,
  normalizeLiquidGlassProgressProminence,
  type LiquidGlassProgressRootProps,
} from './shared';
export default definePrototype<LiquidGlassProgressRootProps, ProgressRootExposes>({
  name: 'liquid-glass-progress-root',
  modules: asProgressRoot.modules,
  setup(def) {
    const inherited = asProgressRoot();
    def.props.define({
      prominence: {
        type: 'enum',
        options: [...LIQUID_GLASS_PROGRESS_PROMINENCES],
        empty: 'fallback',
      },
      dir: { type: 'enum', options: ['ltr', 'rtl'], empty: 'fallback' },
    });
    def.props.setDefaults({ prominence: 'regular' });
    def.context.provide(LIQUID_GLASS_PROGRESS_CONTEXT, { prominence: 'regular' });
    const syncProminence = (run: RunHandle<LiquidGlassProgressRootProps>) => {
      const next =
        normalizeLiquidGlassProgressProminence(run.props.getRaw().prominence) ?? 'regular';
      if (run.context.tryRead(LIQUID_GLASS_PROGRESS_CONTEXT)?.prominence !== next) {
        run.context.update(LIQUID_GLASS_PROGRESS_CONTEXT, { prominence: next });
      }
    };
    def.context.trySubscribe(LIQUID_GLASS_PROGRESS_CONTEXT);
    def.props.watchRaw(['prominence'], syncProminence);
    def.lifecycle.onCreated(syncProminence);
    def.lifecycle.onMounted(syncProminence);
    def.lifecycle.onUpdated(syncProminence);
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-wrap items-center gap-2 font-sans text-foreground')
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
