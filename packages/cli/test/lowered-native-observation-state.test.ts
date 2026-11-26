import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const identities = `
  import { createContextKey, createAnatomyFamily } from '@proto.ui/core';
  const KEY = createContextKey('observation');
  const FAMILY = createAnatomyFamily('observation', {
    roles: { root: { cardinality: { min: 1, max: 1 } }, item: { cardinality: { min: 0, max: '*' } } },
    relations: [{ kind: 'contains', parent: 'root', child: 'item' }],
  });
`;
const operations = [
  ['Props', "def.props.watch(['value'], sync);", 4],
  ['Context', 'def.context.subscribe(KEY, sync);', 3],
  ['Anatomy', "def.anatomy.subscribeParts(FAMILY, 'item', sync);", 2],
] as const;
const helper = (
  registration = '',
  prefix = identities,
  callback = 'const sync = () => selected.set(true);'
) => `
  ${prefix}
  export function select(def) {
    const selected = def.state.bool('privateSelection', false);
    ${callback}
    ${registration}
    return selected;
  }
`;
const entry = (uses = '', prefix = identities) => `
  import { definePrototype, tw } from '@proto.ui/core';
  import { select } from './selection';
  ${prefix}
  export default definePrototype({ name: 'private-observation-state', setup(def) {
    const selected = select(def);
    ${uses}
    const ready = def.state.bool('ready', false);
    def.expose.state('ready', ready);
    def.rule({ when: w => w.state(selected).eq(true),
      intent: i => i.feedback.style.use(tw('bg-primary')) });
    def.rule({ when: w => w.state(ready).eq(true),
      intent: i => i.feedback.style.use(tw('text-primary')) });
  } });
`;

