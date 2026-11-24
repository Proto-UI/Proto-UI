import { definePrototype, tw } from '@proto.ui/core';
import {
  asDataTableHeaderRow,
  type DataTableHeaderRowProps,
  type DataTableHeaderRowExposes,
} from '@proto.ui/prototypes-base/data-table';
import { setupShadcnStyleSelection, type ShadcnStyleProps } from '../style-scope';

export type ShadcnDataTableHeaderRowProps = DataTableHeaderRowProps & ShadcnStyleProps;

export const dataTableHeaderRow = definePrototype<
  ShadcnDataTableHeaderRowProps,
  DataTableHeaderRowExposes
>({
  name: 'shadcn-data-table-header-row',
  modules: asDataTableHeaderRow.modules,
  setup(def) {
    const behavior = asDataTableHeaderRow();
    setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('table-row border-b border-border transition-colors'));
    return behavior.render;
  },
});
export { dataTableHeaderRow as shadcnDataTableHeaderRow };
