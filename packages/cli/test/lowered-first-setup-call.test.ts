import { realpathSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createHookSourceSummaryContext,
  projectStandardRuntimeRootStyleTokens,
} from '../src/services/hook-source-summary';
import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';

const localRule = `
  const hidden = def.state.bool('hidden', false);
  def.expose.state('hidden', hidden);
  def.rule({ when: w => w.state(hidden).eq(true),
    intent: i => i.feedback.style.use(tw('hidden')) });
`;

const fixture = (
  owner: string,
  options: { imports?: string; capture?: string; setupHead?: string; body?: string } = {}
) => `
  ${options.imports ?? "import { defineAsHook, definePrototype, tw } from '@proto.ui/core';"}
  declare const foreignDef: unknown;
  declare const foreignState: unknown;
  declare function external(...values: unknown[]): unknown;
  ${options.setupHead ?? 'function setupBody(def)'} { ${options.body ?? localRule} }
  export const asExample = ${options.capture ?? 'defineAsHook'}({
    name: 'example-hook', setup: setupBody
  });
  ${owner}
`;

const setupReference = (source: ts.SourceFile): ts.Identifier => {
  let found: ts.Identifier | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'setup' &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === 'setupBody'
    )
      found ??= node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) throw new Error('The source fixture must register its actual setupBody binding.');
  return found;
};

