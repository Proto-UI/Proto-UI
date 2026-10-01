import { definePrototype } from '@proto.ui/core';
import { asAccessible, asTableStructure } from '@proto.ui/hooks';
import { TABLE_STRUCTURE_FAMILY } from '@proto.ui/module-table-structure';
import type { TableHeaderCellExposes, TableHeaderCellProps } from './types';

export const tableHeaderCell = definePrototype<TableHeaderCellProps, TableHeaderCellExposes>({
  name: 'base-table-header-cell',
  setup(def) {
    def.anatomy.claim(TABLE_STRUCTURE_FAMILY, { role: 'headerCell' });
    def.props.define({
      headerKey: { type: 'string', empty: 'fallback' },
      headerKind: { type: 'enum', options: ['column', 'row'], empty: 'fallback' },
      headers: { type: 'object', empty: 'fallback' },
      rowSpan: { type: 'number', empty: 'fallback' },
      columnSpan: { type: 'number', empty: 'fallback' },
    });
    def.props.setDefaults({ headerKey: '', headers: [], rowSpan: 1, columnSpan: 1 });

    const accessible = asAccessible();
    const table = asTableStructure<TableHeaderCellProps>('headerCell');
    accessible.role(table.states.a11yRole);
    accessible.state('rowIndex', table.states.row);
    accessible.state('columnIndex', table.states.column);
    accessible.state('rowSpan', table.states.rowSpan);
    accessible.state('columnSpan', table.states.columnSpan);

    const sync = (props: Readonly<TableHeaderCellProps>) => {
      const headerKind =
        props.headerKind === 'row' || props.headerKind === 'column' ? props.headerKind : undefined;
      table.configure({
        headerKey: typeof props.headerKey === 'string' ? props.headerKey : '',
        headerKind,
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

export default tableHeaderCell;
