import * as React from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Vue2Any } from '../../adapters/vue2/test/utils/vue2';

import { renderDemo } from '../../../apps/www/src/components/PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../../../apps/www/src/components/PrototypePreviewer/prototype-modules';
import {
  AdapterIds,
  type RuntimeId,
} from '../../../apps/www/src/components/PrototypePreviewer/runtimes/registry';
import shadcnDialogDemo from '../../../apps/www/src/content/docs/zh-cn/demo-shadcn-dialog.demo';

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/react-runtime', () => ({
  loadReact: vi.fn(async () => ({
    React,
    ReactDOM: { createPortal, createRoot, flushSync },
  })),
}));

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime', () => ({
  loadVue: vi.fn(async () => Vue),
}));

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime', async () => {
  const actual = await vi.importActual<
    typeof import('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime')
  >('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime');
  return { ...actual, loadVue2: vi.fn(async () => Vue2Any) };
});

const WEB_ADAPTERS = ['wc', 'react', 'vue', 'vue2'] as const satisfies readonly RuntimeId[];
const DIALOG_PROTOTYPES = [
  'shadcn-dialog-root',
  'shadcn-dialog-trigger',
  'shadcn-dialog-mask',
  'shadcn-dialog-content',
  'shadcn-dialog-title',
  'shadcn-dialog-description',
  'shadcn-dialog-close',
  'shadcn-dialog-close-icon',
  'shadcn-dialog-header',
  'shadcn-dialog-footer',
  'shadcn-button',
] as const;

async function settle(): Promise<void> {
  await Promise.resolve();
  await Vue.nextTick();
  await Vue2Any.nextTick();
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

async function waitFor(assertion: () => boolean, timeoutMs = 1_500): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await settle();
    if (assertion()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  expect(assertion()).toBe(true);
}

function findButton(text: string, root: ParentNode = document): HTMLElement {
  const match = Array.from(
    root.querySelectorAll<HTMLElement>('[data-pui-root][role="button"]')
  ).find((element) => element.textContent?.trim() === text);
  expect(match, `expected button named \"${text}\"`).toBeTruthy();
  return match!;
}

function findCloseIcon(): HTMLElement {
  const match = document.querySelector<HTMLElement>(
    '[data-pui-root][role="button"][aria-label="Close"]'
  );
  expect(match, 'expected the Dialog CloseIcon button').toBeTruthy();
  return match!;
}

function findDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-pui-root][role="dialog"]');
}

function dialogIsOpen(): boolean {
  const dialog = findDialog();
  if (!dialog || dialog.hasAttribute('data-pui-view-detached')) return false;
  const state = dialog.getAttribute('data-transition-state');
  return state !== 'closed' && state !== 'leaving';
}

function dialogIsClosed(): boolean {
  const dialog = findDialog();
  if (!dialog || dialog.hasAttribute('data-pui-view-detached')) return true;
  const state = dialog.getAttribute('data-transition-state');
  return state === 'closed';
}

async function click(target: HTMLElement): Promise<void> {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  await settle();
}

async function press(target: EventTarget, key: string): Promise<void> {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  await settle();
}

function expectVisibleFocus(target: HTMLElement): void {
  expect(document.activeElement).toBe(target);
  expect(target.hasAttribute('data-focus-visible')).toBe(true);
}

function expectTransparentSemanticParent(target: HTMLElement): void {
  const parentRoot = target.parentElement?.closest<HTMLElement>('[data-pui-root]');
  expect(parentRoot).toBeTruthy();
  expect(parentRoot).not.toBe(target);
  expect(parentRoot?.tabIndex).toBe(-1);
  expect(parentRoot?.hasAttribute('role')).toBe(false);
  expect(parentRoot?.hasAttribute('data-pui-style')).toBe(false);
}

beforeAll(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
  expect([...WEB_ADAPTERS]).toEqual(AdapterIds);
  await loadPrototypes([...DIALOG_PROTOTYPES]);
});

afterAll(() => {
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe('Web adapter conformance / Shadcn Dialog keyboard journey', () => {
  it.each(WEB_ADAPTERS)(
    '%s completes the shared DOM interaction scenario',
    async (runtime) => {
      const beforePageStart = document.createElement('button');
      beforePageStart.textContent = 'Page start sentinel';
      const host = document.createElement('div');
      const outside = document.createElement('button');
      outside.textContent = 'Outside sentinel';
      document.body.append(beforePageStart, host, outside);

      const session = await renderDemo({
        runtime,
        demo: shadcnDialogDemo as any,
        host,
      });

      try {
        await settle();
        const trigger = findButton('Open Dialog', host);
        expectTransparentSemanticParent(trigger);
        const triggerSemanticParent =
          trigger.parentElement?.closest<HTMLElement>('[data-pui-root]');
        expect(triggerSemanticParent).toBeTruthy();

        await click(triggerSemanticParent!);
        expect(dialogIsClosed()).toBe(true);

        // Pointer activation is a required entry path, not only a keyboard fallback.
        await click(trigger);
        await waitFor(dialogIsOpen);
        await click(findButton('Cancel'));
        await waitFor(dialogIsClosed);

        // The same exact demo composition must expose one focus surface per
        // Trigger/Close group and keep focus-visible through a trapped cycle.
        await press(document, 'Tab');
        trigger.focus();
        await settle();
        expectVisibleFocus(trigger);

        await press(trigger, 'Enter');
        await waitFor(dialogIsOpen);

        const cancel = findButton('Cancel');
        const save = findButton('Save changes');
        const closeIcon = findCloseIcon();
        expectTransparentSemanticParent(cancel);
        expectTransparentSemanticParent(save);
        expectVisibleFocus(cancel);

        const cancelSemanticParent = cancel.parentElement?.closest<HTMLElement>('[data-pui-root]');
        expect(cancelSemanticParent).toBeTruthy();
        await click(cancelSemanticParent!);
        expect(dialogIsOpen()).toBe(true);

        await press(cancel, 'Tab');
        expectVisibleFocus(save);
        await press(save, 'Tab');
        expectVisibleFocus(closeIcon);
        await press(closeIcon, 'Tab');
        expectVisibleFocus(cancel);

        await press(cancel, 'Enter');
        await waitFor(dialogIsClosed);
        expectVisibleFocus(trigger);

        // Re-enter after pointer modality cleared the previous visible focus.
        await click(outside);
        outside.focus();
        await settle();
        expect(trigger.hasAttribute('data-focus-visible')).toBe(false);

        await press(document, 'Tab');
        trigger.focus();
        await settle();
        expectVisibleFocus(trigger);
        await press(trigger, 'Enter');
        await waitFor(dialogIsOpen);

        const secondCancel = findButton('Cancel');
        const secondSave = findButton('Save changes');
        expectVisibleFocus(secondCancel);
        await press(secondCancel, 'Tab');
        expectVisibleFocus(secondSave);
        await press(secondSave, 'Enter');
        await waitFor(dialogIsClosed);

        expectVisibleFocus(trigger);
        expect(document.activeElement).not.toBe(beforePageStart);
        expect(document.activeElement).not.toBe(document.body);
      } finally {
        await session.destroy();
        beforePageStart.remove();
        host.remove();
        outside.remove();
        document.body.style.overflow = '';
      }
    },
    20_000
  );
});
