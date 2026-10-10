import { definePrototype, tw } from '@proto.ui/core';
import { asSelectRoot } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectRootProps, Bootstrap232SelectRootExposes } from './types';

export default definePrototype<Bootstrap232SelectRootProps, Bootstrap232SelectRootExposes>({
  name: 'bootstrap-2-3-2-select-root',
  setup(def) {
    // Base alone owns open, selection, collection and controlled requests.
    asSelectRoot();
    def.feedback.style.use(tw('inline-flex min-w-0 max-w-full'));
  },
});
