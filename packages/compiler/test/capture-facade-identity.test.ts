// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

describe('capture facade identity in repeated public callbacks', () => {
  it.each(['child.methods', 'child.artifacts?.methods', 'child.artifacts'])(
    'retains a finite shared bag when a callback refreshes %s',
    (access) => {
      const source = `import {defineAsHook,definePrototype} from '@proto.ui/core';
        const asChild=defineAsHook({name:'child',setup(def){
          def.expose.method('read',()=>7);
        }});
        export default definePrototype({name:'stable-capture-bag',setup(def){
          const child=asChild();let bag=${access};
          def.expose.method('refresh',()=>{bag=${access};});
          def.expose.method('readAlias',()=>${access === 'child.artifacts' ? 'bag?.methods?.read?.()' : 'bag?.read?.()'});
          return()=> 'done';
        }});`;
      const result = parsePrototype(source);
      expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
      if (result.ok) {
        const validated = validateIR(JSON.parse(JSON.stringify(result.value)));
        expect(validated.ok, JSON.stringify(validated.ok ? null : validated.diagnostics)).toBe(
          true
        );
      }
    }
  );

  it.each(['raw', 'copied'])(
    'retains the actual direct-child entry through a %s getter refresh',
    (mode) => {
      const source = `import {defineAsHook,definePrototype} from '@proto.ui/core';
        const asLeaf=defineAsHook({name:'leaf',setup(){return()=>7;}});
        const asParent=defineAsHook({name:'parent',setup(){asLeaf();},
          projectHandle(result){return ${mode === 'raw' ? 'result' : '{...result}'};}
        });
        export default definePrototype({name:'stable-child-entry',setup(def){
          const parent=asParent();let entry=parent.getAsHook?.('leaf');
          def.expose.method('refresh',()=>{entry=parent.getAsHook?.('leaf');});
          def.expose.method('readAlias',()=>entry?.name);return()=> 'done';
        }});`;
      const result = parsePrototype(source);
      expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
      if (result.ok) {
        const validated = validateIR(JSON.parse(JSON.stringify(result.value)));
        expect(validated.ok, JSON.stringify(validated.ok ? null : validated.diagnostics)).toBe(
          true
        );
      }
    }
  );

  it('keeps the published method bag readonly', () => {
    const result = parsePrototype(`import {defineAsHook,definePrototype} from '@proto.ui/core';
      const asChild=defineAsHook({name:'child',setup(def){def.expose.method('read',()=>7);}});
      export default definePrototype({name:'readonly-capture-bag',setup(){
        const child=asChild();const methods=child.methods;
        if(methods) methods.read=()=>9;
      }});`);
    expect(result).toMatchObject({ ok: false });
  });

  it('does not invent an artifacts bag on an empty capture to hide a reached phase error', () => {
    const result = parsePrototype(`import {defineAsHook,definePrototype} from '@proto.ui/core';
      const asEmpty=defineAsHook({name:'empty',setup(){}});
      export default definePrototype({name:'absent-capture-artifacts',setup(def){
        const empty=asEmpty();
        const call=empty.artifacts ? ()=>{} : ()=>{def.state.bool('illegal',true);};
        return()=>{call();return 'done';};
      }});`);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1007' }] });
  });

  it('retains the absent getter branch when a method is conditionally declared', () => {
    const result = parsePrototype(`import {defineAsHook,definePrototype} from '@proto.ui/core';
      const asMaybe=defineAsHook({name:'maybe',setup(def){
        const enabled=def.state.bool('enabled',false);
        if(enabled.get()) def.expose.method('read',()=>7);
      }});
      export default definePrototype({name:'optional-capture-getter',setup(def){
        const child=asMaybe();
        const call=child.getMethod ? ()=>{} : ()=>{def.state.bool('illegal',true);};
        return()=>{call();return 'done';};
      }});`);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1007' }] });
  });
});
