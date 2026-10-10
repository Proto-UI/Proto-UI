import { definePrototype, tw } from '@proto.ui/core';
import { asInputRoot } from '@proto.ui/prototypes-base/input';
import type { ShadcnInputRootExposes, ShadcnInputRootProps } from './types';

const ROOT_BASE_TOKENS = [
  'h-8',
  'w-full',
  'min-w-0',
  'rounded-lg',
  'border',
  'border-input',
  'bg-transparent',
  'px-2.5',
  'py-1',
  'text-base',
  'transition-colors',
  'outline-none',
  'selection:bg-primary',
  'selection:text-primary-foreground',
].join(' ');

export const ShadcnInputRoot = definePrototype<ShadcnInputRootProps, ShadcnInputRootExposes>({
  name: 'shadcn-input-root',
  modules: asInputRoot.modules,
  setup(def) {
    // P-SHADCN-INPUT-BASE-INHERITANCE: Base owns the editing protocol and editor.
    const state = asInputRoot().stateHandles;
    if (!state) {
      throw new Error('[shadcn-input-root] asInputRoot must project Input state handles.');
    }

    // P-SHADCN-INPUT-VISUAL-SURFACE: the bounded subset of the content-pinned base-nova Input.
    def.feedback.style.use(tw(ROOT_BASE_TOKENS));

    // P-SHADCN-INPUT-STATE-PRESENTATION: all conditions consume inherited Base facts.
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-ring/50 ring-3')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('pointer-events-none cursor-not-allowed opacity-50 bg-input/50')),
    });
    def.rule({
      when: (w) => w.meta('colorScheme').eq('dark'),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });

    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(state.disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-input/80')),
    });

    // P-SHADCN-INPUT-CONTENTLESS: the caller owns its renderer; children are not another editor.
    return () => null;
  },
});

export default ShadcnInputRoot;
