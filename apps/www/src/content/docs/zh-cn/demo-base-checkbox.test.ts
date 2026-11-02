// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkboxRoot } from '@proto.ui/prototypes-base/checkbox';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-checkbox-controlled-states.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/checkbox.mdx');

// P-BASE-CHECKBOX-ROOT-SEMANTIC-OWNER and P-BASE-CHECKBOX-INDICATOR-PRESENTATIONAL-A11Y:
// a real Base root/indicator identity, not a renamed Shadcn recipe.
describe('Base Checkbox documentation registration', () => {
  it('loads the actual public Base Checkbox root lazily', async () => {
    expect(prototypeModules['base-checkbox-root']).toBeTypeOf('function');
    await loadPrototype('base-checkbox-root');
    expect(getPrototype('base-checkbox-root')).toBe(checkboxRoot);
  });
  it('retains the existing Shadcn checkbox as an independent projection', async () => {
    await loadPrototype('shadcn-checkbox-root');
    expect(getPrototype('shadcn-checkbox-root')).not.toBe(checkboxRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers a real demo on the %s page without promoting the WC-only scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-checkbox');
      expect(text).toContain('base-checkbox-root');
      expect(text).toContain("runtimes={['wc']}");
      expect(text).not.toContain('demo-shadcn-checkbox');
    }
  );
  it('makes Base Checkbox discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/checkbox'");
  });
  it('admits a Base-only declarative recipe with a root and one indicator per example', () => {
    const recipe = (
      recipes['./demo-base-checkbox-controlled-states.demo.ts'] as
        | { default?: DemoSpec }
        | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Checkbox recipe is missing.');
    assertDemoSpec(recipe);
    const roots: string[] = [];
    const indicators: string[] = [];
    const visit = (node: any, underRoot: boolean) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto') {
        if (node.prototypeId === 'base-checkbox-root') roots.push(node.prototypeId);
        if (node.prototypeId === 'base-checkbox-indicator' && underRoot)
          indicators.push(node.prototypeId);
      }
      const inRoot = underRoot || node.prototypeId === 'base-checkbox-root';
      for (const child of node.children ?? []) visit(child, inRoot);
    };
    visit((recipe as any).root, false);
    expect(roots).toEqual(Array(5).fill('base-checkbox-root'));
    expect(indicators).toEqual(Array(5).fill('base-checkbox-indicator'));
  });
  it('accepts controlled checked/indeterminate proposals, rejects malformed ones, and cleans up', () => {
    const recipe = (
      recipes['./demo-base-checkbox-controlled-states.demo.ts'] as {
        default: { setup: (ctx: any) => () => void };
      }
    ).default;
    const host = document.createElement('div');
    const controlled = document.createElement('button');
    controlled.dataset.demoRef = 'controlled';
    const status = document.createElement('div');
    host.append(controlled, status);
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
    expect(writes[0]?.props).toMatchObject({ checked: true, indeterminate: false });
    expect(writes[0]?.props.onCheckedChange).toBeTypeOf('function');
    expect(writes[0]?.props.onIndeterminateChange).toBeTypeOf('function');
    const onCheckedChange = writes[0]!.props.onCheckedChange;
    const onIndeterminateChange = writes[0]!.props.onIndeterminateChange;
    onCheckedChange({ checked: false, indeterminate: false });
    expect(writes[1]?.props).toMatchObject({ checked: false, indeterminate: false });
    onCheckedChange({ checked: 'not-a-boolean', indeterminate: false });
    onCheckedChange(null);
    expect(writes).toHaveLength(2);
    onIndeterminateChange({ indeterminate: true });
    expect(writes[2]?.props).toMatchObject({ checked: false, indeterminate: true });
    onIndeterminateChange({ indeterminate: 'not-a-boolean' });
    expect(writes).toHaveLength(3);
    onCheckedChange({ checked: true, indeterminate: false });
    expect(writes[3]?.props).toMatchObject({ checked: true, indeterminate: false });
    cleanup();
    onCheckedChange({ checked: false, indeterminate: false });
    onIndeterminateChange({ indeterminate: true });
    expect(writes).toHaveLength(4);
  });
});
