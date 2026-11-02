import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import { collectPrototypeIds, type DemoRuntimeApi, type DemoSpec } from './demo-types';
import type { RuntimeId } from './runtimes/ids';

// Execute each actual Astro DemoSpec, including setup, rather than a copied
// counter. Material capture, CSS, physical input and focus remain browser tests.
function fixtureDemo(page: string, family: string, runtime: RuntimeId): DemoSpec {
  const file = `apps/www/src/pages/en/test/${page}.astro`;
  const source = readFileSync(file, 'utf8').match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!source) throw new Error(`Missing module script: ${file}`);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const demos: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(ast) === 'demo' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    )
      demos.push(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (demos.length !== 1) throw new Error(`Expected one actual DemoSpec: ${file}`);
  const code = ts.transpileModule(`(${demos[0].getText(ast)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // Evaluate in the host realm. A fresh VM context gives every demo node that
  // realm's Object.prototype, and the demo node contract requires plain host
  // objects, so a cross-realm node is rejected as a non-plain object.
  const factory = new Function(
    'document',
    'CustomEvent',
    'family',
    'runtime',
    'isBootstrap',
    'key',
    'updates',
    `return ${code}`
  ) as (
    document: Document,
    customEvent: typeof CustomEvent,
    family: string,
    runtime: RuntimeId,
    isBootstrap: boolean,
    key: string,
    updates: Map<string, unknown>
  ) => DemoSpec;
  return factory(
    document,
    CustomEvent,
    family,
    runtime,
    family === 'bootstrap-2-3-2',
    `${family}-${runtime}`,
    new Map()
  );
}

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

const cases = [
  ['new-projection-families', 'bootstrap-2-3-2', 'default'],
  ['new-projection-families', 'liquid-glass', 'default'],
  ['liquid-glass-material', 'liquid-glass', 'regular'],
] as const;

describe('Astro fixture callback ownership', () => {
  for (const [page, family, ref] of cases) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      it(`${page}/${family}/${runtime} counts once, patches props and retires old callbacks`, async () => {
        const output = document.createElement('output');
        output.dataset.count = `${family}-${runtime}`;
        output.dataset.activations = runtime;
        output.value = '0 activations';
        const host = document.createElement('div');
        document.body.append(host, output);
        const demo = fixtureDemo(page, family, runtime);
        const ids = new Set<string>();
        collectPrototypeIds(demo.root, ids);
        await loadPrototypes([...ids]);
        let refs!: Record<string, HTMLElement>;
        let api!: DemoRuntimeApi;
        const mount = () =>
          renderDemo({
            runtime,
            host,
            demo: {
              ...demo,
              setup(context) {
                refs = context.refs;
                api = context.api;
                return demo.setup?.(context);
              },
            },
          });
        const rendered = await mount();
        cleanups.push(() => rendered.destroy());
        await flush();
        const button = refs[ref];
        const semanticClicks: unknown[] = [];
        button.addEventListener('click', (event) => {
          if (event instanceof CustomEvent) semanticClicks.push(event.detail);
        });
        button.click();
        await flush();
        // Attribute the WC red to duplicate consumers, not two Button events.
        if (runtime === 'wc') expect(semanticClicks).toHaveLength(1);
        expect(output.value).toBe('1 activations');
        button.click();
        await flush();
        expect(output.value).toBe('2 activations');
        for (const disabled of [true, false, true, false]) {
          api.setProps(ref, { disabled });
          await vi.waitFor(() =>
            expect(button.getAttribute('aria-disabled')).toBe(String(disabled))
          );
          button.click();
          await flush();
        }
        expect(output.value).toBe('4 activations');
        await rendered.destroy();
        button.dispatchEvent(new CustomEvent('click', { detail: {}, bubbles: true }));
        expect(output.value).toBe('4 activations');
        output.value = '0 activations';
        const replacement = await mount();
        cleanups.push(() => replacement.destroy());
        await flush();
        button.dispatchEvent(new CustomEvent('click', { detail: {}, bubbles: true }));
        expect(output.value).toBe('0 activations');
        refs[ref].click();
        await flush();
        expect(output.value).toBe('1 activations');
      });
    }
  }
});
