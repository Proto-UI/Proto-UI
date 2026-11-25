import {
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_PRESS_TOKENS,
} from '../style';
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

function setupCarouselLayoutState<Props extends Record<string, any>, Exposes>(
  def: DefHandle<Props, Exposes>
) {
  const axis = def.state.string('brutalistCarouselAxis', 'horizontal');
  const direction = def.state.string('brutalistCarouselDirection', 'ltr');
  const sync = (run: RunHandle<Props>) => {
    const context = run.context.read(CAROUSEL_CONTEXT);
    axis.set(context.orientation, 'brutalist carousel axis');
    direction.set(context.direction, 'brutalist carousel direction');
  };
  def.context.subscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  return { axis, direction };
}

type ButtonStates = {
  hovered: State<boolean>;
  pressed: State<boolean>;
  focusVisible: State<boolean>;
  disabled: State<boolean>;
};

function setupNavigationControl<Props extends Record<string, any>, Exposes>(
  def: DefHandle<Props, Exposes>,
  states: ButtonStates,
  side: 'previous' | 'next'
) {
  const { axis, direction } = setupCarouselLayoutState(def);
  // neobrutalism.dev / design-contract.mdx: raised 2px black-bordered control
  // with 4px 4px zero-blur hard shadow that snaps (+4px, +4px) into its shadow on press.
  def.feedback.style.use(
    tw(
      'absolute inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-secondary-background text-foreground shadow-[4px_4px_0_0_#000] font-sans font-medium text-sm select-none cursor-pointer'
    )
  );
  def.rule({
    when: (w) => w.all(w.state(axis).eq('horizontal'), w.state(direction).eq('ltr')),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-0 bottom-0 left-[-3rem] my-auto')
          : tw('top-0 bottom-0 right-[-3rem] my-auto')
      ),
  });
  def.rule({
    when: (w) => w.all(w.state(axis).eq('horizontal'), w.state(direction).eq('rtl')),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-0 bottom-0 right-[-3rem] my-auto')
          : tw('top-0 bottom-0 left-[-3rem] my-auto')
      ),
  });
  def.rule({
    when: (w) => w.state(axis).eq('vertical'),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('left-0 right-0 top-[-3rem] mx-auto')
          : tw('left-0 right-0 bottom-[-3rem] mx-auto')
      ),
  });
  def.rule({
    when: (w) => w.state(states.focusVisible).eq(true),
    intent: (i) =>
      i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
  });
  def.rule({
    when: (w) => w.state(states.disabled).eq(true),
    intent: (i) =>
      i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-default shadow-none`)),
  });
  // Presentation consumes the existing owner; no second interaction hook.
  def.rule({
    when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
    intent: (i) => i.feedback.style.use(tw(BRUTALIST_PRESS_TOKENS)),
  });
}

export const carouselRoot = definePrototype<CarouselRootProps, CarouselRootExposes>({
  name: 'brutalist-carousel-root',
  modules: asCarouselRoot.modules,
  setup(def) {
    const behavior = asCarouselRoot();
    def.feedback.style.use(tw('relative min-w-0 max-w-full font-sans font-medium text-foreground'));
    return behavior.render;
  },
});
export { carouselRoot as brutalistCarouselRoot };

export const carouselViewport = definePrototype<CarouselViewportProps, CarouselViewportExposes>({
  name: 'brutalist-carousel-viewport',
  modules: asCarouselViewport.modules,
  setup(def) {
    const behavior = asCarouselViewport();
    def.feedback.style.use(
      tw(
        'relative min-w-0 min-h-0 max-w-full overflow-hidden rounded-base font-sans font-medium text-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.stateHandles!.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    return behavior.render;
  },
});
export { carouselViewport as brutalistCarouselViewport };

export const carouselSlide = definePrototype<CarouselSlideProps, CarouselSlideExposes>({
  name: 'brutalist-carousel-slide',
  modules: asCarouselSlide.modules,
  setup(def) {
    const behavior = asCarouselSlide();
    const { axis } = setupCarouselLayoutState(def);
    def.feedback.style.use(
      tw('min-w-0 max-w-full shrink-0 grow-0 font-sans font-medium text-foreground')
    );
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
export { carouselSlide as brutalistCarouselSlide };

export const carouselPrevious = definePrototype<CarouselPreviousProps, CarouselPreviousExposes>({
  name: 'brutalist-carousel-previous',
  modules: asCarouselPrevious.modules,
  setup(def) {
    const behavior = asCarouselPrevious();
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[brutalist-carousel] Required inherited state is unavailable.');
    setupNavigationControl(def, states, 'previous');
    return behavior.render;
  },
});
export { carouselPrevious as brutalistCarouselPrevious };

export const carouselNext = definePrototype<CarouselNextProps, CarouselNextExposes>({
  name: 'brutalist-carousel-next',
  modules: asCarouselNext.modules,
  setup(def) {
    const behavior = asCarouselNext();
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[brutalist-carousel] Required inherited state is unavailable.');
    setupNavigationControl(def, states, 'next');
    return behavior.render;
  },
});
export { carouselNext as brutalistCarouselNext };
