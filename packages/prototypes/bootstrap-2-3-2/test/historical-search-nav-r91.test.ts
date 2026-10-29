import { afterEach, describe, expect, it } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import type { AdapterPrototype } from '@proto.ui/adapter-base';
import { activationTurn } from '../../../modules/native-link/test/no-network';
import * as autocomplete from '../src/autocomplete';
import * as combobox from '../src/combobox';
import * as command from '../src/command';
import * as contextMenu from '../src/context-menu';
import * as menubar from '../src/menubar';
import * as navigation from '../src/navigation-menu';
import * as dropdown from '../src/dropdown';
import * as toolbar from '../src/toolbar';
import * as toggleGroup from '../src/toggle-group';

// These exercise real Adapter/Runtime owners in the simulated WC host. They do
// not establish browser geometry, painted appearance, motion or native parity.
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
const registered = new Set<unknown>();
for (const family of [
  autocomplete,
  combobox,
  command,
  contextMenu,
  menubar,
  navigation,
  dropdown,
  toolbar,
  toggleGroup,
]) {
  for (const proto of Object.values(family)) {
    if (!proto || typeof proto !== 'object' || !('name' in proto) || !('setup' in proto)) continue;
    if (registered.has(proto)) continue;
    registered.add(proto);
    AdaptToWebComponent(proto, {
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.created') lives.created++;
          if (event.type === 'instance.dispose.done') lives.disposed++;
        },
      },
    });
  }
}
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
function element<TProto extends AdapterPrototype>(
  prototype: TProto,
  props: Record<string, unknown> = {}
) {
  // This exact Prototype registered the constructor above.
  const node = document.createElement(prototype.name) as WebComponentAdapterElement<TProto>;
  setElementProps(node, props);
  owned.add(node);
  return node;
}
function tokens(node: HTMLElement) {
  return (node.getAttribute('data-pui-style') ?? '').split(/\s+/);
}
function requests(node: HTMLElement, name: string) {
  const details: unknown[] = [];
  node.addEventListener(name, (event) => {
    if (event instanceof CustomEvent) details.push(event.detail);
  });
  return details;
}
function key(value: string) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })
  );
}
function type(editor: HTMLInputElement, value: string, composing = false) {
  editor.value = value;
  editor.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      data: value,
      inputType: 'insertText',
      isComposing: composing,
    })
  );
}
afterEach(async () => {
  for (const node of owned) node.remove();
  owned.clear();
  await expect.poll(() => lives.disposed).toBe(lives.created);
});

const searchFamilies = [
  {
    slug: 'autocomplete',
    root: autocomplete.autocompleteRoot,
    input: autocomplete.autocompleteInput,
    content: autocomplete.autocompleteContent,
    item: autocomplete.autocompleteItem,
    empty: autocomplete.autocompleteEmpty,
    trigger: autocomplete.autocompleteTrigger,
  },
  {
    slug: 'combobox',
    root: combobox.comboboxRoot,
    input: combobox.comboboxInput,
    content: combobox.comboboxContent,
    item: combobox.comboboxItem,
    empty: combobox.comboboxEmpty,
    trigger: combobox.comboboxTrigger,
  },
  {
    slug: 'command',
    root: command.commandRoot,
    input: command.commandInput,
    content: command.commandContent,
    item: command.commandItem,
    empty: command.commandEmpty,
    trigger: null,
  },
] as const;
async function search(
  family: (typeof searchFamilies)[number],
  props: Record<string, unknown> = {}
) {
  const root = element(family.root, props);
  const input = element(family.input, { a11yLabel: 'Search fruit', name: 'fruit' });
  const content = element(family.content);
  const empty = element(family.empty);
  empty.textContent = 'No matching fruit';
  const items = [
    ['apple', 'Apple'],
    ['pear', 'Pear'],
  ].map(([value, textValue]) => {
    const item = element(family.item, { value, textValue });
    item.textContent = textValue;
    return item;
  });
  const trigger = family.trigger ? element(family.trigger) : null;
  if (trigger) trigger.textContent = 'Show fruit';
  content.append(...items, empty);
  root.append(input, ...(trigger ? [trigger] : []), content);
  document.body.append(root);
  await flush();
  return { root, input, content, empty, items, trigger, editor: input.querySelector('input')! };
}

