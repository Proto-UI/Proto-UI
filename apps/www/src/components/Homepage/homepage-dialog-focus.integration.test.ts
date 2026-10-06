import { afterEach, expect, it, vi } from 'vitest';
import { renderDemo } from '../PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../PrototypePreviewer/prototype-modules';
import { createHomepageShowcase } from './homepage-showcase';

// Use the same installed React18 pair as the production website. These are
// actual frameworks/portals/Transition, but input and a bounded initial native
// acquisition refusal are controlled. Hosted Homepage capture proves native QA.
vi.mock('../PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve(process.cwd(), 'apps/www/package.json'));
  const React = require('react');
  const ReactDOM = { ...require('react-dom'), ...require('react-dom/client') };
  if (!React.version.startsWith('18.')) throw new Error(`Expected React18, got ${React.version}`);
  return { loadReact: async () => ({ React, ReactDOM }) };
});
let rendered: Awaited<ReturnType<typeof renderDemo>> | undefined;
afterEach(async () => {
  try {
    await rendered?.destroy();
  } finally {
    rendered = undefined;
    vi.restoreAllMocks();
    document.body.replaceChildren();
  }
});

for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
  for (const delayed of [false, true]) {
    it(`${runtime} Gallery Dialog enters and restores focus after initial acquisition delay=${delayed}`, async () => {
      const errors: string[] = [];
      const onError = (event: ErrorEvent) => errors.push(event.message);
      window.addEventListener('error', onError);
      const content = createHomepageShowcase('shadcn', runtime, 'en', () => true);
      await loadPrototypes([...content.recipe.prototypeIds]);
      const host = document.createElement('div');
      document.body.append(host);
      try {
        rendered = await renderDemo({ runtime, demo: content.demo, host });
        const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
        ref('gallery-primary').click();
        await expect.poll(() => ref('gallery-controls-feedback').textContent).toContain('✓');
        const editorRoot = ref('editor-text');
        const editor = (
          editorRoot.matches('textarea') ? editorRoot : editorRoot.querySelector('textarea')
        ) as HTMLTextAreaElement;
        editor.focus();
        editor.value = 'Edit directly. Preview immediately.';
        editor.dispatchEvent(
          new InputEvent('input', { bubbles: true, data: editor.value, inputType: 'insertText' })
        );
        ref('editor-bold').click();
        await expect
          .poll(() =>
            [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find(
              (el) => el.textContent?.trim() === 'Preview'
            )
          )
          .toBeTruthy();
        [...host.querySelectorAll<HTMLElement>('[role="tab"]')]
          .find((el) => el.textContent?.trim() === 'Preview')!
          .click();
        await expect
          .poll(() => ref('editor-preview').textContent)
          .toBe('Edit directly. Preview immediately.');
        const trigger = [...host.querySelectorAll<HTMLElement>('[role="button"]')].find(
          (el) => el.textContent?.trim() === 'Open dialog'
        )!;
        trigger.focus();
        const frames: FrameRequestCallback[] = [];
        const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
          frames.push(fn);
          return frames.length;
        });
        let canAcquire = !delayed;
        let refused = 0;
        const nativeFocus = HTMLElement.prototype.focus;
        const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
          this: HTMLElement,
          options
        ) {
          if (!canAcquire && this.closest('[role="dialog"]')) {
            refused++;
            return;
          }
          nativeFocus.call(this, options);
        });
        trigger.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            button: 0,
            pointerId: 1,
            pointerType: 'mouse',
          })
        );
        trigger.focus();
        trigger.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            button: 0,
            pointerId: 1,
            pointerType: 'mouse',
          })
        );
        trigger.click();
        await expect.poll(() => document.querySelector('[role="dialog"]')).toBeTruthy();
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
        if (delayed) {
          expect(refused).toBeGreaterThan(0);
          expect(dialog.contains(document.activeElement)).toBe(false);
        }
        canAcquire = true;
        await expect
          .poll(() => {
            frames.splice(0).forEach((fn) => fn(performance.now()));
            return dialog.contains(document.activeElement);
          })
          .toBe(true);
        expect(dialog.closest('[data-pui-view-detached]')).toBeNull();
        const cancel = [...dialog.querySelectorAll<HTMLElement>('[role="button"]')].find(
          (el) => el.textContent?.trim() === 'Cancel'
        )!;
        cancel.click();
        await expect.poll(() => document.activeElement === trigger).toBe(true);
        expect(errors).toEqual([]);
        focus.mockRestore();
        raf.mockRestore();
      } finally {
        window.removeEventListener('error', onError);
      }
    });
  }
}
