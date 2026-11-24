import { definePrototype, tw } from '@proto.ui/core';
import { asToolbarButton } from '@proto.ui/prototypes-base/toolbar';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection, type ShadcnStyleId } from '../style-scope';
import { setupCollectionHover } from './action-visual';
import type {
  ShadcnToolbarButtonExposes,
  ShadcnToolbarButtonProps,
  ShadcnToolbarButtonSize,
} from './types';

const BUTTON_PROFILE = {
  vega: 'rounded-md border border-transparent bg-clip-padding text-sm font-medium',
  nova: 'rounded-lg border border-transparent bg-clip-padding text-sm font-medium',
  maia: 'rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  lyra: 'rounded-none border border-transparent bg-clip-padding text-xs font-medium',
  mira: 'rounded-md border border-transparent bg-clip-padding text-xs leading-relaxed font-medium',
  luma: 'rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  sera: 'rounded-none border border-transparent bg-clip-padding text-xs font-semibold uppercase tracking-widest',
  rhea: 'rounded-[var(--pui-radius-2xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'new-york-v4': 'rounded-md border border-transparent text-sm font-medium',
} as const satisfies Record<ShadcnStyleId, string>;

const BUTTON_SIZES: Record<ShadcnStyleId, Record<ShadcnToolbarButtonSize, string>> = {
  vega: {
    default: 'h-9 gap-1.5 px-2.5',
    sm: 'h-8 gap-1 px-2.5',
    lg: 'h-10 gap-1.5 px-3',
    icon: 'size-9 p-0',
  },
  nova: {
    default: 'h-8 gap-1.5 px-2.5',
    sm: 'h-7 gap-1 px-2.5 text-[0.8rem]',
    lg: 'h-9 gap-1.5 px-3',
    icon: 'size-8 p-0',
  },
  maia: {
    default: 'h-9 gap-1.5 px-3',
    sm: 'h-8 gap-1 px-3',
    lg: 'h-10 gap-1.5 px-4',
    icon: 'size-9 p-0',
  },
  lyra: {
    default: 'h-8 gap-1.5 px-2.5',
    sm: 'h-7 gap-1 px-2.5',
    lg: 'h-9 gap-1.5 px-3',
    icon: 'size-8 p-0',
  },
  mira: {
    default: 'h-7 gap-1 px-2',
    sm: 'h-6 gap-1 px-2',
    lg: 'h-8 gap-1 px-2.5',
    icon: 'size-7 p-0',
  },
  luma: {
    default: 'h-9 gap-1.5 px-3',
    sm: 'h-8 gap-1 px-3',
    lg: 'h-10 gap-1.5 px-4',
    icon: 'size-9 p-0',
  },
  sera: {
    default: 'h-10 gap-1.5 px-6',
    sm: 'h-9 gap-1 px-4',
    lg: 'h-11 gap-1.5 px-8',
    icon: 'size-10 p-0',
  },
  rhea: {
    default: 'h-8 gap-1.5 px-3',
    sm: 'h-7 gap-1 px-3',
    lg: 'h-9 gap-1.5 px-4',
    icon: 'size-8 p-0',
  },
  'new-york-v4': {
    default: 'h-9 gap-2 px-4 py-2',
    sm: 'h-8 gap-1.5 px-3',
    lg: 'h-10 gap-2 px-6',
    icon: 'size-9 p-0',
  },
};

const BUTTON_FOCUS = {
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-1 ring-ring/50',
  mira: 'border-ring ring-2 ring-ring/30',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-2 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
  'new-york-v4': 'border-ring ring-3 ring-ring/50',
} as const satisfies Record<ShadcnStyleId, string>;

const OUTLINE_REST = {
  vega: 'border-border bg-background text-foreground shadow-xs',
  nova: 'border-border bg-background text-foreground',
  maia: 'border-border bg-input/30 text-foreground',
  lyra: 'border-border bg-background text-foreground',
  mira: 'border-border bg-transparent text-foreground',
  luma: 'border-border bg-background text-foreground',
  sera: 'border-border bg-transparent text-foreground',
  rhea: 'border-border bg-background text-foreground',
  'new-york-v4': 'border-border bg-background text-foreground shadow-xs',
} as const satisfies Record<ShadcnStyleId, string>;

