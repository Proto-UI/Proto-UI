import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/number-field';
import * as shadcn from '../../shadcn/src/number-field';
import * as brutalist from '../../brutalist/src/number-field';
import * as bootstrap from '../../bootstrap-2-3-2/src/number-field';
import * as liquid from '../../liquid-glass/src/number-field';
import { formRoot, formField } from '../src/form';
import { fieldLabel } from '../src/field';

for (const group of [
  base,
  shadcn,
  brutalist,
  bootstrap,
  liquid,
  { formRoot, formField, fieldLabel },
])
  for (const p of Object.values(group))
    if (p && typeof p === 'object' && 'setup' in p) AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const pointer = (type: string, x: number, pointerType = 'mouse') =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 31,
    pointerType,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: 10,
  });
async function fixture(props: Record<string, unknown> = {}, family = 'base', control = false) {
  const part = (name: string) => document.createElement(`${family}-number-field-${name}`) as any;
  const root = part('root'),
    label = part('label'),
    input = part(control ? 'control' : 'input'),
    plus = part('increment'),
    minus = part('decrement');
  let ownerProps = { defaultValue: 20, ...props };
  setElementProps(root, ownerProps);
  label.textContent = 'Amount';
  root.append(label, minus, input, plus);
  const form = document.createElement('base-form-root') as any;
  const field = document.createElement('base-form-field') as any;
  if (control) {
    setElementProps(field, { name: 'amount', required: true, validationMode: 'onChange' });
    const name = document.createElement('base-field-label');
    name.textContent = 'Amount';
    field.append(name, root);
    form.append(field);
    document.body.append(form);
  } else document.body.append(root);
  await flush();
  label.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 30 }) as DOMRect;
  const editor = input.shadowRoot?.querySelector('input') ?? input.querySelector('input');
  const changes: unknown[] = [],
    commits: unknown[] = [];
  root.addEventListener('valueChange', (event: CustomEvent) => changes.push(event.detail.value));
  root.addEventListener('valueCommit', (event: CustomEvent) => commits.push(event.detail.value));
  return {
    root,
    label,
    input,
    editor,
    plus,
    minus,
    form,
    field,
    changes,
    commits,
    x: root.getExposes(),
    setProps(patch: Record<string, unknown>) {
      ownerProps = { ...ownerProps, ...patch };
      setElementProps(root, ownerProps);
    },
    async type(text: string, composing = false) {
      editor.value = text;
      editor.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          composed: true,
          data: text,
          isComposing: composing,
        })
      );
      await flush();
    },
    async move(type: string, x: number, device = 'mouse') {
      label.dispatchEvent(pointer(type, x, device));
      await flush();
    },
  };
}

