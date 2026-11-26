import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const selection = `
  function declareChoice(def) {
    const native = def;
    native.props.define({ choice: { type: 'string' } });
    native.props.setDefaults({ choice: 'one' });
  }
  export function select(def, compatibility = 'one', options = {}) {
    declareChoice(def);
    const selected = def.state.enum('choice', compatibility, { options: ['one', 'two'] });
    const sync = (run) => {
      const next = run.props.getRaw().choice ?? compatibility;
      selected.set(next, 'reason: choice');
    };
    def.props.watchRaw(['choice'], sync);
    def.lifecycle.onCreated(sync);
    def.lifecycle.onMounted(sync);
    return selected;
  }
`;
const visual = `
  import { tw } from '@proto.ui/core';
  import { choose } from './barrel';
  function setupStyle(def) { return choose(def, 'one'); }
  export function paint(def) {
    const selected = setupStyle(def);
    def.rule({ when: w => w.state(selected).eq('two'),
      intent: i => i.feedback.style.use(tw('bg-primary')) });
  }
`;
const entry = (body = 'paint(def);') => `
  import { definePrototype } from '@proto.ui/core';
  import { paint } from './visual';
  export default definePrototype({ name: 'returned-state', setup(def) { ${body} } });
`;

describe('ordinary helper returns preserve invocation-owned local State', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-returned-local-state-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const scan = async (changes: Record<string, string> = {}) => {
    const texts = {
      'selection.ts': selection,
      'barrel.ts': "export { select as choose } from './selection';",
      'visual.ts': visual,
      'entry.proto.ts': entry(),
      ...changes,
    };
    const files: string[] = [];
    for (const [name, text] of Object.entries(texts)) {
      const file = path.join(directory, name);
      await writeFile(file, text);
      files.push(file);
    }
    return { files, inventory: scanRuleStateReadInventory(files) };
  };

  it('follows imported wrappers, a Def alias and actual lifecycle State writes', async () => {
    const { files, inventory } = await scan();
    expect(inventory.files).toEqual(files);
    expect(inventory.observations.some((row) => row.declarationOnly)).toBe(true);
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated[0]).toMatchObject({
      entryFile: path.join(directory, 'entry.proto.ts'),
      declarationOnly: false,
      usages: [],
      exposedLocals: [],
      unresolved: [],
    });
    expect(inventory.evaluated[0].rule.file).toBe(path.join(directory, 'visual.ts'));
    expect(inventory.evaluated[0].callPath).toHaveLength(1);
  });

  it('keeps an exposed return pending while the collector lacks its declared attribute name', async () => {
    const { files, inventory } = await scan({
      'entry.proto.ts': `
        import { definePrototype, tw } from '@proto.ui/core';
        import { choose } from './barrel';
        export default definePrototype({ name: 'exposed-choice', setup(def) {
          const style = choose(def, 'one');
          def.expose.state('publicStyle', style);
          def.rule({ when: w => w.state(style).eq('two'),
            intent: i => i.feedback.style.use(tw('text-primary')) });
        } });
      `,
      'visual.ts': '',
    });
    const tokens = await collectProtoStyleTokensFromFiles(files);
    // This negative control exercises the production collector, whose fallback
    // exposure key is not the State's runtime declaration name. Do not certify
    // the source until both paths can prove the same `choice` attribute.
    expect(tokens.some((token) => token.endsWith('text-primary'))).toBe(true);
    expect(tokens).not.toContain('data-[choice=two]:text-primary');
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated[0].unresolved).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
    expect(inventory.evaluated[0].usages).toEqual([]);
    expect(inventory.evaluated[0].exposedLocals).toEqual([]);
  });

  it('keeps a const alias private when both bindings are only native WhenBuilder subjects', async () => {
    const { files, inventory } = await scan({
      'visual.ts': visual
        .replace(
          'const selected = setupStyle(def);',
          'const selected = setupStyle(def); const alias = selected;'
        )
        .replace('w.state(selected)', 'w.state(alias)'),
    });
    const tokens = await collectProtoStyleTokensFromFiles(files);
    expect(tokens.some((token) => token.endsWith('bg-primary'))).toBe(true);
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated[0].unresolved).toEqual([]);
    expect(inventory.evaluated[0].exposedLocals).toEqual([]);
  });

  it('keeps a foreign invocation unresolved beside a proven native invocation', async () => {
    const { inventory } = await scan({ 'entry.proto.ts': entry('paint(def); paint(foreign);') });
    expect(inventory.evaluated).toHaveLength(2);
    expect(inventory.evaluated.filter((row) => row.unresolved.length === 0)).toHaveLength(1);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'selected',
      reason: 'subject',
    });
    expect(inventory.evaluated.every((row) => !row.declarationOnly)).toBe(true);
  });

  it.each([
    ['foreign Def argument', { 'entry.proto.ts': entry('paint(foreign);') }],
    ['rebound native Def', { 'entry.proto.ts': entry('def = foreign; paint(def);') }],
    ['native Def escape', { 'entry.proto.ts': entry('opaque(def); paint(def);') }],
    [
      'unknown native receiver operation',
      { 'entry.proto.ts': entry('def.unknown(); paint(def);') },
    ],
    [
      'lookalike factory',
      {
        'entry.proto.ts': entry().replace(
          "import { definePrototype } from '@proto.ui/core';",
          'function definePrototype(value) { return value; }'
        ),
      },
    ],
    [
      'conditional return',
      {
        'selection.ts': selection.replace(
          'return selected;',
          'return unknown ? selected : foreign;'
        ),
      },
    ],
    [
      'conditional early return',
      {
        'selection.ts': selection.replace(
          'declareChoice(def);',
          'if (unknown) return foreign; declareChoice(def);'
        ),
      },
    ],
    [
      'returned binding reassignment',
      {
        'selection.ts': selection
          .replace('const selected =', 'let selected =')
          .replace('return selected;', 'selected = foreign; return selected;'),
      },
    ],
    [
      'dynamic constructor',
      { 'selection.ts': selection.replace('def.state.enum(', 'def.state[factory](') },
    ],
    [
      'unknown constructor name',
      {
        'selection.ts': selection.replace(
          "def.state.enum('choice',",
          'def.state.enum(unknownName,'
        ),
      },
    ],
    [
      'facade mutation',
      {
        'selection.ts': selection.replace(
          'declareChoice(def);',
          'def.state.enum = foreign; declareChoice(def);'
        ),
      },
    ],
    [
      'helper Def escape',
      {
        'selection.ts': selection.replace(
          'declareChoice(def);',
          'opaque(def); declareChoice(def);'
        ),
      },
    ],
    [
      'State escape',
      {
        'selection.ts': selection.replace('return selected;', 'opaque(selected); return selected;'),
      },
    ],
    [
      'capturing callback escape',
      { 'selection.ts': selection.replace('return selected;', 'opaque(sync); return selected;') },
    ],
    [
      'State returned from a callback',
      {
        'selection.ts': selection.replace(
          "selected.set(next, 'reason: choice');",
          'return selected;'
        ),
      },
    ],
    [
      'omitted default poisoning the Def facade',
      {
        'selection.ts':
          selection.replace('options = {}', 'options = poison(def)') +
          `
        function poison(def) { def.state.enum = () => foreign; return {}; }
      `,
      },
    ],
    [
      'omitted default aliasing Def through arguments',
      { 'selection.ts': selection.replace('options = {}', 'options = poison(arguments[0])') },
    ],
    [
      'destructuring default poisoning the Def facade',
      { 'selection.ts': selection.replace('options = {}', '{ poison = opaque(def) } = {}') },
    ],
    [
      'caller argument escape',
      {
        'visual.ts': visual.replace(
          'const selected = setupStyle(def);',
          'const selected = setupStyle(def); opaque(selected);'
        ),
      },
    ],
    [
      'caller source helper exposure',
      {
        'visual.ts':
          visual.replace(
            'const selected = setupStyle(def);',
            'const selected = setupStyle(def); exposeChoice(def, selected);'
          ) +
          `
        function exposeChoice(def, state) { def.expose.state('publicStyle', state); }
      `,
      },
    ],
    [
      'caller alias exposure',
      {
        'visual.ts': visual.replace(
          'const selected = setupStyle(def);',
          "const selected = setupStyle(def); const alias = selected; def.expose.state('publicStyle', alias);"
        ),
      },
    ],
    [
      'caller return escape',
      {
        // This invocation escapes only when an actual consumer receives its result.
        'entry.proto.ts': entry('opaque(paint(def));'),
        'visual.ts': visual.replace(
          "intent: i => i.feedback.style.use(tw('bg-primary')) });",
          "intent: i => i.feedback.style.use(tw('bg-primary')) }); return selected;"
        ),
      },
    ],
    [
      'caller container escape',
      {
        'visual.ts': visual.replace(
          'const selected = setupStyle(def);',
          'const selected = setupStyle(def); const stored = { selected };'
        ),
      },
    ],
    [
      'WhenBuilder mutation',
      {
        'visual.ts': visual.replace(
          "when: w => w.state(selected).eq('two')",
          "when: w => { w.state = foreign; return w.state(selected).eq('two'); }"
        ),
      },
    ],
    [
      'WhenBuilder escape',
      {
        'visual.ts': visual.replace(
          "when: w => w.state(selected).eq('two')",
          "when: w => { opaque(w); return w.state(selected).eq('two'); }"
        ),
      },
    ],
    [
      'async helper',
      {
        'selection.ts': selection.replace(
          'export function select(',
          'export async function select('
        ),
      },
    ],
    ['recursive return', { 'selection.ts': 'export function select(def) { return select(def); }' }],
    [
      'arguments alias',
      {
        'selection.ts': selection.replace(
          'declareChoice(def);',
          'opaque(arguments[0]); declareChoice(def);'
        ),
      },
    ],
    [
      'optional helper call',
      { 'visual.ts': visual.replace("choose(def, 'one')", "choose?.(def, 'one')") },
    ],
    [
      'unknown stored helper',
      {
        'visual.ts': visual.replace(
          "return choose(def, 'one');",
          "const selectedHelper = unknown ? choose : foreign; return selectedHelper(def, 'one');"
        ),
      },
    ],
  ] satisfies Array<[string, Record<string, string>]>)(
    'retains an unresolved subject for %s',
    async (_label, changes) => {
      const { inventory } = await scan(changes);
      expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
        expression: 'selected',
        reason: 'subject',
      });
    }
  );

  it('keeps escaped Rule helpers in the denominator despite a known native caller', async () => {
    const { inventory } = await scan({ 'entry.proto.ts': `${entry()}\nopaque(paint);` });
    expect(inventory.evaluated.some((row) => row.declarationOnly)).toBe(true);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'unverified helper value: paint',
      reason: 'subject',
    });
  });

  it('preserves all six real Accordion paint Rules through the real selection helper', () => {
    const content = path.join(ROOT, 'packages/prototypes/shadcn/src/accordion/content.proto.ts');
    const visual = path.join(ROOT, 'packages/prototypes/shadcn/src/accordion/visual.ts');
    const selection = path.join(ROOT, 'packages/prototypes/shadcn/src/style-scope/selection.ts');
    const inventory = scanRuleStateReadInventory([content, visual, selection]);
    expect(inventory.files).toEqual([content, visual, selection]);
    const rules = inventory.evaluated.filter(
      (row) => row.entryFile === content && row.rule.file === visual
    );
    expect(rules).toHaveLength(6);
    expect(rules.every((row) => !row.declarationOnly && row.callPath.length > 0)).toBe(true);
    expect(rules.flatMap((row) => row.unresolved)).toEqual([]);
    expect(rules.flatMap((row) => row.usages)).toEqual([]);
    expect(rules.flatMap((row) => row.exposedLocals)).toEqual([]);
  });
});
