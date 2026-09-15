import { describe, expect, it } from 'vitest';
import { getLogicalTriggerSurfaceRoot } from '../src/platform/instance-tree';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import {
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
  button,
} from '@proto.ui/prototypes-base';

function registerDialogWcs() {
  const prototypes = [
    dialogRoot,
    dialogTrigger,
    dialogMask,
    dialogContent,
    dialogTitle,
    dialogDescription,
    dialogClose,
    button,
  ];

  for (const proto of prototypes) {
    const wcName = 'wc-' + proto.name;
    if (!customElements.get(wcName)) {
      const Ctor = AdaptToWebComponent(proto, { register: false, registerAs: wcName });
      customElements.define(wcName, Ctor);
    }
  }
}

function styleContains(el: Element, token: string): boolean {
  return (el.getAttribute('data-pui-style') ?? '').split(/\s+/).includes(token);
}

async function completeTransitions(...elements: any[]): Promise<void> {
  for (const element of elements) {
    const exposes = element?.getExposes?.();
    const state = exposes?.transitionState?.get?.();
    if (state === 'entering' || state === 'leaving') exposes.controls.complete();
  }
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('adapter-web-component: dialog overlay', () => {
  it('sets body overflow hidden on open and restores on close (modal)', async () => {
    registerDialogWcs();

    const root = document.createElement('wc-base-dialog-root') as any;
    const trigger = document.createElement('wc-base-dialog-trigger') as any;
    const mask = document.createElement('wc-base-dialog-mask') as any;
    const content = document.createElement('wc-base-dialog-content') as any;
    const close = document.createElement('wc-base-dialog-close') as any;

    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    content.appendChild(close);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const originalOverflow = document.body.style.overflow;

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(close);

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mask.getExposes().transitionState.get()).toBe('leaving');
    expect(document.body.style.overflow).toBe('hidden');
    await completeTransitions(mask, content);
    expect(document.body.style.overflow).toBe(originalOverflow);

    root.remove();
  });

  it('closes dialog on ESC key', async () => {
    registerDialogWcs();

    const root = document.createElement('wc-base-dialog-root') as any;
    const trigger = document.createElement('wc-base-dialog-trigger') as any;
    const content = document.createElement('wc-base-dialog-content') as any;

    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    trigger.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(styleContains(content, 'hidden')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(content.getExposes().transitionState.get()).toBe('leaving');
    await completeTransitions(content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    root.remove();
    document.body.style.overflow = '';
  });

  it('closes dialog on close button click', async () => {
    registerDialogWcs();

    const root = document.createElement('wc-base-dialog-root') as any;
    const trigger = document.createElement('wc-base-dialog-trigger') as any;
    const closeBtn = document.createElement('wc-base-dialog-close') as any;
    const content = document.createElement('wc-base-dialog-content') as any;

    root.appendChild(trigger);
    root.appendChild(content);
    content.appendChild(closeBtn);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    trigger.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(styleContains(content, 'hidden')).toBe(false);

    closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await completeTransitions(content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    root.remove();
    document.body.style.overflow = '';
  });

  it('moves focus through demo-like wrapped dialog content and restores trigger on close', async () => {
    registerDialogWcs();

    const root = document.createElement('wc-base-dialog-root') as any;
    const trigger = document.createElement('wc-base-dialog-trigger') as any;
    const mask = document.createElement('wc-base-dialog-mask') as any;
    const content = document.createElement('wc-base-dialog-content') as any;
    const title = document.createElement('wc-base-dialog-title') as any;
    const description = document.createElement('wc-base-dialog-description') as any;
    const actions = document.createElement('div');
    const cancel = document.createElement('wc-base-dialog-close') as any;
    const confirm = document.createElement('wc-base-dialog-close') as any;

    actions.appendChild(cancel);
    actions.appendChild(confirm);
    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    content.appendChild(title);
    content.appendChild(description);
    content.appendChild(actions);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    trigger.focus();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(styleContains(content, 'hidden')).toBe(false);
    expect(document.activeElement).toBe(cancel);
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(content.getAttribute('aria-labelledby')).toBe(title.id);
    expect(content.getAttribute('aria-describedby')).toBe(description.id);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);

    cancel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await completeTransitions(mask, content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    root.remove();
    document.body.style.overflow = '';
  });

  it('routes keyboard activation from a nested trigger to the outer dialog trigger', async () => {
    registerDialogWcs();

    const root = document.createElement('wc-base-dialog-root') as any;
    const trigger = document.createElement('wc-base-dialog-trigger') as any;
    const innerButton = document.createElement('wc-base-button') as any;
    const content = document.createElement('wc-base-dialog-content') as any;
    const close = document.createElement('wc-base-dialog-close') as any;

    innerButton.textContent = 'Open Dialog';
    close.textContent = 'Cancel';
    trigger.appendChild(innerButton);
    content.appendChild(close);
    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const ownerMark = Symbol.for('@proto.ui/as-trigger/confirm-owner');
    const ownerToken = (innerButton as unknown as Record<symbol, object>)[ownerMark]!;
    expect(getLogicalTriggerSurfaceRoot(ownerToken)).toBe(innerButton);
    expect(trigger.tabIndex).toBe(-1);
    expect(trigger.hasAttribute('role')).toBe(false);
    expect(innerButton.tabIndex).toBe(0);
    expect(innerButton.getAttribute('role')).toBe('button');

    innerButton.focus();
    innerButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(styleContains(content, 'hidden')).toBe(false);
    expect(document.activeElement).toBe(close);
    expect(close.getExposes().focusVisible.get()).toBe(true);

    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await completeTransitions(content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    // An independent pointer gesture, not the zero-detail synthetic follow-up
    // to the earlier Enter. The retained epoch must not reset keyboard dedup.
    innerButton.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(styleContains(content, 'hidden')).toBe(false);

    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await completeTransitions(content);
    root.remove();
    document.body.style.overflow = '';
  });

  it('restores focus-visible to the trigger after keyboard close', async () => {
    registerDialogWcs();

    const root = document.createElement('wc-base-dialog-root') as any;
    const trigger = document.createElement('wc-base-dialog-trigger') as any;
    const content = document.createElement('wc-base-dialog-content') as any;
    const close = document.createElement('wc-base-dialog-close') as any;

    trigger.textContent = 'Open Dialog';
    close.textContent = 'Cancel';
    content.appendChild(close);
    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(close);
    expect(close.getExposes().focusVisible.get()).toBe(true);

    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await completeTransitions(content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getExposes().focusVisible.get()).toBe(true);

    root.remove();
    document.body.style.overflow = '';
  });

  it('traps tab navigation inside active dialog content', async () => {
    registerDialogWcs();

    const root = document.createElement('wc-base-dialog-root') as any;
    const trigger = document.createElement('wc-base-dialog-trigger') as any;
    const content = document.createElement('wc-base-dialog-content') as any;
    const cancel = document.createElement('wc-base-dialog-close') as any;
    const confirm = document.createElement('wc-base-dialog-close') as any;

    cancel.textContent = 'Cancel';
    confirm.textContent = 'Confirm';
    content.appendChild(cancel);
    content.appendChild(confirm);
    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(cancel);

    cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(confirm);

    confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(cancel);

    cancel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(confirm);

    confirm.blur();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(cancel);

    cancel.blur();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(confirm);

    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await completeTransitions(content);
    root.remove();
    document.body.style.overflow = '';
  });

  it('merges dialog-close and button as one group with an inner hit and focus surface', async () => {
    registerDialogWcs();

    const root = document.createElement('wc-base-dialog-root') as any;
    const trigger = document.createElement('wc-base-dialog-trigger') as any;
    const content = document.createElement('wc-base-dialog-content') as any;
    const cancel = document.createElement('wc-base-dialog-close') as any;
    const cancelButton = document.createElement('wc-base-button') as any;
    const confirm = document.createElement('wc-base-dialog-close') as any;
    const confirmButton = document.createElement('wc-base-button') as any;

    cancelButton.textContent = 'Cancel';
    confirmButton.textContent = 'Confirm';
    cancel.appendChild(cancelButton);
    confirm.appendChild(confirmButton);
    content.appendChild(cancel);
    content.appendChild(confirm);
    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(cancel.tabIndex).toBe(-1);
    expect(cancel.hasAttribute('role')).toBe(false);
    expect(document.activeElement).toBe(cancelButton);
    expect(cancelButton.getExposes().focusVisible.get()).toBe(true);

    cancel.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);

    cancelButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(confirmButton);
    expect(confirmButton.getExposes().focusVisible.get()).toBe(true);

    confirmButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await completeTransitions(content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(document.activeElement).toBe(trigger);

    root.remove();
    document.body.style.overflow = '';
  });
});
