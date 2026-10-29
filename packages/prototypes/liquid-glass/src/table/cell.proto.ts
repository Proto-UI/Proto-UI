// Neutral content projection: readable cell typography only.
import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableCell,
  type TableCellProps,
  type TableCellExposes,
} from '@proto.ui/prototypes-base/table';

const asLiquidGlassTableCell = defineAsHook<TableCellProps, TableCellExposes, {}>({
  ...tableCell,
  name: 'as-liquid-glass-table-cell',
});

export const liquidGlassTableCell = definePrototype<TableCellProps, TableCellExposes>({
  name: 'liquid-glass-table-cell',
  modules: asLiquidGlassTableCell.modules,
  setup(def) {
    const behavior = asLiquidGlassTableCell();
    // Base owns headers/span configuration, row/column index projection and
    // the authored slot. The family adds only restrained cell padding and ink.
    def.feedback.style.use(tw('px-4 py-3 text-left text-sm text-foreground'));
    return behavior.render;
  },
});

export default liquidGlassTableCell;
