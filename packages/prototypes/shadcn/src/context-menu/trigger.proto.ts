import { definePrototype, tw } from '@proto.ui/core';
import { asContextMenuTrigger } from '@proto.ui/prototypes-base/context-menu';
import type { ContextMenuTriggerProps, ContextMenuTriggerExposes } from './types';
import { setupMenuStyle } from '../dropdown/visual';
export default definePrototype<ContextMenuTriggerProps, ContextMenuTriggerExposes>({
  name: 'shadcn-context-menu-trigger',
  modules: asContextMenuTrigger.modules,
  setup(def) {
    asContextMenuTrigger();
    const style = setupMenuStyle(def);
    // Source trigger is headless; the old dashed demo-sized box was not part
    // of either source. Do not install Button semantics to decorate it.
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('select-none')),
    });
  },
});
