import { describe, expect, it, vi } from 'vitest';
import type { ImageViewPatch } from '@proto.ui/core';
import type { ImageViewHostCompletion, ImageViewHostConnection } from '../src/caps';
import { createWebImageViewHost, resolveWebImageLocalName } from '../src/web';

function createConnection(
  patch: ImageViewPatch,
  generation = 1,
  onStatusChange: (change: ImageViewHostCompletion) => void = () => {}
): ImageViewHostConnection {
  return { generation, patch, onStatusChange };
}

describe('module-image-view Web host bridge', () => {
  it('resolves the portable image requirement to one img target', () => {
    expect(resolveWebImageLocalName()).toBe('img');
  });

  it('accepts a synchronous cached image completion once per generation', () => {
    const image = document.createElement('img');
    Object.defineProperties(image, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 1 },
    });
    const changes: ImageViewHostCompletion[] = [];
    const lease = createWebImageViewHost(() => image).attach(
      createConnection(
        { source: 'image:cached-a', alternativeText: 'A', a11yMode: 'informative', fit: 'contain' },
        2,
        (change) => changes.push(change)
      )
    );

    expect(changes).toEqual([{ generation: 2, status: 'loaded' }]);
    expect(lease.snapshot()).toMatchObject({ source: 'image:cached-a', loadingStatus: 'loaded' });
    image.dispatchEvent(new Event('load'));
    expect(changes).toHaveLength(1);

    lease.update({
      generation: 3,
      patch: {
        source: 'image:cached-b',
        alternativeText: 'B',
        a11yMode: 'informative',
        fit: 'cover',
      },
    });
    expect(changes).toEqual([
      { generation: 2, status: 'loaded' },
      { generation: 3, status: 'loaded' },
    ]);
    lease.dispose();
  });

  it('projects source, informative alt text, fit, and load status', () => {
    const image = document.createElement('img');
    const changes: ImageViewHostCompletion[] = [];
    const lease = createWebImageViewHost(() => image).attach(
      createConnection(
        {
          source: 'image:a',
          alternativeText: 'Image A',
          a11yMode: 'informative',
          fit: 'cover',
          loadingStatus: 'loading',
        },
        4,
        (change) => changes.push(change)
      )
    );

    expect(image.getAttribute('src')).toBe('image:a');
    expect(image.alt).toBe('Image A');
    expect(image.style.objectFit).toBe('cover');
    expect(lease.snapshot()).toEqual({ source: 'image:a', loadingStatus: 'loading', fit: 'cover' });

    image.dispatchEvent(new Event('load'));
    expect(changes).toEqual([{ generation: 4, status: 'loaded' }]);
    expect(lease.snapshot()).toEqual({ source: 'image:a', loadingStatus: 'loaded', fit: 'cover' });
    lease.dispose();
  });

  it('clears source on replacement/removal and excludes decorative semantics', () => {
    const image = document.createElement('img');
    const changes: ImageViewHostCompletion[] = [];
    const lease = createWebImageViewHost(() => image).attach(
      createConnection(
        {
          source: 'image:a',
          alternativeText: 'Image A',
          a11yMode: 'informative',
          fit: 'contain',
          loadingStatus: 'loading',
        },
        1,
        (change) => changes.push(change)
      )
    );

    lease.update({
      generation: 2,
      patch: {
        source: 'image:b',
        alternativeText: 'Image B',
        a11yMode: 'decorative',
        fit: 'fill',
        loadingStatus: 'loading',
      },
    });
    expect(image.getAttribute('src')).toBe('image:b');
    expect(image.alt).toBe('');
    expect(image.style.objectFit).toBe('fill');
    expect(lease.snapshot()).toEqual({ source: 'image:b', loadingStatus: 'loading', fit: 'fill' });

    lease.update({
      generation: 3,
      patch: {
        source: '',
        alternativeText: '',
        a11yMode: 'informative',
        fit: 'contain',
        loadingStatus: 'idle',
      },
    });
    expect(image.hasAttribute('src')).toBe(false);
    expect(lease.snapshot()).toEqual({ source: '', loadingStatus: 'idle', fit: 'contain' });
    expect(changes).toEqual([]);
    lease.dispose();
  });

  it('clears a reused target when attaching an empty source', () => {
    const image = document.createElement('img');
    image.src = 'image:stale';
    const lease = createWebImageViewHost(() => image).attach(
      createConnection({ source: '', loadingStatus: 'idle' })
    );

    expect(image.hasAttribute('src')).toBe(false);
    expect(lease.snapshot()).toEqual({ source: '', loadingStatus: 'idle', fit: 'contain' });
    lease.dispose();
  });

  it('starts a new source request even when the prior patch was terminal', () => {
    const image = document.createElement('img');
    const lease = createWebImageViewHost(() => image).attach(
      createConnection({ source: 'image:a', loadingStatus: 'loading' })
    );

    image.dispatchEvent(new Event('load'));
    expect(lease.snapshot()?.loadingStatus).toBe('loaded');
    lease.update({ generation: 2, patch: { source: 'image:b' } });

    expect(lease.snapshot()).toMatchObject({ source: 'image:b', loadingStatus: 'loading' });
    lease.dispose();
  });

  it('propagates the current generation, suppresses duplicate terminal status, and disposes listeners', () => {
    const image = document.createElement('img');
    const changes: ImageViewHostCompletion[] = [];
    const lease = createWebImageViewHost(() => image).attach(
      createConnection(
        { source: 'image:a', alternativeText: 'A', a11yMode: 'informative', fit: 'contain' },
        7,
        (change) => changes.push(change)
      )
    );

    image.dispatchEvent(new Event('error'));
    image.dispatchEvent(new Event('load'));
    expect(changes).toEqual([{ generation: 7, status: 'error' }]);

    lease.update({
      generation: 8,
      patch: { source: 'image:b', alternativeText: 'B', a11yMode: 'informative', fit: 'cover' },
    });
    image.dispatchEvent(new Event('load'));
    expect(changes).toEqual([
      { generation: 7, status: 'error' },
      { generation: 8, status: 'loaded' },
    ]);

    lease.dispose();
    image.dispatchEvent(new Event('error'));
    expect(changes).toHaveLength(2);
  });

  it('stops completion event propagation when requested', () => {
    const image = document.createElement('img');
    const stopPropagation = vi.spyOn(Event.prototype, 'stopPropagation');
    const lease = createWebImageViewHost(() => image, { stopPropagation: true }).attach(
      createConnection({
        source: 'image:a',
        alternativeText: 'A',
        a11yMode: 'informative',
        fit: 'contain',
      })
    );

    image.dispatchEvent(new Event('load', { bubbles: true }));
    expect(stopPropagation).toHaveBeenCalledOnce();
    lease.dispose();
    stopPropagation.mockRestore();
  });
});
