import { definePrototype, tw } from '@proto.ui/core';
import { asTextareaRoot } from '@proto.ui/prototypes-base/textarea';
import { BRUTALIST_FOCUS_TOKENS } from '../style';
import type { BrutalistTextareaRootExposes, BrutalistTextareaRootProps } from './types';

export const BrutalistTextareaRoot = definePrototype<
  BrutalistTextareaRootProps,
  BrutalistTextareaRootExposes
>({
  name: 'brutalist-textarea-root',
  modules: asTextareaRoot.modules,
  setup(def) {
    const textarea = asTextareaRoot();
    const state = textarea.stateHandles;
    if (!state) {
      throw new Error('[brutalist-textarea] asTextareaRoot must project state handles.');
    }

    def.feedback.style.use(
      tw(
        'block min-h-28 w-full resize-y rounded-none border-2 border-foreground bg-lavender p-3 font-mono text-sm leading-6 text-lavender-foreground shadow-[3px_3px_0_0_var(--pui-foreground)] outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
    return () => null;
  },
});