describe.each(searchFamilies)('historical $slug projection', (family) => {
  const { slug } = family;
  it('keeps one physical editor, filtered options and keyboard selection with paint withdrawal', async () => {
    const p = await search(family);
    expect(p.input.querySelectorAll('input,textarea,[contenteditable]')).toHaveLength(1);
    expect(p.editor.name).toBe('fruit');
    expect(p.editor.getAttribute('role')).toBe('combobox');
    const selected = requests(p.root, slug === 'command' ? 'execute' : 'valueChange');
    p.editor.focus();
    type(p.editor, 'pe');
    await flush();
    expect(p.root.getExposes().inputValue.get()).toBe('pe');
    expect(p.root.getExposes().visibleCount.get()).toBe(1);
    expect(p.items.map((item) => item.getExposes().visible.get())).toEqual([false, true]);
    key('ArrowDown');
    await flush();
    expect(document.activeElement).toBe(p.editor);
    expect(p.editor.getAttribute('aria-activedescendant')).toBe(p.items[1].id);
    expect(tokens(p.items[1])).toContain('bg-[linear-gradient(#08c,#0077b3)]');
    setElementProps(p.root, { disabled: true });
    await flush();
    expect(p.editor.disabled).toBe(true);
    expect(p.items[1].getExposes().disabled.get()).toBe(true);
    expect(tokens(p.items[1])).not.toContain('bg-[linear-gradient(#08c,#0077b3)]');
    expect(tokens(p.items[1])).toContain('text-[#999]');
    expect(p.root.getExposes().select('pear')).toBe(false);
    expect(selected).toHaveLength(0);
    setElementProps(p.root, {});
    await flush();
    expect(p.input.querySelector('input')).toBe(p.editor);
    expect(p.editor.disabled).toBe(false);
    expect(tokens(p.input)).not.toContain('bg-[#eee]');
    p.editor.focus();
    key('ArrowDown');
    key('Enter');
    await flush();
    expect(selected).toEqual([
      { value: slug === 'autocomplete' ? 'Pear' : 'pear', textValue: 'Pear', reason: 'keyboard' },
    ]);
    expect(p.root.getExposes().open.get()).toBe(slug === 'command');
    p.root.getExposes().setInputValue('missing');
    await flush();
    expect(p.root.getExposes().visibleCount.get()).toBe(0);
    expect(p.empty.getExposes().visible.get()).toBe(true);
    expect(p.items[1].getExposes().visible.get()).toBe(false);
    expect(tokens(p.items[1])).not.toContain('bg-[linear-gradient(#08c,#0077b3)]');
    p.root.getExposes().setInputValue('');
    await flush();
    expect(p.empty.getExposes().visible.get()).toBe(false);
    expect(p.empty.textContent).toContain('No matching fruit');
  });

  it('preserves IME and reversible readonly/disabled facts without another editor', async () => {
    const p = await search(family);
    const selected = requests(p.root, slug === 'command' ? 'execute' : 'valueChange');
    p.editor.focus();
    p.editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    type(p.editor, 'pe', true);
    key('ArrowDown');
    key('Enter');
    await flush();
    expect(p.input.getExposes().composing.get()).toBe(true);
    expect(selected).toHaveLength(0);
    p.editor.value = 'pe';
    p.editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'pe' }));
    await flush();
    expect(p.input.getExposes().composing.get()).toBe(false);
    expect(p.root.getExposes().inputValue.get()).toBe('pe');
    setElementProps(p.root, { readOnly: true });
    await flush();
    expect(p.editor.readOnly).toBe(true);
    expect(p.root.getExposes().select('pear')).toBe(false);
    setElementProps(p.root, { disabled: true });
    await flush();
    expect(p.editor.readOnly).toBe(false);
    expect(p.editor.disabled).toBe(true);
    setElementProps(p.root, {});
    await flush();
    expect(p.input.querySelectorAll('input')).toHaveLength(1);
    expect(p.input.querySelector('input')).toBe(p.editor);
    expect(p.editor.disabled).toBe(false);
    expect(p.editor.readOnly).toBe(false);
  });
});

