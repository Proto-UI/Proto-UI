import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleScope } from '../src/style-scope';
import {
  commandRoot,
  commandInput,
  commandInputWrapper,
  commandContent,
  commandItem,
  commandEmpty,
} from '../src/command';
import { inputShell, inputShellControl, bindInputShellControl } from '../src/input-shell';
for (const p of [
  styleScope,
  commandRoot,
  commandInput,
  commandInputWrapper,
  commandContent,
  commandItem,
  commandEmpty,
  inputShell,
  inputShellControl,
])
  AdaptToWebComponent(p as any);
const el = (name: string, props: any = {}) => {
  const e = document.createElement(name);
  setElementProps(e, props);
  return e;
};
const flush = () => new Promise((r) => setTimeout(r, 0));
const tokens = (e: Element) => (e.getAttribute('data-pui-style') ?? '').split(/\s+/);
afterEach(() => document.body.replaceChildren());
function fixture(kind: 'command' | 'input') {
  const scope = el(styleScope.name, { styleProfile: 'rhea' }),
    root = el(commandRoot.name),
    shell = el(inputShell.name, { focusIndicator: kind === 'command' ? 'none' : 'ring' }),
    control = el(kind === 'command' ? commandInput.name : inputShellControl.name, {
      a11yLabel: 'Search text',
    });
  shell.append(control);
  if (kind === 'command') {
    const wrapper = el(commandInputWrapper.name);
    wrapper.append(shell);
    root.append(wrapper);
    const content = el(commandContent.name);
    for (const value of ['Alpha', 'Beta']) {
      const item = el(commandItem.name, { value, textValue: value });
      item.textContent = value;
      content.append(item);
    }
    const empty = el(commandEmpty.name);
    empty.textContent = 'No results';
    content.append(empty);
    root.append(content);
    scope.append(root);
  } else scope.append(shell);
  document.body.append(scope);
  return { scope, root, shell, control };
}
describe('actual shared shell consumers', () => {
  it.each(['command', 'input'] as const)(
    '%s reads real public control facts and preserves editor identity across scope',
    async (kind) => {
      const f = fixture(kind);
      await flush();
      const editor = f.control.querySelector('input')!;
      expect(editor).not.toBeNull();
      expect(tokens(f.shell)).toContain('rounded-[var(--pui-radius-2xl)]');
      expect(tokens(editor)).toContain('border-0');
      expect(tokens(editor)).not.toContain('border-input');
      let current = true;
      let cleanup = () => {};
      const binding = bindInputShellControl(
        {
          isCurrent: () => current,
          onDispose: (fn) => {
            cleanup = fn;
            return () => {
              cleanup = () => {};
            };
          },
        },
        {
          instance: f.shell,
          setFacts: (facts) =>
            setElementProps(f.shell, {
              focusIndicator: kind === 'command' ? 'none' : 'ring',
              ...facts,
            }),
        },
        f.control as any
      );
      editor.value = 'Al';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'Al' }));
      await flush();
      editor.focus();
      editor.setSelectionRange(0, 1);
      await flush();
      setElementProps(f.scope, { styleProfile: 'new-york-v4' });
      await flush();
      expect(f.control.querySelector('input')).toBe(editor);
      expect(editor.value).toBe('Al');
      expect(editor.selectionStart).toBe(0);
      expect(editor.selectionEnd).toBe(1);
      // New York Command's wrapper is headless; ordinary InputGroup keeps
      // its own rounded border. Source: 3d98900e new-york-v4/ui/command.tsx.
      expect(tokens(f.shell)).toContain(kind === 'command' ? 'rounded-none' : 'rounded-md');
      expect(tokens(editor)).toContain('border-0');
      expect(tokens(editor)).not.toContain('border-input');
      setElementProps(f.scope, { styleProfile: 'rhea' });
      await flush();
      expect(tokens(f.shell)).toContain('bg-input/50');
      expect(tokens(f.shell)).not.toContain('shadow-xs');
      const handle = (f.control as any).getExposes();
      expect(typeof handle.focusVisible.get()).toBe('boolean');
      current = false;
      cleanup();
      binding.dispose();
      f.scope.remove();
    }
  );
  it('keeps New York standalone Input compatibility without requiring a shell', async () => {
    const root = el(commandRoot.name),
      input = el(commandInput.name);
    root.append(input);
    document.body.append(root);
    await flush();
    const editor = input.querySelector('input')!;
    expect(tokens(editor)).toContain('rounded-md');
    expect(tokens(editor)).toContain('border-0');
    expect(tokens(editor)).not.toContain('border-input');
    expect(tokens(editor)).toContain('w-full');
  });
  it('Rhea active paint withdraws black compatibility paint without changing search state', async () => {
    const f = fixture('command');
    await flush();
    const editor = f.control.querySelector('input')!;
    editor.focus();
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    const active = document.getElementById(editor.getAttribute('aria-activedescendant') ?? '')!;
    expect(active).not.toBeNull();
    expect(tokens(active)).toContain('bg-muted');
    expect(tokens(active)).not.toContain('bg-primary');
    setElementProps(f.scope, { styleProfile: 'new-york-v4' });
    await flush();
    expect(tokens(active)).toContain('bg-accent');
    expect(tokens(active)).not.toContain('bg-primary');
    expect(tokens(active)).not.toContain('bg-muted');
    setElementProps(f.scope, { styleProfile: 'rhea' });
    await flush();
    expect(tokens(active)).toContain('bg-muted');
    expect(tokens(active)).not.toContain('font-semibold');
  });
});

it('rejects an unknown style without a compatibility fallback', async () => {
  const f = fixture('command');
  await flush();
  expect(() => setElementProps(f.control, { styleProfile: 'unknown' })).toThrow(
    /Unknown|Unsupported/
  );
});
it('honors explicit family scope, the New York alias and inherit withdrawal', async () => {
  const f = fixture('command');
  await flush();
  const root = f.scope.querySelector<HTMLElement>(commandRoot.name)!;
  const editor = f.control.querySelector('input')!;
  setElementProps(root, { styleProfile: 'new-york' });
  await flush();
  expect(tokens(f.shell)).toContain('rounded-none');
  expect(tokens(f.shell)).not.toContain('rounded-[var(--pui-radius-2xl)]');
  setElementProps(root, { styleProfile: 'inherit' });
  await flush();
  expect(tokens(f.shell)).toContain('rounded-[var(--pui-radius-2xl)]');
  expect(f.control.querySelector('input')).toBe(editor);
});
