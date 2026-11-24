import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarRoot,
  type MenubarRootProps,
  type MenubarRootExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarRootProps, MenubarRootExposes>({
  name: 'bootstrap-2-3-2-menubar-root',
  modules: asMenubarRoot.modules,
  setup(def) {
    const behavior = asMenubarRoot();
    def.feedback.style.use(
      tw(
        'relative inline-flex min-w-0 flex-wrap items-center gap-[2px] min-h-[40px] px-[8px] py-[4px] rounded-[4px] border font-sans shadow-xs'
      )
    );
    def.rule({
      when: (w) => w.not(w.meta('colorScheme').eq('dark')),
      intent: (i) =>
        i.feedback.style.use(
          tw('border-border bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x] text-[#333]')
        ),
    });
    def.rule({
      when: (w) => w.meta('colorScheme').eq('dark'),
      intent: (i) =>
        i.feedback.style.use(tw('border-border bg-secondary text-secondary-foreground')),
    });
    return behavior.render;
  },
});
