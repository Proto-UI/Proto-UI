import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import type { ShadcnStyleProps } from '../style-scope';
import type { CommandPresentationProps } from './types';
import { COMMAND_INPUT_PAINT, setupCommandPartPaint } from './visual';
/** Passive source padding only; compose InputShell and CommandInput beneath it. */
export const commandInputWrapper = definePrototype<ShadcnStyleProps & CommandPresentationProps>({
  name: 'shadcn-command-input-wrapper',
  setup(def) {
    def.context.provide(COMMAND_INPUT_PAINT, { command: true, presentation: 'default' });
    // Presentation only. A caller may slot an aria-hidden decorative glyph next
    // to the single-control InputShell; this is not an actionable input prefix.
    setupCommandPartPaint(def, 'wrapper');
    const sync = (run: RunHandle<ShadcnStyleProps & CommandPresentationProps>) => {
      const presentation = run.props.getRaw().presentation ?? 'default';
      if (run.context.tryRead(COMMAND_INPUT_PAINT)?.presentation !== presentation)
        run.context.update(COMMAND_INPUT_PAINT, { command: true, presentation });
    };
    def.context.trySubscribe(COMMAND_INPUT_PAINT);
    def.props.watchRaw(['presentation'], sync);
    def.lifecycle.onCreated(sync);
    def.lifecycle.onMounted(sync);
    def.lifecycle.onUpdated(sync);
    def.feedback.style.use(tw('min-w-0 w-full'));
    return (r) => [r.r.slot()];
  },
});
export default commandInputWrapper;
