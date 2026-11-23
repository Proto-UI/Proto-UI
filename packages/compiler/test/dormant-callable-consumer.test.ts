// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});

// Independently authored IR7 probes. Historical IR10 acceptance is a different run.
const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'current-callable-consumer',setup(def){
  const invisible=()=>{globalThis.__protoCompilerMustNotRun();};
  const invisibleAlias=invisible;
  const dormantDefault=(value:unknown=globalThis.__protoCompilerMustNotRun())=>value;
  let sequence='';
  const install=()=>{sequence=sequence+'A';def.expose.value('answer',42);};
  const invoke=(fn:(()=>void)|undefined=install)=>{sequence=sequence+'B';fn?.();sequence=sequence+'C';};
  const alias=invoke;
  alias();
  const failure={code:'authored',value:42};
  function fail():number{sequence=sequence+'T';throw failure;}
  const failAlias=fail;
  def.expose.method('fail',failAlias);
  def.expose.method('read',()=>sequence);
  return r=>r.el('output','ready');
}});`;

for (const profile of nativeOwnerProfiles)
  it(`preserves real reached effects, original throw values and terminal lifetime in ${profile}`, async () => {
    const owner = await mountNativeOwner(source, profile);
    cleanups.push(owner.dispose);
    const api = owner.handle.getExposes();
    expect(api.answer).toBe(42);
    expect(api.read()).toBe('BAC');
    let thrown: unknown;
    try {
      api.fail();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toEqual({ code: 'authored', value: 42 });
    let repeated: unknown;
    try {
      api.fail();
    } catch (error) {
      repeated = error;
    }
    expect(repeated).toBe(thrown);
    expect(api.read()).toBe('BACTT');
    expect(owner.compiled.ir.sourceFiles[0].content).toBe(source);
    expect(owner.compiled.output.code).not.toContain('__protoCompilerMustNotRun');
    await owner.dispose();
    expect(() => api.fail()).toThrow(/dispos|alive|terminal/i);
    expect(() => api.read()).toThrow(/dispos|alive|terminal/i);
  });
