import { definePrototype } from '@proto.ui/core';
import { asPopoverTrigger, type PopoverTriggerExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverTriggerProps } from './types';
import { setupPopoverCommandPaint } from './command-paint';

export default definePrototype<PopoverTriggerProps, PopoverTriggerExposes>({
  name: 'shadcn-popover-trigger',
  setup(def) {
    const behavior = asPopoverTrigger();
    def.props.define({
      presentation: { type: 'enum', empty: 'fallback', options: ['default', 'navigation'] },
    });
    def.props.setDefaults({ presentation: 'default' });
    // The concrete author owns the complete enum and composes its condition
    // directly; the shared paint helper never mirrors presentation into State.
    const presentationRule =
      (presentation: 'default' | 'navigation'): typeof def.rule =>
      (rule) =>
        def.rule({
          ...rule,
          when: (w) => w.all(w.prop('presentation').eq(presentation), rule.when(w)),
        });
    const state = behavior.getState!;
    setupPopoverCommandPaint(
      def,
      {
        hovered: state('hovered')!,
        focusVisible: state('focusVisible')!,
        disabled: state('disabled')!,
        pressed: state('pressed')!,
      },
      'trigger',
      {
        defaultRule: presentationRule('default'),
        navigationRule: presentationRule('navigation'),
      }
    );
  },
});
