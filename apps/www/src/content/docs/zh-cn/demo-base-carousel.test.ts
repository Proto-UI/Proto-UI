// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  carouselRoot,
  carouselViewport,
  carouselSlide,
  carouselPrevious,
  carouselNext,
} from '@proto.ui/prototypes-base/carousel';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-carousel.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/carousel.mdx');

describe('Base Carousel documentation registration', () => {
  it('loads the actual public Base Carousel root, viewport, slide, previous, and next prototypes lazily', async () => {
    for (const protoId of [
      'base-carousel-root',
      'base-carousel-viewport',
      'base-carousel-slide',
      'base-carousel-previous',
      'base-carousel-next',
    ]) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-carousel-root')).toBe(carouselRoot);
    expect(getPrototype('base-carousel-viewport')).toBe(carouselViewport);
    expect(getPrototype('base-carousel-slide')).toBe(carouselSlide);
    expect(getPrototype('base-carousel-previous')).toBe(carouselPrevious);
    expect(getPrototype('base-carousel-next')).toBe(carouselNext);
  });
  it.each(['en', 'zh-cn'])(
    'registers the carousel demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-carousel');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Carousel discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/carousel'");
  });
  it('admits a Base-only declarative recipe with one root, a viewport of three slides, and previous/next', () => {
    const recipe = (recipes['./demo-base-carousel.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Carousel recipe is missing.');
    assertDemoSpec(recipe);
    let rootCount = 0;
    const directProtoChildren = (node: any) =>
      (node?.children ?? []).filter(
        (child: any) => child && typeof child === 'object' && child.kind === 'proto'
      );
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-carousel-root') {
        rootCount += 1;
        const children = directProtoChildren(node);
        const viewports = children.filter(
          (child: any) => child.prototypeId === 'base-carousel-viewport'
        );
        const previous = children.filter(
          (child: any) => child.prototypeId === 'base-carousel-previous'
        );
        const next = children.filter((child: any) => child.prototypeId === 'base-carousel-next');
        expect(viewports.length).toBe(1);
        expect(previous.length).toBe(1);
        expect(next.length).toBe(1);
        const slides = directProtoChildren(viewports[0]).filter(
          (child: any) => child.prototypeId === 'base-carousel-slide'
        );
        expect(slides.length).toBe(3);
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
