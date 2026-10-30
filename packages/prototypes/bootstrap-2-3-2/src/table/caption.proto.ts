import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableCaption as baseTableCaption,
  type TableCaptionProps,
  type TableCaptionExposes,
} from '@proto.ui/prototypes-base/table';

const asTableCaption = defineAsHook<TableCaptionProps, TableCaptionExposes, {}>({
  ...baseTableCaption,
  name: 'as-bootstrap-2-3-2-table-caption-base',
});

export const tableCaption = definePrototype<TableCaptionProps, TableCaptionExposes>({
  name: 'bootstrap-2-3-2-table-caption',
  modules: asTableCaption.modules,
  setup(def) {
    const behavior = asTableCaption();
    // Upstream does not turn the table caption into a padded panel or heading.
    def.feedback.style.use(tw('table-caption text-center font-normal'));
    return behavior.render;
  },
});

export default tableCaption;
