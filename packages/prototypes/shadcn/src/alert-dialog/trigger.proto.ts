import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogTrigger,
  type AlertDialogTriggerExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { AlertDialogTriggerProps } from './types';
import { setupOverlayStyle } from '../dialog/style';

export default definePrototype<AlertDialogTriggerProps, AlertDialogTriggerExposes>({
  name: 'shadcn-alert-dialog-trigger',
  setup(def) {
    const behavior = asAlertDialogTrigger();
    const style = setupOverlayStyle(def);
    // Existing New York command appearance is a Proto extension. The modern
    // source Trigger is headless; no Button behavior or guessed modern skin.
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium outline-none'
          )
        ),
    });
    const state = behavior.getState!;
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq('new-york-v4'), w.state(state('focusVisible')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(state('disabled')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
  },
});
