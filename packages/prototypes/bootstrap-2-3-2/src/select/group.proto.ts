import { definePrototype } from '@proto.ui/core';
import { asSelectGroup } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectGroupProps, Bootstrap232SelectGroupExposes } from './types';

// Semantic-only: upstream `li.nav-header` paints on Label, while Group keeps
// the scoped group/labelledBy relation without a physical container rule.
export default definePrototype<Bootstrap232SelectGroupProps, Bootstrap232SelectGroupExposes>({
  name: 'bootstrap-2-3-2-select-group',
  setup() {
    return asSelectGroup().render;
  },
});
