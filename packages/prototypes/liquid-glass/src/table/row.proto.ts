// Neutral content projection: a passive structural row, no selection or focus
// ownership and no material candidate.
import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableRow,
  type TableRowProps,
  type TableRowExposes,
} from '@proto.ui/prototypes-base/table';

const asLiquidGlassTableRow = defineAsHook<TableRowProps, TableRowExposes, {}>({
  ...tableRow,
  name: 'as-liquid-glass-table-row',
});

export const liquidGlassTableRow = definePrototype<TableRowProps, TableRowExposes>({
  name: 'liquid-glass-table-row',
  modules: asLiquidGlassTableRow.modules,
  setup(def) {
    const behavior = asLiquidGlassTableRow();
    // Base owns row membership, rowIndex projection and the authored slot. The
    // family adds only a quiet bottom rule, without imposing grid/flex layout.
    def.feedback.style.use(tw('border-b border-border'));
    return behavior.render;
  },
});

export default liquidGlassTableRow;
