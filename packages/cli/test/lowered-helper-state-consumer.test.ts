import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const selection = `
  export function select(def) {
    const selected = def.state.enum('privateChoice', 'one', { options: ['one', 'two'] });
    const sync = run => selected.set(run.props.getRaw().choice ?? 'one', 'choice');
    def.props.watchRaw(['choice'], sync);
    def.lifecycle.onCreated(sync);
    return selected;
  }
`;
const visual = `
  import { tw } from '@proto.ui/core';
  import { select } from './selection';
  export function paint(def) {
    const selected = select(def);
    def.rule({ when: w => w.state(selected).eq('two'),
      intent: i => i.feedback.style.use(tw('bg-primary')) });
    return selected;
  }
`;
const entry = (prefix = '', suffix = '', initializer = 'paint(def)') => `
  import { definePrototype, tw } from '@proto.ui/core';
  import { paint } from './visual';
  export default definePrototype({ name: 'private-consumer', setup(def) {
    ${prefix}
    const selected = ${initializer};
    def.rule({ when: w => w.state(selected).eq('two'),
      intent: i => i.feedback.style.use(tw('text-primary')) });
    ${suffix}
  } });
`;
const observationIdentities = `
  import { createContextKey, createAnatomyFamily } from '@proto.ui/core';
  const KEY = createContextKey('consumer');
  const FAMILY = createAnatomyFamily('consumer', {
    roles: { root: { cardinality: { min: 1, max: 1 } }, item: { cardinality: { min: 0, max: '*' } } },
    relations: [{ kind: 'contains', parent: 'root', child: 'item' }],
  });
`;

