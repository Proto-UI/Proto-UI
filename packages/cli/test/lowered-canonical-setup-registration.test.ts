import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ts from 'typescript';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';

import {
  scanRuleStateReadInventory,
  scanRuleStateReadsWithSites,
} from '../src/services/lowered-hook-coverage';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const body = `
  const hidden = def.state.bool('hidden', false);
  def.expose.state('hidden', hidden);
  def.rule({ when: w => w.state(hidden).eq(true),
    intent: i => i.feedback.style.use(tw('hidden')) });
`;

describe('canonical setup references in the source Rule inventory', () => {
  let directory = '';

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'pui-rule-setup-reference-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const scan = async (source: string, otherSources: Record<string, string> = {}) => {
    const file = path.join(directory, 'entry.proto.ts');
    await writeFile(file, source);
    for (const [name, text] of Object.entries(otherSources))
      await writeFile(path.join(directory, name), text);
    return {
      file,
      inventory: scanRuleStateReadInventory([
        file,
        ...Object.keys(otherSources).map((name) => path.join(directory, name)),
      ]),
    };
  };

  it.each([
    [
      'Core factories',
      "import { defineAsHook, definePrototype, tw } from '@proto.ui/core';",
      'function setupBody(def)',
      "export const asExample = defineAsHook({ name: 'example-hook', setup: setupBody });\n" +
        "export default definePrototype({ name: 'example', setup: setupBody });",
    ],
    [
      'aliased Core factories',
      "import { defineAsHook as attach, definePrototype as prototype, tw } from '@proto.ui/core';",
      'function setupBody(def)',
      "export const asExample = attach({ name: 'example-hook', setup: setupBody });\n" +
        "export default prototype({ name: 'example', setup: setupBody });",
    ],
    [
      'Core namespace factories',
      "import * as core from '@proto.ui/core'; import { tw } from '@proto.ui/core';",
      'function setupBody(def)',
      "export const asExample = core.defineAsHook({ name: 'example-hook', setup: setupBody });\n" +
        "export default core.definePrototype({ name: 'example', setup: setupBody });",
    ],
    [
      'shorthand setup',
      "import { definePrototype, tw } from '@proto.ui/core';",
      'function setup(def)',
      "export default definePrototype({ name: 'example', setup });",
    ],
  ])(
    'keeps every Rule body without inventing an escape through %s',
    async (_label, imports, head, registrations) => {
      const source = `${imports}\n${head} { ${body} }\n${registrations}`;
      const { file, inventory } = await scan(source);
      const sites = scanRuleStateReadsWithSites(source, file);

      expect(sites.sites).toHaveLength(1);
      expect(inventory.observations).toHaveLength(1);
      expect(inventory.evaluated).toEqual(inventory.observations);
      expect(inventory.evaluated[0]).toMatchObject({
        entryFile: file,
        rule: { file, start: source.indexOf('def.rule(') },
        callPath: [],
        declarationOnly: false,
        usages: [],
        unresolved: [],
        exposedLocals: [{ state: 'hidden', exposedAs: 'hidden', attribute: 'hidden' }],
      });
    }
  );

  it.each([
    ['opaque callback', 'external(setupBody);'],
    ['foreign setup configuration', 'foreign({ setup: setupBody });'],
    ['ordinary borrowed invocation', 'setupBody(foreignDef);'],
    ['named function export', 'export { setupBody };'],
    ['default function export', 'export default setupBody;'],
  ])(
    'retains unclosed registration when the same function also has this use: %s',
    async (_label, additionalUse) => {
      const { inventory } = await scan(`
      import { definePrototype, tw } from '@proto.ui/core';
      function setupBody(def) { ${body} }
      const prototype = definePrototype({ name: 'example', setup: setupBody });
      ${additionalUse}
    `);

      expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
        expression: 'unverified helper value: setupBody',
        reason: 'subject',
      });
      expect(inventory.observations.some((row) => row.exposedLocals.length > 0)).toBe(true);
    }
  );

  it('does not admit a local lookalike factory by its name', async () => {
    const { inventory } = await scan(`
      import { tw } from '@proto.ui/core';
      function definePrototype(config) { return config; }
      function setupBody(def) { ${body} }
      export default definePrototype({ name: 'example', setup: setupBody });
    `);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'unverified helper value: setupBody',
      reason: 'subject',
    });
  });

  it('does not extend the local reference proof to imported setup functions', async () => {
    const { inventory } = await scan(
      `import { definePrototype } from '@proto.ui/core';
       import { setupBody } from './setup';
       export default definePrototype({ name: 'example', setup: setupBody });`,
      {
        'setup.ts': `import { tw } from '@proto.ui/core';
          export function setupBody(def) { ${body} }`,
      }
    );
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'unverified helper value: setupBody',
      reason: 'subject',
    });
  });

  it('retains an actual unknown Rule read inside a closed configured setup', async () => {
    const source = `
      import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
      import { asFacts } from './facts';
      function setupBody(def) {
        def.props.define({});
        const { selected } = asFacts().stateHandles!;
        def.rule({ when: w => w.state(selected).eq(true),
          intent: i => i.feedback.style.use(tw('bg-accent')) });
      }
      export const asExample = defineAsHook({ name: 'example-hook', setup: setupBody });
      export default definePrototype({ name: 'example', setup: setupBody });
    `;
    const { file, inventory } = await scan(source, {
      'facts.ts': `import { defineAsHook } from '@proto.ui/core';
        export const asFacts = defineAsHook({ name: 'facts',
          setup(def) { def.state.bool('selected', false); } });`,
    });
    const rows = inventory.evaluated.filter((row) => row.entryFile === file);
    expect(rows).toHaveLength(1);
    expect(rows[0].rule).toEqual({ file, start: source.indexOf('def.rule(') });
    expect(rows[0].declarationOnly).toBe(false);
    expect(rows[0].usages).toEqual([]);
    expect(rows[0].unresolved).toEqual([{ expression: 'selected', reason: 'subject' }]);
  });

  it('retains actual Base Accordion Content Rule sites and local State exposures', () => {
    const file = path.join(REPO_ROOT, 'packages/prototypes/base/src/accordion/content.proto.ts');
    const inventory = scanRuleStateReadInventory([file]);
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated.every((row) => !row.declarationOnly)).toBe(true);
    expect(inventory.evaluated.flatMap((row) => row.exposedLocals)).toEqual([
      { state: 'hidden', exposedAs: 'hidden', attribute: 'hidden' },
    ]);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
  });

  it('retains every actual Base Dialog Rule through its configured and first native calls', async () => {
    const file = path.join(REPO_ROOT, 'packages/prototypes/base/src/dialog/content.proto.ts');
    const source = await readFile(file, 'utf8');
    const sites = scanRuleStateReadsWithSites(source, file);
    const inventory = scanRuleStateReadInventory([file]);
    expect(sites.sites.length).toBeGreaterThan(0);
    expect(new Set(inventory.evaluated.map((row) => row.rule.start))).toEqual(
      new Set(sites.sites.map((site) => site.call.getStart()))
    );
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
    // The shipped presence rule compares only against false. Both lowering
    // paths leave an all-negative condition on the runtime plan, so its site
    // must remain inventoried without claiming a lowered hook usage.
    expect(inventory.evaluated.flatMap((row) => row.usages)).toEqual([]);
  });

  it('withholds positive lowering capability after closing only setup references', async () => {
    const file = path.join(REPO_ROOT, 'packages/prototypes/base/src/dialog/content.proto.ts');
    const source = await readFile(file, 'utf8');
    const sites = scanRuleStateReadsWithSites(source, file);

    // Closing a configured reference does not grant a new capture/projection
    // capability. The same member with a positive comparison needs a lowering
    // proof that this source scan does not have, so keep that gap visible.
    const negative = 'w.state(transition.isPresent).eq(false)';
    expect(source.split(negative)).toHaveLength(2);
    const positive = scanRuleStateReadsWithSites(
      source.replace(negative, 'w.state(transition.isPresent).eq(true)'),
      file
    );
    expect(positive.sites.map((site) => site.call.getStart())).toEqual(
      sites.sites.map((site) => site.call.getStart())
    );
    expect(positive.scan.unresolved).toEqual([
      { expression: 'transition.isPresent', reason: 'subject' },
    ]);
    expect(positive.scan.usages).toEqual([]);
    expect(positive.scan.exposedLocals).toEqual([]);
  });

  it('keeps the real Dialog presence receiver bound to the authored Transition producer', async () => {
    const file = path.join(REPO_ROOT, 'packages/prototypes/base/src/dialog/content.proto.ts');
    const source = await readFile(file, 'utf8');
    const sites = scanRuleStateReadsWithSites(source, file);

    // Producer identity is a separate positive fact: follow the real Rule's
    // receiver to its stable initializer and the actual exported Transition
    // declaration. A same-spelled foreign producer cannot satisfy this check.
    const summary = createHookSourceSummaryContext();
    summary.registerSource(sites.source);
    const reads: ts.PropertyAccessExpression[] = [];
    const collectPresenceRead = (node: ts.Node): void => {
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === 'isPresent' &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'transition'
      )
        reads.push(node);
      ts.forEachChild(node, collectPresenceRead);
    };
    for (const site of sites.sites) collectPresenceRead(site.call);
    expect(reads).toHaveLength(1);
    const receiver = reads[0]?.expression;
    if (!receiver || !ts.isIdentifier(receiver))
      throw new Error('The actual Dialog presence receiver must be an Identifier.');
    const declaration = summary.resolveStableSourceBinding(receiver);
    if (!declaration?.initializer || !ts.isCallExpression(declaration.initializer))
      throw new Error('The actual Dialog presence receiver must have a stable producer call.');
    const call = declaration.initializer;
    expect(summary.isAuthoredProducerCall(call, sites.source)).toBe(true);
    const transitionFile = path.join(
      REPO_ROOT,
      'packages/prototypes/base/src/transition/as-transition.proto.ts'
    );
    const transitionSource = ts.createSourceFile(
      transitionFile,
      await readFile(transitionFile, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    const producer = transitionSource.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .find((entry) => ts.isIdentifier(entry.name) && entry.name.text === 'asTransition');
    if (!producer) throw new Error('The real Transition producer declaration must remain present.');
    expect(summary.isSameSourceBinding(call, sites.source, producer)).toBe(true);
  });
});
