import { definePrototype, tw } from '@proto.ui/core';
import { asInputRoot } from '@proto.ui/prototypes-base/input';
import { setupShadcnStyleSelection } from '../style-scope';
import { INPUT_SHELL_PROJECTED_STYLES } from './root.proto';
import type { InputShellControlProps, InputShellControlExposes } from './types';
/** Ordinary Input semantic editor for the same passive shell used by Command. */
export const inputShellControl = definePrototype<InputShellControlProps, InputShellControlExposes>({
  name: 'shadcn-input-shell-control',
  modules: asInputRoot.modules,
  setup(def) {
    const state = asInputRoot().stateHandles;
    if (!state) throw new Error('[input-shell] Input state handles are required');
    const style = setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: INPUT_SHELL_PROJECTED_STYLES,
    });
    def.feedback.style.use(
      tw(
        'min-w-0 w-full grow rounded-none border-0 bg-transparent shadow-none outline-none ring-0 text-base py-1 selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('h-9 px-3')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('h-8 px-2.5')),
    });
    def.rule({
      when: (w) => w.meta('viewport.width').gte(768),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
    return () => null;
  },
});
export default inputShellControl;
