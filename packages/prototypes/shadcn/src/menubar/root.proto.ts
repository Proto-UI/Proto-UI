import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarRoot,
  type MenubarRootExposes,
} from '@proto.ui/prototypes-base/menubar';
import { setupMenubarStyle } from './visual';
import type { ShadcnMenubarRootProps } from './types';
export default definePrototype<ShadcnMenubarRootProps, MenubarRootExposes>({
  name: 'shadcn-menubar-root',
  setup(def) {
    const behavior = asMenubarRoot();
    const style = setupMenubarStyle(def, true);
    // Source-bound existing-part paint; not submenu or complete motion admission.
    def.feedback.style.use(tw('relative flex min-w-0 items-center border border-border'));
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('h-9 gap-1 rounded-md bg-background p-1 shadow-xs')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('h-8 rounded-[var(--pui-radius-2xl)] p-[3px]')),
    });
  },
});
