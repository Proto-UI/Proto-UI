import { definePrototype } from '@proto.ui/core';
import { asDialogTrigger } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogTriggerExposes, ShadcnDialogTriggerProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

const dialogTrigger = definePrototype<ShadcnDialogTriggerProps, ShadcnDialogTriggerExposes>({
  name: 'shadcn-dialog-trigger',
  setup(def) {
    // P-SHADCN-DIALOG-TRIGGER-BASE-INHERITANCE,
    // P-SHADCN-DIALOG-TRIGGER-CURRENT-BASE-DEVIATIONS
    // P-SHADCN-DIALOG-TRIGGER-UNSTYLED-SURFACE
    asDialogTrigger();
    setupShadcnStyleScope(def);
  },
});

/** P-SHADCN-DIALOG-TRIGGER-DIRECT-ENTRY and P-SHADCN-DIALOG-TRIGGER-UNSTYLED-SURFACE. */

export default dialogTrigger;
