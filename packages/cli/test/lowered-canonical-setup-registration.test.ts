import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

  it('does not close the actual Base Dialog setup that also has an ordinary invocation', () => {
    const file = path.join(REPO_ROOT, 'packages/prototypes/base/src/dialog/content.proto.ts');
    const inventory = scanRuleStateReadInventory([file]);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'unverified helper value: setupDialogContent',
      reason: 'subject',
    });
  });
});
