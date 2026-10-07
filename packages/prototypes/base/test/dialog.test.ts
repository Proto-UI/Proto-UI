import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { styleContains } from '../../test-utils/style';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import {
  dialogClose,
  dialogContent,
  dialogDescription,
  dialogMask,
  dialogRoot,
  dialogTitle,
  dialogTrigger,
} from '../src/dialog';
import type {
  DialogRootProps,
  DialogRootExposes,
  DialogContentProps,
  DialogContentExposes,
} from '../src/dialog/types';

const ownedElements = new Set<HTMLElement>();
const lifecycle = new Map<string, { created: number; disposed: number }>();
const dialogPrototypes = [
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
];

for (const proto of dialogPrototypes) {
  AdaptToWebComponent(proto as any, {
    diagnostics: {
      onLifecycleEvent(event) {
        const counts = lifecycle.get(proto.name) ?? { created: 0, disposed: 0 };
        if (event.type === 'instance.created') counts.created++;
        if (event.type === 'instance.dispose.done') counts.disposed++;
        lifecycle.set(proto.name, counts);
      },
    },
  });
}

function createDialogElement(tagName: string): HTMLElement {
  const element = document.createElement(tagName);
  ownedElements.add(element);
  return element;
}

beforeEach(() => {
  lifecycle.clear();
  ownedElements.clear();
});

async function disposeOwnedDialogElements(): Promise<void> {
  // The fixture owns every Custom Element it created, including parts whose
  // physical portal no longer sits inside Root. Observe actual terminal
  // lifecycle completion before Happy DOM destroys their owner document.
  for (const element of ownedElements) {
    if (element.isConnected) element.remove();
  }
  await expect
    .poll(() => [...lifecycle].filter(([, counts]) => counts.created !== counts.disposed))
    .toEqual([]);
  expect([...ownedElements].every((element) => !element.isConnected)).toBe(true);
}

afterEach(disposeOwnedDialogElements);

