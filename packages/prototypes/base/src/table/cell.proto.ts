import { definePrototype } from '@proto.ui/core';
import { asAccessible, asTableStructure } from '@proto.ui/hooks';
import { TABLE_STRUCTURE_FAMILY } from '@proto.ui/module-table-structure';
import type { TableCellExposes, TableCellProps } from './types';

export const tableCell = definePrototype<TableCellProps, TableCellExposes>({
  name: 'base-table-cell',
  setup(def) {
    def.anatomy.claim(TABLE_STRUCTURE_FAMILY, { role: 'cell' });
    def.props.define({
      headers: { type: 'object', empty: 'fallback' },
      rowSpan: { type: 'number', empty: 'fallback' },
      columnSpan: { type: 'number', empty: 'fallback' },
    });
    def.props.setDefaults({ headers: [], rowSpan: 1, columnSpan: 1 });

    const accessible = asAccessible();
    const table = asTableStructure<TableCellProps>('cell');
    accessible.role(table.states.a11yRole);
    accessible.state('rowIndex', table.states.row);
    accessible.state('columnIndex', table.states.column);
    accessible.state('rowSpan', table.states.rowSpan);
    accessible.state('columnSpan', table.states.columnSpan);

    const sync = (props: Readonly<TableCellProps>) => {
      table.configure({
        headers: Array.isArray(props.headers) ? props.headers : [],
        rowSpan: typeof props.rowSpan === 'number' ? props.rowSpan : 1,
        columnSpan: typeof props.columnSpan === 'number' ? props.columnSpan : 1,
      });
    };
    def.lifecycle.onCreated((run) => sync(run.props.get()));
    def.props.watchAll((_run, next) => sync(next));
    return (render) => render.slot();
  },
});

export default tableCell;
