// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  radioGroupRoot,
  radioGroupItem,
  radioGroupIndicator,
} from '@proto.ui/prototypes-base/radio-group';
import {
  loadPrototype,
  prototypeModules,
} from '../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-radio-group.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/radio-group.mdx');

// P-BASE-RADIO-GROUP value owner + P-BASE-RADIO-GROUP-INDICATOR derived facts:
// the demo uses real Base root/item/indicator identities, not a renamed Shadcn recipe.
describe('Base Radio Group documentation registration', () => {
  it('loads the actual public Base Radio Group prototypes lazily', async () => {
    expect(prototypeModules['base-radio-group-root']).toBeTypeOf('function');
    await loadPrototype('base-radio-group-root');
    expect(getPrototype('base-radio-group-root')).toBe(radioGroupRoot);
    await loadPrototype('base-radio-group-item');
    expect(getPrototype('base-radio-group-item')).toBe(radioGroupItem);
    await loadPrototype('base-radio-group-indicator');
    expect(getPrototype('base-radio-group-indicator')).toBe(radioGroupIndicator);
  });
  it('retains the existing Shadcn radio group as an independent projection', async () => {
    await loadPrototype('shadcn-radio-group-root');
    expect(getPrototype('shadcn-radio-group-root')).not.toBe(radioGroupRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers a real demo on the %s page without promoting beyond the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-radio-group');
      expect(text).toContain('radio-group-root');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
      expect(text).not.toContain('demo-shadcn-radio-group');
    }
  );
  it('makes Base Radio Group discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/radio-group'");
  });
  it('admits a Base-only declarative recipe with one root, three items and one indicator per item', () => {
    const recipe = (
      recipes['./demo-base-radio-group.demo.ts'] as { default?: DemoSpec } | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Radio Group recipe is missing.');
    assertDemoSpec(recipe);
    const roots: string[] = [];
    const items: string[] = [];
    const indicators: string[] = [];
    const refs: string[] = [];
    const visit = (node: any, underRoot: boolean, underItem: boolean) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto') {
        if (node.prototypeId === 'base-radio-group-root') roots.push(node.prototypeId);
        if (node.prototypeId === 'base-radio-group-item' && underRoot) items.push(node.prototypeId);
        if (node.prototypeId === 'base-radio-group-indicator' && underItem)
          indicators.push(node.prototypeId);
      }
      if (typeof node.ref === 'string') refs.push(node.ref);
      const inRoot = underRoot || node.prototypeId === 'base-radio-group-root';
      const inItem = underItem || node.prototypeId === 'base-radio-group-item';
      for (const child of node.children ?? []) visit(child, inRoot, inItem);
    };
    visit((recipe as any).root, false, false);
    expect(roots).toEqual(['base-radio-group-root']);
    expect(items).toEqual(Array(3).fill('base-radio-group-item'));
    expect(indicators).toEqual(Array(3).fill('base-radio-group-indicator'));
    expect(refs).toContain('group');
    expect(refs).toContain('valueLabel');
  });
  it('publishes the current value to the label and tears down the observer and listener', () => {
    const recipe = (
      recipes['./demo-base-radio-group.demo.ts'] as {
        default: { setup: (ctx: any) => (() => void) | undefined };
      }
    ).default;
    const host = document.createElement('div');
    const valueLabel = document.createElement('span');
    valueLabel.textContent = 'none';
    const current = { value: 'express' };
    let getExposesCalls = 0;
    const api = {
      getExposes() {
        getExposesCalls += 1;
        return { value: { get: () => current.value } };
      },
      setProps() {},
      call() {},
    };
    const realRAF = globalThis.requestAnimationFrame;
    const realCancel = globalThis.cancelAnimationFrame;
    // Run the scheduled render synchronously so the assertion does not depend on a real frame.
    globalThis.requestAnimationFrame = ((cb: (t: number) => void) => {
      cb(0);
      return 0;
    }) as typeof realRAF;
    globalThis.cancelAnimationFrame = (() => {}) as typeof realCancel;
    try {
      const cleanup = recipe.setup({ host, refs: { valueLabel }, api });
      expect(cleanup).toBeTypeOf('function');
      expect(valueLabel.textContent).toBe('express');
      current.value = 'next-day';
      host.dispatchEvent(new Event('valueChange', { bubbles: true }));
      expect(valueLabel.textContent).toBe('next-day');
      const callsAfterRender = getExposesCalls;
      cleanup!();
      host.dispatchEvent(new Event('valueChange', { bubbles: true }));
      expect(valueLabel.textContent).toBe('next-day');
      expect(getExposesCalls).toBe(callsAfterRender);
    } finally {
      globalThis.requestAnimationFrame = realRAF;
      globalThis.cancelAnimationFrame = realCancel;
    }
  });
});
