import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import {
  asToggleGroupItem,
  TOGGLE_GROUP_FAMILY,
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
import { TOGGLE_GROUP_VISUAL_AXIS } from './visual';

export default definePrototype<ToggleGroupItemProps, ToggleGroupItemExposes>({
  name: 'bootstrap-2-3-2-toggle-group-item',
  modules: asToggleGroupItem.modules,
  setup(def) {
    const behavior = asToggleGroupItem();
    const first = def.state.bool('toggleGroupVisualFirst', false);
    const last = def.state.bool('toggleGroupVisualLast', false);
    const hasPrevious = def.state.bool('toggleGroupVisualPrevious', false);
    const axis = def.state.string('toggleGroupVisualAxis', 'horizontal');
    const syncAxis = (run: RunHandle<ToggleGroupItemProps>) => {
      axis.set(
        run.context.tryRead(TOGGLE_GROUP_VISUAL_AXIS)?.orientation ?? 'horizontal',
        'reason: joined group observes Base-owned axis'
      );
    };
    const withdrawEdges = () => {
      first.set(false, 'reason: joined group membership withdrawn');
      last.set(false, 'reason: joined group membership withdrawn');
      hasPrevious.set(false, 'reason: joined group membership withdrawn');
    };
    const syncOrder = (run: RunHandle<ToggleGroupItemProps>) => {
      // A logical move changes both the order domain and its axis provider,
      // even when neither Root has published a new orientation value.
      syncAxis(run);
      const index = run.anatomy.order.indexOfSelf(TOGGLE_GROUP_FAMILY, 'item');
      first.set(index === 0, 'reason: joined group first logical item');
      last.set(
        index >= 0 && run.anatomy.order.nextOfSelf(TOGGLE_GROUP_FAMILY, 'item') === null,
        'reason: joined group last logical item'
      );
      hasPrevious.set(index > 0, 'reason: joined group preceding logical item');
    };
    def.anatomy.subscribeParts(TOGGLE_GROUP_FAMILY, 'item', (run, parts) => {
      if (parts.length) syncOrder(run);
      else withdrawEdges();
    });
    def.lifecycle.onMounted(syncOrder);
    def.lifecycle.onUpdated(syncOrder);
    def.lifecycle.onUnmounted(withdrawEdges);
    def.context.trySubscribe(TOGGLE_GROUP_VISUAL_AXIS, syncAxis);
    def.lifecycle.onCreated(syncAxis);
    def.feedback.style.use(
      tw(
        'relative inline-flex min-w-0 items-center justify-center rounded-none border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)] whitespace-nowrap select-none cursor-pointer'
      )
    );
    // v2.3.2 button-groups.less: square interiors, outer-only 4px corners
    // and a -1px preceding seam. Disabled members still occupy their position.
    def.rule({
      when: (w) => w.all(w.state(first).eq(true), w.state(axis).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('rounded-l-[4px]')),
    });
    def.rule({
      when: (w) => w.all(w.state(last).eq(true), w.state(axis).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('rounded-r-[4px]')),
    });
    def.rule({
      when: (w) => w.all(w.state(hasPrevious).eq(true), w.state(axis).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('ml-[-1px]')),
    });
    def.rule({
      when: (w) => w.all(w.state(first).eq(true), w.state(axis).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('rounded-t-[4px]')),
    });
    def.rule({
      when: (w) => w.all(w.state(last).eq(true), w.state(axis).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('rounded-b-[4px]')),
    });
    def.rule({
      when: (w) => w.all(w.state(hasPrevious).eq(true), w.state(axis).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('mt-[-1px]')),
    });
    def.rule({
      when: (w) => w.state(axis).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('max-w-full')),
    });
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