for (const family of [searchFamilies[0], searchFamilies[1]]) {
  it(`${family.slug} retains controlled value/query/open and emits one trigger request`, async () => {
    const p = await search(family, { value: 'apple', inputValue: '', open: false });
    const queries = requests(p.root, 'inputValueChange');
    const opens = requests(p.root, 'openChange');
    const values = requests(p.root, 'valueChange');
    type(p.editor, 'pe');
    await flush();
    expect(queries).toEqual([{ value: 'pe', composing: false }]);
    expect(p.root.getExposes().inputValue.get()).toBe('');
    expect(p.root.getExposes().open.get()).toBe(false);
    opens.splice(0);
    p.trigger!.click();
    await flush();
    expect(opens).toEqual([{ open: true, reason: 'programmatic' }]);
    expect(p.root.getExposes().open.get()).toBe(false);
    expect(p.root.getExposes().select('pear')).toBe(true);
    await flush();
    expect(values).toHaveLength(1);
    expect(p.root.getExposes().value.get()).toBe('apple');
    setElementProps(p.root, { value: 'apple', inputValue: '', open: true, readOnly: true });
    await flush();
    expect(p.trigger!.getExposes().disabled.get()).toBe(true);
    expect(tokens(p.trigger!)).toContain('opacity-65');
    const before = opens.length;
    p.trigger!.click();
    await flush();
    expect(opens).toHaveLength(before);
    setElementProps(p.root, { value: 'apple', inputValue: '', open: true });
    await flush();
    expect(tokens(p.trigger!)).not.toContain('opacity-65');
    p.trigger!.click();
    await flush();
    expect(opens.at(-1)).toEqual({ open: false, reason: 'dismiss' });
    expect(p.root.getExposes().open.get()).toBe(true);
  });
}

it('retains distinct autocomplete free-text, combobox selection and inline command owners', async () => {
  const auto = await search(searchFamilies[0]);
  const combo = await search(searchFamilies[1]);
  const inline = await search(searchFamilies[2]);
  expect(auto.root.getExposes().select('Unlisted', 'free-text')).toBe(true);
  expect(combo.root.getExposes().select('Unlisted', 'free-text')).toBe(false);
  expect(auto.root.getExposes().value.get()).toBe('Unlisted');
  expect(combo.root.getExposes().value.get()).toBe('');
  expect(inline.root.getExposes().inputValue.get()).toBe('');
  inline.root.getExposes().close();
  await flush();
  expect(inline.root.getExposes().open.get()).toBe(true);
  expect(inline.content.getAttribute('role')).toBe('listbox');
});

