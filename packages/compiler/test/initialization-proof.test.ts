import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { TsProgramSession, extractModuleIR } from '../src/frontend';
import { getReactLoweringDiagnostics } from '../src/targets/react';

const session = new TsProgramSession({ rootDir: process.cwd() });
const header = "import {definePrototype, type DefHandle} from '@proto.ui/core';\n";

interface InitializationFixture {
  readonly name: string;
  readonly source: string;
  readonly entry?: string;
  readonly extra?: Readonly<Record<string, string>>;
}

function extract(fixture: InitializationFixture) {
  const entry =
    fixture.entry ?? 'packages/compiler/test/__initialization_' + fixture.name + '.proto.ts';
  const { program, entryPath } = session.createVirtualProgram(
    entry,
    header + fixture.source,
    fixture.extra
  );
  // Imported virtual fixtures must be valid TypeScript too. A compiler rejection must
  // come from the semantic proof, rather than an invalid or missing fixture import.
  for (const file of [entryPath, ...Object.keys(fixture.extra ?? {})]) {
    const source = program.getSourceFile(path.resolve(process.cwd(), file));
    expect(source, file).toBeDefined();
    if (!source) throw new Error('Missing virtual source: ' + file);
    const diagnostics = [
      ...program.getSyntacticDiagnostics(source),
      ...program.getSemanticDiagnostics(source),
    ].map((diagnostic) => ({
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    }));
    expect(diagnostics, fixture.name + ': source typecheck').toEqual([]);
  }
  const result = extractModuleIR(program, entryPath);
  expect(result.diagnostics, fixture.name).toEqual([]);
  const prototype = result.ir.prototypes[0];
  expect(prototype, fixture.name).toBeDefined();
  return prototype;
}

const rejected: readonly InitializationFixture[] = [
  {
    name: 'module_const_tdz',
    source: `function readLater(){return later;}
      const initial=readLater(); const later=1;
      export default definePrototype({name:'module-const-tdz',setup(def){
        const n=def.state.numberDiscrete('n',initial);
        return r=>r.el('div',n.get());
      }});`,
  },
  {
    name: 'setup_const_tdz',
    source: `export default definePrototype({name:'setup-const-tdz',setup(def){
      function readLater(){return later;}
      const n=def.state.numberDiscrete('n',readLater()); const later=1;
      return r=>r.el('div',n.get());
    }});`,
  },
  {
    name: 'callback_const_tdz',
    source: `export default definePrototype({name:'callback-const-tdz',setup(def){
      const n=def.state.numberDiscrete('n',0);
      def.event.on('host:click',run=>{
        function bad(){n.set(later);} bad(); const later=1; run.update();
      });
      return r=>r.el('div',n.get());
    }});`,
  },
  {
    name: 'unknown_ambient_module_read',
    source: `declare const unseen:number; const unused=unseen;
      export default definePrototype({name:'unknown-ambient-read',setup(){return()=>null;}});`,
  },
  {
    name: 'future_capture_bounded_rejection',
    source: `export default definePrototype({name:'future-capture',setup(def){
      const n=def.state.numberDiscrete('n',0);
      def.event.on('host:click',run=>{n.set(later);run.update();});
      const later=1; return r=>r.el('div',n.get());
    }});`,
  },
  {
    name: 'never_initialized_capture_after_return',
    source: `export default definePrototype({name:'never-initialized-capture',setup(def){
      const n=def.state.numberDiscrete('n',0);
      def.event.on('host:click',run=>{n.set(later);run.update();});
      return r=>r.el('div',n.get()); const later=1;
    }});`,
  },
  {
    name: 'module_const_callee_tdz',
    source: `function invoke(){return late();}
      const initial=invoke(); const late=()=>1;
      export default definePrototype({name:'module-callee-tdz',setup(def){
        const n=def.state.numberDiscrete('n',initial); return r=>r.el('div',n.get());
      }});`,
  },
  {
    name: 'callback_const_callee_tdz',
    source: `export default definePrototype({name:'callback-callee-tdz',setup(def){
      const n=def.state.numberDiscrete('n',0);
      def.event.on('host:click',run=>{
        function invoke(){late();} invoke();
        const late=()=>{n.set(1);}; run.update();
      });
      return r=>r.el('div',n.get());
    }});`,
  },
  {
    name: 'module_const_callee_alias_tdz',
    source: `function invoke(){return alias();}
      const initial=invoke(); const target=()=>1; const alias=target;
      export default definePrototype({name:'module-callee-alias-tdz',setup(def){
        const n=def.state.numberDiscrete('n',initial); return r=>r.el('div',n.get());
      }});`,
  },
  {
    name: 'callback_const_callee_alias_tdz',
    source: `export default definePrototype({name:'callback-callee-alias-tdz',setup(def){
      const n=def.state.numberDiscrete('n',0);
      def.event.on('host:click',run=>{
        function invoke(){alias();} invoke(); run.update(); return;
        const target=()=>{n.set(1);}; const alias=target;
      });
      return r=>r.el('div',n.get());
    }});`,
  },
  {
    name: 'module_cycle_const',
    entry: 'packages/compiler/test/__initialization_cycle_a__.proto.ts',
    source: `import {b} from './__initialization_cycle_b__'; export const a=1;
      export default definePrototype({name:'cycle-const',setup(def){
        const n=def.state.numberDiscrete('n',b); return r=>r.el('div',n.get());
      }});`,
    extra: {
      'packages/compiler/test/__initialization_cycle_b__.ts':
        "import {a} from './__initialization_cycle_a__.proto'; export const b=a;",
    },
  },
  {
    name: 'module_cycle_via_hoisted_function',
    entry: 'packages/compiler/test/__initialization_cycle_fn_a__.proto.ts',
    source: `import {b} from './__initialization_cycle_fn_b__';
      export const a=1; export function getA(){return a;}
      export default definePrototype({name:'cycle-function',setup(def){
        const n=def.state.numberDiscrete('n',b); return r=>r.el('div',n.get());
      }});`,
    extra: {
      'packages/compiler/test/__initialization_cycle_fn_b__.ts':
        "import {getA} from './__initialization_cycle_fn_a__.proto'; export const b=getA();",
    },
  },
  {
    name: 'render_style_callee_alias_tdz',
    source: `import {tw} from '@proto.ui/core';
      export default definePrototype({name:'render-style-alias-tdz',setup(){
        return r=>r.el('div',{style:twAlias('p-2')},'x');
        const twAlias=tw;
      }});`,
  },
  {
    name: 'rule_style_callee_alias_tdz',
    source: `import {tw} from '@proto.ui/core';
      export default definePrototype({name:'rule-style-alias-tdz',setup(def){
        def.rule({when:w=>w.t(),intent:i=>{i.feedback.style.use(twAlias('p-2'));}});
        return()=>null; const twAlias=tw;
      }});`,
  },
  {
    name: 'setup_helper_style_callee_alias_tdz',
    source: `import {tw} from '@proto.ui/core';
      export default definePrototype({name:'setup-style-alias-tdz',setup(def){
        function decorate(d:DefHandle<{}>){d.feedback.style.use(twAlias('p-2'));}
        decorate(def); return()=>null; const twAlias=tw;
      }});`,
  },
];

