import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupRoot } from '@proto.ui/prototypes-base/radio-group';
import type { BrutalistRadioGroupRootExposes, BrutalistRadioGroupRootProps } from './types';

// Source: neobrutalism-components radio-group.tsx@3306a802, a plain `grid gap-2`
// column. The Root carries no visual states: Base keeps value, roving focus,
// radiogroup naming and disabled ownership while this layer only adds the
// pinned column layout and family text color.
const ROOT_SURFACE_TOKENS = 'grid w-full gap-2 text-foreground';

const radioGroupRoot = definePrototype<
  BrutalistRadioGroupRootProps,
  BrutalistRadioGroupRootExposes
>({
  name: 'brutalist-radio-group-root',
  setup(def) {
    const inherited = asRadioGroupRoot();
    def.feedback.style.use(tw(ROOT_SURFACE_TOKENS));
    return inherited.render;
  },
});

export default radioGroupRoot;
