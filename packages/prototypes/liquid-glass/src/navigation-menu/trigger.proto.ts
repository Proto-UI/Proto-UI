import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS_INSET,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
import {
  asNavigationMenuTrigger,
  type NavigationMenuTriggerProps,
  type NavigationMenuTriggerExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export interface LiquidGlassNavigationMenuTriggerProps extends NavigationMenuTriggerProps {
  prominence?: 'regular' | 'prominent';
}

export default definePrototype<LiquidGlassNavigationMenuTriggerProps, NavigationMenuTriggerExposes>(
  {
    name: 'liquid-glass-navigation-menu-trigger',
    modules: asNavigationMenuTrigger.modules,
    setup(def) {
      const behavior = asNavigationMenuTrigger();
      def.props.define({
        prominence: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
      });
      def.props.setDefaults({ prominence: 'regular' });
      const disabled = behavior.getState!('disabled')!;
      const expanded = behavior.getState!('expanded')!;
      const focused = behavior.getState!('focused')!;
      const focusVisible = behavior.getState!('focusVisible')!;
      const hovered = def.state.bool('hovered', false);
      const pressed = def.state.bool('pressed', false);
      def.event.on('pointer.enter', () => {
        if (!disabled.get()) hovered.set(true, 'reason: pointer entered liquid-glass nav trigger');
      });
      def.event.on('pointer.leave', () => {
        hovered.set(false, 'reason: pointer left liquid-glass nav trigger');
        pressed.set(false, 'reason: pointer left clears press');
      });
      def.event.on('pointer.down', () => {
        if (!disabled.get()) pressed.set(true, 'reason: pointer pressed liquid-glass nav trigger');
      });
      def.event.on('pointer.up', () => {
        pressed.set(false, 'reason: pointer released liquid-glass nav trigger');
      });
      def.event.on('pointer.cancel', () => {
        hovered.set(false, 'reason: pointer cancelled liquid-glass nav trigger');
        pressed.set(false, 'reason: pointer cancelled clears press');
      });
      def.feedback.style.use(
        tw(
          'inline-flex min-w-0 cursor-pointer select-none items-center justify-center gap-1 rounded-full bg-secondary px-3.5 py-1.5 text-sm font-medium text-secondary-foreground outline-none transition-colors'
        )
      );
      def.rule({
        when: (w) => w.all(w.prop('prominence').eq('prominent'), w.state(disabled).eq(false)),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('prominence').eq('regular'),
            w.state(disabled).eq(false),
            w.any(w.state(expanded).eq(true), w.state(focused).eq(true))
          ),
        intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(disabled).eq(false),
            w.state(hovered).eq(true),
            w.state(pressed).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('prominence').eq('regular'),
            w.state(disabled).eq(false),
            w.state(hovered).eq(true)
          ),
        intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
      });
      def.rule({
        when: (w) => w.all(w.state(disabled).eq(false), w.state(pressed).eq(true)),
        intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
      });
      def.rule({
        when: (w) => w.state(disabled).eq(true),
        intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
      });
      def.rule({
        when: (w) => w.state(focusVisible).eq(true),
        intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
      });
      return behavior.render;
    },
  }
);
