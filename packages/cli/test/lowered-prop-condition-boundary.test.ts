import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CapsVault } from '@proto.ui/module-base';
import type { RuleExtension, RuleIR } from '@proto.ui/module-rule';
import { createWhenBuilder } from '../../modules/rule/src/when-builder';
import { createRuleExposeStateWebModule } from '../../modules/rule-expose-state-web/src/create';
import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const producer = `import {defineAsHook} from '@proto.ui/core';
 export const asFacts=defineAsHook({name:'prop-condition-facts',
 setup(def){def.state.bool('ready',false);def.state.bool('focused',false);},
 projectHandle:r=>({ready:r.stateHandles.ready,focused:r.stateHandles.focused})});`;
const paint = `import {tw} from '@proto.ui/core';
 export function paint(def,state,command) {
   def.rule({
     when:w=>command==='trigger'
       ? w.all(w.prop('presentation').eq('default'),w.state(state.ready).eq(true))
       : w.state(state.ready).eq(true),
     intent:i=>i.feedback.style.use(tw('bg-primary'))
   });
 }`;
const source = (calls = "paint(def,state,'trigger');") => `
 import{definePrototype}from'@proto.ui/core';import{asFacts}from'./producer';import{paint}from'./paint';
 export default definePrototype({name:'prop-conditional',setup(def){
   const state=asFacts();${calls}
 }});`;
const staticToken = 'data-[ready]:bg-primary';

