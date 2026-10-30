import { definePrototype, tw } from '@proto.ui/core';
import {
  asTabsTrigger,
  type TabsTriggerProps,
  type TabsTriggerExposes,
} from '@proto.ui/prototypes-base/tabs';
export type FamilyTabsTriggerProps = TabsTriggerProps & { appearance?: 'default' | 'underline' };
export default definePrototype<FamilyTabsTriggerProps, TabsTriggerExposes>({
  name: 'bootstrap-2-3-2-tabs-trigger',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    const triggerState = asTabsTrigger().stateHandles;
    if (!triggerState) throw new Error('Tabs Trigger capture missing');
    const { selected, hovered, focused, focusVisible, disabled } = triggerState;
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex flex-none items-center justify-center px-[12px] py-[8px] mr-[2px] mb-[-1px] border border-transparent rounded-t-[4px] text-[14px] leading-[20px] text-[#08c] outline-none'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true)),
          w.state(selected).eq(false),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-[#eee] border-[#eee_#eee_#ddd]')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(selected).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-white text-[#555] border-[#ddd] border-b-transparent cursor-default')
        ),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-ring outline-offset-2')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(disabled).eq(true),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-transparent')),
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
