import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToggleGroupItem, TOGGLE_GROUP_FAMILY } from '@proto.ui/prototypes-base/toggle-group';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';
import type {
  BootstrapToggleGroupItemExposes,
  BootstrapToggleGroupItemProps,
  BootstrapToggleGroupSize,
  BootstrapToggleGroupVariant,
} from './types';
import { TOGGLE_GROUP_VISUAL_AXIS } from './visual';

const VARIANTS: readonly BootstrapToggleGroupVariant[] = [
  'default',
  'primary',
  'warning',
  'danger',
  'success',
  'info',
  'inverse',
];
const SIZES: readonly BootstrapToggleGroupSize[] = ['default', 'large', 'small', 'mini'];

const SIZE_GEOMETRY: Record<
  BootstrapToggleGroupSize,
  {
    padding: string;
    hFirst: string;
    hLast: string;
    vFirst: string;
    vLast: string;
  }
> = {
  default: {
    padding: 'px-[12px] py-[4px] text-[14px]',
    hFirst: 'rounded-l-[4px]',
    hLast: 'rounded-r-[4px]',
    vFirst: 'rounded-t-[4px]',
    vLast: 'rounded-b-[4px]',
  },
  large: {
    padding: 'px-[19px] py-[11px] text-[17.5px]',
    hFirst: 'rounded-l-[6px]',
    hLast: 'rounded-r-[6px]',
    vFirst: 'rounded-t-[6px]',
    vLast: 'rounded-b-[6px]',
  },
  small: {
    padding: 'px-[10px] py-[2px] text-[11.9px]',
    hFirst: 'rounded-l-[3px]',
    hLast: 'rounded-r-[3px]',
    vFirst: 'rounded-t-[3px]',
    vLast: 'rounded-b-[3px]',
  },
  mini: {
    padding: 'px-[6px] py-[0px] text-[10.5px]',
    hFirst: 'rounded-l-[3px]',
    hLast: 'rounded-r-[3px]',
    vFirst: 'rounded-t-[3px]',
    vLast: 'rounded-b-[3px]',
  },
};

