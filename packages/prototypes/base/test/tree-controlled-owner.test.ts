import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { treeRoot, treeItem, treeGroup } from '../src/tree';

for (const proto of [treeRoot, treeItem, treeGroup])
  AdaptToWebComponent(proto, { registerAs: `owner-${proto.name}` });
const flush = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
function node(part: string, props: Record<string, unknown> = {}): any {
  const element = document.createElement(`owner-base-tree-${part}`);
  setElementProps(element, props);
  return element;
}
async function fixture(props: Record<string, unknown> = {}) {
  const root = node('root', props);
  const first = node('item', { nodeKey: 'first' });
  const child = node('item', { nodeKey: 'child', parentKey: 'first' });
  const second = node('item', { nodeKey: 'second' });
  const other = node('item', { nodeKey: 'other', parentKey: 'second' });
  root.append(first, child, second, other);
  document.body.append(root);
  await flush();
  return { root, first, child, second, other, api: root.getExposes() };
}

it('retains unknown owner keys without selecting or expanding unrelated materialized items', async () => {
  const f = await fixture({ value: 'later', expandedKeys: ['later-branch'] });
  expect(f.api.value.get()).toBe('later');
  expect(f.api.getExpandedKeys()).toEqual(['later-branch']);
  for (const item of [f.first, f.child, f.second, f.other])
    expect(item.getExposes().selected.get()).toBe(false);
  expect(f.child.getExposes().hidden.get()).toBe(true);
  expect(f.api.requestValue('missing')).toBe(false);
  expect(f.api.requestExpanded('missing', true)).toBe(false);
  const added = node('item', { nodeKey: 'later' });
  f.root.append(added);
  await flush();
  expect(added.getExposes().selected.get()).toBe(true);
  expect(f.api.value.get()).toBe('later');
});

it('keeps rejected controlled requests separate from owner acceptance and controlled exit', async () => {
  const f = await fixture({ value: 'first', expandedKeys: [] });
  const changes: unknown[] = [];
  f.root.addEventListener('valueChange', (event: CustomEvent) => changes.push(event.detail));
  f.root.addEventListener('expandedChange', (event: CustomEvent) => changes.push(event.detail));
  expect(f.api.requestValue('second')).toBe(true);
  expect(f.api.requestExpanded('first', true)).toBe(true);
  expect(f.api.value.get()).toBe('first');
  expect(f.api.getExpandedKeys()).toEqual([]);
  expect(f.child.getExposes().hidden.get()).toBe(true);
  setElementProps(f.root, { value: 'second', expandedKeys: ['first'] });
  await flush();
  expect(f.second.getExposes().selected.get()).toBe(true);
  expect(f.child.getExposes().hidden.get()).toBe(false);
  setElementProps(f.root, { defaultValue: 'first', defaultExpandedKeys: [] });
  await flush();
  expect(f.api.value.get()).toBe('second');
  expect(f.api.getExpandedKeys()).toEqual(['first']);
  expect(f.api.requestValue('child')).toBe(true);
  expect(f.api.value.get()).toBe('child');
  expect(changes).toEqual([{ value: 'second' }, { expandedKeys: ['first'] }, { value: 'child' }]);
});

it('does not overwrite a newer owner expansion when a value observer synchronously updates props', async () => {
  const f = await fixture({ value: 'first', expandedKeys: [] });
  const stop = f.api.value.subscribe(() => {
    if (f.api.value.get() === 'child')
      setElementProps(f.root, { value: 'other', expandedKeys: ['second'], direction: 'rtl' });
  });
  try {
    setElementProps(f.root, { value: 'child', expandedKeys: ['first'], direction: 'ltr' });
    await flush();
    expect(f.api.value.get()).toBe('other');
    expect(f.api.getExpandedKeys()).toEqual(['second']);
    expect(f.child.getExposes().hidden.get()).toBe(true);
    expect(f.other.getExposes().hidden.get()).toBe(false);
    expect(f.other.getExposes().selected.get()).toBe(true);
    expect(f.root.getAttribute('data-pui-style')).toContain('direction-rtl');
  } finally {
    stop();
  }
});

it('keeps an absent Group relationship absent until the exact keyed target materializes', async () => {
  const f = await fixture({ expandedKeys: ['first'] });
  expect(f.first.getAttribute('aria-controls')).toBeNull();
  const unrelated = node('group', { nodeKey: 'second' });
  f.root.append(unrelated);
  await flush();
  expect(f.first.getAttribute('aria-controls')).toBeNull();
  const group = node('group', { nodeKey: 'first' });
  f.root.append(group);
  await flush();
  expect(f.first.getAttribute('aria-controls')).toBe(group.id);
  expect(group.getAttribute('aria-labelledby')).toBe(f.first.id);
  group.remove();
  await flush();
  expect(f.first.getAttribute('aria-controls')).toBeNull();
  expect(f.api.getExpandedKeys()).toEqual(['first']);
});
