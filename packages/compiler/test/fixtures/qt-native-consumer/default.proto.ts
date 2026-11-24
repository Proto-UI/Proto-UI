import { definePrototype, tw } from '@proto.ui/core';

export default definePrototype({
  name: 'qt-default-template',
  setup(def) {
    def.feedback.style.use(tw('w-40 h-20'));
  },
});
