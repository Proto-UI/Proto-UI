import { describe, expect, it, vi } from 'vitest';
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

AdaptToWebComponent(dialogRoot as any);
AdaptToWebComponent(dialogTrigger as any);
AdaptToWebComponent(dialogMask as any);
AdaptToWebComponent(dialogContent as any);
AdaptToWebComponent(dialogTitle as any);
AdaptToWebComponent(dialogDescription as any);
AdaptToWebComponent(dialogClose as any);

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
  it('uncontrolled root toggles open from trigger click and closes from close click', async () => {
    const root = document.createElement('base-dialog-root') as any;
    const trigger = document.createElement('base-dialog-trigger') as any;
    const mask = document.createElement('base-dialog-mask') as any;
    const content = document.createElement('base-dialog-content') as any;
    const close = document.createElement('base-dialog-close') as any;

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
    const root = document.createElement('base-dialog-root') as any;
    const trigger = document.createElement('base-dialog-trigger') as any;
    const mask = document.createElement('base-dialog-mask') as any;
    const content = document.createElement('base-dialog-content') as any;
    const close = document.createElement('base-dialog-close') as any;
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
    const root = document.createElement('base-dialog-root') as any;
    const trigger = document.createElement('base-dialog-trigger') as any;
    const mask = document.createElement('base-dialog-mask') as any;
    const content = document.createElement('base-dialog-content') as any;
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
    const root = document.createElement('base-dialog-root') as any;
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
    const root = document.createElement('base-dialog-root') as any;
    const trigger = document.createElement('base-dialog-trigger') as any;
    const content = document.createElement('base-dialog-content') as any;
    const close = document.createElement('base-dialog-close') as any;
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
    const root = document.createElement('base-dialog-root') as any;
    const trigger = document.createElement('base-dialog-trigger') as any;
    const mask = document.createElement('base-dialog-mask') as any;
    const content = document.createElement('base-dialog-content') as any;

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
    const root = document.createElement('base-dialog-root') as any;
    const trigger = document.createElement('base-dialog-trigger') as any;
    const mask = document.createElement('base-dialog-mask') as any;
    const content = document.createElement('base-dialog-content') as any;

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
    const root = document.createElement('base-dialog-root') as any;
    const content = document.createElement('base-dialog-content') as any;
    const title = document.createElement('base-dialog-title') as any;
    const description = document.createElement('base-dialog-description') as any;

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
      const root = document.createElement('base-dialog-root') as any;
      const content = document.createElement('base-dialog-content') as any;
      const description = document.createElement('base-dialog-description') as any;
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
    const root = document.createElement('base-dialog-root') as any;
    const trigger = document.createElement('base-dialog-trigger') as any;
    const mask = document.createElement('base-dialog-mask') as any;
    const content = document.createElement('base-dialog-content') as any;
    const description = document.createElement('base-dialog-description') as any;

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
    const root = document.createElement('base-dialog-root') as any;
    const trigger = document.createElement('base-dialog-trigger') as any;
    const mask = document.createElement('base-dialog-mask') as any;
    const content = document.createElement('base-dialog-content') as any;

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
    const root = document.createElement('base-dialog-root') as WebComponentAdapterElement<
      Prototype<DialogRootProps, DialogRootExposes>
    >;
    const trigger = document.createElement('base-dialog-trigger');
    const mask = document.createElement('base-dialog-mask');
    const content = document.createElement('base-dialog-content') as WebComponentAdapterElement<
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

  it('mask passthrough projects pointer-events none without changing dialog open state', async () => {
    const root = document.createElement('base-dialog-root') as any;
    const trigger = document.createElement('base-dialog-trigger') as any;
    const mask = document.createElement('base-dialog-mask') as any;
    const content = document.createElement('base-dialog-content') as any;

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
