import { definePrototype, tw } from '@proto.ui/core';
import { asPopoverContent, type PopoverContentExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverContentProps } from './types';
import { BRUTALIST_PANEL_TOKENS } from '../style';

export default definePrototype<PopoverContentProps, PopoverContentExposes>({
  name: 'brutalist-popover-content',
  modules: asPopoverContent.modules,
  setup(def) {
    const behavior = asPopoverContent();
    def.props.define({
      presentation: { type: 'enum', empty: 'fallback', options: ['default', 'navigation'] },
    });
    def.props.setDefaults({ presentation: 'default' });
    def.rule({
      when: (w) => w.prop('presentation').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            BRUTALIST_PANEL_TOKENS,
            'shadow-[3px_3px_0_0_var(--pui-foreground)] p-4 z-50 w-72 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto flex flex-col gap-4 outline-none'
          )
        ),
    });
    def.rule({
      when: (w) => w.prop('presentation').eq('navigation'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            BRUTALIST_PANEL_TOKENS,
            'z-50 w-[var(--proto-ui-available-width)] h-[var(--proto-ui-available-height)] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto overscroll-contain p-0 outline-none'
          )
        ),
    });
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