const menuFamilies = [
  {
    slug: 'menubar',
    root: menubar.menubarRoot,
    trigger: menubar.menubarTrigger,
    content: menubar.menubarContent,
    item: menubar.menubarItem,
  },
  {
    slug: 'navigation-menu',
    root: navigation.navigationMenuRoot,
    trigger: navigation.navigationMenuTrigger,
    content: navigation.navigationMenuContent,
    item: navigation.navigationMenuItem,
  },
] as const;
async function menu(family: (typeof menuFamilies)[number], props: Record<string, unknown> = {}) {
  const root = element(family.root, props);
  const triggers = ['file', 'edit'].map((value) => {
    const trigger = element(family.trigger, { value });
    trigger.textContent = value;
    return trigger;
  });
  const panels = ['file', 'edit'].map((value) => element(family.content, { value }));
  const items = ['new', 'undo'].map((value) => {
    const item = element(family.item, { value, textValue: value });
    item.textContent = value;
    return item;
  });
  panels.forEach((panel, index) => panel.append(items[index]));
  root.append(triggers[0], panels[0], triggers[1], panels[1]);
  document.body.append(root);
  await flush();
  return { root, triggers, panels, items };
}
for (const family of menuFamilies) {
  const { slug } = family;
  it(`${slug} keeps controlled panel ownership and withdraws open/disabled paint`, async () => {
    const p = await menu(family, { value: 'file' });
    expect(p.root.getAttribute('role')).toBe(slug === 'menubar' ? 'menubar' : 'navigation');
    expect(p.panels.map((panel) => panel.getExposes().open.get())).toEqual([true, false]);
    expect(tokens(p.triggers[0])).toContain('bg-[#999]');
    const changes = requests(p.root, 'valueChange');
    expect(p.root.getExposes().requestValue('edit')).toBe(true);
    await flush();
    expect(changes).toHaveLength(1);
    expect(p.root.getExposes().value.get()).toBe('file');
    setElementProps(p.root, { value: 'edit' });
    await flush();
    expect(p.panels.map((panel) => panel.getExposes().open.get())).toEqual([false, true]);
    expect(tokens(p.triggers[0])).not.toContain('bg-[#999]');
    expect(tokens(p.triggers[1])).toContain('bg-[#999]');
    setElementProps(p.root, { value: 'edit', disabled: true });
    await flush();
    expect(tokens(p.triggers[1])).not.toContain('bg-[#999]');
    expect(tokens(p.triggers[1])).toContain('text-[#999]');
    expect(p.root.getExposes().requestValue('file')).toBe(false);
    setElementProps(p.root, { value: 'edit' });
    await flush();
    expect(tokens(p.triggers[1])).toContain('bg-[#999]');
    const selected = requests(p.items[1], 'select');
    p.items[1].click();
    await flush();
    expect(selected).toEqual([{ value: 'undo', menuValue: 'edit' }]);
    expect(p.root.getExposes().value.get()).toBe('edit');
  });
}

it('keeps navigation content in one real anchor with current, disabled and modified intent', async () => {
  const p = await menu(menuFamilies[1], { defaultValue: 'file' });
  const link = element(navigation.navigationMenuLink, { href: '#guide', current: true });
  const text = document.createElement('span');
  text.textContent = 'Guide';
  link.append(text);
  p.panels[0].append(link);
  await flush();
  const anchor = link.querySelector('a')!;
  expect(link.querySelectorAll('a')).toHaveLength(1);
  expect(anchor.contains(text)).toBe(true);
  expect(anchor.getAttribute('aria-current')).toBe('page');
  expect(tokens(link)).toContain('bg-[linear-gradient(#08c,#0077b3)]');
  const navigated = requests(link, 'navigate');
  const click = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ctrlKey: true,
  });
  anchor.dispatchEvent(click);
  await activationTurn();
  await flush();
  expect(click.defaultPrevented).toBe(false);
  expect(navigated).toEqual([{ href: '#guide', target: '_self', rel: '', modified: true }]);
  expect(p.root.getExposes().value.get()).toBe('file');
  setElementProps(link, { href: '#changed', disabled: true });
  await flush();
  expect(anchor.hasAttribute('href')).toBe(false);
  expect(anchor.hasAttribute('aria-current')).toBe(false);
  expect(tokens(link)).not.toContain('bg-[linear-gradient(#08c,#0077b3)]');
  const blocked = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  anchor.dispatchEvent(blocked);
  await activationTurn();
  expect(blocked.defaultPrevented).toBe(true);
  expect(navigated).toHaveLength(1);
  setElementProps(link, { href: '#changed', closeOnSelect: false });
  await flush();
  expect(link.querySelector('a')).toBe(anchor);
  expect(anchor.getAttribute('href')).toBe('#changed');
  expect(anchor.getAttribute('aria-disabled')).not.toBe('true');
});

