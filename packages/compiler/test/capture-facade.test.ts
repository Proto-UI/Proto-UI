// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { compilePrototype } from '../src/compile';
import type { PrototypeIR } from '../src/ir';

import { captureFacadeSource as source } from './fixtures/capture-facade';

function parsed(input = source): PrototypeIR {
  const result = parsePrototype(input);
  expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
  if (!result.ok) throw new Error('parse failed');
  return result.value;
}
function walk(value: unknown, visit: (record: Record<string, any>) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((child) => walk(child, visit));
    return;
  }
  visit(value as Record<string, any>);
  Object.values(value).forEach((child) => walk(child, visit));
}

describe('checked public capture facade', () => {
  it('preserves direct capture ownership and typed getter copies in source-free IR', () => {
    const ir = parsed();
    expect(ir.hooks.find((hook) => hook.name === 'facade-parent')?.capture?.states).toEqual([]);
    expect(ir.hooks.find((hook) => hook.name === 'facade-child')?.capture?.events).toEqual([
      'changed',
    ]);
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({ ok: true });
  });

  it.each(['gpui-source-v1', 'web-component-source-v1'] as const)(
    'emits ordinary captured projection source for %s',
    (profile) => {
      const result = compilePrototype(source, { profile });
      expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
    }
  );

  for (const profile of ['gpui-source-v1', 'vue2-source-v1'] as const)
    it.each(['null', "'projected text'", '42'])(
      `${profile} preserves scalar renderer provenance through projected facade spreads: %s`,
      (result) => {
        const input = `import {defineAsHook,definePrototype} from '@proto.ui/core';
          const asContent=defineAsHook({name:'projected-content',
            setup(){return()=>${result};},
            projectHandle(result){const copy={...result};return {...copy};}
          });
          export default definePrototype({name:'projected-render-consumer',setup(){
            const content=asContent();return content.render;
          }});`;
        const output = compilePrototype(input, { profile });
        expect(output.ok, JSON.stringify(output.ok ? null : output.diagnostics)).toBe(true);
        if (output.ok && profile === 'gpui-source-v1')
          expect(output.value.output.code).not.toContain(
            'checked native renderer entry has no scalar callback alternative'
          );
      }
    );

  it('rejects forged getter return metadata instead of trusting the serialized facade', () => {
    const ir = JSON.parse(JSON.stringify(parsed()));
    let changed = 0;
    walk(ir, (node) => {
      if (node.kind === 'member' && node.property === 'getMethod') {
        const types = node.type.kind === 'value-union' ? node.type.members : [node.type];
        for (const type of types)
          if (type.kind === 'callable') {
            type.returnType = 'string';
            type.lookup = [{ key: 'read', type: 'string' }];
            changed++;
          }
      }
    });
    expect(changed).toBeGreaterThan(0);
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('rejects precise lookup claims on an ordinary authored callable', () => {
    const ir = parsed(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'ordinary-lookup-forgery',setup(def){
        def.expose.method('echo',(name:string)=>name);
      }});`);
    expect(validateIR(ir)).toMatchObject({ ok: true });
    let changed = 0;
    walk(ir, (node) => {
      if (
        node.kind === 'function' &&
        node.type.kind === 'callable' &&
        node.type.parameters.length === 1 &&
        node.type.parameters[0].type === 'string' &&
        node.type.returnType === 'string'
      ) {
        // This is a well-formed refinement of the ordinary signature. Only a
        // capture-derived getter can prove the stronger key-specific result.
        node.type.lookup = [{ key: 'chosen', type: { kind: 'literal', value: 'forged' } }];
        changed++;
      }
    });
    expect(changed).toBeGreaterThan(0);
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('rederives captured event keys rather than accepting forged artifacts', () => {
    const ir = JSON.parse(JSON.stringify(parsed()));
    ir.hooks.find((hook: any) => hook.name === 'facade-child').capture.events = ['forged'];
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it.each([
    `def.expose.method('invoke',(f:(key:string)=>number|string)=>f('safe'));`,
    `def.expose.value('invoke',(f:(key:string)=>number|string)=>f('safe'));`,
    `def.expose.method('factory',()=>((f:(key:string)=>number|string)=>f('safe')));`,
    `def.expose.method('invoke',(factory:()=>((key:string)=>number|string))=>factory()('safe'));`,
    `def.expose.method('invoke',(input:{f:(key:string)=>number|string})=>input.f('safe'));`,
  ])('rejects incoming public callable lookup refinements: %s', (body) => {
    const ir = JSON.parse(
      JSON.stringify(
        parsed(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'incoming-lookup-forgery',setup(def){${body}}});`)
      )
    );
    expect(validateIR(ir)).toMatchObject({ ok: true });
    let signatures = 0,
      calls = 0;
    walk(ir, (node) => {
      if (
        node.kind === 'callable' &&
        node.parameters.length === 1 &&
        node.parameters[0].type === 'string'
      ) {
        node.lookup = [{ key: 'safe', type: 'number' }];
        signatures++;
      }
      if (node.kind === 'call' && node.arguments[0]?.value === 'safe') {
        node.type = 'number';
        calls++;
      }
    });
    expect(signatures).toBeGreaterThan(0);
    expect(calls).toBe(1);
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('retains lookup provenance on a real getter returned through the public surface', () => {
    const ir = parsed(`import {defineAsHook,definePrototype} from '@proto.ui/core';
      const asContent=defineAsHook({name:'public-lookup-content',setup(def){
        def.expose.method('read',()=>7);
      },projectHandle(result){return {...result};}});
      export default definePrototype({name:'public-lookup-owner',setup(def){
        const content=asContent();
        def.expose.value('getter',content.getMethod);
        def.expose.method('factory',()=>content.getMethod);
      }});`);
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({ ok: true });
  });

  it.each([
    'return {...result.props};',
    'return {...(result.context as unknown)};',
    'return {value:result.props()};',
  ])('keeps opaque capture buckets opaque: %s', (body) => {
    const result = parsePrototype(`import {defineAsHook,definePrototype} from '@proto.ui/core';
      const asProbe=defineAsHook({name:'probe',setup(){},projectHandle(result){${body}}});
      export default definePrototype({name:'probe-consumer',setup(){asProbe();}});`);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('does not admit capabilities hidden by a narrower JSON projection', () => {
    const input = source.replace(
      "def.expose.value('same',first===again);",
      `
      def.expose.event('leak',{payload:'json'});
      const hide=(value:{tag:string})=>value;
      const payload=hide({...first,tag:'hidden'});
      def.lifecycle.onMounted(run=>run.expose.emit('leak',payload));`
    );
    const result = parsePrototype(input);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.diagnostics[0].message).toMatch(/hide runtime|capabilit|JSON|data/i);
  });
});
