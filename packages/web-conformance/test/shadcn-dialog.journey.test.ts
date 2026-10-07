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
} from '../../../apps/www/src/components/PrototypePreviewer/runtimes/ids';
import shadcnDialogDemo from '../../../apps/www/src/content/docs/zh-cn/demo-shadcn-dialog.demo';
import type {
  DemoChild,
  DemoSpec,
} from '../../../apps/www/src/components/PrototypePreviewer/demo-types';
import { styleContains } from '../../prototypes/test-utils/style';

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

function expectConsumerActionLayout(target: HTMLElement): HTMLElement {
  expectTransparentSemanticParent(target);
  const close = target.parentElement?.closest<HTMLElement>('[data-pui-root]');
  const layout = close?.parentElement;
  expect(layout?.tagName).toBe('DIV');
  expect(layout?.classList.contains('min-w-0')).toBe(true);
  expect(layout?.classList.contains('max-w-full')).toBe(true);
  expect(layout?.hasAttribute('data-pui-root')).toBe(false);
  expect(layout?.hasAttribute('role')).toBe(false);
  expect(layout?.tabIndex).toBe(-1);
  expect(styleContains(layout!.parentElement!, 'flex-wrap-reverse')).toBe(true);
  for (const token of ['min-w-0', 'max-w-full', 'h-auto', 'whitespace-normal', 'break-words']) {
    expect(styleContains(target, token), `Button retains its ${token} opt-in`).toBe(true);
  }
  return layout!;
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
        expectConsumerActionLayout(cancel);
        expectConsumerActionLayout(save);
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

// Happy DOM proves ownership and the real consumer recipe, not native geometry.
// dialog-available-space.browser.test.ts supplies the 320px / 200% text oracle.
describe('Web adapter conformance / Shadcn Dialog long-action composition', () => {
  it.each(WEB_ADAPTERS)(
    '%s keeps long labels on the sole Button surface',
    async (runtime) => {
      const cancelLabel = '取消此次个人资料修改并返回上一页';
      const saveLabel = '保存全部个人资料更改并继续下一步';
      const demo = structuredClone(shadcnDialogDemo) as DemoSpec;
      const localize = (node: DemoChild): void => {
        if (typeof node === 'string' || node.kind === 'text') return;
        if (node.kind === 'proto' && node.prototypeId === 'shadcn-button') {
          if (node.children?.[0] === 'Cancel') node.children = [cancelLabel];
          if (node.children?.[0] === 'Save changes') node.children = [saveLabel];
        }
        node.children?.forEach(localize);
      };
      localize(demo.root);
      const host = document.createElement('div');
      document.body.append(host);
      const session = await renderDemo({ runtime, demo, host });
      try {
        await settle();
        const trigger = findButton('Open Dialog', host);
        await press(document, 'Tab');
        trigger.focus();
        await press(trigger, 'Enter');
        await waitFor(dialogIsOpen);
        const cancel = findButton(cancelLabel);
        const save = findButton(saveLabel);
        const cancelLayout = expectConsumerActionLayout(cancel);
        expectConsumerActionLayout(save);
        expect(findDialog()!.querySelectorAll('[role="button"]')).toHaveLength(3);
        expectVisibleFocus(cancel);
        await click(cancelLayout);
        expect(dialogIsOpen()).toBe(true);
        await press(cancel, 'Tab');
        expectVisibleFocus(save);
        await press(save, 'Tab');
        expectVisibleFocus(findCloseIcon());
        await press(findCloseIcon(), 'Tab');
        expectVisibleFocus(cancel);
        await press(cancel, 'Enter');
        await waitFor(dialogIsClosed);
        expectVisibleFocus(trigger);
      } finally {
        await session.destroy();
        host.remove();
        document.body.style.overflow = '';
      }
    },
    20_000
  );
});