async function flushViewReconciliation(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function completeTransitions(...elements: any[]): Promise<void> {
  for (const element of elements) {
    const exposes = element?.getExposes?.();
    const state = exposes?.transitionState?.get?.();
    if (state === 'entering' || state === 'leaving') exposes.controls.complete();
  }
  await flushViewReconciliation();
}

describe('prototypes/base: dialog', () => {
  it('preserves focus against backdrop default actions without owning dismissal or passthrough', async () => {
    const root = document.createElement('base-dialog-root') as any;
    const mask = document.createElement('base-dialog-mask') as any;
    setElementProps(root, { open: true });
    root.append(mask);
    document.body.append(root);
    await flushViewReconciliation();
    try {
      const down = new Event('pointerdown', { bubbles: true, cancelable: true });
      mask.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      expect(root.getExposes().open.get()).toBe(true);
      setElementProps(mask, { passthrough: true });
      const pass = new Event('pointerdown', { bubbles: true, cancelable: true });
      mask.dispatchEvent(pass);
      expect(pass.defaultPrevented).toBe(false);
    } finally {
      root.remove();
      await flushViewReconciliation();
    }
  });
  it('uncontrolled root toggles open from trigger click and closes from close click', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;
    const close = createDialogElement('base-dialog-close') as any;

    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    content.appendChild(close);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(mask.hasAttribute('data-pui-view-detached')).toBe(true);

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(styleContains(content, 'hidden')).toBe(false);
    expect(styleContains(mask, 'hidden')).toBe(false);

    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await completeTransitions(mask, content);

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(mask.hasAttribute('data-pui-view-detached')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('controlled root keeps prop state while trigger and close emit openChange requests', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;
    const close = createDialogElement('base-dialog-close') as any;
    const requests: any[] = [];
    root.addEventListener('openChange', (event: Event) => {
      requests.push((event as CustomEvent).detail);
    });

    setElementProps(root, { open: false });
    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    content.appendChild(close);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(requests).toEqual([]);

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushViewReconciliation();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(requests).toEqual([
      expect.objectContaining({ open: true, reason: 'trigger.press', focusReason: 'pointer' }),
    ]);

    setElementProps(root, { open: true });
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(requests).toEqual([expect.objectContaining({ open: true, reason: 'trigger.press' })]);
    expect(styleContains(content, 'hidden')).toBe(false);
    expect(styleContains(mask, 'hidden')).toBe(false);

    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(requests).toEqual([
      expect.objectContaining({ open: true, reason: 'trigger.press' }),
      expect.objectContaining({ open: false, reason: 'close.press', focusReason: 'pointer' }),
    ]);

    setElementProps(root, { open: false });
    await Promise.resolve();
    await completeTransitions(mask, content);

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(mask.hasAttribute('data-pui-view-detached')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('controlled dismissal emits requests without closing before the owner updates open', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;
    const requests: any[] = [];
    root.addEventListener('openChange', (event: Event) => {
      requests.push((event as CustomEvent).detail);
    });

    setElementProps(root, { open: true });
    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    document.body.appendChild(root);
    await flushViewReconciliation();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushViewReconciliation();
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().transitionState.get()).not.toBe('leaving');

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flushViewReconciliation();
    expect(root.getExposes().open.get()).toBe(true);
    expect(requests).toEqual([
      expect.objectContaining({ open: false, reason: 'escape', focusReason: 'keyboard' }),
      expect.objectContaining({ open: false, reason: 'outside.press', focusReason: 'pointer' }),
    ]);

    root.remove();
    await Promise.resolve();
  });

  it('controlled root methods emit requests without replacing the owner open fact', async () => {
    // T-BASE-DIALOG-0001-CASE-CONTROLLED-METHODS
    const root = createDialogElement('base-dialog-root') as any;
    const requests: any[] = [];
    root.addEventListener('openChange', (event: Event) => {
      requests.push((event as CustomEvent).detail);
    });
    setElementProps(root, { open: false });
    document.body.appendChild(root);

    await Promise.resolve();

    root.getExposes().openDialog('root.method.open');
    expect(root.getExposes().open.get()).toBe(false);
    expect(requests).toEqual([
      expect.objectContaining({
        open: true,
        reason: 'root.method.open',
        focusReason: 'programmatic',
      }),
    ]);

    setElementProps(root, { open: true });
    await Promise.resolve();
    root.getExposes().toggle('root.method.toggle');

    expect(root.getExposes().open.get()).toBe(true);
    expect(requests.at(-1)).toEqual(
      expect.objectContaining({
        open: false,
        reason: 'root.method.toggle',
        focusReason: 'programmatic',
      })
    );

    root.remove();
    await Promise.resolve();
  });

  it('Trigger and Close command surfaces prevent focused Space default actions', async () => {
    // T-BASE-DIALOG-TRIGGER-0001-CASE-COMMAND
    // T-BASE-DIALOG-CLOSE-0001-CASE-COMMAND
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const content = createDialogElement('base-dialog-content') as any;
    const close = createDialogElement('base-dialog-close') as any;
    setElementProps(root, { defaultOpen: true });
    content.appendChild(close);
    root.append(trigger, content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    trigger.focus();
    const triggerSpace = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    window.dispatchEvent(triggerSpace);
    expect(triggerSpace.defaultPrevented).toBe(true);

    close.focus();
    const closeSpace = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    window.dispatchEvent(closeSpace);
    expect(closeSpace.defaultPrevented).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('ESC closes dialog content', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;

    setElementProps(root, { defaultOpen: true });
    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(styleContains(content, 'hidden')).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    await completeTransitions(mask, content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('outside press closes dialog content', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;

    setElementProps(root, { defaultOpen: true });
    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    await completeTransitions(mask, content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('projects only live Title and Description relationships and falls back to Root a11yLabel', async () => {
    // T-BASE-DIALOG-CONTENT-0001-CASE-A11Y
    const root = createDialogElement('base-dialog-root') as any;
    const content = createDialogElement('base-dialog-content') as any;
    const title = createDialogElement('base-dialog-title') as any;
    const description = createDialogElement('base-dialog-description') as any;

    setElementProps(root, { defaultOpen: true, a11yLabel: 'Settings' });
    root.appendChild(content);
    document.body.appendChild(root);
    await flushViewReconciliation();

    expect(content.getAttribute('aria-label')).toBe('Settings');
    expect(content.hasAttribute('aria-labelledby')).toBe(false);
    expect(content.hasAttribute('aria-describedby')).toBe(false);

    content.append(title, description);
    await flushViewReconciliation();

    expect({
      label: content.getAttribute('aria-label'),
      labelledBy: content.getAttribute('aria-labelledby'),
      describedBy: content.getAttribute('aria-describedby'),
    }).toEqual({
      label: null,
      labelledBy: title.id,
      describedBy: description.id,
    });

    title.remove();
    description.remove();
    await flushViewReconciliation();

    expect(content.getAttribute('aria-label')).toBe('Settings');
    expect(content.hasAttribute('aria-labelledby')).toBe(false);
    expect(content.hasAttribute('aria-describedby')).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('diagnoses an Alert Dialog whose live anatomy has no Description', async () => {
    // T-BASE-DIALOG-DESCRIPTION-0001-CASE-ALERT
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const root = createDialogElement('base-dialog-root') as any;
      const content = createDialogElement('base-dialog-content') as any;
      const description = createDialogElement('base-dialog-description') as any;
      setElementProps(root, { defaultOpen: true, alert: true, a11yLabel: 'Confirm action' });
      content.appendChild(description);
      root.appendChild(content);
      document.body.appendChild(root);
      await flushViewReconciliation();

      expect(warn).not.toHaveBeenCalled();

      description.remove();
      await flushViewReconciliation();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Alert Dialog requires a Dialog Description')
      );

      root.remove();
      await Promise.resolve();
    } finally {
      warn.mockRestore();
    }
  });

  it('alert=true prevents outside press from closing but ESC still closes', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;
    const description = createDialogElement('base-dialog-description') as any;

    setElementProps(root, { defaultOpen: true, alert: true });
    content.appendChild(description);
    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getAttribute('role')).toBe('alertdialog');
    expect(content.getAttribute('aria-modal')).toBe('true');

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(styleContains(content, 'hidden')).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    await completeTransitions(mask, content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('mask and content transition states synchronize with root.open changes', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;

    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(mask.getExposes().transitionState.get()).toBe('closed');
    expect(content.getExposes().transitionState.get()).toBe('closed');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushViewReconciliation();

    expect(mask.getExposes().transitionState.get()).toBe('entering');
    expect(content.getExposes().transitionState.get()).toBe('entering');

    mask.getExposes().controls.complete();
    content.getExposes().controls.complete();
    await Promise.resolve();

    expect(mask.getExposes().transitionState.get()).toBe('entered');
    expect(content.getExposes().transitionState.get()).toBe('entered');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(mask.getExposes().transitionState.get()).toBe('leaving');
    expect(content.getExposes().transitionState.get()).toBe('leaving');

    mask.getExposes().controls.complete();
    content.getExposes().controls.complete();
    await Promise.resolve();

    expect(mask.getExposes().transitionState.get()).toBe('closed');
    expect(content.getExposes().transitionState.get()).toBe('closed');

    root.remove();
    await Promise.resolve();
  });

  it('keeps Content dismissal ownership when only Mask detaches before reopen', async () => {
    // These custom element tags were registered with the corresponding prototypes above.
    const root = createDialogElement('base-dialog-root') as WebComponentAdapterElement<
      Prototype<DialogRootProps, DialogRootExposes>
    >;
    const trigger = createDialogElement('base-dialog-trigger');
    const mask = createDialogElement('base-dialog-mask');
    const content = createDialogElement('base-dialog-content') as WebComponentAdapterElement<
      Prototype<DialogContentProps, DialogContentExposes>
    >;
    root.append(trigger, mask, content);
    document.body.appendChild(root);

    try {
      await flushViewReconciliation();
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await completeTransitions(mask, content);
      mask.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await flushViewReconciliation();
      expect(root.getExposes().open.get()).toBe(false);
      expect(content.getExposes().transitionState.get()).toBe('leaving');

      // Complete only Mask's leave: Content deliberately retains its old view.
      await completeTransitions(mask);
      expect(mask.hasAttribute('data-pui-view-detached')).toBe(true);
      expect(content.hasAttribute('data-pui-view-detached')).toBe(false);

      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await completeTransitions(mask, content);
      expect(root.getExposes().open.get()).toBe(true);
      expect(mask.hasAttribute('data-pui-view-detached')).toBe(false);
      expect(content.getExposes().transitionState.get()).toBe('entered');

      mask.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await flushViewReconciliation();
      expect(root.getExposes().open.get()).toBe(false);

      // Full detach and reopen remains a distinct, working control.
      await completeTransitions(mask, content);
      expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await completeTransitions(mask, content);
      mask.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await flushViewReconciliation();
      expect(root.getExposes().open.get()).toBe(false);
      await completeTransitions(mask, content);
    } finally {
      root.remove();
      await flushViewReconciliation();
    }
  });

  // T-BASE-DIALOG-MASK-0001-CASE-DEFAULT-ACTION
  it('prevents participating Mask background pointer defaults while Content owns dismissal and focus return', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;
    const close = createDialogElement('base-dialog-close');
    const input = document.createElement('input');
    content.append(close, input);
    root.append(trigger, mask, content);
    document.body.append(root);

    try {
      await flushViewReconciliation();
      trigger.focus();
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushViewReconciliation();
      await completeTransitions(mask, content);
      input.focus();
      expect(root.getExposes().open.get()).toBe(true);
      const backgroundDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
      mask.dispatchEvent(backgroundDown);
      expect(backgroundDown.defaultPrevented).toBe(true);
      await flushViewReconciliation();
      expect(root.getExposes().open.get()).toBe(false);
      await completeTransitions(mask, content);
      expect(document.activeElement).toBe(trigger);
    } finally {
      root.remove();
      await flushViewReconciliation();
    }
  });

  it('leaves passthrough pointer defaults and Content controls/keyboard untouched', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;
    const input = document.createElement('input');
    const button = document.createElement('button');
    const clicked = vi.fn();
    button.addEventListener('click', clicked);
    content.append(input, button);
    setElementProps(root, { defaultOpen: true, alert: true });
    const description = createDialogElement('base-dialog-description');
    description.textContent = 'Confirm this action';
    content.append(description);
    root.append(trigger, mask, content);
    document.body.append(root);
    try {
      await completeTransitions(mask, content);
      for (const passthrough of [true, false, true]) {
        setElementProps(mask, { passthrough });
        await flushViewReconciliation();
        const backgroundDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
        mask.dispatchEvent(backgroundDown);
        expect(backgroundDown.defaultPrevented).toBe(!passthrough);
        // Mask never bypasses Content's Alert Dialog dismissal policy.
        expect(root.getExposes().open.get()).toBe(true);
      }
      for (const target of [input, button]) {
        const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
        target.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(false);
      }
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      button.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(false);
      expect(clicked).toHaveBeenCalledOnce();
      const key = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      input.dispatchEvent(key);
      expect(key.defaultPrevented).toBe(false);
      expect(root.getExposes().open.get()).toBe(true);
    } finally {
      root.remove();
      await flushViewReconciliation();
    }
  });

  it('mask passthrough projects pointer-events none without changing dialog open state', async () => {
    const root = createDialogElement('base-dialog-root') as any;
    const trigger = createDialogElement('base-dialog-trigger') as any;
    const mask = createDialogElement('base-dialog-mask') as any;
    const content = createDialogElement('base-dialog-content') as any;

    setElementProps(root, { defaultOpen: true });
    setElementProps(mask, { passthrough: true });
    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(mask.style.pointerEvents).toBe('none');
    expect(styleContains(content, 'hidden')).toBe(false);

    setElementProps(mask, { passthrough: false });
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(mask.style.pointerEvents).toBe('');

    root.remove();
    await Promise.resolve();
  });
});

it('fixture disposes each owned open portal exactly once while preserving unrelated DOM', async () => {
  const unrelated = document.createElement('div');
  const root = createDialogElement('base-dialog-root');
  const mask = createDialogElement('base-dialog-mask');
  const content = createDialogElement('base-dialog-content');
  setElementProps(root, { defaultOpen: true });
  root.append(mask, content);
  document.body.append(unrelated, root);
  try {
    await flushViewReconciliation();
    expect([...document.body.children]).toContain(mask);
    expect([...document.body.children]).toContain(content);
    await disposeOwnedDialogElements();
    expect(unrelated.isConnected).toBe(true);
    expect([...document.body.children]).toEqual([unrelated]);
    for (const element of [root, mask, content]) {
      expect(lifecycle.get(element.localName)).toEqual({ created: 1, disposed: 1 });
    }
    await disposeOwnedDialogElements();
    for (const counts of lifecycle.values()) expect(counts).toEqual({ created: 1, disposed: 1 });
  } finally {
    unrelated.remove();
  }
});