describe('Initialization proof for semantic lowering', () => {
  it.each(rejected)('explicitly rejects $name after a successful source typecheck', (fixture) => {
    const prototype = extract(fixture);
    const admission = getReactLoweringDiagnostics(prototype);
    expect((prototype.unlowered?.length ?? 0) + admission.length, fixture.name).toBeGreaterThan(0);
    expect(admission.length, fixture.name + ': native target rejection').toBeGreaterThan(0);
  });

  it('allows a hoisted function call before the function declaration', () => {
    const prototype = extract({
      name: 'initialized_hoisted_module_function',
      source: `const initial=readValue(); function readValue(){return 1;}
        export default definePrototype({name:'safe-hoisted',setup(def){
          const n=def.state.numberDiscrete('n',initial); return r=>r.el('div',n.get());
        }});`,
    });
    expect(prototype.unlowered).toEqual([]);
    expect(getReactLoweringDiagnostics(prototype)).toEqual([]);
    expect(prototype.states[0].initialValue).toBe(1);
  });

  it('allows callback captures initialized before registration', () => {
    const prototype = extract({
      name: 'initialized_callback_capture',
      source: `export default definePrototype({name:'safe-capture',setup(def){
        const n=def.state.numberDiscrete('n',0); const later=1;
        def.event.on('host:click',run=>{n.set(later);run.update();});
        return r=>r.el('div',n.get());
      }});`,
    });
    expect(prototype.unlowered).toEqual([]);
    expect(getReactLoweringDiagnostics(prototype)).toEqual([]);
    expect(prototype.events[0].body?.[0]).toEqual({
      kind: 'state-set',
      stateName: 'n',
      value: { kind: 'literal', value: 1 },
    });
  });

  it('allows an initialized alias of a hoisted setup helper', () => {
    const prototype = extract({
      name: 'initialized_setup_function_alias',
      source: `function decorate(def:DefHandle<{}>){def.state.bool('active',true);}
        const alias=decorate;
        export default definePrototype({name:'safe-alias',setup(def){alias(def);return()=>null;}});`,
    });
    expect(prototype.unlowered).toEqual([]);
    expect(getReactLoweringDiagnostics(prototype)).toEqual([]);
    expect(prototype.states[0]).toMatchObject({ name: 'active', initialValue: true });
  });

  it('allows an initialized module alias for a render style intrinsic', () => {
    const prototype = extract({
      name: 'initialized_render_style_alias',
      source: `import {tw} from '@proto.ui/core'; const twAlias=tw;
        export default definePrototype({name:'safe-render-style-alias',setup(){
          return r=>r.el('div',{style:twAlias('p-2')},'x');
        }});`,
    });
    expect(prototype.unlowered).toEqual([]);
    expect(getReactLoweringDiagnostics(prototype)).toEqual([]);
    expect(prototype.render).toMatchObject({
      kind: 'static-tree',
      root: { styleTokens: ['p-2'] },
    });
  });

  it('preserves once-only argument binding for a hoisted action helper', () => {
    const prototype = extract({
      name: 'initialized_action_hoisted_parameter',
      source: `export default definePrototype({name:'safe-action',setup(def){
        const n=def.state.numberDiscrete('n',0);
        def.event.on('host:click',run=>{
          adjust(n.get()); run.update();
          function adjust(value:number){n.set(value+1);n.set(value+2);}
        });
        return r=>r.el('div',n.get());
      }});`,
    });
    expect(prototype.unlowered).toEqual([]);
    expect(getReactLoweringDiagnostics(prototype)).toEqual([]);
    const invoke = prototype.events[0].body?.[0];
    expect(invoke?.kind).toBe('invoke');
    if (invoke?.kind !== 'invoke') throw new Error('Missing helper invocation scope');
    const local = invoke.body[0];
    expect(local).toMatchObject({ kind: 'local', value: { kind: 'state', name: 'n' } });
    if (local.kind !== 'local') throw new Error('Missing once-only argument binding');
    expect(invoke.body.slice(1)).toMatchObject([
      { kind: 'state-set', value: { kind: 'binary', left: { kind: 'local', name: local.name } } },
      { kind: 'state-set', value: { kind: 'binary', left: { kind: 'local', name: local.name } } },
    ]);
  });
});
