import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prototype, TemplateChildren } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { createRuntimeSession, type RuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_ROOT_TARGET_CAP,
} from '@proto.ui/module-focus';
import { VISUAL_FEEDBACK_SINK_CAP, type VisualFeedbackFrame } from '@proto.ui/module-feedback';
import { TEXT_CONTROL_DECLARATION } from '@proto.ui/module-text-control';
import { asInputRoot } from '@proto.ui/prototypes-base/input';
import { asTextareaRoot } from '@proto.ui/prototypes-base/textarea';
import { asFieldTextarea } from '@proto.ui/prototypes-base/field';
import { resolveMaterialStyle, colorContrast } from '../../../adapters/base/src/material/style';
import { checkboxRoot, checkboxIndicator } from '../src/checkbox';
import { switchRoot, switchThumb } from '../src/switch';
import { radioGroupRoot, radioGroupItem, radioGroupIndicator } from '../src/radio-group';
import inputRoot from '../src/input';
import textareaRoot from '../src/textarea';
import separatorRoot from '../src/separator';
import fieldSwitch from '../src/field/switch.proto';
import fieldTextarea from '../src/field/textarea.proto';
import { fieldRoot, fieldLabel, fieldDescription, fieldError } from '../src/field';
import { THEME } from '../src/theme';

type Element = HTMLElement & { getExposes(): Record<string, any> };
const make = (prototype: Prototype<any, any>, props: Record<string, unknown> = {}) => {
  const element = document.createElement(prototype.name) as Element;
  setElementProps(element, props);
  return element;
};
const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
  await vi.runOnlyPendingTimersAsync();
  for (let index = 0; index < 30; index++) await Promise.resolve();
};
const click = (element: HTMLElement) =>
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const labelClick = (element: HTMLElement) => {
  for (const type of ['pointerdown', 'pointerup'])
    element.dispatchEvent(
      new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, button: 0 })
    );
  element.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
};
const composition = (type: string, data: string) => {
  const event = new CompositionEvent(type, { bubbles: true });
  Object.defineProperty(event, 'data', { value: data });
  return event;
};

const projectionPrototypes: Prototype<any, any>[] = [
  checkboxRoot,
  checkboxIndicator,
  switchRoot,
  switchThumb,
  radioGroupRoot,
  radioGroupItem,
  radioGroupIndicator,
  inputRoot,
  textareaRoot,
  separatorRoot,
  fieldSwitch,
  fieldTextarea,
  fieldRoot,
  fieldLabel,
  fieldDescription,
  fieldError,
];
for (const prototype of projectionPrototypes) AdaptToWebComponent(prototype);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function mountField(
  prototype: Prototype<any, any>,
  controlProps: Record<string, unknown> = {},
  rootProps: Record<string, unknown> = {}
) {
  const field = make(fieldRoot, rootProps);
  const control = make(prototype, controlProps);
  const label = make(fieldLabel);
  const description = make(fieldDescription);
  const error = make(fieldError);
  label.textContent = 'Setting';
  description.textContent = 'Current help';
  const thumb = prototype === fieldSwitch ? make(switchThumb) : null;
  if (thumb) control.append(thumb);
  field.append(label, description, control, error);
  document.body.append(field);
  return { field, control, label, description, error, thumb };
}

