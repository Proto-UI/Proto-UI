import { definePrototype, tw } from '@proto.ui/core';
import { asCommandEmpty, type CommandEmptyExposes } from '@proto.ui/prototypes-base/command';
import type { CommandEmptyProps } from './types';
import { setupCommandPartPaint } from './visual';
export default definePrototype<CommandEmptyProps, CommandEmptyExposes>({
  name: 'shadcn-command-empty',
  modules: asCommandEmpty.modules,
  setup(def) {
    asCommandEmpty();
    setupCommandPartPaint(def, 'empty');
    def.feedback.style.use(tw('text-center'));
    def.rule({
      when: (w) => w.prop('presentation').eq('default'),
      intent: (i) => i.feedback.style.use(tw('py-6')),
    });
  },
});
