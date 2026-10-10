import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fieldRoot, fieldControl, asFieldControl } from '../src/field';

AdaptToWebComponent(fieldRoot);
AdaptToWebComponent(fieldControl);
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
async function mount(rootProps: Record<string, unknown> = {}) {
  const root = document.createElement(fieldRoot.name) as any;
  const control = document.createElement(fieldControl.name) as any;
  const props = { externalValidation: true, validationMode: 'manual', ...rootProps };
  setElementProps(root, props);
  setElementProps(control, { defaultValue: 'same' });
  root.append(control);
  const requests: any[] = [];
  root.addEventListener('validationRequest', (event: CustomEvent) => requests.push(event.detail));
  document.body.append(root);
  await flush();
  const editor = (control.shadowRoot?.querySelector('input') ??
    control.querySelector('input')) as HTMLInputElement;
  expect(editor).not.toBeNull();
  return {
    root,
    control,
    props,
    requests,
    editor,
    api: root.getExposes(),
    bridge: control.getExposes(),
  };
}
function compose(editor: HTMLInputElement, type: 'compositionstart' | 'compositionend') {
  editor.dispatchEvent(new CompositionEvent(type, { bubbles: true, composed: true, data: '' }));
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('Field validation interruptions (draft C-FIELD-0001)', () => {
  it.each(['root', 'control'] as const)(
    'terminates composition after %s becomes readOnly so explicit validation resumes',
    async (owner) => {
      const f = await mount();
      const old = f.api.validate();
      compose(f.editor, 'compositionstart');
      await flush();
      expect(f.bridge.__fieldSnapshot().composing).toBe(true);
      expect(f.api.resolveValidation(old, { invalid: true })).toBe(false);
      expect(f.api.validate()).toBeNull();
      setElementProps(
        f[owner],
        owner === 'root' ? { ...f.props, readOnly: true } : { defaultValue: 'same', readOnly: true }
      );
      await flush();
      expect(f.editor.readOnly).toBe(true);
      expect(f.api.validate()).toBeNull();
      compose(f.editor, 'compositionend');
      await flush();
      expect(f.bridge.composing.get()).toBe(false);
      expect(f.bridge.__fieldSnapshot().composing).toBe(false);
      expect(f.requests).toHaveLength(1);
      const next = f.api.validate();
      expect(next).not.toBeNull();
      expect(f.requests.at(-1)).toEqual({ requestId: next, value: 'same', reason: 'manual' });
      expect(f.api.resolveValidation(next, { invalid: false })).toBe(true);
    }
  );

  it.each(['defaultInvalid', 'defaultErrors'] as const)(
    'preserves a pending lease across a %s-only update',
    async (key) => {
      const f = await mount();
      const id = f.api.validate();
      const before = f.api.getValidity();
      setElementProps(f.root, { ...f.props, [key]: key === 'defaultInvalid' ? true : ['ignored'] });
      await flush();
      expect(f.api.getValidity()).toEqual(before);
      expect(f.requests).toHaveLength(1);
      expect(f.api.resolveValidation(id, { invalid: false })).toBe(true);
      expect(f.api.resolveValidation(id, { invalid: true })).toBe(false);
    }
  );
});

describe('Field policy termination boundaries', () => {
  it.each(['readOnly', 'disabled', 'editable'] as const)(
    'preserves a newer composition started by a synchronous end callback while %s',
    async (policy) => {
      const f = await mount({ validationMode: 'onChange' });
      const old = f.api.validate();
      compose(f.editor, 'compositionstart');
      await flush();
      if (policy !== 'editable') {
        setElementProps(f.root, { ...f.props, [policy]: true });
        await flush();
      }
      f.control.addEventListener('compositionEnd', () => compose(f.editor, 'compositionstart'), {
        once: true,
      });
      compose(f.editor, 'compositionend');
      await flush();
      expect(f.bridge.composing.get()).toBe(true);
      expect(f.bridge.__fieldSnapshot().composing).toBe(true);
      expect(f.api.validate()).toBeNull();
      expect(f.api.resolveValidation(old, { invalid: true })).toBe(false);
      expect(f.requests).toHaveLength(1);
      compose(f.editor, 'compositionend');
      await flush();
      expect(f.bridge.composing.get()).toBe(false);
      expect(f.bridge.__fieldSnapshot().composing).toBe(false);
      if (policy === 'disabled') expect(f.api.validate()).toBeNull();
      else expect(f.api.validate()).not.toBeNull();
    }
  );

  it.each(['readOnly', 'disabled'] as const)(
    'ending composition while %s does not admit a rejected value or start automatic validation',
    async (policy) => {
      const f = await mount({ validationMode: 'onChange' });
      const old = f.api.validate();
      compose(f.editor, 'compositionstart');
      await flush();
      f.api.cancelValidation();
      setElementProps(f.root, { ...f.props, [policy]: true });
      await flush();
      f.editor.value = 'unaccepted composition candidate';
      compose(f.editor, 'compositionend');
      await flush();
      expect(f.bridge.__fieldSnapshot()).toMatchObject({
        value: 'same',
        initialValue: 'same',
        composing: false,
      });
      expect(f.api.dirty.get()).toBe(false);
      expect(f.api.pending.get()).toBe(false);
      expect(f.requests).toHaveLength(1);
      expect(f.api.resolveValidation(old, { invalid: true })).toBe(false);
      const ended = f.api.validate();
      if (policy === 'disabled') {
        expect(ended).toBeNull();
        expect(f.api.focusControl()).toBe(false);
      } else {
        expect(ended).not.toBeNull();
        compose(f.editor, 'compositionend');
        await flush();
        expect(f.api.resolveValidation(ended, { invalid: false })).toBe(true);
      }
      setElementProps(f.root, f.props);
      await flush();
      f.editor.value = 'next';
      f.editor.dispatchEvent(
        new InputEvent('input', { bubbles: true, composed: true, data: 'next' })
      );
      await flush();
      const next = f.requests.at(-1);
      expect(next).toMatchObject({ value: 'next', reason: 'change' });
      expect(next.requestId).not.toBe(old);
      expect(f.api.resolveValidation(old, { invalid: true })).toBe(false);
      expect(f.api.resolveValidation(next.requestId, { invalid: false })).toBe(true);
    }
  );

  let sequence = 0;
  it.each(['readOnly', 'disabled'] as const)(
    'generic %s reports retire only a valid composition-end fact',
    async (policy) => {
      const root = document.createElement(fieldRoot.name) as any;
      const props = { externalValidation: true, validationMode: 'onChange' };
      setElementProps(root, props);
      const proto = definePrototype({
        name: `field-interruption-generic-${++sequence}`,
        setup() {
          asFieldControl();
        },
      });
      AdaptToWebComponent(proto);
      const control = document.createElement(proto.name) as any;
      root.append(control);
      const requests: any[] = [];
      root.addEventListener('validationRequest', (event: CustomEvent) =>
        requests.push(event.detail)
      );
      document.body.append(root);
      await flush();
      const api = root.getExposes();
      const bridge = control.getExposes();
      expect(
        bridge.reportField({
          value: 'canonical',
          initialValue: 'baseline',
          focused: true,
          composing: true,
        })
      ).toBe(true);
      setElementProps(root, { ...props, [policy]: true });
      await flush();
      const before = bridge.__fieldSnapshot();
      // Whole-payload normalization precedes even lifecycle retirement.
      expect(
        bridge.reportField({ value: Infinity, composing: false, reason: 'compositionend' })
      ).toBe(false);
      expect(
        bridge.reportField({
          value: 'candidate',
          initialValue: Array(1),
          composing: false,
          reason: 'compositionend',
        })
      ).toBe(false);
      expect(bridge.__fieldSnapshot()).toEqual(before);
      for (const reason of ['input', 'change']) {
        expect(bridge.reportField({ value: 'candidate', composing: false, reason })).toBe(false);
        expect(bridge.__fieldSnapshot()).toEqual(before);
      }
      expect(
        bridge.reportField({ value: 'candidate', composing: true, reason: 'compositionend' })
      ).toBe(false);
      expect(bridge.__fieldSnapshot()).toEqual(before);
      expect(
        bridge.reportField({
          value: 'candidate',
          initialValue: 'new baseline',
          focused: false,
          composing: false,
          reason: 'compositionend',
        })
      ).toBe(false);
      expect(bridge.__fieldSnapshot()).toEqual({ ...before, composing: false });
      expect(requests).toHaveLength(0);
      const id = api.validate();
      if (policy === 'readOnly') {
        expect(id).not.toBeNull();
        expect(requests.at(-1).value).toBe('canonical');
        expect(
          bridge.reportField({
            value: 'second candidate',
            composing: false,
            reason: 'compositionend',
          })
        ).toBe(false);
        expect(api.pending.get()).toBe(true);
        expect(api.resolveValidation(id, { invalid: false })).toBe(true);
      } else expect(id).toBeNull();
      setElementProps(root, props);
      await flush();
      expect(api.validate()).not.toBeNull();
    }
  );
});

describe('Default-only updates are not policy revisions', () => {
  it('keeps both defaults initialization-only through pending and completed validity', async () => {
    const f = await mount({ defaultInvalid: true, defaultErrors: ['initial'] });
    expect(f.api.getValidity()).toMatchObject({ invalid: true, errors: ['initial'] });
    const id = f.api.validate();
    const before = f.api.getValidity();
    setElementProps(f.root, { ...f.props, defaultInvalid: false, defaultErrors: ['later'] });
    await flush();
    expect(f.api.getValidity()).toEqual(before);
    expect(f.api.resolveValidation(id, { invalid: true, errors: ['current'] })).toBe(true);
    setElementProps(f.root, { ...f.props, defaultErrors: ['ignored again'] });
    await flush();
    expect(f.api.getValidity()).toMatchObject({
      invalid: true,
      errors: ['current'],
      pending: false,
    });
  });

  it.each([
    ['required', { required: true }],
    ['minLength', { minLength: 6 }],
    ['maxLength', { maxLength: 3 }],
    ['externalValidation', { externalValidation: false }],
    ['validationMode', { validationMode: 'onChange' }],
    ['readOnly', { readOnly: true }],
    ['disabled', { disabled: true }],
    ['controlled validity', { invalid: true, errors: ['owner'] }],
  ])('still retires the lease when defaults accompany a %s update', async (_name, policy) => {
    const f = await mount();
    const id = f.api.validate();
    setElementProps(f.root, {
      ...f.props,
      defaultInvalid: true,
      defaultErrors: ['ignored'],
      ...policy,
    });
    await flush();
    expect(f.api.pending.get()).toBe(false);
    expect(f.api.resolveValidation(id, { invalid: false })).toBe(false);
    expect(f.requests).toHaveLength(1);
  });
});
