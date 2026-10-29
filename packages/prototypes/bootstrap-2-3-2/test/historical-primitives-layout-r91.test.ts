import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterPrototype, ProtoAdapterExposes } from '@proto.ui/adapter-base';
import { createWebMoveGestureHost } from '@proto.ui/adapter-base';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  createWebScrollSurfaceHost,
  SCROLL_SURFACE_HOST_CAP,
  type ScrollPort,
  type ScrollSurfaceHost,
  type ScrollSurfaceHostAttachment,
} from '@proto.ui/module-scroll';
import {
  scrollAreaRoot,
  scrollAreaViewport,
  scrollAreaScrollbar,
  scrollAreaThumb,
} from '../src/scroll-area';
import type { ScrollAreaViewportProps } from '@proto.ui/prototypes-base/scroll-area';
import {
  accordionRoot,
  accordionItem,
  accordionHeading,
  accordionTrigger,
  accordionContent,
} from '../src/accordion';
import { collapsibleRoot, collapsibleTrigger, collapsibleContent } from '../src/collapsible';
import { fieldRoot, fieldControl, fieldLabel, fieldDescription, fieldError } from '../src/field';
import { fieldsetRoot, fieldsetLegend, fieldsetDescription } from '../src/fieldset';
import { formRoot, formField, formSubmit, formReset } from '../src/form';
import { inputRoot } from '../src/input';
import {
  inputOtpRoot,
  inputOtpInput,
  inputOtpControl,
  inputOtpSlot,
  inputOtpSeparator,
} from '../src/input-otp';
import {
  numberFieldRoot,
  numberFieldInput,
  numberFieldControl,
  numberFieldIncrement,
  numberFieldDecrement,
} from '../src/number-field';
import { checkboxGroupRoot, checkboxGroupItem, checkboxGroupAll } from '../src/checkbox-group';
import { checkboxRoot, checkboxIndicator } from '../src/checkbox';
import { bootstrap232Button } from '../src/button';
import { toggle } from '../src/toggle';
import { surfaceRoot } from '../src/surface';
import { textRoot } from '../src/text';
import { separatorRoot } from '../src/separator';
import { resizableRoot, resizablePanel, resizableHandle } from '../src/resizable';
import {
  messageScrollerRoot,
  messageScrollerViewport,
  messageScrollerJump,
} from '../src/message-scroller';
import { virtualListRoot, virtualListViewport, virtualListContent } from '../src/virtual-list';
import {
  sliderRoot,
  sliderLabel,
  sliderTrack,
  sliderIndicator,
  sliderThumb,
  sliderFieldThumb,
  sliderValue,
} from '../src/slider';

// Projection preference belongs to the actual Adapter environment, not an
// ordinary ScrollArea prop or a second authored ScrollSurface owner.
const ComposedViewportElement = AdaptToWebComponent(scrollAreaViewport, {
  registerAs: 'test-bootstrap232-composed-scroll-viewport-r91',
  scrollProjection: 'composed',
});

const protos = [
  scrollAreaRoot,
  scrollAreaViewport,
  scrollAreaScrollbar,
  scrollAreaThumb,
  accordionRoot,
  accordionItem,
  accordionHeading,
  accordionTrigger,
  accordionContent,
  collapsibleRoot,
  collapsibleTrigger,
  collapsibleContent,
  fieldRoot,
  fieldControl,
  fieldLabel,
  fieldDescription,
  fieldError,
  fieldsetRoot,
  fieldsetLegend,
  fieldsetDescription,
  formRoot,
  formField,
  formSubmit,
  formReset,
  inputRoot,
  inputOtpRoot,
  inputOtpInput,
  inputOtpControl,
  inputOtpSlot,
  inputOtpSeparator,
  numberFieldRoot,
  numberFieldInput,
  numberFieldControl,
  numberFieldIncrement,
  numberFieldDecrement,
  checkboxGroupRoot,
  checkboxGroupItem,
  checkboxGroupAll,
  checkboxRoot,
  checkboxIndicator,
  toggle,
  bootstrap232Button,
  surfaceRoot,
  textRoot,
  separatorRoot,
  resizableRoot,
  resizablePanel,
  resizableHandle,
  messageScrollerRoot,
  messageScrollerViewport,
  messageScrollerJump,
  virtualListRoot,
  virtualListViewport,
  virtualListContent,
  sliderRoot,
  sliderLabel,
  sliderTrack,
  sliderIndicator,
  sliderThumb,
  sliderFieldThumb,
  sliderValue,
] as const;
for (const proto of protos) AdaptToWebComponent(proto);

