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
    def.props.setDefaults({
      headerKey: '',
      headerKind: 'column',
      headers: [],
      rowSpan: 1,
      columnSpan: 1,
    });

    const accessible = asAccessible();
    const role = def.state.string('tableHeaderRole', 'columnheader');
    accessible.role(role);
    const table = asTableStructure<TableHeaderCellProps>('headerCell');
    accessible.state('rowIndex', table.states.row);
    accessible.state('columnIndex', table.states.column);
    accessible.state('rowSpan', table.states.rowSpan);
    accessible.state('columnSpan', table.states.columnSpan);
    def.expose.value('__tableStructurePart', table.getPartBridge());

    const sync = (props: Readonly<Required<TableHeaderCellProps>>) => {
      role.set(props.headerKind === 'row' ? 'rowheader' : 'columnheader');
      table.configure({
        headerKey: props.headerKey,
        headerKind: props.headerKind,
        headers: props.headers,
        rowSpan: props.rowSpan,
        columnSpan: props.columnSpan,
      });
    };
    def.lifecycle.onCreated((run) =>
      sync(run.props.get() as Readonly<Required<TableHeaderCellProps>>)
    );
    def.props.watchAll((_run, next) => sync(next as Readonly<Required<TableHeaderCellProps>>));
    return (render) => render.slot();
  },
});

export default tableHeaderCell;