describe('Liquid Glass draft control projections through the real Web Component Adapter', () => {
  it('retains one declared host editor, its contentless renderer and live single-line hints', async () => {
    expect(inputRoot.modules).toEqual(asInputRoot.modules);
    expect(inputRoot.modules).toHaveLength(1);
    expect(inputRoot.modules![0]).toMatchObject({
      id: TEXT_CONTROL_DECLARATION.id,
      config: { content: 'plain-text', lineMode: 'single', engine: 'host' },
    });
    const root = make(inputRoot, {
      defaultValue: 'Draft',
      placeholder: 'Search',
      name: 'query',
      required: true,
      autoComplete: 'off',
      minLength: 2,
      maxLength: 80,
      inputMode: 'search',
      enterKeyHint: 'search',
      ariaLabel: 'Query',
    });
    document.body.append(root);
    await flush();
    const editor = root.querySelector('input')!;
    expect(editor).toBeInstanceOf(HTMLInputElement);
    expect(root.querySelectorAll('input, textarea')).toHaveLength(1);
    expect(editor.children).toHaveLength(0);
    expect(editor.value).toBe('Draft');
    expect(editor.placeholder).toBe('Search');
    expect(editor.name).toBe('query');
    expect(editor.required).toBe(true);
    expect(editor.autocomplete).toBe('off');
    expect(editor.minLength).toBe(2);
    expect(editor.maxLength).toBe(80);
    expect(editor.inputMode).toBe('search');
    expect(editor.enterKeyHint).toBe('search');
    expect(editor.getAttribute('role')).toBe('textbox');
    expect(editor.getAttribute('aria-label')).toBe('Query');
    root.getExposes().focusSelf();
    expect(document.activeElement).toBe(editor);
    editor.setSelectionRange(1, 3);
    setElementProps(root, { defaultValue: 'Draft', ariaLabel: 'Updated query', readOnly: true });
    await flush();
    expect(root.querySelector('input')).toBe(editor);
    expect(editor.selectionStart).toBe(1);
    expect(editor.selectionEnd).toBe(3);
    expect(editor.readOnly).toBe(true);
    expect(editor.getAttribute('aria-readonly')).toBe('true');
    setElementProps(root, { disabled: true });
    await flush();
    editor.blur();
    root.getExposes().focusSelf();
    expect(editor.disabled).toBe(true);
    expect(document.activeElement).not.toBe(editor);
  });

  it.each([
    { prototype: inputRoot, selector: 'input' },
    { prototype: textareaRoot, selector: 'textarea' },
  ])(
    'preserves controlled IME candidates and owner refusal for $selector',
    async ({ prototype, selector }) => {
      const root = make(prototype, { value: 'owner' });
      const proposals: unknown[] = [];
      const compositionEvents: string[] = [];
      root.addEventListener('valueChange', (event) =>
        proposals.push((event as CustomEvent).detail)
      );
      for (const name of ['compositionStart', 'compositionUpdate', 'compositionEnd'])
        root.addEventListener(name, () => compositionEvents.push(name));
      document.body.append(root);
      await flush();
      const editor = root.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      editor.dispatchEvent(composition('compositionstart', ''));
      editor.value = '編集中';
      editor.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: '中',
          inputType: 'insertCompositionText',
          isComposing: true,
        })
      );
      editor.dispatchEvent(composition('compositionupdate', '編集中'));
      expect(editor.value).toBe('編集中');
      expect(root.getExposes().composing.get()).toBe(true);
      expect(proposals).toEqual([
        { value: '編集中', composing: true, data: '中', inputType: 'insertCompositionText' },
      ]);
      editor.dispatchEvent(composition('compositionend', '編集中'));
      await flush();
      expect(editor.value).toBe('owner');
      expect(root.getExposes().value.get()).toBe('owner');
      expect(root.getExposes().composing.get()).toBe(false);
      expect(compositionEvents).toEqual([
        'compositionStart',
        'compositionUpdate',
        'compositionEnd',
      ]);
      setElementProps(root, { value: 'accepted' });
      await flush();
      expect(root.querySelector(selector)).toBe(editor);
      expect(editor.value).toBe('accepted');
    }
  );

  it('retains multiline modules, rows and dirty uncontrolled ownership without another surface', async () => {
    expect(textareaRoot.modules).toEqual(asTextareaRoot.modules);
    expect(fieldTextarea.modules).toEqual(asFieldTextarea.modules);
    expect(textareaRoot.modules).toHaveLength(1);
    expect(textareaRoot.modules![0]).toMatchObject({
      id: TEXT_CONTROL_DECLARATION.id,
      config: { content: 'plain-text', lineMode: 'multiline', engine: 'host' },
    });
    const root = make(textareaRoot, { defaultValue: 'seed', rows: 4, wrap: 'hard' });
    document.body.append(root);
    await flush();
    const editor = root.querySelector('textarea')!;
    expect(root.querySelectorAll('input, textarea')).toHaveLength(1);
    expect(Number(editor.rows)).toBe(4);
    expect(editor.wrap).toBe('hard');
    expect(editor.children).toHaveLength(0);
    editor.value = 'edited\ntext';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    setElementProps(root, {
      defaultValue: 'new default',
      value: 'late owner',
      rows: 6,
      wrap: 'soft',
    });
    await flush();
    expect(root.querySelector('textarea')).toBe(editor);
    expect(editor.value).toBe('edited\ntext');
    expect(editor.defaultValue).toBe('new default');
    expect(root.getExposes().value.get()).toBe('edited\ntext');
    expect(Number(editor.rows)).toBe(6);
    expect(editor.wrap).toBe('soft');
  });

  it('uses one Checkbox owner, renders mixed before checked and preserves slotted content', async () => {
    const root = make(checkboxRoot, { defaultChecked: true, defaultIndeterminate: true });
    const indicator = make(checkboxIndicator);
    const content = document.createElement('span');
    content.setAttribute('aria-hidden', 'true');
    indicator.append(content);
    root.append(indicator, document.createTextNode('Keep copy'));
    const changes: unknown[] = [];
    root.addEventListener('checkedChange', (event) => changes.push((event as CustomEvent).detail));
    document.body.append(root);
    await flush();
    const checked = root.getExposes().checked;
    expect(root.getAttribute('role')).toBe('checkbox');
    expect(root.getAttribute('aria-checked')).toBe('mixed');
    expect(indicator.querySelector('path')?.getAttribute('d')).toBe('M5 12h14');
    expect(indicator.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(indicator.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
    expect(indicator.getExposes().focusSelf).toBeUndefined();
    expect(indicator.getExposes().checkedChange).toBeUndefined();
    click(root);
    await flush();
    expect(root.getExposes().checked).toBe(checked);
    expect(checked.get()).toBe(false);
    expect(root.getExposes().indeterminate.get()).toBe(false);
    expect(indicator.getExposes().isIndeterminate()).toBe(false);
    expect(indicator.querySelector('svg')).toBeNull();
    expect(indicator.contains(content)).toBe(true);
    expect(root.textContent).toBe('Keep copy');
    expect(changes).toEqual([{ checked: false, indeterminate: false }]);
    click(root);
    await flush();
    expect(indicator.getExposes().isChecked()).toBe(true);
    expect(indicator.querySelector('path')?.getAttribute('d')).toBe('m20 6-11 11-5-5');
    expect(root.querySelector('input, button')).toBeNull();
  });

  it('keeps controlled Checkbox rejection until owner acceptance and blocks disabled activation', async () => {
    const root = make(checkboxRoot, { checked: false });
    const indicator = make(checkboxIndicator);
    root.append(indicator);
    const requests: unknown[] = [];
    root.addEventListener('checkedChange', (event) => requests.push((event as CustomEvent).detail));
    document.body.append(root);
    await flush();
    click(root);
    await flush();
    expect(requests).toEqual([{ checked: true, indeterminate: false }]);
    expect(root.getExposes().checked.get()).toBe(false);
    expect(indicator.getExposes().isChecked()).toBe(false);
    setElementProps(root, { checked: true, disabled: true });
    await flush();
    expect(indicator.getExposes().isChecked()).toBe(true);
    expect(indicator.querySelector('path')).not.toBeNull();
    expect(root.getAttribute('aria-disabled')).toBe('true');
    click(root);
    expect(requests).toHaveLength(1);
    expect(root.getExposes().checked.get()).toBe(true);
  });

  it('retains Radio Group selection, roving focus and passive checked indicators', async () => {
    const group = make(radioGroupRoot, { defaultValue: 'a', a11yLabel: 'Delivery' });
    const a = make(radioGroupItem, { value: 'a' });
    const b = make(radioGroupItem, { value: 'b', disabled: true });
    const c = make(radioGroupItem, { value: 'c' });
    const dot = make(radioGroupIndicator);
    c.append(dot);
    group.append(a, b, c);
    document.body.append(group);
    await flush();
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Delivery');
    expect(group.getExposes().getCollectionCount()).toBe(3);
    expect(a.getExposes().checked.get()).toBe(true);
    expect(dot.getExposes().isChecked()).toBe(false);
    a.focus();
    const next = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    window.dispatchEvent(next);
    await flush();
    expect(next.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(c);
    expect(group.getExposes().value.get()).toBe('c');
    expect(dot.getExposes().isChecked()).toBe(true);
    expect(dot.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(dot.getExposes().focusSelf).toBeUndefined();
    setElementProps(group, { value: 'a', a11yLabel: 'Delivery' });
    await flush();
    const requests: unknown[] = [];
    group.addEventListener('valueChange', (event) => requests.push((event as CustomEvent).detail));
    click(c);
    await flush();
    expect(group.getExposes().value.get()).toBe('a');
    expect(dot.getExposes().isChecked()).toBe(false);
    expect(requests).toEqual([{ value: 'c' }]);
    setElementProps(group, { value: 'c', disabled: true });
    await flush();
    click(a);
    expect(group.getExposes().value.get()).toBe('c');
    expect(dot.getExposes().checked.get()).toBe(true);
    expect(dot.getExposes().disabled.get()).toBe(true);
    expect(group.querySelector('input, button')).toBeNull();
  });

  it.each(['ltr', 'rtl'] as const)(
    'transports Switch %s directional preview to one passive Thumb, without committing refused proposals',
    async (direction) => {
      const root = make(switchRoot, { checked: false, draggable: true, direction });
      const thumb = make(switchThumb);
      root.append(thumb);
      // Synthetic host geometry only. Input, Axis/Trigger, context, expose
      // projection and cancellation all execute the actual Adapter/runtime.
      root.style.cssText =
        'box-sizing:border-box;width:32px;height:20px;border:1px solid;padding:0';
      root.getBoundingClientRect = () => new DOMRect(0, 0, 32, 20);
      thumb.style.cssText = 'width:16px;height:16px';
      thumb.getBoundingClientRect = () => new DOMRect(1, 2, 16, 16);
      const changes: unknown[] = [];
      root.addEventListener('checkedChange', (event) =>
        changes.push((event as CustomEvent).detail)
      );
      document.body.append(root);
      await flush();
      const send = (type: string, x: number, target: EventTarget = root) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 31,
            pointerType: 'mouse',
            isPrimary: true,
            button: 0,
            clientX: x,
            clientY: 10,
            detail: 1,
          })
        );
      const start = direction === 'rtl' ? 23 : 9;
      const half = 16;
      const end = direction === 'rtl' ? 9 : 23;
      send('pointerdown', start, thumb);
      send('pointermove', half);
      expect(root.getExposes().dragging.get()).toBe(true);
      expect(root.getExposes().percentage.get()).toBe(50);
      expect(thumb.getExposes().percentage.get()).toBe(50);
      expect(root.getExposes().checked.get()).toBe(false);
      expect(root.getAttribute('aria-checked')).toBe('false');
      expect(thumb.style.getPropertyValue('--pui-percentage')).toBe('50');
      expect(thumb.getExposes().focusSelf).toBeUndefined();
      send('pointermove', end);
      send('pointerup', end);
      send('click', end);
      expect(changes).toEqual([{ checked: true }]);
      expect(root.getExposes().checked.get()).toBe(false);
      expect(thumb.getExposes().percentage.get()).toBe(0);
      send('pointerdown', start);
      send('pointermove', half);
      send('pointercancel', half);
      expect(root.getExposes().dragging.get()).toBe(false);
      expect(root.getExposes().percentage.get()).toBe(0);
      expect(changes).toHaveLength(1);
      setElementProps(root, { checked: true, draggable: true, direction });
      await flush();
      expect(thumb.getExposes().checked.get()).toBe(true);
      expect(thumb.getExposes().percentage.get()).toBe(100);
    }
  );

  it('keeps Separator contentless while switching decorative and semantic orientation', async () => {
    const separator = make(separatorRoot);
    document.body.append(separator);
    await flush();
    expect(separator.getAttribute('aria-hidden')).toBe('true');
    expect(separator.hasAttribute('role')).toBe(false);
    expect(separator.children).toHaveLength(0);
    setElementProps(separator, { orientation: 'vertical', decorative: false });
    await flush();
    expect(separator.getAttribute('role')).toBe('separator');
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(separator.getAttribute('aria-hidden')).not.toBe('true');
    expect(separator.getExposes().orientation.get()).toBe('vertical');
    expect(separator.getExposes().focusSelf).toBeUndefined();
  });

  it('preserves FieldTextarea relationships, selection, inherited policy and the same editor', async () => {
    const m = mountField(fieldTextarea, { defaultValue: 'keep this', rows: 4 });
    await flush();
    const editor = m.control.querySelector('textarea')!;
    const value = m.control.getExposes().value;
    editor.focus();
    editor.setSelectionRange(2, 6);
    setElementProps(m.field, { invalid: true, errors: ['Invalid message'] });
    await flush();
    expect(m.control.querySelector('textarea')).toBe(editor);
    expect(editor.value).toBe('keep this');
    expect(editor.selectionStart).toBe(2);
    expect(editor.selectionEnd).toBe(6);
    expect(Number(editor.rows)).toBe(4);
    expect(m.control.getExposes().value).toBe(value);
    expect(m.control.getExposes().invalid.get()).toBe(true);
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(editor.getAttribute('aria-labelledby')).toBe(m.label.id);
    expect(editor.getAttribute('aria-describedby')).toBe(m.description.id);
    expect(editor.getAttribute('aria-errormessage')).toBe(m.error.id);
    setElementProps(m.field, { disabled: true, readOnly: true, required: true });
    await flush();
    expect(editor.disabled).toBe(true);
    expect(editor.readOnly).toBe(true);
    expect(editor.required).toBe(true);
    setElementProps(m.field, {});
    setElementProps(m.control, { defaultValue: 'keep this', readOnly: true, rows: 5 });
    await flush();
    expect(editor.disabled).toBe(false);
    expect(editor.readOnly).toBe(true);
    expect(editor.value).toBe('keep this');
    expect(Number(editor.rows)).toBe(5);
    setElementProps(m.control, { defaultValue: 'keep this', readOnly: false, rows: 5 });
    m.description.remove();
    await flush();
    const nextDescription = make(fieldDescription);
    m.field.append(nextDescription);
    await flush();
    expect(editor.readOnly).toBe(false);
    expect(editor.getAttribute('aria-describedby')).toBe(nextDescription.id);
    expect(m.control.querySelectorAll('input, textarea')).toHaveLength(1);
    expect(m.control.querySelector('textarea')).toBe(editor);
  });

  it('uses the matching FieldSwitch binding for one label activation and inherited readOnly/disabled', async () => {
    const m = mountField(fieldSwitch);
    const changes: unknown[] = [];
    m.control.addEventListener('checkedChange', (event) =>
      changes.push((event as CustomEvent).detail)
    );
    await flush();
    const checked = m.control.getExposes().checked;
    labelClick(m.label);
    await flush();
    expect(changes).toEqual([{ checked: true }]);
    expect(checked.get()).toBe(true);
    expect(m.field.getExposes().getValidity()).toMatchObject({ filled: true, dirty: true });
    expect(m.control.getAttribute('aria-labelledby')).toBe(m.label.id);
    expect(m.thumb!.getExposes().checked.get()).toBe(true);
    setElementProps(m.field, {
      readOnly: true,
      required: true,
      invalid: true,
      errors: ['Bad setting'],
    });
    await flush();
    labelClick(m.label);
    await flush();
    expect(changes).toHaveLength(1);
    expect(m.control.getAttribute('aria-required')).toBe('true');
    expect(m.control.getAttribute('aria-invalid')).toBe('true');
    expect(m.control.getAttribute('aria-errormessage')).toBe(m.error.id);
    expect(m.control.getExposes().invalid.get()).toBe(true);
    setElementProps(m.field, { disabled: true });
    await flush();
    click(m.control);
    expect(checked.get()).toBe(true);
    expect(changes).toHaveLength(1);
    setElementProps(m.field, {});
    await flush();
    click(m.control);
    expect(m.control.getExposes().checked).toBe(checked);
    expect(checked.get()).toBe(false);
  });

  it.each([
    { prototype: fieldSwitch, props: { defaultChecked: true }, value: true },
    { prototype: fieldTextarea, props: { defaultValue: 'draft' }, value: 'draft' },
  ])(
    'keeps Field validation leases, reset and retirement with $prototype.name',
    async ({ prototype, props, value }) => {
      const m = mountField(prototype, props, {
        externalValidation: true,
        validationMode: 'manual',
      });
      const requests: Array<{ requestId: string; value: unknown }> = [];
      m.field.addEventListener('validationRequest', (event) =>
        requests.push((event as CustomEvent).detail)
      );
      await flush();
      const first = m.field.getExposes().validate();
      expect(typeof first).toBe('string');
      expect(requests.at(-1)?.value).toBe(value);
      expect(m.control.getExposes().pending.get()).toBe(true);
      m.field.getExposes().resetValidation();
      expect(m.control.getExposes().pending.get()).toBe(false);
      expect(m.field.getExposes().resolveValidation(first, { invalid: true })).toBe(false);
      const second = m.field.getExposes().validate();
      expect(m.control.getExposes().pending.get()).toBe(true);
      m.control.remove();
      await flush();
      expect(m.field.getExposes().pending.get()).toBe(false);
      expect(m.field.getExposes().resolveValidation(second, { invalid: true })).toBe(false);
      const replacement = make(prototype, props);
      if (prototype === fieldSwitch) replacement.append(make(switchThumb));
      m.field.append(replacement);
      await flush();
      expect(
        replacement.getAttribute('aria-labelledby') ??
          replacement.querySelector('textarea')?.getAttribute('aria-labelledby')
      ).toBe(m.label.id);
      const current = m.field.getExposes().validate();
      expect(typeof current).toBe('string');
      expect(current).not.toBe(second);
      expect(
        m.field
          .getExposes()
          .resolveValidation(current, { invalid: true, errors: ['Current error'] })
      ).toBe(true);
      expect(replacement.getExposes().invalid.get()).toBe(true);
    }
  );

  it('keeps ordinary controls independent of surrounding Field policy and optional entries useful alone', async () => {
    const field = make(fieldRoot, { disabled: true, readOnly: true, invalid: true });
    const plainSwitch = make(switchRoot);
    const plainTextarea = make(textareaRoot, {
      defaultValue: 'independent',
      describedBy: 'external-help',
    });
    field.append(plainSwitch, plainTextarea);
    const optionalSwitch = make(fieldSwitch);
    const optionalTextarea = make(fieldTextarea, { defaultValue: 'alone' });
    document.body.append(field, optionalSwitch, optionalTextarea);
    await flush();
    click(plainSwitch);
    click(optionalSwitch);
    expect(plainSwitch.getExposes().checked.get()).toBe(true);
    expect(optionalSwitch.getExposes().checked.get()).toBe(true);
    const editor = plainTextarea.querySelector('textarea')!;
    expect(editor.disabled).toBe(false);
    expect(editor.readOnly).toBe(false);
    expect(editor.getAttribute('aria-describedby')).toBe('external-help');
    const standalone = optionalTextarea.querySelector('textarea')!;
    expect(standalone.value).toBe('alone');
    for (const control of [optionalSwitch, standalone])
      for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-errormessage'])
        expect(control.hasAttribute(attr)).toBe(false);
  });
});

