import { definePrototype } from '@proto.ui/core';
import { asAccessible, asTableStructure } from '@proto.ui/hooks';
import { TABLE_STRUCTURE_FAMILY } from '@proto.ui/module-table-structure';
import type { TableRowExposes, TableRowProps } from './types';

export const tableRow = definePrototype<TableRowProps, TableRowExposes>({
  name: 'base-table-row',
  setup(def) {
    def.anatomy.claim(TABLE_STRUCTURE_FAMILY, { role: 'row' });
    const accessible = asAccessible();
    const table = asTableStructure<TableRowProps>('row');
    accessible.role(table.states.a11yRole);
    accessible.state('rowIndex', table.states.row);
    return (render) => render.slot();
  },
});

export default tableRow;
