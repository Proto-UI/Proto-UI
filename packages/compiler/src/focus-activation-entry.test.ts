// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitReactSource } from './react-source';
import { emitVueSource } from './vue-source';
import { emitVue2Source } from './vue2-source';
import { emitWebComponentSource } from './web-component-source';
import { emitGpuiSource } from './gpui-source';
import { nativeAdapterModulesArtifact } from './native-adapter-modules';

function parse(body: string, imports = '') {
  return parsePrototype(`import {definePrototype} from '@proto.ui/core';
    import {asFocusScope,asFocusable} from '@proto.ui/hooks';${imports}
    export default definePrototype({name:'ordinary-owner',setup(def){
      const scope=asFocusScope();${body}return r=>r.el('div','scope');
    }});`, {fileName:'scope.proto.ts'});
}
function admitted(body: string, imports = '') {
  const result=parse(body,imports);
  if(!result.ok)throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
describe('activation-local focus entry admission',()=>{
  for(const [name,emit] of Object.entries({react:emitReactSource,vue:emitVueSource,vue2:emitVue2Source,wc:emitWebComponentSource})) {
    it(`${name} emits direct scope activation and the stable native support`,()=>{
      const result=emit(admitted("def.expose.method('go',()=>{scope.activate({entry:'manual',preventScroll:true});});"));
      expect(result.ok).toBe(true);
      if(!result.ok)throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.code).toContain('.activate(');
      expect(result.value.supportingFiles?.find(f=>f.path===nativeAdapterModulesArtifact.path)?.contents).toBe(nativeAdapterModulesArtifact.contents);
    });
  }
  it.each(['FocusScopeActivationOptions','Options'])('admits the public imported type as %s',name=>{
    const imported=name==='Options'?'FocusScopeActivationOptions as Options':name;
    expect(parse(`def.expose.method('go',(options:${name})=>{scope.activate(options);});`,
      `import type {${imported}} from '@proto.ui/core';`).ok).toBe(true);
  });
  it('rejects a local declaration conflicting with the imported activation type',()=>{
    expect(parse("def.expose.method('go',(options:Options)=>{scope.activate(options);});",
      "import type {FocusScopeActivationOptions as Options} from '@proto.ui/core';type Options={entry:'first'};").ok).toBe(false);
  });
  it('admits structural options through a local alias and closure',()=>{
    expect(parse("const activate=(options:Activation)=>{scope.activate(options);};def.expose.method('go',()=>{activate({entry:'manual'});});",
      "type Activation={entry?:'manual'|'configured';preventScroll?:boolean};").ok).toBe(true);
  });
  it.each(["{entry:'first'}","{entry:true}","{entry:'manual',target:'arbitrary'}"])("rejects invalid activation %s",options=>{
    expect(parse(`def.expose.method('go',()=>{scope.activate(${options});});`).ok).toBe(false);
  });
  it.each(['scope.deactivate','focus.focusSelf'])('does not widen %s',method=>{
    expect(parse(`const focus=asFocusable();def.expose.method('go',()=>{${method}({entry:'manual'});});`).ok).toBe(false);
  });
  it('rejects the new policy on GPUI rather than silently discarding it',()=>{
    const result=emitGpuiSource(admitted("def.expose.method('go',()=>{scope.activate({entry:'manual'});});"));
    expect(result.ok).toBe(false);
    if(!result.ok)expect(result.diagnostics.some(d=>d.code==='PUI_GPUI_FOCUS_ACTIVATION_REQUIRED')).toBe(true);
  });
  it('rejects typed possibly-present entry on GPUI, including closures',()=>{
    const result=emitGpuiSource(admitted("def.expose.method('go',(options:Options)=>{scope.activate(options);});",
      "import type {FocusScopeActivationOptions as Options} from '@proto.ui/core';"));
    expect(result.ok).toBe(false);
    if(!result.ok)expect(result.diagnostics.some(d=>d.code==='PUI_GPUI_FOCUS_ACTIVATION_REQUIRED')).toBe(true);
  });
  it.each([
    "const dormant=()=>{scope.activate({entry:'manual'});};const alias=dormant;def.expose.method('go',()=>{scope.activate();});",
    "def.expose.method('go',()=>{return;scope.activate({entry:'manual'});});",
  ])('does not reject GPUI for an unreachable entry override',body=>{
    expect(emitGpuiSource(admitted(body)).ok).toBe(true);
  });
  it('preserves GPUI activation without the new option',()=>{
    expect(emitGpuiSource(admitted("def.expose.method('go',()=>{scope.activate({preventScroll:true});});")).ok).toBe(true);
  });
});

