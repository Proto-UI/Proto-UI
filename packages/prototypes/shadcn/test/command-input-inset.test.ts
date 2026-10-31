import { afterEach, describe, expect, it } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import type { Prototype } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { styleScope } from '../src/style-scope';
import { commandRoot, commandInput, commandInputWrapper } from '../src/command';
import { inputShell } from '../src/input-shell';

for (const prototype of [styleScope, commandRoot, commandInput, commandInputWrapper, inputShell]) {
  // Registration does not consume the heterogeneous public Exposes. The
  // factory below retains each exact Prototype instead of an untyped instance.
  const registration = prototype as unknown as Prototype<PropsBaseType, unknown>;
  if (!customElements.get(prototype.name)) AdaptToWebComponent(registration);
}
const make = <P extends PropsBaseType, E>(prototype: Prototype<P, E>, props: Partial<P> = {}) => {
  const node = document.createElement(prototype.name) as WebComponentAdapterElement<
    Prototype<P, E>
  >;
  setElementProps(node, props);
  return node;
};
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const tokens = (node: Element) =>
  (node.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
const insets = (node: Element) => tokens(node).filter((token) => /^px-/.test(token));
const owned: HTMLElement[] = [];
afterEach(async () => {
  for (const node of owned.splice(0)) node.remove();
  await flush();
});

// Independent bounded fallback oracle: MIT shadcn-ui/ui@24a1642 .cn-input.
// NY's wrapper and Sera's existing Command recipe are deliberately unchanged.
// WC native-text-layout applies every final paint token to the real editor;
// only canonical w-full placement is repeated on the transparent host. Assert
// both surfaces so a host-only padding change or doubled inset cannot pass.
// This is token/identity evidence, not a native or full addon conformance test.
const profiles = [
  { id: 'vega', inset: 'px-2.5' },
  { id: 'nova', inset: 'px-2.5' },
  { id: 'maia', inset: 'px-3' },
  { id: 'lyra', inset: 'px-2.5' },
  { id: 'mira', inset: 'px-2' },
  { id: 'luma', inset: 'px-3' },
  { id: 'rhea', inset: 'px-2.5' },
  { id: 'sera', inset: 'px-2' },
  { id: 'new-york-v4', inset: null },
] as const;
type Profile = (typeof profiles)[number]['id'];

async function fixture(profile: Profile, grouped = true) {
  const scope = make(styleScope, { styleProfile: profile });
  const root = make(commandRoot);
  const wrapper = make(commandInputWrapper);
  const shell = make(inputShell, { focusIndicator: 'none' });
  const control = make(commandInput, { a11yLabel: 'Search text' });
  if (grouped) {
    shell.append(control);
    wrapper.append(shell);
    root.append(wrapper);
  } else root.append(control);
  scope.append(root);
  owned.push(scope);
  document.body.append(scope);
  await flush();
  const editor = control.querySelector('input');
  if (!editor) throw new Error('The real Command editor must mount');
  return { scope, root, wrapper, shell, control, editor };
}

describe('bounded no-addon Command editor inset', () => {
  for (const profile of profiles) {
    it(`${profile.id} grouped editor owns its inset without a second editor or shell role`, async () => {
      const { scope, wrapper, shell, control, editor } = await fixture(profile.id);
      expect(insets(editor)).toEqual(profile.inset ? [profile.inset] : []);
      expect(insets(control)).toEqual([]);
      expect(scope.querySelectorAll('input')).toHaveLength(1);
      expect(editor.getAttribute('role')).toBe('combobox');
      expect(shell.getAttribute('role')).toBeNull();
      expect(shell.hasAttribute('tabindex')).toBe(false);
      if (profile.id === 'new-york-v4') expect(insets(wrapper)).toEqual(['px-3']);
      if (profile.id === 'sera') expect(insets(shell)).toEqual(['px-3']);
    });
    it(`${profile.id} standalone editor preserves the existing non-shell recipe`, async () => {
      const { control, scope, editor } = await fixture(profile.id, false);
      expect(insets(editor)).toEqual(profile.id === 'sera' ? ['px-2'] : []);
      expect(insets(control)).toEqual([]);
      expect(scope.querySelectorAll('input')).toHaveLength(1);
      expect(scope.querySelector(inputShell.name)).toBeNull();
    });
  }
  it('profile changes retain the real editor, composing value, selection and focus', async () => {
    const { scope, root, control, editor } = await fixture('rhea');
    const composing = control.getExposes().composing;
    const query = root.getExposes().inputValue;
    editor.focus();
    editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    editor.value = 'preserved query';
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: editor.value, isComposing: true })
    );
    editor.setSelectionRange(2, 7);
    await flush();
    for (const profile of [...profiles, profiles[6]]) {
      setElementProps(scope, { styleProfile: profile.id });
      await flush();
      expect(control.querySelector('input')).toBe(editor);
      expect(control.getExposes().composing).toBe(composing);
      expect(root.getExposes().inputValue).toBe(query);
      expect(composing.get()).toBe(true);
      // Base requestQuery does not publish a composing candidate as committed query.
      expect(query.get()).toBe('');
      expect(editor.value).toBe('preserved query');
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 7]);
      expect(document.activeElement).toBe(editor);
      expect(insets(editor)).toEqual(profile.inset ? [profile.inset] : []);
      expect(insets(control)).toEqual([]);
    }
    editor.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, data: editor.value })
    );
    await flush();
    expect(composing.get()).toBe(false);
    expect(query.get()).toBe('preserved query');
    expect(control.querySelector('input')).toBe(editor);
  });
});
