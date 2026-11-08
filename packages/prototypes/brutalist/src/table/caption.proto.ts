import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import { tableCaption as baseTableCaption } from '@proto.ui/prototypes-base/table';
import type { BrutalistTableCaptionExposes, BrutalistTableCaptionProps } from './types';

const asTableCaption = defineAsHook({
  ...baseTableCaption,
  name: 'as-brutalist-table-caption',
});

export const tableCaption = definePrototype<
  BrutalistTableCaptionProps,
  BrutalistTableCaptionExposes
>({
  name: 'brutalist-table-caption',
  modules: asTableCaption.modules,
  setup(def) {
    const inherited = asTableCaption();
    // Family ink instead of muted chrome; the authored text is the caption.
    def.feedback.style.use(tw('table-caption mt-4 text-foreground'));
    return inherited.render;
  },
});

export { tableCaption as brutalistTableCaption };
export default tableCaption;
