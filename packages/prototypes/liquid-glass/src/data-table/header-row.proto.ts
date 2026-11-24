import { definePrototype, tw } from '@proto.ui/core';
import {
  asDataTableHeaderRow,
  type DataTableHeaderRowProps,
  type DataTableHeaderRowExposes,
} from '@proto.ui/prototypes-base/data-table';
export const dataTableHeaderRow = definePrototype<
  DataTableHeaderRowProps,
  DataTableHeaderRowExposes
>({
  name: 'liquid-glass-data-table-header-row',
  modules: asDataTableHeaderRow.modules,
  setup(def) {
    const behavior = asDataTableHeaderRow();
    def.feedback.style.use(
      tw(
        'table-row min-w-0 max-w-full border-b border-border bg-background/60 text-muted-foreground'
      )
    );
    return behavior.render;
  },
});
export { dataTableHeaderRow as liquidGlassDataTableHeaderRow };
