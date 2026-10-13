import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogCancel,
  type AlertDialogCancelExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

import type { ShadcnAlertDialogCancelProps } from './types';
import {
  SHADCN_BUTTON_BASE_TOKENS,
  SHADCN_BUTTON_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS,
  SHADCN_BUTTON_OUTLINE_HOVER_TOKENS,
  SHADCN_BUTTON_FOCUS_TOKENS,
  SHADCN_BUTTON_DISABLED_TOKENS,
} from '../button/paint';

// Passive family Button paint; the inherited AlertDialog command keeps sole action ownership.
// Keep the valid borrowed getState pattern. Source collector coverage is a separate owner.
export default definePrototype<ShadcnAlertDialogCancelProps, AlertDialogCancelExposes>({
  name: 'shadcn-alert-dialog-cancel',
  setup(def) {
    def.props.define({ wrap: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ wrap: false });
    const behavior = asAlertDialogCancel();
    const state = behavior.getState!;
    def.feedback.style.use(tw(SHADCN_BUTTON_BASE_TOKENS));
    def.rule({
      when: (w) => w.prop('wrap').eq(false),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DEFAULT_SIZE_TOKENS)),
    });
    def.rule({
      when: (w) => w.prop('wrap').eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS)),
    });
    def.feedback.style.use(tw(SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS));
    def.rule({
      when: (w) => w.state(state('hovered')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_OUTLINE_HOVER_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DISABLED_TOKENS)),
    });
    def.rule({
      when: (w) => w.meta('colorScheme').eq('dark'),
      intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
    });
    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(state('hovered')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
  },
});
