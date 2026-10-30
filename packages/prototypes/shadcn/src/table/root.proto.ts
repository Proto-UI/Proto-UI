import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import { tableRoot as baseTableRoot } from '@proto.ui/prototypes-base/table';
import { setupShadcnStyleScope } from '../style-scope';
import { setupTableText } from './visual';
import type { ShadcnTableRootExposes, ShadcnTableRootProps } from './types';

// The public authored-hook boundary retains the exact Base modules and render.
const asTableRoot = defineAsHook({ ...baseTableRoot, name: 'as-shadcn-table-root' });

export const tableRoot = definePrototype<ShadcnTableRootProps, ShadcnTableRootExposes>({
  name: 'shadcn-table-root',
  modules: asTableRoot.modules,
  setup(def) {
    const inherited = asTableRoot();
    setupShadcnStyleScope(def);
    setupTableText(def);
    // Native table/preflight geometry, not a Grid/DataTable layout substitute.
    // An independent scrolling container remains consumer-owned.
    def.feedback.style.use(tw('table w-full border-collapse caption-bottom'));
    return inherited.render;
  },
});

export default tableRoot;
