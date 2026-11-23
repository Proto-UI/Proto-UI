// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitQtSource } from '../src/qt-source';
import { emitFlutterSource } from '../src/flutter-source';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
import { lifecycleModuleSource as source } from './lifecycle-module-fixture';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

describe('checked first-class lifecycle modules', () => {
  it('retains the real module member and its cold-IR nominal receiver', () => {
    const parsed = parsePrototype(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
    const operations: string[] = [];
    JSON.stringify(parsed.value, (_key, value) => {
      if (value?.kind === 'operation') operations.push(value.operation);
      return value;
    });
    expect(operations).toContain('lifecycle.setPresentFromModule');
    expect(parsed.value.sourceFiles[0].content).toBe(source);
  });

  it.each([
    `def.lifecycle.onBeforeDispose(run=>present(run.lifecycle,false));`,
    `let saved:Lifecycle|null=null;def.lifecycle.onCreated(run=>{saved=run.lifecycle;});
      def.expose.method('module',()=>saved);`,
    `let saved:Lifecycle|null=null;def.lifecycle.onCreated(run=>{saved=run.lifecycle;});
      return r=>{if(saved)present(saved,false);return r.el('output');};`,
    `const fake={setPresent:(value:boolean)=>{}} as Lifecycle;`,
    `def.lifecycle.onCreated(run=>run.lifecycle.captureViewOperation());`,
  ])('retains phase, authority and unsupported-module boundaries: %s', (body) => {
    expect(
      parsePrototype(`import{definePrototype,type RunHandle}from'@proto.ui/core';
      type Lifecycle=RunHandle<{}>['lifecycle'];
      function present(module:Lifecycle,value:boolean){module.setPresent(value);}
      export default definePrototype({name:'module-refusal',setup(def){${body}}});`)
    ).toMatchObject({ ok: false });
  });

  it('rejects a forged member owner without consulting retained source', () => {
    const parsed = parsePrototype(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = JSON.parse(JSON.stringify(parsed.value));
    let changed = 0;
    JSON.stringify(ir, (_key, value) => {
      if (value?.kind === 'member' && value.type === 'run-lifecycle') {
        value.object = {
          kind: 'record',
          entries: [],
          type: { kind: 'record', fields: [] },
          span: value.span,
        };
        changed++;
      }
      return value;
    });
    expect(changed).toBeGreaterThan(0);
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it.each([
    'owner:Lifecycle',
    'owner:{module:Lifecycle}',
    'owner:readonly Lifecycle[]',
    'owner:()=>Lifecycle',
    'owner?:Lifecycle',
  ])('rejects public lifecycle-module ingress: %s', (parameter) => {
    const result = parsePrototype(`import{definePrototype,type RunHandle}from'@proto.ui/core';
      type Lifecycle=RunHandle<{}>['lifecycle'];
      export default definePrototype({name:'public-module-refusal',setup(def){
        def.expose.method('accept',(${parameter})=>{});
      }});`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0].message).toContain('Public method parameters');
  });

  it('independently rejects a cold-IR public parameter claim', () => {
    const parsed = parsePrototype(`import{definePrototype}from'@proto.ui/core';
      export default definePrototype({name:'cold-public-module',setup(def){
        def.expose.method('accept',()=>{});
      }});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = JSON.parse(JSON.stringify(parsed.value));
    const parameters = [{ name: 'owner', type: 'run-lifecycle' }];
    ir.exposes.find((exposure: { name: string }) => exposure.name === 'accept').parameters =
      parameters;
    let changed = 0;
    JSON.stringify(ir, (_key, value) => {
      if (value?.kind === 'operation' && value.operation === 'expose.method') {
        value.arguments[1].function.parameters = parameters;
        value.arguments[1].type.parameters = parameters;
        changed++;
      }
      return value;
    });
    expect(changed).toBe(1);
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('does not confuse an ordinary data literal with the internal module type', () => {
    expect(
      parsePrototype(`import{definePrototype}from'@proto.ui/core';
      export default definePrototype({name:'public-module-string',setup(def){
        def.expose.method('echo',(value:'run-lifecycle')=>value);
      }});`)
    ).toMatchObject({ ok: true });
  });

  it.each(['gpui-source-v1'])(
    'keeps a reached module view explicitly unsupported in %s',
    (profile) => {
      const result = compilePrototype(source, { profile });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(
          result.diagnostics.some((d) => d.code === 'PUI4003' && d.message.includes('lifecycle'))
        ).toBe(true);
    }
  );

  it.each(['qt-source-v1', 'flutter-source-v1'])(
    'preserves the unimplemented public profile gate for %s',
    (profile) => {
      expect(compilePrototype(source, { profile })).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI4001' }],
      });
    }
  );

  it.each([emitQtSource, emitFlutterSource])('keeps direct %s admission explicit', (emit) => {
    const parsed = parsePrototype(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const result = emit(parsed.value);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(
        result.diagnostics.some((d) => d.code === 'PUI4003' && d.message.includes('lifecycle'))
      ).toBe(true);
  });

  it('allocates the Vue module only when its source member is reached', () => {
    const unused = compilePrototype(
      `import{definePrototype,type RunHandle}from'@proto.ui/core';
      export default definePrototype({name:'unused-module',setup(){
        const unused=(run:RunHandle<{}>)=>run.lifecycle;return r=>r.el('output','ordinary');
      }});`,
      { profile: 'vue-source-v1' }
    );
    const reached = compilePrototype(source, { profile: 'vue-source-v1' });
    if (!unused.ok || !reached.ok) throw new Error(JSON.stringify([unused, reached]));
    expect(unused.value.output.code).not.toContain('lifecycle: Object.freeze');
    expect(reached.value.output.code).toContain('lifecycle: Object.freeze');
  });

  for (const profile of nativeOwnerProfiles)
    it(`preserves identity, view epochs and terminal owner isolation in ${profile}`, async () => {
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect(api.same()).toBe(true);
      expect(api.counts()).toEqual({ created: 1, mounted: 0, unmounted: 0 });
      await owner.act(() => api.present(true));
      expect(api.counts()).toEqual({ created: 1, mounted: 1, unmounted: 0 });
      expect(api.acrossCallbacks()).toBe(true);
      await owner.setProps({ revision: 1 });
      expect(api.acrossCallbacks()).toBe(true);
      expect(() => api.present(1)).toThrow(/boolean|invalid method arguments/i);
      expect(api.counts()).toEqual({ created: 1, mounted: 1, unmounted: 0 });
      await owner.act(() => api.present(false));
      expect(api.counts()).toEqual({ created: 1, mounted: 1, unmounted: 1 });
      await owner.act(() => api.present(true));
      expect(api.counts()).toEqual({ created: 1, mounted: 2, unmounted: 1 });
      expect(api.acrossCallbacks()).toBe(true);
      const retained = api.present;
      await owner.dispose();
      const replacement = await mountNativeOwner(source, profile);
      cleanup.push(replacement.dispose);
      expect(() => retained(true)).toThrow(/dispos|alive|terminal/i);
      await replacement.flush();
      expect(replacement.handle.getExposes().counts()).toEqual({
        created: 1,
        mounted: 0,
        unmounted: 0,
      });
    });
});