describe('configured setup references with a first native Def invocation', () => {
  let directory = '';

  beforeEach(async () => {
    directory = await mkdtemp(path.join(realpathSync(tmpdir()), 'pui-first-setup-call-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const inspect = async (text: string) => {
    const file = path.join(directory, 'entry.proto.ts');
    await writeFile(file, text);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const summary = createHookSourceSummaryContext();
    summary.registerSource(source);
    return {
      file,
      source,
      closed: summary.isClosedAuthoredSetupReference(setupReference(source), source),
      inventory: scanRuleStateReadInventory([file]),
    };
  };

  it.each([
    [
      'canonical Core factories',
      fixture(`export default definePrototype({ name: 'example', setup(def) {
        setupBody(def);
        def.feedback.style.use(tw('block'));
      } });`),
    ],
    [
      'renamed Core factories and a transparent argument',
      fixture(
        `export default make({ name: 'example', setup(nativeDef) {
          setupBody((nativeDef satisfies unknown));
        } });`,
        {
          imports:
            "import { defineAsHook as capture, definePrototype as make, tw } from '@proto.ui/core';",
          capture: 'capture',
        }
      ),
    ],
    [
      'a named caller whose own references are canonical registrations',
      fixture(`function owner(def) { setupBody(def); }
        export default definePrototype({ name: 'example', setup: owner });`),
    ],
  ])('keeps actual Rule reads while closing %s', async (_label, text) => {
    const { file, closed, inventory } = await inspect(text);
    expect(closed).toBe(true);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
    const rows = inventory.evaluated.filter((row) => row.rule.start === text.indexOf('def.rule('));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.entryFile === file && !row.declarationOnly)).toBe(true);
    expect(rows.flatMap((row) => row.exposedLocals)).toEqual(
      expect.arrayContaining([{ state: 'hidden', exposedAs: 'hidden', attribute: 'hidden' }])
    );
  });

  it.each([
    [
      'a foreign argument',
      `definePrototype({ name: 'example', setup(def) { setupBody(foreignDef); } });`,
    ],
    [
      'a borrowed caller',
      `function owner(def) { setupBody(def); }
      definePrototype({ name: 'example', setup: owner }); owner(foreignDef);`,
    ],
    [
      'a later call after an unknown prefix',
      `definePrototype({ name: 'example', setup(def) {
      external(); setupBody(def);
    } });`,
    ],
    [
      'a deferred callback',
      `definePrototype({ name: 'example', setup(def) {
      queueMicrotask(() => setupBody(def));
    } });`,
    ],
    [
      'a rebound Def binding',
      `definePrototype({ name: 'example', setup(def) {
      setupBody(def); def = foreignDef;
    } });`,
    ],
    [
      'an aliased function value',
      `const forward = setupBody;
      definePrototype({ name: 'example', setup(def) { forward(def); } });`,
    ],
    [
      'an escaped function value',
      `definePrototype({ name: 'example', setup(def) { setupBody(def); } });
      external(setupBody);`,
    ],
    [
      'an ordinary foreign invocation',
      `definePrototype({ name: 'example', setup(def) { setupBody(def); } });
      setupBody(foreignDef);`,
    ],
    ['an optional call', `definePrototype({ name: 'example', setup(def) { setupBody?.(def); } });`],
    [
      'additional arguments',
      `definePrototype({ name: 'example', setup(def) { setupBody(def, foreignDef); } });`,
    ],
    [
      'a spread argument',
      `definePrototype({ name: 'example', setup(def) { setupBody(...[def]); } });`,
    ],
    [
      'a parameter initializer',
      `definePrototype({ name: 'example', setup(def = foreignDef) { setupBody(def); } });`,
    ],
    [
      'an async owner',
      `definePrototype({ name: 'example', async setup(def) { setupBody(def); } });`,
    ],
    [
      'a dynamic source',
      `definePrototype({ name: 'example', setup(def) { setupBody(def); } });
      eval('external(setupBody)');`,
    ],
    [
      'an exported helper',
      `definePrototype({ name: 'example', setup(def) { setupBody(def); } });
      export { setupBody };`,
    ],
  ])('retains unclosed evidence for %s', async (_label, owner) => {
    const { closed, inventory } = await inspect(fixture(owner));
    expect(closed).toBe(false);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'unverified helper value: setupBody',
      reason: 'subject',
    });
    expect(inventory.observations.some((row) => row.exposedLocals.length > 0)).toBe(true);
  });

  it('rejects an owner factory that only has the Core name', async () => {
    const { closed, inventory } = await inspect(
      fixture(
        `function definePrototype(config) { return config; }
         definePrototype({ name: 'example', setup(def) { setupBody(def); } });`,
        { imports: "import { defineAsHook, tw } from '@proto.ui/core';" }
      )
    );
    expect(closed).toBe(false);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'unverified helper value: setupBody',
      reason: 'subject',
    });
  });

  it('keeps unknown Rule state reads after the setup reference closes', async () => {
    const { closed, inventory } = await inspect(
      fixture(`definePrototype({ name: 'example', setup(def) { setupBody(def); } });`, {
        body: `${localRule}
          def.rule({ when: w => w.state(foreignState).eq(true),
            intent: i => i.feedback.style.use(tw('bg-accent')) });`,
      })
    );
    expect(closed).toBe(true);
    const unresolved = inventory.evaluated.flatMap((row) => row.unresolved);
    expect(unresolved.length).toBeGreaterThan(0);
    expect(
      unresolved.every((miss) => miss.reason === 'subject' && miss.expression === 'foreignState')
    ).toBe(true);
  });

  it('does not give the shared setup a fresh Runtime style projection', async () => {
    await writeFile(
      path.join(directory, 'facts.ts'),
      `import { defineAsHook } from '@proto.ui/core';
       export const asFacts = defineAsHook({ name: 'facts',
         setup(def) { def.state.bool('selected', false); } });`
    );
    const text = fixture(
      `export default definePrototype({ name: 'selected', setup: setupBody });`,
      {
        imports: `import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
          import { asFacts } from './facts';`,
        body: `def.props.define({});
          const { selected } = asFacts().stateHandles!;
          def.rule({ when: w => w.state(selected).eq(true),
            intent: i => i.feedback.style.use(tw('bg-accent')) });`,
      }
    );
    let collected = 0;
    const project = (source: ts.SourceFile) =>
      projectStandardRuntimeRootStyleTokens(source, async ({ summary }) => {
        let call: ts.CallExpression | undefined;
        const visit = (node: ts.Node): void => {
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'asFacts'
          )
            call = node;
          ts.forEachChild(node, visit);
        };
        visit(source);
        if (!call) throw new Error('The projection control must capture its actual asFacts.');
        expect(summary.resolveCall(call, source).value.kind).toBe('result');
        collected += 1;
        return [];
      });
    const control = await inspect(text);
    expect(control.closed).toBe(true);
    expect((await project(control.source))?.kind).toBe('standard-runtime-root-style-tokens');
    expect(collected).toBe(1);

    const shared = await inspect(
      `${text}\ndefinePrototype({ name: 'caller', setup(def) { setupBody(def); } });`
    );
    expect(shared.closed).toBe(true);
    const projection = await project(shared.source);
    expect(projection).toBeNull();
    expect(collected).toBe(1);
  });
});
