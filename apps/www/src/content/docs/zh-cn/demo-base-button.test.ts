// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { button } from '@proto.ui/prototypes-base/button';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import {
  assertDemoSpec,
  type DemoChild,
  type DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-button.demo.ts', { eager: true });

describe('Base Button documentation registration', () => {
  it('loads the actual public Base Button prototype lazily', async () => {
    expect(prototypeModules['base-button']).toBeTypeOf('function');
    await loadPrototype('base-button');
    expect(getPrototype('base-button')).toBe(button);
  });
  it('admits a Base-only declarative recipe with exactly two button protos', () => {
    const recipe = (recipes['./demo-base-button.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Button recipe is missing.');
    assertDemoSpec(recipe);
    const root = recipe.root;
    expect(root.kind).toBe('box');
    let buttonCount = 0;
    const countButtons = (node: DemoChild) => {
      if (typeof node === 'string' || node.kind === 'text') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-button') buttonCount += 1;
      for (const child of node.children ?? []) countButtons(child);
    };
    countButtons(root);
    expect(buttonCount).toBe(2);
  });
});