// A portable feedback fixture supplies real semantic modules and final frames.
// It observes intent/provenance, never claims optical or native layout evidence.
function feedbackFixture() {
  const parents = new Map<unknown, unknown>();
  const prototypes = new Map<unknown, Prototype<any, any>>();
  const global = new EventTarget();
  const sessions: RuntimeSession<any>[] = [];
  const create = async (
    prototype: Prototype<any, any>,
    initial: Record<string, unknown> = {},
    parent: HTMLElement | null = null
  ) => {
    const target = document.createElement('div');
    let visibleFocus = false;
    const matches = target.matches.bind(target);
    vi.spyOn(target, 'matches').mockImplementation((selector) =>
      selector === ':focus-visible' ? visibleFocus : matches(selector)
    );
    parents.set(target, parent);
    prototypes.set(target, prototype);
    let props = initial;
    let exposes: Record<string, any> = {};
    const frames: VisualFeedbackFrame[] = [];
    const commits: TemplateChildren[] = [];
    const events: Array<{ key: string; payload: unknown }> = [];
    const release = vi.fn();
    const session = createRuntimeSession(prototype, {
      prototypeName: prototype.name,
      getRawProps: () => props,
      schedule: (task) => task(),
      scheduleDelay(duration, task) {
        const id = setTimeout(task, duration);
        return { cancel: () => clearTimeout(id) };
      },
      commit(children, signal) {
        commits.push(children);
        signal?.done();
      },
      onRuntimeReady(w) {
        const parentOf = (token: unknown) => parents.get(token) ?? null;
        const protoOf = (token: unknown) => prototypes.get(token) ?? null;
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, parentOf],
          [ANATOMY_GET_PROTO_CAP, protoOf],
          [ANATOMY_ROOT_TARGET_CAP, (token: unknown) => token as HTMLElement],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, parentOf],
        ]);
        w.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, parentOf],
          [AS_TRIGGER_GET_PROTO_CAP, protoOf],
        ]);
        w.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, target],
          [FOCUS_PARENT_CAP, parentOf],
          [FOCUS_ROOT_TARGET_CAP, () => target],
        ]);
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => global],
        ]);
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (next: Record<string, any>) => {
              exposes = next;
            },
          ],
        ]);
        w.attach('expose-event', [
          [EXPOSE_EVENT_SINK_CAP, (key: string, payload: unknown) => events.push({ key, payload })],
        ]);
        w.attach('feedback', [
          [
            VISUAL_FEEDBACK_SINK_CAP,
            { commit: (frame: VisualFeedbackFrame) => frames.push(frame), release },
          ],
        ]);
      },
    });
    sessions.push(session);
    await session.mount();
    return {
      target,
      session,
      release,
      frames,
      commits,
      events,
      state: () => exposes,
      frame: () => frames.at(-1)!,
      tokens: () => frames.at(-1)!.style.tokens,
      fire: (type: string) => target.dispatchEvent(new CustomEvent(type)),
      focus() {
        visibleFocus = true;
        target.dispatchEvent(new CustomEvent('host:focus'));
      },
      set(next: Record<string, unknown>) {
        props = next;
        session.controller.applyRawProps(next);
      },
    };
  };
  return {
    create,
    async dispose() {
      for (const session of sessions.reverse()) await session.dispose();
    },
  };
}

