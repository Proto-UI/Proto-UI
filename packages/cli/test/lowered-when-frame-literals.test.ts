import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const producer = `
  import { defineAsHook } from '@proto.ui/core';
  export const asFacts = defineAsHook({
    name: 'literal-frame-facts',
    setup(def) { def.state.bool('ready', false); def.state.bool('focused', false); },
    projectHandle: result => ({ ready: result.stateHandles.ready, focused: result.stateHandles.focused }),
  });
`;
const paint = `
  import { tw } from '@proto.ui/core';
  export function paint(def, state, optional, fieldControl = false) {
    def.rule({
      when: w => optional
        ? w.all(w.state(state.focused).eq(true), w.state(optional).eq(false))
        : w.state(state.focused).eq(true),
      intent: i => i.feedback.style.use(tw('bg-primary')),
    });
  }
`;
const entry = (calls = 'paint(def, state, state.ready);') => `
  import { definePrototype } from '@proto.ui/core';
  import { asFacts } from './producer';
  import { paint } from './paint';
  export default definePrototype({ name: 'literal-parameter-frame', setup(def) {
    const state = asFacts();
    ${calls}
  } });
`;
const selected = 'data-[focused]:not-[data-ready]:bg-primary';
const fallback = 'data-[focused]:bg-primary';

describe('closed primitive defaults preserve captured Rule State identity', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-when-frame-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    await writeFile(path.join(directory, 'producer.ts'), producer);
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
    const tokens = (await collectProtoStyleTokensFromFiles(files)).filter((token) =>
      token.endsWith('bg-primary')
    );
    return { rows, tokens };
  };

  it.each([
    'false',
    'true',
    '0',
    '3.5',
    "'passive'",
    '`passive`',
    'null',
    '(false satisfies boolean)',
  ])('admits an unrelated closed default %s', async (initializer) => {
    const { rows, tokens } = await observe(
      entry(),
      paint.replace('fieldControl = false', 'fieldControl = ' + initializer)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].declarationOnly).toBe(false);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages.map(({ state }) => state).sort()).toEqual(['focused', 'ready']);
    expect(tokens).toEqual(['bg-primary', selected]);
  });

  it('preserves exact omitted State absence beside a literal default', async () => {
    const { rows, tokens } = await observe(entry('paint(def, state);'));
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages.map(({ state }) => state)).toEqual(['focused']);
    expect(tokens).toEqual(['bg-primary', fallback]);
  });

  it('uses a supplied unrelated argument without borrowing it as a State', async () => {
    const { rows, tokens } = await observe(entry('paint(def, state, state.ready, true);'));
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(tokens).toEqual(['bg-primary', selected]);
  });

  it('forwards the captured State across another passive parameter frame', async () => {
    const helper =
      paint +
      `
      export function forward(def, state, optional, quiet = true) { paint(def, state, optional); }
    `;
    const source = entry('forward(def, state, state.ready);').replace(
      'import { paint }',
      'import { forward }'
    );
    const { rows, tokens } = await observe(source, helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(tokens).toEqual(['bg-primary', selected]);
  });

  it.each([
    [
      'call',
      'fieldControl = erase(state)',
      'function erase(bag) { bag.ready = undefined; return false; }',
    ],
    [
      'getter',
      'fieldControl = holder.value',
      'const holder = { get value() { opaque(); return false; } };',
    ],
    ['alias to a value', 'fieldControl = defaultValue', 'const defaultValue = false;'],
    ['assignment', 'fieldControl = (state.ready = undefined)', ''],
    [
      'destructuring',
      '{ fieldControl = erase(state) } = {}',
      'function erase(bag) { bag.ready = undefined; return false; }',
    ],
    ['rest', '...fieldControl', ''],
  ])('keeps the %s parameter boundary unresolved', async (_name, parameter, prefix) => {
    const helper =
      prefix +
      '\n' +
      paint
        .replace('fieldControl = false', parameter)
        .replace('when: w => optional', 'when: w => state.ready');
    const { rows, tokens } = await observe(entry(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(tokens).toEqual(['bg-primary']);
  });

  it('does not grant a State fact to the defaulted parameter itself', async () => {
    const helper = paint.replace('state, optional,', 'state, optional = null,');
    const { rows, tokens } = await observe(entry(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    // Ordinary proof still rejects this frame. The separate CSS vocabulary
    // retains both complete native-State alternatives without selecting one.
    expect(tokens).toEqual(['bg-primary', fallback, selected]);
  });

  it('keeps a later unknown caller separate from the closed frame', async () => {
    const source = entry(
      'const focused = state.focused; const ready = state.ready; paint(def, { focused }, ready); paint(def, { focused }, foreign);'
    );
    const { rows, tokens } = await observe(source);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.unresolved.length === 0)).toHaveLength(1);
    expect(
      rows.flatMap((row) => row.unresolved).filter((miss) => miss.reason === 'condition')
    ).toHaveLength(1);
    expect(tokens).toEqual(['bg-primary', selected]);
  });
});
