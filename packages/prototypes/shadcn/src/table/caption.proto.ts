import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import { tableCaption as baseTableCaption } from '@proto.ui/prototypes-base/table';
import { setupTableText } from './visual';
import type { ShadcnTableCaptionExposes, ShadcnTableCaptionProps } from './types';

const asTableCaption = defineAsHook({ ...baseTableCaption, name: 'as-shadcn-table-caption' });

export const tableCaption = definePrototype<ShadcnTableCaptionProps, ShadcnTableCaptionExposes>({
  name: 'shadcn-table-caption',
  modules: asTableCaption.modules,
  setup(def) {
    const inherited = asTableCaption();
    setupTableText(def);
    def.feedback.style.use(tw('table-caption mt-4 text-muted-foreground'));
    return inherited.render;
  },
});

export default tableCaption;
