import { createAnatomyFamily, createContextKey } from '@proto.ui/core';
export const TOOLBAR_FAMILY = createAnatomyFamily('base-toolbar', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    button: { cardinality: { min: 0, max: '*' } },
    separator: { cardinality: { min: 0, max: '*' } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'button' },
    { kind: 'contains', parent: 'root', child: 'separator' },
  ],
});
export type ToolbarContext = {
  disabled: boolean;
  current: string;
  orientation: 'horizontal' | 'vertical';
};
export const TOOLBAR_CONTEXT = createContextKey<ToolbarContext>('base-toolbar');
let next = 0;
export const createToolbarButtonId = () => `pui-toolbar-button-${++next}`;
