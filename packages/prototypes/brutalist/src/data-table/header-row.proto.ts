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
  name: 'brutalist-data-table-header-row',
  modules: asDataTableHeaderRow.modules,
  setup(def) {
    const behavior = asDataTableHeaderRow();
    def.feedback.style.use(
      tw(
        'table-row min-w-0 max-w-full bg-background text-foreground border-b-2 border-black font-heading font-bold'
      )
    );
    return behavior.render;
  },
});
export { dataTableHeaderRow as brutalistDataTableHeaderRow };
