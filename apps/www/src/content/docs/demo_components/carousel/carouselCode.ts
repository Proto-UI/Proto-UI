import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

const shadcnBasicWc = (id: string, propsLiteral: string, extraViewportClass = '') =>
  formatCode(`
<div class="w-full px-12">
  <proto-ui-shadcn-carousel-root id="${id}" class="mx-auto w-full max-w-xs">
    <proto-ui-shadcn-carousel-viewport${extraViewportClass ? ` class="${extraViewportClass}"` : ''}>
      <proto-ui-shadcn-carousel-slide><proto-ui-shadcn-card-root><proto-ui-shadcn-card-content class="flex aspect-square items-center justify-center p-6">1</proto-ui-shadcn-card-content></proto-ui-shadcn-card-root></proto-ui-shadcn-carousel-slide>
      <proto-ui-shadcn-carousel-slide><proto-ui-shadcn-card-root><proto-ui-shadcn-card-content class="flex aspect-square items-center justify-center p-6">2</proto-ui-shadcn-card-content></proto-ui-shadcn-card-root></proto-ui-shadcn-carousel-slide>
      <proto-ui-shadcn-carousel-slide><proto-ui-shadcn-card-root><proto-ui-shadcn-card-content class="flex aspect-square items-center justify-center p-6">3</proto-ui-shadcn-card-content></proto-ui-shadcn-card-root></proto-ui-shadcn-carousel-slide>
      <proto-ui-shadcn-carousel-slide><proto-ui-shadcn-card-root><proto-ui-shadcn-card-content class="flex aspect-square items-center justify-center p-6">4</proto-ui-shadcn-card-content></proto-ui-shadcn-card-root></proto-ui-shadcn-carousel-slide>
      <proto-ui-shadcn-carousel-slide><proto-ui-shadcn-card-root><proto-ui-shadcn-card-content class="flex aspect-square items-center justify-center p-6">5</proto-ui-shadcn-card-content></proto-ui-shadcn-card-root></proto-ui-shadcn-carousel-slide>
    </proto-ui-shadcn-carousel-viewport>
    <proto-ui-shadcn-carousel-previous><span aria-hidden="true">‹</span><span class="sr-only">Previous slide</span></proto-ui-shadcn-carousel-previous>
    <proto-ui-shadcn-carousel-next><span aria-hidden="true">›</span><span class="sr-only">Next slide</span></proto-ui-shadcn-carousel-next>
  </proto-ui-shadcn-carousel-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${id}');
  if (root instanceof HTMLElement) setElementProps(root, ${propsLiteral});
</script>
`);

const shadcnBasicReact = (name: string, rootProps: string, viewportClass = '', slideClass = '') =>
  formatCode(`
import {
  ShadcnCardRoot,
  ShadcnCardContent,
  ShadcnCarouselRoot,
  ShadcnCarouselViewport,
  ShadcnCarouselSlide,
  ShadcnCarouselPrevious,
  ShadcnCarouselNext,
} from '../proto-ui/components/react';

export function ${name}() {
  return (
    <div className="w-full px-12">
      <ShadcnCarouselRoot styleProfile="rhea" ${rootProps} className="mx-auto w-full max-w-xs">
        <ShadcnCarouselViewport${viewportClass ? ` className="${viewportClass}"` : ''}>
          {[1, 2, 3, 4, 5].map((num, index) => (
            <ShadcnCarouselSlide key={num} index={index}${slideClass ? ` className="${slideClass}"` : ''}>
              <ShadcnCardRoot>
                <ShadcnCardContent className="flex aspect-square items-center justify-center p-6">
                  <span className="text-4xl font-semibold">{num}</span>
                </ShadcnCardContent>
              </ShadcnCardRoot>
            </ShadcnCarouselSlide>
          ))}
        </ShadcnCarouselViewport>
        <ShadcnCarouselPrevious aria-label="Previous slide">‹</ShadcnCarouselPrevious>
        <ShadcnCarouselNext aria-label="Next slide">›</ShadcnCarouselNext>
      </ShadcnCarouselRoot>
    </div>
  );
}
`);

