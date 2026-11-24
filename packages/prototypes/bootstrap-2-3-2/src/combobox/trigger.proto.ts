import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxTrigger,
  type ComboboxTriggerProps,
  type ComboboxTriggerExposes,
} from '@proto.ui/prototypes-base/combobox';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonRaised,
} from '../button/paint';
export default definePrototype<ComboboxTriggerProps, ComboboxTriggerExposes>({
  name: 'bootstrap-2-3-2-combobox-trigger',
  modules: asComboboxTrigger.modules,
  setup(def) {
    const behavior = asComboboxTrigger();
    def.feedback.style.use(
      tw(
        'inline-flex box-border h-[30px] -ml-px items-center justify-center rounded-l-none rounded-r-[4px] border px-[10px] py-[4px] text-[14px] font-normal leading-[20px] text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)] whitespace-nowrap select-none cursor-pointer outline-none'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('disabled')!).eq(false),
          w.state(behavior.getState!('focused')!).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('disabled')!).eq(false),
          w.state(behavior.getState!('focused')!).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('focusVisible')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative z-[2] outline-none border-[rgb(82_168_236/80%)] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_8px_rgb(82_168_236/60%)]'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(`${bootstrapButtonFlatFill.default} opacity-65 cursor-default shadow-none`)
        ),
    });
    return behavior.render;
  },
});
