import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { treeRoot, treeItem, treeGroup } from '../src/tree';

for (const p of [treeRoot, treeItem, treeGroup])
  AdaptToWebComponent(p, { registerAs: `hierarchy-${p.name}` });
const flush = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const create = (name: string, props: object = {}) => {
  const element = document.createElement(`hierarchy-base-tree-${name}`) as any;
  setElementProps(element, props);
  return element;
};
async function fixture(props = {}) {
  const root = create('root', props);
  const first = create('item', { nodeKey: 'first', textValue: 'Files' });
  const second = create('item', { nodeKey: 'second', textValue: 'Plans' });
  const firstGroup = create('group', { nodeKey: 'first' });
  const secondGroup = create('group', { nodeKey: 'second' });
  const child = create('item', { nodeKey: 'child', parentKey: 'first', textValue: 'Report' });
  const other = create('item', { nodeKey: 'other', parentKey: 'second', textValue: 'Review' });
  first.textContent = 'Files';
  second.textContent = 'Plans';
  child.textContent = 'Report';
  other.textContent = 'Review';
  firstGroup.append(child);
  secondGroup.append(other);
  root.append(first, firstGroup, second, secondGroup);
  document.body.append(root);
  await flush();
  return { root, first, second, firstGroup, secondGroup, child, other };
}
async function key(element: HTMLElement, value: string) {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  await flush();
  return event;
}

it.each(['ltr', 'rtl'])(
  'maps forward and backward to the declared %s direction',
  async (direction) => {
    const { root, first, child } = await fixture({ direction });
    expect(root.getAttribute('data-pui-style')).toContain(`direction-${direction}`);
    const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    first.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect((await key(first, forward)).defaultPrevented).toBe(true);
    expect(root.getExposes().getExpandedKeys()).toEqual(['first']);
    await key(first, forward);
    expect(document.activeElement).toBe(child);
    await key(child, backward);
    expect(document.activeElement).toBe(first);
    await key(first, backward);
    expect(root.getExposes().getExpandedKeys()).toEqual([]);
    expect(root.getExposes().value.get()).toBe('');
  }
);

it('binds each materialized group to its own item and withdraws missing targets', async () => {
  const { root, first, second, firstGroup, secondGroup } = await fixture({
    defaultExpandedKeys: ['first', 'second'],
  });
  expect(first.id).not.toBe('');
  expect(second.id).not.toBe('');
  expect(first.getAttribute('aria-controls')).toBe(firstGroup.id);
  expect(second.getAttribute('aria-controls')).toBe(secondGroup.id);
  expect(firstGroup.getAttribute('aria-labelledby')).toBe(first.id);
  expect(secondGroup.getAttribute('aria-labelledby')).toBe(second.id);
  const oldIdentity = firstGroup.id;
  firstGroup.remove();
  await flush();
  expect(first.getAttribute('aria-controls')).toBeNull();
  expect(second.getAttribute('aria-controls')).toBe(secondGroup.id);
  root.append(firstGroup);
  await flush();
  expect(first.getAttribute('aria-controls')).toBe(firstGroup.id);
  expect(firstGroup.getAttribute('aria-labelledby')).toBe(first.id);
  expect(oldIdentity).not.toBe('');
  setElementProps(firstGroup, { nodeKey: 'missing' });
  await flush();
  expect(first.getAttribute('aria-controls')).toBeNull();
  expect(firstGroup.getAttribute('aria-labelledby')).toBeNull();
});

it('returns a hidden focused descendant to the committed collapsed ancestor without selecting it', async () => {
  const { root, first, child, firstGroup } = await fixture({
    defaultExpandedKeys: ['first'],
    defaultValue: 'child',
  });
  child.getExposes().focusSelf({ reason: 'keyboard' });
  await flush();
  expect(document.activeElement).toBe(child);
  root.getExposes().requestExpanded('first', false);
  await flush();
  expect(document.activeElement).toBe(first);
  expect(child.getExposes().hidden.get()).toBe(true);
  expect(firstGroup.getAttribute('aria-hidden')).toBe('true');
  expect(root.getExposes().value.get()).toBe('child');
});

it('does not focus on a rejected controlled collapse or steal focus from an external owner', async () => {
  const { root, child } = await fixture({ expandedKeys: ['first'] });
  child.getExposes().focusSelf({ reason: 'keyboard' });
  await flush();
  root.getExposes().requestExpanded('first', false);
  await flush();
  expect(document.activeElement).toBe(child);
  expect(child.getExposes().hidden.get()).toBe(false);
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  await flush();
  setElementProps(root, { expandedKeys: [] });
  await flush();
  expect(document.activeElement).toBe(outside);
});

it('reconciles reorder, reparent, insertion and removal without emitting user requests', async () => {
  const { root, first, second, child, firstGroup, secondGroup } = await fixture({
    defaultExpandedKeys: ['first', 'second'],
  });
  const changes: unknown[] = [];
  root.addEventListener('valueChange', (event: Event) => changes.push(event));
  root.addEventListener('expandedChange', (event: Event) => changes.push(event));
  root.insertBefore(second, first);
  await flush();
  expect(
    root
      .getExposes()
      .getTree()
      .filter((node: any) => !node.parentKey)
      .map((node: any) => node.key)
  ).toEqual(['second', 'first']);
  setElementProps(child, { nodeKey: 'child', parentKey: 'second', textValue: 'Report' });
  secondGroup.append(child);
  await flush();
  expect(child.getExposes().position.get()).toBe(2);
  expect(child.getExposes().setSize.get()).toBe(2);
  const inserted = create('item', { nodeKey: 'inserted', parentKey: 'first' });
  firstGroup.append(inserted);
  await flush();
  expect(inserted.getExposes().level.get()).toBe(2);
  inserted.remove();
  await flush();
  expect(
    root
      .getExposes()
      .getTree()
      .some((node: any) => node.key === 'inserted')
  ).toBe(false);
  expect(changes).toEqual([]);
});

it('keeps keyed relationships isolated between independent tree roots', async () => {
  const firstTree = await fixture({ defaultExpandedKeys: ['first'] });
  const secondTree = await fixture({ defaultExpandedKeys: ['first'] });
  expect(firstTree.first.getAttribute('aria-controls')).toBe(firstTree.firstGroup.id);
  expect(secondTree.first.getAttribute('aria-controls')).toBe(secondTree.firstGroup.id);
  expect(firstTree.firstGroup.id).not.toBe(secondTree.firstGroup.id);
  firstTree.secondGroup.append(secondTree.root);
  await flush();
  expect(firstTree.root.getExposes().getTree()).toHaveLength(4);
  expect(secondTree.root.getExposes().getTree()).toHaveLength(4);
  expect(firstTree.first.getAttribute('aria-controls')).toBe(firstTree.firstGroup.id);
  expect(secondTree.first.getAttribute('aria-controls')).toBe(secondTree.firstGroup.id);
});
it('withdraws an ambiguous same-key Group rather than choosing the first materialized target', async () => {
  const { root, first, firstGroup } = await fixture({ defaultExpandedKeys: ['first'] });
  const duplicate = create('group', { nodeKey: 'first' });
  root.append(duplicate);
  await flush();
  expect(first.getAttribute('aria-controls')).toBeNull();
  duplicate.remove();
  await flush();
  expect(first.getAttribute('aria-controls')).toBe(firstGroup.id);
});
