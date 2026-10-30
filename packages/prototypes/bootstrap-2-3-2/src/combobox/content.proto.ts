import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxContent,
  type ComboboxContentProps,
  type ComboboxContentExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxContentProps, ComboboxContentExposes>({
  name: 'bootstrap-2-3-2-combobox-content',
  modules: asComboboxContent.modules,
  setup(def) {
    const behavior = asComboboxContent();
    def.props.setDefaults({ sideOffset: 2 });
    def.feedback.style.use(
      tw(
        'z-[1051] min-w-[160px] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto rounded-[4px] border border-[rgb(0_0_0/20%)] bg-background bg-clip-padding text-foreground py-[5px] shadow-[0_5px_10px_rgb(0_0_0/20%)]'
      )
    );
    return behavior.render;
  },
});
