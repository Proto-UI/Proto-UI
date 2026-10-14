import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parse } from 'yaml';
import { expect, it, vi } from 'vitest';
import demo from '../demo_components/button/demo-button-ghost.demo';
import {
  PRODUCTION_BROWSER_SUITES,
  PRODUCTION_BROWSER_OWNERS,
  assertBrowserInventory,
  discoverBrowserSuites,
} from '../../../../../../scripts/test/runtime-test-plan.mjs';

const fixturePath = 'apps/www/src/pages/en/test/button-ghost/[runtime].astro';
const fixture = readFileSync(fixturePath, 'utf8');
const script = fixture.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Missing actual component fixture client script.');
const ast = ts.createSourceFile(fixturePath, script, ts.ScriptTarget.Latest, true);
const client = ts.transpileModule(
  ast.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(ast))
    .join('\n'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
// Execute the authored fixture owner, not a copied lifecycle. Controlled loader
// promises verify fixture cleanup only; production input/paint remains native CI.
function owner() {
  const loaded = deferred<void>();
  const mounted = deferred<{ destroy(): void | Promise<void> }>();
  const host = document.createElement('div');
  host.dataset.ghostComponentHost = 'react';
  host.dataset.mountState = 'pending';
  const error = document.createElement('p');
  const handlers: Array<() => void> = [];
  const renderDemo = vi.fn((_options: unknown) => mounted.promise),
    loadPrototypes = vi.fn(() => loaded.promise),
    report = vi.fn();
  runInNewContext(client, {
    document: {
      querySelector: (selector: string) =>
        selector === '[data-ghost-component-host]' ? host : error,
    },
    window: {
      addEventListener: (name: string, callback: () => void, options: { once: boolean }) => {
        expect(name).toBe('pagehide');
        expect(options.once).toBe(true);
        handlers.push(callback);
      },
    },
    demo,
    renderDemo,
    loadPrototypes,
    console: { error: report },
  });
  return {
    loaded,
    mounted,
    host,
    error,
    renderDemo,
    loadPrototypes,
    report,
    retire: () => handlers[0](),
  };
}
it('passes the unchanged real DemoSpec to the runtime and retires a settled mount once', async () => {
  const f = owner(),
    destroy = vi.fn();
  f.loaded.resolve();
  await flush();
  expect(f.loadPrototypes).toHaveBeenCalledWith(['shadcn-button']);
  const options = f.renderDemo.mock.calls[0][0] as unknown as {
    runtime: string;
    demo: unknown;
    host: HTMLElement;
    isCurrent(): boolean;
  };
  expect(options.runtime).toBe('react');
  expect(options.demo).toBe(demo);
  expect(options.host).toBe(f.host);
  expect(options.isCurrent()).toBe(true);
  f.mounted.resolve({ destroy });
  await flush();
  expect(f.host.dataset.mountState).toBe('ready');
  f.retire();
  f.retire();
  await flush();
  expect(f.host.dataset.mountState).toBe('retired');
  expect(options.isCurrent()).toBe(false);
  expect(destroy).toHaveBeenCalledTimes(1);
});
it('does not start a renderer after retirement during prototype loading', async () => {
  const f = owner();
  f.retire();
  f.loaded.resolve();
  await flush();
  expect(f.renderDemo).not.toHaveBeenCalled();
  expect(f.host.dataset.mountState).toBe('retired');
});
it('destroys a late mount instead of publishing stale ready', async () => {
  const f = owner(),
    destroy = vi.fn();
  f.loaded.resolve();
  await flush();
  f.retire();
  f.mounted.resolve({ destroy });
  await flush();
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(f.host.dataset.mountState).toBe('retired');
});
it.each(['throw', 'reject'] as const)('marks retired before cleanup can %s', async (kind) => {
  const f = owner();
  let stateDuringCleanup: string | undefined;
  const destroy = vi.fn(() => {
    stateDuringCleanup = f.host.dataset.mountState;
    if (kind === 'throw') throw new Error('cleanup');
    return Promise.reject(new Error('cleanup'));
  });
  f.loaded.resolve();
  await flush();
  f.mounted.resolve({ destroy });
  await flush();
  f.retire();
  await flush();
  expect(stateDuringCleanup).toBe('retired');
  expect(f.host.dataset.mountState).toBe('retired');
  expect(f.report).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalledTimes(1);
});
it('uses four static public faces and the existing production theme/reset/generated CSS chain', () => {
  expect(fixture).toContain("['wc', 'react', 'vue', 'vue2'].map");
  expect(fixture).toContain('params: { runtime }');
  expect(fixture).toContain('<ThemeProvider />');
  expect(fixture).toContain("import '../../../../styles/global.css'");
  expect(fixture).toContain(
    "import demo from '../../../../content/docs/demo_components/button/demo-button-ghost.demo'"
  );
  expect(fixture).toContain('Independent component acceptance');
  expect(fixture).toContain('Header navigation excluded');
  for (const forbidden of [
    'PrototypePreviewer.astro',
    'RuntimePreviewSurface',
    'setProps(',
    'localStorage.setItem',
    'document.documentElement.dataset.theme =',
    '--pui-accent:',
    '[data-pui-root]',
  ])
    expect(fixture).not.toContain(forbidden);
  const global = readFileSync('apps/www/src/styles/global.css', 'utf8');
  expect(global).toContain("@import './tailwindcss.css'");
  expect(global).toContain("@import './proto-ui-style.css'");
});
it('adds an independent owner while preserving the public workflow and its eight-case path', () => {
  const suite = 'apps/www/src/content/docs/zh-cn/finf-button-ghost-component.browser.test.ts',
    workflowPath = '.github/workflows/finf-button-ghost-component-evidence.yml';
  const publicSuite = 'apps/www/src/content/docs/zh-cn/finf-button-ghost.browser.test.ts',
    publicWorkflow = '.github/workflows/finf-button-ghost-evidence.yml';
  expect(PRODUCTION_BROWSER_SUITES).toContain(suite);
  expect(PRODUCTION_BROWSER_SUITES).toContain(publicSuite);
  expect(PRODUCTION_BROWSER_OWNERS[suite]).toBe(workflowPath);
  expect(PRODUCTION_BROWSER_OWNERS[publicSuite]).toBe(publicWorkflow);
  expect(() => assertBrowserInventory(discoverBrowserSuites(process.cwd()))).not.toThrow();
  const workflowText = readFileSync(workflowPath, 'utf8'),
    workflow = parse(workflowText),
    publicText = readFileSync(publicWorkflow, 'utf8');
  expect(workflow.permissions).toEqual({ contents: 'read' });
  expect(workflow.concurrency['cancel-in-progress']).toBe(false);
  expect(workflowText).toContain(suite);
  expect(workflowText).not.toContain(publicSuite);
  expect(workflowText).toContain('assert.equal(report.numPassedTests, 8)');
  expect(workflowText).toContain("receipt.evidenceScope, 'independent-component'");
  expect(publicText).toContain('pull_request:');
  expect(publicText).toContain(publicSuite);
  expect(publicText).toContain('assert.equal(report.numTotalTests, 8)');
  const source = readFileSync(suite, 'utf8');
  for (const required of [
    'chromiumSandbox: true',
    "process.env.GITHUB_ACTIONS !== 'true'",
    "const evidenceScope = 'independent-component'",
    'enabledHit.hasArea',
    'disabledHit.hitExists',
  ])
    expect(source).toContain(required);
  for (const forbidden of [
    '--no-sandbox',
    'force: true',
    'localStorage.setItem',
    'setProps(',
    'selectPublicPanel',
    'selectRuntime(',
  ])
    expect(source).not.toContain(forbidden);
});
