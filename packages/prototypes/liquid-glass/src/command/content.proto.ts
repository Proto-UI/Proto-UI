import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandContent,
  type CommandContentProps as BaseCommandContentProps,
  type CommandContentExposes,
} from '@proto.ui/prototypes-base/command';

export type CommandContentProps = BaseCommandContentProps & {
  /** Auto enhances standalone command panels; pass opaque when nested inside a glass dialog. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'liquid-glass-command-content',
  modules: asCommandContent.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asCommandContent();
    def.feedback.style.use(
      tw(
        'min-h-0 min-w-0 w-full max-h-80 overflow-x-hidden overflow-y-auto rounded-2xl border border-border bg-secondary p-1 text-secondary-foreground shadow-md'
      )
    );
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
    def.rule({
      when: (w) => w.meta('preference.reducedTransparency').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('shadow-none')),
    });
    return behavior.render;
  },
});
