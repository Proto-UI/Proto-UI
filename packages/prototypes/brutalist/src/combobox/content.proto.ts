import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import {
  asComboboxContent,
  type ComboboxContentProps,
  type ComboboxContentExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxContentProps, ComboboxContentExposes>({
  name: 'brutalist-combobox-content',
  modules: asComboboxContent.modules,
  setup(def) {
    const behavior = asComboboxContent();
    def.feedback.style.use(
      tw(
        `${BRUTALIST_PANEL_TOKENS} shadow-[3px_3px_0_0_#000] z-50 min-w-0 w-[max(var(--proto-ui-anchor-width,16rem),12rem)] max-w-[var(--proto-ui-available-width,100%)] max-h-[var(--proto-ui-available-height,20rem)] overflow-y-auto p-1`
      )
    );
    return behavior.render;
  },
});