describe('Number Field nullable localized ownership', () => {
  it('keeps explicit controlled null empty and never coerces it to zero on refused requests', async () => {
    const f = await fixture({ value: null });
    expect(f.x.getValue()).toBeNull();
    expect(f.x.empty.get()).toBe(true);
    expect(f.editor.value).toBe('');
    expect(f.input.getExposes().getValue()).toBeNull();
    expect(f.editor.hasAttribute('aria-valuenow')).toBe(false);
    f.x.stepBy(1);
    await flush();
    expect(f.changes).toEqual([0]);
    expect(f.x.getValue()).toBeNull();
    expect(f.editor.value).toBe('');
    f.setProps({ value: 25 });
    await flush();
    expect(f.x.getValue()).toBe(25);
    expect(f.editor.value).toBe('25');
    f.setProps({ value: null });
    await flush();
    expect(f.x.getValue()).toBeNull();
    expect(f.x.value.get()).toBe(25);
  });
  it('defaults to restoring empty drafts, and enables nullable clearing explicitly', async () => {
    const f = await fixture();
    await f.type('');
    f.x.commitValue();
    await flush();
    expect(f.x.getValue()).toBe(20);
    expect(f.editor.value).toBe('20');
    f.setProps({ allowEmpty: true });
    await flush();
    await f.type('');
    f.x.commitValue();
    await flush();
    expect(f.x.getValue()).toBeNull();
    expect(f.editor.value).toBe('');
    expect(f.changes).toEqual([null]);
    expect(f.commits).toEqual([20, null]);
    expect(f.plus.getExposes().disabled.get()).toBe(false);
    expect(f.minus.getExposes().disabled.get()).toBe(false);
    f.x.stepBy(-1);
    await flush();
    expect(f.x.getValue()).toBe(0);
  });
  it('resets a nullable initial value and reports actual null through required Field/Form', async () => {
    const f = await fixture({ defaultValue: null, allowEmpty: true }, 'base', true);
    expect(f.form.getExposes().getValues()).toEqual({ amount: null });
    expect(f.field.getExposes().filled.get()).toBe(false);
    f.field.getExposes().validate();
    expect(f.field.getExposes().invalid.get()).toBe(true);
    f.x.requestValue(12);
    await flush();
    expect(f.form.getExposes().getValues()).toEqual({ amount: 12 });
    expect(f.field.getExposes().invalid.get()).toBe(false);
    f.form.getExposes().requestReset();
    await flush();
    expect(f.form.getExposes().getValues()).toEqual({ amount: null });
    expect(f.editor.value).toBe('');
  });
  it('formats numbers while preserving canonical precision and parses locale decimal/group separators', async () => {
    const f = await fixture({
      defaultValue: 1234.567,
      min: -10000,
      max: 10000,
      step: 0.001,
      locale: 'de-DE',
      formatOptions: { maximumFractionDigits: 2 },
    });
    expect(f.editor.value).toBe('1.234,57');
    expect(f.x.getValue()).toBe(1234.567);
    expect(f.editor.getAttribute('aria-valuetext')).toBe('1.234,57');
    f.x.commitValue();
    await flush();
    expect(f.x.getValue()).toBe(1234.567);
    f.editor.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, composed: true })
    );
    f.editor.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, composed: true })
    );
    await flush();
    expect(f.x.getValue()).toBe(1234.567);
    await f.type('2.345,678');
    expect(f.x.getValue()).toBe(2345.678);
    f.x.commitValue();
    await flush();
    expect(f.editor.value).toBe('2.345,68');
    await f.type('2,345.678');
    f.x.commitValue();
    await flush();
    expect(f.x.getValue()).toBe(2345.678);
    expect(f.editor.value).toBe('2.345,68');
  });
  it('restores a controlled refusal and then accepts a delayed localized owner value', async () => {
    const f = await fixture({ value: 12.5, step: 0.5, locale: 'de-DE', allowEmpty: true });
    await f.type('45,5');
    expect(f.x.getValue()).toBe(12.5);
    f.x.commitValue();
    await flush();
    expect(f.editor.value).toBe('12,5');
    expect(f.commits).toEqual([12.5]);
    f.setProps({ value: 45.5 });
    await flush();
    expect(f.editor.value).toBe('45,5');
    await f.type('');
    f.x.commitValue();
    await flush();
    expect(f.changes.at(-1)).toBeNull();
    expect(f.editor.value).toBe('45,5');
    f.setProps({ value: null });
    await flush();
    expect(f.x.getValue()).toBeNull();
  });
  it('keeps IME drafts and the original parsing grammar across a locale update', async () => {
    const f = await fixture({ locale: 'de-DE', step: 0.1, scrub: true });
    f.editor.focus();
    f.editor.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, composed: true })
    );
    await f.type('3,5', true);
    expect(f.x.getValue()).toBe(20);
    expect(f.x.beginScrub()).toBe(false);
    expect(f.x.stepBy(1)).toBe(false);
    f.x.commitValue();
    expect(f.commits).toEqual([]);
    f.setProps({ locale: 'en-US' });
    await flush();
    expect(f.editor.value).toBe('3,5');
    f.editor.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '3,5' })
    );
    await flush();
    expect(f.x.getValue()).toBe(3.5);
    expect(f.editor.value).toBe('3.5');
    f.x.commitValue();
    expect(f.commits).toEqual([3.5]);
  });
  it('reports invalid format configuration and restores valid formatting after repair', async () => {
    const f = await fixture({ locale: 'bad_locale' });
    expect(f.x.formatInvalid.get()).toBe(true);
    expect(f.editor.value).toBe('20');
    f.setProps({ locale: 'de-DE', formatOptions: { minimumFractionDigits: 2 } });
    await flush();
    expect(f.x.formatInvalid.get()).toBe(false);
    expect(f.editor.value).toBe('20,00');
  });
  it.each(['reset', 'owner', 'disabled'] as const)(
    '%s retires composition so a stale compositionend cannot replace the accepted value',
    async (operation) => {
      const f = await fixture({
        locale: 'de-DE',
        step: 0.1,
        ...(operation === 'owner' ? { value: 20 } : {}),
      });
      f.editor.focus();
      f.editor.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true, composed: true })
      );
      await f.type('3,5', true);
      if (operation === 'reset') f.x.resetValue();
      else if (operation === 'owner') f.setProps({ value: 35 });
      else f.setProps({ disabled: true });
      await flush();
      const expected = operation === 'owner' ? 35 : 20;
      expect(f.editor.value).toBe(String(expected));
      f.editor.value = '3,5';
      f.editor.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '3,5' })
      );
      await flush();
      expect(f.x.getValue()).toBe(expected);
      expect(f.commits).toEqual([]);
    }
  );
});