export default definePrototype<BootstrapToggleGroupItemProps, BootstrapToggleGroupItemExposes>({
  name: 'bootstrap-2-3-2-toggle-group-item',
  modules: asToggleGroupItem.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', empty: 'fallback', options: [...VARIANTS] },
      size: { type: 'enum', empty: 'fallback', options: [...SIZES] },
    });
    const behavior = asToggleGroupItem();
    const first = def.state.bool('toggleGroupVisualFirst', false);
    const last = def.state.bool('toggleGroupVisualLast', false);
    const hasPrevious = def.state.bool('toggleGroupVisualPrevious', false);
    const axis = def.state.string('toggleGroupVisualAxis', 'horizontal');
    const resolvedVariant = def.state.string('bootstrapToggleGroupVariant', 'default');
    const resolvedSize = def.state.string('bootstrapToggleGroupSize', 'default');
    const syncVisual = (run: RunHandle<BootstrapToggleGroupItemProps>) => {
      const ctx = run.context.tryRead(TOGGLE_GROUP_VISUAL_AXIS);
      const props = run.props.get();
      axis.set(ctx?.orientation ?? 'horizontal', 'reason: joined group observes Base-owned axis');
      resolvedVariant.set(
        props.variant ?? ctx?.variant ?? 'default',
        'reason: joined group observes Bootstrap variant'
      );
      resolvedSize.set(
        props.size ?? ctx?.size ?? 'default',
        'reason: joined group observes Bootstrap size'
      );
    };
    const withdrawEdges = () => {
      first.set(false, 'reason: joined group membership withdrawn');
      last.set(false, 'reason: joined group membership withdrawn');
      hasPrevious.set(false, 'reason: joined group membership withdrawn');
    };
    const syncOrder = (run: RunHandle<BootstrapToggleGroupItemProps>) => {
      // A logical move changes both the order domain and its axis provider,
      // even when neither Root has published a new orientation value.
      syncVisual(run);
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
    def.context.trySubscribe(TOGGLE_GROUP_VISUAL_AXIS, syncVisual);
    def.props.watch(['variant', 'size'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.feedback.style.use(
      tw(
        'relative inline-flex min-w-0 items-center justify-center rounded-none border font-normal leading-[20px] whitespace-nowrap select-none cursor-pointer transition-none'
      )
    );
    // v2.3.2 button-groups.less: square interiors, outer-only corners sized to
    // the button preset, and a -1px preceding seam. Disabled members keep their position.
    for (const size of SIZES) {
      const geom = SIZE_GEOMETRY[size];
      def.rule({
        when: (w) => w.state(resolvedSize).eq(size),
        intent: (i) => i.feedback.style.use(tw(geom.padding)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(resolvedSize).eq(size),
            w.state(first).eq(true),
            w.state(axis).eq('horizontal')
          ),
        intent: (i) => i.feedback.style.use(tw(geom.hFirst)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(resolvedSize).eq(size),
            w.state(last).eq(true),
            w.state(axis).eq('horizontal')
          ),
        intent: (i) => i.feedback.style.use(tw(geom.hLast)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(resolvedSize).eq(size),
            w.state(first).eq(true),
            w.state(axis).eq('vertical')
          ),
        intent: (i) => i.feedback.style.use(tw(geom.vFirst)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(resolvedSize).eq(size),
            w.state(last).eq(true),
            w.state(axis).eq('vertical')
          ),
        intent: (i) => i.feedback.style.use(tw(geom.vLast)),
      });
    }
    def.rule({
      when: (w) => w.all(w.state(hasPrevious).eq(true), w.state(axis).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('ml-[-1px]')),
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
      when: (w) => w.state(resolvedVariant).eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
          )
        ),
    });
    def.rule({
      when: (w) => w.not(w.state(resolvedVariant).eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]'
          )
        ),
    });
    const disabled = behavior.getState!('disabled')!;
    const active = behavior.getState!('active')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const hovered = def.state.bool('bootstrapToggleGroupHovered', false);
    const clearHover = () => hovered.set(false, 'bootstrap toggle group item hover reset');
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'bootstrap toggle group item hover enter');
    });
    def.event.on('pointer.leave', clearHover);
    def.event.on('pointer.cancel', clearHover);
    def.lifecycle.onUnmounted(clearHover);
    if ('watch' in disabled) {
      disabled.watch((_run, event) => {
        if (event.type === 'next' && event.next) clearHover();
      });
    }

    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) =>
        i.feedback.style.use(tw('transition-[background-position] duration-100 ease-linear')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });

    for (const variant of VARIANTS) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(resolvedVariant).eq(variant),
            w.state(disabled).eq(false),
            w.state(active).eq(false),
            w.state(focused).eq(false),
            w.state(hovered).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill[variant])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(resolvedVariant).eq(variant),
            w.state(disabled).eq(false),
            w.state(active).eq(false),
            w.any(w.state(focused).eq(true), w.state(hovered).eq(true))
          ),
        intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill[variant])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(resolvedVariant).eq(variant),
            w.state(disabled).eq(false),
            w.state(active).eq(true),
            w.state(focused).eq(false),
            w.state(hovered).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(tw(`${bootstrapButtonFlatFill[variant]} ${bootstrapButtonPressed}`)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(resolvedVariant).eq(variant),
            w.state(disabled).eq(false),
            w.state(active).eq(true),
            w.any(w.state(focused).eq(true), w.state(hovered).eq(true))
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(`${bootstrapButtonPressedFill[variant]} ${bootstrapButtonPressed}`)
          ),
      });
      def.rule({
        when: (w) => w.all(w.state(resolvedVariant).eq(variant), w.state(disabled).eq(true)),
        intent: (i) =>
          i.feedback.style.use(
            tw(`${bootstrapButtonFlatFill[variant]} opacity-65 cursor-default shadow-none`)
          ),
      });
    }
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(active).eq(true),
          w.state(focused).eq(true),
          w.all(w.state(hovered).eq(true), w.state(disabled).eq(false))
        ),
      intent: (i) => i.feedback.style.use(tw('z-[2]')),
    });
    return behavior.render;
  },
});
