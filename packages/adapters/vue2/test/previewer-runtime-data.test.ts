import { describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { Vue2Any } from './utils/vue2';

vi.mock(
  '../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime',
  async () => {
    const actual = await vi.importActual<
      typeof import('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime')
    >('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime');
    return actual;
  }
);

describe('PrototypePreviewer vue2 runtime data mapping', () => {
  it('splits host props, fallthrough attrs, class, style, and event listeners for Vue 2 VNodes', async () => {
    const { toVue2ComponentData } =
      await import('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime');
    const onSelect = vi.fn();

    const data = toVue2ComponentData({
      label: 'Button',
      disabled: true,
      hostClass: 'host-a',
      surfaceClass: 'surface-a',
      hostStyle: { color: 'red' },
      surfaceStyle: { margin: '4px' },
      class: 'fallthrough-a',
      style: { padding: '8px' },
      onSelect,
    });

    expect(data.props).toEqual({
      hostClass: 'host-a',
      surfaceClass: 'surface-a',
      hostStyle: { color: 'red' },
      surfaceStyle: { margin: '4px' },
    });
    expect(data.attrs).toEqual({
      label: 'Button',
      disabled: true,
    });
    expect(data.class).toBe('fallthrough-a');
    expect(data.style).toEqual({ padding: '8px' });
    expect(data.on.select).toBe(onSelect);
  });

  it('does not append a stale mount after unmounting while the runtime loader is pending', async () => {
    const { createVue2Runtime } =
      await import('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime');
    let resolveVue: ((value: typeof Vue2Any) => void) | undefined;
    const pendingVue = new Promise<typeof Vue2Any>((resolve) => {
      resolveVue = resolve;
    });
    const api = createVue2Runtime(() => pendingVue);
    const proto = definePrototype({
      name: 'vue2-previewer-stale-mount',
      setup() {
        return (r) => [r.el('div', 'stale')];
      },
    });
    const host = document.createElement('div');
    document.body.appendChild(host);

    try {
      const mounting = api.mount(host, proto);
      api.unmount(host);
      resolveVue?.(Vue2Any);
      await mounting;

      expect(host.childElementCount).toBe(0);
      expect(host.textContent).toBe('');
    } finally {
      api.unmount(host);
      host.remove();
    }
  });

  it('does not append a stale Vue 2 mount after another runtime claims the host', async () => {
    const { createVue2Runtime } =
      await import('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime');
    const { claimHostMount } =
      await import('../../../../apps/www/src/components/PrototypePreviewer/runtimes/host-mount');
    let resolveVue: ((value: typeof Vue2Any) => void) | undefined;
    const pendingVue = new Promise<typeof Vue2Any>((resolve) => {
      resolveVue = resolve;
    });
    const api = createVue2Runtime(() => pendingVue);
    const proto = definePrototype({
      name: 'vue2-previewer-cross-runtime-stale-mount',
      setup() {
        return (r) => [r.el('div', 'stale')];
      },
    });
    const host = document.createElement('div');
    document.body.appendChild(host);

    try {
      const mounting = api.mount(host, proto);
      const current = claimHostMount(host);
      host.textContent = 'current runtime';
      current.commit(() => {});
      resolveVue?.(Vue2Any);
      await mounting;

      expect(host.textContent).toBe('current runtime');
    } finally {
      api.unmount(host);
      host.remove();
    }
  });
});
