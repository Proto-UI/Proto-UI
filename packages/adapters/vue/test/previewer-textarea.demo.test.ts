import { describe, expect, it, vi } from 'vitest';
import { VueAny } from './utils/vue';

import { loadPrototypes } from '../../../../apps/www/src/components/PrototypePreviewer/prototype-modules';
import baseTextareaDemo from '../../../../apps/www/src/content/docs/zh-cn/demo-base-textarea.demo';

vi.mock('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime', () => ({
  loadVue: vi.fn(async () => VueAny),
}));

async function settle() {
  await Promise.resolve();
  await VueAny.nextTick();
  await Promise.resolve();
}

describe('PrototypePreviewer demo-renderer / vue textarea', () => {
  it('projects normalized demo classes to the physical textarea surface', async () => {
    await loadPrototypes(['base-textarea-root']);
    const host = document.createElement('div');
    document.body.appendChild(host);

    const { renderDemo } =
      await import('../../../../apps/www/src/components/PrototypePreviewer/demo-renderer');
    const session = await renderDemo({
      runtime: 'vue',
      demo: baseTextareaDemo as any,
      host,
    });

    try {
      await settle();
      const textarea = host.querySelector('textarea[data-demo-ref="textarea"]');
      expect(textarea).not.toBeNull();
      expect(textarea?.classList.contains('block')).toBe(true);
      expect(textarea?.classList.contains('w-full')).toBe(true);
      expect(textarea?.classList.contains('border-2')).toBe(true);
      expect(textarea?.classList.contains('outline-none')).toBe(true);
    } finally {
      await session.destroy();
      host.remove();
    }
  });
});
