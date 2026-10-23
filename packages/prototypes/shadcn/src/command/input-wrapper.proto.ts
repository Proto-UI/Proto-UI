import { definePrototype, tw } from '@proto.ui/core';
import type { ShadcnStyleProps } from '../style-scope';
import { setupCommandStyle } from './visual';
/** Passive source padding only; compose InputShell and CommandInput beneath it. */
export const commandInputWrapper = definePrototype<ShadcnStyleProps>({
  name: 'shadcn-command-input-wrapper',
  setup(def) {
    const style = setupCommandStyle(def);
    def.feedback.style.use(tw('min-w-0 w-full'));
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('p-1 pb-0')),
    });
    return (r) => [r.r.slot()];
  },
});
export default commandInputWrapper;
