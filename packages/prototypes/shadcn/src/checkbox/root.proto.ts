import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS, type ShadcnStyleId } from '../style-scope';
import type { ShadcnCheckboxRootExposes, ShadcnCheckboxRootProps } from './types';

// Fixed shadcn-ui/ui 3d98900e: `.cn-checkbox` in each style-{id}.css.
// New York retains its independently adopted compatibility surface.
const CHECKBOX_SURFACE: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'size-4 rounded-[4px] border border-input bg-transparent shadow-xs',
  vega: 'flex size-4 items-center justify-center rounded-[4px] border border-input shadow-xs transition-shadow',
  nova: 'flex size-4 items-center justify-center rounded-[4px] border border-input transition-colors',
  maia: 'flex size-4 items-center justify-center rounded-[6px] border border-input transition-shadow',
  lyra: 'flex size-4 items-center justify-center rounded-none border border-input transition-colors',
  mira: 'flex size-4 items-center justify-center rounded-[4px] border border-input transition-shadow',
  luma: 'flex size-4 items-center justify-center rounded-[5px] border border-transparent bg-input/90 transition-shadow',
  sera: 'flex size-4.5 items-center justify-center rounded-none border border-input bg-transparent transition-shadow',
  rhea: 'flex size-4 items-center justify-center rounded-[5px] border border-transparent bg-input/90 transition-shadow',
};
const CHECKBOX_FOCUS: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'border-ring ring-ring/50 ring-3',
  vega: 'border-ring ring-ring/50 ring-3',
  nova: 'border-ring ring-ring/50 ring-3',
  maia: 'border-ring ring-ring/50 ring-[3px]',
  lyra: 'border-ring ring-ring/50 ring-1',
  mira: 'border-ring ring-ring/30 ring-2',
  luma: 'border-ring ring-ring/30 ring-3',
  sera: 'border-ring ring-ring/30 ring-2',
  rhea: 'border-ring ring-ring/30 ring-3',
};

const checkboxRoot = definePrototype<ShadcnCheckboxRootProps, ShadcnCheckboxRootExposes>({
  name: 'shadcn-checkbox-root',
  setup(def) {
    // P-SHADCN-CHECKBOX-BASE-INHERITANCE: Base remains the only checked/mixed,
    // focus, activation and external-label owner.
    const checkboxState = asCheckboxRoot().stateHandles;
    if (!checkboxState) {
      throw new Error(
        '[shadcn-checkbox-root] asCheckboxRoot must project Checkbox root state handles.'
      );
    }
    const { checked, indeterminate, disabled, focusVisible } = checkboxState;
    const style = setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: SHADCN_STYLE_IDS,
    });
    def.feedback.style.use(tw('shrink-0 outline-none select-none'));
    // These two fills are identical in every profile. Keep them free of the
    // private style selector so Base's checked/mixed Web state lowering still
    // paints with the initial state rather than a later profile render.
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground border-primary')),
    });
    def.rule({
      when: (w) => w.state(indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground border-primary')),
    });
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(CHECKBOX_SURFACE[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(CHECKBOX_FOCUS[profile])),
      });
    }
    // Shared component-level disabled treatment from bases/base/ui/checkbox.tsx.
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
    for (const profile of ['new-york-v4', 'vega', 'nova', 'maia', 'lyra', 'mira'] as const) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            w.state(checked).eq(false),
            w.state(indeterminate).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw('bg-input/30')),
      });
    }
    // Base Checkbox has no Field-invalid fact. Upstream aria-invalid and
    // wrapping field-label selectors remain unclaimed rather than adding a
    // validator, raw aria prop, or ancestor selector to this semantic owner.
    // Its modern upstream after:-inset-x-3/-inset-y-2 hit extension is also not
    // silently acquired by this standalone projection.
  },
});

export default checkboxRoot;
