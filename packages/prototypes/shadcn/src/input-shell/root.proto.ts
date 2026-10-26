import { definePrototype, tw } from '@proto.ui/core';
import { setupShadcnStyleSelection } from '../style-scope';
import { INPUT_SHELL_PAINT } from './context';
import type { InputShellProps } from './types';
export const INPUT_SHELL_PROJECTED_STYLES = ['new-york-v4', 'rhea'] as const;
export const inputShell = definePrototype<InputShellProps>({
  name: 'shadcn-input-shell',
  setup(def) {
    def.context.provide(INPUT_SHELL_PAINT, { grouped: true });
    const style = setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: INPUT_SHELL_PROJECTED_STYLES,
    });
    def.props.define({
      focusVisible: { type: 'boolean' },
      disabled: { type: 'boolean' },
      focusIndicator: { type: 'enum', options: ['ring', 'none'], empty: 'fallback' },
    });
    def.props.setDefaults({ focusVisible: false, disabled: false, focusIndicator: 'ring' });
    // Roleless passive paint: the actual editor retains its name and all interaction authority.
    def.feedback.style.use(
      tw(
        'relative flex w-full min-w-0 items-center border outline-none transition-[color,box-shadow]'
      )
    );
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('h-9 rounded-md border-input shadow-xs duration-150')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(
          tw('h-8 rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 duration-200')
        ),
    });
    def.rule({
      when: (w) => w.all(w.prop('focusVisible').eq(true), w.prop('focusIndicator').eq('ring')),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('focusVisible').eq(true),
          w.prop('focusIndicator').eq('ring'),
          w.state(style).eq('new-york-v4')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-ring/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('focusVisible').eq(true),
          w.prop('focusIndicator').eq('ring'),
          w.state(style).eq('rhea')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-ring/30')),
    });
    // Disabled is deliberately not doubled on the shell; each actual editor owns opacity/cursor.
    return (r) => [r.r.slot()];
  },
});
export default inputShell;
