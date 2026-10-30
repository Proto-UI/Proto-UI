import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogRoot,
  type AlertDialogRootExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { AlertDialogRootProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

export default definePrototype<AlertDialogRootProps, AlertDialogRootExposes>({
  name: 'shadcn-alert-dialog-root',
  setup(def) {
    const behavior = asAlertDialogRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
