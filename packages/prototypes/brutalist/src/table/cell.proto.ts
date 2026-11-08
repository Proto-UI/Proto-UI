import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import { tableCell as baseTableCell } from '@proto.ui/prototypes-base/table';
import type { BrutalistTableCellExposes, BrutalistTableCellProps } from './types';

const asTableCell = defineAsHook({ ...baseTableCell, name: 'as-brutalist-table-cell' });

export const tableCell = definePrototype<BrutalistTableCellProps, BrutalistTableCellExposes>({
  name: 'brutalist-table-cell',
  modules: asTableCell.modules,
  setup(def) {
    const inherited = asTableCell();
    def.feedback.style.use(tw('table-cell align-middle whitespace-nowrap px-4 py-3 text-sm'));
    return inherited.render;
  },
});

export { tableCell as brutalistTableCell };
export default tableCell;
