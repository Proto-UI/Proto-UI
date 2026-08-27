import { PUI_VIEW_DETACHED_ATTR } from '@proto.ui/adapter-base';
import { describe, expect, it, vi } from 'vitest';
import { VueAny } from './utils/vue';

import { loadPrototypes } from '../../../../apps/www/src/components/PrototypePreviewer/prototype-modules';
import baseDialogDemo from '../../../../apps/www/src/content/docs/zh-cn/demo-base-dialog.demo';

vi.mock('../../../../apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime', () => ({
  loadVue: vi.fn(async () => VueAny),
}));

async function settle() {
  await Promise.resolve();
  await VueAny.nextTick();
  await Promise.resolve();
}

async function waitForDialogPresent(text: string, timeoutMs = 1_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const element = Array.from(document.body.querySelectorAll('[data-transition-state]')).find(
      (candidate) => candidate.textContent?.includes(text)
    );
    const state = element?.getAttribute('data-transition-state');
    if (state === 'entering' || state === 'entered') return element;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  return null;
}

async function waitForDialogAbsent(text: string, timeoutMs = 1_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const element = Array.from(document.body.querySelectorAll('[data-transition-state]')).find(
      (candidate) => candidate.textContent?.includes(text)
    );
    // Closed overlay content stays mounted and detached, so absence means the
    // content is gone or sitting inside a detached subtree.
    if (!element || element.closest(`[${PUI_VIEW_DETACHED_ATTR}]`)) return true;
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

// Controls authored under a closed overlay mount while it is detached and are
// moved into the committed template when it becomes present, so their a11y
// projection lands a tick after the content reports its transition state.
async function waitForExactText(root: ParentNode, text: string, timeoutMs = 1_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const element = findExactText(root, text);
    if (element) return element;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  return null;
}

describe('PrototypePreviewer demo-renderer / vue dialog', () => {
  it('opens again after a portaled dialog closes and detaches', async () => {
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
      runtime: 'vue',
      demo: baseDialogDemo as any,
      host,
    });

    try {
      await settle();
      const trigger = findExactText(host, 'Open Dialog');
      expect(trigger).not.toBeNull();

      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(await waitForDialogPresent('Confirm Action')).not.toBeNull();

      const close = await waitForExactText(document.body, 'Cancel');
      expect(close).not.toBeNull();
      close?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(await waitForDialogAbsent('Confirm Action')).toBe(true);
      await settle();

      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(await waitForDialogPresent('Confirm Action')).not.toBeNull();
    } finally {
      await session.destroy();
      host.remove();
    }
  });
});
