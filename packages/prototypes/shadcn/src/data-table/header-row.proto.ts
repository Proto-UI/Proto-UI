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
  name: 'shadcn-data-table-header-row',
  setup(def) {
    const behavior = asDataTableHeaderRow();
    def.feedback.style.use(
      tw('min-w-0 max-w-full text-foreground grid items-stretch border-b border-border')
    );
    return behavior.render;
  },
});
export { dataTableHeaderRow as shadcnDataTableHeaderRow };
