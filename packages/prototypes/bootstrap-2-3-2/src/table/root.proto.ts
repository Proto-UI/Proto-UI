import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableRoot as baseTableRoot,
  type TableRootProps,
  type TableRootExposes,
} from '@proto.ui/prototypes-base/table';

// Base Table intentionally has no public asTable* entries. The public authored
// hook mechanism preserves its exact setup, modules, domain and anonymous slot.
const asTableRoot = defineAsHook<TableRootProps, TableRootExposes, {}>({
  ...baseTableRoot,
  name: 'as-bootstrap-2-3-2-table-root-base',
});

export const tableRoot = definePrototype<TableRootProps, TableRootExposes>({
  name: 'bootstrap-2-3-2-table-root',
  modules: asTableRoot.modules,
  setup(def) {
    const behavior = asTableRoot();
    // Bootstrap v2.3.2 less/tables.less: baseline .table, not the optional
    // bordered/condensed/striped/hover classes. No Head/Body/RowGroup is added.
    def.feedback.style.use(
      tw(
        'table w-full max-w-full mb-[20px] border-collapse border-spacing-0 bg-transparent text-[14px] leading-[20px] text-foreground'
      )
    );
    return behavior.render;
  },
});

export default tableRoot;
