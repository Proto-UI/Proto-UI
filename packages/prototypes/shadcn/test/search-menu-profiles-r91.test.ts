import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import type { Prototype } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import '../../../modules/native-link/test/no-network';
import { styleScope } from '../src/style-scope';
import * as autocomplete from '../src/autocomplete';
import * as combobox from '../src/combobox';
import * as command from '../src/command';
import * as contextMenu from '../src/context-menu';
import * as menubar from '../src/menubar';
import * as navigation from '../src/navigation-menu';
import * as dropdown from '../src/dropdown';
import { inputShell, inputShellControl, bindInputShellControl } from '../src/input-shell';

for (const prototype of [
  styleScope,
  inputShell,
  inputShellControl,
  autocomplete.autocompleteRoot,
  autocomplete.autocompleteInput,
  autocomplete.autocompleteTrigger,
  autocomplete.autocompleteContent,
  autocomplete.autocompleteItem,
  autocomplete.autocompleteEmpty,
  combobox.comboboxRoot,
  combobox.comboboxInput,
  combobox.comboboxTrigger,
  combobox.comboboxContent,
  combobox.comboboxItem,
  combobox.comboboxEmpty,
  command.commandRoot,
  command.commandInput,
  command.commandInputWrapper,
  command.commandContent,
  command.commandItem,
  command.commandEmpty,
  contextMenu.contextMenuRoot,
  contextMenu.contextMenuTrigger,
  contextMenu.contextMenuContent,
  contextMenu.contextMenuItem,
  menubar.menubarRoot,
  menubar.menubarTrigger,
  menubar.menubarContent,
  menubar.menubarItem,
  navigation.navigationMenuRoot,
  navigation.navigationMenuTrigger,
  navigation.navigationMenuContent,
  navigation.navigationMenuItem,
  navigation.navigationMenuLink,
  dropdown.dropdownRoot,
  dropdown.dropdownTrigger,
  dropdown.dropdownContent,
  dropdown.dropdownItem,
  dropdown.dropdownGroup,
  dropdown.dropdownLabel,
  dropdown.dropdownSeparator,
  dropdown.dropdownShortcut,
]) {
  // Heterogeneous public Exposes differ; constructor registration itself does
  // not consume them. The generic factory below retains each exact Exposes.
  const registration = prototype as unknown as Prototype<PropsBaseType, unknown>;
  if (!customElements.get(prototype.name)) AdaptToWebComponent(registration);
}

