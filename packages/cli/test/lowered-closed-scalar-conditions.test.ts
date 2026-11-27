import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const paint = `
  import { tw } from '@proto.ui/core';
  export function paint(def, ready, secondary, kind) {
    const trigger = kind === 'trigger';
    def.rule({
      when: w => trigger ? w.state(ready).eq(true)
        : w.all(w.state(ready).eq(true), w.state(secondary).eq(true)),
      intent: i => i.feedback.style.use(tw('bg-primary')),
    });
  }
`;
const entry = (calls = "paint(def, ready, secondary, 'trigger');") => `
  import { definePrototype } from '@proto.ui/core';
  import { paint } from './paint';
  export default definePrototype({ name: 'closed-scalar-condition', setup(def) {
    const ready = def.state.bool('primaryFlag', false);
    const secondary = def.state.bool('secondaryFlag', false);
    def.expose.state('publicReady', ready);
    def.expose.state('publicSecondary', secondary);
    ${calls}
  } });
`;

describe('closed scalar Rule conditions agree with the production collector', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-rule-scalar-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const observe = async (source = entry(), helper = paint) => {
    const file = path.join(directory, 'entry.proto.ts');
    const helperFile = path.join(directory, 'paint.ts');
    await writeFile(file, source);
    await writeFile(helperFile, helper);
    const files = [file, helperFile];
    const inventory = scanRuleStateReadInventory(files);
    expect(inventory.files).toEqual(files);
    const rows = inventory.evaluated.filter((row) => row.entryFile === file);
    const tokens = await collectProtoStyleTokensFromFiles(files);
    return { rows, tokens };
  };

  it.each([
    ['direct trigger literal', "paint(def, ready, secondary, 'trigger');", true],
    ['direct link literal', "paint(def, ready, secondary, 'link');", false],
    ['stable caller alias', "const kind = 'trigger'; paint(def, ready, secondary, kind);", true],
  ] as const)('selects only the actual branch for %s', async (_label, call, trigger) => {
    const { rows, tokens } = await observe(entry(call));
    expect(rows).toHaveLength(1);
    expect(rows[0].declarationOnly).toBe(false);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages).toEqual([]);
    expect(rows[0].exposedLocals).toHaveLength(trigger ? 1 : 2);
    expect(tokens.filter((token) => token.endsWith('bg-primary'))).toEqual([
      'bg-primary',
      trigger
        ? 'data-[primary-flag]:bg-primary'
        : 'data-[primary-flag]:data-[secondary-flag]:bg-primary',
    ]);
  });

  it('follows a stable scalar alias in the callee without carrying an object capability', async () => {
    const helper = paint.replace(
      "const trigger = kind === 'trigger';",
      "const alias = kind; const trigger = (alias === 'trigger') satisfies boolean;"
    );
    const { rows, tokens } = await observe(entry(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(tokens.filter((token) => token.endsWith('bg-primary'))).toEqual([
      'bg-primary',
      'data-[primary-flag]:bg-primary',
    ]);
  });

  it.each([true, false])('captures the actual boolean argument %s', async (value) => {
    const helper = paint.replace("const trigger = kind === 'trigger';", 'const trigger = !!kind;');
    const { rows, tokens } = await observe(
      entry(`paint(def, ready, secondary, ${value});`),
      helper
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(tokens.filter((token) => token.endsWith('bg-primary'))).toEqual([
      'bg-primary',
      value
        ? 'data-[primary-flag]:bg-primary'
        : 'data-[primary-flag]:data-[secondary-flag]:bg-primary',
    ]);
  });

  it('keeps separate helper activations separate, including an unknown caller', async () => {
    const { rows, tokens } = await observe(
      entry("paint(def, ready, secondary, 'trigger'); paint(def, ready, secondary, unknownKind);")
    );
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.unresolved.length === 0)).toHaveLength(1);
    expect(rows.flatMap((row) => row.unresolved).some((miss) => miss.reason === 'condition')).toBe(
      true
    );
    expect(tokens).toContain('data-[primary-flag]:bg-primary');
  });

  it('uses a captured omission in a short-circuit predicate without reading its skipped branch', async () => {
    const helper = paint.replace(
      "const trigger = kind === 'trigger';",
      'const trigger = kind && unknownTest();'
    );
    const { rows, tokens } = await observe(entry('paint(def, ready, secondary);'), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(tokens.filter((token) => token.endsWith('bg-primary'))).toEqual([
      'bg-primary',
      'data-[primary-flag]:data-[secondary-flag]:bg-primary',
    ]);
  });

  it('does not fabricate selectors for a selected runtime-only any condition', async () => {
    const helper = paint.replace(
      'trigger ? w.state(ready).eq(true)\n        : w.all(w.state(ready).eq(true), w.state(secondary).eq(true))',
      'trigger ? w.any(w.state(ready).eq(true), w.state(secondary).eq(true))\n        : w.state(ready).eq(true)'
    );
    const { rows, tokens } = await observe(entry(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages).toEqual([]);
    expect(rows[0].exposedLocals).toEqual([]);
    expect(tokens.filter((token) => token.endsWith('bg-primary'))).toEqual(['bg-primary']);
  });

  it.each(['trigger', 'link'])(
    'selects a finite spread from the captured %s value',
    async (kind) => {
      const helper = paint.replace(
        'trigger ? w.state(ready).eq(true)\n        : w.all(w.state(ready).eq(true), w.state(secondary).eq(true))',
        "w.all(w.state(ready).eq(true), ...(kind === 'trigger' ? [] : [w.state(secondary).eq(true)]))"
      );
      const { rows, tokens } = await observe(
        entry(`paint(def, ready, secondary, '${kind}');`),
        helper
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].unresolved).toEqual([]);
      expect(tokens.filter((token) => token.endsWith('bg-primary'))).toEqual([
        'bg-primary',
        kind === 'trigger'
          ? 'data-[primary-flag]:bg-primary'
          : 'data-[primary-flag]:data-[secondary-flag]:bg-primary',
      ]);
    }
  );

  it('retains every inline boolean row without borrowing an unproved stable binding', async () => {
    const source = entry()
      .replace(
        "paint(def, ready, secondary, 'trigger');",
        `for (const selected of [false, true]) {
        def.rule({
          when: w => selected ? w.state(ready).eq(true)
            : w.all(w.state(ready).eq(true), w.state(secondary).eq(true)),
          intent: i => i.feedback.style.use(tw('bg-primary')),
        });
      }`
      )
      .replace('import { definePrototype }', 'import { definePrototype, tw }');
    const { rows, tokens } = await observe(source, 'export {};');
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => !row.declarationOnly)).toBe(true);
    expect(new Set(rows.map((row) => row.rule.start)).size).toBe(1);
    // The ordinary stable-binding proof still rejects a for-of initialization.
    // The separate per-iteration scalar capability selects these exact rows.
    expect(rows.map((row) => row.unresolved)).toEqual([[], []]);
    expect(rows.map((row) => row.exposedLocals.length)).toEqual([2, 1]);
    expect(tokens.filter((token) => token.endsWith('bg-primary'))).toEqual([
      'bg-primary',
      'data-[primary-flag]:bg-primary',
      'data-[primary-flag]:data-[secondary-flag]:bg-primary',
    ]);
  });

  it('retains finite profile rows when the induction-binding proof remains unavailable', async () => {
    const source = entry()
      .replace(
        "paint(def, ready, secondary, 'trigger');",
        `const mode = def.state.enum('mode', 'classic', { options: ['classic', 'modern'] });
      def.expose.state('publicMode', mode);
      for (const profile of ['classic', 'modern'] as const) {
        def.rule({
          when: w => w.all(w.state(mode).eq(profile),
            ...(profile === 'classic' ? [] : [w.state(ready).eq(true)])),
          intent: i => i.feedback.style.use(tw('bg-primary')),
        });
      }`
      )
      .replace('import { definePrototype }', 'import { definePrototype, tw }');
    const { rows, tokens } = await observe(source, 'export {};');
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => !row.declarationOnly)).toBe(true);
    expect(new Set(rows.map((row) => row.rule.start)).size).toBe(1);
    expect(rows.map((row) => row.unresolved)).toEqual([[], []]);
    expect(rows.map((row) => row.exposedLocals.length)).toEqual([1, 2]);
    expect(tokens.filter((token) => token.endsWith('bg-primary'))).toEqual([
      'bg-primary',
      'data-[mode=classic]:bg-primary',
      'data-[mode=modern]:data-[primary-flag]:bg-primary',
    ]);
  });

  it.each([
    ['unknown argument', entry('paint(def, ready, secondary, unknownKind);'), paint],
    [
      'side-effecting argument',
      entry("paint(def, ready, secondary, (mutate(), 'trigger'));"),
      paint,
    ],
    [
      'parameter reassignment',
      entry(),
      paint.replace('const trigger =', "kind = 'link'; const trigger ="),
    ],
    [
      'deferred parameter write',
      entry(),
      paint.replace('const trigger =', "defer(() => { kind = 'link'; }); const trigger ="),
    ],
    ['mutable predicate', entry(), paint.replace('const trigger =', 'let trigger =')],
    [
      'predicate before initialization',
      entry(),
      paint
        .replace("const trigger = kind === 'trigger';", '')
        .replace('    });', "    }); const trigger = kind === 'trigger';"),
    ],
    ['coercive equality', entry(), paint.replace("kind === 'trigger'", "kind == 'trigger'")],
    ['opaque test call', entry(), paint.replace("kind === 'trigger'", 'testKind(kind)')],
    ['member getter', entry(), paint.replace("kind === 'trigger'", "kind.value === 'trigger'")],
    [
      'defaulted parameter',
      entry(),
      paint.replace('secondary, kind)', "secondary, kind = 'trigger')"),
    ],
    [
      'direct eval',
      entry(),
      paint.replace('const trigger =', "eval('kind = external'); const trigger ="),
    ],
    [
      'shadowed callback parameter',
      entry(),
      paint
        .replace('when: w => trigger', 'when: kind => kind')
        .replaceAll('w.state', 'kind.state')
        .replaceAll('w.all', 'kind.all'),
    ],
  ])('keeps the original condition gap for %s', async (_label, source, helper) => {
    const { rows, tokens } = await observe(source, helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].declarationOnly).toBe(false);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(tokens).toContain('bg-primary');
  });
});
