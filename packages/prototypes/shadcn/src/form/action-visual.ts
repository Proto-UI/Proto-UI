import { tw, type DefHandle, type State } from '@proto.ui/core';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS } from '../style-scope';
import type { ShadcnFormActionProps } from './types';

/** Pinned default-size Button paint, not asButton or a second activation owner. */
const ACTION_SURFACE = {
  vega: 'h-9 gap-1.5 px-2.5 rounded-md border border-transparent bg-clip-padding text-sm font-medium',
  nova: 'h-8 gap-1.5 px-2.5 rounded-lg border border-transparent bg-clip-padding text-sm font-medium',
  maia: 'h-9 gap-1.5 px-3 rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  lyra: 'h-8 gap-1.5 px-2.5 rounded-none border border-transparent bg-clip-padding text-xs font-medium',
  mira: 'h-7 gap-1 px-2 rounded-md border border-transparent bg-clip-padding text-xs leading-relaxed font-medium',
  luma: 'h-9 gap-1.5 px-3 rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  sera: 'h-10 gap-1.5 px-6 rounded-none border border-transparent bg-clip-padding text-xs font-semibold uppercase tracking-widest',
  rhea: 'h-8 gap-1.5 px-3 rounded-[var(--pui-radius-2xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'new-york-v4': 'h-9 gap-2 px-4 py-2 rounded-md text-sm font-medium',
} as const;
const ACTION_FOCUS = {
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-1 ring-ring/50',
  mira: 'border-ring ring-2 ring-ring/30',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-2 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
  'new-york-v4': 'border-ring ring-3 ring-ring/50',
} as const;

export function setupFormActionVisual(
  def: DefHandle<ShadcnFormActionProps>,
  state: {
    hovered: State<boolean>;
    focusVisible: State<boolean>;
    pressed: State<boolean>;
    disabled: State<boolean>;
  },
  action: 'submit' | 'reset'
) {
  const style = setupShadcnStyleSelection(def, 'nova');
  def.feedback.style.use(
    tw(
      'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none'
    )
  );
  def.feedback.style.use(
    tw(
      action === 'submit'
        ? 'bg-primary text-primary-foreground'
        : 'bg-secondary text-secondary-foreground'
    )
  );
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(ACTION_SURFACE[profile])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(ACTION_FOCUS[profile])),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            action === 'submit'
              ? profile === 'new-york-v4'
                ? 'bg-primary/90'
                : 'bg-primary/80'
              : profile === 'new-york-v4'
                ? 'bg-secondary/80'
                : 'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]'
          )
        ),
    });
    if (profile !== 'new-york-v4') {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.pressed).eq(true)),
        intent: (i) => i.feedback.style.use(tw('translate-y-px')),
      });
    }
  }
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
  });
  return style;
}
