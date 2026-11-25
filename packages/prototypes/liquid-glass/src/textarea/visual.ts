import { tw, type DefHandle, type State } from '@proto.ui/core';
import type {
  TextareaRootProps,
  TextareaRootStateHandles,
} from '@proto.ui/prototypes-base/textarea';
import { COMMAND_FOCUS } from '../interactive-surface';

export type LiquidGlassTextareaMaterialProps = TextareaRootProps & {
  /** Auto enhances the editing surface as static liquid glass; pass opaque to opt out. */
  material?: 'auto' | 'opaque';
};

/** Paint and static material intent, shared with the exact Field-bound editor (never another editor). */
export function setupLiquidTextareaVisual(
  def: DefHandle<LiquidGlassTextareaMaterialProps>,
  state: TextareaRootStateHandles,
  invalid?: State<boolean>
) {
  def.props.define({
    material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
  });
  def.props.setDefaults({ material: 'auto' });
  def.feedback.style.use(
    tw(
      'block min-h-24 w-full min-w-0 resize-y rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground outline-none transition-shadow'
    )
  );
  def.feedback.material.declare({
    version: 2,
    shape: { kind: 'rounded-rect', geometry: 'style' },
    source: { kind: 'in-app-backdrop' },
    fallback: { fill: 'style', foreground: 'style' },
  });
  def.rule({
    when: (w) => w.all(w.prop('material').eq('auto'), w.state(state.disabled).eq(false)),
    intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
  });
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) =>
      i.feedback.style.use(tw('bg-muted text-muted-foreground cursor-not-allowed shadow-none')),
  });
  if (invalid) {
    // Field owns the error state and textual Error relation; surface uses
    // semantic destructive border and ring so invalid stays distinct in both themes.
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('border-2 border-destructive ring-2 ring-destructive/20')),
    });
    def.rule({
      when: (w) => w.all(w.state(invalid).eq(true), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive/40')),
    });
  }
}
