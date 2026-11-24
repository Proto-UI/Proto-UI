import { tw, type DefHandle, type State } from '@proto.ui/core';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS, type ShadcnStyleId } from '../style-scope';
import type { ShadcnFormActionProps, ShadcnFormActionSize, ShadcnFormActionVariant } from './types';

/** Pinned Button paint across styleProfiles; Base Form remains the sole action owner. */
const ACTION_SURFACE: Record<`${ShadcnStyleId}-${ShadcnFormActionSize}`, string> = {
  'vega-default':
    'h-9 gap-1.5 px-2.5 rounded-md border border-transparent bg-clip-padding text-sm font-medium',
  'vega-sm':
    'h-8 gap-1 px-2.5 rounded-md border border-transparent bg-clip-padding text-sm font-medium',
  'vega-lg':
    'h-10 gap-1.5 px-2.5 rounded-md border border-transparent bg-clip-padding text-sm font-medium',
  'nova-default':
    'h-8 gap-1.5 px-2.5 rounded-lg border border-transparent bg-clip-padding text-sm font-medium',
  'nova-sm':
    'h-7 gap-1 px-2.5 rounded-md border border-transparent bg-clip-padding text-xs font-medium',
  'nova-lg':
    'h-9 gap-1.5 px-2.5 rounded-lg border border-transparent bg-clip-padding text-sm font-medium',
  'maia-default':
    'h-9 gap-1.5 px-3 rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'maia-sm':
    'h-8 gap-1 px-3 rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'maia-lg':
    'h-10 gap-1.5 px-4 rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'lyra-default':
    'h-8 gap-1.5 px-2.5 rounded-none border border-transparent bg-clip-padding text-xs font-medium',
  'lyra-sm':
    'h-7 gap-1 px-2.5 rounded-none border border-transparent bg-clip-padding text-xs font-medium',
  'lyra-lg':
    'h-9 gap-1.5 px-2.5 rounded-none border border-transparent bg-clip-padding text-xs font-medium',
  'mira-default':
    'h-7 gap-1 px-2 rounded-md border border-transparent bg-clip-padding text-xs leading-relaxed font-medium',
  'mira-sm':
    'h-6 gap-1 px-2 rounded-md border border-transparent bg-clip-padding text-xs leading-relaxed font-medium',
  'mira-lg':
    'h-8 gap-1 px-2.5 rounded-md border border-transparent bg-clip-padding text-xs leading-relaxed font-medium',
  'luma-default':
    'h-9 gap-1.5 px-3 rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'luma-sm':
    'h-8 gap-1 px-3 rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'luma-lg':
    'h-10 gap-1.5 px-4 rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'sera-default':
    'h-10 gap-1.5 px-6 rounded-none border border-transparent bg-clip-padding text-xs font-semibold uppercase tracking-widest',
  'sera-sm':
    'h-9 gap-1 px-4 rounded-none border border-transparent bg-clip-padding text-xs font-semibold uppercase tracking-widest',
  'sera-lg':
    'h-11 gap-1.5 px-8 rounded-none border border-transparent bg-clip-padding text-xs font-semibold uppercase tracking-widest',
  'rhea-default':
    'h-8 gap-1.5 px-3 rounded-[var(--pui-radius-2xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'rhea-sm':
    'h-7 gap-1 px-3 rounded-[var(--pui-radius-2xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'rhea-lg':
    'h-9 gap-1.5 px-4 rounded-[var(--pui-radius-2xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'new-york-v4-default': 'h-9 gap-2 px-4 py-2 rounded-md text-sm font-medium',
  'new-york-v4-sm': 'h-8 gap-1.5 px-3 rounded-md text-sm font-medium',
  'new-york-v4-lg': 'h-10 gap-2 px-6 rounded-md text-sm font-medium',
};

const ACTION_FOCUS: Record<ShadcnStyleId, string> = {
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-1 ring-ring/50',
  mira: 'border-ring ring-2 ring-ring/30',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-2 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
  'new-york-v4': 'border-ring ring-3 ring-ring/50',
};

const ACTION_OUTLINE: Record<ShadcnStyleId, string> = {
  vega: 'border-border bg-background text-foreground shadow-xs',
  nova: 'border-border bg-background text-foreground',
  maia: 'border-border bg-input/30 text-foreground',
  lyra: 'border-border bg-background text-foreground',
  mira: 'border-border bg-transparent text-foreground',
  luma: 'border-border bg-background text-foreground',
  sera: 'border-border bg-transparent text-foreground',
  rhea: 'border-border bg-background text-foreground',
  'new-york-v4': 'border border-border bg-background text-foreground shadow-xs',
};

