import { createAnatomyFamily } from '@proto.ui/core';

/** C-TABLE-STRUCTURE-0001-ANATOMY / NO-ROW-GROUP-IDENTITY. */
export const TABLE_STRUCTURE_FAMILY = createAnatomyFamily('base-table', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    caption: { cardinality: { min: 0, max: 1 } },
    row: { cardinality: { min: 1, max: '*' } },
    headerCell: { cardinality: { min: 1, max: '*' } },
    cell: { cardinality: { min: 1, max: '*' } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'caption' },
    { kind: 'contains', parent: 'root', child: 'row' },
    { kind: 'contains', parent: 'row', child: 'headerCell' },
    { kind: 'contains', parent: 'row', child: 'cell' },
  ],
});
