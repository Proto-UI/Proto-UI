import { definePrototype, type RendererHandle, tw } from '@proto.ui/core';
import { asSelectTrigger } from '@proto.ui/prototypes-base/select';
import type { BrutalistSelectTriggerExposes, BrutalistSelectTriggerProps } from './types';

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

const selectTrigger = definePrototype<BrutalistSelectTriggerProps, BrutalistSelectTriggerExposes>({
  name: 'brutalist-select-trigger',
  setup(def) {
    // P-BRUTALIST-SELECT-TRIGGER-SIZE-PROP: public `size` enum `sm | default`; P-BRUTALIST-SELECT-TRIGGER-DEFAULTS restores `default`.
    def.props.define({
      size: { type: 'enum', empty: 'fallback', options: ['sm', 'default'] },
    });
    def.props.setDefaults({ size: 'default' });

    // P-BRUTALIST-SELECT-TRIGGER-BASE-INHERITANCE: inherit Base Select Trigger states once.
    // Resting surface (VISUAL-GRAMMAR) + STATE-DRIVEN interaction rules below.
    const state = asSelectTrigger().stateHandles;
    if (!state) {
      throw new Error('[brutalist-select-trigger] Select Trigger must project command states.');
    }
    const { disabled, hovered, focusVisible, pressed, placeholder } = state;

    // P-BRUTALIST-SELECT-TRIGGER-VISUAL-GRAMMAR: resting combobox surface (square, border-2 black, hard shadow-3, flat bg-secondary-background fill).
    def.feedback.style.use(
      tw(
        'flex items-center justify-between gap-2 rounded-none border-2 border-black bg-secondary-background px-3 py-2 text-sm whitespace-nowrap shadow-[3px_3px_0_0_#000] outline-none select-none'
      )
    );
    // P-BRUTALIST-SELECT-TRIGGER-INTERACTION rules (size→h tokens, placeholder→muted fg, hover lift, press sink, focus-visible ring, disabled fade).
    def.rule({
      when: (w) => w.prop('size').eq('default'),
      intent: (i) => i.feedback.style.use(tw('h-9')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('sm'),
      intent: (i) => i.feedback.style.use(tw('h-8')),
    });
    // P-BRUTALIST-SELECT-TRIGGER-PLACEHOLDER-STATE: placeholder active → text-muted-foreground.
    def.rule({
      when: (w) => w.state(placeholder).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
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

    // P-BRUTALIST-SELECT-TRIGGER-CHEVRON: render trailing chevron icon (16x16 path m6 9 6 6 6-6) with pointer-events-none.
    return (renderer) => [renderer.r.slot(), renderChevron(renderer)];
  },
});

// P-BRUTALIST-SELECT-TRIGGER-ENTRY: `brutalist-select-trigger` is the only public Select trigger entry in this slice.

export default selectTrigger;