type Request={reason?:string;preventScroll?:boolean;entry?:'manual'|'configured'};
interface Scope {configure(config:Record<string,unknown>):void;activate(request?:Request):void;deactivate():void;isActive():boolean}
interface Capabilities {asFocusScope():Scope;configureFocusable(config:Record<string,unknown>):void;focus(request?:Request):void;canFocus():boolean;mount():void;dispose():void}
type Factory=(options:Record<string,unknown>)=>Capabilities;
function nativeFactory():Factory {
  const exports:Record<string,unknown>={};
  const floating=createRequire(new URL('../../modules/positioning/package.json',import.meta.url))('@floating-ui/dom');
  const code=ts.transpileModule(nativeAdapterModulesArtifact.contents,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','exports',code)((name:string)=>{if(name!=='@floating-ui/dom')throw new Error(name);return floating;},exports);
  return exports.createNativeAdapterModules as Factory;
}
function fixture(config:Record<string,unknown>={}) {
  const create=nativeFactory(),outside=document.createElement('button'),root=document.createElement('div'),inside=document.createElement('button');
  root.append(inside);document.body.append(outside,root);outside.focus();
  const identity={},requests:Request[]=[];
  const options=(el:HTMLElement,id:object,parent:object|null)=>({identity:id,getLogicalParent:()=>parent,getRoot:()=>el,
    declarations:[],ensureSetup:()=>{},ensureRuntime:()=>{},ensureEvent:()=>{},isAlive:()=>true,isReady:()=>true,
    invoke:<T>(fn:()=>T)=>fn(),getRun:()=>({}),getResolvedProps:()=>({})});
  const owner=create(options(root,identity,null)),scope=owner.asFocusScope();scope.configure({trap:true,loop:true,...config});
  const child=create({...options(inside,{},identity),baseFocus:()=>({focusSelf:(request:Request)=>{requests.push(request);inside.focus();}})});
  const external=create(options(outside,{},null));external.configureFocusable({});
  child.configureFocusable({});owner.mount();child.mount();external.mount();
  return {owner,child,external,scope,outside,inside,requests,cleanup(){external.dispose();child.dispose();owner.dispose();root.remove();outside.remove();}};
}
describe('direct native activation entry policy (shared four-Web support)',()=>{
  it('manual keeps the active boundary, explicit inside focus and restoration; next activation uses setup',()=>{
    const f=fixture();try{
      f.scope.activate({entry:'manual'});expect(f.scope.isActive()).toBe(true);expect(f.requests).toEqual([]);expect(document.activeElement).toBe(f.outside);
      expect(f.external.canFocus()).toBe(false);expect(f.child.canFocus()).toBe(true);
      f.external.focus();expect(f.requests).toEqual([]);
      f.child.focus({reason:'keyboard'});expect(document.activeElement).toBe(f.inside);
      f.scope.deactivate();expect(document.activeElement).toBe(f.outside);
      f.scope.activate();expect(f.requests.at(-1)).toEqual({reason:'programmatic'});expect(document.activeElement).toBe(f.inside);
    }finally{f.cleanup();}
  });
  it('configured never overrides setup manual',()=>{
    const f=fixture({entry:'manual'});try{f.scope.activate({entry:'configured'});expect(f.scope.isActive()).toBe(true);expect(f.requests).toEqual([]);}finally{f.cleanup();}
  });
  it('strips entry while retaining exact native options and the original no-entry request',()=>{
    const f=fixture();try{
      f.scope.activate({entry:'configured',reason:'keyboard',preventScroll:true});expect(f.requests[0]).toEqual({reason:'keyboard',preventScroll:true});
      expect(Object.hasOwn(f.requests[0],'entry')).toBe(false);f.scope.deactivate();
      const request={reason:'pointer',preventScroll:false};f.scope.activate(request);expect(f.requests[1]).toBe(request);
    }finally{f.cleanup();}
  });
});
