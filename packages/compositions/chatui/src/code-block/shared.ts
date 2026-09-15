import { createAnatomyFamily } from '@proto.ui/core';

export const CODE_BLOCK_FAMILY = createAnatomyFamily('chatui-code-block', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    header: { cardinality: { min: 0, max: 1 } },
    content: { cardinality: { min: 1, max: 1 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'header' },
    { kind: 'contains', parent: 'root', child: 'content' },
  ],
});