type Host<TProto extends AdapterPrototype> = HTMLElement & {
  getExposes(): ProtoAdapterExposes<TProto>;
};
async function settle(): Promise<void> {
  for (let i = 0; i < 40; i++) await Promise.resolve();
  // Drain only the actual zero-delay render invalidations used by passive glyphs.
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function part<TProto extends AdapterPrototype>(
  proto: TProto,
  props: Record<string, unknown> = {}
): Host<TProto> {
  // Each tag was registered above from this exact Prototype.
  const element = document.createElement(proto.name) as Host<TProto>;
  setElementProps(element, props);
  return element;
}
async function update(element: HTMLElement, props: Record<string, unknown>): Promise<void> {
  setElementProps(element, props);
  await settle();
}
async function click(element: HTMLElement): Promise<void> {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, button: 0 }));
  await settle();
}
function editor(control: HTMLElement): HTMLInputElement {
  const input = control.shadowRoot?.querySelector('input') ?? control.querySelector('input');
  if (!input) throw new Error('Expected the one real host editor.');
  return input;
}
async function type(control: HTMLElement, value: string, composing = false): Promise<void> {
  const input = editor(control);
  input.value = value;
  input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: value,
      inputType: 'insertText',
      isComposing: composing,
    })
  );
  await settle();
}
function pointer(type: string, props: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    ...props,
  });
}
function metrics(target: HTMLElement, overflowing = true): void {
  Object.defineProperties(target, {
    clientWidth: { configurable: true, value: 100 },
    scrollWidth: { configurable: true, value: overflowing ? 400 : 100 },
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: overflowing ? 400 : 100 },
    scrollLeft: { configurable: true, writable: true, value: 0 },
    scrollTop: { configurable: true, writable: true, value: 0 },
  });
}
function scrollFixture(composed = false) {
  const root = part(scrollAreaRoot);
  const viewport = composed ? new ComposedViewportElement() : part(scrollAreaViewport);
  const vertical = part(scrollAreaScrollbar);
  const horizontal = part(scrollAreaScrollbar, { orientation: 'horizontal' });
  const verticalThumb = part(scrollAreaThumb);
  const horizontalThumb = part(scrollAreaThumb);
  const content = document.createElement('button');
  content.textContent = 'Authored content';
  metrics(viewport);
  Object.defineProperties(vertical, {
    clientHeight: { configurable: true, value: 100 },
    clientWidth: { configurable: true, value: 12 },
  });
  Object.defineProperties(horizontal, {
    clientWidth: { configurable: true, value: 100 },
    clientHeight: { configurable: true, value: 12 },
  });
  vertical.getBoundingClientRect = () => new DOMRect(88, 0, 12, 100);
  horizontal.getBoundingClientRect = () => new DOMRect(0, 88, 100, 12);
  verticalThumb.getBoundingClientRect = () => new DOMRect(88, 0, 12, 25);
  horizontalThumb.getBoundingClientRect = () => new DOMRect(0, 88, 25, 12);
  viewport.append(content);
  vertical.append(verticalThumb);
  horizontal.append(horizontalThumb);
  root.append(viewport, vertical, horizontal);
  document.body.append(root);
  return { root, viewport, vertical, horizontal, verticalThumb, horizontalThumb, content };
}

beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  try {
    document.body.replaceChildren();
    await settle();
  } finally {
    vi.useRealTimers();
  }
});

