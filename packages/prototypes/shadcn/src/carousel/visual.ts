import { tw, type DefHandle, type ObservedStateHandle, type StyleHandle } from '@proto.ui/core';
import type { RunHandle } from '@proto.ui/core';
import { CAROUSEL_CONTEXT } from '@proto.ui/prototypes-base/carousel';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

export function setupCarouselAxis(def: DefHandle<ShadcnStyleProps>) {
  const axis = def.state.string('shadcnCarouselAxis', 'horizontal');
  const sync = (run: RunHandle<ShadcnStyleProps>) =>
    axis.set(run.context.read(CAROUSEL_CONTEXT).orientation, 'carousel owner axis');
  def.context.subscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  return axis;
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
  rhea: tw('size-7 rounded-2xl text-sm font-medium'),
  'new-york-v4': tw('size-8 rounded-full text-sm font-medium'),
};

type ButtonFacts = {
  hovered: ObservedStateHandle<boolean, any>;
  pressed: ObservedStateHandle<boolean, any>;
  focusVisible: ObservedStateHandle<boolean, any>;
  disabled: ObservedStateHandle<boolean, any>;
};

export function setupCarouselNavigationPaint(
  def: DefHandle<ShadcnStyleProps>,
  state: ButtonFacts,
  side: 'previous' | 'next'
) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  const axis = setupCarouselAxis(def);
  def.feedback.style.use(
    tw(
      'absolute inline-flex shrink-0 items-center justify-center border border-border bg-clip-padding text-foreground outline-none select-none transition-all'
    )
  );
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(SIZE[profile]),
    });
  }
  def.rule({
    when: (w) => w.state(axis).eq('horizontal'),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-1/2 left-[-3rem] -translate-y-1/2')
          : tw('top-1/2 right-[-3rem] -translate-y-1/2')
      ),
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
      w.any(
        w.state(style).eq('vega'),
        w.state(style).eq('nova'),
        w.state(style).eq('lyra'),
        w.state(style).eq('luma'),
        w.state(style).eq('rhea'),
        w.state(style).eq('new-york-v4')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-background')),
  });
  def.rule({
    when: (w) => w.state(style).eq('maia'),
    intent: (i) => i.feedback.style.use(tw('bg-input/30')),
  });
  def.rule({
    when: (w) => w.any(w.state(style).eq('mira'), w.state(style).eq('sera')),
    intent: (i) => i.feedback.style.use(tw('bg-transparent')),
  });
  def.rule({
    when: (w) => w.state(style).eq('vega'),
    intent: (i) => i.feedback.style.use(tw('shadow-xs')),
  });
  def.rule({
    when: (w) =>
      w.all(
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
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.any(w.state(style).eq('maia'), w.state(style).eq('mira'))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/50 text-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.state(style).eq('new-york-v4')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
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
    when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(style).eq('mira')),
    intent: (i) => i.feedback.style.use(tw('bg-input/30')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.meta('colorScheme').eq('dark'),
        w.any(w.state(style).eq('luma'), w.state(style).eq('rhea'))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-transparent')),
  });
  def.rule({
    when: (w) =>
      w.all(
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
