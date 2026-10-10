import { bootstrapButtonPressed } from '../button/paint';
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
import { definePrototype, tw, type State } from '@proto.ui/core';
import {
  asCarouselRoot,
  asCarouselViewport,
  asCarouselSlide,
  asCarouselPrevious,
  asCarouselNext,
} from '@proto.ui/prototypes-base/carousel';
export type * from '@proto.ui/prototypes-base/carousel';
export const carouselRoot = definePrototype<CarouselRootProps, CarouselRootExposes>({
  name: 'bootstrap-2-3-2-carousel-root',
  setup(def) {
    const behavior = asCarouselRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-[4px] border border-border bg-background shadow-sm p-3 gap-2'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { carouselRoot as bootstrap232CarouselRoot };
export const carouselViewport = definePrototype<CarouselViewportProps, CarouselViewportExposes>({
  name: 'bootstrap-2-3-2-carousel-viewport',
  setup(def) {
    const behavior = asCarouselViewport();
    def.feedback.style.use(
      tw('min-w-0 max-w-full text-foreground relative min-h-0 overflow-hidden rounded-md')
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { carouselViewport as bootstrap232CarouselViewport };
export const carouselSlide = definePrototype<CarouselSlideProps, CarouselSlideExposes>({
  name: 'bootstrap-2-3-2-carousel-slide',
  setup(def) {
    const behavior = asCarouselSlide();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground p-6'));
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { carouselSlide as bootstrap232CarouselSlide };
export const carouselPrevious = definePrototype<CarouselPreviousProps, CarouselPreviousExposes>({
  name: 'bootstrap-2-3-2-carousel-previous',
  setup(def) {
    const behavior = asCarouselPrevious();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states)
      throw new Error('[bootstrap-2-3-2-carousel] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
  },
});
export { carouselPrevious as bootstrap232CarouselPrevious };
export const carouselNext = definePrototype<CarouselNextProps, CarouselNextExposes>({
  name: 'bootstrap-2-3-2-carousel-next',
  setup(def) {
    const behavior = asCarouselNext();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states)
      throw new Error('[bootstrap-2-3-2-carousel] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
  },
});
export { carouselNext as bootstrap232CarouselNext };