const ACTION_OUTLINE_HOVER: Record<ShadcnStyleId, string> = {
  vega: 'bg-muted text-foreground',
  nova: 'bg-muted text-foreground',
  maia: 'bg-input/50 text-foreground',
  lyra: 'bg-muted text-foreground',
  mira: 'bg-input/50 text-foreground',
  luma: 'bg-muted text-foreground',
  sera: 'bg-muted text-foreground',
  rhea: 'bg-muted text-foreground',
  'new-york-v4': 'bg-accent text-accent-foreground',
};

const VARIANTS: readonly ShadcnFormActionVariant[] = [
  'default',
  'secondary',
  'outline',
  'destructive',
  'ghost',
];
const SIZES: readonly ShadcnFormActionSize[] = ['default', 'sm', 'lg'];

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
  def.props.define({
    variant: {
      type: 'enum',
      options: ['default', 'secondary', 'outline', 'destructive', 'ghost'],
      empty: 'fallback',
    },
    size: {
      type: 'enum',
      options: ['default', 'sm', 'lg'],
      empty: 'fallback',
    },
  });
  def.props.setDefaults({
    variant: action === 'submit' ? 'default' : 'secondary',
    size: 'default',
  });
  const style = setupShadcnStyleSelection(def, 'nova');
  def.feedback.style.use(
    tw(
      'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none cursor-pointer'
    )
  );
  def.rule({
    when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
    intent: (i) => i.feedback.style.use(tw('transition-none')),
  });

  // Base variant fills
  def.rule({
    when: (w) => w.prop('variant').eq('default'),
    intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
  });
  def.rule({
    when: (w) => w.prop('variant').eq('secondary'),
    intent: (i) => i.feedback.style.use(tw('bg-secondary text-secondary-foreground')),
  });
  def.rule({
    when: (w) => w.prop('variant').eq('ghost'),
    intent: (i) => i.feedback.style.use(tw('bg-transparent text-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(w.not(w.state(style).eq('new-york-v4')), w.prop('variant').eq('destructive')),
    intent: (i) => i.feedback.style.use(tw('bg-destructive/10 text-destructive')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('variant').eq('destructive')),
    intent: (i) => i.feedback.style.use(tw('bg-destructive text-destructive-foreground')),
  });

  for (const profile of SHADCN_STYLE_IDS) {
    for (const size of SIZES) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq(size)),
        intent: (i) => i.feedback.style.use(tw(ACTION_SURFACE[`${profile}-${size}`])),
      });
    }
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('outline')),
      intent: (i) => i.feedback.style.use(tw(ACTION_OUTLINE[profile])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(ACTION_FOCUS[profile])),
    });
    for (const variant of VARIANTS) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq(variant),
            w.state(state.hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              variant === 'default'
                ? profile === 'new-york-v4'
                  ? 'bg-primary/90'
                  : 'bg-primary/80'
                : variant === 'secondary'
                  ? profile === 'new-york-v4'
                    ? 'bg-secondary/80'
                    : 'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]'
                  : variant === 'outline'
                    ? ACTION_OUTLINE_HOVER[profile]
                    : variant === 'destructive'
                      ? profile === 'new-york-v4'
                        ? 'bg-destructive/90'
                        : 'bg-destructive/20'
                      : profile === 'new-york-v4'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-foreground'
            )
          ),
      });
    }
    if (profile !== 'new-york-v4') {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.pressed).eq(true),
            w.state(state.disabled).eq(false),
            w.not(w.meta('preference.reducedMotion').eq('reduce'))
          ),
        intent: (i) => i.feedback.style.use(tw('translate-y-px')),
      });
    }
  }

  // Dark mode refinements for outline, destructive, and ghost variants
  def.rule({
    when: (w) =>
      w.all(
        w.meta('colorScheme').eq('dark'),
        w.prop('variant').eq('outline'),
        w.not(w.state(style).eq('luma')),
        w.not(w.state(style).eq('rhea')),
        w.not(w.state(style).eq('sera'))
      ),
    intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.meta('colorScheme').eq('dark'),
        w.prop('variant').eq('outline'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/50')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.meta('colorScheme').eq('dark'),
        w.not(w.state(style).eq('new-york-v4')),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.meta('colorScheme').eq('dark'),
        w.not(w.state(style).eq('new-york-v4')),
        w.prop('variant').eq('destructive'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-destructive/30')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.meta('colorScheme').eq('dark'),
        w.state(style).eq('new-york-v4'),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-destructive/60')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.meta('colorScheme').eq('dark'),
        w.prop('variant').eq('ghost'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
  });
  def.rule({
    when: (w) => w.all(w.state(state.focusVisible).eq(true), w.prop('variant').eq('destructive')),
    intent: (i) => i.feedback.style.use(tw('border-destructive/40 ring-destructive/20')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.meta('colorScheme').eq('dark'),
        w.state(state.focusVisible).eq(true),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
  });

  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
  });
  return style;
}
