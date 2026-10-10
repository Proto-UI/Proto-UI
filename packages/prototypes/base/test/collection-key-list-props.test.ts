import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { treeRoot, treeItem } from '../src/tree';
import { dataTableRoot, dataTableRow } from '../src/data-table';
for (const proto of [treeRoot, treeItem, dataTableRoot, dataTableRow])
  AdaptToWebComponent(proto, { registerAs: `keys-${proto.name}` });
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let n = 0; n < 24; n++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
const node = (name: string, props = {}) => {
  const el = document.createElement(`keys-base-${name}`) as any;
  setElementProps(el, props);
  return el;
};
function fixture(component: 'tree' | 'data-table', props: Record<string, unknown>) {
  const extras = component === 'data-table' ? { rows: [{ id: 'a', label: 'A' }] } : {};
  const root = node(`${component}-root`, { ...extras, ...props });
  roots.push(root);
  const item = node(
    component === 'tree' ? 'tree-item' : 'data-table-row',
    component === 'tree' ? { nodeKey: 'a' } : { index: 0 }
  );
  root.append(item);
  if (component === 'tree') root.append(node('tree-item', { nodeKey: 'b', parentKey: 'a' }));
  return {
    root,
    item,
    update: (next: Record<string, unknown>) => setElementProps(root, { ...extras, ...next }),
    read: () =>
      component === 'tree'
        ? root.getExposes().getExpandedKeys()
        : item.getExposes().selected.get()
          ? ['a']
          : [],
    request: () =>
      component === 'tree'
        ? root.getExposes().requestExpanded('a', true)
        : root.getExposes().requestSelection('a'),
  };
}
for (const [component, controlled, defaults] of [
  ['tree', 'expandedKeys', 'defaultExpandedKeys'],
  ['data-table', 'selectedKeys', 'defaultSelectedKeys'],
] as const) {
  for (const key of [controlled, defaults])
    for (const invalid of [{}, [23], ['a', null]])
      it(`${component} safely resolves ${key}=${JSON.stringify(invalid)} on mount and later updates`, async () => {
        const f = fixture(component, { [key]: invalid });
        expect(() => document.body.append(f.root)).not.toThrow();
        await flush();
        expect(f.read()).toEqual([]);
        expect(() => f.update({ [key]: ['a'] })).not.toThrow();
        await flush();
        expect(f.read()).toEqual(key === controlled ? ['a'] : []);
        if (key === defaults) {
          expect(f.request()).toBe(true);
          await flush();
          expect(f.read()).toEqual(['a']);
        }
        expect(() => f.update({ [key]: invalid })).not.toThrow();
        await flush();
        expect(f.read()).toEqual(['a']);
      });
  it(`${component} keeps invalid provided input controlled and never adopts the default or a request`, async () => {
    const f = fixture(component, { [controlled]: {}, [defaults]: ['a'] });
    expect(() => document.body.append(f.root)).not.toThrow();
    await flush();
    expect(f.read()).toEqual([]);
    expect(f.request()).toBe(true);
    await flush();
    expect(f.read()).toEqual([]);
    f.update({ [controlled]: ['a'] });
    await flush();
    expect(f.read()).toEqual(['a']);
    expect(() => f.update({ [controlled]: {}, [defaults]: [] })).not.toThrow();
    await flush();
    expect(f.read()).toEqual(['a']);
    f.update({ [controlled]: [] });
    await flush();
    expect(f.read()).toEqual([]);
    expect(() => f.update({ [controlled]: {} })).not.toThrow();
    await flush();
    expect(f.read()).toEqual([]);
  });
  it(`${component} accepts legal string arrays and keeps default updates initialization-only`, async () => {
    const f = fixture(component, { [defaults]: ['a'] });
    document.body.append(f.root);
    await flush();
    expect(f.read()).toEqual(['a']);
    f.update({ [defaults]: [] });
    await flush();
    expect(f.read()).toEqual(['a']);
    expect(() => f.update({ [defaults]: {} })).not.toThrow();
    await flush();
    expect(f.read()).toEqual(['a']);
  });
}
