import { definePrototype } from '@proto.ui/core';
import { asAccessible, asTableStructure } from '@proto.ui/hooks';
import { TABLE_STRUCTURE_FAMILY } from '@proto.ui/module-table-structure';
import type { TableCaptionExposes, TableCaptionProps } from './types';

export const tableCaption = definePrototype<TableCaptionProps, TableCaptionExposes>({
  name: 'base-table-caption',
  setup(def) {
    def.anatomy.claim(TABLE_STRUCTURE_FAMILY, { role: 'caption' });
    asAccessible().role('caption');
    const table = asTableStructure<TableCaptionProps>('caption');
    def.expose.value('__tableStructurePart', table.getPartBridge());
    return (render) => render.slot();
  },
});

export default tableCaption;
