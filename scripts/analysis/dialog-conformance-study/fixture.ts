// Public experimental consumer fixture, independent of the observation assertions.
import { expect, vi } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps, type WebComponentAdapterElement } from '@proto.ui/adapter-web-component';
import {
  dialogRoot, dialogTrigger, dialogMask, dialogContent, dialogTitle, dialogDescription, dialogClose,
} from '@proto.ui/prototypes-base';
import type {
  DialogRootProps, DialogRootExposes, DialogContentProps, DialogContentExposes,
  DialogMaskProps, DialogMaskExposes,
} from '../../../packages/prototypes/base/src/dialog/types';

export interface Fixture {
  root: WebComponentAdapterElement<Prototype<DialogRootProps, DialogRootExposes>>;
  content: WebComponentAdapterElement<Prototype<DialogContentProps, DialogContentExposes>>;
  mask: WebComponentAdapterElement<Prototype<DialogMaskProps, DialogMaskExposes>>;
  trigger: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  cancel: HTMLElement;
  save: HTMLElement;
  actions: string[];
  requests: Array<{ open: boolean; reason: string; focusReason: string }>;
  complete(): Promise<void>;
  open(): Promise<void>;
  escape(): Promise<void>;
  cleanup(): Promise<void>;
}
let fixtureIndex = 0;
export const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

export function createDialogFixture(controlled = false): Fixture {
  const prefix = `study-754-${++fixtureIndex}`;
  const lifecycle = new Map<string, { created: number; disposed: number }>();
  const options = (part: string) => ({
    registerAs: `${prefix}-${part}`,
    diagnostics: {
      onLifecycleEvent(event: { type: string }) {
        const counts = lifecycle.get(part) ?? { created: 0, disposed: 0 };
        if (event.type === 'instance.created') counts.created++;
        if (event.type === 'instance.dispose.done') counts.disposed++;
        lifecycle.set(part, counts);
      },
    },
  });
  // Bind the public protocol types, rather than accepting opaque getExposes values.
  const Root = AdaptToWebComponent(dialogRoot as Prototype<DialogRootProps, DialogRootExposes>, options('root'));
  const Content = AdaptToWebComponent(dialogContent as Prototype<DialogContentProps, DialogContentExposes>, options('content'));
  const Mask = AdaptToWebComponent(dialogMask as Prototype<DialogMaskProps, DialogMaskExposes>, options('mask'));
  const Trigger = AdaptToWebComponent(dialogTrigger, options('trigger'));
  const Title = AdaptToWebComponent(dialogTitle, options('title'));
  const Description = AdaptToWebComponent(dialogDescription, options('description'));
  const Close = AdaptToWebComponent(dialogClose, options('close'));
  const root = new Root();
  const trigger = new Trigger();
  const mask = new Mask();
  const content = new Content();
  const title = new Title();
  const description = new Description();
  const cancel = new Close();
  const save = new Close();
  const owned = [root, trigger, mask, content, title, description, cancel, save];
  const originalOverflow = document.body.style.overflow;
  const wrapper = document.createElement('section');
  const actionsWrapper = document.createElement('div');
  const actions: string[] = [];
  const requests: Array<{ open: boolean; reason: string; focusReason: string }> = [];
  trigger.textContent = 'Edit record';
  title.textContent = 'Edit record details';
  description.textContent = 'Cancel discards this edit. Save accepts it.';
  cancel.textContent = 'Cancel';
  save.textContent = 'Save';
  cancel.addEventListener('click', () => actions.push('cancel'));
  save.addEventListener('click', () => actions.push('save'));
  root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
  setElementProps(root, { a11yLabel: 'Record editor fallback', ...(controlled ? { open: true } : {}) });
  setElementProps(content, { enterDuration: 200, leaveDuration: 200 });
  setElementProps(mask, { enterDuration: 200, leaveDuration: 200 });
  actionsWrapper.append(cancel, save);
  wrapper.append(title, description, actionsWrapper);
  content.append(wrapper);
  root.append(trigger, mask, content);
  document.body.append(root);
  const complete = async () => {
    for (const part of [mask, content]) {
      if (['entering', 'leaving'].includes(part.getExposes().transitionState.get()))
        part.getExposes().controls.complete();
    }
    await flush();
    // L1 detach follows the existing compositor conceal barrier. Match the
    // current WC test boundary without claiming native paint or a 200ms clock.
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    );
    await flush();
  };
  const open = async () => {
    await flush();
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush();
    await complete();
  };
  const escape = async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await flush();
  };
  const cleanup = async () => {
    for (const element of owned) element.remove();
    await expect.poll(() => [...lifecycle].filter(([, count]) => count.created !== count.disposed)).toEqual([]);
    await vi.waitFor(() => expect(document.body.style.overflow).toBe(originalOverflow));
  };
  return { root, trigger, mask, content, title, description, cancel, save, actions, requests, complete, open, escape, cleanup };
}

