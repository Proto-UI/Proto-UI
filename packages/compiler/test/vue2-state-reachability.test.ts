import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitVue2Source } from '../src/vue2-source';
import { checkTargetOperations, resolveTargetProfile } from '../src/targets';
import type { Vue2SourceOptions } from '../src/vue2-source';

function compile(setup: string, options: Vue2SourceOptions = {}, name = 'ordinary-owner',
  files?: Record<string, string>, imports = '') {
  const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
    import {asFocusable} from '@proto.ui/hooks'; ${imports}
    export default definePrototype({name:${JSON.stringify(name)},setup(def){${setup}}});`,
    {fileName:'entry.proto.ts', files});
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const target = resolveTargetProfile('vue2-source-v1');
  if (!target.ok) throw new Error(JSON.stringify(target.diagnostics));
  const admitted = checkTargetOperations(parsed.value, target.value);
  if (!admitted.ok) throw new Error(JSON.stringify(admitted.diagnostics));
  const emitted = emitVue2Source(parsed.value, options);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  return {output:emitted.value, operations:admitted.value.operations};
}

function expectStateSupport(result: ReturnType<typeof compile>, expected: boolean) {
  // Inspect definitions/initialization, not incidental text in dormant authored bodies.
  const source = ts.createSourceFile('Component.js', result.output.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const bindings = new Map<string, ts.VariableDeclaration>();
  function walk(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) bindings.set(node.name.text, node);
    ts.forEachChild(node, walk);
  }
  walk(source);
  for (const name of ['createState', 'states', 'notifications', 'notifying']) {
    expect(bindings.has(name), `native state support binding ${name}`).toBe(expected);
  }
  const def = bindings.get('def')?.initializer;
  if (!def || !ts.isObjectLiteralExpression(def)) throw new Error('Missing native definition object');
  expect(def.properties.some(property => property.name && ts.isIdentifier(property.name)
    && property.name.text === 'state')).toBe(expected);
  if (expected) {
    expect(result.output.code).toContain("type: 'disconnect', reason: 'unmount'");
    expect(result.output.code).toMatch(/state\.dispose\(\)/);
  }
  expect(result.output.code).toContain('contextScope.dispose()');
  expect(result.output.dependencies.some(d => /@proto\.ui\/(?:runtime|adapter)/.test(d.name))).toBe(false);
}
const plain = `return r=>r.el('span','native');`;

describe('Vue2 reached native state support', () => {
  it.each(['empty', 'Button', 'RenamedComponent'])('omits state support for %s without identity dispatch', name => {
    expectStateSupport(compile(plain, {}, name), false);
  });
  it('does not retain a dormant declaration or its unused alias', () => {
    expectStateSupport(compile(`const dormant=()=>{def.state.bool('unused',false);};
      const alias=dormant; ${plain}`), false);
  });
  it.each([
    ['bool', `def.state.bool('value',false);`],
    ['string', `def.state.string('value','initial');`],
    ['enum', `def.state.enum('value','one',{options:['one','two']});`],
    ['numberDiscrete', `def.state.numberDiscrete('value',0);`],
    ['numberRange', `def.state.numberRange('value',0,{min:0,max:10,clamp:true});`],
  ])('retains the %s declaration and disposal dependency', (kind, statement) => {
    const result = compile(statement + plain);
    expect(result.operations).toContain(`state.${kind}`);
    expectStateSupport(result, true);
  });
  it.each([
    `const create=()=>{def.state.bool('value',false);}; create();`,
    `const create=()=>{def.state.bool('value',false);}; const alias=create; alias();`,
    `const outer=()=>{const inner=()=>{def.state.bool('value',false);}; inner();}; outer();`,
  ])('follows a called helper, value alias or nested closure: %s', setup => {
    const result = compile(setup + plain);
    expect(result.operations).toContain('state.bool');
    expectStateSupport(result, true);
  });
  it('retains state captured by a passed callback and returned renderer', () => {
    const result = compile(`const value=def.state.numberDiscrete('value',0);
      const write=()=>{value.set(value.get()+1);}; def.expose.method('write',()=>write());
      return r=>r.el('output',value.get());`);
    expect(result.operations).toContain('state.set');
    expect(result.operations).toContain('state.get');
    expectStateSupport(result, true);
  });
  it('keeps the existing inline-callback admission boundary explicit', () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'callback-negative',setup(def){
        const value=def.state.numberDiscrete('value',0);
        const write=()=>{value.set(value.get()+1);};
        def.expose.method('write',write);return r=>r.el('output',value.get());
      }});`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.diagnostics.some(d => d.code === 'PUI1005'
      && d.message.includes('inline checked callback'))).toBe(true);
  });
  it('follows state declarations across authored hook files', () => {
    const result = compile(`outer(); ${plain}`, {}, 'hooks', {
      'outer.ts': `import {defineAsHook} from '@proto.ui/core';import {inner} from './inner';
        export const outer=defineAsHook({name:'outer',setup(){inner();}});`,
      'inner.ts': `import {defineAsHook} from '@proto.ui/core';
        export const inner=defineAsHook({name:'inner',setup(def){def.state.bool('value',false);}});`,
    }, `import {outer} from './outer';`);
    expect(result.operations).toContain('state.bool');
    expectStateSupport(result, true);
  });
  it('retains interaction-owned state even without an authored state declaration', () => {
    const result = compile(`const focus=asFocusable();focus.configure({disabled:false}); ${plain}`);
    expect(result.operations.some(op => /^state\.(bool|string|enum|numberDiscrete|numberRange)$/.test(op))).toBe(false);
    expectStateSupport(result, true);
    expect(result.output.code).toContain('createOwnedState:');
    expect(result.output.code).toContain('registerGenericObservedState:');
  });
  it('retains the mixed interaction and authored-state closure', () => {
    expectStateSupport(compile(`const focus=asFocusable();focus.configure({disabled:false});
      const value=def.state.bool('value',false);def.expose.state('value',value); ${plain}`), true);
  });
  it('retains Context data consumption without inventing a local state owner', () => {
    const result = compile(`def.context.subscribe(KEY,(run)=>{run.update();});
      return r=>r.el('output',r.read.context.read(KEY).value);`, {}, 'consumer', {
      'keys.ts': `import {createContextKey} from '@proto.ui/core';export const KEY=createContextKey<{value:number}>('data');`,
    }, `import {KEY} from './keys';`);
    expect(result.operations).toContain('context.subscribe');
    expectStateSupport(result, false);
    expect(result.output.supportingFiles?.some(file => file.path.includes('/context/'))).toBe(true);
  });
  it.each([false,true])('preserves direct SSR-option state demand: %s', stateful => {
    expectStateSupport(compile((stateful ? `def.state.bool('value',false);` : '') + plain, {ssr:true}), stateful);
  });
});
