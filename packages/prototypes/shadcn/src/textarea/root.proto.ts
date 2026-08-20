import { definePrototype, tw } from '@proto.ui/core';
import { asTextareaRoot } from '@proto.ui/prototypes-base/textarea';
import type { ShadcnTextareaRootExposes, ShadcnTextareaRootProps } from './types';

const ROOT_BASE_TOKENS = [
  'flex',
  'min-h-16',
  'w-full',
  'rounded-md',
  'border',
  'border-input',
  'bg-transparent',
  'px-3',
  'py-2',
  'text-base',
  'shadow-xs',
  'transition-[color,box-shadow]',
  'duration-150',
  'ease-in-out',
  'outline-none',
].join(' ');

export const ShadcnTextareaRoot = definePrototype<
  ShadcnTextareaRootProps,
  ShadcnTextareaRootExposes
>({
  name: 'shadcn-textarea-root',
  modules: asTextareaRoot.modules,
  setup(def) {
    // P-SHADCN-TEXTAREA-BASE-INHERITANCE: Base owns value, editing lifecycle, IME,
    // accessibility, and the single physical editor.
    const state = asTextareaRoot().stateHandles;
    if (!state) {
      throw new Error('[shadcn-textarea-root] asTextareaRoot must project Textarea state handles.');
    }

    // P-SHADCN-TEXTAREA-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(tw(ROOT_BASE_TOKENS));

    // P-SHADCN-TEXTAREA-STATE-DRIVEN-STYLES
    // Upstream keys the ring on `:focus-visible`. `focusVisible` would be the
    // matching state, but it currently misses pointer focus on text controls
    // while this host's own `:focus-visible` matches it, so the ring would
    // never paint on click. Keying on the inherited `focused` state reproduces
    // the measured host behaviour without inventing a second focus owner. This
    // is a temporary arrangement: once #438 aligns `focusVisible` with the
    // host determination, this rule moves back to it with no behaviour change.
    def.rule({
      when: (w) => w.state(state.focused).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-ring/50 ring-3')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
    def.rule({
      when: (w) => w.meta('colorScheme').eq('dark'),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });

    // P-SHADCN-TEXTAREA-CONTENTLESS: the caller prototype owns its own renderer,
    // so the inherited Base contentless renderer has to be restated here.
    return () => null;
  },
});