const shadcnBasicVue = (rootAttrs: string, viewportClass = '', slideClass = '') =>
  formatCode(`
<script setup lang="ts">
import {
  ShadcnCardRoot,
  ShadcnCardContent,
  ShadcnCarouselRoot,
  ShadcnCarouselViewport,
  ShadcnCarouselSlide,
  ShadcnCarouselPrevious,
  ShadcnCarouselNext,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="w-full px-12">
    <ShadcnCarouselRoot styleProfile="rhea" ${rootAttrs} class="mx-auto w-full max-w-xs">
      <ShadcnCarouselViewport${viewportClass ? ` class="${viewportClass}"` : ''}>
        <ShadcnCarouselSlide v-for="(num, index) in [1, 2, 3, 4, 5]" :key="num" :index="index"${slideClass ? ` class="${slideClass}"` : ''}>
          <ShadcnCardRoot>
            <ShadcnCardContent class="flex aspect-square items-center justify-center p-6">
              <span class="text-4xl font-semibold">{{ num }}</span>
            </ShadcnCardContent>
          </ShadcnCardRoot>
        </ShadcnCarouselSlide>
      </ShadcnCarouselViewport>
      <ShadcnCarouselPrevious aria-label="Previous slide">‹</ShadcnCarouselPrevious>
      <ShadcnCarouselNext aria-label="Next slide">›</ShadcnCarouselNext>
    </ShadcnCarouselRoot>
  </div>
</template>
`);

const shadcnBasicVue2 = (rootAttrs: string, viewportClass = '', slideClass = '') =>
  formatCode(`
<template>
  <div class="w-full px-12">
    <ShadcnCarouselRoot styleProfile="rhea" ${rootAttrs} class="mx-auto w-full max-w-xs">
      <ShadcnCarouselViewport${viewportClass ? ` class="${viewportClass}"` : ''}>
        <ShadcnCarouselSlide v-for="(num, index) in slides" :key="num" :index="index"${slideClass ? ` class="${slideClass}"` : ''}>
          <ShadcnCardRoot>
            <ShadcnCardContent class="flex aspect-square items-center justify-center p-6">
              <span class="text-4xl font-semibold">{{ num }}</span>
            </ShadcnCardContent>
          </ShadcnCardRoot>
        </ShadcnCarouselSlide>
      </ShadcnCarouselViewport>
      <ShadcnCarouselPrevious aria-label="Previous slide">‹</ShadcnCarouselPrevious>
      <ShadcnCarouselNext aria-label="Next slide">›</ShadcnCarouselNext>
    </ShadcnCarouselRoot>
  </div>
</template>

<script>
import {
  ShadcnCardRoot,
  ShadcnCardContent,
  ShadcnCarouselRoot,
  ShadcnCarouselViewport,
  ShadcnCarouselSlide,
  ShadcnCarouselPrevious,
  ShadcnCarouselNext,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCardRoot,
    ShadcnCardContent,
    ShadcnCarouselRoot,
    ShadcnCarouselViewport,
    ShadcnCarouselSlide,
    ShadcnCarouselPrevious,
    ShadcnCarouselNext,
  },
  data() {
    return { slides: [1, 2, 3, 4, 5] };
  },
};
</script>
`);

const familyWc = (
  prefix: string,
  id: string,
  propsLiteral: string,
  prevGlyph: string,
  nextGlyph: string,
  viewportClass = ''
) =>
  formatCode(`
<proto-ui-${prefix}-carousel-root id="${id}" class="mx-auto w-full max-w-md">
  <proto-ui-${prefix}-carousel-viewport${viewportClass ? ` class="${viewportClass}"` : ''}>
    <proto-ui-${prefix}-carousel-slide>1</proto-ui-${prefix}-carousel-slide>
    <proto-ui-${prefix}-carousel-slide>2</proto-ui-${prefix}-carousel-slide>
    <proto-ui-${prefix}-carousel-slide>3</proto-ui-${prefix}-carousel-slide>
  </proto-ui-${prefix}-carousel-viewport>
  <proto-ui-${prefix}-carousel-previous><span aria-hidden="true">${prevGlyph}</span><span class="sr-only">Previous slide</span></proto-ui-${prefix}-carousel-previous>
  <proto-ui-${prefix}-carousel-next><span aria-hidden="true">${nextGlyph}</span><span class="sr-only">Next slide</span></proto-ui-${prefix}-carousel-next>
</proto-ui-${prefix}-carousel-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${id}');
  if (root instanceof HTMLElement) setElementProps(root, ${propsLiteral});
</script>
`);

