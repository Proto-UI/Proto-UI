import { expect, it, vi } from 'vitest';
import imageRoot from '../../../prototypes/base/src/image';
import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';

it('T-IMAGE-VIEW-0001-CASE-VUE2: one physical image projects attributes and retires pending completion on unmount', async () => {
  let resolve!: () => void;
  const decode = vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      })
  );
  const onLoadingStatusChange = vi.fn();
  const m = createMountedVue2Adapter(imageRoot, {
    source: 'image:a',
    a11yMode: 'informative',
    alternativeText: 'A',
    fit: 'cover',
    onLoadingStatusChange,
  });
  let unmounted = false;
  try {
    await flushVue2();
    const image = m.root as HTMLImageElement;
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe('image:a');
    expect(image.alt).toBe('A');
    expect(image.style.objectFit).toBe('cover');
    expect(m.vm.getExposes().loadingStatus.get()).toBe('loading');
    expect(decode).toHaveBeenCalledTimes(1);
    const count = onLoadingStatusChange.mock.calls.length;
    m.unmount();
    unmounted = true;
    resolve();
    await flushVue2();
    expect(onLoadingStatusChange).toHaveBeenCalledTimes(count);
    expect(image.isConnected).toBe(false);
  } finally {
    if (!unmounted) m.unmount();
    decode.mockRestore();
  }
});

it('T-IMAGE-VIEW-0001-CASE-VUE2: source replacement retires old decode and accepts only the current request', async () => {
  const { Vue2Any, Vue2RuntimeAny } = await import('./utils/vue2');
  const { createVue2Adapter } = await import('../src/adapt');
  const requests: Array<() => void> = [];
  const decode = vi
    .spyOn(HTMLImageElement.prototype, 'decode')
    .mockImplementation(() => new Promise<void>((r) => requests.push(r)));
  const Component = createVue2Adapter(Vue2RuntimeAny)(imageRoot);
  const Root = Vue2Any.extend({
    data: () => ({ source: 'image:a' }),
    render(this: any, h: any) {
      return h(Component, {
        attrs: { source: this.source, a11yMode: 'informative', alternativeText: 'Image' },
      });
    },
  });
  const vm = new Root().$mount();
  document.body.append(vm.$el);
  try {
    await flushVue2();
    const child = vm.$children[0];
    vm.source = 'image:b';
    await flushVue2();
    expect(vm.$el.getAttribute('src')).toBe('image:b');
    expect(requests).toHaveLength(2);
    requests[0]();
    await flushVue2();
    expect(child.getExposes().loadingStatus.get()).toBe('loading');
    requests[1]();
    await flushVue2();
    expect(child.getExposes().loadingStatus.get()).toBe('loaded');
    vm.source = '';
    await flushVue2();
    expect(vm.$el.hasAttribute('src')).toBe(false);
    expect(child.getExposes().loadingStatus.get()).toBe('idle');
  } finally {
    vm.$destroy();
    vm.$el.remove();
    decode.mockRestore();
  }
});
