import { defineAsHook, definePrototype, tw, type State } from '@proto.ui/core';
import {
  tableHeaderCell as baseTableHeaderCell,
  type TableHeaderCellProps,
  type TableHeaderCellExposes,
} from '@proto.ui/prototypes-base/table';

type HeaderCellBehaviorContract = {
  asHooks: {
    'asTableStructure:headerCell': {
      readonly states: { readonly row: State<number> };
    };
  };
};

const asTableHeaderCell = defineAsHook<
  TableHeaderCellProps,
  TableHeaderCellExposes,
  HeaderCellBehaviorContract
>({ ...baseTableHeaderCell, name: 'as-bootstrap-2-3-2-table-header-cell-base' });

export const tableHeaderCell = definePrototype<TableHeaderCellProps, TableHeaderCellExposes>({
  name: 'bootstrap-2-3-2-table-header-cell',
  modules: asTableHeaderCell.modules,
  setup(def) {
    const behavior = asTableHeaderCell();
    const table = behavior.getAsHookHandle?.('asTableStructure:headerCell');
    if (!table)
      throw new Error('[bootstrap-2-3-2-table-header-cell] Base Table Structure handle required.');
    def.feedback.style.use(
      tw('table-cell p-[8px] leading-[20px] text-left font-bold border-[#ddd]')
    );
    // Base has no thead/tbody owners. Its explicit header kind is the lawful
    // presentation distinction: column headings bottom-align, row headings do not.
    def.rule({
      when: (w) => w.prop('headerKind').eq('column'),
      intent: (i) => i.feedback.style.use(tw('align-bottom')),
    });
    def.rule({
      when: (w) => w.not(w.prop('headerKind').eq('column')),
      intent: (i) => i.feedback.style.use(tw('align-top')),
    });
    // Table Structure publishes one-based coordinates for ARIA. Preserve the
    // first-heading-row border exception without inferring topology from slot text.
    def.rule({
      when: (w) => w.not(w.all(w.prop('headerKind').eq('column'), w.state(table.states.row).eq(1))),
      intent: (i) => i.feedback.style.use(tw('border-t')),
    });
    return behavior.render;
  },
});

export default tableHeaderCell;
