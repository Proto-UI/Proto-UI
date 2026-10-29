import { definePrototype, tw } from '@proto.ui/core';
import {
  asToggleGroupItem,
  type ToggleGroupItemProps,
  type ToggleGroupItemExposes,
} from '@proto.ui/prototypes-base/toggle-group';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';

export default definePrototype<ToggleGroupItemProps, ToggleGroupItemExposes>({
  name: 'bootstrap-2-3-2-toggle-group-item',
  modules: asToggleGroupItem.modules,
  setup(def) {
    const behavior = asToggleGroupItem();
    def.feedback.style.use(
      tw(
        'relative inline-flex min-w-0 items-center justify-center rounded-none border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)] whitespace-nowrap select-none cursor-pointer'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('disabled')!).eq(false),
          w.state(behavior.getState!('active')!).eq(false),
          w.state(behavior.getState!('focused')!).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('disabled')!).eq(false),
          w.state(behavior.getState!('active')!).eq(false),
          w.state(behavior.getState!('focused')!).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('disabled')!).eq(false),
          w.state(behavior.getState!('active')!).eq(true),
          w.state(behavior.getState!('focused')!).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(tw(`${bootstrapButtonFlatFill.default} ${bootstrapButtonPressed}`)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('disabled')!).eq(false),
          w.state(behavior.getState!('active')!).eq(true),
          w.state(behavior.getState!('focused')!).eq(true)
        ),
      intent: (i) =>
        i.feedback.style.use(tw(`${bootstrapButtonPressedFill.default} ${bootstrapButtonPressed}`)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(`${bootstrapButtonFlatFill.default} opacity-65 cursor-default shadow-none`)
        ),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(behavior.getState!('active')!).eq(true),
          w.state(behavior.getState!('focused')!).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('z-[2]')),
    });
    return behavior.render;
  },
});
