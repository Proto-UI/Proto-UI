import { createAnatomyFamily } from '@proto.ui/core';

export const MESSAGE_FAMILY = createAnatomyFamily('chatui-message', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    leading: { cardinality: { min: 0, max: 1 } },
    header: { cardinality: { min: 1, max: 1 } },
    content: { cardinality: { min: 1, max: 1 } },
    footer: { cardinality: { min: 0, max: 1 } },
    actions: { cardinality: { min: 0, max: '*' } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'leading' },
    { kind: 'contains', parent: 'root', child: 'header' },
    { kind: 'contains', parent: 'root', child: 'content' },
    { kind: 'contains', parent: 'root', child: 'footer' },
    { kind: 'contains', parent: 'root', child: 'actions' },
  ],
});
