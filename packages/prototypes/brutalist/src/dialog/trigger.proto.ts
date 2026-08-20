import { definePrototype, tw } from '@proto.ui/core';
import { asDialogTrigger } from '@proto.ui/prototypes-base/dialog';
import type { BrutalistDialogTriggerExposes, BrutalistDialogTriggerProps } from './types';

const TRIGGER_TOKENS = [
  'group/brutalist-dialog-trigger',
  'inline-flex',
  'shrink-0',
  'items-center',
  'justify-center',
  'rounded-none',
  'border-2',
  'border-black',
  'bg-sky',
  'text-sky-foreground',
  'font-bold',
  'uppercase',
  'text-sm',
  'whitespace-nowrap',
  'outline-none',
  'select-none',
  'h-10',
  'gap-2',
  'px-4',
  'shadow-[3px_3px_0_0_#000]',
].join(' ');

const dialogTrigger = definePrototype<BrutalistDialogTriggerProps, BrutalistDialogTriggerExposes>({
  name: 'brutalist-dialog-trigger',
  setup(def) {
    // P-BRUTALIST-DIALOG-TRIGGER-BASE-INHERITANCE: inherit Base Dialog Trigger states (open/disabled/hovered/focusVisible/pressed) once.
    const state = asDialogTrigger().stateHandles;
    if (!state) {
      throw new Error('[brutalist-dialog-trigger] missing Dialog Trigger state handles.');
    }
    const { disabled, hovered, focusVisible, pressed } = state;
    // P-BRUTALIST-DIALOG-TRIGGER-VISUAL-GRAMMAR + P-BRUTALIST-DIALOG-TRIGGER-PAIR-INVARIANT: fixed bg-sky / text-sky-foreground surface, square, border-2 black, hard shadow-3, bold uppercase.
    def.feedback.style.use(tw(TRIGGER_TOKENS));
    // P-BRUTALIST-DIALOG-TRIGGER-INTERACTION rules: hover lift, press sink, focus-visible ring, disabled fade (preserves sky pair).
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('-translate-x-px -translate-y-px shadow-[4px_4px_0_0_#000]')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-x-px translate-y-px shadow-none')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
  },
});

// P-BRUTALIST-DIALOG-TRIGGER-ENTRY: `brutalist-dialog-trigger` is the only public Dialog trigger entry in this slice.

export default dialogTrigger;
