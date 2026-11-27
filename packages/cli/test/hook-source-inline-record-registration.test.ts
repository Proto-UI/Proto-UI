import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  createHookSourceSummaryContext,
  type HookSourceSummaryContext,
  type HookSourceValue,
} from '../src/services/hook-source-summary';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

type Fixture = {
  argument: string;
  before?: string;
  after?: string;
  ownerPrefix?: string;
  parameters?: string;
};
const child = [
  "import { defineAsHook } from '@proto.ui/core';",
  "export const asChild = defineAsHook({ name: 'record-child',",
  "  setup(def) { def.state.bool('invalid', false); },",
  '  projectHandle(result) { return { state: result.stateHandles! }; }',
  '});',
].join('\n');

function findOne<T extends ts.Node>(
  source: ts.SourceFile,
  predicate: (node: ts.Node) => node is T
): T {
  const found: T[] = [];
  const visit = (node: ts.Node): void => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(found).toHaveLength(1);
  return found[0]!;
}

function probe(
  source: ts.SourceFile,
  summary: HookSourceSummaryContext,
  ownerName = 'result',
  handleName = 'handle'
) {
  const declaration = (name: string) =>
    findOne(
      source,
      (node): node is ts.VariableDeclaration =>
        ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name
    );
  const producer = declaration(ownerName).initializer!;
  expect(ts.isCallExpression(producer)).toBe(true);
  expect(summary.isAuthoredProducerCall(producer as ts.CallExpression, source)).toBe(true);
  const root = summary.resolveCall(producer as ts.CallExpression, source);
  const environment = new Map<string, HookSourceValue>([[ownerName, root.value]]);
  const lookup = summary.resolve(declaration(handleName).initializer!, source, environment);
  environment.set(handleName, lookup.value);
  const subject = findOne(
    source,
    (node): node is ts.PropertyAccessExpression =>
      ts.isPropertyAccessExpression(node) && node.getText(source) === handleName + '.state.invalid'
  );
  return { root, lookup, leaf: summary.resolve(subject, source, environment) };
}

