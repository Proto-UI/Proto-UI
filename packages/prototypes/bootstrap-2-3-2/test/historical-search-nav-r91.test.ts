import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
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
type Host = HTMLElement & { getExposes(): Record<string, any> };
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
    AdaptToWebComponent(proto as any, {
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
function element(name: string, props: Record<string, unknown> = {}) {
  const node = document.createElement(name) as Host;
  setElementProps(node, props);
  owned.add(node);
  return node;
}
function tokens(node: HTMLElement) {
  return (node.getAttribute('data-pui-style') ?? '').split(/\s+/);
}
function requests(node: HTMLElement, name: string) {
  const details: any[] = [];
  node.addEventListener(name, (event) => details.push((event as CustomEvent).detail));
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

const searchFamilies = ['autocomplete', 'combobox', 'command'] as const;
async function search(slug: (typeof searchFamilies)[number], props: Record<string, unknown> = {}) {
  const prefix = `bootstrap-2-3-2-${slug}`;
  const root = element(`${prefix}-root`, props);
  const input = element(`${prefix}-input`, { a11yLabel: 'Search fruit', name: 'fruit' });
  const content = element(`${prefix}-content`);
  const empty = element(`${prefix}-empty`);
  empty.textContent = 'No matching fruit';
  const items = [
    ['apple', 'Apple'],
    ['pear', 'Pear'],
  ].map(([value, textValue]) => {
    const item = element(`${prefix}-item`, { value, textValue });
    item.textContent = textValue;
    return item;
  });
  const trigger = slug === 'command' ? null : element(`${prefix}-trigger`);
  if (trigger) trigger.textContent = 'Show fruit';
  content.append(...items, empty);
  root.append(input, ...(trigger ? [trigger] : []), content);
  document.body.append(root);
  await flush();
  return { root, input, content, empty, items, trigger, editor: input.querySelector('input')! };
}

describe.each(searchFamilies)('historical %s projection', (slug) => {
  it('keeps one physical editor, filtered options and keyboard selection with paint withdrawal', async () => {
    const p = await search(slug);
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
    const p = await search(slug);
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

for (const slug of ['autocomplete', 'combobox'] as const) {
  it(`${slug} retains controlled value/query/open and emits one trigger request`, async () => {
    const p = await search(slug, { value: 'apple', inputValue: '', open: false });
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
  const auto = await search('autocomplete');
  const combo = await search('combobox');
  const inline = await search('command');
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

async function menu(slug: 'menubar' | 'navigation-menu', props: Record<string, unknown> = {}) {
  const prefix = `bootstrap-2-3-2-${slug}`;
  const root = element(`${prefix}-root`, props);
  const triggers = ['file', 'edit'].map((value) => {
    const trigger = element(`${prefix}-trigger`, { value });
    trigger.textContent = value;
    return trigger;
  });
  const panels = ['file', 'edit'].map((value) => element(`${prefix}-content`, { value }));
  const items = ['new', 'undo'].map((value) => {
    const item = element(`${prefix}-item`, { value, textValue: value });
    item.textContent = value;
    return item;
  });
  panels.forEach((panel, index) => panel.append(items[index]));
  root.append(triggers[0], panels[0], triggers[1], panels[1]);
  document.body.append(root);
  await flush();
  return { root, triggers, panels, items };
}
for (const slug of ['menubar', 'navigation-menu'] as const) {
  it(`${slug} keeps controlled panel ownership and withdraws open/disabled paint`, async () => {
    const p = await menu(slug, { value: 'file' });
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
  const p = await menu('navigation-menu', { defaultValue: 'file' });
  const link = element(navigation.navigationMenuLink.name, { href: '#guide', current: true });
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
  const root = element(contextMenu.contextMenuRoot.name, { open: false });
  const trigger = element(contextMenu.contextMenuTrigger.name);
  trigger.textContent = 'Context target';
  const content = element(contextMenu.contextMenuContent.name, { avoidCollisions: false });
  const item = element(contextMenu.contextMenuItem.name, { value: 'copy' });
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
  expect(opens.at(-1).open).toBe(false);
});

it('keeps dropdown group naming, shortcut state and transient action paint scoped to the owner', async () => {
  const root = element(dropdown.dropdownRoot.name, { open: true });
  const trigger = element(dropdown.dropdownTrigger.name);
  trigger.textContent = 'Actions';
  const content = element(dropdown.dropdownContent.name);
  const group = element(dropdown.dropdownGroup.name, { a11yLabel: 'Fallback actions' });
  const label = element(dropdown.dropdownLabel.name);
  label.textContent = 'Editing';
  const item = element(dropdown.dropdownItem.name, { value: 'copy' });
  item.append(document.createTextNode('Copy'));
  const shortcut = element(dropdown.dropdownShortcut.name);
  shortcut.textContent = 'Ctrl+C';
  item.append(shortcut);
  const separator = element(dropdown.dropdownSeparator.name);
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
  expect(opens[0].open).toBe(false);
  expect(root.getExposes().open.get()).toBe(true);
  label.remove();
  await flush();
  expect(group.hasAttribute('aria-labelledby')).toBe(false);
  expect(group.getAttribute('aria-label')).toBe('Fallback actions');
});

it('keeps Toolbar actions singular and a retained Separator on the current cross axis', async () => {
  const first = element(toolbar.toolbarRoot.name, { orientation: 'horizontal' });
  const second = element(toolbar.toolbarRoot.name, { orientation: 'vertical' });
  const button = element(toolbar.toolbarButton.name, { value: 'save' });
  button.textContent = 'Save';
  const separator = element(toolbar.toolbarSeparator.name);
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
  const root = element(toggleGroup.toggleGroupRoot.name, { value: ['a'] });
  const a = element(toggleGroup.toggleGroupItem.name, { value: 'a' });
  const b = element(toggleGroup.toggleGroupItem.name, { value: 'b' });
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
