import { describe, expect, it } from 'vitest';
import { TsProgramSession, extractModuleIR } from '../src/frontend';
import { getReactLoweringDiagnostics } from '../src/targets/react';
import { verifyModuleIR } from '../src/ir';

const session = new TsProgramSession({ rootDir: process.cwd() });
function extract(source: string) {
  const { program, entryPath } = session.createVirtualProgram(
    'packages/compiler/test/__hir_input__.proto.ts',
    source
  );
  return extractModuleIR(program, entryPath);
}
function prototype(setup: string, extra = '') {
  return extract(`import { definePrototype, tw } from '@proto.ui/core';
    ${extra}
    export default definePrototype<{label: string, enabled: boolean}>({name: 'hir-fixture', setup(def) { ${setup} }});`);
}

describe('Binding and semantic HIR frontend', () => {
  it('retains every factory declaration and resolves a nonescaping const definition object', () => {
    const result = extract(`import {definePrototype} from '@proto.ui/core';
      const options: Parameters<typeof definePrototype>[0] = {name:'hidden',setup(){return r=>r.el('div','hidden');}};
      export const hidden=definePrototype(options);
      export const shown=definePrototype({name:'shown',setup(){return r=>r.el('div','shown');}});`);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir.prototypes.map((proto) => proto.name)).toEqual(['hidden', 'shown']);
    expect(result.ir.prototypes.flatMap((proto) => proto.unlowered ?? [])).toEqual([]);
  });

  it('retains dynamically unresolved definitions in the inventory denominator', () => {
    const result = extract(`import {definePrototype} from '@proto.ui/core';
      declare function options(): Parameters<typeof definePrototype>[0];
      export const hidden=definePrototype(options());
      export const shown=definePrototype({name:'shown',setup(){return r=>r.el('div','shown');}});`);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir.prototypes).toHaveLength(2);
    expect(
      result.ir.prototypes
        .find((proto) => proto.exportName === 'hidden')
        ?.unlowered?.some((gap) => gap.operation === 'prototype-options')
    ).toBe(true);
  });

  it('resolves immutable local aliases of canonical factories', () => {
    const result = extract(`import {definePrototype} from '@proto.ui/core';
      const factory=definePrototype;
      export const hidden=factory({name:'hidden',setup(){return r=>r.el('div','hidden');}});
      export const shown=definePrototype({name:'shown',setup(){return r=>r.el('div','shown');}});`);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir.prototypes.map((proto) => proto.name)).toEqual(['hidden', 'shown']);
  });

  it('never folds the declaration initializer of a mutable function binding', () => {
    const result = extract(`import {definePrototype} from '@proto.ui/core';
      let initial=()=>1;initial=()=>2;
      export default definePrototype({name:'mutable',setup(def){const n=def.state.numberDiscrete('n',initial());return r=>r.el('div',n.get());}});`);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir.prototypes[0].states[0].initialValue).toBeUndefined();
    expect(
      result.ir.prototypes[0].unlowered?.some((gap) => gap.operation === 'module-effect')
    ).toBe(true);
    expect(getReactLoweringDiagnostics(result.ir.prototypes[0]).length).toBeGreaterThan(0);
  });

  it('does not omit executable module variable initializers', () => {
    const result = extract(`import {definePrototype} from '@proto.ui/core';
      const ignored=console.log('observable');
      export default definePrototype({name:'module-effect',setup(){return r=>r.el('div','text');}});`);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.ir.prototypes[0].unlowered?.some((gap) => gap.operation === 'module-effect')
    ).toBe(true);
  });

  it('binds quoted setup methods and distinct shadowed state symbols', () => {
    const result = extract(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'shadow', 'setup'(def){
        const n=def.state.numberDiscrete('outer',0);
        {const n=def.state.numberDiscrete('inner',10);}
        def.event.on('key.down',()=>n.set(n.get()+1));
        return r=>r.el('div',n.get());
      }});`);
    expect(result.diagnostics).toEqual([]);
    const proto = result.ir.prototypes[0];
    expect(proto.states.map((state) => state.name)).toEqual(['outer', 'inner']);
    expect(proto.events[0].body?.[0]).toMatchObject({
      kind: 'state-set',
      stateName: 'outer',
      value: { left: { kind: 'state', name: 'outer' } },
    });
    expect(proto.render).toMatchObject({
      kind: 'reactive-tree',
      root: { children: [{ kind: 'state-read', stateName: 'outer' }] },
    });
    expect(proto.unlowered).toEqual([]);
  });

  it('preserves return completion in setup and rule intent callbacks', () => {
    const result = prototype(
      "def.rule({when:w=>w.t(),intent:i=>{return i.feedback.style.use(tw('p-1'));i.feedback.style.use(tw('p-2'));}});return r=>r.el('div','first');return r=>r.el('div','second');"
    );
    expect(result.diagnostics).toEqual([]);
    const proto = result.ir.prototypes[0];
    expect(proto.render).toMatchObject({ root: { children: [{ kind: 'text', value: 'first' }] } });
    expect(proto.rules[0].styleTokens).toEqual(['p-1']);
  });

  it('resolves factory aliases, folds proven pure helpers, and preserves callback control flow', () => {
    const result = extract(`
      import { definePrototype as prototype } from '@proto.ui/core';
      function initial(): number { return 7; }
      export default prototype({name: 'alias-counter', setup(def) {
        const api = def;
        const count = api.state.numberDiscrete('count', initial());
        api.event.on('key.down', () => {
          const before = count.get();
          if (before >= 9) { count.set(0); return; }
          count.set(before + 1);
        });
        return r => r.el('div', count.get());
      }});
    `);
    expect(result.diagnostics).toEqual([]);
    const ir = result.ir.prototypes[0];
    expect(ir.states[0].initialValue).toBe(7);
    expect(ir.unlowered).toEqual([]);
    expect(ir.events[0].body?.map((statement) => statement.kind)).toEqual([
      'local',
      'if',
      'state-set',
    ]);
    expect(verifyModuleIR(result.ir)).toEqual([]);
    expect(getReactLoweringDiagnostics(ir)).toEqual([]);
  });

  it('does not mistake a literal return type for a proven constant initializer', () => {
    const result = prototype(
      "const count = def.state.numberDiscrete('count', external()); return r => r.el('div', count.get());",
      'declare function external(): 7;'
    );
    expect(result.ir.prototypes[0].states[0].initialValue).toBeUndefined();
    expect(
      result.ir.prototypes[0].unlowered?.some((gap) => gap.operation === 'state.numberDiscrete')
    ).toBe(true);
    expect(getReactLoweringDiagnostics(result.ir.prototypes[0]).length).toBeGreaterThan(0);
  });

  it('retains dynamic setup effects as unsupported instead of hoisting or ignoring them', () => {
    const result = prototype(
      "if (Math.random() > 0.5) { def.state.bool('flag', false); } console.log('side effect'); return r => r.el('div', 'x');"
    );
    const ir = result.ir.prototypes[0];
    expect(ir.states).toHaveLength(0);
    expect(ir.unlowered?.map((gap) => gap.operation)).toContain('setup-control-flow');
    expect(ir.unlowered?.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects conditional styles and arbitrary rule effects without collecting both branches', () => {
    const dynamic = prototype(
      "return r => r.el('div', {style: Math.random() > 0.5 ? tw('p-1') : tw('p-2')}, 'x');"
    );
    expect(dynamic.ir.prototypes[0].render.kind).toBe('dynamic');
    const effect = prototype(
      "def.rule({when: w => w.t(), intent: i => { console.log('effect'); i.feedback.style.use(tw('p-1')); }}); return r => r.el('div', 'x');"
    );
    expect(effect.ir.prototypes[0].unlowered?.some((gap) => gap.operation === 'rule')).toBe(true);
  });

  it('uses the canonical core intrinsic binding instead of accepting a same-named local function', () => {
    const result = extract(
      "const definePrototype = (value: unknown) => value; export default definePrototype({name:'imposter',setup(){}});"
    );
    expect(result.ir.prototypes).toHaveLength(0);
  });

  it('selects defaults latest-first while skipping invalid layers', () => {
    const result = prototype(
      "def.props.define({label:{type:'string',default:'first'},enabled:{type:'boolean',default:true}}); def.props.setDefaults({label:'second'}); def.props.setDefaults({label:7 as any}); return r => r.el('div', r.read.props.get().label);"
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.ir.prototypes[0].props.find((prop) => prop.name === 'label')?.defaultValue).toBe(
      'second'
    );
    expect(result.ir.prototypes[0].unlowered).toEqual([]);
  });

  it('represents lifecycle bodies and resolved next/previous props subscriptions explicitly', () => {
    const result = prototype(
      "def.props.define({label:{type:'string',default:'first'},enabled:{type:'boolean',default:true}}); const changed=def.state.bool('changed',false); def.lifecycle.onCreated(run => { changed.set(run.props.get().enabled); }); def.props.watch(['label'], (run,next,prev) => { changed.set(next.label !== prev.label); }); return r => r.el('div', r.read.props.get().label);"
    );
    expect(result.diagnostics).toEqual([]);
    const ir = result.ir.prototypes[0];
    expect(ir.unlowered).toEqual([]);
    expect(ir.lifecycleHandlers?.[0].phase).toBe('created');
    expect(ir.propWatches?.[0].body[0]).toEqual({
      kind: 'state-set',
      stateName: 'changed',
      value: {
        kind: 'binary',
        operator: '!==',
        left: { kind: 'prop', name: 'label', source: 'current' },
        right: { kind: 'prop', name: 'label', source: 'previous' },
      },
    });
  });

  it('preserves both return branches and real floating point negation in pure helpers', () => {
    const result = prototype(
      "return r => r.el('div', 'x');",
      'function negate(value:number):number { return -value; } function branch(flag:boolean):number { if(flag) {return 1;} else {return 2;} }'
    );
    expect(result.diagnostics).toEqual([]);
    expect(verifyModuleIR(result.ir)).toEqual([]);
    expect(
      result.ir.functions
        .find((fn) => fn.name === 'helper_negate')
        ?.blocks[0].instructions.some((inst) => inst.op === 'fneg')
    ).toBe(true);
    expect(
      result.ir.functions
        .find((fn) => fn.name === 'helper_branch')
        ?.blocks.filter((block) => block.terminator.op === 'ret')
    ).toHaveLength(2);
  });
});
