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
    accessible.role('cell');
    const table = asTableStructure<TableCellProps>('cell');
    accessible.state('rowIndex', table.states.row);
    accessible.state('columnIndex', table.states.column);
    accessible.state('rowSpan', table.states.rowSpan);
    accessible.state('columnSpan', table.states.columnSpan);
    def.expose.value('__tableStructurePart', table.getPartBridge());

    const sync = (props: Readonly<Required<TableCellProps>>) => {
      table.configure({
        headers: props.headers,
        rowSpan: props.rowSpan,
        columnSpan: props.columnSpan,
      });
    };
    def.lifecycle.onCreated((run) => sync(run.props.get() as Readonly<Required<TableCellProps>>));
    def.props.watchAll((_run, next) => sync(next as Readonly<Required<TableCellProps>>));
    return (render) => render.slot();
  },
});

export default tableCell;
