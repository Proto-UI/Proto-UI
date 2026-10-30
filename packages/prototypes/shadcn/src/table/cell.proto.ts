import { defineAsHook, definePrototype } from '@proto.ui/core';
import { tableCell as baseTableCell } from '@proto.ui/prototypes-base/table';
import { setupTableCellPaint } from './visual';
import type { ShadcnTableCellExposes, ShadcnTableCellProps } from './types';

const asTableCell = defineAsHook({ ...baseTableCell, name: 'as-shadcn-table-cell' });

export const tableCell = definePrototype<ShadcnTableCellProps, ShadcnTableCellExposes>({
  name: 'shadcn-table-cell',
  modules: asTableCell.modules,
  setup(def) {
    const inherited = asTableCell();
    setupTableCellPaint(def);
    return inherited.render;
  },
});

export default tableCell;
