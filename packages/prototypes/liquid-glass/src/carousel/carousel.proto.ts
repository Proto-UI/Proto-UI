import {
  COMMAND_HOVER,
  COMMAND_PRESS,
  COMMAND_FOCUS,
  COMMAND_FOCUS_INSET,
  COMMAND_DISABLED,
} from '../interactive-surface';
import type {
  CarouselRootProps,
  CarouselRootExposes,
  CarouselViewportProps,
  CarouselViewportExposes,
  CarouselSlideProps,
  CarouselSlideExposes,
  CarouselPreviousProps,
  CarouselPreviousExposes,
  CarouselNextProps,
  CarouselNextExposes,
} from '@proto.ui/prototypes-base/carousel';
import { definePrototype, tw, type DefHandle, type RunHandle, type State } from '@proto.ui/core';
import {
  CAROUSEL_CONTEXT,
  asCarouselRoot,
  asCarouselViewport,
  asCarouselSlide,
  asCarouselPrevious,
  asCarouselNext,
} from '@proto.ui/prototypes-base/carousel';
export type * from '@proto.ui/prototypes-base/carousel';

export interface LiquidGlassCarouselNavigationProps extends CarouselPreviousProps {
  variant?: 'regular' | 'prominent';
  /** Auto enhances only when all live preference/support inputs are affirmative. */
  material?: 'auto' | 'opaque';
}

export type LiquidGlassCarouselPreviousProps = LiquidGlassCarouselNavigationProps;
export type LiquidGlassCarouselNextProps = LiquidGlassCarouselNavigationProps;

const FILLS = {
  regular: 'bg-secondary text-secondary-foreground',
  prominent: 'bg-primary text-primary-foreground',
};

function setupCarouselLayoutState<Props extends Record<string, any>, Exposes>(
  def: DefHandle<Props, Exposes>
) {
  const axis = def.state.string('liquidGlassCarouselAxis', 'horizontal');
  const direction = def.state.string('liquidGlassCarouselDirection', 'ltr');
  const sync = (run: RunHandle<Props>) => {
    const context = run.context.tryRead(CAROUSEL_CONTEXT);
    axis.set(context?.orientation ?? 'horizontal', 'liquid glass carousel axis');
    direction.set(context?.direction ?? 'ltr', 'liquid glass carousel direction');
  };
  def.context.trySubscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  return { axis, direction };
}

type ButtonStates = {
  hovered: State<boolean>;
  pressed: State<boolean>;
  focusVisible: State<boolean>;
  disabled: State<boolean>;
};

