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
import { bootstrapButtonPressed } from '../button/paint';
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
  const axis = def.state.string('bootstrapCarouselAxis', 'horizontal');
  const direction = def.state.string('bootstrapCarouselDirection', 'ltr');
  const sync = (run: RunHandle<Props>) => {
    const context = run.context.read(CAROUSEL_CONTEXT);
    axis.set(context.orientation, 'bootstrap carousel axis');
    direction.set(context.direction, 'bootstrap carousel direction');
  };
  def.context.subscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  return { axis, direction };
}

type ButtonStates = {
  hovered: State<boolean>;
  pressed: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  disabled: State<boolean>;
};

function setupBootstrapCarouselControl<Props extends Record<string, any>, Exposes>(
  def: DefHandle<Props, Exposes>,
  state: ButtonStates,
  side: 'previous' | 'next'
) {
  const { axis, direction } = setupCarouselLayoutState(def);
  def.feedback.style.use(
    tw(
      'absolute z-10 inline-flex items-center justify-center w-[40px] h-[40px] p-0 text-[60px] font-[100] leading-[30px] text-primary-foreground text-center bg-[#222] border-[3px] border-white rounded-[23px] no-underline select-none cursor-pointer opacity-50'
    )
  );
  def.rule({
    when: (w) => w.all(w.state(axis).eq('horizontal'), w.state(direction).eq('ltr')),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-[40%] left-[15px] mt-[-20px]')
          : tw('top-[40%] right-[15px] mt-[-20px]')
      ),
  });
  def.rule({
    when: (w) => w.all(w.state(axis).eq('horizontal'), w.state(direction).eq('rtl')),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-[40%] right-[15px] mt-[-20px]')
          : tw('top-[40%] left-[15px] mt-[-20px]')
      ),
  });
  def.rule({
    when: (w) => w.state(axis).eq('vertical'),
    intent: (i) =>
      i.feedback.style.use(
        side === 'previous'
          ? tw('top-[15px] left-1/2 -translate-x-1/2')
          : tw('bottom-[15px] left-1/2 -translate-x-1/2')
      ),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.disabled).eq(false),
        w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
      ),
    intent: (i) => i.feedback.style.use(tw('opacity-90')),
  });
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) =>
      i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) =>
      i.feedback.style.use(
        tw('pointer-events-none cursor-default border-border text-muted-foreground')
      ),
  });
  // Presentation consumes the existing owner; no second interaction hook.
  def.rule({
    when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
    intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
  });
}

// twbs/bootstrap@b4c4072 less/carousel.less. Base owns the index, input,
// availability, continuous equal-slide scrolling and committed snapping. The
// upstream 600ms outgoing/incoming left choreography is a different motion
// profile and is not reproduced by an extra index owner or a timer here.
export const carouselRoot = definePrototype<CarouselRootProps, CarouselRootExposes>({
  name: 'bootstrap-2-3-2-carousel-root',
  modules: asCarouselRoot.modules,
  setup(def) {
    const behavior = asCarouselRoot();
    def.feedback.style.use(
      tw(
        'relative min-w-0 max-w-full mb-[20px] font-sans text-[14px] leading-[20px] text-foreground'
      )
    );
    return behavior.render;
  },
});
export { carouselRoot as bootstrap232CarouselRoot };

export const carouselViewport = definePrototype<CarouselViewportProps, CarouselViewportExposes>({
  name: 'bootstrap-2-3-2-carousel-viewport',
  modules: asCarouselViewport.modules,
  setup(def) {
    const behavior = asCarouselViewport();
    def.feedback.style.use(tw('relative w-full min-w-0 min-h-0 overflow-hidden'));
    def.rule({
      when: (w) => w.state(behavior.stateHandles!.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    return behavior.render;
  },
});
export { carouselViewport as bootstrap232CarouselViewport };

export const carouselSlide = definePrototype<CarouselSlideProps, CarouselSlideExposes>({
  name: 'bootstrap-2-3-2-carousel-slide',
  modules: asCarouselSlide.modules,
  setup(def) {
    const behavior = asCarouselSlide();
    def.feedback.style.use(tw('relative min-w-0 shrink-0 grow-0'));
    def.rule({
      when: (w) => w.state(behavior.stateHandles!.current).eq(true),
      intent: (i) => i.feedback.style.use(tw('block')),
    });
    return behavior.render;
  },
});
export { carouselSlide as bootstrap232CarouselSlide };

export const carouselPrevious = definePrototype<CarouselPreviousProps, CarouselPreviousExposes>({
  name: 'bootstrap-2-3-2-carousel-previous',
  modules: asCarouselPrevious.modules,
  setup(def) {
    const behavior = asCarouselPrevious();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-carousel] Required inherited Button states unavailable.');
    setupBootstrapCarouselControl(def, state, 'previous');
    return behavior.render;
  },
});
export { carouselPrevious as bootstrap232CarouselPrevious };

export const carouselNext = definePrototype<CarouselNextProps, CarouselNextExposes>({
  name: 'bootstrap-2-3-2-carousel-next',
  modules: asCarouselNext.modules,
  setup(def) {
    const behavior = asCarouselNext();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-carousel] Required inherited Button states unavailable.');
    setupBootstrapCarouselControl(def, state, 'next');
    return behavior.render;
  },
});
export { carouselNext as bootstrap232CarouselNext };
