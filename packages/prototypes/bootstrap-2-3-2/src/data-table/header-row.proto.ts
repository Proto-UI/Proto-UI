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
  name: 'bootstrap-2-3-2-data-table-header-row',
  modules: asDataTableHeaderRow.modules,
  setup(def) {
    const behavior = asDataTableHeaderRow();
    def.feedback.style.use(tw('table-row'));
    return behavior.render;
  },
});
export { dataTableHeaderRow as bootstrap232DataTableHeaderRow };
