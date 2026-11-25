import { describe, expect, it } from 'vitest';
import { TsProgramSession, extractModuleIR } from '../src/frontend';

const session = new TsProgramSession({ rootDir: process.cwd() });
function extract(source: string) {
  const { program, entryPath } = session.createVirtualProgram(
    'packages/compiler/test/__composition_input__.proto.ts',
    "import {definePrototype, defineAsHook, defineHook, tw, type DefHandle} from '@proto.ui/core';\n" +
      source
  );
  const result = extractModuleIR(program, entryPath);
  expect(result.diagnostics).toEqual([]);
  return result.ir.prototypes[0];
}

describe('Semantic declaration and action composition', () => {
  it('captures expression-bodied setup render functions and rejects invalid returned scalars', () => {
    const arrow = extract(
      "export default definePrototype({name:'arrow',setup:()=>renderer=>[renderer.el('span','text'),null,renderer.r.slot()]});"
    );
    expect(arrow.unlowered).toEqual([]);
    expect(arrow.render).toMatchObject({
      kind: 'fragment',
      children: [{ kind: 'element' }, { kind: 'slot' }],
    });
    const invalid = extract("export default definePrototype({name:'invalid',setup:()=>7 as any});");
    expect(invalid.unlowered?.some((gap) => gap.operation === 'setup-return')).toBe(true);
    const undefinedChild = extract(
      "export default definePrototype({name:'undefined-child',setup(){return()=>[null,undefined as any];}});"
    );
    expect(undefinedChild.render.kind).toBe('dynamic');
  });

  it('folds only proven setup branches and binds style arguments without copying source', () => {
    const proto = extract(`
      function decorate(def:DefHandle<{}>,enabled:boolean,token:string){
        if(enabled){def.feedback.style.use(tw(token));}else{def.state.bool('unused',true);}
      }
      export default definePrototype({name:'decorated',setup(def){decorate(def,true,'p-2');return()=>null;}});`);
    expect(proto.unlowered).toEqual([]);
    expect(proto.states).toEqual([]);
    expect(proto.staticStyleTokens).toEqual(['p-2']);
    expect(proto.render).toEqual({ kind: 'fragment', children: [] });
  });

  it('does not execute generator callback bodies when their authored call would only create an iterator', () => {
    const proto = extract(`export default definePrototype({name:'generator',setup(def){
      const state=def.state.bool('value',false);
      def.event.on('key.down',function*(){state.set(true);});
    }});`);
    expect(proto.unlowered?.some((gap) => gap.message.includes('generator callbacks'))).toBe(true);
  });

  it('retains setup default-parameter effects instead of analyzing only the body', () => {
    const proto =
      extract(`function setup(def:DefHandle<{}>,extra=console.log('effect')){return()=>null;}
      export default definePrototype({name:'parameter-effect',setup});`);
    expect(proto.unlowered?.some((gap) => gap.message.includes('Default parameter effects'))).toBe(
      true
    );
  });

  it.each([
    'def.lifecycle.onCreated((_run, ignored=state.set(true))=>{});',
    "def.event.on('host:click',(run,_event,ignored=state.set(true))=>{run.update();});",
    'def.props.watchAll((_run,_current,_previous,_info,ignored=state.set(true))=>{});',
  ])('rejects unrepresented callback argument effects: %s', (registration) => {
    const proto = extract(`export default definePrototype({name:'callback-default',setup(def){
      const state=def.state.bool('value',false);${registration}return()=>null;
    }});`);
    expect(
      proto.unlowered?.some((gap) => gap.message.includes('Callback parameter defaults'))
    ).toBe(true);
  });

  it.each(['function*(intent)', 'async (intent) =>'])(
    'rejects a rule intent with separate execution semantics: %s',
    (intent) => {
      const proto = extract(`export default definePrototype({name:'rule-execution',setup(def){
        def.rule({when:when=>when.t(),intent:${intent}{intent.feedback.style.use(tw('bg-blue-500'));}});
        return()=>null;
      }});`);
      expect(proto.unlowered?.some((gap) => gap.operation === 'rule')).toBe(true);
      expect(proto.rules.flatMap((rule) => rule.styleTokens)).toEqual([]);
    }
  );

  it('retains factory validation effects even when the invalid declaration is not selected', () => {
    const proto = extract(`const invalid=definePrototype({name:'',setup(){}});
      export default definePrototype({name:'selected',setup(){return()=>null;}});`);
    expect(proto.unlowered?.some((gap) => gap.operation === 'module-effect')).toBe(true);
  });
  it('retains initialization effects from an imported authored hook module', () => {
    const proto = extract(`import {decoration} from './fixtures/hook-module-effect';
      export default definePrototype({name:'imported',setup(){const base=decoration();return base.render;}});`);
    expect(
      proto.unlowered?.some(
        (gap) =>
          gap.operation === 'module-effect' && gap.span?.file.endsWith('hook-module-effect.ts')
      )
    ).toBe(true);
  });
  it('deduplicates named/default prototype aliases while retaining default selection', () => {
    const proto = extract(
      "export const part=definePrototype({name:'part',setup(){return r=>r.r.slot();}});export default part;"
    );
    expect(proto.isDefaultExport).toBe(true);
    expect(proto.render).toEqual({ kind: 'default-slot' });
  });

  it('expands aliased authored hooks once and returns the selected render handle', () => {
    const proto = extract(`
      const decoration=defineAsHook({name:'decoration',setup(def){
        def.state.bool('hasFocus',false);
        return renderer=>renderer.el('span','borrowed render');
      }});
      const useDecoration=decoration;
      export default definePrototype({name:'composed',setup(){
        const first=useDecoration(); useDecoration(); return first.render;
      }});`);
    expect(proto.unlowered).toEqual([]);
    expect(proto.states.map((state) => state.name)).toEqual(['hasFocus']);
    expect(proto.hooks).toHaveLength(2);
    expect(proto.hooks.every((hook) => hook.lowered)).toBe(true);
    expect(proto.capabilities).not.toContain('authoredHooks');
    expect(proto.render).toMatchObject({
      kind: 'static-tree',
      root: { tag: 'span', children: [{ kind: 'text', value: 'borrowed render' }] },
    });
  });

  it('binds setup helper arguments per invocation without sharing parameter symbols', () => {
    const proto = extract(`
      function declare(def:DefHandle<{}>, label:string, seed:number=3) {
        const state=def.state.numberDiscrete(label,seed+1);
        def.event.on('key.down',run=>{state.set(state.get()+seed);run.update();});
      }
      export default definePrototype({name:'arguments',setup(def){
        declare(def,'first',2);declare(def,'second');return renderer=>renderer.r.slot();
      }});`);
    expect(proto.unlowered).toEqual([]);
    expect(proto.states.map((state) => [state.name, state.initialValue])).toEqual([
      ['first', 3],
      ['second', 4],
    ]);
    expect(proto.events.map((event) => event.body?.[0])).toEqual([
      {
        kind: 'state-set',
        stateName: 'first',
        value: {
          kind: 'binary',
          operator: '+',
          left: { kind: 'state', name: 'first' },
          right: { kind: 'literal', value: 2 },
        },
      },
      {
        kind: 'state-set',
        stateName: 'second',
        value: {
          kind: 'binary',
          operator: '+',
          left: { kind: 'state', name: 'second' },
          right: { kind: 'literal', value: 3 },
        },
      },
    ]);
    expect(proto.events.every((event) => event.body?.[1].kind === 'request-update')).toBe(true);
  });

  it('binds scalar once-hook options through the canonical definition rather than the call name', () => {
    const proto = extract(`
      const configure = defineHook<{}, {}, {}, number>({name:'scalar-hook',mode:'once',setup(def,seed){
        def.state.numberDiscrete('value',seed);
      }});
      export default definePrototype({name:'once',setup(){configure(8);configure(20);}});`);
    expect(proto.unlowered).toEqual([]);
    expect(proto.states.map((state) => state.initialValue)).toEqual([8]);
    expect(proto.hooks.every((hook) => hook.lowered)).toBe(true);
  });

  it('does not expand dynamic setup arguments or recursive helpers', () => {
    const dynamic = extract(`
      declare function external():number;
      function declare(def:DefHandle<{}>,value:number){def.state.numberDiscrete('n',value);}
      export default definePrototype({name:'dynamic',setup(def){declare(def,external());}});`);
    expect(dynamic.states).toEqual([]);
    expect(dynamic.unlowered?.some((gap) => gap.operation === 'setup-composition')).toBe(true);
    const recursive = extract(`function recurse(def:DefHandle<{}>):void{recurse(def);}
      export default definePrototype({name:'recursive',setup(def){recurse(def);}});`);
    expect(recursive.unlowered?.some((gap) => gap.message.includes('Recursive'))).toBe(true);
  });

  it('preserves a helper return boundary, scalar argument snapshots, and the caller continuation', () => {
    const proto = extract(`export default definePrototype({name:'actions',setup(def){
      const count=def.state.numberDiscrete('count',1);
      function change(snapshot:number){count.set(9);if(snapshot===1)return;count.set(100);}
      def.event.on('key.down',run=>{change(count.get());count.set(count.get()+1);run.update();});
      return renderer=>renderer.el('span',count.get());
    }});`);
    expect(proto.unlowered).toEqual([]);
    const body = proto.events[0].body!;
    expect(body.map((statement) => statement.kind)).toEqual([
      'invoke',
      'state-set',
      'request-update',
    ]);
    expect(body[0]).toMatchObject({
      kind: 'invoke',
      body: [
        { kind: 'local', value: { kind: 'state', name: 'count' } },
        { kind: 'state-set', stateName: 'count' },
        { kind: 'if', then: [{ kind: 'return' }] },
        { kind: 'state-set', stateName: 'count' },
      ],
    });
  });

  it('passes resolved props snapshots to a shared lifecycle and watch helper', () => {
    const proto =
      extract(`export default definePrototype<{enabled:boolean}>({name:'sync',setup(def){
      def.props.define({enabled:{type:'boolean',default:false}});
      const active=def.state.bool('active',false);
      const sync=(props:{enabled:boolean})=>{active.set(props.enabled);};
      def.lifecycle.onCreated(run=>sync(run.props.get()));
      def.props.watchAll((run,next)=>{sync(next);run.update();});
      return ()=>null;
    }});`);
    expect(proto.unlowered).toEqual([]);
    expect(proto.render).toEqual({ kind: 'fragment', children: [] });
    for (const body of [proto.lifecycleHandlers![0].body, proto.propWatches![0].body])
      expect(body[0]).toEqual({
        kind: 'invoke',
        body: [
          {
            kind: 'state-set',
            stateName: 'active',
            value: { kind: 'prop', name: 'enabled', source: 'current' },
          },
        ],
      });
  });
});
