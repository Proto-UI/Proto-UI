import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const returned = 'flag ? w.state(state.ready).eq(true) : w.state(state.focused).eq(true)';
const producer = `
  import { defineAsHook } from '@proto.ui/core';
  export const asFacts = defineAsHook({
    name: 'closed-condition-facts',
    setup(def) { def.state.bool('ready', false); def.state.bool('focused', false); },
    projectHandle: result => ({ ready: result.stateHandles.ready, focused: result.stateHandles.focused }),
  });
`;

describe('all closed condition proofs require a pure returned When callback', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-when-callback-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    await writeFile(path.join(directory, 'producer.ts'), producer);
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const observe = async (mode: 'scalar' | 'omitted', callback: string) => {
    const file = path.join(directory, 'entry.proto.ts');
    const helper = path.join(directory, 'paint.ts');
    await writeFile(
      file,
      `
      import { definePrototype } from '@proto.ui/core';
      import { asFacts } from './producer';
      import { paint } from './paint';
      export default definePrototype({ name: 'closed-callback', setup(def) {
        const state = asFacts();
        paint(def, state${mode === 'scalar' ? ', true' : ''});
      } });
    `
    );
    await writeFile(
      helper,
      `
      import { tw } from '@proto.ui/core';
      function poison(builder) { builder.state = foreign; }
      function erase(bag) { bag.ready = undefined; return true; }
      export function paint(def, state, flag) {
        def.rule({ when: ${callback}, intent: i => i.feedback.style.use(tw('bg-primary')) });
      }
    `
    );
    const files = [file, helper];
    const inventory = scanRuleStateReadInventory(files);
    const rows = inventory.evaluated.filter((row) => row.entryFile === file);
    const tokens = (await collectProtoStyleTokensFromFiles(files)).filter((token) =>
      token.endsWith('bg-primary')
    );
    return { rows, tokens };
  };

  for (const mode of ['scalar', 'omitted'] as const) {
    it(`${mode}: keeps the actual native DSL branch as a positive control`, async () => {
      const { rows, tokens } = await observe(mode, `w => ${returned}`);
      expect(rows).toHaveLength(1);
      expect(rows[0].declarationOnly).toBe(false);
      expect(rows[0].unresolved).toEqual([]);
      expect(tokens).toEqual([
        'bg-primary',
        `data-[${mode === 'scalar' ? 'ready' : 'focused'}]:bg-primary`,
      ]);
    });

    it.each([
      ['builder escape', `w => { poison(w); return ${returned}; }`],
      ['builder method write', `w => { w.state = foreign; return ${returned}; }`],
      ['extra parameter initializer', `(w, extra = erase(state)) => ${returned}`],
      [
        'getter prefix',
        `w => { const holder = { get value() { w.state = foreign; return true; } }; const ignored = holder.value; return ${returned}; }`,
      ],
      ['asynchronous callback', `async w => ${returned}`],
    ])(`${mode}: refuses to prune through %s`, async (_label, callback) => {
      const { rows, tokens } = await observe(mode, callback);
      expect(rows).toHaveLength(1);
      expect(rows[0].declarationOnly).toBe(false);
      expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
      expect(tokens).toEqual(['bg-primary']);
    });
  }
});
