import { defineAsHook, definePrototype } from '@proto.ui/core';
import { tableHeaderCell as baseTableHeaderCell } from '@proto.ui/prototypes-base/table';
import { setupTableHeaderCellPaint } from './visual';
import type { ShadcnTableHeaderCellExposes, ShadcnTableHeaderCellProps } from './types';

const asTableHeaderCell = defineAsHook({
  ...baseTableHeaderCell,
  name: 'as-shadcn-table-header-cell',
});

export const tableHeaderCell = definePrototype<
  ShadcnTableHeaderCellProps,
  ShadcnTableHeaderCellExposes
>({
  name: 'shadcn-table-header-cell',
  modules: asTableHeaderCell.modules,
  setup(def) {
    const inherited = asTableHeaderCell();
    setupTableHeaderCellPaint(def);
    return inherited.render;
  },
});

export default tableHeaderCell;
