import { describe, expect, it, vi } from 'vitest';
import imageRoot from '../../../prototypes/base/src/image';
import { createMountedVueAdapter, flushVue } from './utils/vue';

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

describe('adapter-vue image view', () => {
  it('materializes one image root and projects source, a11y, fit, and status lifecycle', async () => {
    const decodes = controlImageDecodes();
    const transitions: string[] = [];
    const mounted = createMountedVueAdapter(imageRoot, {
      source: 'image:a',
      a11yMode: 'informative',
      alternativeText: 'Image A',
      fit: 'cover',
      surfaceClass: 'surface-image',
      onLoadingStatusChange: (event: { status: string }) => transitions.push(event.status),
    });
    let unmounted = false;
    try {
      await flushVue();
      const image = mounted.root as HTMLImageElement;
      const exposes = mounted.vm.getExposes() as {
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
      await flushVue();
      expect(exposes.loadingStatus.get()).toBe('loaded');
      expect(transitions).toEqual(['loading', 'loaded']);

      mounted.unmount();
      unmounted = true;
    } finally {
      if (!unmounted) mounted.unmount();
      decodes.restore();
    }
  });

  it('ignores a pending decode completion after unmount', async () => {
    const decodes = controlImageDecodes();
    const transitions: string[] = [];
    const mounted = createMountedVueAdapter(imageRoot, {
      a11yMode: 'informative',
      alternativeText: 'Pending image',
      source: 'image:pending',
      onLoadingStatusChange: (event: { status: string }) => transitions.push(event.status),
    });
    await flushVue();
    expect(decodes.requests).toHaveLength(1);
    expect(transitions).toEqual(['loading']);

    mounted.unmount();
    decodes.requests[0].reject(new Error('late error'));
    await flushVue();

    expect(transitions).toEqual(['loading']);
    decodes.restore();
  });
});
