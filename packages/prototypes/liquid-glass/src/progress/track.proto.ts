import { definePrototype, tw, type RunHandle, type StyleHandle } from '@proto.ui/core';
import { type ProgressPartExposes, asProgressTrack } from '@proto.ui/prototypes-base/progress';
import {
  LIQUID_GLASS_PROGRESS_CONTEXT,
  LIQUID_GLASS_PROGRESS_PROMINENCES,
  normalizeLiquidGlassProgressProminence,
  type LiquidGlassProgressPartProps,
  type LiquidGlassProgressProminence,
} from './shared';

const TRACK_PROMINENCE: Record<LiquidGlassProgressProminence, StyleHandle> = {
  regular: tw('h-2 bg-muted text-foreground ring-foreground/10'),
  prominent: tw('h-2.5 bg-muted text-foreground ring-primary/25'),
  destructive: tw('h-2 bg-muted text-foreground ring-destructive/25'),
};

export default definePrototype<LiquidGlassProgressPartProps, ProgressPartExposes>({
  name: 'liquid-glass-progress-track',
  modules: asProgressTrack.modules,
  setup(def) {
    const inherited = asProgressTrack();
    def.props.define({
      prominence: {
        type: 'enum',
        options: [...LIQUID_GLASS_PROGRESS_PROMINENCES, 'inherit'],
        empty: 'fallback',
      },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ prominence: 'inherit', material: 'auto' });
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
    def.feedback.style.use(
      tw(
        'relative flex w-full items-center overflow-hidden rounded-full ring-1 ring-inset shadow-inner'
      )
    );
    for (const level of LIQUID_GLASS_PROGRESS_PROMINENCES) {
      def.rule({
        when: (w) => w.state(prominence).eq(level),
        intent: (i) => i.feedback.style.use(TRACK_PROMINENCE[level]),
      });
    }
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.prop('material').eq('auto'),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    return inherited.render;
  },
});
