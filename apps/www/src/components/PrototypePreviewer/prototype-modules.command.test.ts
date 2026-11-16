import { describe, expect, it, vi } from 'vitest';
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

it('shares in-flight registration for the same Accordion Prototype', async () => {
  const id = 'base-accordion-trigger';
  const loader = vi.spyOn(prototypeModules, id);
  try {
    await expect(Promise.all([loadPrototype(id), loadPrototype(id)])).resolves.toEqual([
      true,
      true,
    ]);
    expect(loader).toHaveBeenCalledOnce();
    expect(getPrototype(id).name).toBe(id);
  } finally {
    loader.mockRestore();
  }
});

it('releases failed registration so the next caller can try again', async () => {
  const id = 'base-accordion-heading';
  const loader = vi.spyOn(prototypeModules, id).mockRejectedValueOnce(new Error('first load'));
  try {
    const outcomes = await Promise.allSettled([loadPrototype(id), loadPrototype(id)]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'rejected']);
    await expect(loadPrototype(id)).resolves.toBe(true);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(getPrototype(id).name).toBe(id);
  } finally {
    loader.mockRestore();
  }
});
