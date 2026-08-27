import { describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { registerPrototype } from '../../../../apps/www/src/components/PrototypePreviewer/registry';
import { Vue2Any, flushVue2 } from './utils/vue2';

vi.mock(
  '../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime',
  async () => {
    const actual = await vi.importActual<
      typeof import('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime')
    >('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime');

    return {
      ...actual,
      loadVue2: vi.fn(async () => Vue2Any),
    };
  }
);

describe('PrototypePreviewer demo-renderer / vue2', () => {
  it('renders a demo tree through the Vue 2 adapter branch', async () => {
    const proto = definePrototype({
      name: 'previewer-vue2-inline',
      setup(def) {
        def.props.define({
          label: { type: 'string', default: 'fallback' },
        });
        return (r) => [r.el('div', String(r.read.props.get().label)), r.slot()];
      },
    });

    registerPrototype('previewer-vue2-inline', proto as any);

    const { renderDemo } =
      await import('../../../../apps/www/src/components/PrototypePreviewer/demo-renderer');

    const host = document.createElement('div');
    document.body.appendChild(host);

    const session = await renderDemo({
      runtime: 'vue2',
      host,
      demo: {
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: 'previewer-vue2-inline',
          ref: 'target',
          className: 'rounded bg-red-500',
          props: { label: 'Vue 2 Button' },
          children: ['Hello'],
        },
      },
    });

    try {
      await flushVue2();

      const root = host.querySelector('[data-pui-root]') as HTMLElement | null;
      expect(root).not.toBeNull();
      expect(root?.classList.contains('rounded')).toBe(true);
      expect(root?.classList.contains('bg-red-500')).toBe(true);
      expect(root?.getAttribute('data-demo-ref')).toBe('target');
      expect(root?.textContent).toContain('Vue 2 Button');
      expect(root?.textContent).toContain('Hello');
    } finally {
      await session.destroy();
      host.remove();
    }
  });
});
