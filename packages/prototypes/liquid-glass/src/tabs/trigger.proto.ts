import { definePrototype, tw } from '@proto.ui/core';
import {
  asTabsTrigger,
  type TabsTriggerProps,
  type TabsTriggerExposes,
} from '@proto.ui/prototypes-base/tabs';
export type FamilyTabsTriggerProps = TabsTriggerProps & { appearance?: 'default' | 'underline' };
export default definePrototype<FamilyTabsTriggerProps, TabsTriggerExposes>({
  name: 'liquid-glass-tabs-trigger',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    const triggerState = asTabsTrigger().stateHandles;
    if (!triggerState) throw new Error('Tabs Trigger capture missing');
    const { selected, hovered, focusVisible, disabled } = triggerState;
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex flex-none items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground outline-none'
          )
        ),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(selected).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-background text-foreground shadow-sm')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.all(w.state(hovered).eq(true), w.state(selected).eq(false))
        ),
      intent: (i) => i.feedback.style.use(tw('text-foreground bg-accent')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-ring outline-offset-2')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('underline'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative inline-flex flex-none h-auto items-center justify-center gap-1 whitespace-nowrap rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pt-1 pb-1 text-base font-medium text-muted-foreground shadow-none select-none outline-none'
          )
        ),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(selected).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-foreground text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(hovered).eq(true)),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-ring outline-offset-2')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
  },
});
