import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import { tableHeaderCell as baseTableHeaderCell } from '@proto.ui/prototypes-base/table';
import type { BrutalistTableHeaderCellExposes, BrutalistTableHeaderCellProps } from './types';

const asTableHeaderCell = defineAsHook({
  ...baseTableHeaderCell,
  name: 'as-brutalist-table-header-cell',
});

export const tableHeaderCell = definePrototype<
  BrutalistTableHeaderCellProps,
  BrutalistTableHeaderCellExposes
>({
  name: 'brutalist-table-header-cell',
  modules: asTableHeaderCell.modules,
  setup(def) {
    const inherited = asTableHeaderCell();
    // Header emphasis comes from weight, not a muted fill; padding mirrors the
    // data-table sibling's cell geometry.
    def.feedback.style.use(
      tw('table-cell text-left align-middle whitespace-nowrap px-4 py-3 text-sm font-semibold')
    );
    return inherited.render;
  },
});

export { tableHeaderCell as brutalistTableHeaderCell };
export default tableHeaderCell;
