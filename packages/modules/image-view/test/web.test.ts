import { describe, expect, it, vi } from 'vitest';
import type { ImageViewPatch } from '@proto.ui/core';
import type {
  ImageViewHostCompletion,
  ImageViewHostConnection,
  ImageViewHostLease,
} from '../src/caps';
import { createWebImageViewHost, resolveWebImageLocalName } from '../src/web';

function createConnection(
  patch: ImageViewPatch,
  generation = 1,
  onStatusChange: (change: ImageViewHostCompletion) => void = () => {}
): ImageViewHostConnection {
  return { generation, patch, onStatusChange };
}

type DecodeRequest = {
  resolve(): void;
  reject(error?: unknown): void;
};

function controlDecodes(image: HTMLImageElement): DecodeRequest[] {
  const requests: DecodeRequest[] = [];
  Object.defineProperty(image, 'decode', {
    configurable: true,
    value: vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          requests.push({ resolve, reject });
        })
    ),
  });
  return requests;
}

async function flushCompletion(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
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

  it('projects source, informative alt text, fit, and load status', async () => {
    const image = document.createElement('img');
    const requests = controlDecodes(image);
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

    requests[0].resolve();
    await flushCompletion();
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

  it('starts a new source request even when the prior patch was terminal', async () => {
    const image = document.createElement('img');
    const requests = controlDecodes(image);
    const lease = createWebImageViewHost(() => image).attach(
      createConnection({ source: 'image:a', loadingStatus: 'loading' })
    );

    requests[0].resolve();
    await flushCompletion();
    expect(lease.snapshot()?.loadingStatus).toBe('loaded');
    lease.update({ generation: 2, patch: { source: 'image:b' } });

    expect(requests).toHaveLength(2);
    expect(lease.snapshot()).toMatchObject({ source: 'image:b', loadingStatus: 'loading' });
    lease.dispose();
  });

  it('rejects a completion retained from an older source generation', async () => {
    const image = document.createElement('img');
    const requests = controlDecodes(image);
    const changes: ImageViewHostCompletion[] = [];
    const lease = createWebImageViewHost(() => image).attach(
      createConnection({ source: 'image:a', loadingStatus: 'loading' }, 7, (change) =>
        changes.push(change)
      )
    );

    lease.update({ generation: 8, patch: { source: 'image:b' } });

    expect(requests).toHaveLength(2);
    image.dispatchEvent(new Event('load'));
    image.dispatchEvent(new Event('error'));
    expect(changes).toEqual([]);
    requests[0].resolve();
    await flushCompletion();
    expect(changes).toEqual([]);
    expect(lease.snapshot()).toMatchObject({ source: 'image:b', loadingStatus: 'loading' });
    requests[1].resolve();
    await flushCompletion();
    expect(changes).toEqual([{ generation: 8, status: 'loaded' }]);
    lease.dispose();
  });

  it('propagates the current generation, suppresses raw terminal events, and disposes', async () => {
    const image = document.createElement('img');
    const requests = controlDecodes(image);
    const changes: ImageViewHostCompletion[] = [];
    const lease = createWebImageViewHost(() => image).attach(
      createConnection(
        { source: 'image:a', alternativeText: 'A', a11yMode: 'informative', fit: 'contain' },
        7,
        (change) => changes.push(change)
      )
    );

    requests[0].reject(new Error('image:a failed'));
    await flushCompletion();
    image.dispatchEvent(new Event('load'));
    image.dispatchEvent(new Event('error'));
    expect(changes).toEqual([{ generation: 7, status: 'error' }]);

    lease.update({
      generation: 8,
      patch: { source: 'image:b', alternativeText: 'B', a11yMode: 'informative', fit: 'cover' },
    });
    requests[1].resolve();
    await flushCompletion();
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
    let lease: ImageViewHostLease | null = null;
    try {
      lease = createWebImageViewHost(() => image, { stopPropagation: true }).attach(
        createConnection({
          source: 'image:a',
          alternativeText: 'A',
          a11yMode: 'informative',
          fit: 'contain',
        })
      );

      image.dispatchEvent(new Event('load', { bubbles: true }));
      expect(stopPropagation).toHaveBeenCalledOnce();
    } finally {
      lease?.dispose();
      stopPropagation.mockRestore();
    }
  });
});