describe('Bootstrap 2.3.2 primitives/layout: real WC runtime, not native paint acceptance', () => {
  it('keeps one system scroll surface, normalized two-axis facts and authored content', async () => {
    const f = scrollFixture();
    await settle();
    const state = f.viewport.getExposes();
    expect(state.scrollProjection.get()).toBe('system');
    expect(state.scrollXVisibleRatio.get()).toBe(0.25);
    expect(state.scrollYVisibleRatio.get()).toBe(0.25);
    expect(state.canScrollRight.get()).toBe(true);
    expect(state.canScrollDown.get()).toBe(true);
    expect(f.viewport.getAttribute('tabindex')).toBe('0');
    expect(f.viewport.getAttribute('role')).toBeNull();
    expect(f.root.getAttribute('tabindex')).toBeNull();
    expect(f.verticalThumb.tabIndex).toBe(-1);
    expect(f.verticalThumb.getAttribute('role')).toBeNull();
    expect(f.vertical.style.display).toBe('none');
    f.viewport.scrollLeft = 150;
    f.viewport.scrollTop = 300;
    f.viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(state.scrollXPosition.get()).toBe(0.5);
    expect(state.scrollYPosition.get()).toBe(1);
    expect(state.canScrollDown.get()).toBe(false);
    expect(f.viewport.querySelector('button')).toBe(f.content);
    f.viewport.focus();
    metrics(f.viewport, false);
    f.viewport.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(f.viewport.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(f.viewport);
    expect(f.viewport.querySelector('button')).toBe(f.content);
  });

  it('binds composed chrome to the same surface, replaces Thumb leases and cleans up', async () => {
    const f = scrollFixture(true);
    await settle();
    expect(f.viewport.getExposes().scrollProjection.get()).toBe('composed');
    expect(f.verticalThumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('25px');
    expect(f.horizontalThumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('25px');
    f.verticalThumb.dispatchEvent(pointer('pointerdown', { isPrimary: false, clientY: 5 }));
    f.verticalThumb.dispatchEvent(pointer('pointermove', { isPrimary: false, clientY: 45 }));
    expect(f.viewport.scrollTop).toBe(0);
    f.verticalThumb.dispatchEvent(pointer('pointerdown', { clientY: 5 }));
    f.verticalThumb.dispatchEvent(pointer('pointermove', { pointerId: 8, clientY: 45 }));
    expect(f.viewport.scrollTop).toBe(0);
    f.verticalThumb.dispatchEvent(pointer('pointermove', { clientY: 45 }));
    f.verticalThumb.dispatchEvent(pointer('pointerup', { clientY: 45 }));
    expect(f.viewport.scrollTop).toBeGreaterThan(0);
    f.horizontalThumb.dispatchEvent(pointer('pointerdown', { clientX: 5 }));
    f.horizontalThumb.dispatchEvent(pointer('pointermove', { clientX: 45 }));
    f.horizontalThumb.dispatchEvent(pointer('pointerup', { clientX: 45 }));
    expect(f.viewport.scrollLeft).toBeGreaterThan(0);
    f.viewport.scrollTop = 0;
    const replacement = part(scrollAreaThumb);
    replacement.getBoundingClientRect = () => new DOMRect(88, 0, 12, 25);
    f.verticalThumb.replaceWith(replacement);
    await settle();
    for (const type of ['pointerdown', 'pointermove', 'pointerup'])
      f.verticalThumb.dispatchEvent(pointer(type, { clientY: type === 'pointerdown' ? 5 : 45 }));
    expect(f.viewport.scrollTop).toBe(0);
    for (const type of ['pointerdown', 'pointermove', 'pointerup'])
      replacement.dispatchEvent(pointer(type, { clientY: type === 'pointerdown' ? 5 : 45 }));
    expect(f.viewport.scrollTop).toBeGreaterThan(0);
    f.root.remove();
    await settle();
    f.viewport.scrollTop = 0;
    for (const type of ['pointerdown', 'pointermove', 'pointerup'])
      replacement.dispatchEvent(pointer(type, { clientY: type === 'pointerdown' ? 5 : 45 }));
    expect(f.viewport.scrollTop).toBe(0);
  });

  it('falls back from host-preferred composed chrome to the actual system host', async () => {
    const target = document.createElement(scrollAreaViewport.name);
    const webHost = createWebScrollSurfaceHost(target, {
      moveGestureHost: createWebMoveGestureHost(),
      preference: 'composed',
    });
    const attachments: ScrollSurfaceHostAttachment[] = [];
    const scrollHost: ScrollSurfaceHost = {
      ...webHost,
      support: Object.freeze({ system: true, composed: false }),
      attach(connection) {
        attachments.push(connection);
        return webHost.attach(connection);
      },
    };
    const host: RuntimeHost<ScrollAreaViewportProps> = {
      prototypeName: 'test-bootstrap232-scroll-system-fallback-r91',
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, () => null],
          [ANATOMY_GET_PROTO_CAP, () => scrollAreaViewport],
          [ANATOMY_ROOT_TARGET_CAP, () => target],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, () => null],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => target],
        ]);
        wiring.attach('scroll', [[SCROLL_SURFACE_HOST_CAP, scrollHost]]);
      },
    };
    const session = createRuntimeSession(scrollAreaViewport, host);
    try {
      await session.mount();
      expect(attachments).toHaveLength(1);
      expect(attachments[0]?.config.projection).toBe('auto');
      expect(attachments[0]?.projection).toBe('system');
      expect(session.caps.getPort<ScrollPort>('scroll')?.getSnapshot().projection).toBe('system');
      expect(target.getAttribute('data-pui-scroll-projection')).toBe('system');
    } finally {
      await session.dispose();
    }
    expect(target.hasAttribute('data-pui-scroll-projection')).toBe(false);
  });

  it('keeps Scrollbar orientation updates passive and content identity stable', async () => {
    const f = scrollFixture();
    await settle();
    f.horizontal.remove();
    await settle();
    await update(f.vertical, { orientation: 'horizontal' });
    expect(f.vertical.getExposes().orientation.get()).toBe('horizontal');
    expect(f.vertical.getAttribute('role')).toBeNull();
    expect(f.vertical.getAttribute('tabindex')).toBeNull();
    expect(f.vertical.querySelector(scrollAreaThumb.name)).toBe(f.verticalThumb);
    expect(f.viewport.querySelector('button')).toBe(f.content);
  });

  it('preserves controlled Accordion requests, exact relations and retained content', async () => {
    const root = part(accordionRoot, { openItems: [] });
    const item = part(accordionItem, { value: 'details' });
    const heading = part(accordionHeading, { level: 2 });
    const trigger = part(accordionTrigger);
    const content = part(accordionContent, { keepMounted: true, region: true });
    const child = document.createElement('button');
    trigger.textContent = 'Details';
    child.textContent = 'Retained child';
    content.append(child);
    heading.append(trigger);
    item.append(heading, content);
    root.append(item);
    const requests: unknown[] = [];
    root.addEventListener('openChange', (event) =>
      requests.push((event as CustomEvent<unknown>).detail)
    );
    document.body.append(root);
    await settle();
    await click(trigger);
    expect(requests).toHaveLength(1);
    expect(root.getExposes().getOpenItems()).toEqual([]);
    expect(content.getExposes().hidden.get()).toBe(true);
    await update(root, { openItems: ['details'] });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(content.getAttribute('aria-labelledby')).toBe(trigger.id);
    expect(heading.getAttribute('aria-level')).toBe('2');
    expect(content.querySelector('button')).toBe(child);
    await update(root, { openItems: ['details'], disabled: true });
    await click(trigger);
    expect(requests).toHaveLength(1);
    expect(root.getExposes().getOpenItems()).toEqual(['details']);
    await update(root, { openItems: [] });
    expect(content.getExposes().hidden.get()).toBe(true);
    expect(content.querySelector('button')).toBe(child);
  });

  it('keeps Collapsible request-only ownership and a role-neutral retained panel', async () => {
    const root = part(collapsibleRoot, { open: false });
    const trigger = part(collapsibleTrigger);
    const content = part(collapsibleContent, { keepMounted: true });
    const authored = document.createElement('span');
    authored.textContent = 'Portable disclosure';
    content.append(authored);
    root.append(trigger, content);
    const requests: unknown[] = [];
    root.addEventListener('openChange', (event) =>
      requests.push((event as CustomEvent<unknown>).detail)
    );
    document.body.append(root);
    await settle();
    await click(trigger);
    expect(requests).toHaveLength(1);
    expect(root.getExposes().open.get()).toBe(false);
    await update(root, { open: true });
    expect(content.getExposes().hidden.get()).toBe(false);
    expect(content.getAttribute('role')).toBeNull();
    expect(content.firstElementChild).toBe(authored);
    await update(root, { open: true, disabled: true });
    await click(trigger);
    expect(requests).toHaveLength(1);
    expect(root.getExposes().open.get()).toBe(true);
  });

  it('preserves one standalone editor and controlled refusal through policy withdrawal', async () => {
    const control = part(inputRoot, { value: 'owned', ariaLabel: 'Name' });
    const requests: string[] = [];
    control.addEventListener('valueChange', (event) =>
      requests.push((event as CustomEvent<{ value: string }>).detail.value)
    );
    document.body.append(control);
    await settle();
    const input = editor(control);
    expect(control.querySelectorAll('input,textarea,[contenteditable]')).toHaveLength(1);
    await type(control, 'proposal');
    expect(requests).toEqual(['proposal']);
    expect(control.getExposes().value.get()).toBe('owned');
    expect(input.value).toBe('owned');
    await update(control, { value: 'accepted', disabled: true, readOnly: true });
    expect(input.disabled).toBe(true);
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('accepted');
    await update(control, { value: 'restored', disabled: false, readOnly: false });
    expect(editor(control)).toBe(input);
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(false);
    expect(input.value).toBe('restored');
  });

  it('paints only canonical Field validity and retains the one editor/association owner', async () => {
    const root = part(fieldRoot, { invalid: false, required: true, validationMode: 'manual' });
    const label = part(fieldLabel);
    const help = part(fieldDescription);
    const error = part(fieldError, { keepMounted: true });
    const control = part(fieldControl);
    label.textContent = 'Account';
    help.textContent = 'Required account';
    root.append(label, help, control, error);
    const proposals: unknown[] = [];
    root.addEventListener('validityChange', (event) =>
      proposals.push((event as CustomEvent<unknown>).detail)
    );
    document.body.append(root);
    await settle();
    const input = editor(control);
    expect(root.hasAttribute('data-invalid')).toBe(false);
    expect(input.getAttribute('aria-labelledby')).toBe(label.id);
    expect(input.getAttribute('aria-describedby')).toBe(help.id);
    root.getExposes().validate();
    await settle();
    expect(proposals).toHaveLength(1);
    expect(root.getExposes().invalid.get()).toBe(false);
    expect(root.hasAttribute('data-invalid')).toBe(false);
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    await update(root, {
      invalid: true,
      errors: ['Owner rejected the account'],
      required: true,
      readOnly: true,
    });
    expect(root.getExposes().invalid.get()).toBe(true);
    expect(root.hasAttribute('data-invalid')).toBe(true);

    expect(input.getAttribute('aria-errormessage')).toBe(error.id);
    expect(error.textContent).toContain('Owner rejected the account');
    expect(input.readOnly).toBe(true);
    help.remove();
    await settle();
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    await update(root, { invalid: false, required: true, readOnly: false });
    expect(editor(control)).toBe(input);
    expect(root.hasAttribute('data-invalid')).toBe(false);
    expect(input.hasAttribute('aria-errormessage')).toBe(false);
    expect(input.readOnly).toBe(false);
  });

  it('inherits Fieldset disabled, Form submit/reset, and local disabled policy without latching', async () => {
    const group = part(fieldsetRoot);
    const legend = part(fieldsetLegend);
    const description = part(fieldsetDescription);
    const form = part(formRoot);
    const field = part(formField, { name: 'name', required: true });
    const control = part(fieldControl, { defaultValue: 'Ada' });
    const local = part(formField, { name: 'local', disabled: true });
    const localControl = part(fieldControl, { defaultValue: 'private' });
    const submit = part(formSubmit);
    const reset = part(formReset);
    legend.textContent = 'Profile';
    description.textContent = 'Public profile';
    field.append(control);
    local.append(localControl);
    form.append(field, local, submit, reset);
    group.append(legend, description, form);
    document.body.append(group);
    const submitted: unknown[] = [];
    const resets: unknown[] = [];
    form.addEventListener('submit', (event) =>
      submitted.push((event as CustomEvent<unknown>).detail)
    );
    form.addEventListener('reset', (event) => resets.push((event as CustomEvent<unknown>).detail));
    await settle();
    expect(group.getAttribute('aria-labelledby')).toBe(legend.id);
    expect(group.getAttribute('aria-describedby')).toBe(description.id);
    expect(form.getExposes().getValues()).toEqual({ name: 'Ada' });
    await click(submit);
    expect(submitted).toHaveLength(1);
    await update(group, { disabled: true });
    expect(editor(control).disabled).toBe(true);
    // Fieldset controls descendants; Form action policy remains independently owned.
    await update(form, { disabled: true });
    await click(submit);
    expect(submitted).toHaveLength(1);
    await update(group, { disabled: false });
    await update(form, { disabled: false });
    expect(editor(control).disabled).toBe(false);
    expect(editor(localControl).disabled).toBe(true);
    await type(control, 'Grace');
    await click(reset);
    expect(resets).toHaveLength(1);
    expect(editor(control).value).toBe('Ada');
    expect(form.getExposes().submitted.get()).toBe(false);
  });

  it('keeps Number and OTP modules, Field reports and typed Form values together', async () => {
    const form = part(formRoot);
    const numberField = part(formField, { name: 'quantity' });
    const number = part(numberFieldRoot, { defaultValue: 2, min: 0, max: 10 });
    const numberControl = part(numberFieldControl);
    const increment = part(numberFieldIncrement);
    const decrement = part(numberFieldDecrement);
    const otpField = part(formField, { name: 'code' });
    const otp = part(inputOtpRoot, { defaultValue: '12', length: 4 });
    const otpControl = part(inputOtpControl);
    const slot = part(inputOtpSlot, { index: 0 });
    const separator = part(inputOtpSeparator);
    number.append(decrement, numberControl, increment);
    otp.append(otpControl, slot, separator);
    numberField.append(number);
    otpField.append(otp);
    form.append(numberField, otpField);
    document.body.append(form);
    await settle();
    expect(form.getExposes().getValues()).toEqual({ quantity: 2, code: '12' });
    expect(numberControl.querySelectorAll('input')).toHaveLength(1);
    expect(otpControl.querySelectorAll('input')).toHaveLength(1);
    await click(increment);
    await type(otpControl, '3456');
    expect(form.getExposes().getValues()).toEqual({ quantity: 3, code: '3456' });
    expect(slot.getExposes().character.get()).toBe('3');
    expect(otp.getExposes().complete.get()).toBe(true);
    form.getExposes().requestReset();
    await settle();
    expect(form.getExposes().getValues()).toEqual({ quantity: 2, code: '12' });
    expect(editor(numberControl).value).toBe('2');
    expect(editor(otpControl).value).toBe('12');
    await update(number, { value: 10, min: 0, max: 10, readOnly: true });
    await click(decrement);
    expect(number.getExposes().value.get()).toBe(10);
    expect(editor(numberControl).readOnly).toBe(true);
  });

  it('does not let OTP composition or its paint become a second controlled value owner', async () => {
    const root = part(inputOtpRoot, { value: '12', length: 4 });
    const control = part(inputOtpInput);
    const requests: string[] = [];
    root.append(control);
    root.addEventListener('valueChange', (event) =>
      requests.push((event as CustomEvent<{ value: string }>).detail.value)
    );
    document.body.append(root);
    await settle();
    const input = editor(control);
    input.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, composed: true })
    );
    await type(control, '3456', true);
    expect(requests).toEqual([]);
    input.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '3456' })
    );
    await settle();
    expect(requests).toEqual(['3456']);
    expect(root.getExposes().value.get()).toBe('12');
    expect(input.value).toBe('12');
    await update(root, { value: '3456', length: 4, disabled: true });
    expect(input.value).toBe('3456');
    expect(input.disabled).toBe(true);
    await update(root, { value: '3456', length: 4, readOnly: true });
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(true);
    expect(editor(control)).toBe(input);
  });

  it('keeps Checkbox Group aggregate requests controlled and rejects a withdrawn item', async () => {
    const root = part(checkboxGroupRoot, { value: ['a'] });
    const a = part(checkboxGroupItem, { value: 'a' });
    const b = part(checkboxGroupItem, { value: 'b' });
    const all = part(checkboxGroupAll);
    a.textContent = 'Alpha';
    b.textContent = 'Beta';
    all.textContent = 'All choices';
    root.append(all, a, b);
    const requests: string[][] = [];
    root.addEventListener('valueChange', (event) =>
      requests.push((event as CustomEvent<{ value: string[] }>).detail.value)
    );
    document.body.append(root);
    await settle();
    expect(all.getAttribute('aria-checked')).toBe('mixed');
    await click(b);
    expect(requests).toEqual([['a', 'b']]);
    expect(root.getExposes().getValue()).toEqual(['a']);
    expect(b.textContent).toContain('Beta');
    b.remove();
    await settle();
    expect(root.getExposes().requestToggle('b')).toBe(false);
    expect(requests).toHaveLength(1);
    await update(root, { value: ['a'], readOnly: true });
    await click(all);
    expect(requests).toHaveLength(1);
    expect(a.getExposes().checked.get()).toBe(true);
    expect(a.getExposes().readOnly.get()).toBe(true);
  });

  it('keeps Checkbox and Toggle controlled requests separate from accepted indicator state', async () => {
    const checkbox = part(checkboxRoot, { checked: false });
    const indicator = part(checkboxIndicator);
    const toggleRoot = part(toggle, { active: false });
    indicator.textContent = 'Authored marker';
    checkbox.append(indicator);
    document.body.append(checkbox, toggleRoot);
    const requests: unknown[] = [];
    checkbox.addEventListener('checkedChange', (event) =>
      requests.push((event as CustomEvent<unknown>).detail)
    );
    toggleRoot.addEventListener('activeChange', (event) =>
      requests.push((event as CustomEvent<unknown>).detail)
    );
    await settle();
    await click(checkbox);
    await click(toggleRoot);
    expect(requests).toHaveLength(2);
    expect(checkbox.getExposes().checked.get()).toBe(false);
    expect(indicator.getExposes().isChecked()).toBe(false);
    expect(toggleRoot.getExposes().active.get()).toBe(false);
    await update(checkbox, { checked: true, indeterminate: true, disabled: true });
    await click(checkbox);
    expect(requests).toHaveLength(2);
    expect(indicator.getExposes().isIndeterminate()).toBe(true);
    expect(indicator.textContent).toContain('Authored marker');
  });

  it('keeps one Button interaction owner as size, variant and disabled policy change', async () => {
    const button = part(bootstrap232Button, { size: 'large', variant: 'primary' });
    const caption = document.createElement('span');
    caption.textContent = 'Submit';
    button.append(caption);
    document.body.append(button);
    await settle();
    expect(button.getAttribute('role')).toBe('button');
    expect(button.getExposes().disabled.get()).toBe(false);
    button.dispatchEvent(pointer('pointerenter'));
    button.dispatchEvent(pointer('pointerdown'));
    await settle();
    expect(button.getExposes().hovered.get()).toBe(true);
    expect(button.getExposes().pressed.get()).toBe(true);
    await update(button, { size: 'mini', variant: 'danger', disabled: true });
    expect(button.getExposes().disabled.get()).toBe(true);
    expect(button.getExposes().hovered.get()).toBe(false);
    expect(button.getExposes().pressed.get()).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.querySelector('span')).toBe(caption);
    await update(button, {});
    expect(button.getExposes().disabled.get()).toBe(false);
    expect(button.getAttribute('aria-disabled')).not.toBe('true');
    expect(button.querySelector('span')).toBe(caption);
  });

  it('keeps ordinary Surface/Text passive while authored descendants retain focus and activation', async () => {
    const surface = part(surfaceRoot);
    const text = part(textRoot, { size: '2xl', leading: 'size' });
    const button = document.createElement('button');
    let activations = 0;
    button.textContent = 'Actual consumer';
    button.addEventListener('click', () => activations++);
    text.append(button);
    surface.append(text);
    document.body.append(surface);
    await settle();
    button.focus();
    await click(button);
    expect(activations).toBe(1);
    await update(surface, { variant: 'solid', hovered: true, pressed: true });
    await update(text, {
      size: '5xl',
      leading: 'tighter',
      tracking: 'tighter',
      decoration: 'underline',
    });
    expect(surface.getAttribute('role')).toBeNull();
    expect(text.getAttribute('tabindex')).toBeNull();
    expect(text.querySelector('button')).toBe(button);
    expect(document.activeElement).toBe(button);
    await update(surface, {});
    await update(text, {});
    await click(button);
    expect(activations).toBe(2);
    expect(text.querySelector('button')).toBe(button);
  });

  it('keeps Separator contentless and changes only its inherited semantic orientation', async () => {
    const separator = part(separatorRoot, { decorative: false });
    separator.textContent = 'Not separator content';
    document.body.append(separator);
    await settle();
    expect(separator.children).toHaveLength(0);
    expect(separator.textContent).toBe('');
    expect(separator.getAttribute('role')).toBe('separator');
    await update(separator, { orientation: 'vertical', decorative: false });
    expect(separator.getExposes().orientation.get()).toBe('vertical');
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(separator.tabIndex).toBe(-1);
  });

  it('preserves controlled Resizable ratios, panel slots and orientation without fake root states', async () => {
    const root = part(resizableRoot, { value: 30 });
    const first = part(resizablePanel, { index: 0 });
    const second = part(resizablePanel, { index: 1 });
    const handle = part(resizableHandle);
    const child = document.createElement('button');
    first.append(child);
    root.append(first, handle, second);
    const proposals: unknown[] = [];
    root.addEventListener('valueChange', (event) =>
      proposals.push((event as CustomEvent<unknown>).detail)
    );
    document.body.append(root);
    await settle();
    root.getExposes().requestValue(45, true);
    await settle();
    expect(proposals).toEqual([{ value: 45 }]);
    expect(root.getExposes().value.get()).toBe(30);
    expect(first.getExposes().size.get()).toBe(30);
    expect(second.getExposes().size.get()).toBe(70);
    await update(root, { value: 45, orientation: 'vertical' });
    expect(first.getExposes().size.get()).toBe(45);
    expect(second.getExposes().size.get()).toBe(55);
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
    expect(first.querySelector('button')).toBe(child);
    await update(root, { value: 45, disabled: true });
    expect(root.getExposes().requestValue(70, true)).toBe(false);
    expect(proposals).toHaveLength(1);
  });

  it('retains message application counts and the inherited one-button jump request', async () => {
    const root = part(messageScrollerRoot, { a11yLabel: 'Conversation', newContentCount: 4 });
    const viewport = part(messageScrollerViewport);
    const jump = part(messageScrollerJump);
    const message = document.createElement('p');
    message.textContent = 'A real authored message';
    metrics(viewport);
    viewport.append(message);
    root.append(viewport, jump);
    document.body.append(root);
    await settle();
    expect(viewport.getAttribute('aria-label')).toBe('Conversation');
    expect(viewport.getExposes().scrollAxes.get()).toBe('vertical');
    expect(jump.getExposes().newContentCount.get()).toBe(4);
    await click(jump);
    expect(viewport.scrollTop).toBe(300);
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event('scroll'));
    await update(jump, { disabled: true });
    await click(jump);
    expect(viewport.scrollTop).toBe(0);
    await update(root, { a11yLabel: 'Updated conversation', newContentCount: -2 });
    expect(jump.getExposes().newContentCount.get()).toBe(0);
    expect(viewport.getAttribute('aria-label')).toBe('Updated conversation');
    expect(viewport.querySelector('p')).toBe(message);
  });

  it('keeps full VirtualList identity while its real collection rejects stale windows', async () => {
    const root = part(virtualListRoot, { itemKeys: ['a', 'b', 'c', 'd'], overscanItems: 0 });
    const viewport = part(virtualListViewport);
    const content = part(virtualListContent);
    const authored = document.createElement('button');
    content.append(authored);
    metrics(viewport);
    viewport.append(content);
    root.append(viewport);
    document.body.append(root);
    await settle();
    const collection = root.getExposes().getCollection();
    const first = collection.propose(0, 2);
    if (!first) throw new Error('The bounded initial window must be admissible.');
    expect(first.keys).toEqual(['a', 'b']);
    expect(collection.commit(first, first.keys)).toBe(true);
    expect(root.getExposes().logicalCount.get()).toBe(4);
    expect(root.getExposes().getWindow().materializedKeys).toEqual(['a', 'b']);
    const stale = collection.propose(1, 3);
    if (!stale) throw new Error('The old bounded window must exist before replacement.');
    await update(root, { itemKeys: ['new-a', 'new-b'], overscanItems: 0 });
    expect(collection.commit(stale, stale.keys)).toBe(false);
    expect(root.getExposes().logicalCount.get()).toBe(2);
    expect(content.getAttribute('role')).toBe('list');
    expect(content.querySelector('button')).toBe(authored);
    root.remove();
    await settle();
    expect(collection.snapshot().materializedKeys).toEqual([]);
  });

  for (const field of [false, true]) {
    it(`keeps scalar Slider pointer ownership, controlled refusal and Thumb withdrawal, field=${field}`, async () => {
      const owner = field ? part(fieldRoot) : null;
      const root = part(sliderRoot, { value: 25, valueText: 'Quarter', min: 0, max: 100 });
      const label = part(sliderLabel);
      const track = part(sliderTrack);
      const indicator = part(sliderIndicator);
      const thumb = part(field ? sliderFieldThumb : sliderThumb);
      const value = part(sliderValue);
      label.textContent = 'Volume';
      track.append(indicator, thumb);
      root.append(label, track, value);
      if (owner) {
        owner.append(root);
        document.body.append(owner);
      } else document.body.append(root);
      const proposals: number[] = [];
      root.addEventListener('valueChange', (event) =>
        proposals.push((event as CustomEvent<{ value: number }>).detail.value)
      );
      await settle();
      track.getBoundingClientRect = () => new DOMRect(10, 0, 200, 20);
      thumb.getBoundingClientRect = () => new DOMRect(50, 0, 20, 20);
      thumb.dispatchEvent(pointer('pointerdown', { clientX: 60, clientY: 10 }));
      track.dispatchEvent(pointer('pointerup', { clientX: 160, clientY: 10 }));
      await settle();
      expect(proposals).toContain(75);
      expect(root.getExposes().value.get()).toBe(25);
      expect(thumb.getExposes().value.get()).toBe(25);
      expect(value.textContent).toBe('Quarter');
      await update(root, {
        value: 75,
        valueText: 'Three quarters',
        min: 0,
        max: 100,
        orientation: 'vertical',
        direction: 'rtl',
      });
      expect(thumb.getExposes().orientation.get()).toBe('vertical');
      expect(thumb.getAttribute('aria-valuenow')).toBe('75');
      expect(value.textContent).toBe('Three quarters');
      thumb.remove();
      await settle();
      const count = proposals.length;
      track.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
      track.dispatchEvent(pointer('pointermove', { clientX: 180 }));
      track.dispatchEvent(pointer('pointerup', { clientX: 180 }));
      await settle();
      expect(proposals).toHaveLength(count);
      expect(root.getExposes().value.get()).toBe(75);
      expect(root.getExposes().dragging.get()).toBe(false);
    });
  }
});