function setupLiquidGlassNavigation<Exposes = Record<string, unknown>>(
  def: DefHandle<LiquidGlassCarouselNavigationProps, Exposes>,
  states: ButtonStates,
  side: 'previous' | 'next'
) {
  def.props.define({
    variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
    material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
  });
  def.props.setDefaults({ variant: 'regular', material: 'auto' });

  const { axis, direction } = setupCarouselLayoutState(def);

  // Floating circular Liquid Glass chrome hovering above solid/media slide content.
  def.feedback.style.use(
    tw(
      'absolute z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-sm font-medium whitespace-nowrap select-none cursor-pointer shadow-sm'
    )
  );
  (Object.keys(FILLS) as Array<keyof typeof FILLS>).forEach((variant) => {
    def.rule({
      when: (w) => w.all(w.prop('variant').eq(variant), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(FILLS[variant])),
    });
  });

  def.rule({
    when: (w) => w.all(w.state(axis).eq('horizontal'), w.state(direction).eq('ltr')),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-0 bottom-0 left-3 my-auto')
          : tw('top-0 bottom-0 right-3 my-auto')
      ),
  });
  def.rule({
    when: (w) => w.all(w.state(axis).eq('horizontal'), w.state(direction).eq('rtl')),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-0 bottom-0 right-3 my-auto')
          : tw('top-0 bottom-0 left-3 my-auto')
      ),
  });
  def.rule({
    when: (w) => w.state(axis).eq('vertical'),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('left-0 right-0 top-3 mx-auto')
          : tw('left-0 right-0 bottom-3 mx-auto')
      ),
  });

  def.rule({
    when: (w) =>
      w.all(
        w.state(states.hovered).eq(true),
        w.state(states.pressed).eq(false),
        w.state(states.disabled).eq(false),
        w.state(states.focusVisible).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
  });

  // Explicit Liquid Glass optical intent with opaque fallback and preference-aware degradation.
  def.feedback.material.declare({
    version: 2,
    shape: { kind: 'rounded-rect', geometry: 'style' },
    source: { kind: 'in-app-backdrop' },
    fallback: { fill: 'style', foreground: 'style' },
  });
  for (const variant of ['regular', 'prominent'] as const)
    for (const phase of [false, true]) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('variant').eq(variant),
            w.prop('material').eq('auto'),
            w.state(states.disabled).eq(false),
            w.state(states.pressed).eq(phase)
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            variant: 'regular',
            ...(variant === 'prominent' ? { tint: 'style-fill' as const } : {}),
            deformation: { kind: 'press', phase: phase ? 'pressed' : 'rest', contact: 'pointer' },
          }),
      });
    }

  def.rule({
    when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
    intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
  });
  def.rule({
    when: (w) => w.state(states.focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
  });
  def.rule({
    when: (w) => w.state(states.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} bg-muted text-muted-foreground`)),
  });
}

export const carouselRoot = definePrototype<CarouselRootProps, CarouselRootExposes>({
  name: 'liquid-glass-carousel-root',
  modules: asCarouselRoot.modules,
  setup(def) {
    const behavior = asCarouselRoot();
    // Content slides stay clear and unobstructed; Liquid Glass belongs on floating controls.
    def.feedback.style.use(tw('relative min-w-0 max-w-full font-sans text-foreground'));
    return behavior.render;
  },
});
export { carouselRoot as liquidGlassCarouselRoot };

export const carouselViewport = definePrototype<CarouselViewportProps, CarouselViewportExposes>({
  name: 'liquid-glass-carousel-viewport',
  modules: asCarouselViewport.modules,
  setup(def) {
    const behavior = asCarouselViewport();
    // Concentric outer viewport radius pairs cleanly with inset rounded-lg slide cards.
    def.feedback.style.use(
      tw('relative min-w-0 min-h-0 max-w-full overflow-hidden rounded-xl text-foreground')
    );
    const states = behavior.stateHandles!;
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    return behavior.render;
  },
});
export { carouselViewport as liquidGlassCarouselViewport };

export const carouselSlide = definePrototype<CarouselSlideProps, CarouselSlideExposes>({
  name: 'liquid-glass-carousel-slide',
  modules: asCarouselSlide.modules,
  setup(def) {
    const behavior = asCarouselSlide();
    const { axis } = setupCarouselLayoutState(def);
    def.feedback.style.use(tw('min-w-0 max-w-full shrink-0 grow-0 text-foreground'));
    def.rule({
      when: (w) => w.state(axis).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('px-2')),
    });
    def.rule({
      when: (w) => w.state(axis).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('py-2')),
    });
    return behavior.render;
  },
});
export { carouselSlide as liquidGlassCarouselSlide };

export const carouselPrevious = definePrototype<
  LiquidGlassCarouselPreviousProps,
  CarouselPreviousExposes
>({
  name: 'liquid-glass-carousel-previous',
  modules: asCarouselPrevious.modules,
  setup(def) {
    const behavior = asCarouselPrevious();
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-carousel] Required inherited state is unavailable.');
    setupLiquidGlassNavigation(def, states, 'previous');
    return behavior.render;
  },
});
export { carouselPrevious as liquidGlassCarouselPrevious };

export const carouselNext = definePrototype<LiquidGlassCarouselNextProps, CarouselNextExposes>({
  name: 'liquid-glass-carousel-next',
  modules: asCarouselNext.modules,
  setup(def) {
    const behavior = asCarouselNext();
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-carousel] Required inherited state is unavailable.');
    setupLiquidGlassNavigation(def, states, 'next');
    return behavior.render;
  },
});
export { carouselNext as liquidGlassCarouselNext };
