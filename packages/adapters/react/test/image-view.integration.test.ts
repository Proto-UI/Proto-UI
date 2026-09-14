import { describe, expect, it, vi } from 'vitest';
import imageRoot from '../../../prototypes/base/src/image';
import { createMountedReactAdapter } from './utils/fake-react';

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

async function flushCompletion(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('adapter-react image view', () => {
  it('materializes one image root and projects source, a11y, fit, and status lifecycle', async () => {
    const transitions: string[] = [];
    const decodes = controlImageDecodes();
    const mounted = createMountedReactAdapter(imageRoot, {
      source: 'image:a',
      a11yMode: 'informative',
      alternativeText: 'Image A',
      fit: 'cover',
      surfaceClassName: 'surface-image',
      onLoadingStatusChange: (event: { status: string }) => transitions.push(event.status),
    });
    const image = mounted.root as HTMLImageElement;
    const exposes = mounted.ref.current.getExposes() as {
      source: { get(): string };
      loadingStatus: { get(): string };
      fit: { get(): string };
    };

    expect(image.tagName.toLowerCase()).toBe('img');
    expect(image.getAttribute('src')).toBe('image:a');
    expect(image.alt).toBe('Image A');
    expect(image.style.objectFit).toBe('cover');
    expect(image.classList.contains('surface-image')).toBe(true);
    expect(exposes.source.get()).toBe('image:a');
    expect(exposes.fit.get()).toBe('cover');
    expect(exposes.loadingStatus.get()).toBe('loading');

    decodes.requests[0].resolve();
    await flushCompletion();
    expect(exposes.loadingStatus.get()).toBe('loaded');
    expect(transitions).toEqual(['loading', 'loaded']);

    mounted.update({
      source: 'image:b',
      a11yMode: 'informative',
      alternativeText: 'Image B',
      fit: 'contain',
      surfaceClassName: 'surface-next',
      onLoadingStatusChange: (event: { status: string }) => transitions.push(event.status),
    });
    expect(image.getAttribute('src')).toBe('image:b');
    expect(image.alt).toBe('Image B');
    expect(image.style.objectFit).toBe('contain');
    expect(image.classList.contains('surface-image')).toBe(false);
    expect(image.classList.contains('surface-next')).toBe(true);
    expect(exposes.loadingStatus.get()).toBe('loading');

    decodes.requests[1].reject(new Error('image:b failed'));
    await flushCompletion();
    expect(exposes.loadingStatus.get()).toBe('error');
    expect(transitions).toEqual(['loading', 'loaded', 'loading', 'error']);

    mounted.update({
      source: 'image:c',
      a11yMode: 'decorative',
      alternativeText: '',
      fit: 'fill',
      onLoadingStatusChange: (event: { status: string }) => transitions.push(event.status),
    });
    expect(image.getAttribute('src')).toBe('image:c');
    expect(image.alt).toBe('');
    expect(image.style.objectFit).toBe('fill');

    const transitionCountBeforeUnmount = transitions.length;
    mounted.unmount();
    decodes.requests[2].resolve();
    await flushCompletion();
    expect(transitions).toHaveLength(transitionCountBeforeUnmount);
    decodes.restore();
  });
});