it('keeps context intent distinct from click and retains controlled open through disabled action', async () => {
  const root = element(contextMenu.contextMenuRoot, { open: false });
  const trigger = element(contextMenu.contextMenuTrigger);
  trigger.textContent = 'Context target';
  const content = element(contextMenu.contextMenuContent, { avoidCollisions: false });
  const item = element(contextMenu.contextMenuItem, { value: 'copy' });
  item.textContent = 'Copy';
  content.append(item);
  root.append(trigger, content);
  document.body.append(root);
  await flush();
  const opens = requests(root, 'openChange');
  trigger.click();
  await flush();
  expect(opens).toHaveLength(0);
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
  trigger.dispatchEvent(event);
  await flush();
  expect(event.defaultPrevented).toBe(true);
  expect(opens).toHaveLength(1);
  expect(root.getExposes().open.get()).toBe(false);
  setElementProps(root, { open: true });
  await flush();
  expect(content.getExposes().open.get()).toBe(true);
  item.getExposes().focusSelf({ reason: 'keyboard' });
  await flush();
  expect(tokens(item)).toContain('bg-[linear-gradient(#08c,#0077b3)]');
  setElementProps(item, { value: 'copy', disabled: true });
  await flush();
  expect(tokens(item)).not.toContain('bg-[linear-gradient(#08c,#0077b3)]');
  const selected = requests(item, 'select');
  item.click();
  await flush();
  expect(selected).toHaveLength(0);
  expect(root.getExposes().open.get()).toBe(true);
  setElementProps(item, { value: 'copy' });
  await flush();
  item.click();
  await flush();
  expect(selected).toHaveLength(1);
  expect(root.getExposes().open.get()).toBe(true);
  expect(opens.at(-1)).toEqual(expect.objectContaining({ open: false }));
});

it('keeps dropdown group naming, shortcut state and transient action paint scoped to the owner', async () => {
  const root = element(dropdown.dropdownRoot, { open: true });
  const trigger = element(dropdown.dropdownTrigger);
  trigger.textContent = 'Actions';
  const content = element(dropdown.dropdownContent);
  const group = element(dropdown.dropdownGroup, { a11yLabel: 'Fallback actions' });
  const label = element(dropdown.dropdownLabel);
  label.textContent = 'Editing';
  const item = element(dropdown.dropdownItem, { value: 'copy' });
  item.append(document.createTextNode('Copy'));
  const shortcut = element(dropdown.dropdownShortcut);
  shortcut.textContent = 'Ctrl+C';
  item.append(shortcut);
  const separator = element(dropdown.dropdownSeparator);
  group.append(label, item);
  content.append(group, separator);
  root.append(trigger, content);
  document.body.append(root);
  await flush();
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-labelledby')).toBe(label.id);
  expect(separator.getAttribute('role')).toBe('separator');
  item.getExposes().focusSelf({ reason: 'keyboard' });
  await flush();
  expect(tokens(item)).toContain('bg-[linear-gradient(#08c,#0077b3)]');
  expect(tokens(shortcut)).toContain('text-primary-foreground');
  const selected = requests(item, 'select');
  const opens = requests(root, 'openChange');
  setElementProps(item, { value: 'copy', disabled: true });
  await flush();
  expect(tokens(item)).not.toContain('bg-[linear-gradient(#08c,#0077b3)]');
  expect(item.getAttribute('aria-disabled')).toBe('true');
  item.click();
  await flush();
  expect(selected).toHaveLength(0);
  expect(opens).toHaveLength(0);
  setElementProps(item, { value: 'copy' });
  await flush();
  item.click();
  await flush();
  expect(selected).toHaveLength(1);
  expect(opens).toHaveLength(1);
  expect(opens[0]).toEqual(expect.objectContaining({ open: false }));
  expect(root.getExposes().open.get()).toBe(true);
  label.remove();
  await flush();
  expect(group.hasAttribute('aria-labelledby')).toBe(false);
  expect(group.getAttribute('aria-label')).toBe('Fallback actions');
});

