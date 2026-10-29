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
import { definePrototype, tw } from '@proto.ui/core';
import {
  asCarouselRoot,
  asCarouselViewport,
  asCarouselSlide,
  asCarouselPrevious,
  asCarouselNext,
} from '@proto.ui/prototypes-base/carousel';
import { setupShadcnStyleScope, type ShadcnStyleProps } from '../style-scope';
import { setupCarouselAxis, setupCarouselNavigationPaint } from './visual';
export type * from '@proto.ui/prototypes-base/carousel';
export type ShadcnCarouselRootProps = CarouselRootProps & ShadcnStyleProps;
export type ShadcnCarouselViewportProps = CarouselViewportProps & ShadcnStyleProps;
export type ShadcnCarouselSlideProps = CarouselSlideProps & ShadcnStyleProps;
export type ShadcnCarouselPreviousProps = CarouselPreviousProps & ShadcnStyleProps;
export type ShadcnCarouselNextProps = CarouselNextProps & ShadcnStyleProps;

export const carouselRoot = definePrototype<ShadcnCarouselRootProps, CarouselRootExposes>({
  name: 'shadcn-carousel-root',
  modules: asCarouselRoot.modules,
  setup(def) {
    const inherited = asCarouselRoot();
    setupShadcnStyleScope(def);
    // shadcn-ui/ui@3d98900e base/ui/carousel.tsx and new-york-v4:
    // the Carousel itself is not the bordered/padded Card in its examples.
    def.feedback.style.use(tw('relative min-w-0 max-w-full text-foreground'));
    return inherited.render;
  },
});
export { carouselRoot as shadcnCarouselRoot };

export const carouselViewport = definePrototype<
  ShadcnCarouselViewportProps,
  CarouselViewportExposes
>({
  name: 'shadcn-carousel-viewport',
  modules: asCarouselViewport.modules,
  setup(def) {
    const inherited = asCarouselViewport();
    def.feedback.style.use(tw('min-w-0 min-h-0 overflow-hidden'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    // Base owns the discrete current-slide protocol and Axis Input. It does
    // not expose Embla's scrolling strip, plugin runtime, or autoplay policy.
    return inherited.render;
  },
});
export { carouselViewport as shadcnCarouselViewport };

export const carouselSlide = definePrototype<ShadcnCarouselSlideProps, CarouselSlideExposes>({
  name: 'shadcn-carousel-slide',
  modules: asCarouselSlide.modules,
  setup(def) {
    const inherited = asCarouselSlide();
    const axis = setupCarouselAxis(def);
    def.feedback.style.use(tw('min-w-0 shrink-0 grow-0 basis-full'));
    def.rule({
      when: (w) => w.state(axis).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('pl-4')),
    });
    def.rule({
      when: (w) => w.state(axis).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('pt-4')),
    });
    return inherited.render;
  },
});
export { carouselSlide as shadcnCarouselSlide };

export const carouselPrevious = definePrototype<
  ShadcnCarouselPreviousProps,
  CarouselPreviousExposes
>({
  name: 'shadcn-carousel-previous',
  modules: asCarouselPrevious.modules,
  setup(def) {
    const inherited = asCarouselPrevious();
    const state = inherited.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[shadcn-carousel] Required inherited Button state is unavailable.');
    setupCarouselNavigationPaint(def, state, 'previous');
    return inherited.render;
  },
});
export { carouselPrevious as shadcnCarouselPrevious };

export const carouselNext = definePrototype<ShadcnCarouselNextProps, CarouselNextExposes>({
  name: 'shadcn-carousel-next',
  modules: asCarouselNext.modules,
  setup(def) {
    const inherited = asCarouselNext();
    const state = inherited.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[shadcn-carousel] Required inherited Button state is unavailable.');
    setupCarouselNavigationPaint(def, state, 'next');
    return inherited.render;
  },
});
export { carouselNext as shadcnCarouselNext };
