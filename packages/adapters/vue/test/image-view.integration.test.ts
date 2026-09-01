import { describe, expect, it } from 'vitest';
import imageRoot from '../../../prototypes/base/src/image';
import { createMountedVueAdapter, flushVue } from './utils/vue';

describe('adapter-vue image view', () => {
  it('materializes one image root and projects source, a11y, fit, and status lifecycle', async () => {
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

      image.dispatchEvent(new Event('load'));
      await flushVue();
      expect(exposes.loadingStatus.get()).toBe('loaded');
      expect(transitions).toEqual(['loading', 'loaded']);

      const transitionCountBeforeUnmount = transitions.length;
      mounted.unmount();
      unmounted = true;
      image.dispatchEvent(new Event('error'));
      await flushVue();
      expect(transitions).toHaveLength(transitionCountBeforeUnmount);
    } finally {
      if (!unmounted) mounted.unmount();
    }
  });
});
