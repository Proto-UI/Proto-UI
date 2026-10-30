import { describe, expect, it } from 'vitest';
import { collectPrototypeIds, type DemoSpec } from './demo-types';
import { loadPrototype, loadPrototypes, prototypeModules } from './prototype-modules';
import { getPrototype } from './registry';

// Real loader imports and registry, not a manually registered substitute.
// Synthetic DOM loader evidence only; does not establish native Search behavior.
describe.each(['shadcn', 'brutalist'] as const)('%s Command loader closure', (family) => {
  it('loads declared future Item and Empty parts while the authored slot is empty', async () => {
    const ids = ['root', 'input', 'content', 'item', 'empty', 'dialog-content'].map(
      (part) => `${family}-command-${part}`
    );
    const demo: DemoSpec = {
      type: 'demo',
      root: {
        kind: 'box',
        ref: 'future',
        dynamicChildren: { prototypeIds: ids },
        children: [],
      },
    };
    const declared = new Set<string>();
    collectPrototypeIds(demo.root, declared);
    const closure = [...declared];
    expect(closure).toEqual(ids);
    for (const id of ids) expect(prototypeModules[id]).toBeTypeOf('function');
    await loadPrototypes(closure);
    for (const id of ids) expect(getPrototype(id).name).toBe(id);
    expect(demo.root).toMatchObject({ children: [] });
  });
  it('fails preparation for a declared identity without a real loader', async () => {
    const missing = `${family}-command-no-such-part`;
    expect(prototypeModules).not.toHaveProperty(missing);
    await expect(loadPrototype(missing)).rejects.toThrow(missing);
  });
});