const familyReact = (
  componentPrefix: string,
  fnName: string,
  rootProps: string,
  prevGlyph: string,
  nextGlyph: string,
  viewportClass = ''
) =>
  formatCode(`
import {
  ${componentPrefix}CarouselRoot,
  ${componentPrefix}CarouselViewport,
  ${componentPrefix}CarouselSlide,
  ${componentPrefix}CarouselPrevious,
  ${componentPrefix}CarouselNext,
} from '../proto-ui/components/react';

export function ${fnName}() {
  return (
    <${componentPrefix}CarouselRoot ${rootProps} className="mx-auto w-full max-w-md">
      <${componentPrefix}CarouselViewport${viewportClass ? ` className="${viewportClass}"` : ''}>
        {[1, 2, 3, 4].map((num, index) => (
          <${componentPrefix}CarouselSlide key={num} index={index}>
            <div className="flex h-44 items-center justify-center">{num}</div>
          </${componentPrefix}CarouselSlide>
        ))}
      </${componentPrefix}CarouselViewport>
      <${componentPrefix}CarouselPrevious aria-label="Previous slide">${prevGlyph}</${componentPrefix}CarouselPrevious>
      <${componentPrefix}CarouselNext aria-label="Next slide">${nextGlyph}</${componentPrefix}CarouselNext>
    </${componentPrefix}CarouselRoot>
  );
}
`);

const familyVue = (
  componentPrefix: string,
  rootAttrs: string,
  prevGlyph: string,
  nextGlyph: string,
  viewportClass = ''
) =>
  formatCode(`
<script setup lang="ts">
import {
  ${componentPrefix}CarouselRoot,
  ${componentPrefix}CarouselViewport,
  ${componentPrefix}CarouselSlide,
  ${componentPrefix}CarouselPrevious,
  ${componentPrefix}CarouselNext,
} from '../proto-ui/components/vue';
</script>

<template>
  <${componentPrefix}CarouselRoot ${rootAttrs} class="mx-auto w-full max-w-md">
    <${componentPrefix}CarouselViewport${viewportClass ? ` class="${viewportClass}"` : ''}>
      <${componentPrefix}CarouselSlide v-for="(num, index) in [1, 2, 3, 4]" :key="num" :index="index">
        <div class="flex h-44 items-center justify-center">{{ num }}</div>
      </${componentPrefix}CarouselSlide>
    </${componentPrefix}CarouselViewport>
    <${componentPrefix}CarouselPrevious aria-label="Previous slide">${prevGlyph}</${componentPrefix}CarouselPrevious>
    <${componentPrefix}CarouselNext aria-label="Next slide">${nextGlyph}</${componentPrefix}CarouselNext>
  </${componentPrefix}CarouselRoot>
</template>
`);

