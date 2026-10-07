// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { checkTargetOperations, resolveTargetProfile } from '../src/targets';
import type { TargetProfile } from '../src/targets';
import type { PrototypeIR } from '../src/ir';

function profile(id: string): TargetProfile {
  const result = resolveTargetProfile(id);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function parse(source: string, files?: Record<string, string>): PrototypeIR {
  const result = parsePrototype(source, { fileName: 'entry.proto.ts', files });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

const basicSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'basic',setup(def){
  def.props.define({label:{type:'string'}});
  def.props.setDefaults({label:'initial'});
  const value = def.state.string('value','initial');
  def.props.watch(['label'],(run,next)=>{value.set(next.label);run.update();});
  def.lifecycle.onCreated((run)=>{run.lifecycle.setPresent(true);});
  return (render)=>render.el('span',{},[value.get(),render.slot()]);
}});`;

describe('explicit target capability admission', () => {
  it('admits the basic native slice without a hidden semantic-runtime dependency', () => {
    const result = checkTargetOperations(parse(basicSource), profile('react-dom-source-v1'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.operations).toContain('state.set');
    expect(result.value.operations).toContain('run.update');
    expect(result.value.operations).toContain('render.slot');
  });

  it('rejects unknown and unimplemented profiles instead of substituting a bridge', () => {
    expect(resolveTargetProfile('react-native-source-v1')).toMatchObject({ok:false,diagnostics:[{category:'unsupported-input',code:'PUI4001'}]});
    expect(resolveTargetProfile({framework:'qt',mode:'source'})).toMatchObject({ok:false,diagnostics:[{code:'PUI4001'}]});
    expect(resolveTargetProfile({profile:'react-dom-source-v1',mode:'runtime-backed'})).toMatchObject({ok:false,diagnostics:[{code:'PUI4001'}]});
    expect(resolveTargetProfile({profile:'react-dom-source-v1',version:'18.0.0'})).toMatchObject({ok:false,diagnostics:[{code:'PUI4002'}]});
  });

  it('follows nested authored hook bodies and reports the actual unsupported source location', () => {
    const ir = parse(`import {definePrototype} from '@proto.ui/core';
import {outer} from './outer';
export default definePrototype({name:'entry',setup(){outer();}});`, {
      'outer.ts': `import {defineAsHook} from '@proto.ui/core';
import {inner} from './inner';
export const outer=defineAsHook({name:'outer',setup(){inner();}});`,
      'inner.ts': `import {defineAsHook} from '@proto.ui/core';
import {asTrigger} from '@proto.ui/hooks';
export const inner=defineAsHook({name:'inner',setup(){asTrigger();}});`,
    });
    // Requirements are descriptive metadata, not an admission authority.
    ir.requirements = [];
    const restricted = resolveTargetProfile({profile:'react-dom-source-v1',hostCapabilities:['view-render']});
    if (!restricted.ok) throw new Error(JSON.stringify(restricted.diagnostics));
    const native = checkTargetOperations(ir, restricted.value);
    expect(native).toMatchObject({ok:false,diagnostics:[{code:'PUI4004',span:{file:'inner.ts',line:3}}]});
    const runtime = checkTargetOperations(ir, profile('react-runtime-v1'));
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) throw new Error(JSON.stringify(runtime.diagnostics));
    expect(runtime.value.operations).toContain('hook.asTrigger');
    expect(runtime.value.authoredHooks).toHaveLength(2);
  });

  it('checks a helper only when a reached callback calls it', () => {
    function helperIR(call: boolean): PrototypeIR {
      return parse(`import {definePrototype} from '@proto.ui/core';
import {asFocusable} from '@proto.ui/hooks';
export default definePrototype({name:'helper',setup(def){
  const focus=asFocusable();
  const request=()=>{focus.focusSelf();};
  def.expose.method('focus',()=>{${call ? 'request();' : ''}});
}});`);
    }
    const unused = checkTargetOperations(helperIR(false), profile('react-runtime-v1'));
    const reached = checkTargetOperations(helperIR(true), profile('react-runtime-v1'));
    if (!unused.ok || !reached.ok) throw new Error('Runtime capability admission failed');
    expect(unused.value.operations).not.toContain('focus.focusSelf');
    expect(reached.value.operations).toContain('focus.focusSelf');
    const restricted = resolveTargetProfile({profile:'react-dom-source-v1',hostCapabilities:['view-render']});
    if (!restricted.ok) throw new Error(JSON.stringify(restricted.diagnostics));
    const native = checkTargetOperations(helperIR(true), restricted.value);
    if (native.ok) throw new Error('Capability-restricted output admitted focus');
    expect(native.diagnostics).toContainEqual(expect.objectContaining({code:'PUI4004',span:expect.objectContaining({file:'entry.proto.ts',line:5,column:22})}));
  });

  it('checks actual host capabilities and cannot enable unsupported lowering through a manifest label', () => {
    const selected = resolveTargetProfile({profile:'react-dom-source-v1',hostCapabilities:[]});
    if (!selected.ok) throw new Error(JSON.stringify(selected.diagnostics));
    const result = checkTargetOperations(parse(basicSource), selected.value);
    expect(result).toMatchObject({ok:false,diagnostics:[{code:'PUI4004',span:{file:'entry.proto.ts',line:8}},{code:'PUI4004',span:{file:'entry.proto.ts',line:8}}]});
    expect(resolveTargetProfile({profile:'react-dom-source-v1',hostCapabilities:['focus-target']}).ok).toBe(true);
  });

  it('requires a logical Context capability even for a key reference without an operation', () => {
    const ir = parse(`import {definePrototype} from '@proto.ui/core';
import {Shared} from './keys';
export default definePrototype({name:'key',setup(){
  const capability=Shared;
}});`, {
      'keys.ts': `import {createContextKey} from '@proto.ui/core';
export const Shared=createContextKey<{label:string}>('shared');`,
    });
    expect(checkTargetOperations(ir, profile('react-runtime-v1')).ok).toBe(true);
    expect(checkTargetOperations(ir, profile('react-dom-source-v1')).ok).toBe(true);
    const withoutContext = resolveTargetProfile({ profile:'react-dom-source-v1', hostCapabilities:['view-render'] });
    if (!withoutContext.ok) throw new Error(JSON.stringify(withoutContext.diagnostics));
    expect(checkTargetOperations(ir, withoutContext.value)).toMatchObject({
      ok:false,diagnostics:[{code:'PUI4007',span:{file:'entry.proto.ts',line:4,column:20}}],
    });
  });

  it('ignores uncalled authored declarations but checks a returned render function', () => {
    const ir = parse(basicSource);
    const unsupported = parse(`import {definePrototype} from '@proto.ui/core';import {asTrigger} from '@proto.ui/hooks';export default definePrototype({name:'unused',setup(){asTrigger();}});`);
    ir.hooks.push({id:'unused#hook',name:'unused',setup:unsupported.setup,span:unsupported.setup.span});
    const result = checkTargetOperations(ir, profile('react-dom-source-v1'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.authoredHooks).toEqual([]);
    expect(result.value.operations).toContain('render.el');
    expect(result.value.operations).not.toContain('hook.asTrigger');
  });
});
