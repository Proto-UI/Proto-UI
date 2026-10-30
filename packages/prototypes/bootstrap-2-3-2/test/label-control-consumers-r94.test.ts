import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import type { AdapterPrototype, ProtoAdapterExposes } from '@proto.ui/adapter-base';
import {
  AdaptToWebComponent,
  setElementAssociations,
  setElementProps,
} from '@proto.ui/adapter-web-component';
import { labelRoot } from '../src/label';
import { checkboxRoot, checkboxIndicator } from '../src/checkbox';
import { switchRoot, switchThumb } from '../src/switch';
import { radioGroupRoot, radioGroupItem, radioGroupIndicator } from '../src/radio-group';
import { inputRoot } from '../src/input';
import { textareaRoot } from '../src/textarea';

type Host<TProto extends AdapterPrototype> = HTMLElement & {
  getExposes(): ProtoAdapterExposes<TProto>;
};
for (const prototype of [
  labelRoot,
  checkboxRoot,
  checkboxIndicator,
  switchRoot,
  switchThumb,
  radioGroupRoot,
  radioGroupItem,
  radioGroupIndicator,
  inputRoot,
  textareaRoot,
]) {
  AdaptToWebComponent(prototype);
}

function part<TProto extends AdapterPrototype>(
  prototype: TProto,
  props: Record<string, unknown> = {}
): Host<TProto> {
  // This exact Prototype registered the constructor above.
  const element = document.createElement(prototype.name) as Host<TProto>;
  setElementProps(element, props);
  return element;
}

function labelFor(target: HTMLElement, text: string): Host<typeof labelRoot> {
  const ref = createControlLabelRef();
  const label = part(labelRoot, { naming: true, activation: true });
  label.textContent = text;
  setElementAssociations(label, { controlLabel: ref });
  setElementAssociations(target, { controlLabel: ref });
  return label;
}

function click(element: HTMLElement): void {
  element.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  element.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  element.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
}

async function settle(): Promise<void> {
  for (let i = 0; i < 40; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
  vi.useRealTimers();
});

describe('Bootstrap own-family Label control consumers', () => {
  for (const [kind, rootPrototype, childPrototype] of [
    ['Checkbox', checkboxRoot, checkboxIndicator],
    ['Switch', switchRoot, switchThumb],
  ] as const) {
    it(`keeps ${kind} label activation as one controlled request and honors disabled restoration`, async () => {
      const target = part(rootPrototype, { checked: false });
      const child = part(childPrototype);
      target.append(child);
      const label = labelFor(target, 'Notifications');
      const requests: Array<{ checked: boolean }> = [];
      target.addEventListener('checkedChange', (event) => {
        requests.push((event as CustomEvent<{ checked: boolean }>).detail);
      });
      document.body.append(target, label);
      await settle();
      expect(target.getAttribute('aria-labelledby')).toBe(label.id);

      click(label);
      await settle();
      expect(requests).toHaveLength(1);
      expect(requests[0]?.checked).toBe(true);
      expect(target.getExposes().checked.get()).toBe(false);
      expect(child.getExposes().isChecked()).toBe(false);

      setElementProps(target, { checked: true, disabled: true });
      await settle();
      click(label);
      await settle();
      expect(requests).toHaveLength(1);
      expect(child.getExposes().isChecked()).toBe(true);

      setElementProps(target, { checked: true, disabled: false });
      await settle();
      click(label);
      await settle();
      expect(requests).toHaveLength(2);
      expect(requests[1]?.checked).toBe(false);
      expect(target.getExposes().checked.get()).toBe(true);
      label.remove();
      await settle();
      expect(target.getAttribute('aria-labelledby')).toBeNull();
    });
  }

  it('routes a named Radio Item through its own controlled group without a second selection owner', async () => {
    const root = part(radioGroupRoot, { value: 'email' });
    const email = part(radioGroupItem, { value: 'email' });
    const push = part(radioGroupItem, { value: 'push' });
    email.append(part(radioGroupIndicator));
    push.append(part(radioGroupIndicator));
    const emailLabel = labelFor(email, 'Email');
    const pushLabel = labelFor(push, 'Push');
    const requests: Array<{ value: string }> = [];
    root.addEventListener('valueChange', (event) => {
      requests.push((event as CustomEvent<{ value: string }>).detail);
    });
    root.append(email, emailLabel, push, pushLabel);
    document.body.append(root);
    await settle();
    expect(email.getAttribute('aria-labelledby')).toBe(emailLabel.id);
    expect(push.getAttribute('aria-labelledby')).toBe(pushLabel.id);

    click(pushLabel);
    await settle();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.value).toBe('push');
    expect(root.getExposes().value.get()).toBe('email');
    expect(push.getExposes().checked.get()).toBe(false);
    setElementProps(root, { value: 'push' });
    await settle();
    expect(push.getExposes().checked.get()).toBe(true);
    expect(email.getExposes().checked.get()).toBe(false);
    setElementProps(email, { value: 'email', disabled: true });
    await settle();
    click(emailLabel);
    await settle();
    expect(requests).toHaveLength(1);
    expect(root.getExposes().value.get()).toBe('push');
  });

  for (const [kind, prototype] of [
    ['input', inputRoot],
    ['textarea', textareaRoot],
  ] as const) {
    it(`names and focuses the same physical ${kind} across Label withdrawal and rebinding`, async () => {
      const target = part(prototype, { defaultValue: 'Retained value' });
      const label = labelFor(target, 'Project notes');
      document.body.append(label, target);
      await settle();
      const editor = target.querySelector(kind);
      if (!(editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement)) {
        throw new Error('Expected the one real host editor.');
      }
      expect(target.querySelectorAll('input,textarea,[contenteditable]')).toHaveLength(1);
      expect(editor.getAttribute('aria-labelledby')).toBe(label.id);
      click(label);
      await settle();
      expect(document.activeElement).toBe(editor);
      expect(editor.value).toBe('Retained value');
      label.remove();
      await settle();
      expect(editor.getAttribute('aria-labelledby')).toBeNull();
      document.body.prepend(label);
      await settle();
      expect(editor.getAttribute('aria-labelledby')).toBe(label.id);
      expect(target.querySelector(kind)).toBe(editor);
      expect(editor.value).toBe('Retained value');
    });
  }
});
