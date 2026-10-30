import { definePrototype, tw } from '@proto.ui/core';
import type { ShadcnStyleProps } from '../style-scope';
import { COMMAND_INPUT_PAINT, setupCommandPartPaint } from './visual';
/** Passive source padding only; compose InputShell and CommandInput beneath it. */
export const commandInputWrapper = definePrototype<ShadcnStyleProps>({
  name: 'shadcn-command-input-wrapper',
  setup(def) {
    def.context.provide(COMMAND_INPUT_PAINT, { command: true });
    setupCommandPartPaint(def, 'wrapper');
    def.feedback.style.use(tw('min-w-0 w-full'));
    return (r) => [r.r.slot()];
  },
});
export default commandInputWrapper;