async function inspect(fixtures: readonly Fixture[]) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hook-inline-record-'));
  try {
    await writeFile(path.join(dir, 'child.ts'), child);
    await writeFile(
      path.join(dir, 'hostile.ts'),
      'export const Object = { freeze(value: unknown) { return value; } };'
    );
    const entries: string[] = [];
    const sharedSetup = [
      "import { asChild } from './child';",
      'export function setupOwner(def: unknown, options: { enabled?: unknown } = {}) {',
      '  const binding = options.enabled ? asChild() : null;',
      '}',
    ].join('\n');
    await writeFile(path.join(dir, 'setup.ts'), sharedSetup);
    for (const [index, fixture] of fixtures.entries()) {
      const setupName =
        fixture.before || fixture.after || fixture.parameters ? 'setup-' + index : 'setup';
      if (setupName !== 'setup')
        await writeFile(
          path.join(dir, setupName + '.ts'),
          sharedSetup
            .replace(
              'def: unknown, options: { enabled?: unknown } = {}',
              fixture.parameters ?? 'def: unknown, options: { enabled?: unknown } = {}'
            )
            .replace('  const binding =', (fixture.before ?? '') + '\n  const binding =')
            .replace('\n}', '\n' + (fixture.after ?? '') + '\n}')
        );
      await writeFile(
        path.join(dir, 'owner-' + index + '.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "import { setupOwner } from './" + setupName + "';",
          'declare const opaque: any;',
          fixture.ownerPrefix ?? '',
          "export const asOwner = defineAsHook({ name: 'record-owner-" + index + "',",
          '  setup(def) { setupOwner(def, ' + fixture.argument + '); }',
          '});',
        ].join('\n')
      );
      const file = path.join(dir, 'entry-' + index + '.proto.ts');
      await writeFile(
        file,
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          "import { asOwner } from './owner-" + index + "';",
          "export default definePrototype({ name: 'record-entry-" + index + "', setup(def) {",
          '  const result = asOwner();',
          "  const handle = result.getAsHookHandle!('record-child');",
          '  def.rule({ when: w => w.state(handle.state.invalid).eq(true),',
          "    intent: i => i.feedback.style.use(tw('border-2')) });",
          '} });',
        ].join('\n')
      );
      entries.push(file);
    }
    const summary = createHookSourceSummaryContext();
    const results = [];
    for (const file of entries) {
      const source = ts.createSourceFile(
        file,
        await readFile(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      );
      summary.registerSource(source);
      results.push({
        ...probe(source, summary),
        tokens: await collectProtoStyleTokensFromFiles([file]),
      });
    }
    return results;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('source-proven inline record arguments in child registration', () => {
  it('resolves the child installed by an explicit own true member', async () => {
    const [result] = await inspect([{ argument: '{ enabled: true }' }]);
    expect(result!.leaf.value.kind).toBe('state');
    if (result!.leaf.value.kind === 'state') {
      expect(result!.leaf.value.state.declaredName).toBe('invalid');
      expect(result!.leaf.value.state.owner.file).toMatch(/[/\\]child\.ts$/);
      expect(result!.leaf.value.state.declaration.file).toMatch(/[/\\]child\.ts$/);
    }
    expect(result!.tokens).toContain('data-[invalid]:border-2');
  });

  it('keeps the outer record proof when an inner parameter has the same spelling', async () => {
    const [result] = await inspect([
      {
        argument: '{ enabled: true }',
        after: 'const later = (options: { enabled?: unknown }) => { options.enabled = false; };',
      },
    ]);
    expect(result!.leaf.value.kind).toBe('state');
    if (result!.leaf.value.kind === 'state') {
      expect(result!.leaf.value.state.declaredName).toBe('invalid');
      expect(result!.leaf.value.state.owner.file).toMatch(/[/\\]child\.ts$/);
      expect(result!.leaf.value.state.declaration.file).toBe(result!.leaf.value.state.owner.file);
    }
    expect(result!.tokens).toContain('data-[invalid]:border-2');
  });

  it('does not install the child for an explicit own false member', async () => {
    const [result] = await inspect([{ argument: '{ enabled: false }' }]);
    expect(result!.root.value.kind).toBe('result');
    if (result!.root.value.kind === 'result')
      expect(result!.root.value.children.has('record-child')).toBe(false);
    expect(result!.leaf.value.kind).toBe('unknown');
    expect(result!.tokens).not.toContain('data-[invalid]:border-2');
  });

  for (const knownFirst of [true, false]) {
    it('retains an independent unknown caller with known-first=' + knownFirst, async () => {
      const fixtures = [{ argument: '{ enabled: true }' }, { argument: '{ enabled: opaque }' }];
      const results = await inspect(knownFirst ? fixtures : fixtures.toReversed());
      const known = results[knownFirst ? 0 : 1]!;
      const unknown = results[knownFirst ? 1 : 0]!;
      expect(known.leaf.value.kind).toBe('state');
      expect(known.tokens).toContain('data-[invalid]:border-2');
      expect(unknown.leaf.value.kind).toBe('unknown');
      expect(unknown.tokens).not.toContain('data-[invalid]:border-2');
    });
  }

  for (const [name, fixture] of [
    ['absent member', { argument: '{}' }],
    ['nonliteral value', { argument: '{ enabled: opaque }' }],
    ['spread', { argument: '{ ...opaque, enabled: true }' }],
    ['getter', { argument: '{ get enabled() { return true; } }' }],
    ['computed member', { argument: "{ ['enabled']: true }" }],
    ['prototype spelling', { argument: '{ __proto__: null, enabled: true }' }],
    ['identifier alias', { argument: 'held', ownerPrefix: 'const held = { enabled: true };' }],
    ['freeze spelling', { argument: 'Object.freeze({ enabled: true })' }],
    [
      'imported freeze result',
      {
        argument: 'Object.freeze({ enabled: true })',
        ownerPrefix: "import { Object } from './hostile';",
      },
    ],
    ['parameter assignment', { argument: '{ enabled: true }', before: 'options = {};' }],
    ['member write', { argument: '{ enabled: true }', before: 'options.enabled = false;' }],
    [
      'later default initializer write',
      {
        argument: '{ enabled: true }',
        parameters:
          'def: unknown, options: { enabled?: unknown } = {}, later = (options.enabled = false)',
      },
    ],
    ['member delete', { argument: '{ enabled: true }', before: 'delete options.enabled;' }],
    ['local alias', { argument: '{ enabled: true }', before: 'const alias = options;' }],
    ['escape', { argument: '{ enabled: true }', before: 'external(options);' }],
    ['arguments alias', { argument: '{ enabled: true }', before: 'arguments[1].enabled = false;' }],
    [
      'deferred capture',
      { argument: '{ enabled: true }', after: 'const later = () => options.enabled;' },
    ],
    ['direct eval', { argument: '{ enabled: true }', before: 'eval("options.enabled = false");' }],
  ] satisfies readonly (readonly [string, Fixture])[]) {
    it('keeps ' + name + ' unproved', async () => {
      const [result] = await inspect([fixture]);
      expect(result!.leaf.value.kind).toBe('unknown');
      expect(result!.tokens).not.toContain('data-[invalid]:border-2');
    });
  }

  it('resolves the shipped Field Textarea optional-control invalid source', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const file = path.join(root, 'packages/prototypes/brutalist/src/field/textarea.proto.ts');
    const source = ts.createSourceFile(
      file,
      await readFile(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    const summary = createHookSourceSummaryContext();
    summary.registerSource(source);
    const result = probe(source, summary, 'textarea', 'binding');
    expect(result.leaf.value.kind).toBe('state');
    if (result.leaf.value.kind === 'state') {
      expect(result.leaf.value.state.declaredName).toBe('invalid');
      expect(result.leaf.value.state.owner.file).toMatch(
        /[/\\]base[/\\]src[/\\]field[/\\]control-binding\.proto\.ts$/
      );
      expect(result.leaf.value.state.declaration.file).toBe(result.leaf.value.state.owner.file);
    }
    const tokens = await collectProtoStyleTokensFromFiles([file]);
    expect(tokens).toContain('data-[invalid]:border-2');
    expect(tokens).toContain('data-[invalid]:border-destructive');
    expect(tokens).toContain('data-[invalid]:ring-2');
    expect(tokens).toContain('data-[invalid]:ring-destructive/20');
    expect(tokens).toContain('dark:not-[data-invalid]:border-foreground');
    expect(tokens).not.toContain('data-[invalid]:border-foreground');
  });
});
