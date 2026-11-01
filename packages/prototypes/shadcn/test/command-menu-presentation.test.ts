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

describe('explicit Command menu presentation, not the default registry recipe', () => {
  for (const profile of profiles) {
    it(`${profile.id}: menu wrapper owns decoration inset while the same editor retains IME and selection`, async () => {
      const { scope, root, wrapper, shell, control, editor } = await fixture(profile.id);
      editor.focus();
      editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      editor.value = 'current composition';
      editor.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: editor.value, isComposing: true })
      );
      editor.setSelectionRange(2, 5);
      const composing = control.getExposes().composing;
      for (const presentation of ['menu', 'default', 'menu'] as const) {
        setElementProps(root, { presentation });
        setElementProps(wrapper, { presentation });
        setElementProps(control, { presentation });
        await flush();
        expect(control.querySelector('input')).toBe(editor);
        expect(scope.querySelectorAll('input')).toHaveLength(1);
        expect(editor.value).toBe('current composition');
        expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 5]);
        expect(document.activeElement).toBe(editor);
        expect(composing.get()).toBe(true);
        expect(root.getExposes().inputValue.get()).toBe('');
        expect(shell.getAttribute('role')).toBeNull();
        expect(shell.hasAttribute('tabindex')).toBe(false);
        if (presentation === 'menu') {
          expect(insets(editor)).toEqual(['px-0']);
          expect(insets(wrapper)).toEqual(['px-3']);
          expect(tokens(editor)).toContain('h-9');
          expect(tokens(shell)).toContain('bg-transparent');
          expect(tokens(shell)).not.toContain('bg-input/50');
          expect(tokens(wrapper)).toContain('rounded-md');
          expect(tokens(wrapper)).toContain('border-input');
          expect(tokens(root)).not.toContain('p-1');
          // Update only the live wrapper, not initial construction or child props.
          // Its private presentation must publish to the retained passive shell.
          setElementProps(wrapper, { presentation: 'default' });
          await flush();
          expect(tokens(shell)).not.toContain('flex-1');
          setElementProps(wrapper, { presentation: 'menu' });
          await flush();
          expect(tokens(shell)).toContain('flex-1');
          expect(tokens(shell)).toContain('bg-transparent');
          expect(control.querySelector('input')).toBe(editor);
        } else {
          expect(insets(editor)).toEqual(profile.inset ? [profile.inset] : []);
        }
      }
      editor.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, data: editor.value })
      );
      await flush();
      expect(root.getExposes().inputValue.get()).toBe('current composition');
    });
  }
});
