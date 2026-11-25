import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const producer = (name: string) =>
  [
    "import { defineAsHook } from '@proto.ui/core';",
    'export const useFacts = defineAsHook({',
    "name: '" + name + "',",
    "setup(def) { const ready = def.state.bool('ready', false); def.expose.state('ready', ready); }",
    '});',
  ].join('\n');
const paint = [
  "import { tw } from '@proto.ui/core';",
  'export function paint(host, state, token) {',
  'host.rule({when:w=>w.state(state.ready).eq(true),intent:i=>i.feedback.style.use(tw(token))});',
  '}',
].join('\n');
const imports = [
  "import { definePrototype } from '@proto.ui/core';",
  "import { useFacts as alpha } from './alpha';",
  "import { useFacts as beta } from './beta';",
  "import { paint } from './visual';",
];
const calls = (argument = 'api') =>
  'paint(' +
  argument +
  ", alpha().stateHandles, 'bg-primary'); " +
  'paint(' +
  argument +
  ", beta().stateHandles, 'text-primary');";

async function withSource(
  body: string,
  run: (folder: string, files: string[], source: ts.SourceFile) => void | Promise<void>,
  canonicalImport = true
): Promise<void> {
  const folder = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-setup-capability-')));
  try {
    await writeFile(
      path.join(folder, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    const texts: Record<string, string> = {
      'alpha.ts': producer('alpha'),
      'beta.ts': producer('beta'),
      'visual.ts': paint,
      'consumer.proto.ts': [...(canonicalImport ? imports : imports.slice(1)), body].join('\n'),
    };
    const files: string[] = [];
    for (const [name, text] of Object.entries(texts)) {
      const file = path.join(folder, name);
      await writeFile(file, text);
      files.push(file);
    }
    const file = path.join(folder, 'consumer.proto.ts');
    await run(
      folder,
      files,
      ts.createSourceFile(file, texts['consumer.proto.ts'], ts.ScriptTarget.Latest, true)
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

function resolveBeta(source: ts.SourceFile) {
  const summary = createHookSourceSummaryContext();
  summary.registerSource(source);
  let target: ts.CallExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'beta'
    )
      target = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(target).toBeDefined();
  return summary.resolve(target!, source);
}

describe('source-known helper setup capabilities', () => {
  it('retains a distinct later owner after a native first parameter is forwarded to a helper', async () => {
    await withSource(
      "export default definePrototype({name:'two', setup(api) { " + calls() + ' }});',
      (folder, _files, source) => {
        const resolved = resolveBeta(source);
        expect(resolved.matched).toBe(true);
        expect(resolved.value.kind).toBe('result');
        if (resolved.value.kind !== 'result') throw new Error('missing beta result');
        expect(resolved.value.name).toBe('beta');
        expect(resolved.value.producer.file).toBe(path.join(folder, 'beta.ts'));
        expect(resolved.value.stateHandles.get('ready')?.owner.file).toBe(
          path.join(folder, 'beta.ts')
        );
      }
    );
  });

  it('keeps a named body shared only by canonical setup configurations', async () => {
    await withSource(
      'function body(api) { ' +
        calls() +
        " } definePrototype({name:'first', setup:body}); definePrototype({name:'second', setup:body});",
      (folder, _files, source) => {
        const resolved = resolveBeta(source);
        expect(resolved.value.kind).toBe('result');
        if (resolved.value.kind !== 'result') throw new Error('missing beta result');
        expect(resolved.value.producer.file).toBe(path.join(folder, 'beta.ts'));
      }
    );
  });

  it.each([
    [
      'named expression',
      'const body = function inner(api) { ' +
        calls() +
        " }; definePrototype({name:'two', setup:body});",
    ],
    [
      'bound arrow',
      'const body = (api) => { ' + calls() + " }; definePrototype({name:'two', setup:body});",
    ],
    ['inline arrow', "definePrototype({name:'two', setup:(api)=>{ " + calls() + ' }});'],
  ])('retains the unchanged Core parameter for a canonical %s', async (_name, body) => {
    await withSource(body, (folder, _files, source) => {
      const resolved = resolveBeta(source);
      expect(resolved.value.kind).toBe('result');
      if (resolved.value.kind !== 'result') throw new Error('missing beta result');
      expect(resolved.value.producer.file).toBe(path.join(folder, 'beta.ts'));
    });
  });

  it('emits both independently authored rule variants through the formal collector', async () => {
    await withSource(
      "export default definePrototype({name:'two', setup(api) { " + calls() + ' }});',
      async (_folder, files) => {
        const tokens = await collectProtoStyleTokensFromFiles(files);
        expect(tokens).toContain('data-[ready]:bg-primary');
        expect(tokens).toContain('data-[ready]:text-primary');
      }
    );
  });

  it.each([
    [
      'foreign actual argument',
      "export default definePrototype({name:'two', setup(api) { paint(foreign, alpha().stateHandles, 'bg-primary'); paint(api, beta().stateHandles, 'text-primary'); }});",
      true,
    ],
    ['ordinary setup name', 'export function setup(api) { ' + calls() + ' }', true],
    [
      'setup binding reassignment',
      "export default definePrototype({name:'two', setup(api) { api = foreign; " +
        calls() +
        ' }});',
      true,
    ],
    [
      'block shadow of the setup parameter',
      "export default definePrototype({name:'two', setup(api) { { const api = foreign; " +
        calls() +
        ' } }});',
      true,
    ],
    [
      'closure assignment to the setup parameter',
      "export default definePrototype({name:'two', setup(api) { const replace=()=>{api=foreign;}; replace(); " +
        calls() +
        ' }});',
      true,
    ],
    [
      'lookalike definePrototype binding',
      "function definePrototype(config) { return config; } export default definePrototype({name:'two', setup(api) { " +
        calls() +
        ' }});',
      false,
    ],
    [
      'canonical setup also called as an ordinary function',
      'function body(api) { ' +
        calls() +
        " } definePrototype({name:'two', setup:body}); body(foreign);",
      true,
    ],
    [
      'canonical setup body stored through an alias',
      'function body(api) { ' +
        calls() +
        " } definePrototype({name:'two', setup:body}); const alias=body; alias(foreign);",
      true,
    ],
    [
      'canonical setup body stored in an object',
      'function body(api) { ' +
        calls() +
        " } definePrototype({name:'two', setup:body}); const stored={body}; stored.body(foreign);",
      true,
    ],
    [
      'canonical setup body passed as a callback',
      'function body(api) { ' +
        calls() +
        " } definePrototype({name:'two', setup:body}); consume(body);",
      true,
    ],
    [
      'canonical setup body returned by another function',
      'function body(api) { ' +
        calls() +
        " } definePrototype({name:'two', setup:body}); function escape(){return body;}",
      true,
    ],
    [
      'canonical setup body exported directly',
      'export function body(api) { ' + calls() + " } definePrototype({name:'two', setup:body});",
      true,
    ],
    [
      'canonical setup body exported by a specifier',
      'function body(api) { ' +
        calls() +
        " } definePrototype({name:'two', setup:body}); export {body};",
      true,
    ],
    [
      'named function expression keeps its outer body binding',
      'const body = function inner(api) { ' +
        calls() +
        " }; definePrototype({name:'two', setup:body}); body(foreign);",
      true,
    ],
    [
      'named function expression exported through its outer binding',
      'export const body = function inner(api) { ' +
        calls() +
        " }; definePrototype({name:'two', setup:body});",
      true,
    ],
    [
      'named function expression calling its internal self',
      'const body = function inner(api) { ' +
        calls() +
        " if (unknown) inner(foreign); }; definePrototype({name:'two', setup:body});",
      true,
    ],
    [
      'factory-returned function instance shared with an ordinary caller',
      'function make() { return function inner(api) { ' +
        calls() +
        " }; } const body=make(); definePrototype({name:'two', setup:body}); const other=make(); other(foreign);",
      true,
    ],
    [
      'ordinary object method also used as a setup',
      'const holder={body(api) { ' +
        calls() +
        " }}; definePrototype({name:'two', setup:holder.body}); holder.body(foreign);",
      true,
    ],
    [
      'ordinary object function expression also used as a setup',
      'const holder={body:function inner(api) { ' +
        calls() +
        " }}; definePrototype({name:'two', setup:holder.body}); holder.body(foreign);",
      true,
    ],
    [
      'rest parameter containing the Core argument',
      "export default definePrototype({name:'two', setup(...api) { " + calls() + ' }});',
      true,
    ],
  ] as const)('withholds a native capability for %s', async (_name, body, canonicalImport) => {
    await withSource(
      body,
      (_folder, _files, source) => {
        expect(resolveBeta(source)).toMatchObject({
          matched: true,
          value: { kind: 'unknown', reason: 'unproved registration result' },
        });
      },
      canonicalImport
    );
  });
});
