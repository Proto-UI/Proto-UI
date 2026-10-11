import { describe, it, expect } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { treeRoot, treeItem, treeToggle, treeEntries } from '../src/tree';
for (const p of [treeRoot, treeItem, treeToggle])
  AdaptToWebComponent(p, { registerAs: `test-${p.name}` });
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
it('rejects duplicate, missing and cyclic hierarchy and derives visible preorder', () => {
  expect(() => treeEntries([{ key: 'x' }, { key: 'x' }], [])).toThrow();
  expect(() => treeEntries([{ key: 'x', parentKey: 'y' }], [])).toThrow();
  expect(() =>
    treeEntries(
      [
        { key: 'x', parentKey: 'y' },
        { key: 'y', parentKey: 'x' },
      ],
      []
    )
  ).toThrow();
  const entries = treeEntries([{ key: 'a' }, { key: 'b', parentKey: 'a' }, { key: 'c' }], []);
  expect(entries.map((e) => e.visible)).toEqual([true, false, true]);
  expect(treeEntries([{ key: 'a' }, { key: 'b', parentKey: 'a' }], ['a'])[1]?.level).toBe(2);
});
it('expands physical tree atoms and selects a child without conflating focus', async () => {
  const root = document.createElement('test-base-tree-root') as any;
  const a = document.createElement('test-base-tree-item') as any,
    b = document.createElement('test-base-tree-item') as any,
    toggle = document.createElement('test-base-tree-toggle') as any;
  setElementProps(a, { nodeKey: 'a' });
  setElementProps(b, { nodeKey: 'b', parentKey: 'a' });
  setElementProps(toggle, { nodeKey: 'a' });
  a.textContent = 'Parent';
  b.textContent = 'Child';
  toggle.textContent = 'Expand';
  root.append(a, toggle, b);
  document.body.append(root);
  await flush();
  expect(root.getExposes().invalid.get()).toBe(false);
  expect(b.getExposes().hidden.get()).toBe(true);
  toggle.click();
  await flush();
  expect(b.getExposes().hidden.get()).toBe(false);
  b.click();
  await flush();
  expect(root.getExposes().value.get()).toBe('b');
  expect(b.getAttribute('aria-level')).toBe('2');
  root.remove();
});
it('keeps controlled selection and expansion request-only', async () => {
  const root = document.createElement('test-base-tree-root') as any,
    a = document.createElement('test-base-tree-item') as any,
    b = document.createElement('test-base-tree-item') as any;
  setElementProps(root, { value: 'a', expandedKeys: [] });
  setElementProps(a, { nodeKey: 'a' });
  setElementProps(b, { nodeKey: 'b', parentKey: 'a' });
  root.append(a, b);
  document.body.append(root);
  await flush();
  expect(root.getExposes().requestExpanded('a', true)).toBe(true);
  expect(root.getExposes().getExpandedKeys()).toEqual([]);
  expect(root.getExposes().requestValue('b')).toBe(false);
  root.remove();
});
