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
    // family contributes a CSS table row and a quiet bottom rule.
    def.feedback.style.use(tw('table-row border-b border-border'));
    return behavior.render;
  },
});

export default liquidGlassTableRow;
