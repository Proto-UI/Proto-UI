import { afterEach, describe, expect, it } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps, setElementAssociations } from '../src';
import { checkboxRoot as checkbox } from '../../../prototypes/base/src/checkbox';
import { switchRoot } from '../../../prototypes/base/src/switch';
import labelRoot from '../../../prototypes/base/src/label';
import inputRoot from '../../../prototypes/base/src/input';
import textareaRoot from '../../../prototypes/base/src/textarea';
import { radioGroupRoot, radioGroupItem } from '../../../prototypes/base/src/radio-group';
AdaptToWebComponent(checkbox);
AdaptToWebComponent(switchRoot);
AdaptToWebComponent(labelRoot);
AdaptToWebComponent(inputRoot);
AdaptToWebComponent(textareaRoot);
AdaptToWebComponent(radioGroupRoot);
AdaptToWebComponent(radioGroupItem);
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
function pointerClick(el: HTMLElement) {
  el.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    })
  );
  el.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      composed: true,
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    })
  );
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
}
async function pair(
  target = 'base-checkbox-root',
  props: Record<string, unknown> = {},
  labelProps: Record<string, unknown> = {}
) {
  const ref = createControlLabelRef();
  const control = document.createElement(target) as HTMLElement & { getExposes(): any };
  const label = document.createElement('base-label-root');
  label.textContent = 'Community updates';
  setElementAssociations(control, { controlLabel: ref });
  setElementAssociations(label, { controlLabel: ref });
  setElementProps(control, props);
  setElementProps(label, { naming: true, activation: true, ...labelProps });
  document.body.append(control, label);
  await flush();
  return { ref, control, label, exposes: control.getExposes() };
}
describe('Web Component independent Control Label association', () => {
  it.each(['base-input-root', 'base-textarea-root'])(
    'labels and focuses %s without changing its editor value',
    async (target) => {
      const f = await pair(target, { defaultValue: 'Keep useful text', readOnly: true });
      const signals: unknown[] = [];
      f.control.addEventListener('valueChange', (e) => signals.push(e));
      expect(f.control.querySelector('input,textarea')?.getAttribute('aria-labelledby')).toBe(
        f.label.id
      );
      pointerClick(f.label);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(document.activeElement).toBe(f.control.querySelector('input,textarea'));
      expect(f.exposes.value.get()).toBe('Keep useful text');
      expect(signals).toEqual([]);
    }
  );
  it('respects an explicit Text Control name while allowing activation-only association', async () => {
    const f = await pair(
      'base-input-root',
      { ariaLabel: 'Explicit accessible name' },
      { naming: false }
    );
    pointerClick(f.label);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const input = f.control.querySelector('input')!;
    expect(input.getAttribute('aria-label')).toBe('Explicit accessible name');
    expect(input.hasAttribute('aria-labelledby')).toBe(false);
    expect(document.activeElement).toBe(input);
  });
  it('requests Radio selection once through the group owner', async () => {
    const group = document.createElement('base-radio-group-root') as HTMLElement & {
      getExposes(): any;
    };
    setElementProps(group, { defaultValue: 'a' });
    const first = document.createElement('base-radio-group-item');
    const second = document.createElement('base-radio-group-item');
    setElementProps(first, { value: 'a' });
    setElementProps(second, { value: 'b' });
    const label = document.createElement('base-label-root');
    label.textContent = 'Option B';
    setElementProps(label, { naming: true, activation: true });
    const ref = createControlLabelRef();
    setElementAssociations(second, { controlLabel: ref });
    setElementAssociations(label, { controlLabel: ref });
    group.append(first, second, label);
    document.body.append(group);
    await flush();
    const changes: unknown[] = [];
    group.addEventListener('valueChange', (e) => changes.push((e as CustomEvent).detail));
    pointerClick(label);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(group.getExposes().value.get()).toBe('b');
    expect(changes).toEqual([{ value: 'b' }]);
    expect(second.getAttribute('aria-labelledby')).toBe(label.id);
  });
  it.each(['base-checkbox-root', 'base-switch-root'])(
    'names and activates %s through the real independent Label',
    async (target) => {
      const f = await pair(target);
      const changes: unknown[] = [];
      f.control.addEventListener('checkedChange', (event) =>
        changes.push((event as CustomEvent).detail)
      );
      expect(f.label.id).not.toBe('');
      expect(f.control.getAttribute('aria-labelledby')).toBe(f.label.id);
      expect(f.label.hasAttribute('tabindex')).toBe(false);
      expect(f.label.hasAttribute('role')).toBe(false);
      pointerClick(f.label);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(f.exposes.checked.get()).toBe(true);
      expect(changes).toHaveLength(1);
      pointerClick(f.control);
      expect(f.exposes.checked.get()).toBe(false);
      expect(changes).toHaveLength(2);
    }
  );
  it('preserves disabled naming but suppresses label activation', async () => {
    const f = await pair('base-checkbox-root', { disabled: true });
    pointerClick(f.label);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(f.exposes.checked.get()).toBe(false);
    expect(f.control.getAttribute('aria-labelledby')).toBe(f.label.id);
  });
  it('proposes a controlled change without taking value ownership', async () => {
    const f = await pair('base-checkbox-root', { checked: false });
    const changes: unknown[] = [];
    f.control.addEventListener('checkedChange', (e) => changes.push((e as CustomEvent).detail));
    pointerClick(f.label);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(f.exposes.checked.get()).toBe(false);
    expect(changes).toEqual([{ checked: true, indeterminate: false }]);
  });
  it.each(['base-checkbox-root', 'base-switch-root'])(
    'stops %s activation if focus synchronously detaches its Label',
    async (target) => {
      const f = await pair(target);
      const changes: unknown[] = [];
      f.control.addEventListener('checkedChange', (event) => changes.push(event));
      f.control.addEventListener('focus', () => f.label.remove());
      pointerClick(f.label);
      expect(f.exposes.checked.get()).toBe(false);
      expect(changes).toEqual([]);
    }
  );
  it.each(['base-checkbox-root', 'base-switch-root'])(
    'stops %s outward effects when an exposed-state subscriber detaches its Label',
    async (target) => {
      const f = await pair(target);
      const changes: unknown[] = [];
      f.control.addEventListener('checkedChange', (event) => changes.push(event));
      const off = f.exposes.checked.subscribe(() => f.label.remove());
      try {
        pointerClick(f.label);
        expect(f.exposes.checked.get()).toBe(true);
        expect(changes).toEqual([]);
      } finally {
        off();
      }
    }
  );
  it.each(['base-input-root', 'base-textarea-root'])(
    'keeps disabled %s named without focusing its editor',
    async (target) => {
      const f = await pair(target, { disabled: true, defaultValue: 'Preserved' });
      const editor = f.control.querySelector('input,textarea')!;
      pointerClick(f.label);
      expect(document.activeElement).not.toBe(editor);
      expect(editor.getAttribute('aria-labelledby')).toBe(f.label.id);
      expect(f.exposes.value.get()).toBe('Preserved');
    }
  );
  it('keeps a controlled Switch proposal under its owner', async () => {
    const f = await pair('base-switch-root', { checked: false });
    const changes: unknown[] = [];
    f.control.addEventListener('checkedChange', (event) =>
      changes.push((event as CustomEvent).detail)
    );
    pointerClick(f.label);
    expect(f.exposes.checked.get()).toBe(false);
    expect(changes).toEqual([{ checked: true }]);
  });
  it('clears mixed state through the same Checkbox operation', async () => {
    const f = await pair('base-checkbox-root', { defaultIndeterminate: true });
    pointerClick(f.label);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(f.exposes.checked.get()).toBe(true);
    expect(f.exposes.indeterminate.get()).toBe(false);
  });
  it('keeps a naming-only label passive', async () => {
    const f = await pair('base-checkbox-root', {}, { activation: false });
    pointerClick(f.label);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(f.exposes.checked.get()).toBe(false);
    expect(f.label.getAttribute('data-pui-style') ?? '').not.toContain('select-none');
    expect(f.control.getAttribute('aria-labelledby')).toBe(f.label.id);
  });
  it('withdraws naming on Label detach and restores the current association on remount', async () => {
    const f = await pair();
    f.label.remove();
    await flush();
    expect(f.control.hasAttribute('aria-labelledby')).toBe(false);
    document.body.append(f.label);
    await flush();
    expect(f.control.getAttribute('aria-labelledby')).toBe(f.label.id);
    pointerClick(f.label);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(f.exposes.checked.get()).toBe(true);
  });
});
