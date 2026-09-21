import { definePrototype } from '@proto.ui/core';
import { asAccessible, asTableStructure } from '@proto.ui/hooks';
import { TABLE_STRUCTURE_FAMILY } from '@proto.ui/module-table-structure';
import type { TableRootExposes, TableRootProps } from './types';

export const tableRoot = definePrototype<TableRootProps, TableRootExposes>({
  name: 'base-table-root',
  setup(def) {
    def.anatomy.claim(TABLE_STRUCTURE_FAMILY, { role: 'root' });
    const accessible = asAccessible();
    accessible.role('table');
    const table = asTableStructure<TableRootProps>('root');
    accessible.state('rowCount', table.states.rowCount);
    accessible.state('columnCount', table.states.columnCount);
    def.expose.method('getStructure', () => table.getSnapshot());
    return (render) => render.slot();
  },
});

export default tableRoot;
