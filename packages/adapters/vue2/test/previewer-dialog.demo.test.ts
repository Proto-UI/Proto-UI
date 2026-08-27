import { describe, expect, it, vi } from 'vitest';

import { Vue2Any } from './utils/vue2';

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

import { loadPrototypes } from '../../../../apps/www/src/components/PrototypePreviewer/prototype-modules';
import baseDialogDemo from '../../../../apps/www/src/content/docs/zh-cn/demo-base-dialog.demo';

async function settleVue2() {
  await Promise.resolve();
  await Vue2Any.nextTick();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await Promise.resolve();
  await Vue2Any.nextTick();
}

async function waitForText(root: ParentNode, text: string, present: boolean, timeoutMs = 1_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const found = Array.from(
      root.querySelectorAll<HTMLElement>('[data-pui-root][role="dialog"]')
    ).some(
      (element) =>
        element.textContent?.includes(text) &&
        !element.hasAttribute('data-pui-view-detached') &&
        !['closed', 'leaving'].includes(element.getAttribute('data-transition-state') ?? '')
    );
    if (found === present) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

function findExactText(root: ParentNode, text: string): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>('[data-pui-root][role="button"]')).find(
      (element) => element.textContent?.trim() === text
    ) ?? null
  );
}

describe('PrototypePreviewer demo-renderer / vue2 dialog', () => {
  it('runs the actual dialog demo through the Vue 2 runtime', async () => {
    await loadPrototypes([
      'base-dialog-root',
      'base-dialog-trigger',
      'base-dialog-mask',
      'base-dialog-content',
      'base-dialog-title',
      'base-dialog-description',
      'base-dialog-close',
    ]);
    const host = document.createElement('div');
    document.body.appendChild(host);

    const { renderDemo } =
      await import('../../../../apps/www/src/components/PrototypePreviewer/demo-renderer');
    const session = await renderDemo({
      runtime: 'vue2',
      demo: baseDialogDemo as any,
      host,
    });

    try {
      await settleVue2();
      const trigger = findExactText(host, 'Open Dialog');
      expect(trigger).not.toBeNull();

      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(await waitForText(document.body, 'Confirm Action', true)).toBe(true);

      const content = Array.from(
        document.body.querySelectorAll<HTMLElement>('[data-pui-root][role="dialog"]')
      ).find(
        (element) =>
          element.textContent?.includes('Confirm Action') &&
          !element.hasAttribute('data-pui-view-detached')
      );
      expect(content).toBeDefined();
      expect(host.contains(content ?? null)).toBe(false);

      const close = findExactText(document.body, 'Cancel');
      expect(close).not.toBeNull();
      close?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(await waitForText(document.body, 'Confirm Action', false)).toBe(true);
    } finally {
      await session.destroy();
      host.remove();
    }
  });
});
