import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogAction,
  type AlertDialogActionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

import type { ShadcnAlertDialogActionProps } from './types';
import {
  SHADCN_BUTTON_BASE_TOKENS,
  SHADCN_BUTTON_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_DEFAULT_VARIANT_TOKENS,
  SHADCN_BUTTON_DEFAULT_HOVER_TOKENS,
  SHADCN_BUTTON_FOCUS_TOKENS,
  SHADCN_BUTTON_DISABLED_TOKENS,
} from '../button/paint';

// Passive family Button paint; the inherited AlertDialog command keeps sole action ownership.
// Keep the valid borrowed getState pattern. Source collector coverage is a separate owner.
export default definePrototype<ShadcnAlertDialogActionProps, AlertDialogActionExposes>({
  name: 'shadcn-alert-dialog-action',
  setup(def) {
    def.props.define({ wrap: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ wrap: false });
    const behavior = asAlertDialogAction();
    const state = behavior.getState!;
    // Restore the pre-e0d4f3d command-subject selection affordance. This owner
    // remains AlertDialog, not Button; shared Drawer paint is deliberately unchanged.
    def.feedback.style.use(tw('select-none'));
    def.feedback.style.use(tw(SHADCN_BUTTON_BASE_TOKENS));
    def.rule({
      when: (w) => w.prop('wrap').eq(false),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DEFAULT_SIZE_TOKENS)),
    });
    def.rule({
      when: (w) => w.prop('wrap').eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS)),
    });
    def.feedback.style.use(tw(SHADCN_BUTTON_DEFAULT_VARIANT_TOKENS));
    def.rule({
      when: (w) => w.state(state('hovered')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DEFAULT_HOVER_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DISABLED_TOKENS)),
    });
  },
});
