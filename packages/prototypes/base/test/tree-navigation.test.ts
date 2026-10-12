import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { treeRoot, treeItem } from '../src/tree';
for (const p of [treeRoot, treeItem])
  AdaptToWebComponent(p, { registerAs: `navigation-${p.name}` });
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.innerHTML = '';
  await flush();
});
async function setup(disabled: boolean, rootProps = {}, nested = false) {
  const root = document.createElement('navigation-base-tree-root') as any;
  const grandparent = document.createElement('navigation-base-tree-item') as any;
  const parent = document.createElement('navigation-base-tree-item') as any;
  const child = document.createElement('navigation-base-tree-item') as any;
  const sibling = document.createElement('navigation-base-tree-item') as any;
  setElementProps(root, { expandedKeys: nested ? ['g', 'p'] : ['p'], ...rootProps });
  setElementProps(grandparent, { nodeKey: 'g' });
  setElementProps(parent, { nodeKey: 'p', parentKey: nested ? 'g' : '', disabled });
  setElementProps(child, { nodeKey: 'c', parentKey: 'p' });
  setElementProps(sibling, { nodeKey: 's', parentKey: 'p' });
  if (nested) root.append(grandparent);
  root.append(parent, child, sibling);
  document.body.append(root);
  await flush();
  child.getExposes().focusSelf({ reason: 'keyboard' });
  await flush();
  const items = nested ? [grandparent, parent, child, sibling] : [parent, child, sibling];
  return { root, grandparent, parent, child, sibling, items };
}
function tabEntries(items: any[]) {
  return items.filter(
    (item) =>
      item.tabIndex >= 0 && !item.getExposes().disabled.get() && !item.getExposes().hidden.get()
  );
}
async function key(item: HTMLElement, value: string, type = 'keydown') {
  const event = new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true });
  item.dispatchEvent(event);
  await flush();
  return event;
}
it.each([{}, { readOnly: true }, { value: 's' }])(
  'preserves enabled child and Tab entry when its parent is disabled: %j',
  async (props) => {
    const { parent, child, items, root } = await setup(true, props);
    expect(document.activeElement).toBe(child);
    expect(tabEntries(items)).toEqual([child]);
    const value = root.getExposes().value.get();
    const event = await key(child, 'ArrowLeft');
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(child);
    expect(child.getExposes().focused.get()).toBe(true);
    expect(parent.getExposes().focused.get()).toBe(false);
    expect(tabEntries(items)).toEqual([child]);
    expect(root.getExposes().value.get()).toBe(value);
    expect(root.getExposes().getExpandedKeys()).toEqual(['p']);
  }
);
it('does not invent a jump across a disabled parent to an enabled ancestor', async () => {
  const { child, grandparent, items } = await setup(true, {}, true);
  await key(child, 'ArrowLeft');
  expect(document.activeElement).toBe(child);
  expect(grandparent.getExposes().focused.get()).toBe(false);
  expect(tabEntries(items)).toEqual([child]);
});
it('moves to an enabled direct parent, retaining one Tab entry and separate selection', async () => {
  const { root, child, parent, items } = await setup(false, { value: 's' }, true);
  await key(child, 'ArrowLeft');
  expect(document.activeElement).toBe(parent);
  expect(tabEntries(items)).toEqual([parent]);
  expect(root.getExposes().value.get()).toBe('s');
});
it('keeps controlled collapse request-only and uncontrolled collapse effective', async () => {
  const { root, child, parent, items } = await setup(false);
  const changes: unknown[] = [];
  root.addEventListener('expandedChange', (event: CustomEvent) => changes.push(event.detail));
  await key(child, 'ArrowLeft');
  await key(parent, 'ArrowLeft');
  expect(changes).toEqual([{ expandedKeys: [] }]);
  expect(root.getExposes().getExpandedKeys()).toEqual(['p']);
  expect(child.getExposes().hidden.get()).toBe(false);
  expect(tabEntries(items)).toEqual([parent]);
  root.remove();
  await flush();
  const free = await setup(false, { expandedKeys: undefined, defaultExpandedKeys: ['p'] });
  await key(free.child, 'ArrowLeft');
  await key(free.parent, 'ArrowLeft');
  expect(free.root.getExposes().getExpandedKeys()).toEqual([]);
  expect(free.child.getExposes().hidden.get()).toBe(true);
  expect(tabEntries(free.items)).toEqual([free.parent]);
});
it.each(['Enter', ' ', 'click'])(
  'selects once per %s activation and keeps single selection',
  async (input) => {
    const { root, child, sibling, items } = await setup(true);
    const changes: unknown[] = [];
    root.addEventListener('valueChange', (event: CustomEvent) => changes.push(event.detail));
    if (input === 'click') child.click();
    else {
      await key(child, input);
      await key(child, input, 'keyup');
    }
    await flush();
    expect(changes).toEqual([{ value: 'c' }]);
    await key(child, 'ArrowDown');
    expect(document.activeElement).toBe(sibling);
    expect(tabEntries(items)).toEqual([sibling]);
    expect(root.getExposes().value.get()).toBe('c');
    sibling.click();
    await flush();
    expect(changes).toEqual([{ value: 'c' }, { value: 's' }]);
    expect(child.getExposes().selected.get()).toBe(false);
    expect(sibling.getExposes().selected.get()).toBe(true);
  }
);
it('does not focus or activate a root-disabled tree', async () => {
  const { root, child, items } = await setup(false, { disabled: true });
  expect(document.activeElement).not.toBe(child);
  await key(child, 'ArrowLeft');
  child.click();
  await flush();
  expect(tabEntries(items)).toEqual([]);
  expect(root.getExposes().value.get()).toBe('');
});
