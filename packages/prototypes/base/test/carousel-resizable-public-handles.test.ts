import { afterEach, expect, it } from 'vitest';
import { definePrototype, type DefHandle } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { asResizableRoot, asResizablePanel, asResizableHandle } from '../src/resizable';
import {
  asCarouselRoot,
  asCarouselViewport,
  asCarouselSlide,
  asCarouselPrevious,
  asCarouselNext,
} from '../src/carousel';
const hooks = {
  resizeRoot: asResizableRoot,
  resizePanel: asResizablePanel,
  resizeHandle: asResizableHandle,
  carouselRoot: asCarouselRoot,
  carouselViewport: asCarouselViewport,
  carouselSlide: asCarouselSlide,
  carouselPrevious: asCarouselPrevious,
  carouselNext: asCarouselNext,
};
for (const [name, hook] of Object.entries(hooks))
  AdaptToWebComponent(
    definePrototype({
      name: `public-${name.toLowerCase()}`,
      setup(def: DefHandle<any, any>) {
        const handle = hook();
        def.expose.method('readCapture', () => handle);
        return handle.render;
      },
    })
  );
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
const node = (part: keyof typeof hooks, props: Record<string, unknown> = {}) => {
  const el = document.createElement(`public-${part.toLowerCase()}`) as any;
  setElementProps(el, props);
  return el;
};
const keys = (value: object | undefined) => Object.keys(value ?? {}).sort();
it('matches actual Resizable instance exposures and authored capture state keys', async () => {
  const root = node('resizeRoot', { defaultValue: 35 }),
    a = node('resizePanel', { index: 0 }),
    b = node('resizePanel', { index: 1 }),
    handle = node('resizeHandle');
  root.append(a, handle, b);
  roots.push(root);
  document.body.append(root);
  await flush();
  expect(keys(root.getExposes())).toEqual(['readCapture', 'requestValue', 'value']);
  expect(keys(root.getExposes().readCapture().stateHandles)).toEqual(['orientation', 'value']);
  expect(keys(a.getExposes())).toEqual(['readCapture', 'size']);
  expect(keys(a.getExposes().readCapture().stateHandles)).toEqual(['size']);
  expect(keys(handle.getExposes())).toEqual(['disabled', 'focusVisible', 'readCapture', 'value']);
  expect(keys(handle.getExposes().readCapture().stateHandles)).toEqual([
    'disabled',
    'focusVisible',
    'max',
    'min',
    'orientation',
    'value',
  ]);
  expect(a.getExposes().size.get()).toBe(35);
  expect(b.getExposes().size.get()).toBe(65);
  expect(handle.getExposes().value.get()).toBe(35);
});
it('matches Carousel collection aliases, slide state, focus and real nested Button captures', async () => {
  const root = node('carouselRoot'),
    viewport = node('carouselViewport'),
    slide = node('carouselSlide', { index: 0 }),
    second = node('carouselSlide', { index: 1 }),
    previous = node('carouselPrevious'),
    next = node('carouselNext');
  viewport.append(slide, second);
  root.append(viewport, previous, next);
  roots.push(root);
  document.body.append(root);
  await flush();
  expect(keys(root.getExposes())).toEqual([
    'count',
    'getCollectionCount',
    'getCollectionItems',
    'index',
    'readCapture',
    'requestIndex',
    'slideCount',
  ]);
  expect(keys(root.getExposes().readCapture().stateHandles)).toEqual([
    'a11yLabel',
    'collectionCount',
    'count',
    'index',
  ]);
  expect(root.getExposes().count.get()).toBe(2);
  expect(root.getExposes().slideCount.get()).toBe(2);
  expect(keys(viewport.getExposes())).toEqual(['focusVisible', 'readCapture']);
  expect(keys(viewport.getExposes().readCapture().stateHandles)).toEqual(['focusVisible']);
  expect(keys(slide.getExposes())).toEqual([
    'collectionFirst',
    'collectionIndex',
    'collectionLast',
    'collectionTotal',
    'current',
    'getCollectionItem',
    'hidden',
    'readCapture',
  ]);
  expect(keys(slide.getExposes().readCapture().stateHandles)).toEqual([
    'collectionFirst',
    'collectionIndex',
    'collectionLast',
    'collectionTotal',
    'current',
    'hidden',
    'label',
  ]);
  for (const button of [previous, next]) {
    expect(keys(button.getExposes())).toEqual([
      'disabled',
      'focusSelf',
      'focusVisible',
      'focused',
      'hovered',
      'pressed',
      'readCapture',
    ]);
    const capture = button.getExposes().readCapture();
    expect(capture.stateHandles).toBeUndefined();
    expect(keys(capture.getAsHookHandle('as-button').stateHandles)).toEqual([
      'disabled',
      'focusVisible',
      'focused',
      'hovered',
      'pressed',
    ]);
  }
  expect(slide.getExposes().current.get()).toBe(true);
  expect(previous.getExposes().disabled.get()).toBe(true);
  expect(next.getExposes().disabled.get()).toBe(false);
  expect(root.getExposes().requestIndex(1)).toBe(true);
  await flush();
  expect(second.getExposes().current.get()).toBe(true);
});
