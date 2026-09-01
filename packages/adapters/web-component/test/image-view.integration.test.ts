import { describe, expect, it, vi } from 'vitest';
import type { ImageViewStatusChange } from '@proto.ui/core';
import imageRoot from '../../../prototypes/base/src/image';
import { AdaptToWebComponent, setElementProps, type WebComponentAdapterElement } from '../src';

const ImageElement = AdaptToWebComponent(imageRoot, { registerAs: 'x-wc-image-view' });

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function controlImageDecodes(): {
  requests: Array<{ resolve(): void; reject(error?: unknown): void }>;
  restore(): void;
} {
  const requests: Array<{ resolve(): void; reject(error?: unknown): void }> = [];
  const decode = vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(
    () =>
      new Promise<void>((resolve, reject) => {
        requests.push({ resolve, reject });
      })
  );
  return { requests, restore: () => decode.mockRestore() };
}

describe('adapter-web-component image view', () => {
  it('keeps the custom boundary while projecting one image target and its lifecycle', async () => {
    const decodes = controlImageDecodes();
    const element = document.createElement('x-wc-image-view') as WebComponentAdapterElement<
      typeof imageRoot
    >;
    const statusChanges: ImageViewStatusChange[] = [];
    element.addEventListener('loadingStatusChange', (event) => {
      statusChanges.push((event as CustomEvent<ImageViewStatusChange>).detail);
    });
    setElementProps(element, {
      source: 'image:a',
      a11yMode: 'informative',
      alternativeText: 'Image A',
      fit: 'cover',
      surfaceClassName: 'surface-image',
      surfaceStyle: { aspectRatio: '4 / 3' },
    });
    document.body.appendChild(element);
    await flush();

    const image = element.querySelector('img');
    expect(element.tagName.toLowerCase()).toBe('x-wc-image-view');
    expect(element.querySelectorAll('img')).toHaveLength(1);
    expect(image?.getAttribute('part')).toBe('image');
    expect(image?.getAttribute('src')).toBe('image:a');
    expect(image?.alt).toBe('Image A');
    expect(image?.style.objectFit).toBe('cover');
    expect(image?.classList.contains('surface-image')).toBe(true);
    expect(element.classList.contains('surface-image')).toBe(false);
    expect(image?.style.aspectRatio).toBe('4 / 3');

    const exposes = element.getExposes() as {
      loadingStatus: { get(): string };
      source: { get(): string };
      fit: { get(): string };
    };
    expect(exposes.source.get()).toBe('image:a');
    expect(exposes.fit.get()).toBe('cover');
    expect(exposes.loadingStatus.get()).toBe('loading');

    if (!image) throw new Error('physical image was not materialized');
    decodes.requests[0].resolve();
    await flush();
    expect(exposes.loadingStatus.get()).toBe('loaded');
    expect(statusChanges.map(({ status }) => status)).toEqual(['loading', 'loaded']);

    setElementProps(element, {
      source: 'image:b',
      a11yMode: 'informative',
      alternativeText: 'Image B',
      fit: 'contain',
      surfaceClassName: 'surface-next',
    });
    element.update();
    await flush();
    expect(image.getAttribute('src')).toBe('image:b');
    expect(image.alt).toBe('Image B');
    expect(image.style.objectFit).toBe('contain');
    expect(image.classList.contains('surface-image')).toBe(false);
    expect(image.classList.contains('surface-next')).toBe(true);
    expect(exposes.loadingStatus.get()).toBe('loading');
    expect(statusChanges.map(({ status }) => status)).toEqual(['loading', 'loaded', 'loading']);

    decodes.requests[1].reject(new Error('image:b failed'));
    await flush();
    expect(exposes.loadingStatus.get()).toBe('error');
    expect(statusChanges.map(({ status }) => status)).toEqual([
      'loading',
      'loaded',
      'loading',
      'error',
    ]);

    setElementProps(element, {
      source: 'image:c',
      a11yMode: 'decorative',
      alternativeText: '',
      fit: 'fill',
    });
    element.update();
    await flush();
    expect(image.getAttribute('src')).toBe('image:c');
    expect(image.alt).toBe('');
    expect(image.style.objectFit).toBe('fill');

    element.remove();
    await flush();
    const statusCountAfterDetach = statusChanges.length;
    decodes.requests[2].resolve();
    await flush();
    expect(statusChanges).toHaveLength(statusCountAfterDetach);
    decodes.restore();

    void ImageElement;
  });
});