describe('closed conditional prop dependencies retain the native runtime boundary', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-when-prop-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    await writeFile(path.join(directory, 'producer.ts'), producer);
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const observe = async (entry = source(), helper = paint) => {
    const file = path.join(directory, 'entry.proto.ts'),
      helperFile = path.join(directory, 'paint.ts');
    await writeFile(file, entry);
    await writeFile(helperFile, helper);
    const files = [file, helperFile],
      inventory = scanRuleStateReadInventory(files);
    expect(inventory.files).toEqual(files);
    return {
      rows: inventory.evaluated.filter((row) => row.entryFile === file),
      tokens: (await collectProtoStyleTokensFromFiles(files)).filter((token) =>
        token.endsWith('bg-primary')
      ),
    };
  };

  it.each(['trigger', 'close'])(
    'matches actual Rule lowering for the %s branch',
    async (command) => {
      const builder = createWhenBuilder();
      const ready = { __stateId: 'ready' };
      const when =
        command === 'trigger'
          ? builder.w.all(
              builder.w.prop('presentation').eq('default'),
              builder.w.state(ready as any).eq(true)
            )
          : builder.w.state(ready as any).eq(true);
      const rules: RuleIR<any>[] = [
        {
          id: 1,
          deps: builder.getDeps(),
          when,
          intent: {
            kind: 'ops',
            ops: [
              { kind: 'feedback.style.use', handles: [{ kind: 'tw', tokens: ['bg-primary'] }] },
            ],
          },
        },
      ];
      let extension!: RuleExtension<any>;
      const contributions = new Set<string>();
      const instance = createRuleExposeStateWebModule({
        init: { prototypeName: 'prop-condition-runtime', declarations: [] },
        caps: new CapsVault(),
        deps: {
          requirePort: (name: string) =>
            ({
              rule: {
                exportIR: () => rules,
                registerExtension: (value: RuleExtension<any>) => {
                  extension = value;
                },
              },
              'expose-state-web': {
                getExposedStateMap: () =>
                  new Map([
                    ['ready', { stateId: 'ready', key: 'ready', kind: 'bool', attr: 'data-ready' }],
                  ]),
                isActive: () => true,
              },
              feedback: {
                useStyleUnsafe: (handle: { tokens: string[] }) => {
                  const token = handle.tokens.join(' ');
                  contributions.add(token);
                  return () => {
                    contributions.delete(token);
                  };
                },
              },
            })[name],
        } as any,
      });
      try {
        instance.hooks?.onMountPhase?.('mounted', 1);
        instance.hooks?.afterRenderCommit?.();
        const { rows, tokens } = await observe(source("paint(def,state,'" + command + "');"));
        expect(rows).toHaveLength(1);
        expect(rows[0].declarationOnly).toBe(false);
        expect(rows[0].unresolved).toEqual([]);
        expect(extension.transformRules!(rules, { props: {} }).map((rule) => rule.id)).toEqual(
          command === 'trigger' ? [1] : []
        );
        expect([...contributions]).toEqual(command === 'trigger' ? [] : [staticToken]);
        expect(rows[0].usages.map(({ state }) => state)).toEqual(
          command === 'trigger' ? [] : ['ready']
        );
        expect(tokens).toEqual(
          command === 'trigger' ? ['bg-primary'] : ['bg-primary', staticToken]
        );
      } finally {
        instance.hooks?.dispose?.();
      }
    }
  );

  it('keeps different helper activations and an unknown caller separate', async () => {
    const entry = source(`
     const ready=state.ready;
     paint(def,{ready},'trigger');
     paint(def,{ready},'close');
     paint(def,{ready},unknownCommand);
   `);
    const { rows, tokens } = await observe(entry);
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.unresolved.length === 0)).toHaveLength(2);
    expect(
      rows.flatMap((row) => row.unresolved).filter((miss) => miss.reason === 'condition')
    ).toHaveLength(1);
    expect(tokens).toEqual(['bg-primary', staticToken]);
  });

  it('does not emit a partial selector for a nonconditional prop-and-State rule', async () => {
    const helper = paint.replace(
      /command==='trigger'[\s\S]*?: w.state\(state.ready\).eq\(true\)/,
      "w.all(w.prop('presentation').eq('default'),w.state(state.ready).eq(true))"
    );
    const { rows, tokens } = await observe(source(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages).toEqual([]);
    expect(tokens).toEqual(['bg-primary']);
  });

  it('retains a nested selected prop condition on the runtime plan', async () => {
    const helper = paint
      .replace(
        "when:w=>command==='trigger'",
        "when:w=>w.all(w.state(state.focused).eq(true), command==='trigger'"
      )
      .replace(': w.state(state.ready).eq(true),', ': w.state(state.ready).eq(true)),');
    const { rows, tokens } = await observe(source(), helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toEqual([]);
    expect(rows[0].usages).toEqual([]);
    expect(tokens).toEqual(['bg-primary']);
  });

  it.each([
    ['unknown command', source('paint(def,state,unknownCommand);'), paint],
    [
      'foreign prop receiver',
      source(),
      paint.replace("w.prop('presentation')", "foreign.prop('presentation')"),
    ],
    [
      'optional prop call',
      source(),
      paint.replace("w.prop('presentation')", "w.prop?.('presentation')"),
    ],
    ['effectful key', source(), paint.replace("w.prop('presentation')", 'w.prop(readKey())')],
    ['effectful comparison', source(), paint.replace(".eq('default')", '.eq(readExpected())')],
    ['getter key', source(), paint.replace("w.prop('presentation')", 'w.prop(holder.key)')],
    ['defaulted builder', source(), paint.replace('when:w=>', 'when:(w=foreign)=>')],
    ['rest builder', source(), paint.replace('when:w=>', 'when:(...w)=>')],
    [
      'unknown builder operation',
      source(),
      paint.replace("w.prop('presentation')", "w.foreign('presentation')"),
    ],
    [
      'effectful helper default',
      source(),
      paint.replace('state,command)', 'state,command,extra=opaque())'),
    ],
  ])('keeps %s unresolved without a fabricated prefix', async (_name, entry, helper) => {
    const { rows, tokens } = await observe(entry, helper);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved.some((miss) => miss.reason === 'condition')).toBe(true);
    expect(tokens).toEqual(['bg-primary']);
  });
});
