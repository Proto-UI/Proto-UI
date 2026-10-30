import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableRow as baseTableRow,
  type TableRowProps,
  type TableRowExposes,
} from '@proto.ui/prototypes-base/table';

const asTableRow = defineAsHook<TableRowProps, TableRowExposes, {}>({
  ...baseTableRow,
  name: 'as-bootstrap-2-3-2-table-row-base',
});

export const tableRow = definePrototype<TableRowProps, TableRowExposes>({
  name: 'bootstrap-2-3-2-table-row',
  modules: asTableRow.modules,
  setup(def) {
    const behavior = asTableRow();
    def.feedback.style.use(tw('table-row'));
    return behavior.render;
  },
});

export default tableRow;
