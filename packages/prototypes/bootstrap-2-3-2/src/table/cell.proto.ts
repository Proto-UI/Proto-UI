import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableCell as baseTableCell,
  type TableCellProps,
  type TableCellExposes,
} from '@proto.ui/prototypes-base/table';

const asTableCell = defineAsHook<TableCellProps, TableCellExposes, {}>({
  ...baseTableCell,
  name: 'as-bootstrap-2-3-2-table-cell-base',
});

export const tableCell = definePrototype<TableCellProps, TableCellExposes>({
  name: 'bootstrap-2-3-2-table-cell',
  modules: asTableCell.modules,
  setup(def) {
    const behavior = asTableCell();
    def.feedback.style.use(
      tw('table-cell p-[8px] leading-[20px] text-left align-top font-normal border-t border-[#ddd]')
    );
    return behavior.render;
  },
});

export default tableCell;
