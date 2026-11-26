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
    name: 'when-presence-facts',
    setup(def) {
      def.state.bool('ready', false);
      def.state.bool('focused', false);
    },
    projectHandle: result => ({
      ready: result.stateHandles.ready,
      focused: result.stateHandles.focused,
    }),
  });
`;
const paint = `
  import { tw } from '@proto.ui/core';
  export function paint(def, state, optional) {
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
  export default definePrototype({ name: 'when-state-presence', setup(def) {
    const state = asFacts();
    ${calls}
  } });
`;
const selected = 'data-[focused]:not-[data-ready]:bg-primary';
const fallback = 'data-[focused]:bg-primary';

describe('captured native State existence agrees with production Rule collection', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-when-presence-')));
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

  it('selects a captured State object even when that native State starts false', async () => {
    const { rows, tokens } = await observe();
    expect(rows).toHaveLength(1);
    expect(rows[0].declarationOnly).toBe(false);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages.map(({ state }) => state).sort()).toEqual(['focused', 'ready']);
    expect(rows[0].exposedLocals).toEqual([]);
    expect(tokens).toEqual(['bg-primary', selected]);
  });

  it.each(['state.ready', "state['ready']", '(state.ready satisfies unknown)!'])(
    'reads the native own member through %s',
    async (condition) => {
      const helper = paint.replace('when: w => optional', `when: w => ${condition}`);
      const { rows, tokens } = await observe(entry(), helper);
      expect(rows).toHaveLength(1);
      expect(rows[0].unresolved).toEqual([]);
      expect(tokens).toEqual(['bg-primary', selected]);
    }
  );

  it('keeps an exact omitted parameter on the original false branch', async () => {
    const { rows, tokens } = await observe(entry('paint(def, state);'));
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages.map(({ state }) => state)).toEqual(['focused']);
    expect(tokens).toEqual(['bg-primary', fallback]);
  });

  it('does not reuse a proven first argument for later omitted or unknown activations', async () => {
    const { rows, tokens } = await observe(
      entry(`
      const focused = state.focused;
      const optional = state.ready;
      paint(def, { focused }, optional);
      paint(def, { focused });
      paint(def, { focused }, foreign);
    `)
    );
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.unresolved.length === 0)).toHaveLength(2);
    expect(
      rows.flatMap((row) => row.unresolved).filter((miss) => miss.reason === 'condition')
    ).toHaveLength(1);
    expect(tokens).toContain(selected);
    expect(tokens).toContain(fallback);
  });

  it('keeps the original reused bag withdrawn after a call without a purity proof', async () => {
    const { rows, tokens } = await observe(
      entry('paint(def, state, state.ready); paint(def, state); paint(def, state, foreign);')
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[1].unresolved.length).toBeGreaterThan(0);
    expect(rows[2].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(rows.filter((row) => row.unresolved.length === 0)).toHaveLength(1);
    expect(tokens).toContain(selected);
  });

  it.each([
    ['member write', 'state.ready = foreign;'],
    ['opaque escape', 'poison(state);'],
  ])(
    'shares a fresh bag identity with the mutation tracker for a callee %s',
    async (_label, prefix) => {
      const source = entry(`
      const focused = state.focused;
      const ready = state.ready;
      paint(def, { focused, ready }, ready);
    `);
      const helper = paint
        .replace('    def.rule(', `${prefix} def.rule(`)
        .replace('when: w => optional', 'when: w => state.ready');
      const { rows, tokens } = await observe(source, helper);
      expect(rows).toHaveLength(1);
      expect(rows[0].declarationOnly).toBe(false);
      expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
      expect(tokens).toContain('bg-primary');
      expect(tokens).not.toContain(selected);
    }
  );

  it('negates the existence of the object without reading its stored boolean', async () => {
    const { rows, tokens } = await observe(
      entry(),
      paint.replace('when: w => optional', 'when: w => !optional')
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages.map(({ state }) => state)).toEqual(['focused']);
    expect(tokens).toEqual(['bg-primary', fallback]);
  });

  it.each(['any', 'not'])('keeps a selected %s condition on the runtime plan', async (method) => {
    const helper =
      method === 'any'
        ? paint.replace('w.all(w.state(state.focused)', 'w.any(w.state(state.focused)')
        : paint.replace(
            'w.all(w.state(state.focused).eq(true), w.state(optional).eq(false))',
            'w.not(w.state(optional).eq(false))'
          );
    const { rows, tokens } = await observe(entry(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages).toEqual([]);
    expect(rows[0].exposedLocals).toEqual([]);
    expect(tokens).toEqual(['bg-primary']);
  });

  it('retains both authored Rule sites in statement branches', async () => {
    const rule = paint.slice(paint.indexOf('    def.rule('), paint.indexOf('\n  }'));
    const helper = paint.replace(rule, `if (optional) { ${rule} } else { ${rule} }`);
    const { rows } = await observe(entry(), helper);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => !row.declarationOnly)).toBe(true);
    expect(new Set(rows.map((row) => row.rule.start)).size).toBe(2);
  });

  const returnedWhen = `optional
        ? w.all(w.state(state.focused).eq(true), w.state(optional).eq(false))
        : w.state(state.focused).eq(true)`;
  const arrow = `w => ${returnedWhen}`;

  it.each([
    ['escaped WhenBuilder', `w => { poison(w); return ${returnedWhen}; }`],
    ['written WhenBuilder method', `w => { w.state = foreign; return ${returnedWhen}; }`],
    ['expression receiver write', `w => (w.state = foreign, ${returnedWhen})`],
    [
      'extra parameter initializer',
      `(w, extra = erase(state)) => ${returnedWhen.replace('optional', 'state.ready')}`,
    ],
    ['defaulted builder parameter', `(w = foreign) => ${returnedWhen}`],
    ['rest builder parameter', `(...w) => ${returnedWhen}`],
    ['asynchronous callback', `async w => ${returnedWhen}`],
    ['generator callback', `function* (w) { return ${returnedWhen}; }`],
    ['block body outside this narrow proof', `w => { return ${returnedWhen}; }`],
    ['nested callback instead of a When return', `w => (() => ${returnedWhen})()`],
  ])('does not authorize a new branch through %s', async (_label, callback) => {
    const helper = paint
      .replace(arrow, callback)
      .replace(
        '  export function paint',
        '  function erase(bag) { bag.ready = undefined; return true; }\n  export function paint'
      );
    const { rows, tokens } = await observe(entry(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].declarationOnly).toBe(false);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(tokens).toContain('bg-primary');
    expect(tokens).not.toContain(selected);
  });

  it.each([
    ['native State then native bag', 'choose ? state.ready : state'],
    ['native bag then native State', 'choose ? state : state.ready'],
  ])('checks every candidate of %s, including a const alias', async (_label, initializer) => {
    const { rows, tokens } = await observe(
      entry(`
      const optional = ${initializer};
      paint(def, state, optional);
    `)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(tokens).toContain('bg-primary');
    expect(tokens).not.toContain(selected);
  });

  const scalarPaint = `
    import { tw } from '@proto.ui/core';
    export function paint(def, ready, focused, optional) {
      def.rule({
        when: w => optional ? w.state(ready).eq(true) : w.state(focused).eq(true),
        intent: i => i.feedback.style.use(tw('bg-primary')),
      });
    }
  `;
  it.each([
    [
      'direct effectful argument',
      'paint(def, ready, focused, erase(state) ? state.ready : state.ready);',
    ],
    [
      'effectful initializer hidden behind a const',
      `
      const optional = erase(state) ? state.ready : state.ready;
      paint(def, ready, focused, optional);
    `,
    ],
  ])('does not capture the State from before %s', async (_label, call) => {
    const { rows, tokens } = await observe(
      entry(`
      const ready = state.ready;
      const focused = state.focused;
      function erase(bag) { bag.ready = undefined; return true; }
      ${call}
    `),
      scalarPaint
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].declarationOnly).toBe(false);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(tokens).toContain('bg-primary');
    expect(tokens).not.toContain('data-[ready]:bg-primary');
  });

  it.each([
    [
      'ancestor predicate',
      `getter.condition ? (${returnedWhen}) : w.state(state.focused).eq(true)`,
    ],
    ['earlier When sibling', `w.all(w.meta(getter.condition).eq(true), ${returnedWhen})`],
  ])('does not ignore an effectful getter in an %s', async (_label, when) => {
    const helper = paint
      .replace(
        '    def.rule(',
        `
        const getter = { get condition() { state.ready = undefined; return true; } };
        def.rule(`
      )
      .replace(arrow, `w => ${when}`)
      .replace(
        'when: w => getter.condition ? (optional',
        'when: w => getter.condition ? (state.ready'
      )
      .replace(
        'w.meta(getter.condition).eq(true), optional',
        'w.meta(getter.condition).eq(true), state.ready'
      );
    const { rows, tokens } = await observe(entry(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(tokens).toContain('bg-primary');
    expect(tokens).not.toContain(selected);
  });

  it('keeps a member unknown after a getter reads and writes it before the Rule', async () => {
    const helper = paint
      .replace(
        '    def.rule(',
        `
        const getter = { get condition() { state.ready = undefined; return true; } };
        const ignored = getter.condition;
        def.rule(`
      )
      .replace('when: w => optional', 'when: w => state.ready');
    const { rows, tokens } = await observe(entry(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(tokens).toContain('bg-primary');
    expect(tokens).not.toContain(selected);
  });

  it.each(['extra = erase(state)', '{ extra = erase(state) } = {}'])(
    'does not skip effects in the helper parameter frame: %s',
    async (parameter) => {
      const helper = paint
        .replace(
          '  export function paint',
          '  function erase(bag) { bag.ready = undefined; return true; }\n  export function paint'
        )
        .replace('state, optional)', `state, optional, ${parameter})`)
        .replace('when: w => optional', 'when: w => state.ready');
      const { rows, tokens } = await observe(entry(), helper);
      expect(rows).toHaveLength(1);
      expect(rows[0].declarationOnly).toBe(false);
      expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
      expect(tokens).toContain('bg-primary');
      expect(tokens).not.toContain(selected);
    }
  );

  const memberPaint = paint.replace('when: w => optional', 'when: w => state.ready');
  it.each([
    ['unknown object', entry('paint(def, state, foreign);'), paint],
    ['ordinary object truthiness', entry('paint(def, state, {});'), paint],
    ['entire native handle bag', entry('paint(def, state, state);'), paint],
    [
      'mixed known and unknown candidates',
      entry('paint(def, state, choose ? state.ready : foreign);'),
      paint,
    ],
    [
      'stored State value read',
      entry(),
      paint.replace('when: w => optional', 'when: w => optional.get()'),
    ],
    ['opaque value call', entry('paint(def, state, readUnknown());'), paint],
    [
      'getter argument',
      entry(
        'const holder = { get value() { return state.ready; } }; paint(def, state, holder.value);'
      ),
      paint,
    ],
    [
      'parameter reassignment',
      entry(),
      paint.replace('    def.rule(', 'optional = foreign; def.rule('),
    ],
    [
      'deferred parameter write',
      entry(),
      paint.replace('    def.rule(', 'defer(() => { optional = foreign; }); def.rule('),
    ],
    [
      'defaulted parameter',
      entry(),
      paint.replace('state, optional)', 'state, optional = foreign)'),
    ],
    [
      'direct eval',
      entry(),
      paint.replace('    def.rule(', "eval('optional = foreign'); def.rule("),
    ],
    [
      'dynamic member key',
      entry(),
      memberPaint.replace('when: w => state.ready', 'when: w => state[key]'),
    ],
    [
      'optional member access',
      entry(),
      memberPaint.replace('when: w => state.ready', 'when: w => state?.ready'),
    ],
    [
      'unprojected member',
      entry(),
      memberPaint.replace('when: w => state.ready', 'when: w => state.readOnly'),
    ],
    [
      'own member overwritten before the call',
      entry('state.ready = foreign; paint(def, state, state.ready);'),
      memberPaint,
    ],
    [
      'container escaped to an opaque call',
      entry('poison(state); paint(def, state, state.ready);'),
      memberPaint,
    ],
    [
      'member written by a later argument',
      entry('paint(def, state, state.ready, (state.ready = foreign));'),
      memberPaint,
    ],
    [
      'own member overwritten in the helper',
      entry(),
      memberPaint.replace('    def.rule(', 'state.ready = foreign; def.rule('),
    ],
    [
      'same-spelled callback parameter',
      entry(),
      paint
        .replace('when: w => optional', 'when: optional => optional')
        .replaceAll('w.state', 'optional.state')
        .replaceAll('w.all', 'optional.all'),
    ],
    [
      'State identity compared with a primitive',
      entry(),
      paint.replace('when: w => optional', 'when: w => optional === true'),
    ],
    [
      'array-valued optional spread',
      entry(),
      paint.replace(
        /optional\s*\? w\.all\(w\.state\(state\.focused\)\.eq\(true\), w\.state\(optional\)\.eq\(false\)\)\s*: w\.state\(state\.focused\)\.eq\(true\)/,
        'w.all(w.state(state.focused).eq(true), ...(optional ? [w.state(optional).eq(false)] : []))'
      ),
    ],
  ])('retains the condition gap for %s', async (_label, source, helper) => {
    const { rows, tokens } = await observe(source, helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].declarationOnly).toBe(false);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(tokens).toContain('bg-primary');
  });
});
