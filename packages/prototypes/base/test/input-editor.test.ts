import { afterEach, describe, expect, it } from 'vitest';
import { createControlLabelRef, definePrototype, type AsHookResult } from '@proto.ui/core';
import {
  AdaptToWebComponent,
  setElementAssociations,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import inputRoot, {
  asInputEditor,
  type InputRootAsHookContract,
  type InputRootExposes,
  type InputRootProps,
} from '../src/input';
import labelRoot from '../src/label';

let captured: AsHookResult<InputRootProps, InputRootAsHookContract> | undefined;
const editor = definePrototype<InputRootProps, InputRootExposes>({
  name: 'standalone-input-editor-consumer',
  modules: asInputEditor.modules,
  setup() {
    captured = asInputEditor();
    return captured.render;
  },
});
AdaptToWebComponent(editor);
AdaptToWebComponent(inputRoot);
AdaptToWebComponent(labelRoot);
type Editor = WebComponentAdapterElement<typeof editor>;
const flush = async () => {
  for (let turn = 0; turn < 6; turn++) await Promise.resolve();
};
function physical(element: HTMLElement): HTMLInputElement {
  const target = element.querySelector('input');
  if (!(target instanceof HTMLInputElement)) throw new Error('Missing native text editor');
  return target;
}
async function mount(props: InputRootProps): Promise<Editor> {
  const element = document.createElement(editor.name) as Editor;
  setElementProps(element, props);
  document.body.append(element);
  await flush();
  return element;
}
function click(element: HTMLElement) {
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
afterEach(async () => {
  document.body.replaceChildren();
  captured = undefined;
  await flush();
});

describe('standalone asInputEditor consumer', () => {
  it('publishes editing handles and keeps value, direct naming and physical focus on one editor', async () => {
    const element = await mount({ defaultValue: 'seed', ariaLabel: 'Direct query' });
    const target = physical(element);
    const api = element.getExposes();
    expect(element.querySelectorAll('input')).toHaveLength(1);
    expect(target.children).toHaveLength(0);
    expect(target.getAttribute('role')).toBe('textbox');
    expect(target.getAttribute('aria-label')).toBe('Direct query');
    expect(captured?.stateHandles?.value.get()).toBe('seed');
    expect(captured?.stateHandles?.composing.get()).toBe(false);
    expect(api.resetValue).toBeTypeOf('function');
    expect(api.focusSelf).toBeTypeOf('function');
    target.value = 'edited😀';
    target.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: '😀' }));
    expect(api.value.get()).toBe('edited😀');
    expect(captured?.stateHandles?.value.get()).toBe('edited😀');
    api.focusSelf();
    expect(document.activeElement).toBe(target);
    expect(api.focused.get()).toBe(true);
    api.blurSelf();
    expect(document.activeElement).not.toBe(target);
    setElementProps(element, { disabled: true });
    await flush();
    api.focusSelf();
    expect(document.activeElement).not.toBe(target);
    expect(api.disabled.get()).toBe(true);
  });

  it('resets the standalone editing lease and preserves controlled owner authority', async () => {
    const element = await mount({ defaultValue: 'seed' });
    const target = physical(element);
    const api = element.getExposes();
    const events: string[] = [];
    for (const event of ['valueChange', 'change', 'compositionStart', 'compositionEnd'])
      element.addEventListener(event, () => events.push(event));
    target.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '候' }));
    target.value = '候';
    target.dispatchEvent(
      new InputEvent('input', { inputType: 'insertCompositionText', isComposing: true })
    );
    expect(api.composing.get()).toBe(true);
    const count = events.length;
    expect(api.resetValue('fresh\r\n😀')).toBe(true);
    expect(target.value).toBe('fresh😀');
    expect(api.value.get()).toBe('fresh😀');
    expect(api.composing.get()).toBe(false);
    expect(events).toHaveLength(count);
    expect(api.resetValue()).toBe(true);
    expect(api.value.get()).toBe('seed');

    const controlled = await mount({ value: 'owner' });
    const ownedTarget = physical(controlled);
    ownedTarget.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    ownedTarget.value = 'candidate';
    expect(controlled.getExposes().resetValue('ignored')).toBe(false);
    expect(ownedTarget.value).toBe('owner');
    expect(controlled.getExposes().value.get()).toBe('owner');
    expect(controlled.getExposes().composing.get()).toBe(false);
  });

  it('leaves independent Label association to asInputRoot', async () => {
    const standalone = await mount({ ariaLabel: 'Direct name' });
    const paired = document.createElement(inputRoot.name);
    const source = document.createElement(labelRoot.name);
    const unpairedSource = document.createElement(labelRoot.name);
    source.textContent = 'Paired name';
    unpairedSource.textContent = 'No target protocol';
    const pairedRef = createControlLabelRef();
    const standaloneRef = createControlLabelRef();
    setElementAssociations(paired, { controlLabel: pairedRef });
    setElementAssociations(source, { controlLabel: pairedRef });
    expect(() => setElementAssociations(standalone, { controlLabel: standaloneRef })).toThrow(
      'this Prototype has not declared Label or target participation'
    );
    setElementAssociations(standalone, { controlLabel: null });
    setElementAssociations(unpairedSource, { controlLabel: standaloneRef });
    document.body.append(paired, source, unpairedSource);
    await flush();
    const pairedInput = physical(paired);
    expect(pairedInput.getAttribute('aria-labelledby')).toBe(source.id);
    expect(source.id).not.toBe('');
    click(source);
    expect(document.activeElement).toBe(pairedInput);
    click(unpairedSource);
    expect(document.activeElement).not.toBe(physical(standalone));
    expect(physical(standalone).hasAttribute('aria-labelledby')).toBe(false);
    expect(physical(standalone).getAttribute('aria-label')).toBe('Direct name');
  });
});
