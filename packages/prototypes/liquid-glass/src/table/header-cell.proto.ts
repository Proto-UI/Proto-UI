// Neutral content projection: readable header-cell typography only.
import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableHeaderCell,
  type TableHeaderCellProps,
  type TableHeaderCellExposes,
} from '@proto.ui/prototypes-base/table';

const asLiquidGlassTableHeaderCell = defineAsHook<TableHeaderCellProps, TableHeaderCellExposes, {}>(
  {
    ...tableHeaderCell,
    name: 'as-liquid-glass-table-header-cell',
  }
);

export const liquidGlassTableHeaderCell = definePrototype<
  TableHeaderCellProps,
  TableHeaderCellExposes
>({
  name: 'liquid-glass-table-header-cell',
  modules: asLiquidGlassTableHeaderCell.modules,
  setup(def) {
    const behavior = asLiquidGlassTableHeaderCell();
    // Base owns headerKey/headerKind/headers/span configuration, row/column
    // index projection and the authored slot. The family adds only restrained
    // header typography and padding; no sorting, selection or focus channel.
    def.feedback.style.use(tw('table-cell align-top px-4 py-3 text-left text-sm font-semibold'));
    return behavior.render;
  },
});

export default liquidGlassTableHeaderCell;
