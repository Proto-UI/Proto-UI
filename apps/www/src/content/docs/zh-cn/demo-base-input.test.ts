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
  it.each(['en', 'zh-cn'])('registers a real demo on the %s page', (locale) => {
    const path = docs(locale);
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('demo-base-input');
    expect(text).toContain('P-BASE-INPUT');
    expect(text).toContain("'wc', 'react', 'vue', 'vue2'");
    expect(text).not.toContain('demo-shadcn-input');
  });
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
    expect(ids.filter((id) => id === 'base-input-root')).toHaveLength(4);
    expect(ids.filter((id) => id === 'base-button')).toHaveLength(4);
    expect(ids.every((id) => id === 'base-input-root' || id === 'base-button')).toBe(true);
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
    const ownerWrites = () => writes.filter((write) => write.ref === 'controlled');
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
    expect(ownerWrites()[0]?.props).toMatchObject({
      value: 'Owner-controlled value',
      ariaLabel: 'Controlled Base Input',
    });
    const callback = ownerWrites()[0]!.props.onValueChange;
    callback({ value: 'Accepted callback' });
    expect(ownerWrites()[1]?.props).toMatchObject({
      value: 'Accepted callback',
      ariaLabel: 'Controlled Base Input',
    });
    // This unit mock has no adapter. Bare DOM events must not turn into an
    // application bridge; the real four-runtime browser journey covers delivery.
    controlled.dispatchEvent(new Event('input', { bubbles: true }));
    controlled.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'DOM proposal' }, bubbles: true })
    );
    sibling.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'Wrong sibling' }, bubbles: true })
    );
    expect(ownerWrites()).toHaveLength(2);
    controlled.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'Raw DOM proposal' }, bubbles: true })
    );
    // This owner accepts the public normalized callback once. Raw host events
    // are not a second proposal channel, including distinct synthetic values.
    expect(ownerWrites()).toHaveLength(2);
    callback({ value: 'Accepted second callback' });
    expect(ownerWrites()[2]?.props).toMatchObject({
      value: 'Accepted second callback',
      ariaLabel: 'Controlled Base Input',
    });
    cleanup();
    callback({ value: 'Late callback' });
    controlled.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'Late DOM' }, bubbles: true })
    );
    expect(ownerWrites()).toHaveLength(3);
  });
  it('forwards reset arguments to the public method and reports exposed results until cleanup', () => {
    const recipe = (
      recipes['./demo-base-input.demo.ts'] as { default: { setup: (ctx: any) => () => void } }
    ).default;
    const resetStatus = document.createElement('div');
    const writes: Array<{ ref: string; props: Record<string, any> }> = [];
    const callbacks = new Map<string, Record<string, any>>();
    const calls: unknown[][] = [];
    const cleanup = recipe.setup({
      refs: { resetStatus },
      api: {
        setProps(ref: string, props: Record<string, any>) {
          writes.push({ ref, props });
          callbacks.set(ref, { ...callbacks.get(ref), ...props });
        },
        call(...args: unknown[]) {
          calls.push(args);
          return args[0] !== 'controlled';
        },
        getExposes(ref: string) {
          return {
            value: {
              get: () =>
                ref === 'controlled' ? 'Owner-controlled value' : 'Reported public value',
            },
          };
        },
      },
    });
    callbacks.get('setDefault')!.onClick();
    expect(writes.at(-1)).toEqual({ ref: 'editable', props: { defaultValue: 'Latest default' } });
    expect(calls).toHaveLength(0);
    expect(resetStatus.textContent).toBe(
      'Default changed to "Latest default"; current value: "Reported public value"'
    );
    callbacks.get('resetDefault')!.onClick();
    expect(calls.at(-1)).toEqual(['editable', 'resetValue']);
    expect(resetStatus.textContent).toBe(
      'Reset accepted: true; value: "Reported public value"; editing events: 0'
    );
    callbacks.get('resetSample')!.onClick();
    expect(calls.at(-1)).toEqual(['editable', 'resetValue', 'New\r\nvalue']);
    callbacks.get('resetControlled')!.onClick();
    expect(calls.at(-1)).toEqual(['controlled', 'resetValue', 'Replacement attempt']);
    expect(resetStatus.textContent).toBe(
      'Reset accepted: false; value: "Owner-controlled value"; editing events: 0'
    );
    cleanup();
    const lastStatus = resetStatus.textContent;
    const lastWrites = writes.length;
    for (const ref of ['setDefault', 'resetDefault', 'resetSample', 'resetControlled']) {
      callbacks.get(ref)!.onClick();
    }
    expect(calls).toHaveLength(3);
    expect(writes).toHaveLength(lastWrites);
    expect(resetStatus.textContent).toBe(lastStatus);
  });
});
