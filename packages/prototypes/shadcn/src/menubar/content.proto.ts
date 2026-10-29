import { definePrototype, tw } from '@proto.ui/core';
import { asMenubarContent, type MenubarContentExposes } from '@proto.ui/prototypes-base/menubar';
import { setupMenubarStyle } from './visual';
import type { ShadcnMenubarContentProps } from './types';
export default definePrototype<ShadcnMenubarContentProps, MenubarContentExposes>({
  name: 'shadcn-menubar-content',
  setup(def) {
    const behavior = asMenubarContent();
    const style = setupMenubarStyle(def);
    def.feedback.style.use(
      tw(
        'z-50 bg-popover text-popover-foreground p-1 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto'
      )
    );
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('min-w-48 rounded-md border border-border shadow-md')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(
          tw('min-w-36 rounded-[var(--pui-radius-2xl)] shadow-lg ring-1 ring-foreground/5')
        ),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
    });
    // Placement/presence motion and translucent material remain separate tracked closure.
  },
});
