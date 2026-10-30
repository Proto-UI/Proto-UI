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
    const result = compile(`const dormant=()=>{def.state.bool('unused',false);};
      const alias=dormant; const again=alias; ${plain}`);
    expectStateSupport(result, false);
    const source = ts.createSourceFile('Component.js', result.output.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) names.add(node.name.text);
      ts.forEachChild(node, visit);
    };
    const setupBodies: ts.Block[] = [];
    const findSetup = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.arguments.length === 1 &&
          ts.isPropertyAccessExpression(node.arguments[0]) && node.arguments[0].name.text === 'def') {
        let callee: ts.Expression = node.expression;
        while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
        if (ts.isArrowFunction(callee) && ts.isBlock(callee.body)) setupBodies.push(callee.body);
      }
      ts.forEachChild(node, findSetup);
    };
    findSetup(source);
    expect(setupBodies).toHaveLength(1);
    // Native owner helpers have their own legitimate local `again` binding.
    // Inspect the authored setup scope, not every binding in the whole module.
    visit(setupBodies[0]);
    for (const name of ['dormant', 'alias', 'again']) expect(names.has(name)).toBe(false);
  });
  it('omits an authored hook after an unconditional setup return', () => {
    const result = compile(`${plain} unused();`, {}, 'unused-hook', {
      'unused.ts': `import {defineAsHook} from '@proto.ui/core';
        export const unused=defineAsHook({name:'not-a-component-rule',setup(def){def.state.bool('unused',false);}});`,
    }, `import {unused} from './unused';`);
    expectStateSupport(result, false);
    const source = ts.createSourceFile('Component.js', result.output.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const helpers: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /(?:Hook[0-9]+|HookResults)$/.test(node.name.text)) helpers.push(node.name.text);
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(helpers).toEqual([]);
  });
  it('retains existing rejection of authored hooks in callback-phase helpers', () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      import {unused} from './unused';
      export default definePrototype({name:'hook-phase-negative',setup(def){
        const dormant=()=>unused(); ${plain}
      }});`, {fileName:'entry.proto.ts', files:{
        'unused.ts': `import {defineAsHook} from '@proto.ui/core';
          export const unused=defineAsHook({name:'ordinary-hook',setup(def){}});`,
      }});
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.diagnostics.some(d => d.code === 'PUI1007')).toBe(true);
  });
  it.each([
    `const x=()=>{}; if(true){const x=x;}`,
    `const x=()=>{}; if(true){const x=7;const alias=x;}`,
    `const x=x;`,
    `const alias=x;const x=7;`,
  ])('retains existing rejection of shadowing or TDZ-like unbound input: %s', setup => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'lexical-negative',setup(def){${setup} ${plain}}});`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.diagnostics.some(d => d.code === 'PUI1005')).toBe(true);
  });
  it('does not emit statements after an unconditional return', () => {
    const result = compile(`${plain} const unreachable=def.state.bool('unreachable',false);`);
    expectStateSupport(result, false);
    expect(result.output.code).not.toContain('const unreachable =');
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

function expectPortalSupport(result: ReturnType<typeof compile>, expected: boolean) {
  const source = ts.createSourceFile('Component.js', result.output.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const owners = source.statements.filter(ts.isFunctionDeclaration).filter(node => node.name?.text.endsWith('CreateOwner'));
  expect(owners).toHaveLength(1);
  const bindings = new Set<string>(), calls = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) bindings.add(node.name.text);
    if (ts.isFunctionDeclaration(node) && node.name) bindings.add(node.name.text);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.add(node.expression.text);
    ts.forEachChild(node, visit);
  };
  visit(owners[0]);
  for (const name of ['portalAnchor', 'portalRoot', 'syncPortal', 'restorePortal']) expect(bindings.has(name), name).toBe(expected);
  for (const name of ['syncPortal', 'restorePortal']) expect(calls.has(name), `${name} call`).toBe(expected);
  // Non-trigger generated owners remain real prototype boundaries; this patch
  // does not erase Context/logical-parent identity to reduce helper bytes.
  expect(result.output.code).toContain('contextScope.dispose()');
}

describe('Vue2 reached Portal host moves', () => {
  it.each(['empty', 'Overlay', 'Button'])('does not infer Portal from the component name %s', name => {
    expectPortalSupport(compile(plain, {}, name), false);
  });
  it('omits Portal for state-only output and its SSR option', () => {
    for (const options of [{}, {ssr:true}]) expectPortalSupport(compile(`def.state.bool('value',false);${plain}`,options), false);
  });
  it('omits Portal for a context subscriber without interaction', () => {
    const result=compile(`def.context.subscribe(KEY,(run)=>run.update());return r=>r.el('output',r.read.context.read(KEY).value);`,{},'context',{
      'keys.ts':`import {createContextKey} from '@proto.ui/core';export const KEY=createContextKey<{value:number}>('key');`,
    },`import {KEY} from './keys';`);
    expectPortalSupport(result,false);
  });
  it('keeps focus interaction while omitting unreachable Portal host moves', () => {
    const result=compile(`const focus=asFocusable();focus.configure({disabled:false});${plain}`);
    expect(result.operations).toContain('hook.asFocusable');
    expect(result.output.supportingFiles?.some(file=>file.path.includes('/interaction/'))).toBe(true);
    expectPortalSupport(result,false);
  });
  it('omits an Overlay operation after the unconditional setup return', () => {
    const result=compile(`${plain} asOverlay();`,{},'dormant',undefined,`import {asOverlay} from '@proto.ui/hooks';`);
    expect(result.operations).not.toContain('hook.asOverlay');
    expectPortalSupport(result,false);
  });
  it('retains reached imported Overlay aliases and captured runtime handle reads', () => {
    const result=compile(`const overlay=renamed();overlay.configure({portal:true,defaultOpen:true});
      def.expose.method('isOpen',()=>overlay.isOpen());${plain}`,{},'renamed',undefined,
      `import {asOverlay as renamed} from '@proto.ui/hooks';`);
    expect(result.operations).toContain('hook.asOverlay');
    expect(result.operations).toContain('overlay.isOpen');
    expectPortalSupport(result,true);
  });
  it('retains Overlay reached through authored hook composition', () => {
    const result=compile(`outer();${plain}`,{},'composed',{
      'outer.ts':`import {defineAsHook} from '@proto.ui/core';import {inner} from './inner';export const outer=defineAsHook({name:'outer',setup(){inner();}});`,
      'inner.ts':`import {defineAsHook} from '@proto.ui/core';import {asOverlay as create} from '@proto.ui/hooks';export const inner=defineAsHook({name:'inner',setup(){const overlay=create();overlay.configure({portal:true});}});`,
    },`import {outer} from './outer';`);
    expect(result.operations).toContain('hook.asOverlay');
    expectPortalSupport(result,true);
  });
});
