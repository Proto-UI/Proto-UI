import { definePrototype } from '@proto.ui/core';
import type { ShadcnStyleProps } from './context';
import { setupShadcnStyleScope } from './selection';

/** Draft style carrier: contributes no behavior, template or host CSS. */
const styleScope = definePrototype<ShadcnStyleProps>({
  name: 'shadcn-style-scope',
  setup: setupShadcnStyleScope,
});
export default styleScope;