describe('native observation registrations retain private State identity', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-native-observation-state-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const fixture = async (
    selection: string,
    source = entry(),
    extra: Record<string, string> = {}
  ) => {
    const files = await Promise.all(
      Object.entries({ 'selection.ts': selection, 'entry.proto.ts': source, ...extra }).map(
        async ([name, text]) => {
          const file = path.join(directory, name);
          await writeFile(file, text);
          return file;
        }
      )
    );
    return {
      inventory: scanRuleStateReadInventory(files),
      tokens: await collectProtoStyleTokensFromFiles(files),
    };
  };
  const assertState = async (
    selection: string,
    source: string,
    proved: boolean,
    extra?: Record<string, string>
  ) => {
    const { inventory, tokens } = await fixture(selection, source, extra);
    expect(inventory.evaluated).toHaveLength(2);
    if (proved) {
      expect(inventory.evaluated[0]!.unresolved).toEqual([]);
      expect(inventory.evaluated[0]!.usages).toEqual([]);
      expect(inventory.evaluated[0]!.exposedLocals).toEqual([]);
    } else {
      expect(inventory.evaluated[0]!.unresolved).toContainEqual({
        expression: 'selected',
        reason: 'subject',
      });
    }
    expect(inventory.evaluated[1]!.unresolved).toEqual([]);
    expect(tokens).toContain('bg-primary');
    expect(tokens).toContain('data-[ready]:text-primary');
    expect(tokens.some((token) => token.includes('privateSelection'))).toBe(false);
  };

  it.each(operations)(
    'proves the real %s callback slot and arity',
    async (_name, registration, count) => {
      const callback = `const sync = (${['run', 'next', 'prev', 'info'].slice(0, count).join(', ')}) => selected.set(true);`;
      await assertState(helper(registration, identities, callback), entry(), true);
    }
  );

  it.each([
    ['literal template Props keys', 'def.props.watch([`value`], sync);'],
    ['empty literal Props keys', 'def.props.watch([], sync);'],
    ['native Def alias', "const owner = def; owner.props.watch(['value'], sync);"],
    ['literal member access', "def['props']['watch'](['value'], sync);"],
    [
      'two native registrations',
      "def.props.watch(['value'], sync); def.context.subscribe(KEY, sync);",
    ],
  ])('keeps %s within the same private owner', async (_name, registration) => {
    await assertState(helper(registration), entry(), true);
  });

  it('follows a renamed Core import and renamed module export to the real const identity', async () => {
    const prefix = "import { actualKey as KEY, actualFamily as FAMILY } from './keys';";
    const keys = identities
      .replace(
        'createContextKey, createAnatomyFamily',
        'createContextKey as makeKey, createAnatomyFamily as makeFamily'
      )
      .replace(
        "const KEY = createContextKey('observation');",
        "export const actualKey = makeKey('observation');"
      )
      .replace(
        "const FAMILY = createAnatomyFamily('observation',",
        "export const actualFamily = makeFamily('observation',"
      );
    await assertState(
      helper(
        "def.context.subscribe(KEY, sync); def.anatomy.subscribeParts(FAMILY, 'item', sync);",
        prefix
      ),
      entry(),
      true,
      { 'keys.ts': keys }
    );
  });

  it('uses the actual lexical const rather than a top-level same-named foreign value', async () => {
    const selection = helper(
      'def.context.subscribe(KEY, sync);',
      "import { createContextKey } from '@proto.ui/core'; const KEY = foreign;"
    ).replace(
      "const selected = def.state.bool('privateSelection', false);",
      "const KEY = createContextKey('local'); const selected = def.state.bool('privateSelection', false);"
    );
    await assertState(selection, entry(), true);
  });

  it.each([
    ['Props key alias', "const keys = ['value']; def.props.watch(keys, sync);"],
    ['Props key spread', "def.props.watch([...['value']], sync);"],
    ['Props nonstring key', 'def.props.watch([1], sync);'],
    ['Props omitted key', "def.props.watch([,'value'], sync);"],
    ['Props template substitution', 'def.props.watch([`value${unknown}`], sync);'],
    ['Props callback in key slot', "def.props.watch(sync, ['value']);"],
    ['Props extra argument', "def.props.watch(['value'], sync, {});"],
    ['Context callback in key slot', 'def.context.subscribe(sync, KEY);'],
    ['Context extra argument', 'def.context.subscribe(KEY, sync, {});'],
    ['Context key alias', 'const alias = KEY; def.context.subscribe(alias, sync);'],
    ['Context unknown key', 'def.context.subscribe(unknown, sync);'],
    [
      'Context inline identity outside this slice',
      "def.context.subscribe(createContextKey('inline'), sync);",
    ],
    ['Anatomy callback in role slot', "def.anatomy.subscribeParts(FAMILY, sync, 'item');"],
    ['Anatomy callback in family slot', "def.anatomy.subscribeParts(sync, 'item', FAMILY);"],
    ['Anatomy extra argument', "def.anatomy.subscribeParts(FAMILY, 'item', sync, {});"],
    ['Anatomy role alias', "const role = 'item'; def.anatomy.subscribeParts(FAMILY, role, sync);"],
    [
      'Anatomy family alias',
      "const alias = FAMILY; def.anatomy.subscribeParts(alias, 'item', sync);",
    ],
    ['unknown facade operation', 'def.props.watchAll(sync);'],
    ['foreign facade receiver', "foreign.props.watch(['value'], sync);"],
    ['facade replacement', "def.props = foreign; def.props.watch(['value'], sync);"],
    ['method replacement', "def.props.watch = foreign; def.props.watch(['value'], sync);"],
    ['Def replacement', "def = foreign; def.props.watch(['value'], sync);"],
    ['Def escape', "opaque(def); def.props.watch(['value'], sync);"],
    ['method alias', "const watch = def.props.watch; watch(['value'], sync);"],
    ['optional call', "def.props.watch?.(['value'], sync);"],
    ['optional facade', "def.props?.watch(['value'], sync);"],
    ['call spread', "def.props.watch(...[['value'], sync]);"],
  ])('retains the unresolved subject for %s', async (_name, registration) => {
    await assertState(helper(registration), entry(), false);
  });

  it.each([
    [
      'foreign same-named factory',
      "function createContextKey() { return foreign; } const KEY = createContextKey('key');",
    ],
    [
      'factory alias',
      "import { createContextKey } from '@proto.ui/core'; const make = createContextKey; const KEY = make('key');",
    ],
    [
      'type-only factory',
      "import type { createContextKey } from '@proto.ui/core'; const KEY = createContextKey('key');",
    ],
    [
      'mutable key',
      "import { createContextKey } from '@proto.ui/core'; let KEY = createContextKey('key');",
    ],
    [
      'reassigned key',
      "import { createContextKey } from '@proto.ui/core'; const KEY = createContextKey('key'); KEY = foreign;",
    ],
    [
      'key proxy',
      "import { createContextKey } from '@proto.ui/core'; const KEY = new Proxy(createContextKey('key'), {});",
    ],
    ['object masquerading as a key', "const KEY = { __brand: 'ContextKey', debugName: 'key' };"],
    [
      'effectful key argument',
      "import { createContextKey } from '@proto.ui/core'; const KEY = createContextKey(opaque());",
    ],
    [
      'factory extra argument',
      "import { createContextKey } from '@proto.ui/core'; const KEY = createContextKey('key', opaque());",
    ],
  ])('does not infer a canonical Context identity from %s', async (_name, prefix) => {
    await assertState(helper('def.context.subscribe(KEY, sync);', prefix), entry(), false);
  });

  it('rejects a lexical key shadow even when the top-level Core key is valid', async () => {
    const selection = helper('def.context.subscribe(KEY, sync);').replace(
      'export function select(def)',
      'export function select(def, KEY)'
    );
    await assertState(selection, entry(), false);
  });

  it.each([
    ['metadata call', 'opaque()'],
    ['borrowed metadata', 'unknown'],
    ['metadata spread', '{ ...unknown }'],
    ['metadata getter', '{ get roles() { opaque(); return {}; } }'],
    ['metadata computed key', '{ [opaque()]: {} }'],
    ['metadata shorthand', '{ roles }'],
    ['nested metadata call', '{ roles: { root: opaque() } }'],
    ['nested getter', '{ roles: { get root() { opaque(); return {}; } } }'],
    ['metadata method', '{ roles() { opaque(); } }'],
    ['prototype setter syntax', '{ __proto__: { roles: {} } }'],
    ['duplicate metadata member', '{ roles: {}, roles: {} }'],
    ['array spread metadata', '{ roles: {}, relations: [...unknown] }'],
  ])('does not run or trust %s while constructing an Anatomy identity', async (_name, metadata) => {
    const prefix = `import { createAnatomyFamily } from '@proto.ui/core'; const FAMILY = createAnatomyFamily('family', ${metadata});`;
    await assertState(
      helper("def.anatomy.subscribeParts(FAMILY, 'item', sync);", prefix),
      entry(),
      false
    );
  });

  it.each(
    operations.flatMap(([name, registration, count]) =>
      [
        ['async', 'const sync = async () => selected.set(true);'],
        ['default parameter', 'const sync = (run = foreign) => selected.set(true);'],
        ['rest parameter', 'const sync = (...args) => selected.set(true);'],
        ['destructured parameter', 'const sync = ({ context }) => selected.set(true);'],
        [
          'too many parameters',
          `const sync = (${Array.from({ length: count + 1 }, (_, i) => `arg${i}`).join(',')}) => selected.set(true);`,
        ],
        ['generator', 'const sync = function* () { selected.set(true); };'],
        ['Def capture', 'const sync = () => { opaque(def); selected.set(true); };'],
        ['State escape', 'const sync = () => opaque(selected);'],
        ['deferred State writer', 'const sync = () => queueMicrotask(() => selected.set(true));'],
        [
          'self binding escape',
          'const sync = function self() { opaque(self); selected.set(true); };',
        ],
      ].map(([label, callback]) => [`${name}: ${label}`, registration, callback!] as const)
    )
  )('keeps the callback boundary for %s', async (_name, registration, callback) => {
    await assertState(helper(registration, identities, callback), entry(), false);
  });

  it.each([
    ['callback alias', "const alias = sync; def.props.watch(['value'], alias);"],
    ['callback reassignment', "sync = foreign; def.props.watch(['value'], sync);"],
    ['callback escape', "def.props.watch(['value'], sync); opaque(sync);"],
    ['callback container', "def.props.watch(['value'], sync); const saved = { sync };"],
  ])('retains the registered helper boundary for %s', async (_name, registration) => {
    await assertState(helper(registration), entry(), false);
  });

  it.each([
    ...operations.map(([name, registration]) => [name, registration] as const),
    ['Event', "def.event.on('pointer.enter', sync);"],
    ['Global Event', "def.event.onGlobal('key.down', sync);"],
    ['optional Context', 'def.context.trySubscribe(KEY, sync);'],
    ['ancestor Context', 'def.context.trySubscribeAncestor(KEY, sync);'],
    ['raw Props', "def.props.watchRaw(['value'], sync);"],
    ['created lifecycle', 'def.lifecycle.onCreated(sync);'],
    ['mounted lifecycle', 'def.lifecycle.onMounted(sync);'],
    ['updated lifecycle', 'def.lifecycle.onUpdated(sync);'],
    ['unmounted lifecycle', 'def.lifecycle.onUnmounted(sync);'],
    ['dispose lifecycle', 'def.lifecycle.onBeforeDispose(sync);'],
  ] as const)(
    'closes a private returned State used by an exact %s callback',
    async (_name, registration) => {
      await assertState(
        helper('', identities, ''),
        entry(
          `const sync = () => { consume(selected.get()); selected.set(true); }; ${registration}`
        ),
        true
      );
    }
  );

  it('retains private identity for setDefault without certifying runtime phase validity', async () => {
    await assertState(
      helper('', identities, ''),
      entry("const sync = () => selected.setDefault(true); def.props.watch(['value'], sync);"),
      true
    );
  });

  it.each([
    ['State argument escape', 'opaque(selected);'],
    ['State container escape', 'const container = { selected };'],
    ['State method replacement', 'selected.get = foreign;'],
    ['State method alias', 'const get = selected.get;'],
    ['optional State get', 'selected.get?.();'],
    ['State get argument', 'selected.get(unknown);'],
    ['State set missing value', 'selected.set();'],
    ['State set extra argument', 'selected.set(true, undefined, unknown);'],
    ['State setDefault extra argument', 'selected.setDefault(true, unknown);'],
    ['State get spread', 'selected.get(...[]);'],
    ['State unknown member', 'selected.unknown();'],
    ['deferred State read', 'queueMicrotask(() => selected.get());'],
    ['callback self return', 'selected.get(); return self;'],
    ['callback self alias', 'const alias = self; selected.get();'],
    ['callback recursion', 'self(); selected.get();'],
  ])('retains the private caller boundary for %s', async (_name, body) => {
    await assertState(
      helper('', identities, ''),
      entry(`const sync = function self() { ${body} }; def.props.watch(['value'], sync);`),
      false
    );
  });

  it.each([
    ['foreign receiver', "foreign.props.watch(['value'], sync);"],
    ['callback in key slot', "def.props.watch(sync, ['value']);"],
    ['wrong raw Props slot', "def.props.watchRaw(sync, ['value']);"],
    ['wrong optional Context slot', 'def.context.trySubscribe(sync, KEY);'],
    ['foreign optional Context key', 'def.context.trySubscribe(foreign, sync);'],
    ['extra lifecycle argument', 'def.lifecycle.onCreated(sync, unknown);'],
    ['callback escape', "def.props.watch(['value'], sync); opaque(sync);"],
    ['callback alias', "const alias = sync; def.props.watch(['value'], alias);"],
  ])(
    'rejects %s for caller State without widening old helper registrations',
    async (_name, registration) => {
      await assertState(
        helper('', identities, ''),
        entry(`const sync = () => selected.get(); ${registration}`),
        false
      );
    }
  );

  it.each([
    ['named callback', 'function self() { selected.get(); }'],
    ['local self shadow', 'function self() { const self = 1; consume(self); selected.get(); }'],
    ['parameter self shadow', 'function self(self) { consume(self); selected.get(); }'],
  ])('closes the exact caller callback binding for %s', async (_name, callback) => {
    await assertState(
      helper('', identities, ''),
      entry(`const sync = ${callback}; def.props.watch(['value'], sync);`),
      true
    );
  });

  it.each([
    ['default parameter', '(run = foreign)'],
    ['rest parameter', '(...args)'],
    ['destructured parameter', '({ context })'],
    ['extra lifecycle parameter', '(run, unknown)'],
  ])('keeps %s outside the new lifecycle caller proof', async (_name, parameters) => {
    await assertState(
      helper('', identities, ''),
      entry(`const sync = ${parameters} => selected.get(); def.lifecycle.onCreated(sync);`),
      false
    );
  });
});
