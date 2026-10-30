import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asRadioGroupItem } from '@proto.ui/prototypes-base/radio-group';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_SCOPE,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
} from '../style-scope';
import { RADIO_GROUP_VISUAL } from './visual';
import type { ShadcnRadioGroupItemExposes, ShadcnRadioGroupItemProps } from './types';

// Eight modern `.cn-radio-group-item` recipes at fixed upstream 3d98900e.
// border is a common component class in bases/base/ui/radio-group.tsx.
const ITEM_SURFACE: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4':
    'size-4 rounded-full border-input text-primary shadow-xs transition-[color,box-shadow]',
  vega: 'size-4 rounded-full border-input bg-transparent',
  nova: 'size-4 rounded-full border-input bg-transparent',
  maia: 'size-4 rounded-full border-input bg-transparent',
  lyra: 'size-4 rounded-full border-input bg-transparent',
  mira: 'size-4 rounded-full border-input bg-transparent',
  luma: 'size-4 rounded-full border-transparent bg-input/90',
  sera: 'size-4.5 rounded-full border-input bg-transparent',
  rhea: 'size-4 rounded-[var(--pui-radius-2xl)] border-transparent bg-input/90',
};
const ITEM_CHECKED: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'text-primary',
  vega: 'border-primary bg-primary text-primary-foreground',
  nova: 'border-primary bg-primary text-primary-foreground',
  maia: 'border-primary bg-primary text-primary-foreground',
  lyra: 'border-primary bg-primary text-primary-foreground',
  mira: 'border-primary bg-primary text-primary-foreground',
  luma: 'bg-primary text-primary-foreground',
  sera: 'border-foreground',
  rhea: 'bg-primary text-primary-foreground',
};
const ITEM_FOCUS: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'border-ring ring-[3px] ring-ring/50',
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-3 ring-ring/50',
  mira: 'border-ring ring-3 ring-ring/50',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-2 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
};

const radioGroupItem = definePrototype<ShadcnRadioGroupItemProps, ShadcnRadioGroupItemExposes>({
  name: 'shadcn-radio-group-item',
  setup(def) {
    const state = asRadioGroupItem().stateHandles;
    if (!state) {
      throw new Error(
        '[shadcn-radio-group-item] asRadioGroupItem must project Item state handles.'
      );
    }
    const style = setupShadcnStyleSelection(def, 'nova', { supportedStyles: SHADCN_STYLE_IDS });
    def.context.provide(RADIO_GROUP_VISUAL, { style: 'nova' });
    const syncVisual = (run: RunHandle<ShadcnRadioGroupItemProps>) => {
      if (run.context.tryRead(RADIO_GROUP_VISUAL)?.style !== style.get())
        run.context.update(RADIO_GROUP_VISUAL, { style: style.get() });
    };
    def.context.trySubscribe(RADIO_GROUP_VISUAL);
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, syncVisual);
    def.props.watchRaw(['styleProfile'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.lifecycle.onUpdated(syncVisual);
    def.feedback.style.use(
      tw('flex items-center justify-center aspect-square shrink-0 border outline-none')
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(ITEM_SURFACE[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.checked).eq(true)),
        intent: (i) => i.feedback.style.use(tw(ITEM_CHECKED[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(ITEM_FOCUS[profile])),
      });
    }
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
    for (const profile of ['new-york-v4', 'vega', 'nova', 'maia', 'lyra', 'mira'] as const) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            // New York remains outlined, even while checked. Modern styles use
            // a filled primary surface, so their unfilled dark tint is guarded.
            ...(profile === 'new-york-v4' ? [] : [w.state(state.checked).eq(false)])
          ),
        intent: (i) => i.feedback.style.use(tw('bg-input/30')),
      });
    }
    // Base Radio Group explicitly defers Field-invalid/form semantics. No raw
    // aria-invalid prop or validator is invented for source-only variants.
    // Upstream wrapping-label ring clears and expanded hit targets remain gaps.
  },
});

export default radioGroupItem;