it('keeps Toolbar actions singular and a retained Separator on the current cross axis', async () => {
  const first = element(toolbar.toolbarRoot, { orientation: 'horizontal' });
  const second = element(toolbar.toolbarRoot, { orientation: 'vertical' });
  const button = element(toolbar.toolbarButton, { value: 'save' });
  button.textContent = 'Save';
  const separator = element(toolbar.toolbarSeparator);
  separator.append(document.createTextNode('Not separator content'));
  first.append(button, separator);
  document.body.append(first, second);
  await flush();
  expect(separator.textContent).toBe('');
  expect(separator.getAttribute('aria-orientation')).toBe('vertical');
  expect(tokens(separator)).toContain('w-[1px]');
  const actions = requests(button, 'action');
  button.click();
  await flush();
  expect(actions).toEqual([{ value: 'save' }]);
  setElementProps(first, { orientation: 'horizontal', disabled: true });
  await flush();
  expect(tokens(button)).toContain('opacity-65');
  button.click();
  await flush();
  expect(actions).toHaveLength(1);
  setElementProps(first, { orientation: 'horizontal' });
  await flush();
  expect(tokens(button)).not.toContain('opacity-65');
  second.append(separator);
  await flush();
  expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
  expect(tokens(separator)).not.toContain('w-[1px]');
  expect(tokens(separator)).toContain('h-[1px]');
  setElementProps(first, { orientation: 'vertical' });
  await flush();
  expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
  setElementProps(second, { orientation: 'horizontal' });
  await flush();
  expect(separator.getAttribute('aria-orientation')).toBe('vertical');
  expect(tokens(separator)).not.toContain('h-[1px]');
});

it('projects ToggleGroup active/disabled withdrawal while retaining controlled selection and axis', async () => {
  const root = element(toggleGroup.toggleGroupRoot, { value: ['a'] });
  const a = element(toggleGroup.toggleGroupItem, { value: 'a' });
  const b = element(toggleGroup.toggleGroupItem, { value: 'b' });
  a.textContent = 'A';
  b.textContent = 'B';
  root.append(a, b);
  document.body.append(root);
  await flush();
  const pressed = 'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]';
  expect(a.getAttribute('aria-pressed')).toBe('true');
  expect(tokens(a)).toContain(pressed);
  const changes = requests(root, 'valueChange');
  b.click();
  await flush();
  expect(changes).toEqual([{ value: ['b'] }]);
  expect(root.getExposes().getValue()).toEqual(['a']);
  setElementProps(root, { value: ['b'], orientation: 'vertical' });
  await flush();
  expect(a.getAttribute('aria-pressed')).toBe('false');
  expect(tokens(a)).not.toContain(pressed);
  expect(tokens(b)).toContain(pressed);
  expect(tokens(root)).toContain('flex-col');
  setElementProps(root, { value: ['b'], orientation: 'vertical', disabled: true });
  await flush();
  expect(tokens(b)).not.toContain(pressed);
  expect(tokens(b)).toContain('opacity-65');
  expect(root.getExposes().requestToggle('a')).toBe(false);
  setElementProps(root, { value: ['b'], orientation: 'horizontal', readOnly: true });
  await flush();
  expect(tokens(root)).not.toContain('flex-col');
  expect(tokens(b)).not.toContain('opacity-65');
  expect(tokens(b)).toContain(pressed);
  expect(root.getExposes().requestToggle('a')).toBe(false);
  expect(root.getExposes().getValue()).toEqual(['b']);
});

function expectJoinedEdges(
  item: HTMLElement,
  first: boolean,
  last: boolean,
  axis: 'horizontal' | 'vertical'
) {
  const current = tokens(item);
  for (const [token, active] of [
    ['rounded-l-[4px]', first && axis === 'horizontal'],
    ['rounded-r-[4px]', last && axis === 'horizontal'],
    ['rounded-t-[4px]', first && axis === 'vertical'],
    ['rounded-b-[4px]', last && axis === 'vertical'],
    ['ml-[-1px]', !first && axis === 'horizontal'],
    ['mt-[-1px]', !first && axis === 'vertical'],
  ] as const) {
    expect(current.includes(token), token).toBe(active);
  }
}

