import { definePrototype, tw, type RunHandle, type StyleHandle } from '@proto.ui/core';
import { type ProgressPartExposes, asProgressIndicator } from '@proto.ui/prototypes-base/progress';
import {
  LIQUID_GLASS_PROGRESS_CONTEXT,
  LIQUID_GLASS_PROGRESS_PROMINENCES,
  normalizeLiquidGlassProgressProminence,
  type LiquidGlassProgressPartProps,
  type LiquidGlassProgressProminence,
} from './shared';

const INDICATOR_PROMINENCE: Record<LiquidGlassProgressProminence, StyleHandle> = {
  regular: tw('bg-primary'),
  prominent: tw('bg-primary shadow-xs'),
  destructive: tw('bg-destructive'),
};

export default definePrototype<LiquidGlassProgressPartProps, ProgressPartExposes>({
  name: 'liquid-glass-progress-indicator',
  modules: asProgressIndicator.modules,
  setup(def) {
    const inherited = asProgressIndicator();
    def.props.define({
      prominence: {
        type: 'enum',
        options: [...LIQUID_GLASS_PROGRESS_PROMINENCES, 'inherit'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({ prominence: 'inherit' });
    const prominence = def.state.enum('liquidGlassProgressProminence', 'regular', {
      options: LIQUID_GLASS_PROGRESS_PROMINENCES,
    });
    const syncProminence = (run: RunHandle<LiquidGlassProgressPartProps>) => {
      const explicit = normalizeLiquidGlassProgressProminence(run.props.getRaw().prominence);
      const inheritedProminence =
        run.context.tryRead(LIQUID_GLASS_PROGRESS_CONTEXT)?.prominence ?? null;
      prominence.set(
        explicit ?? inheritedProminence ?? 'regular',
        'reason: liquid glass progress prominence'
      );
    };
    def.context.trySubscribe(LIQUID_GLASS_PROGRESS_CONTEXT, syncProminence);
    def.props.watchRaw(['prominence'], syncProminence);
    def.lifecycle.onCreated(syncProminence);
    def.lifecycle.onMounted(syncProminence);
    def.lifecycle.onUpdated(syncProminence);
    def.feedback.style.use(tw('block h-full rounded-full'));
    for (const level of LIQUID_GLASS_PROGRESS_PROMINENCES) {
      def.rule({
        when: (w) => w.state(prominence).eq(level),
        intent: (i) => i.feedback.style.use(INDICATOR_PROMINENCE[level]),
      });
    }
    def.feedback.style.transition({
      properties: ['width'],
      durationMs: 300,
      easing: [0.4, 0, 0.2, 1],
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.indeterminate).eq(false),
      intent: (i) => i.feedback.style.use(tw('w-[calc(var(--pui-percentage)*1%)]')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('w-1/3 ms-auto me-auto opacity-80')),
    });
    return inherited.render;
  },
});
