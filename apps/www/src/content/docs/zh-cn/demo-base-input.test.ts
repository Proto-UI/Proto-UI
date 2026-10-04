// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import inputRoot from '@proto.ui/prototypes-base/input';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-input.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/input.mdx');

// P-BASE-INPUT-PHYSICAL-TARGET and P-BASE-INPUT-BOUNDARY: a real Base
// identity, not a renamed Shadcn recipe or a second authored native editor.
describe('Base Input documentation registration', () => {
  it('loads the actual public Base Input prototype lazily', async () => {
    expect(prototypeModules['base-input-root']).toBeTypeOf('function');
    await loadPrototype('base-input-root');
    expect(getPrototype('base-input-root')).toBe(inputRoot);
  });
  it('retains the existing Shadcn loader as an independent projection', async () => {
    await loadPrototype('shadcn-input-root');
    expect(getPrototype('shadcn-input-root')).not.toBe(inputRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers a real demo on the %s page without promoting draft scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-input');
      expect(text).toContain('P-BASE-INPUT');
      expect(text).toMatch(/draft/i);
      expect(text).toContain("'wc', 'react', 'vue', 'vue2'");
      expect(text).not.toContain('demo-shadcn-input');
    }
  );
  it('makes Base Input discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/input'");
  });
  it('admits a Base-only declarative recipe with four independently owned fields', () => {
    const recipe = (recipes['./demo-base-input.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Input recipe is missing.');
    assertDemoSpec(recipe);
    const ids: string[] = [];
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto') ids.push(node.prototypeId);
      for (const child of node.children ?? []) visit(child);
    };
    visit((recipe as any).root);
    expect(ids).toEqual(Array(4).fill('base-input-root'));
  });
  it('accepts normalized proposals once, preserves complete naming/value, and cleans up the owner', () => {
    const recipe = (
      recipes['./demo-base-input.demo.ts'] as { default: { setup: (ctx: any) => () => void } }
    ).default;
    const host = document.createElement('div');
    const controlled = document.createElement('input');
    controlled.dataset.demoRef = 'controlled';
    const sibling = document.createElement('input');
    sibling.dataset.demoRef = 'editable';
    const status = document.createElement('div');
    host.append(controlled, sibling, status);
    const writes: Array<{ ref: string; props: Record<string, any> }> = [];
    const cleanup = recipe.setup({
      host,
      refs: { controlled, status },
      api: {
        setProps(ref: string, props: Record<string, any>) {
          writes.push({ ref, props });
        },
        call() {},
        getExposes() {
          return undefined;
        },
      },
    });
    expect(writes[0]?.props).toMatchObject({
      value: 'Owner-controlled value',
      ariaLabel: 'Controlled Base Input',
    });
    const callback = writes[0]!.props.onValueChange;
    callback({ value: 'Accepted callback' });
    expect(writes[1]?.props).toMatchObject({
      value: 'Accepted callback',
      ariaLabel: 'Controlled Base Input',
    });
    controlled.dispatchEvent(new Event('input', { bubbles: true }));
    controlled.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'Accepted callback' }, bubbles: true })
    );
    sibling.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'Wrong sibling' }, bubbles: true })
    );
    expect(writes).toHaveLength(2);
    controlled.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'Accepted DOM proposal' }, bubbles: true })
    );
    expect(writes[2]?.props).toMatchObject({
      value: 'Accepted DOM proposal',
      ariaLabel: 'Controlled Base Input',
    });
    cleanup();
    callback({ value: 'Late callback' });
    controlled.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'Late DOM' }, bubbles: true })
    );
    expect(writes).toHaveLength(3);
  });
});
