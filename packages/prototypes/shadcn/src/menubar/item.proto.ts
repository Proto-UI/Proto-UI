import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarItem,
  type MenubarItemExposes,
} from '@proto.ui/prototypes-base/menubar';
import { setupMenubarStyle } from './visual';
import type { ShadcnMenubarItemProps } from './types';
export default definePrototype<ShadcnMenubarItemProps, MenubarItemExposes>({
  name: 'shadcn-menubar-item',
  setup(def) {
    const behavior = asMenubarItem();
    const style = setupMenubarStyle(def);
    def.feedback.style.use(tw('relative flex min-w-0 items-center cursor-default gap-2 px-2 py-1.5 text-sm outline-none select-none break-words'));
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('rounded-sm')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('min-h-7 rounded-[var(--pui-radius-xl)]')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focused')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
  },
});