export default definePrototype<ShadcnToolbarButtonProps, ShadcnToolbarButtonExposes>({
  name: 'shadcn-toolbar-button',
  modules: asToolbarButton.modules,
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        options: ['ghost', 'outline', 'secondary', 'default', 'destructive'],
        empty: 'fallback',
      },
      size: {
        type: 'enum',
        options: ['default', 'sm', 'lg', 'icon'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({ variant: 'ghost', size: 'default' });

    const behavior = asToolbarButton();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toolbar] Button state unavailable.');

    const style = setupShadcnStyleSelection(def, 'rhea');
    const hovered = setupCollectionHover(def, state.disabled);
    const pressed = def.state.bool('toolbarPointerPressed', false);
    const clearPressed = () => pressed.set(false, 'toolbar pointer press reset');

    def.event.on('pointer.down', () => {
      if (!state.disabled.get()) pressed.set(true, 'toolbar pointer press down');
    });
    def.event.on('pointer.up', clearPressed);
    def.event.on('pointer.leave', clearPressed);
    def.event.on('pointer.cancel', clearPressed);
    def.lifecycle.onUnmounted(clearPressed);
    if ('watch' in state.disabled) {
      state.disabled.watch((_run, event) => {
        if (event.type === 'next' && event.next) clearPressed();
      });
    }

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });

    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(BUTTON_PROFILE[profile])),
      });
      for (const size of ['default', 'sm', 'lg', 'icon'] as const) {
        def.rule({
          when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq(size)),
          intent: (i) => i.feedback.style.use(tw(BUTTON_SIZES[profile][size])),
        });
      }

      // Variant: ghost (default)
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('ghost')),
        intent: (i) => i.feedback.style.use(tw('bg-transparent text-foreground')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('ghost'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-foreground'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('ghost'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(tw(profile === 'new-york-v4' ? 'bg-accent/50' : 'bg-muted/50')),
      });

      // Variant: outline
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('outline')),
        intent: (i) => i.feedback.style.use(tw(OUTLINE_REST[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('outline'),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'maia' || profile === 'mira'
                ? 'bg-input/30'
                : profile === 'luma' || profile === 'rhea' || profile === 'sera'
                  ? 'bg-transparent'
                  : 'bg-input/30 border-input'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('outline'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'bg-accent text-accent-foreground'
                : profile === 'maia' || profile === 'mira'
                  ? 'bg-input/50 text-foreground'
                  : 'bg-muted text-foreground'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('outline'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'luma' || profile === 'rhea' || profile === 'sera'
                ? 'bg-input/30'
                : 'bg-input/50'
            )
          ),
      });

      // Variant: default (primary)
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('default')),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('default'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(tw(profile === 'new-york-v4' ? 'bg-primary/90' : 'bg-primary/80')),
      });

      // Variant: secondary
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('secondary')),
        intent: (i) => i.feedback.style.use(tw('bg-secondary text-secondary-foreground')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('secondary'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw('bg-secondary/80')),
      });

      // Variant: destructive
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('destructive')),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'bg-destructive text-white'
                : 'bg-destructive/10 text-destructive'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('destructive'),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(profile === 'new-york-v4' ? 'bg-destructive/60' : 'bg-destructive/20')
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('destructive'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(profile === 'new-york-v4' ? 'bg-destructive/90' : 'bg-destructive/20')
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.prop('variant').eq('destructive'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(profile === 'new-york-v4' ? 'bg-destructive/90' : 'bg-destructive/30')
          ),
      });

      // Press feedback (modern styles, guarded by reducedMotion)
      if (profile !== 'new-york-v4') {
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(pressed).eq(true),
              w.state(state.disabled).eq(false),
              w.not(w.meta('preference.reducedMotion').eq('reduce'))
            ),
          intent: (i) => i.feedback.style.use(tw('translate-y-px')),
        });
      }

      // Focus ring per profile
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(BUTTON_FOCUS[profile])),
      });
    }

    def.rule({
      when: (w) => w.all(w.state(state.focusVisible).eq(true), w.prop('variant').eq('destructive')),
      intent: (i) => i.feedback.style.use(tw('border-destructive/40 ring-destructive/20')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.focusVisible).eq(true),
          w.prop('variant').eq('destructive'),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
    return behavior.render;
  },
});
