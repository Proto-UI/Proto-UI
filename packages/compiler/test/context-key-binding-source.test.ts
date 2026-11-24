// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitVueSource } from '../src/vue-source';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const keys = `import {createContextKey} from '@proto.ui/core';
export const FIRST=createContextKey<{value:number}>('same-debug-name');
export const OTHER=createContextKey<{value:number}>('same-debug-name');`;
const files = {
  'keys.ts': keys,
  'bridge.ts': `export {FIRST as published} from './keys';`,
};

function source(operation: 'subscribe' | 'trySubscribe', withCallback = true, captured = true) {
  const values =
    operation === 'subscribe'
      ? 'next.value + prev.value'
      : '(next?.value ?? 0) + (prev?.value ?? 0)';
  const setup = `const seen=def.state.numberDiscrete('seen',0);
    def.context.${operation}(KEY${withCallback ? `,(run,next,prev)=>{seen.set(${values});}` : ''});`;
  return `import {definePrototype,defineAsHook} from '@proto.ui/core';
    import {published as KEY} from './bridge';
    ${captured ? `const observe=defineAsHook({name:'ordinary-observer',setup(def){${setup}}});` : ''}
    export default definePrototype({name:'ordinary-consumer',setup(def){${captured ? 'observe();' : setup}}});`;
}

function checked(sourceText: string): PrototypeIR {
  const result = parsePrototype(sourceText, { fileName: 'consumer.proto.ts', files });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  // Exercise the portable carrier, not parser object identity or hidden TS nodes.
  return JSON.parse(JSON.stringify(result.value)) as PrototypeIR;
}

function subscription(ir: PrototypeIR): Extract<ExpressionIR, { kind: 'operation' }> {
  let result: Extract<ExpressionIR, { kind: 'operation' }> | undefined;
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      const node = value as Record<string, unknown>;
      if (
        node.kind === 'operation' &&
        (node.operation === 'context.subscribe' || node.operation === 'context.trySubscribe')
      )
        result = value as typeof result;
      else Object.values(node).forEach(visit);
    }
  };
  visit(ir);
  if (!result) throw new Error('Missing checked subscription');
  return result;
}

describe('Vue checked Context bindings through authored capture', () => {
  for (const operation of ['subscribe', 'trySubscribe'] as const) {
    it.each([true, false])(`lowers captured ${operation} with callback=%s`, (withCallback) => {
      const ir = checked(source(operation, withCallback));
      expect(subscription(ir).arguments[0]).toMatchObject({
        kind: 'context-key',
        keyId: 'keys.ts#FIRST',
      });
      const result = emitVueSource(ir);
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.code.length).toBeGreaterThan(0);
    });

    it(`retains the ordinary ${operation} callback path`, () => {
      const result = emitVueSource(checked(source(operation, true, false)));
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.code.length).toBeGreaterThan(0);
    });
  }

  it('still rejects a counterfeit key with the same public spelling', () => {
    const result = parsePrototype(
      `import {definePrototype,defineAsHook} from '@proto.ui/core';
       const KEY={debugName:'same-debug-name'};
       const observe=defineAsHook({name:'ordinary-observer',setup(def){def.context.subscribe(KEY,()=>{});}});
       export default definePrototype({name:'ordinary-consumer',setup(){observe();}});`,
      { fileName: 'counterfeit.proto.ts' }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.every((entry) => entry.category !== 'compiler-defect')).toBe(true);
      expect(result.diagnostics[0].span.file).toBe('counterfeit.proto.ts');
    }
  });

  it('rejects a forged context identity before target emission', () => {
    const ir = checked(source('subscribe'));
    const key = subscription(ir).arguments[0];
    if (key.kind !== 'context-key') throw new Error('Expected checked declaration input');
    key.keyId = 'keys.ts#missing';
    expect(emitVueSource(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', category: 'invalid-ir' }],
    });
  });

  it('rejects forged callback parameter types before target emission', () => {
    const ir = checked(source('subscribe'));
    const callback = subscription(ir).arguments[1];
    if (callback.kind !== 'function') throw new Error('Expected checked callback input');
    callback.function.parameters[1].type = 'number';
    expect(emitVueSource(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', category: 'invalid-ir' }],
    });
  });
});