const owned: HTMLElement[] = [];
beforeEach(() => vi.useFakeTimers());
const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
};
const make = <P extends PropsBaseType, E>(prototype: Prototype<P, E>, props: Partial<P> = {}) => {
  // This exact Prototype registered the custom-element constructor above.
  const node = document.createElement(prototype.name) as WebComponentAdapterElement<
    Prototype<P, E>
  >;
  setElementProps(node, props);
  return node;
};
const mount = (node: HTMLElement) => {
  owned.push(node);
  document.body.append(node);
};
const tokens = (node: Element) =>
  (node.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
const key = (node: Element, value: string) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
function recordDetails(node: HTMLElement, eventName: string) {
  const details: unknown[] = [];
  node.addEventListener(eventName, (event) => {
    if (!(event instanceof CustomEvent))
      throw new Error(`Expected public ${eventName} CustomEvent`);
    details.push(event.detail);
  });
  return details;
}
afterEach(async () => {
  for (const node of owned.splice(0)) node.remove();
  try {
    await flush();
  } finally {
    vi.useRealTimers();
  }
});

// Independent consumer oracle: 3d98900 style-*.css .cn-command-item,
// .cn-input-group, .cn-command-input-group, .cn-dropdown-menu-item/label;
// New York is its own source, not an alias for Nova. These are state/paint
// transport assertions, not native layout, motion or accessibility acceptance.
const profiles = [
  {
    id: 'vega',
    item: 'rounded-sm',
    shell: 'h-9',
    commandShell: 'h-8',
    inset: 'pl-8',
    label: 'text-xs',
    ring: 'ring-3',
  },
  {
    id: 'nova',
    item: 'rounded-md',
    shell: 'h-8',
    commandShell: 'h-8',
    inset: 'pl-7',
    label: 'text-xs',
    ring: 'ring-3',
  },
  {
    id: 'maia',
    item: 'rounded-[var(--pui-radius-xl)]',
    shell: 'h-9',
    commandShell: 'h-9',
    inset: 'pl-9.5',
    label: 'text-xs',
    ring: 'ring-3',
  },
  {
    id: 'lyra',
    item: 'rounded-none',
    shell: 'h-8',
    commandShell: 'h-8',
    inset: 'pl-7',
    label: 'text-xs',
    ring: 'ring-1',
  },
  {
    id: 'mira',
    item: 'rounded-md',
    shell: 'h-7',
    commandShell: 'h-8',
    inset: 'pl-7.5',
    label: 'text-xs',
    ring: 'ring-2',
  },
  {
    id: 'luma',
    item: 'rounded-[var(--pui-radius-2xl)]',
    shell: 'h-9',
    commandShell: 'h-9',
    inset: 'pl-9.5',
    label: 'text-xs',
    ring: 'ring-3',
  },
  {
    id: 'sera',
    item: 'rounded-none',
    shell: 'h-10',
    commandShell: 'h-10',
    inset: 'pl-9.5',
    label: 'text-xs',
    ring: '',
  },
  {
    id: 'rhea',
    item: 'rounded-[var(--pui-radius-xl)]',
    shell: 'h-8',
    commandShell: 'h-8',
    inset: 'pl-7',
    label: 'text-xs',
    ring: 'ring-3',
  },
  {
    id: 'new-york-v4',
    item: 'rounded-sm',
    shell: 'h-9',
    commandShell: 'h-auto',
    inset: 'pl-8',
    label: 'text-sm',
    ring: 'ring-3',
  },
] as const;

describe('source-bound search and menu profiles', () => {
  it('keeps the real Command editor, IME candidate, active descendant and one execution through all nine profiles', async () => {
    const scope = make(styleScope, { styleProfile: 'rhea' });
    const root = make(command.commandRoot);
    const wrapper = make(command.commandInputWrapper);
    const shell = make(inputShell, { focusIndicator: 'none' });
    const control = make(command.commandInput, { a11yLabel: 'Run a command' });
    const content = make(command.commandContent);
    const alpha = make(command.commandItem, { value: 'alpha', textValue: 'Alpha' });
    const beta = make(command.commandItem, { value: 'beta', textValue: 'Beta' });
    const blocked = make(command.commandItem, {
      value: 'blocked',
      textValue: 'Blocked',
      disabled: true,
    });
    const empty = make(command.commandEmpty);
    const label = document.createTextNode('Alpha');
    alpha.append(label);
    beta.textContent = 'Beta';
    blocked.textContent = 'Blocked';
    empty.textContent = 'No commands';
    content.append(alpha, beta, blocked, empty);
    shell.append(control);
    wrapper.append(shell);
    root.append(wrapper, content);
    scope.append(root);
    const executions = recordDetails(root, 'execute');
    mount(scope);
    await flush();
    const editor = control.querySelector('input')!;
    expect(editor).not.toBeNull();
    const inputHandle = root.getExposes().inputValue;
    const activeHandle = alpha.getExposes().active;
    const composing = control.getExposes().composing;
    editor.focus();
    editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    editor.value = 'Be';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'Be', isComposing: true }));
    editor.setSelectionRange(0, 1);
    await flush();
    const activeId = editor.getAttribute('aria-activedescendant');
    expect(activeId).toBe(alpha.id);
    for (const profile of profiles) {
      setElementProps(scope, { styleProfile: profile.id });
      await flush();
      expect(control.querySelector('input')).toBe(editor);
      expect(root.getExposes().inputValue).toBe(inputHandle);
      expect(alpha.getExposes().active).toBe(activeHandle);
      expect(control.getExposes().composing).toBe(composing);
      expect(composing.get()).toBe(true);
      expect(inputHandle.get()).toBe('');
      expect(editor.value).toBe('Be');
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 1]);
      expect(document.activeElement).toBe(editor);
      expect(editor.getAttribute('aria-activedescendant')).toBe(activeId);
      expect(tokens(shell).filter((token) => /^h-/.test(token))).toEqual([profile.commandShell]);
      expect(tokens(alpha)).toContain(profile.id === 'new-york-v4' ? 'bg-accent' : 'bg-muted');
      expect(tokens(alpha)).not.toContain('bg-primary');
      expect(alpha.firstChild).toBe(label);
      key(editor, 'Enter');
      await flush();
      expect(executions).toEqual([]);
    }
    editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'Be' }));
    await flush();
    expect(inputHandle.get()).toBe('Be');
    expect(beta.getExposes().active.get()).toBe(true);
    key(editor, 'Enter');
    await flush();
    expect(executions).toEqual([{ value: 'beta', textValue: 'Beta', reason: 'keyboard' }]);
    setElementProps(root, { disabled: true });
    setElementProps(scope, { styleProfile: 'lyra' });
    await flush();
    expect(editor.disabled).toBe(true);
    expect(control.getExposes().disabled.get()).toBe(true);
    expect(root.getExposes().select('blocked')).toBe(false);
    key(editor, 'Enter');
    expect(executions).toHaveLength(1);
  });

  it('projects real ordinary Input facts without giving the shell a second editor, role or disabled opacity', async () => {
    const scope = make(styleScope, { styleProfile: 'new-york-v4' });
    const shell = make(inputShell);
    const control = make(inputShellControl, {
      defaultValue: 'Retained editor',
      a11yLabel: 'Search text',
    });
    shell.append(control);
    scope.append(shell);
    mount(scope);
    await flush();
    let current = true;
    let retire = () => {};
    const binding = bindInputShellControl(
      {
        isCurrent: () => current,
        onDispose(callback) {
          retire = callback;
          return () => {
            retire = () => {};
          };
        },
      },
      {
        instance: shell,
        setFacts: (facts) => setElementProps(shell, { focusIndicator: 'ring', ...facts }),
      },
      control
    );
    try {
      const editor = control.querySelector('input')!;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      editor.focus();
      editor.setSelectionRange(1, 5);
      await flush();
      expect(control.getExposes().focusVisible.get()).toBe(true);
      for (const profile of profiles) {
        setElementProps(scope, { styleProfile: profile.id });
        await flush();
        expect(control.querySelector('input')).toBe(editor);
        expect(shell.querySelectorAll('input')).toHaveLength(1);
        expect(editor.value).toBe('Retained editor');
        expect([editor.selectionStart, editor.selectionEnd]).toEqual([1, 5]);
        expect(document.activeElement).toBe(editor);
        expect(tokens(shell).filter((token) => /^h-/.test(token))).toEqual([profile.shell]);
        expect(tokens(shell).filter((token) => /^ring-[123]$/.test(token))).toEqual(
          profile.ring ? [profile.ring] : []
        );
        expect(tokens(shell).includes('border-b-ring')).toBe(profile.id === 'sera');
        expect(shell.hasAttribute('role')).toBe(false);
        expect(shell.hasAttribute('tabindex')).toBe(false);
      }
      setElementProps(control, {
        defaultValue: 'Retained editor',
        a11yLabel: 'Search text',
        disabled: true,
      });
      await flush();
      expect(editor.disabled).toBe(true);
      expect(editor.hasAttribute('data-disabled')).toBe(true);
      expect(renderProtoStyleTokenCss(tokens(editor))).toContain('opacity: 0.5;');
      expect(tokens(shell)).not.toContain('opacity-50');
    } finally {
      current = false;
      retire();
      binding.dispose();
    }
  });

  for (const [name, family] of [
    [
      'autocomplete',
      {
        root: autocomplete.autocompleteRoot,
        input: autocomplete.autocompleteInput,
        trigger: autocomplete.autocompleteTrigger,
        content: autocomplete.autocompleteContent,
        item: autocomplete.autocompleteItem,
        empty: autocomplete.autocompleteEmpty,
      },
    ],
    [
      'combobox',
      {
        root: combobox.comboboxRoot,
        input: combobox.comboboxInput,
        trigger: combobox.comboboxTrigger,
        content: combobox.comboboxContent,
        item: combobox.comboboxItem,
        empty: combobox.comboboxEmpty,
      },
    ],
  ] as const) {
    it(`${name} preserves controlled refusal, query/open owners, active paint and explicit profile withdrawal`, async () => {
      const scope = make(styleScope, { styleProfile: 'rhea' });
      const rootProps = { value: 'alpha', inputValue: '', open: true, filter: false };
      const root = make(family.root, rootProps);
      const input = make(family.input, { a11yLabel: name });
      const trigger = make(family.trigger);
      trigger.textContent = 'Open';
      const content = make(family.content);
      const alpha = make(family.item, { value: 'alpha', textValue: 'Alpha' });
      const beta = make(family.item, { value: 'beta', textValue: 'Beta' });
      const empty = make(family.empty);
      alpha.textContent = 'Alpha';
      beta.textContent = 'Beta';
      empty.textContent = 'No matches';
      content.append(alpha, beta, empty);
      root.append(input, trigger, content);
      scope.append(root);
      const values = recordDetails(root, 'valueChange');
      const queries = recordDetails(root, 'inputValueChange');
      const opens = recordDetails(root, 'openChange');
      mount(scope);
      await flush();
      const editor = input.querySelector('input')!;
      const before = root.getExposes();
      before.setInputValue('Be');
      expect(before.inputValue.get()).toBe('');
      expect(queries).toEqual([{ value: 'Be', composing: false }]);
      expect(before.select('beta')).toBe(true);
      await flush();
      const proposedValue = name === 'autocomplete' ? 'Beta' : 'beta';
      expect(values).toEqual([{ value: proposedValue, textValue: 'Beta', reason: 'programmatic' }]);
      expect(opens).toEqual([{ open: false, reason: 'select' }]);
      expect(before.value.get()).toBe('alpha');
      expect(before.open.get()).toBe(true);
      before.__navigate('last');
      await flush();
      for (const profile of profiles) {
        setElementProps(scope, { styleProfile: profile.id });
        await flush();
        expect(root.getExposes().value).toBe(before.value);
        expect(root.getExposes().inputValue).toBe(before.inputValue);
        expect(root.getExposes().open).toBe(before.open);
        expect(before.value.get()).toBe('alpha');
        expect(before.inputValue.get()).toBe('');
        expect(before.open.get()).toBe(true);
        expect(input.querySelector('input')).toBe(editor);
        expect(tokens(beta)).toContain(profile.item);
        expect(beta.getExposes().active.get()).toBe(true);
        expect(beta.hasAttribute('data-active')).toBe(true);
        expect(renderProtoStyleTokenCss(tokens(beta))).toContain(
          'background-color: var(--pui-accent);'
        );
        expect(beta.getExposes().selected.get()).toBe(false);
        expect(values).toHaveLength(1);
      }
      setElementProps(beta, { value: 'beta', textValue: 'Beta', styleProfile: 'maia' });
      setElementProps(scope, { styleProfile: 'lyra' });
      await flush();
      expect(tokens(beta)).toContain('rounded-[var(--pui-radius-xl)]');
      setElementProps(beta, { value: 'beta', textValue: 'Beta', styleProfile: 'inherit' });
      await flush();
      expect(tokens(beta)).toContain('rounded-none');
      expect(tokens(beta)).not.toContain('rounded-[var(--pui-radius-xl)]');
      setElementProps(root, {
        ...rootProps,
        value: proposedValue,
        inputValue: 'Beta',
        open: false,
      });
      await flush();
      expect(before.value.get()).toBe(proposedValue);
      expect(beta.getExposes().selected.get()).toBe(true);
      expect(before.open.get()).toBe(false);
      expect(editor.value).toBe('Beta');
      setElementProps(root, { ...rootProps, readOnly: true });
      await flush();
      expect(editor.readOnly).toBe(true);
      expect(trigger.getExposes().disabled.get()).toBe(true);
      expect(before.select('beta')).toBe(false);
    });

    it(`${name} retains its distinct free-text commit policy under the same source-derived paint`, async () => {
      const root = make(family.root, {
        defaultOpen: true,
        defaultInputValue: 'Unlisted text',
        styleProfile: 'mira',
      });
      const input = make(family.input);
      const content = make(family.content);
      const item = make(family.item, { value: 'alpha', textValue: 'Alpha' });
      const empty = make(family.empty);
      item.textContent = 'Alpha';
      empty.textContent = 'No matches';
      content.append(item, empty);
      root.append(input, content);
      mount(root);
      await flush();
      const editor = input.querySelector('input')!;
      expect(empty.getExposes().visible.get()).toBe(true);
      expect(item.getExposes().visible.get()).toBe(false);
      editor.focus();
      key(editor, 'Enter');
      await flush();
      expect(root.getExposes().value.get()).toBe(name === 'autocomplete' ? 'Unlisted text' : '');
      expect(root.getExposes().open.get()).toBe(name !== 'autocomplete');
    });
  }

  it('keeps Dropdown structural naming and controlled open refusal while profile, inset and shortcut paint withdraw', async () => {
    const scope = make(styleScope);
    const root = make(dropdown.dropdownRoot, { open: true });
    const trigger = make(dropdown.dropdownTrigger);
    trigger.textContent = 'Actions';
    const content = make(dropdown.dropdownContent, { enterDuration: 0, leaveDuration: 0 });
    const group = make(dropdown.dropdownGroup, { a11yLabel: 'Fallback actions' });
    const label = make(dropdown.dropdownLabel, { inset: true });
    const item = make(dropdown.dropdownItem, { value: 'paste', textValue: 'Paste', inset: true });
    const shortcut = make(dropdown.dropdownShortcut);
    const separator = make(dropdown.dropdownSeparator);
    const text = document.createTextNode('Paste');
    label.textContent = 'Editing';
    shortcut.textContent = 'Ctrl+V';
    item.append(text, shortcut);
    group.append(label, item);
    content.append(group, separator);
    root.append(trigger, content);
    scope.append(root);
    const requests = recordDetails(root, 'openChange');
    mount(scope);
    await flush();
    expect(tokens(content)).toContain('rounded-lg'); // adopted Content Nova default
    expect(tokens(item)).toContain('rounded-sm'); // independent Item New York default
    item.focus();
    await flush();
    const open = root.getExposes().open;
    const focused = item.getExposes().focused;
    const labelId = label.id;
    for (const profile of profiles) {
      setElementProps(scope, { styleProfile: profile.id });
      await flush();
      expect(tokens(item)).toContain(profile.item);
      expect(tokens(item).filter((token) => /^pl-/.test(token))).toEqual([profile.inset]);
      expect(tokens(label)).toContain(profile.label);
      expect(tokens(shortcut)).toContain(profile.id === 'mira' ? 'text-[0.625rem]' : 'text-xs');
      expect(tokens(separator).includes('my-1.5')).toBe(
        profile.id === 'luma' || profile.id === 'sera'
      );
      expect(group.getAttribute('aria-labelledby')).toBe(labelId);
      expect(label.hasAttribute('tabindex')).toBe(false);
      expect(root.getExposes().getCollectionCount()).toBe(1);
      expect(root.getExposes().open).toBe(open);
      expect(item.getExposes().focused).toBe(focused);
      expect(focused.get()).toBe(true);
      expect(item.firstChild).toBe(text);
      expect(requests).toEqual([]);
    }
    item.click();
    await flush();
    expect(open.get()).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ open: false });
    label.remove();
    await flush();
    expect(group.getAttribute('aria-label')).toBe('Fallback actions');
    expect(group.hasAttribute('aria-labelledby')).toBe(false);
    group.prepend(label);
    await flush();
    expect(group.getAttribute('aria-labelledby')).toBe(labelId);
  });

  for (const [name, family] of [
    [
      'menubar',
      {
        root: menubar.menubarRoot,
        trigger: menubar.menubarTrigger,
        content: menubar.menubarContent,
        item: menubar.menubarItem,
      },
    ],
    [
      'navigation-menu',
      {
        root: navigation.navigationMenuRoot,
        trigger: navigation.navigationMenuTrigger,
        content: navigation.navigationMenuContent,
        item: navigation.navigationMenuItem,
      },
    ],
  ] as const) {
    it(`${name} keeps its own action, focus and controlled menu-value owner through all profiles`, async () => {
      const scope = make(styleScope, { styleProfile: 'rhea' });
      const root = make(family.root, { value: 'file' });
      const trigger = make(family.trigger, { value: 'file' });
      const content = make(family.content, { value: 'file' });
      const item = make(family.item, { value: 'run', textValue: 'Run' });
      trigger.textContent = 'File';
      item.textContent = 'Run';
      content.append(item);
      root.append(trigger, content);
      scope.append(root);
      const proposals = recordDetails(root, 'valueChange');
      const selections = recordDetails(item, 'select');
      mount(scope);
      await flush();
      item.focus();
      await flush();
      const value = root.getExposes().value;
      const focused = item.getExposes().focused;
      for (const profile of profiles) {
        setElementProps(scope, { styleProfile: profile.id });
        await flush();
        expect(root.getExposes().value).toBe(value);
        expect(value.get()).toBe('file');
        expect(trigger.getExposes().expanded.get()).toBe(true);
        expect(content.getExposes().open.get()).toBe(true);
        expect(item.getExposes().focused).toBe(focused);
        expect(focused.get()).toBe(true);
        expect(item.getAttribute('role')).toBe(name === 'menubar' ? 'menuitem' : 'button');
        expect(tokens(item)).toContain(
          name === 'menubar' || profile.id === 'new-york-v4' ? 'bg-accent' : 'bg-muted'
        );
        expect(proposals).toEqual([]);
      }
      item.click();
      await flush();
      expect(selections).toEqual([{ value: 'run', menuValue: 'file' }]);
      expect(proposals).toEqual([{ value: '', reason: 'dismiss' }]);
      expect(value.get()).toBe('file');
      setElementProps(root, { value: 'file', disabled: true });
      await flush();
      expect(item.getExposes().disabled.get()).toBe(true);
      item.click();
      expect(selections).toHaveLength(1);
    });
  }

  it('preserves one native Navigation Link, current-page facts and default navigation across scoped content recipes', async () => {
    const scope = make(styleScope, { styleProfile: 'rhea' });
    const root = make(navigation.navigationMenuRoot, { value: 'guide' });
    const trigger = make(navigation.navigationMenuTrigger, { value: 'guide' });
    const content = make(navigation.navigationMenuContent, { value: 'guide' });
    const link = make(navigation.navigationMenuLink, {
      href: '#guide',
      current: true,
      target: '_blank',
    });
    const label = document.createElement('span');
    label.textContent = 'Guide';
    trigger.textContent = 'Documentation';
    link.append(label);
    content.append(link);
    root.append(trigger, content);
    scope.append(root);
    const events = recordDetails(link, 'navigate');
    mount(scope);
    await flush();
    const anchor = link.querySelector('a')!;
    expect(anchor).not.toBeNull();
    const focused = link.getExposes().focused;
    link.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    for (const profile of profiles) {
      setElementProps(scope, { styleProfile: profile.id });
      await flush();
      expect(link.querySelectorAll('a')).toHaveLength(1);
      expect(link.querySelector('a')).toBe(anchor);
      expect(anchor.contains(label)).toBe(true);
      expect(anchor.getAttribute('href')).toBe('#guide');
      expect(anchor.getAttribute('aria-current')).toBe('page');
      expect(link.getExposes().focused).toBe(focused);
      expect(focused.get()).toBe(true);
      expect(document.activeElement).toBe(anchor);
      expect(tokens(anchor)).toContain('ring-0');
    }
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(click);
    await flush();
    expect(click.defaultPrevented).toBe(false);
    expect(events).toEqual([
      { href: '#guide', target: '_blank', rel: 'noopener', modified: false },
    ]);
    expect(root.getExposes().value.get()).toBe('guide');
    setElementProps(link, { href: '#changed', disabled: true, current: false });
    await flush();
    expect(anchor.hasAttribute('href')).toBe(false);
    expect(anchor.hasAttribute('aria-current')).toBe(false);
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
  });

  it('retains Context Menu context-intent ownership without the old demo-sized trigger paint', async () => {
    const scope = make(styleScope, { styleProfile: 'new-york-v4' });
    const root = make(contextMenu.contextMenuRoot);
    const trigger = make(contextMenu.contextMenuTrigger);
    const content = make(contextMenu.contextMenuContent, { enterDuration: 0, leaveDuration: 0 });
    const item = make(contextMenu.contextMenuItem, { value: 'inspect', textValue: 'Inspect' });
    trigger.textContent = 'Context target';
    item.textContent = 'Inspect';
    content.append(item);
    root.append(trigger, content);
    scope.append(root);
    mount(scope);
    await flush();
    trigger.click();
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
    expect(tokens(trigger)).not.toContain('w-64');
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 45,
        clientY: 60,
        button: 2,
      })
    );
    await flush();
    expect(root.getExposes().open.get()).toBe(true);
    const open = root.getExposes().open;
    for (const profile of profiles) {
      setElementProps(scope, { styleProfile: profile.id });
      await flush();
      expect(root.getExposes().open).toBe(open);
      expect(open.get()).toBe(true);
      expect(tokens(item)).toContain(profile.item);
      expect(item.getAttribute('role')).toBe('menuitem');
    }
    item.click();
    await flush();
    expect(open.get()).toBe(false);
  });
});
