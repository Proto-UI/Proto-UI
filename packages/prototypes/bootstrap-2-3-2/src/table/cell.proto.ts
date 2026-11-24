import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableCell as baseTableCell,
  type TableCellProps,
  type TableCellExposes,
} from '@proto.ui/prototypes-base/table';
import type { BootstrapTableCellExposes, BootstrapTableCellProps } from './types';

const asTableCell = defineAsHook<TableCellProps, TableCellExposes, {}>({
  ...baseTableCell,
  name: 'as-bootstrap-2-3-2-table-cell-base',
});

export const tableCell = definePrototype<BootstrapTableCellProps, BootstrapTableCellExposes>({
  name: 'bootstrap-2-3-2-table-cell',
  modules: asTableCell.modules,
  setup(def) {
    const behavior = asTableCell();
    def.props.define({
      condensed: { type: 'boolean', empty: 'fallback' },
      bordered: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ condensed: false, bordered: false });
    def.feedback.style.use(
      tw('table-cell leading-[20px] align-top font-normal border-t border-border')
    );
    def.rule({
      when: (w) => w.prop('condensed').eq(false),
      intent: (i) => i.feedback.style.use(tw('p-[8px]')),
    });
    def.rule({
      when: (w) => w.prop('condensed').eq(true),
      intent: (i) => i.feedback.style.use(tw('px-[5px] py-[4px]')),
    });
    def.rule({
      when: (w) => w.prop('bordered').eq(true),
      intent: (i) => i.feedback.style.use(tw('border-l')),
    });
    return behavior.render;
  },
});

export default tableCell;