const familyVue2 = (
  componentPrefix: string,
  rootAttrs: string,
  prevGlyph: string,
  nextGlyph: string,
  viewportClass = ''
) =>
  formatCode(`
<template>
  <${componentPrefix}CarouselRoot ${rootAttrs} class="mx-auto w-full max-w-md">
    <${componentPrefix}CarouselViewport${viewportClass ? ` class="${viewportClass}"` : ''}>
      <${componentPrefix}CarouselSlide v-for="(num, index) in slides" :key="num" :index="index">
        <div class="flex h-44 items-center justify-center">{{ num }}</div>
      </${componentPrefix}CarouselSlide>
    </${componentPrefix}CarouselViewport>
    <${componentPrefix}CarouselPrevious aria-label="Previous slide">${prevGlyph}</${componentPrefix}CarouselPrevious>
    <${componentPrefix}CarouselNext aria-label="Next slide">${nextGlyph}</${componentPrefix}CarouselNext>
  </${componentPrefix}CarouselRoot>
</template>

<script>
import {
  ${componentPrefix}CarouselRoot,
  ${componentPrefix}CarouselViewport,
  ${componentPrefix}CarouselSlide,
  ${componentPrefix}CarouselPrevious,
  ${componentPrefix}CarouselNext,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${componentPrefix}CarouselRoot,
    ${componentPrefix}CarouselViewport,
    ${componentPrefix}CarouselSlide,
    ${componentPrefix}CarouselPrevious,
    ${componentPrefix}CarouselNext,
  },
  data() {
    return { slides: [1, 2, 3, 4] };
  },
};
</script>
`);

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-carousel': shadcnBasicWc(
      'shadcn-carousel-hero',
      "{ styleProfile: 'rhea', a11yLabel: 'Featured cards' }"
    ),
    'demo-shadcn-carousel-sizes': shadcnBasicWc(
      'shadcn-carousel-sizes',
      "{ styleProfile: 'rhea', slidesPerView: 3, minSlideSize: 120 }"
    ),
    'demo-shadcn-carousel-spacing': shadcnBasicWc(
      'shadcn-carousel-spacing',
      "{ styleProfile: 'rhea', slidesPerView: 3, minSlideSize: 110 }"
    ),
    'demo-shadcn-carousel-orientation': shadcnBasicWc(
      'shadcn-carousel-orientation',
      "{ styleProfile: 'rhea', orientation: 'vertical', slidesPerView: 2 }",
      'h-64'
    ),
    'demo-shadcn-carousel-loop': shadcnBasicWc(
      'shadcn-carousel-loop',
      "{ styleProfile: 'rhea', loop: true }"
    ),
    'demo-shadcn-carousel-api': formatCode(`
<div class="w-full px-12">
  <proto-ui-shadcn-carousel-root id="shadcn-carousel-api" class="mx-auto w-full max-w-xs">
    <proto-ui-shadcn-carousel-viewport>
      <proto-ui-shadcn-carousel-slide>1</proto-ui-shadcn-carousel-slide>
      <proto-ui-shadcn-carousel-slide>2</proto-ui-shadcn-carousel-slide>
      <proto-ui-shadcn-carousel-slide>3</proto-ui-shadcn-carousel-slide>
      <proto-ui-shadcn-carousel-slide>4</proto-ui-shadcn-carousel-slide>
      <proto-ui-shadcn-carousel-slide>5</proto-ui-shadcn-carousel-slide>
    </proto-ui-shadcn-carousel-viewport>
    <proto-ui-shadcn-carousel-previous><span aria-hidden="true">‹</span><span class="sr-only">Previous slide</span></proto-ui-shadcn-carousel-previous>
    <proto-ui-shadcn-carousel-next><span aria-hidden="true">›</span><span class="sr-only">Next slide</span></proto-ui-shadcn-carousel-next>
  </proto-ui-shadcn-carousel-root>
  <div id="shadcn-carousel-status" role="status" aria-live="polite" class="py-2 text-center text-sm text-muted-foreground">Slide 1 of 5</div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#shadcn-carousel-api');
  const status = document.querySelector('#shadcn-carousel-status');
  if (root instanceof HTMLElement) {
    setElementProps(root, { styleProfile: 'rhea', defaultIndex: 0 });
    root.addEventListener('indexChange', (event) => {
      if (event instanceof CustomEvent && status) {
        status.textContent = 'Slide ' + (event.detail.index + 1) + ' of 5';
      }
    });
  }
</script>
    `),
    'demo-shadcn-carousel-rtl': shadcnBasicWc(
      'shadcn-carousel-rtl',
      "{ styleProfile: 'rhea', direction: 'rtl' }"
    ),
    'demo-brutalist-carousel': familyWc(
      'brutalist',
      'brutalist-carousel-hero',
      "{ a11yLabel: 'Numbered cards' }",
      '←',
      '→'
    ),
    'demo-brutalist-carousel-sizes': familyWc(
      'brutalist',
      'brutalist-carousel-sizes',
      '{ slidesPerView: 3, minSlideSize: 120 }',
      '←',
      '→'
    ),
    'demo-brutalist-carousel-orientation': familyWc(
      'brutalist',
      'brutalist-carousel-orientation',
      "{ orientation: 'vertical', slidesPerView: 2 }",
      '↑',
      '↓',
      'h-64'
    ),
    'demo-brutalist-carousel-loop': familyWc(
      'brutalist',
      'brutalist-carousel-loop',
      '{ loop: true }',
      '←',
      '→'
    ),
    'demo-brutalist-carousel-api': familyWc(
      'brutalist',
      'brutalist-carousel-api',
      '{ defaultIndex: 0 }',
      '←',
      '→'
    ),
    'demo-bootstrap-2-3-2-carousel': familyWc(
      'bootstrap-2-3-2',
      'bootstrap-carousel-hero',
      "{ a11yLabel: 'Featured slides' }",
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-sizes': familyWc(
      'bootstrap-2-3-2',
      'bootstrap-carousel-sizes',
      '{ slidesPerView: 2, minSlideSize: 180 }',
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-orientation': familyWc(
      'bootstrap-2-3-2',
      'bootstrap-carousel-orientation',
      "{ orientation: 'vertical' }",
      '‹',
      '›',
      'h-56'
    ),
    'demo-bootstrap-2-3-2-carousel-loop': familyWc(
      'bootstrap-2-3-2',
      'bootstrap-carousel-loop',
      '{ loop: true }',
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-api': familyWc(
      'bootstrap-2-3-2',
      'bootstrap-carousel-api',
      '{ defaultIndex: 0 }',
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel': familyWc(
      'liquid-glass',
      'liquid-glass-carousel-hero',
      "{ a11yLabel: 'Media gallery' }",
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel-sizes': familyWc(
      'liquid-glass',
      'liquid-glass-carousel-sizes',
      '{ slidesPerView: 2, minSlideSize: 180 }',
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel-orientation': familyWc(
      'liquid-glass',
      'liquid-glass-carousel-orientation',
      "{ orientation: 'vertical', slidesPerView: 2 }",
      '‹',
      '›',
      'h-64'
    ),
    'demo-liquid-glass-carousel-loop': familyWc(
      'liquid-glass',
      'liquid-glass-carousel-loop',
      '{ loop: true }',
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel-api': familyWc(
      'liquid-glass',
      'liquid-glass-carousel-api',
      '{ defaultIndex: 0 }',
      '‹',
      '›'
    ),
  },
  react: {
    'demo-shadcn-carousel': shadcnBasicReact('CarouselDemo', 'a11yLabel="Featured cards"'),
    'demo-shadcn-carousel-sizes': shadcnBasicReact(
      'CarouselSizesDemo',
      'slidesPerView={3} minSlideSize={120}'
    ),
    'demo-shadcn-carousel-spacing': shadcnBasicReact(
      'CarouselSpacingDemo',
      'slidesPerView={3} minSlideSize={110}',
      '',
      'px-1'
    ),
    'demo-shadcn-carousel-orientation': shadcnBasicReact(
      'CarouselOrientationDemo',
      'orientation="vertical" slidesPerView={2}',
      'h-64'
    ),
    'demo-shadcn-carousel-loop': shadcnBasicReact('CarouselLoopDemo', 'loop'),
    'demo-shadcn-carousel-api': formatCode(`
import { useState } from 'react';
import {
  ShadcnCardRoot,
  ShadcnCardContent,
  ShadcnCarouselRoot,
  ShadcnCarouselViewport,
  ShadcnCarouselSlide,
  ShadcnCarouselPrevious,
  ShadcnCarouselNext,
} from '../proto-ui/components/react';

export function CarouselApiDemo() {
  const [current, setCurrent] = useState(0);
  return (
    <div className="mx-auto w-full max-w-xs">
      <ShadcnCarouselRoot
        styleProfile="rhea"
        index={current}
        onIndexChange={({ index }) => setCurrent(index)}
      >
        <ShadcnCarouselViewport>
          {[1, 2, 3, 4, 5].map((num, index) => (
            <ShadcnCarouselSlide key={num} index={index}>
              <ShadcnCardRoot>
                <ShadcnCardContent className="flex aspect-square items-center justify-center p-6">
                  <span className="text-4xl font-semibold">{num}</span>
                </ShadcnCardContent>
              </ShadcnCardRoot>
            </ShadcnCarouselSlide>
          ))}
        </ShadcnCarouselViewport>
        <ShadcnCarouselPrevious aria-label="Previous slide">‹</ShadcnCarouselPrevious>
        <ShadcnCarouselNext aria-label="Next slide">›</ShadcnCarouselNext>
      </ShadcnCarouselRoot>
      <div role="status" aria-live="polite" className="py-2 text-center text-sm text-muted-foreground">
        Slide {current + 1} of 5
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-carousel-rtl': shadcnBasicReact('CarouselRtlDemo', 'direction="rtl"'),
    'demo-brutalist-carousel': familyReact(
      'Brutalist',
      'BrutalistCarouselDemo',
      'a11yLabel="Numbered cards"',
      '←',
      '→'
    ),
    'demo-brutalist-carousel-sizes': familyReact(
      'Brutalist',
      'BrutalistCarouselSizesDemo',
      'slidesPerView={3} minSlideSize={120}',
      '←',
      '→'
    ),
    'demo-brutalist-carousel-orientation': familyReact(
      'Brutalist',
      'BrutalistCarouselOrientationDemo',
      'orientation="vertical" slidesPerView={2}',
      '↑',
      '↓',
      'h-64'
    ),
    'demo-brutalist-carousel-loop': familyReact(
      'Brutalist',
      'BrutalistCarouselLoopDemo',
      'loop',
      '←',
      '→'
    ),
    'demo-brutalist-carousel-api': familyReact(
      'Brutalist',
      'BrutalistCarouselApiDemo',
      'defaultIndex={0}',
      '←',
      '→'
    ),
    'demo-bootstrap-2-3-2-carousel': familyReact(
      'Bootstrap232',
      'BootstrapCarouselDemo',
      'a11yLabel="Featured slides"',
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-sizes': familyReact(
      'Bootstrap232',
      'BootstrapCarouselSizesDemo',
      'slidesPerView={2} minSlideSize={180}',
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-orientation': familyReact(
      'Bootstrap232',
      'BootstrapCarouselOrientationDemo',
      'orientation="vertical"',
      '‹',
      '›',
      'h-56'
    ),
    'demo-bootstrap-2-3-2-carousel-loop': familyReact(
      'Bootstrap232',
      'BootstrapCarouselLoopDemo',
      'loop',
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-api': familyReact(
      'Bootstrap232',
      'BootstrapCarouselApiDemo',
      'defaultIndex={0}',
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel': familyReact(
      'LiquidGlass',
      'LiquidGlassCarouselDemo',
      'a11yLabel="Media gallery"',
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel-sizes': familyReact(
      'LiquidGlass',
      'LiquidGlassCarouselSizesDemo',
      'slidesPerView={2} minSlideSize={180}',
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel-orientation': familyReact(
      'LiquidGlass',
      'LiquidGlassCarouselOrientationDemo',
      'orientation="vertical" slidesPerView={2}',
      '‹',
      '›',
      'h-64'
    ),
    'demo-liquid-glass-carousel-loop': familyReact(
      'LiquidGlass',
      'LiquidGlassCarouselLoopDemo',
      'loop',
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel-api': familyReact(
      'LiquidGlass',
      'LiquidGlassCarouselApiDemo',
      'defaultIndex={0}',
      '‹',
      '›'
    ),
  },
  vue: {
    'demo-shadcn-carousel': shadcnBasicVue('a11y-label="Featured cards"'),
    'demo-shadcn-carousel-sizes': shadcnBasicVue(':slides-per-view="3" :min-slide-size="120"'),
    'demo-shadcn-carousel-spacing': shadcnBasicVue(
      ':slides-per-view="3" :min-slide-size="110"',
      '',
      'px-1'
    ),
    'demo-shadcn-carousel-orientation': shadcnBasicVue(
      'orientation="vertical" :slides-per-view="2"',
      'h-64'
    ),
    'demo-shadcn-carousel-loop': shadcnBasicVue(':loop="true"'),
    'demo-shadcn-carousel-api': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnCardRoot,
  ShadcnCardContent,
  ShadcnCarouselRoot,
  ShadcnCarouselViewport,
  ShadcnCarouselSlide,
  ShadcnCarouselPrevious,
  ShadcnCarouselNext,
} from '../proto-ui/components/vue';

const current = ref(0);
</script>

<template>
  <div class="mx-auto w-full max-w-xs">
    <ShadcnCarouselRoot styleProfile="rhea" :index="current" @indexChange="({ index }) => (current = index)">
      <ShadcnCarouselViewport>
        <ShadcnCarouselSlide v-for="(num, index) in [1, 2, 3, 4, 5]" :key="num" :index="index">
          <ShadcnCardRoot>
            <ShadcnCardContent class="flex aspect-square items-center justify-center p-6">
              <span class="text-4xl font-semibold">{{ num }}</span>
            </ShadcnCardContent>
          </ShadcnCardRoot>
        </ShadcnCarouselSlide>
      </ShadcnCarouselViewport>
      <ShadcnCarouselPrevious aria-label="Previous slide">‹</ShadcnCarouselPrevious>
      <ShadcnCarouselNext aria-label="Next slide">›</ShadcnCarouselNext>
    </ShadcnCarouselRoot>
    <div role="status" aria-live="polite" class="py-2 text-center text-sm text-muted-foreground">
      Slide {{ current + 1 }} of 5
    </div>
  </div>
</template>
    `),
    'demo-shadcn-carousel-rtl': shadcnBasicVue('direction="rtl"'),
    'demo-brutalist-carousel': familyVue('Brutalist', 'a11y-label="Numbered cards"', '←', '→'),
    'demo-brutalist-carousel-sizes': familyVue(
      'Brutalist',
      ':slides-per-view="3" :min-slide-size="120"',
      '←',
      '→'
    ),
    'demo-brutalist-carousel-orientation': familyVue(
      'Brutalist',
      'orientation="vertical" :slides-per-view="2"',
      '↑',
      '↓',
      'h-64'
    ),
    'demo-brutalist-carousel-loop': familyVue('Brutalist', ':loop="true"', '←', '→'),
    'demo-brutalist-carousel-api': familyVue('Brutalist', ':default-index="0"', '←', '→'),
    'demo-bootstrap-2-3-2-carousel': familyVue(
      'Bootstrap232',
      'a11y-label="Featured slides"',
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-sizes': familyVue(
      'Bootstrap232',
      ':slides-per-view="2" :min-slide-size="180"',
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-orientation': familyVue(
      'Bootstrap232',
      'orientation="vertical"',
      '‹',
      '›',
      'h-56'
    ),
    'demo-bootstrap-2-3-2-carousel-loop': familyVue('Bootstrap232', ':loop="true"', '‹', '›'),
    'demo-bootstrap-2-3-2-carousel-api': familyVue('Bootstrap232', ':default-index="0"', '‹', '›'),
    'demo-liquid-glass-carousel': familyVue('LiquidGlass', 'a11y-label="Media gallery"', '‹', '›'),
    'demo-liquid-glass-carousel-sizes': familyVue(
      'LiquidGlass',
      ':slides-per-view="2" :min-slide-size="180"',
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel-orientation': familyVue(
      'LiquidGlass',
      'orientation="vertical" :slides-per-view="2"',
      '‹',
      '›',
      'h-64'
    ),
    'demo-liquid-glass-carousel-loop': familyVue('LiquidGlass', ':loop="true"', '‹', '›'),
    'demo-liquid-glass-carousel-api': familyVue('LiquidGlass', ':default-index="0"', '‹', '›'),
  },
  vue2: {
    'demo-shadcn-carousel': shadcnBasicVue2('a11y-label="Featured cards"'),
    'demo-shadcn-carousel-sizes': shadcnBasicVue2(':slides-per-view="3" :min-slide-size="120"'),
    'demo-shadcn-carousel-spacing': shadcnBasicVue2(
      ':slides-per-view="3" :min-slide-size="110"',
      '',
      'px-1'
    ),
    'demo-shadcn-carousel-orientation': shadcnBasicVue2(
      'orientation="vertical" :slides-per-view="2"',
      'h-64'
    ),
    'demo-shadcn-carousel-loop': shadcnBasicVue2(':loop="true"'),
    'demo-shadcn-carousel-api': formatCode(`
<template>
  <div class="mx-auto w-full max-w-xs">
    <ShadcnCarouselRoot styleProfile="rhea" :index="current" @indexChange="onIndexChange">
      <ShadcnCarouselViewport>
        <ShadcnCarouselSlide v-for="(num, index) in slides" :key="num" :index="index">
          <ShadcnCardRoot>
            <ShadcnCardContent class="flex aspect-square items-center justify-center p-6">
              <span class="text-4xl font-semibold">{{ num }}</span>
            </ShadcnCardContent>
          </ShadcnCardRoot>
        </ShadcnCarouselSlide>
      </ShadcnCarouselViewport>
      <ShadcnCarouselPrevious aria-label="Previous slide">‹</ShadcnCarouselPrevious>
      <ShadcnCarouselNext aria-label="Next slide">›</ShadcnCarouselNext>
    </ShadcnCarouselRoot>
    <div role="status" aria-live="polite" class="py-2 text-center text-sm text-muted-foreground">
      Slide {{ current + 1 }} of 5
    </div>
  </div>
</template>

<script>
import {
  ShadcnCardRoot,
  ShadcnCardContent,
  ShadcnCarouselRoot,
  ShadcnCarouselViewport,
  ShadcnCarouselSlide,
  ShadcnCarouselPrevious,
  ShadcnCarouselNext,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCardRoot,
    ShadcnCardContent,
    ShadcnCarouselRoot,
    ShadcnCarouselViewport,
    ShadcnCarouselSlide,
    ShadcnCarouselPrevious,
    ShadcnCarouselNext,
  },
  data() {
    return { slides: [1, 2, 3, 4, 5], current: 0 };
  },
  methods: {
    onIndexChange(payload) {
      this.current = payload.index;
    },
  },
};
</script>
    `),
    'demo-shadcn-carousel-rtl': shadcnBasicVue2('direction="rtl"'),
    'demo-brutalist-carousel': familyVue2('Brutalist', 'a11y-label="Numbered cards"', '←', '→'),
    'demo-brutalist-carousel-sizes': familyVue2(
      'Brutalist',
      ':slides-per-view="3" :min-slide-size="120"',
      '←',
      '→'
    ),
    'demo-brutalist-carousel-orientation': familyVue2(
      'Brutalist',
      'orientation="vertical" :slides-per-view="2"',
      '↑',
      '↓',
      'h-64'
    ),
    'demo-brutalist-carousel-loop': familyVue2('Brutalist', ':loop="true"', '←', '→'),
    'demo-brutalist-carousel-api': familyVue2('Brutalist', ':default-index="0"', '←', '→'),
    'demo-bootstrap-2-3-2-carousel': familyVue2(
      'Bootstrap232',
      'a11y-label="Featured slides"',
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-sizes': familyVue2(
      'Bootstrap232',
      ':slides-per-view="2" :min-slide-size="180"',
      '‹',
      '›'
    ),
    'demo-bootstrap-2-3-2-carousel-orientation': familyVue2(
      'Bootstrap232',
      'orientation="vertical"',
      '‹',
      '›',
      'h-56'
    ),
    'demo-bootstrap-2-3-2-carousel-loop': familyVue2('Bootstrap232', ':loop="true"', '‹', '›'),
    'demo-bootstrap-2-3-2-carousel-api': familyVue2('Bootstrap232', ':default-index="0"', '‹', '›'),
    'demo-liquid-glass-carousel': familyVue2('LiquidGlass', 'a11y-label="Media gallery"', '‹', '›'),
    'demo-liquid-glass-carousel-sizes': familyVue2(
      'LiquidGlass',
      ':slides-per-view="2" :min-slide-size="180"',
      '‹',
      '›'
    ),
    'demo-liquid-glass-carousel-orientation': familyVue2(
      'LiquidGlass',
      'orientation="vertical" :slides-per-view="2"',
      '‹',
      '›',
      'h-64'
    ),
    'demo-liquid-glass-carousel-loop': familyVue2('LiquidGlass', ':loop="true"', '‹', '›'),
    'demo-liquid-glass-carousel-api': familyVue2('LiquidGlass', ':default-index="0"', '‹', '›'),
  },
};
