import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import { tableRoot as baseTableRoot } from '@proto.ui/prototypes-base/table';
import type { BrutalistTableRootExposes, BrutalistTableRootProps } from './types';

// The public authored-hook boundary retains the exact Base modules and render.
const asTableRoot = defineAsHook({ ...baseTableRoot, name: 'as-brutalist-table-root' });

// Source: neobrutalism-components 3306a802; see THIRD_PARTY_NOTICES.md. The
// pinned collection ships no standalone table component, so the surface follows
// the family's authored container grammar: Card's framed panel
// (rounded-base + 2px black border + 4px/4px solid offset shadow) combined
// with the data-table sibling's squared native-grid container. Width stays
// consumer-owned through the authored wrapper.
const TABLE_SURFACE_TOKENS = [
  'table',
  'w-full',
  'min-w-0',
  'max-w-full',
  'border-collapse',
  'caption-bottom',
  'rounded-none',
  'border-2',
  'border-black',
  'bg-background',
  'text-foreground',
  'font-sans',
  'font-medium',
  'shadow-[4px_4px_0_0_#000]',
].join(' ');

export const tableRoot = definePrototype<BrutalistTableRootProps, BrutalistTableRootExposes>({
  name: 'brutalist-table-root',
  modules: asTableRoot.modules,
  setup(def) {
    const inherited = asTableRoot();
    // Native table/preflight geometry, not a Grid/DataTable layout substitute.
    // An independent scrolling container remains consumer-owned.
    def.feedback.style.use(tw(TABLE_SURFACE_TOKENS));
    return inherited.render;
  },
});

export { tableRoot as brutalistTableRoot };
export default tableRoot;
