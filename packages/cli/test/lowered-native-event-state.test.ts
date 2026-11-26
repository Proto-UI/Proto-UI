import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const select = (registration = "def.event.on('pointer.enter', sync);") => `
  export function select(def) {
    const selected = def.state.bool('privateHover', false);
    const sync = () => selected.set(true, 'event');
    ${registration}
    return selected;
  }
`;
const entry = (prefix = '', suffix = '') => `
  import { definePrototype, tw } from '@proto.ui/core';
  import { select } from './selection';
  export default definePrototype({ name: 'private-event-state', setup(def) {
    ${prefix}
    const selected = select(def);
    const ready = def.state.bool('ready', false);
    def.expose.state('ready', ready);
    def.rule({ when: w => w.state(selected).eq(true),
      intent: i => i.feedback.style.use(tw('bg-primary')) });
    def.rule({ when: w => w.state(ready).eq(true),
      intent: i => i.feedback.style.use(tw('text-primary')) });
    ${suffix}
  } });
`;

describe('native Event registration preserves a private returned State', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-native-event-state-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const fixture = async (selection = select(), source = entry()) => {
    const files = await Promise.all(
      Object.entries({ 'selection.ts': selection, 'entry.proto.ts': source }).map(
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

  it.each([
    ['root registration', select()],
    ['global registration', select("def.event.onGlobal('key.down', sync);")],
    ['literal template event', select('def.event.on(`pointer.enter`, sync);')],
    ['exact native Def alias', select("const owner = def; owner.event.on('pointer.enter', sync);")],
    ['literal element access', select("def['event']['on']('pointer.enter', sync);")],
    [
      'two registrations of the same closed callback',
      select("def.event.on('pointer.enter', sync); def.event.onGlobal('key.down', sync);"),
    ],
    [
      'inline callback',
      select("def.event.on('pointer.enter', () => selected.set(true));").replace(
        "const sync = () => selected.set(true, 'event');",
        ''
      ),
    ],
    [
      'both native callback parameters',
      select().replace('const sync = () =>', 'const sync = (run, event) =>'),
    ],
    [
      'synchronous function expression',
      select().replace(
        "const sync = () => selected.set(true, 'event');",
        "const sync = function (run, event) { selected.set(true, 'event'); };"
      ),
    ],
    ['discarded event token', select("const token = def.event.on('pointer.enter', sync);")],
  ])(
    'keeps exact provenance for %s without inventing a private selector',
    async (_label, source) => {
      const { inventory, tokens } = await fixture(source);
      expect(inventory.evaluated).toHaveLength(2);
      expect(inventory.evaluated[0]!.unresolved).toEqual([]);
      expect(inventory.evaluated[0]!.usages).toEqual([]);
      expect(inventory.evaluated[0]!.exposedLocals).toEqual([]);
      expect(inventory.evaluated[1]!.unresolved).toEqual([]);
      expect(tokens).toContain('bg-primary');
      expect(tokens).toContain('data-[ready]:text-primary');
      expect(tokens.some((token) => token.includes('privateHover'))).toBe(false);
    }
  );

  it.each([
    ['unknown event expression', select('def.event.on(unknown, sync);')],
    ['coercive event object', select('def.event.on({ toString() { opaque(); } }, sync);')],
    [
      'event name alias outside this slice',
      select("const type = 'pointer.enter'; def.event.on(type, sync);"),
    ],
    ['template substitution', select('def.event.on(`pointer.${unknown}`, sync);')],
    ['callback in event-name slot', select("def.event.on(sync, 'pointer.enter');")],
    ['callback in options slot', select("def.event.on('pointer.enter', foreign, sync);")],
    ['third host options argument', select("def.event.on('host:click', sync, { capture: true });")],
    ['explicit undefined options', select("def.event.on('pointer.enter', sync, undefined);")],
    ['missing event name', select('def.event.on(sync);')],
    ['unknown event facade operation', select("def.event.onUnknown('pointer.enter', sync);")],
    ['foreign facade receiver', select("foreign.event.on('pointer.enter', sync);")],
    [
      'event facade replacement',
      select("def.event = foreign; def.event.on('pointer.enter', sync);"),
    ],
    [
      'event method replacement',
      select("def.event.on = foreign; def.event.on('pointer.enter', sync);"),
    ],
    ['Def binding replacement', select("def = foreign; def.event.on('pointer.enter', sync);")],
    [
      'Def alias method replacement',
      select("const alias = def; alias.event.on = foreign; def.event.on('pointer.enter', sync);"),
    ],
    ['Def escape', select("opaque(def); def.event.on('pointer.enter', sync);")],
    [
      'callback captures Def',
      select().replace("selected.set(true, 'event')", "(opaque(def), selected.set(true, 'event'))"),
    ],
    ['event facade alias', select("const events = def.event; events.on('pointer.enter', sync);")],
    ['event method alias', select("const on = def.event.on; on('pointer.enter', sync);")],
    ['method call indirection', select("def.event.on.call(def.event, 'pointer.enter', sync);")],
    ['optional registration', select("def.event.on?.('pointer.enter', sync);")],
    ['optional event facade', select("def.event?.on('pointer.enter', sync);")],
    ['spread registration', select("def.event.on(...['pointer.enter', sync]);")],
    ['dynamic method member', select("def.event[method]('pointer.enter', sync);")],
    ['async callback', select().replace('const sync = () =>', 'const sync = async () =>')],
    [
      'default callback parameter',
      select().replace('const sync = () =>', 'const sync = (run = foreign) =>'),
    ],
    [
      'rest callback parameter',
      select().replace('const sync = () =>', 'const sync = (...args) =>'),
    ],
    [
      'destructured callback parameter',
      select().replace('const sync = () =>', 'const sync = ({ context }) =>'),
    ],
    [
      'third callback parameter',
      select().replace('const sync = () =>', 'const sync = (run, ev, extra) =>'),
    ],
    [
      'generator callback',
      select().replace(
        "const sync = () => selected.set(true, 'event');",
        "const sync = function* () { selected.set(true, 'event'); };"
      ),
    ],
    [
      'deferred State writer',
      select().replace(
        "selected.set(true, 'event')",
        "queueMicrotask(() => selected.set(true, 'event'))"
      ),
    ],
    ['callback escape', select("def.event.on('pointer.enter', sync); opaque(sync);")],
    [
      'callback container escape',
      select("def.event.on('pointer.enter', sync); const saved = { sync };"),
    ],
    ['callback alias', select("const listener = sync; def.event.on('pointer.enter', listener);")],
    [
      'callback binding replacement',
      select("sync = foreign; def.event.on('pointer.enter', sync);"),
    ],
    [
      'State escape from callback',
      select().replace("selected.set(true, 'event')", 'opaque(selected)'),
    ],
    ['State returned by callback', select().replace("selected.set(true, 'event')", 'selected')],
    [
      'State method replacement in callback',
      select().replace("selected.set(true, 'event')", '(selected.set = foreign)'),
    ],
    [
      'State method alias in callback',
      select().replace("selected.set(true, 'event')", 'opaque(selected.set)'),
    ],
    ['unknown State member', select().replace("selected.set(true, 'event')", 'selected.unknown()')],
    [
      'foreign callback registration',
      select("def.event.on('pointer.enter', sync); foreign(sync);"),
    ],
  ])('retains the original Rule and unresolved subject for %s', async (_label, source) => {
    const { inventory, tokens } = await fixture(source);
    expect(inventory.evaluated).toHaveLength(2);
    expect(inventory.evaluated[0]!.unresolved).toContainEqual({
      expression: 'selected',
      reason: 'subject',
    });
    expect(tokens).toContain('bg-primary');
    expect(tokens).toContain('data-[ready]:text-primary');
    expect(tokens.some((token) => token.includes('privateHover'))).toBe(false);
  });

  it.each([
    ['foreign helper invocation', entry().replace('select(def)', 'select(foreign)')],
    ['helper invocation after Def escape', entry('opaque(def);')],
    ['escaped caller State', entry('', 'opaque(selected);')],
    ['exposed caller State', entry('', "def.expose.state('publicHover', selected);")],
    ['async helper caller', entry().replace('setup(def)', 'async setup(def)')],
  ])('retains the caller boundary for %s', async (_label, source) => {
    const { inventory } = await fixture(select(), source);
    expect(inventory.evaluated).toHaveLength(2);
    expect(inventory.evaluated[0]!.unresolved).toContainEqual({
      expression: 'selected',
      reason: 'subject',
    });
  });

  it('does not use a separate native helper invocation to certify a foreign one', async () => {
    const source = entry(
      '',
      `
      const foreignSelected = select(foreign);
      def.rule({ when: w => w.state(foreignSelected).eq(true),
        intent: i => i.feedback.style.use(tw('outline-2')) });
    `
    );
    const { inventory, tokens } = await fixture(select(), source);
    expect(inventory.evaluated).toHaveLength(3);
    expect(inventory.evaluated[0]!.unresolved).toEqual([]);
    expect(inventory.evaluated[2]!.unresolved).toContainEqual({
      expression: 'foreignSelected',
      reason: 'subject',
    });
    expect(tokens).toContain('data-[ready]:text-primary');
    expect(tokens.some((token) => token.includes('privateHover'))).toBe(false);
  });

  it.each([
    [
      'inline named callback',
      "def.event.on('pointer.enter', function writer() { selected.set(true); });",
    ],
    [
      'const named callback',
      "const sync = function writer() { selected.set(true); }; def.event.on('pointer.enter', sync);",
    ],
    [
      'local shadow of the self name',
      "def.event.on('pointer.enter', function writer() { const writer = 0; opaque(writer); selected.set(true); });",
    ],
    [
      'parameter shadow of the self name',
      "def.event.on('pointer.enter', function writer(writer) { opaque(writer); selected.set(true); });",
    ],
  ])('closes the exact self binding for %s', async (_label, registration) => {
    const selection = `export function select(def) {
      const selected = def.state.bool('privateHover', false);
      ${registration}
      return selected;
    }`;
    const { inventory, tokens } = await fixture(selection);
    expect(inventory.evaluated).toHaveLength(2);
    expect(inventory.evaluated[0]!.unresolved).toEqual([]);
    expect(tokens).toContain('data-[ready]:text-primary');
    expect(tokens.some((token) => token.includes('privateHover'))).toBe(false);
  });

  it.each([
    [
      'inline self escape',
      "def.event.on('pointer.enter', function writer() { opaque(writer); selected.set(true); });",
    ],
    [
      'const self escape',
      "const sync = function writer() { opaque(writer); selected.set(true); }; def.event.on('pointer.enter', sync);",
    ],
    [
      'returned self binding',
      "def.event.on('pointer.enter', function writer() { selected.set(true); return writer; });",
    ],
    [
      'self binding alias',
      "def.event.on('pointer.enter', function writer() { const alias = writer; selected.set(true); });",
    ],
    [
      'recursive self call',
      "def.event.on('pointer.enter', function writer() { writer(); selected.set(true); });",
    ],
    [
      'self shorthand container',
      "def.event.on('pointer.enter', function writer() { const saved = { writer }; selected.set(true); });",
    ],
    [
      'nested self escape',
      "def.event.on('pointer.enter', function writer() { const later = () => opaque(writer); selected.set(true); });",
    ],
    [
      'self member read outside the bounded proof',
      "def.event.on('pointer.enter', function writer() { opaque(writer.name); selected.set(true); });",
    ],
    [
      'Props callback self escape',
      "def.props.watchRaw(['ready'], function writer() { opaque(writer); selected.set(true); });",
    ],
    [
      'Context callback self escape',
      'def.context.trySubscribe(KEY, function writer() { opaque(writer); selected.set(true); });',
    ],
    [
      'ancestor callback self escape',
      'def.context.trySubscribeAncestor(KEY, function writer() { opaque(writer); selected.set(true); });',
    ],
    [
      'lifecycle callback self escape',
      'def.lifecycle.onCreated(function writer() { opaque(writer); selected.set(true); });',
    ],
  ])('retains the callback self-binding boundary for %s', async (_label, registration) => {
    const selection = `const KEY = { id: 'private-event-state' };
      export function select(def) {
        const selected = def.state.bool('privateHover', false);
        ${registration}
        return selected;
      }`;
    const { inventory, tokens } = await fixture(selection);
    expect(inventory.evaluated).toHaveLength(2);
    expect(inventory.evaluated[0]!.unresolved).toContainEqual({
      expression: 'selected',
      reason: 'subject',
    });
    expect(tokens).toContain('data-[ready]:text-primary');
    expect(tokens.some((token) => token.includes('privateHover'))).toBe(false);
  });

  it.each([
    ['item', [{ expression: 'expanded', reason: 'subject' }]],
    ['link', [{ expression: 'expanded', reason: 'subject' }]],
    ['trigger', []],
  ])('preserves all real Navigation Menu %s Rule visits', (name, unresolved) => {
    const file = path.join(ROOT, `packages/prototypes/shadcn/src/navigation-menu/${name}.proto.ts`);
    const inventory = scanRuleStateReadInventory([file]);
    expect(inventory.evaluated).toHaveLength(35);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual(unresolved);
  });
});
