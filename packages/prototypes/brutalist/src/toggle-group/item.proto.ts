import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToggleGroupItem, TOGGLE_GROUP_FAMILY } from '@proto.ui/prototypes-base/toggle-group';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import type {
  BrutalistToggleGroupItemExposes,
  BrutalistToggleGroupItemProps,
  BrutalistToggleGroupSize,
} from './types';
import { TOGGLE_GROUP_VISUAL_CONTEXT } from './visual';

const SIZE_TOKENS: Record<BrutalistToggleGroupSize, string> = {
  default: 'h-10 min-w-10 px-3 text-sm',
  sm: 'h-9 min-w-9 px-2.5 text-[0.8rem]',
  lg: 'h-11 min-w-11 px-4 text-sm',
};

export default definePrototype<BrutalistToggleGroupItemProps, BrutalistToggleGroupItemExposes>({
  name: 'brutalist-toggle-group-item',
  modules: asToggleGroupItem.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'outline'] },
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm', 'lg'] },
    });
    const behavior = asToggleGroupItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-toggle-group] Item state unavailable.');
    const { active, disabled, focused, focusVisible } = state;
    const hovered = def.state.bool('brutalistToggleGroupHovered', false);
    const clearHover = () => hovered.set(false, 'brutalist toggle group item hover reset');
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'brutalist toggle group item hover enter');
    });
    def.event.on('pointer.leave', clearHover);
    def.event.on('pointer.cancel', clearHover);
    def.lifecycle.onUnmounted(clearHover);
    if ('watch' in disabled) {
      disabled.watch((_run, event) => {
        if (event.type === 'next' && event.next) clearHover();
      });
    }

    const first = def.state.bool('brutalistToggleGroupFirst', false);
    const last = def.state.bool('brutalistToggleGroupLast', false);
    const hasPrevious = def.state.bool('brutalistToggleGroupPrevious', false);
    const axis = def.state.string('brutalistToggleGroupAxis', 'horizontal');
    const resolvedVariant = def.state.string('brutalistToggleGroupVariant', 'default');
    const resolvedSize = def.state.string('brutalistToggleGroupSize', 'default');
    const joined = def.state.bool('brutalistToggleGroupJoined', false);

    const syncOrder = (run: RunHandle<BrutalistToggleGroupItemProps>) => {
      const index = run.anatomy.order.indexOfSelf(TOGGLE_GROUP_FAMILY, 'item');
      first.set(index === 0, 'brutalist toggle group first item');
      last.set(
        index >= 0 && run.anatomy.order.nextOfSelf(TOGGLE_GROUP_FAMILY, 'item') === null,
        'brutalist toggle group last item'
      );
      hasPrevious.set(index > 0, 'brutalist toggle group preceding item');
    };
    def.anatomy.subscribeParts(TOGGLE_GROUP_FAMILY, 'item', (run, parts) => {
      if (parts.length) syncOrder(run);
      else {
        first.set(false, 'brutalist toggle group membership withdrawn');
        last.set(false, 'brutalist toggle group membership withdrawn');
        hasPrevious.set(false, 'brutalist toggle group membership withdrawn');
      }
    });
    def.lifecycle.onMounted(syncOrder);
    def.lifecycle.onUpdated(syncOrder);

    const syncVisual = (run: RunHandle<BrutalistToggleGroupItemProps>) => {
      const ctx = run.context.tryRead(TOGGLE_GROUP_VISUAL_CONTEXT);
      const props = run.props.get();
      axis.set(ctx?.orientation ?? 'horizontal', 'brutalist toggle group observed axis');
      resolvedVariant.set(
        props.variant ?? ctx?.variant ?? 'default',
        'brutalist toggle group observed variant'
      );
      resolvedSize.set(
        props.size ?? ctx?.size ?? 'default',
        'brutalist toggle group observed size'
      );
      joined.set((ctx?.spacing ?? 1) === 0, 'brutalist toggle group observed spacing');
    };
    def.context.trySubscribe(TOGGLE_GROUP_VISUAL_CONTEXT, syncVisual);
    def.props.watch(['variant', 'size'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);

    def.feedback.style.use(
      tw(
        'relative rounded-base border-2 border-black bg-secondary-background text-foreground inline-flex min-w-0 items-center justify-center gap-1 font-heading font-bold whitespace-nowrap select-none cursor-pointer outline-none'
      )
    );
    (Object.keys(SIZE_TOKENS) as BrutalistToggleGroupSize[]).forEach((size) => {
      def.rule({
        when: (w) => w.state(resolvedSize).eq(size),
        intent: (i) => i.feedback.style.use(tw(SIZE_TOKENS[size])),
      });
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(resolvedVariant).eq('default'),
          w.state(joined).eq(false),
          w.state(active).eq(false),
          w.state(hovered).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('border-transparent bg-secondary-background')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(resolvedVariant).eq('outline'),
          w.state(active).eq(false),
          w.state(hovered).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('border-black bg-background')),
    });
    def.rule({
      when: (w) => w.state(joined).eq(true),
      intent: (i) => i.feedback.style.use(tw('rounded-none border-black')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(joined).eq(true), w.state(first).eq(true), w.state(axis).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('rounded-l-[5px]')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(joined).eq(true), w.state(last).eq(true), w.state(axis).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('rounded-r-[5px]')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(joined).eq(true), w.state(first).eq(true), w.state(axis).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('rounded-t-[5px]')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(joined).eq(true), w.state(last).eq(true), w.state(axis).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('rounded-b-[5px]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(joined).eq(true),
          w.state(hasPrevious).eq(true),
          w.state(axis).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('ml-[-2px]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(joined).eq(true),
          w.state(hasPrevious).eq(true),
          w.state(axis).eq('vertical')
        ),
      intent: (i) => i.feedback.style.use(tw('mt-[-2px]')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(hovered).eq(true), w.state(active).eq(false), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('border-black bg-main/20 text-foreground z-10')),
    });
    def.rule({
      when: (w) => w.state(active).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('border-black bg-main text-main-foreground shadow-[inset_0_0_0_2px_#000] z-10')
        ),
    });
    def.rule({
      when: (w) => w.state(focused).eq(true),
      intent: (i) => i.feedback.style.use(tw('z-10')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} z-10`)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
    return behavior.render;
  },
});
