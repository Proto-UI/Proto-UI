import { definePrototype, tw } from '@proto.ui/core';

export default definePrototype({
  name: 'qt-empty-template',
  setup(def) {
    def.feedback.style.use(tw('w-40 h-20'));
    return () => null;
  },
});
