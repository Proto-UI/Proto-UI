import { describe, expect, it, vi } from 'vitest';
import imageRoot from '../../../prototypes/base/src/image';
import { createVueAdapter } from '../src';
import { createMountedVueAdapter, flushVue, VueAny } from './utils/vue';

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
  it('replaces the source without accepting the queued completion for the old request', async () => {
    const decodes = controlImageDecodes();
    const transitions: string[] = [];
    const state = VueAny.reactive({
      source: 'image:a',
      a11yMode: 'informative',
      alternativeText: 'Image A',
      fit: 'cover',
      surfaceClass: 'surface-image',
      onLoadingStatusChange: (event: { status: string }) => transitions.push(event.status),
    });
    const adapterRef = VueAny.ref(null);
    const Component = createVueAdapter(VueAny)(imageRoot);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = VueAny.createApp({
      setup() {
        return () => VueAny.h(Component, { ...state, ref: adapterRef });
      },
    });
    let mounted = false;
    try {
      app.mount(host);
      mounted = true;
      await flushVue();
      const image = host.firstElementChild as HTMLImageElement;
      const exposes = adapterRef.value.getExposes() as {
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
      expect(decodes.requests).toHaveLength(1);

      Object.assign(state, {
        source: 'image:b',
        alternativeText: 'Image B',
        fit: 'contain',
        surfaceClass: 'surface-next',
      });
      await flushVue();

      expect(host.firstElementChild).toBe(image);
      expect(image.getAttribute('src')).toBe('image:b');
      expect(image.alt).toBe('Image B');
      expect(image.style.objectFit).toBe('contain');
      expect(image.classList.contains('surface-image')).toBe(false);
      expect(image.classList.contains('surface-next')).toBe(true);
      expect(exposes.source.get()).toBe('image:b');
      expect(exposes.loadingStatus.get()).toBe('loading');
      expect(decodes.requests).toHaveLength(2);

      decodes.requests[0].resolve();
      await flushVue();
      expect(exposes.loadingStatus.get()).toBe('loading');
      expect(transitions).toEqual(['loading']);

      decodes.requests[1].resolve();
      await flushVue();
      expect(exposes.loadingStatus.get()).toBe('loaded');
      expect(transitions).toEqual(['loading', 'loaded']);
    } finally {
      if (mounted) app.unmount();
      host.remove();
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