it('updates joined corners and seams from live logical order, including disabled members', async () => {
  const root = element(toggleGroup.toggleGroupRoot, { value: ['b'] });
  const a = element(toggleGroup.toggleGroupItem, { value: 'a' });
  const b = element(toggleGroup.toggleGroupItem, { value: 'b', disabled: true });
  const c = element(toggleGroup.toggleGroupItem, { value: 'c' });
  a.textContent = 'A';
  b.textContent = 'B';
  c.textContent = 'C';
  root.append(a, b, c);
  document.body.append(root);
  await flush();
  const changes = requests(root, 'valueChange');
  expectJoinedEdges(a, true, false, 'horizontal');
  expectJoinedEdges(b, false, false, 'horizontal');
  expectJoinedEdges(c, false, true, 'horizontal');
  root.prepend(c);
  await flush();
  expectJoinedEdges(c, true, false, 'horizontal');
  expectJoinedEdges(a, false, false, 'horizontal');
  expectJoinedEdges(b, false, true, 'horizontal');
  setElementProps(root, { value: ['b'], orientation: 'vertical' });
  await flush();
  expectJoinedEdges(c, true, false, 'vertical');
  expectJoinedEdges(a, false, false, 'vertical');
  expectJoinedEdges(b, false, true, 'vertical');
  b.remove();
  await flush();
  expectJoinedEdges(a, false, true, 'vertical');
  c.remove();
  await flush();
  expectJoinedEdges(a, true, true, 'vertical');
  root.append(b);
  await flush();
  expectJoinedEdges(a, true, false, 'vertical');
  expectJoinedEdges(b, false, true, 'vertical');
  setElementProps(root, { value: ['b'], orientation: 'diagonal' });
  await flush();
  expect(root.getAttribute('aria-orientation')).toBe('vertical');
  expectJoinedEdges(a, true, false, 'vertical');
  expectJoinedEdges(b, false, true, 'vertical');
  setElementProps(root, { value: ['b'], orientation: 'horizontal' });
  await flush();
  expectJoinedEdges(a, true, false, 'horizontal');
  expectJoinedEdges(b, false, true, 'horizontal');
  expect(root.getExposes().getValue()).toEqual(['b']);
  expect(b.getAttribute('aria-pressed')).toBe('true');
  expect(b.getAttribute('aria-disabled')).toBe('true');
  expect(changes).toHaveLength(0);
});

it('rebinds joined edge presentation to the current root and excludes nested domains', async () => {
  const first = element(toggleGroup.toggleGroupRoot, { value: ['a'] });
  const second = element(toggleGroup.toggleGroupRoot, { value: ['b'], orientation: 'vertical' });
  const nested = element(toggleGroup.toggleGroupRoot, { orientation: 'vertical' });
  const a = element(toggleGroup.toggleGroupItem, { value: 'a' });
  const b = element(toggleGroup.toggleGroupItem, { value: 'b' });
  const c = element(toggleGroup.toggleGroupItem, { value: 'c' });
  const inner = element(toggleGroup.toggleGroupItem, { value: 'inner' });
  a.textContent = 'A';
  b.textContent = 'B';
  c.textContent = 'C';
  inner.textContent = 'Inner';
  nested.append(inner);
  first.append(a, c, nested);
  second.append(b);
  document.body.append(first, second);
  await flush();
  const firstChanges = requests(first, 'valueChange');
  const secondChanges = requests(second, 'valueChange');
  expectJoinedEdges(a, true, false, 'horizontal');
  expectJoinedEdges(c, false, true, 'horizontal');
  expectJoinedEdges(inner, true, true, 'vertical');
  second.append(a);
  await flush();
  expectJoinedEdges(c, true, true, 'horizontal');
  expectJoinedEdges(b, true, false, 'vertical');
  expectJoinedEdges(a, false, true, 'vertical');
  expectJoinedEdges(inner, true, true, 'vertical');
  setElementProps(second, { value: ['b'], orientation: 'horizontal' });
  await flush();
  expectJoinedEdges(b, true, false, 'horizontal');
  expectJoinedEdges(a, false, true, 'horizontal');
  setElementProps(first, { value: ['a'], orientation: 'vertical' });
  await flush();
  expectJoinedEdges(c, true, true, 'vertical');
  expectJoinedEdges(a, false, true, 'horizontal');
  expectJoinedEdges(inner, true, true, 'vertical');
  expect(first.getExposes().getValue()).toEqual(['a']);
  expect(second.getExposes().getValue()).toEqual(['b']);
  expect(firstChanges).toHaveLength(0);
  expect(secondChanges).toHaveLength(0);
});
