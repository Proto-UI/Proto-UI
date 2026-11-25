import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

describe('actual omitted immutable helper parameters', () => {
  const directories: string[] = [];
  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  async function fixture(
    options: {
      parameter?: string;
      condition?: string;
      prefix?: string;
      suffix?: string;
      caller?: string;
      callbackParameter?: string;
      declarations?: string;
      forwarder?: string;
    } = {}
  ) {
    const directory = await mkdtemp(path.join(tmpdir(), 'pui-omitted-rule-parameter-'));
    directories.push(directory);
    const condition =
      options.condition ??
      'optional ? w.state(state.pressed).eq(true) : w.state(state.checked).eq(true)';
    const files = {
      'paint.ts': `import { tw } from '@proto.ui/core';
        ${options.declarations ?? ''}
        export function paint(def, state, ${options.parameter ?? 'optional'}) {
          ${options.prefix ?? ''}
          def.rule({ when: ${options.callbackParameter ?? 'w'} => ${condition}, intent: i => i.feedback.style.use(tw('bg-lime-500')) });
          ${options.suffix ?? ''}
        }
        ${options.forwarder ?? ''}`,
      'state.ts': `import { defineAsHook } from '@proto.ui/core';
        export const asChecked = defineAsHook({ name:'as-checked', setup(def) {
          const checked=def.state.bool('checked', false); const pressed=def.state.bool('pressed', false);
          def.expose.state('checked', checked); def.expose.state('pressed', pressed);
          return { stateHandles: { checked, pressed } };
        } });`,
      'entry.proto.ts': `import { definePrototype } from '@proto.ui/core'; import { asChecked } from './state'; import { paint${options.forwarder ? ', forward' : ''} } from './paint';
        export default definePrototype({ name:'omitted-consumer', setup(def) {
          const state=asChecked().stateHandles;
          ${options.caller ?? (options.forwarder ? 'forward(def, state);' : 'paint(def, state);')}
        } });`,
    };
    for (const [name, source] of Object.entries(files))
      await writeFile(path.join(directory, name), source);
    const file = path.join(directory, 'entry.proto.ts');
    return {
      inventory: scanRuleStateReadInventory([file]),
      tokens: await collectProtoStyleTokensFromFiles([file]),
    };
  }

  it.each([
    ['false branch', undefined],
    [
      'negated true branch',
      '!optional ? w.state(state.checked).eq(true) : w.state(state.pressed).eq(true)',
    ],
    ['unreached helper branch', 'optional ? unknownCondition(w) : w.state(state.checked).eq(true)'],
  ])('uses only the reached %s for a genuinely omitted value', async (_label, condition) => {
    const { inventory, tokens } = await fixture({ condition });
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated[0].unresolved).toEqual([]);
    expect(inventory.evaluated[0].usages.map((usage) => usage.state)).toEqual(['checked']);
    expect(tokens).toContain('data-[checked]:bg-lime-500');
    expect(tokens.some((token) => token.includes('pressed'))).toBe(false);
  });

  it.each([
    ['supplied unknown identifier', { caller: 'paint(def, state, unknownFlag);' }],
    ['supplied false literal', { caller: 'paint(def, state, false);' }],
    ['supplied undefined spelling', { caller: 'paint(def, state, undefined);' }],
    ['supplied getter', { caller: 'paint(def, state, external.flag);' }],
    ['supplied effect', { caller: 'paint(def, state, unknownEffect());' }],
    ['default effect', { parameter: 'optional = unknownEffect()' }],
    ['default value', { parameter: 'optional = true' }],
    ['rest array', { parameter: '...optional' }],
    ['destructured parameter', { parameter: '{ optional }' }],
    ['direct reassignment', { prefix: 'optional = unknownFlag;' }],
    ['later reassignment', { suffix: 'optional = unknownFlag;' }],
    ['deferred reassignment', { prefix: 'unknownEffect(() => { optional = unknownFlag; });' }],
    ['direct eval', { prefix: "eval('optional = unknownFlag');" }],
    ['spread arguments', { caller: 'paint(...unknownArgs);' }],
    ['spread before an otherwise missing slot', { caller: 'paint(def, ...unknownArgs);' }],
    [
      'callback parameter shadow',
      {
        callbackParameter: 'optional',
        condition:
          'optional ? optional.state(state.pressed).eq(true) : optional.state(state.checked).eq(true)',
      },
    ],
    ['logical branch', { condition: 'optional || w.state(state.checked).eq(true)' }],
  ] as const)('retains the unknown condition for %s', async (_label, options) => {
    const { inventory } = await fixture(options);
    expect(
      inventory.evaluated.flatMap((row) => row.unresolved.map((miss) => miss.reason))
    ).toContain('condition');
  });

  it('keeps each actual caller separate when only one omits the argument', async () => {
    const { inventory } = await fixture({
      caller: 'paint(def, state); paint(def, state, unknownFlag);',
    });
    expect(inventory.evaluated).toHaveLength(2);
    expect(inventory.evaluated[0].unresolved).toEqual([]);
    expect(inventory.evaluated[1].unresolved.map((miss) => miss.reason)).toContain('condition');
    expect(inventory.evaluated[0].callPath).not.toEqual(inventory.evaluated[1].callPath);
  });
  it.each([
    ['third parameter after a spread', 'optional', '...unknownArgs, optional'],
    ['fourth parameter after a spread', 'unused, optional', '...unknownArgs, optional'],
    ['parameter before a trailing spread', 'optional', 'optional, ...unknownArgs'],
  ])(
    'does not transport a captured omission through a %s',
    async (_label, parameter, arguments_) => {
      const { inventory, tokens } = await fixture({
        parameter,
        forwarder: `export function forward(def, state, optional) { paint(def, state, ${arguments_}); }`,
      });
      expect(inventory.evaluated).toHaveLength(1);
      expect(inventory.evaluated[0].unresolved.map((miss) => miss.reason)).toContain('condition');
      expect(inventory.evaluated[0].usages).toEqual([]);
      // Token collection already refuses the entire spread call. It must not
      // publish an apparently precise checked-only selector for this invocation.
      expect(tokens).toEqual([]);
    }
  );

  it('transports an immutable captured omission through a call without spread', async () => {
    const { inventory, tokens } = await fixture({
      forwarder: 'export function forward(def, state, optional) { paint(def, state, optional); }',
    });
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated[0].unresolved).toEqual([]);
    expect(inventory.evaluated[0].usages.map((usage) => usage.state)).toEqual(['checked']);
    expect(tokens).toContain('data-[checked]:bg-lime-500');
    expect(tokens.some((token) => token.includes('pressed'))).toBe(false);
  });
});
