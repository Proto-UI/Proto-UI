import { tw, type DefHandle, type State, type StyleHandle } from '@proto.ui/core';
import type { RunHandle } from '@proto.ui/core';
import { CAROUSEL_CONTEXT } from '@proto.ui/prototypes-base/carousel';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

export type ShadcnCarouselNavigationVariant = 'outline' | 'default' | 'secondary' | 'ghost';
export type ShadcnCarouselNavigationSize = 'icon-sm' | 'icon' | 'sm' | 'default';

export type ShadcnCarouselNavigationProps = ShadcnStyleProps & {
  variant?: ShadcnCarouselNavigationVariant;
  size?: ShadcnCarouselNavigationSize;
};

export function setupCarouselAxis<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  const axis = def.state.string('shadcnCarouselAxis', 'horizontal');
  const sync = (run: RunHandle<Props>) =>
    axis.set(
      run.context.tryRead(CAROUSEL_CONTEXT)?.orientation ?? 'horizontal',
      'carousel owner axis'
    );
  def.context.trySubscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  return axis;
}

function setupCarouselDirection<Props extends ShadcnStyleProps, Exposes = Record<string, unknown>>(
  def: DefHandle<Props, Exposes>
) {
  const direction = def.state.string('shadcnCarouselDirection', 'ltr');
  const sync = (run: RunHandle<Props>) =>
    direction.set(
      run.context.tryRead(CAROUSEL_CONTEXT)?.direction ?? 'ltr',
      'carousel owner direction'
    );
  def.context.trySubscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  return direction;
}

// Explicit .cn-carousel-{previous,next} and Button outline/icon-sm recipes
// at shadcn-ui/ui@3d98900e. The independent New York control fixes size-8.
const SIZE: Record<ShadcnStyleId, StyleHandle> = {
  vega: tw('size-8 rounded-full text-sm font-medium'),
  nova: tw('size-7 rounded-full text-sm font-medium'),
  maia: tw('size-8 rounded-full text-sm font-medium'),
  lyra: tw('size-7 rounded-none text-xs font-medium'),
  mira: tw('size-6 rounded-full text-xs leading-relaxed font-medium'),
  luma: tw('size-8 rounded-full text-sm font-medium'),
  sera: tw('size-9 rounded-none text-xs font-semibold uppercase tracking-widest'),
  rhea: tw('size-7 rounded-[var(--pui-radius-2xl)] text-sm font-medium'),
  'new-york-v4': tw('size-8 rounded-full text-sm font-medium'),
};

const ICON_SIZE: Record<ShadcnStyleId, StyleHandle> = {
  vega: tw('size-9 rounded-full text-sm font-medium'),
  nova: tw('size-8 rounded-full text-sm font-medium'),
  maia: tw('size-9 rounded-full text-sm font-medium'),
  lyra: tw('size-8 rounded-none text-xs font-medium'),
  mira: tw('size-7 rounded-full text-xs leading-relaxed font-medium'),
  luma: tw('size-9 rounded-full text-sm font-medium'),
  sera: tw('size-10 rounded-none text-xs font-semibold uppercase tracking-widest'),
  rhea: tw('size-8 rounded-[var(--pui-radius-2xl)] text-sm font-medium'),
  'new-york-v4': tw('size-9 rounded-full text-sm font-medium'),
};

type ButtonFacts = {
  hovered: State<boolean>;
  pressed: State<boolean>;
  focusVisible: State<boolean>;
  disabled: State<boolean>;
};

