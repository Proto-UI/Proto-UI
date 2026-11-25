import { definePrototype, tw } from '@proto.ui/core';
import {
  asInputRoot,
  type InputRootExposes,
  type InputRootProps as BaseInputRootProps,
} from '@proto.ui/prototypes-base/input';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';

export type LiquidGlassInputRootProps = BaseInputRootProps & {
  /** Auto enhances the editing surface as static liquid glass; pass opaque to opt out. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassInputRootProps, InputRootExposes>({
  name: 'liquid-glass-input-root',
  modules: asInputRoot.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asInputRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[liquid-glass-input-root] Base Input states are required.');
    def.feedback.style.use(
      tw(
        'block h-11 w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2 text-base text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-shadow'
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
      when: (w) => w.all(w.state(state.focused).eq(true), w.state(state.focusVisible).eq(false)),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-2 ring-ring/30')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS, 'border-ring')),
    });
    def.rule({
      when: (w) => w.state(state.readOnly).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-muted-foreground', COMMAND_BLOCKED)),
    });
    // Preserve Base's null render and the single host-owned physical editor.
    return inherited.render;
  },
});