const candidate = (checked: boolean, pressed = false) => ({
  intent: 'liquid-glass',
  variant: 'regular',
  ...(checked ? { tint: 'style-fill' } : {}),
  deformation: { kind: 'press', phase: pressed ? 'pressed' : 'rest', contact: 'pointer' },
});

describe('Liquid draft controls: exact functional material ownership and complete fallback', () => {
  it.each([
    { prototype: checkboxRoot, parent: null, key: null },
    { prototype: switchRoot, parent: null, key: null },
    { prototype: radioGroupItem, parent: radioGroupRoot, key: 'value' },
    { prototype: fieldSwitch, parent: fieldRoot, key: null },
  ])(
    'keeps one readable material owner for $prototype.name across state, focus and disabled',
    async ({ prototype, parent, key }) => {
      const f = feedbackFixture();
      try {
        const root = parent ? await f.create(parent) : null;
        const c = await f.create(
          prototype,
          key ? { value: 'a' } : { checked: false },
          root?.target
        );
        const setChecked = (
          checked: boolean,
          disabled = false,
          material: 'auto' | 'opaque' = 'auto'
        ) => {
          if (key) {
            c.set({ value: 'a', material });
            root!.set({ value: checked ? 'a' : '', disabled });
          } else c.set({ checked, disabled, material });
        };
        if (root) expect(root.frame().material).toEqual({ slot: null, candidates: [] });
        for (const checked of [false, true]) {
          setChecked(checked);
          expect(c.frame().material.slot).toMatchObject({
            version: 2,
            source: { kind: 'in-app-backdrop' },
            fallback: { fill: 'style', foreground: 'style' },
          });
          expect(c.frame().material.candidates).toEqual([candidate(checked)]);
          for (const theme of ['light', 'dark'] as const) {
            const fallback = resolveMaterialStyle(c.tokens(), THEME[theme]);
            expect(fallback.provenance).toBe('post-patch-complete');
            expect(fallback.competingPaint).toEqual([]);
            expect(fallback.fill?.[3]).toBe(1);
            expect(fallback.foreground?.[3]).toBe(1);
            expect(colorContrast(fallback.fill!, fallback.foreground!)).toBeGreaterThanOrEqual(4.5);
          }
          c.fire('pointer.down');
          expect(c.frame().material.candidates).toEqual([candidate(checked, true)]);
          c.fire('pointer.cancel');
          expect(c.frame().material.candidates).toEqual([candidate(checked)]);
          expect(c.events).toEqual([]);
          c.focus();
          expect(c.tokens()).toContain('forced-colors-focus-outline');
          expect(c.state().checked.get()).toBe(checked);
          setChecked(checked, true);
          expect(c.state().disabled.get()).toBe(true);
          expect(c.state().checked.get()).toBe(checked);
          expect(c.frame().material.candidates).toEqual([]);
          expect(c.tokens()).toContain('cursor-not-allowed');
          expect(c.tokens()).not.toContain('opacity-50');
          for (const theme of ['light', 'dark'] as const) {
            const disabled = resolveMaterialStyle(c.tokens(), THEME[theme]);
            expect(disabled.provenance).toBe('post-patch-complete');
            expect(disabled.fill?.[3]).toBe(1);
            expect(disabled.foreground?.[3]).toBe(1);
            expect(colorContrast(disabled.fill!, disabled.foreground!)).toBeGreaterThanOrEqual(4.5);
          }
          setChecked(checked, false, 'opaque');
          expect(c.frame().material.candidates).toEqual([]);
        }
        expect(c.frames.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
        const view = c.frame().view;
        await c.session.unmount();
        expect(c.release).toHaveBeenCalledWith(view);
        await c.session.mount();
        expect(c.frame().view).toBeGreaterThan(view);
        expect(c.frame().material.candidates).toEqual([]);
      } finally {
        await f.dispose();
      }
    }
  );

  it('keeps structural, passive and editor parts without another optical surface', async () => {
    const f = feedbackFixture();
    try {
      const checkbox = await f.create(checkboxRoot);
      const indicator = await f.create(checkboxIndicator, {}, checkbox.target);
      const toggle = await f.create(switchRoot);
      const thumb = await f.create(switchThumb, {}, toggle.target);
      const group = await f.create(radioGroupRoot);
      const item = await f.create(radioGroupItem, { value: 'a' }, group.target);
      const dot = await f.create(radioGroupIndicator, {}, item.target);
      const separator = await f.create(separatorRoot);
      const input = await f.create(inputRoot);
      const textarea = await f.create(textareaRoot);
      const field = await f.create(fieldRoot);
      const multiline = await f.create(fieldTextarea, {}, field.target);
      for (const part of [
        indicator,
        thumb,
        group,
        dot,
        separator,
        input,
        textarea,
        field,
        multiline,
      ])
        expect(part.frame().material).toEqual({ slot: null, candidates: [] });
      for (const contentless of [separator, input, textarea, multiline])
        expect(contentless.commits.at(-1)).toBeNull();
      checkbox.fire('press.commit');
      await indicator.session.unmount();
      const retiredCommits = indicator.commits.length;
      await flush();
      expect(indicator.commits).toHaveLength(retiredCommits);
    } finally {
      await f.dispose();
    }
  });
});