export function setupCarouselNavigationPaint<Exposes = Record<string, unknown>>(
  def: DefHandle<ShadcnCarouselNavigationProps, Exposes>,
  state: ButtonFacts,
  side: 'previous' | 'next'
) {
  def.props.define({
    variant: {
      type: 'enum',
      options: ['outline', 'default', 'secondary', 'ghost'],
      empty: 'fallback',
    },
    size: {
      type: 'enum',
      options: ['icon-sm', 'icon', 'sm', 'default'],
      empty: 'fallback',
    },
  });
  def.props.setDefaults({
    variant: 'outline',
    size: 'icon-sm',
  });
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  const axis = setupCarouselAxis(def);
  const direction = setupCarouselDirection(def);
  def.feedback.style.use(
    tw(
      'absolute inline-flex shrink-0 items-center justify-center border border-border bg-clip-padding text-foreground outline-none select-none cursor-pointer transition-all'
    )
  );
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq('icon-sm')),
      intent: (i) => i.feedback.style.use(SIZE[profile]),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq('icon')),
      intent: (i) => i.feedback.style.use(ICON_SIZE[profile]),
    });
  }
  def.rule({
    when: (w) => w.prop('size').eq('sm'),
    intent: (i) => i.feedback.style.use(tw('h-8 px-2.5 rounded-md text-xs font-medium')),
  });
  def.rule({
    when: (w) => w.prop('size').eq('default'),
    intent: (i) => i.feedback.style.use(tw('h-9 px-3 rounded-md text-sm font-medium')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(axis).eq('horizontal'),
        w.state(direction).eq('ltr'),
        w.state(style).eq('new-york-v4')
      ),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-1/2 left-[-3rem] -translate-y-1/2')
          : tw('top-1/2 right-[-3rem] -translate-y-1/2')
      ),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(axis).eq('horizontal'),
        w.state(direction).eq('rtl'),
        w.state(style).eq('new-york-v4')
      ),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-1/2 right-[-3rem] -translate-y-1/2')
          : tw('top-1/2 left-[-3rem] -translate-y-1/2')
      ),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(axis).eq('horizontal'),
        w.state(direction).eq('ltr'),
        w.not(w.state(style).eq('new-york-v4'))
      ),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-0 bottom-0 left-[-3rem] my-auto')
          : tw('top-0 bottom-0 right-[-3rem] my-auto')
      ),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(axis).eq('horizontal'),
        w.state(direction).eq('rtl'),
        w.not(w.state(style).eq('new-york-v4'))
      ),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-0 bottom-0 right-[-3rem] my-auto')
          : tw('top-0 bottom-0 left-[-3rem] my-auto')
      ),
  });
  def.rule({
    when: (w) => w.not(w.state(style).eq('new-york-v4')),
    intent: (i) => i.feedback.style.use(tw('touch-manipulation')),
  });
  def.rule({
    when: (w) => w.state(axis).eq('vertical'),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-[-3rem] left-1/2 -translate-x-1/2')
          : tw('bottom-[-3rem] left-1/2 -translate-x-1/2')
      ),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.any(
          w.state(style).eq('vega'),
          w.state(style).eq('nova'),
          w.state(style).eq('lyra'),
          w.state(style).eq('luma'),
          w.state(style).eq('rhea'),
          w.state(style).eq('new-york-v4')
        )
      ),
    intent: (i) => i.feedback.style.use(tw('bg-background')),
  });
  def.rule({
    when: (w) => w.all(w.prop('variant').eq('outline'), w.state(style).eq('maia')),
    intent: (i) => i.feedback.style.use(tw('bg-input/30')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.any(w.state(style).eq('mira'), w.state(style).eq('sera'))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-transparent')),
  });
  def.rule({
    when: (w) => w.all(w.prop('variant').eq('outline'), w.state(style).eq('vega')),
    intent: (i) => i.feedback.style.use(tw('shadow-xs')),
  });
  def.rule({
    when: (w) => w.prop('variant').eq('default'),
    intent: (i) =>
      i.feedback.style.use(tw('border-transparent bg-primary text-primary-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('default'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-primary/90')),
  });
  def.rule({
    when: (w) => w.prop('variant').eq('secondary'),
    intent: (i) =>
      i.feedback.style.use(tw('border-transparent bg-secondary text-secondary-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('secondary'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-secondary/80')),
  });
  def.rule({
    when: (w) => w.prop('variant').eq('ghost'),
    intent: (i) =>
      i.feedback.style.use(tw('border-transparent bg-transparent text-foreground shadow-none')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('ghost'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.not(
          w.any(
            w.state(style).eq('maia'),
            w.state(style).eq('mira'),
            w.state(style).eq('new-york-v4')
          )
        )
      ),
    intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.any(w.state(style).eq('maia'), w.state(style).eq('mira'))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/50 text-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.state(style).eq('new-york-v4')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.meta('colorScheme').eq('dark'),
        w.any(
          w.state(style).eq('vega'),
          w.state(style).eq('nova'),
          w.state(style).eq('lyra'),
          w.state(style).eq('new-york-v4')
        )
      ),
    intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.meta('colorScheme').eq('dark'),
        w.state(style).eq('mira')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/30')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.meta('colorScheme').eq('dark'),
        w.any(w.state(style).eq('luma'), w.state(style).eq('rhea'))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-transparent')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.meta('colorScheme').eq('dark'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.any(
          w.state(style).eq('vega'),
          w.state(style).eq('nova'),
          w.state(style).eq('lyra'),
          w.state(style).eq('new-york-v4')
        )
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/50')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.prop('variant').eq('outline'),
        w.meta('colorScheme').eq('dark'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.any(w.state(style).eq('luma'), w.state(style).eq('rhea'), w.state(style).eq('sera'))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/30')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.focusVisible).eq(true),
        w.state(state.disabled).eq(false),
        w.state(style).eq('lyra')
      ),
    intent: (i) =>
      i.feedback.style.use(tw('border-ring ring-1 ring-ring/50 forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.focusVisible).eq(true),
        w.state(state.disabled).eq(false),
        w.any(w.state(style).eq('mira'), w.state(style).eq('sera'))
      ),
    intent: (i) =>
      i.feedback.style.use(tw('border-ring ring-2 ring-ring/30 forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.focusVisible).eq(true),
        w.state(state.disabled).eq(false),
        w.any(
          w.state(style).eq('vega'),
          w.state(style).eq('nova'),
          w.state(style).eq('maia'),
          w.state(style).eq('new-york-v4')
        )
      ),
    intent: (i) =>
      i.feedback.style.use(tw('border-ring ring-3 ring-ring/50 forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.focusVisible).eq(true),
        w.state(state.disabled).eq(false),
        w.any(w.state(style).eq('luma'), w.state(style).eq('rhea'))
      ),
    intent: (i) =>
      i.feedback.style.use(tw('border-ring ring-3 ring-ring/30 forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.pressed).eq(true),
        w.state(state.disabled).eq(false),
        w.not(w.state(style).eq('new-york-v4'))
      ),
    intent: (i) => i.feedback.style.use(tw('translate-y-px')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none')),
  });
}