describe('private returned State consumed by the exact native setup', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-private-consumer-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const scan = async (changes: Record<string, string> = {}) => {
    const files = [];
    for (const [name, text] of Object.entries({
      'selection.ts': selection,
      'visual.ts': visual,
      'entry.proto.ts': entry(),
      ...changes,
    })) {
      const file = path.join(directory, name);
      await writeFile(file, text);
      files.push(file);
    }
    return { files, inventory: scanRuleStateReadInventory(files) };
  };
  it('retains both actual Rule identities and raw paint without exposing the private handle', async () => {
    const { files, inventory } = await scan();
    expect(inventory.files).toEqual(files);
    expect(inventory.observations.some((row) => row.declarationOnly)).toBe(true);
    expect(inventory.evaluated).toHaveLength(2);
    expect(inventory.evaluated.every((row) => !row.declarationOnly)).toBe(true);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
    expect(inventory.evaluated.flatMap((row) => row.usages)).toEqual([]);
    expect(inventory.evaluated.flatMap((row) => row.exposedLocals)).toEqual([]);
    const tokens = await collectProtoStyleTokensFromFiles(files);
    expect(tokens).toEqual(expect.arrayContaining(['bg-primary', 'text-primary']));
    expect(tokens.filter((token) => token.includes('data-[private-choice'))).toEqual([]);
  });
  it.each([
    ['native Def alias', { 'entry.proto.ts': entry('const native = def;', '', 'paint(native)') }],
    [
      'caller State alias',
      {
        'entry.proto.ts': entry().replace(
          'def.rule({ when: w => w.state(selected)',
          'const alias = selected; def.rule({ when: w => w.state(alias)'
        ),
      },
    ],
    ['parenthesized invocation', { 'entry.proto.ts': entry('', '', '(paint(def))') }],
    [
      'direct State constructor',
      {
        'visual.ts': visual.replace(
          'select(def)',
          "def.state.enum('privateChoice', 'one', { options: ['one', 'two'] })"
        ),
      },
    ],
    [
      'returned State const alias',
      { 'visual.ts': visual.replace('return selected;', 'const alias = selected; return alias;') },
    ],
    [
      'canonical factory import alias',
      {
        'entry.proto.ts': entry()
          .replace('{ definePrototype, tw }', '{ definePrototype as prototype, tw }')
          .replace('default definePrototype(', 'default prototype('),
      },
    ],
  ] satisfies Array<[string, Record<string, string>]>)(
    'closes %s without adding State selectors',
    async (_label, changes) => {
      const { inventory } = await scan(changes);
      expect(inventory.evaluated).toHaveLength(2);
      expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
      expect(inventory.evaluated.flatMap((row) => row.exposedLocals)).toEqual([]);
    }
  );
  it.each([
    ['foreign Def', { 'entry.proto.ts': entry('', '', 'paint(foreign)') }],
    ['Def reassignment', { 'entry.proto.ts': entry('def = foreign;') }],
    ['Def escape', { 'entry.proto.ts': entry('opaque(def);') }],
    [
      'lookalike factory',
      {
        'entry.proto.ts': entry().replace(
          "import { definePrototype, tw } from '@proto.ui/core';",
          "import { tw } from '@proto.ui/core'; function definePrototype(config) { return config; }"
        ),
      },
    ],
    [
      'captured State exposed',
      { 'entry.proto.ts': entry('', "def.expose.state('publicChoice', selected);") },
    ],
    [
      'captured alias exposed',
      {
        'entry.proto.ts': entry(
          '',
          "const alias = selected; def.expose.state('publicChoice', alias);"
        ),
      },
    ],
    ['captured State escapes', { 'entry.proto.ts': entry('', 'opaque(selected);') }],
    ['captured State returned', { 'entry.proto.ts': entry('', 'return selected;') }],
    ['captured State stored', { 'entry.proto.ts': entry('', 'const stored = { selected };') }],
    ['captured State closure escapes', { 'entry.proto.ts': entry('', 'opaque(() => selected);') }],
    [
      'captured State reassigned',
      {
        'entry.proto.ts': entry('', 'selected = foreign;').replace(
          'const selected =',
          'let selected ='
        ),
      },
    ],
    [
      'caller WhenBuilder escapes',
      {
        'entry.proto.ts': entry().replace(
          "w => w.state(selected).eq('two')",
          "w => { opaque(w); return w.state(selected).eq('two'); }"
        ),
      },
    ],
    [
      'caller WhenBuilder method replaced',
      {
        'entry.proto.ts': entry().replace(
          "w => w.state(selected).eq('two')",
          "w => { w.state = foreign; return w.state(selected).eq('two'); }"
        ),
      },
    ],
    [
      'helper WhenBuilder escapes',
      {
        'visual.ts': visual.replace(
          "w => w.state(selected).eq('two')",
          "w => { opaque(w); return w.state(selected).eq('two'); }"
        ),
      },
    ],
    [
      'helper State exposed',
      {
        'visual.ts': visual.replace(
          'return selected;',
          "def.expose.state('publicChoice', selected); return selected;"
        ),
      },
    ],
    [
      'helper State escapes',
      { 'visual.ts': visual.replace('return selected;', 'opaque(selected); return selected;') },
    ],
    [
      'helper returned State conditional',
      { 'visual.ts': visual.replace('return selected;', 'return flag ? selected : foreign;') },
    ],
    [
      'helper early return',
      {
        'visual.ts': visual.replace(
          'const selected = select(def);',
          'if (flag) return foreign; const selected = select(def);'
        ),
      },
    ],
    ['optional helper call', { 'entry.proto.ts': entry('', '', 'paint?.(def)') }],
    ['spread helper call', { 'entry.proto.ts': entry('', '', 'paint(...[def])') }],
    ['forwarded result', { 'entry.proto.ts': entry('', '', 'opaque(paint(def))') }],
    [
      'ordinary caller',
      {
        'entry.proto.ts':
          "import { paint } from './visual'; function consume(def) { const selected = paint(def); return selected; } consume(foreign);",
      },
    ],
    [
      'unregistered callback State read',
      { 'entry.proto.ts': entry('', 'opaque(() => selected.get());') },
    ],
    [
      'named caller When callback',
      {
        'entry.proto.ts': entry().replace(
          "w => w.state(selected).eq('two')",
          "function build(w) { opaque(build); return w.state(selected).eq('two'); }"
        ),
      },
    ],
    [
      'named helper When callback',
      {
        'visual.ts': visual.replace(
          "w => w.state(selected).eq('two')",
          "function build(w) { opaque(build); return w.state(selected).eq('two'); }"
        ),
      },
    ],
    [
      'ordinary helper forwarding the native return',
      {
        'entry.proto.ts':
          entry('', '', 'consume(def)') +
          '\nfunction consume(def) { const selected = paint(def); return selected; }',
      },
    ],
  ] satisfies Array<[string, Record<string, string>]>)(
    'retains unknown ownership for %s',
    async (_label, changes) => {
      const { inventory } = await scan(changes);
      expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
        expression: 'selected',
        reason: 'subject',
      });
    }
  );
  it('retains an independently foreign call and every declaration-only Rule without borrowing the native consumer', async () => {
    const { inventory } = await scan({ 'entry.proto.ts': entry('', 'paint(foreign);') });
    expect(inventory.evaluated).toHaveLength(3);
    expect(inventory.evaluated.filter((row) => row.unresolved.length === 0)).toHaveLength(2);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'selected',
      reason: 'subject',
    });
  });
  it('does not transfer a private consumer proof to a second exposed capture', async () => {
    const { inventory } = await scan({
      'entry.proto.ts': entry(
        '',
        "const exposed = paint(def); def.expose.state('publicChoice', exposed);"
      ),
    });
    expect(inventory.evaluated).toHaveLength(3);
    expect(inventory.evaluated.slice(0, 2).flatMap((row) => row.unresolved)).toEqual([]);
    expect(inventory.evaluated[2]!.unresolved).toContainEqual({
      expression: 'selected',
      reason: 'subject',
    });
  });
  it('retains the helper declaration when no actual consumer supplies a native Def', async () => {
    const { inventory } = await scan({ 'entry.proto.ts': '' });
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated[0]!.declarationOnly).toBe(true);
    expect(inventory.evaluated[0]!.unresolved).toContainEqual({
      expression: 'selected',
      reason: 'subject',
    });
  });
  it.each([
    ['Event', "def.event.on('pointer.enter', sync);"],
    ['Props', "def.props.watch(['choice'], sync);"],
    ['Context', 'def.context.subscribe(KEY, sync);'],
    ['Anatomy', "def.anatomy.subscribeParts(FAMILY, 'item', sync);"],
  ])(
    'retains both private Rule uses when the exact consumer also registers a native %s callback',
    async (_name, registration) => {
      const source =
        observationIdentities +
        entry(
          '',
          `const sync = () => { consume(selected.get()); selected.set('two', 'choice'); }; ${registration}`
        );
      const { inventory } = await scan({ 'entry.proto.ts': source });
      expect(inventory.evaluated).toHaveLength(2);
      expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
      expect(inventory.evaluated.flatMap((row) => row.exposedLocals)).toEqual([]);
    }
  );
  it('withdraws the helper return proof when the consuming native callback escapes', async () => {
    const source = entry(
      '',
      "const sync = () => selected.get(); def.props.watch(['choice'], sync); opaque(sync);"
    );
    const { inventory } = await scan({ 'entry.proto.ts': source });
    expect(inventory.evaluated).toHaveLength(2);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'selected',
      reason: 'subject',
    });
  });
});