describe('Number Field real AxisInput routing', () => {
  it.each(['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])(
    '%s inherits localized nullable values and continuous label scrub',
    async (family) => {
      const f = await fixture(
        {
          scrub: true,
          scrubSteps: 20,
          step: 0.5,
          locale: 'de-DE',
          defaultValue: 20.5,
          allowEmpty: true,
        },
        family
      );
      expect(f.editor.value).toBe('20,5');
      await f.move('pointerdown', 40);
      expect(f.x.dragging.get()).toBe(true);
      expect(f.changes).toEqual([]);
      await f.move('pointermove', 90);
      expect(f.x.getValue()).toBe(23);
      expect(f.commits).toEqual([]);
      await f.move('pointermove', 140);
      expect(f.x.getValue()).toBe(25.5);
      await f.move('pointerup', 140);
      expect(f.commits).toEqual([25.5]);
      expect(f.x.dragging.get()).toBe(false);
      expect(f.editor.value).toBe('25,5');
      await f.type('');
      f.x.commitValue();
      await flush();
      expect(f.x.getValue()).toBeNull();
      expect(f.editor.hasAttribute('aria-valuenow')).toBe(false);
    }
  );
  it('a click without displacement does not fill an empty scrub value', async () => {
    const f = await fixture({ defaultValue: null, scrub: true });
    await f.move('pointerdown', 40);
    await f.move('pointerup', 40);
    expect(f.x.getValue()).toBeNull();
    expect(f.changes).toEqual([]);
    expect(f.commits).toEqual([]);
  });
  it('is opt-in and never uses the text editor as a scrub surface', async () => {
    const f = await fixture();
    await f.move('pointerdown', 20);
    await f.move('pointermove', 120);
    await f.move('pointerup', 120);
    expect(f.x.getValue()).toBe(20);
    expect(f.commits).toEqual([]);
    f.setProps({ scrub: true });
    await flush();
    f.editor.dispatchEvent(pointer('pointerdown', 20));
    f.editor.dispatchEvent(pointer('pointermove', 120));
    f.editor.dispatchEvent(pointer('pointerup', 120));
    await flush();
    expect(f.x.getValue()).toBe(20);
    expect(f.x.dragging.get()).toBe(false);
  });
  it.each(['mouse', 'touch', 'pen'])(
    '%s cancellation rolls back and a stale end cannot commit',
    async (device) => {
      const f = await fixture({ scrub: true });
      await f.move('pointerdown', 20, device);
      await f.move('pointermove', 100, device);
      expect(f.x.getValue()).toBe(60);
      await f.move('pointercancel', 100, device);
      expect(f.x.getValue()).toBe(20);
      expect(f.x.dragging.get()).toBe(false);
      await f.move('pointerup', 160, device);
      expect(f.commits).toEqual([]);
      expect(f.x.getValue()).toBe(20);
    }
  );
  it('respects RTL, bounds and configured step size', async () => {
    const f = await fixture({
      scrub: true,
      direction: 'rtl',
      min: 10,
      max: 30,
      step: 2,
      scrubSteps: 10,
    });
    await f.move('pointerdown', 100);
    await f.move('pointermove', 150);
    expect(f.x.getValue()).toBe(16);
    await f.move('pointermove', 300);
    expect(f.x.getValue()).toBe(10);
    await f.move('pointerup', -300);
    expect(f.x.getValue()).toBe(30);
    expect(f.commits).toEqual([30]);
  });
  it('preserves a controlled refusal and only commits an actually accepted value', async () => {
    const f = await fixture({ value: 20, scrub: true });
    await f.move('pointerdown', 20);
    await f.move('pointermove', 100);
    await f.move('pointerup', 100);
    expect(f.changes).toEqual([60]);
    expect(f.x.getValue()).toBe(20);
    expect(f.commits).toEqual([]);
    f.root.addEventListener('valueChange', (event: CustomEvent) =>
      f.setProps({ value: event.detail.value })
    );
    await f.move('pointerdown', 20);
    await f.move('pointermove', 100);
    await f.move('pointerup', 100);
    expect(f.x.getValue()).toBe(60);
    expect(f.commits).toEqual([60]);
  });
  it('replaces a deferred controlled suggestion when the pointer returns to its accepted baseline', async () => {
    const f = await fixture({ value: 20, scrub: true });
    await f.move('pointerdown', 20);
    await f.move('pointermove', 100);
    await f.move('pointermove', 20);
    await f.move('pointerup', 20);
    expect(f.changes).toEqual([60, 20]);
    expect(f.x.getValue()).toBe(20);
    expect(f.commits).toEqual([]);
    // A deferred owner can now accept the most recent complete suggestion.
    f.setProps({ value: f.changes.at(-1) });
    await flush();
    expect(f.x.getValue()).toBe(20);
    expect(f.x.dragging.get()).toBe(false);
  });
  it.each([{ disabled: true }, { readOnly: true }, { scrub: false }, { step: 2 }])(
    'policy change %j cancels active scrub and restores its starting value',
    async (patch) => {
      const f = await fixture({ scrub: true });
      await f.move('pointerdown', 20);
      await f.move('pointermove', 100);
      expect(f.x.getValue()).toBe(60);
      f.setProps(patch);
      await flush();
      expect(f.x.dragging.get()).toBe(false);
      expect(f.x.getValue()).toBe(20);
      await f.move('pointerup', 160);
      expect(f.commits).toEqual([]);
    }
  );
  it('independent controlled owner replacement cancels the old drag without rollback', async () => {
    const f = await fixture({ value: 20, scrub: true });
    await f.move('pointerdown', 20);
    await f.move('pointermove', 100);
    f.setProps({ value: 35 });
    await flush();
    expect(f.x.dragging.get()).toBe(false);
    expect(f.x.getValue()).toBe(35);
    await f.move('pointerup', 160);
    expect(f.x.getValue()).toBe(35);
    expect(f.commits).toEqual([]);
  });
  it('removal retires a drag and cannot leak a commit into a remounted component', async () => {
    const f = await fixture({ scrub: true });
    await f.move('pointerdown', 20);
    await f.move('pointermove', 100);
    f.root.remove();
    await flush();
    document.body.append(f.root);
    await flush();
    await f.move('pointerup', 160);
    expect(f.root.getExposes().getValue()).toBe(20);
    expect(f.commits).toEqual([]);
  });
  it('detaching only the active Label cancels its original Root session', async () => {
    const f = await fixture({ scrub: true });
    await f.move('pointerdown', 20);
    await f.move('pointermove', 100);
    expect(f.x.getValue()).toBe(60);
    f.label.remove();
    await flush();
    expect(f.x.dragging.get()).toBe(false);
    expect(f.x.getValue()).toBe(20);
    document.dispatchEvent(pointer('pointerup', 160));
    await flush();
    expect(f.commits).toEqual([]);
  });
});
