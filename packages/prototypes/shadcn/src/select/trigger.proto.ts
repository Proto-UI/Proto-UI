import { definePrototype, type RendererHandle, tw } from '@proto.ui/core';
import { asSelectTrigger } from '@proto.ui/prototypes-base/select';
import type { ShadcnSelectTriggerExposes, ShadcnSelectTriggerProps } from './types';

function renderChevron(renderer: Pick<RendererHandle<any>, 'svg' | 'el'>) {
  return renderer.el(
    'span',
    { style: tw('pointer-events-none flex shrink-0 items-center opacity-50') },
    renderer.svg.root(
      {
        viewBox: '0 0 24 24',
        width: 16,
        height: 16,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      renderer.svg.path({ d: 'm6 9 6 6 6-6' })
    )
  );
}

const selectTrigger = definePrototype<ShadcnSelectTriggerProps, ShadcnSelectTriggerExposes>({
  name: 'shadcn-select-trigger',
  setup(def) {
    // P-SHADCN-SELECT-TRIGGER-SIZE-PROP
    def.props.define({
      size: { type: 'enum', empty: 'fallback', options: ['sm', 'default'] },
    });
    def.props.setDefaults({ size: 'default' });

    // P-SHADCN-SELECT-TRIGGER-BASE-INHERITANCE,
    // P-SHADCN-SELECT-TRIGGER-CURRENT-BASE-DEVIATIONS
    const state = asSelectTrigger().stateHandles;
    if (!state) {
      throw new Error('[shadcn-select-trigger] Select Trigger must project command states.');
    }
    const { disabled, hovered, focusVisible, pressed, placeholder } = state;

    // P-SHADCN-SELECT-TRIGGER-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(
      tw(
        'flex items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-colors outline-none select-none'
      )
    );
    // P-SHADCN-SELECT-TRIGGER-STATE-DRIVEN-STYLES
    def.rule({
      when: (w) => w.prop('size').eq('default'),
      intent: (i) => i.feedback.style.use(tw('h-9')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('sm'),
      intent: (i) => i.feedback.style.use(tw('h-8')),
    });
    def.rule({
      when: (w) => w.state(placeholder).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-input/70 translate-y-px')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });

    // P-SHADCN-SELECT-TRIGGER-CHEVRON
    return (renderer) => [renderer.r.slot(), renderChevron(renderer)];
  },
});

/** P-SHADCN-SELECT-TRIGGER-DIRECT-ENTRY; parity is bounded by P-SHADCN-SELECT-TRIGGER-COMPATIBILITY-SUBSET. */

export default selectTrigger;
