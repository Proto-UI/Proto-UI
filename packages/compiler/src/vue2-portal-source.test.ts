// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitVue2Source } from './vue2-source';

interface API { open(): void; close(): void; isOpen(): boolean }
interface VM {
  $el: HTMLElement; $refs: Record<string, VM>;
  $mount(): VM; $destroy(): void; getExposes(): API;
}
type H = (tag: unknown, data?: unknown, children?: unknown) => unknown;
interface VueRuntime {
  version: string;
  config: { errorHandler?: (error: Error) => void };
  extend(options: Record<string, unknown>): new () => VM;
  nextTick(): Promise<void>;
}
const Vue2 = createRequire(fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url)))('vue') as VueRuntime;
const floatingUi = createRequire(fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url)))('@floating-ui/dom');
const source = `import {definePrototype} from '@proto.ui/core';import {asOverlay,asFocusable} from '@proto.ui/hooks';
export default definePrototype({name:'portal-lifecycle',setup(def){
  const overlay=asOverlay();overlay.configure({portal:true,defaultOpen:true,anchored:false,closeOnOutsidePress:false,closeOnEscape:false,entry:'manual',restore:'none'});
  const focus=asFocusable();focus.configure({disabled:false});
  def.expose.method('open',()=>overlay.openOverlay());def.expose.method('close',()=>overlay.close());
  def.expose.method('isOpen',()=>overlay.isOpen());return r=>r.el('span','Portal test content');
}});`;
function component(): unknown {
  const parsed=parsePrototype(source,{fileName:'portal.proto.ts'});
  if(!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted=emitVue2Source(parsed.value);
  if(!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const sources=new Map((emitted.value.supportingFiles??[]).map(file=>[posix.normalize(file.path),file.contents]));
  sources.set('Component.ts',emitted.value.code);
  const cache=new Map<string,Record<string,unknown>>();
  const load=(path:string):Record<string,unknown>=>{
    const prior=cache.get(path);if(prior)return prior;
    const text=sources.get(path);if(text===undefined)throw new Error(`Missing generated module ${path}`);
    const exports:Record<string,unknown>={};cache.set(path,exports);
    const js=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    new Function('require','exports',js)((specifier:string)=>{
      if(specifier==='@floating-ui/dom')return floatingUi;
      if(!specifier.startsWith('.'))throw new Error(`Unexpected generated dependency ${specifier}`);
      return load(posix.normalize(posix.join(posix.dirname(path),`${specifier}.ts`)));
    },exports);
    return exports;
  };
  return load('Component.ts').default;
}
async function settle(){for(let i=0;i<6;i++)await Vue2.nextTick();}
function mount(){
  expect(Vue2.version).toBe('2.6.14');
  const Component=component();
  const Root=Vue2.extend({render(h:H){return h('main',{},[h(Component,{ref:'portal'})]);}});
  const vm=new Root();vm.$mount();
  const host=document.createElement('div'),moved=document.createElement('div');host.append(vm.$el);document.body.append(host,moved);
  const instance=vm.$refs.portal,api=instance.getExposes();
  const errors:Error[]=[],previous=Vue2.config.errorHandler;Vue2.config.errorHandler=error=>errors.push(error);
  return {vm,host,moved,instance,api,errors,cleanup(){
    try{vm.$destroy();}finally{Vue2.config.errorHandler=previous;host.remove();moved.remove();
      // Only this fixture's leaked nodes; assertions run before fallback cleanup.
      roots().forEach(node=>node.remove());portalAnchors().forEach(node=>node.remove());}
  }};
}
function roots(){return [...document.querySelectorAll('[data-pui-root]')].filter(node=>node.textContent==='Portal test content');}
function portalAnchors():Comment[]{
  const result:Comment[]=[];
  const visit=(node:Node):void=>{
    if(node.nodeType===8&&(node as Comment).data==='pui-portal')result.push(node as Comment);
    node.childNodes.forEach(visit);
  };
  visit(document.body);return result;
}
function anchorFor(root:HTMLElement):Comment{
  const anchor=portalAnchors()[0];if(anchor)return anchor;
  throw new Error(`Missing Portal anchor for ${root.nodeName}`);
}

describe('Vue2 generated Portal withdrawal',()=>{
  it('closes without reviving the old Root, reopens, relocates its host and leaves no body view after disposal',async()=>{
    const m=mount();try{
      await settle();const first=m.instance.$el;
      expect(first.parentNode).toBe(document.body);expect(roots()).toEqual([first]);expect(portalAnchors()).toHaveLength(1);first.focus();expect(document.activeElement).toBe(first);
      m.api.close();await settle();
      expect(m.api.isOpen()).toBe(false);expect(first.isConnected).toBe(false);
      expect(document.activeElement).not.toBe(first);expect(roots()).toHaveLength(0);
      m.api.open();await settle();const second=m.instance.$el;
      expect(second.parentNode).toBe(document.body);expect(roots()).toHaveLength(1);
      m.moved.append(m.vm.$el);m.api.close();await settle();
      expect(second.isConnected).toBe(false);expect(roots()).toHaveLength(0);
      m.api.open();await settle();expect(roots()).toHaveLength(1);
      m.vm.$destroy();m.host.remove();m.moved.remove();await settle();
      expect(roots()).toHaveLength(0);expect(()=>m.api.isOpen()).toThrow(/terminal/);expect(m.errors).toEqual([]);
    }finally{m.cleanup();}
  });
  it('honors a newer same-tick reopen rather than committing the obsolete close',async()=>{
    const m=mount();try{
      await settle();m.api.close();m.api.open();await settle();
      expect(m.api.isOpen()).toBe(true);expect(m.instance.$el.parentNode).toBe(document.body);expect(roots()).toHaveLength(1);
      m.api.close();await settle();expect(roots()).toHaveLength(0);expect(m.errors).toEqual([]);
    }finally{m.cleanup();}
  });
  it.each(['reopen','terminal'])('does not supersede %s reentry during native restoration',async(action)=>{
    const m=mount(),original=Node.prototype.insertBefore;try{
      await settle();const first=m.instance.$el;let fired=false;
      Node.prototype.insertBefore=function<T extends Node>(node:T,child:Node|null):T{
        const result=original.call(this,node,child) as T;
        if(Object.is(node,first)&&!fired){fired=true;if(action==='reopen')m.api.open();else m.vm.$destroy();}
        return result;
      };
      expect(()=>m.api.close()).not.toThrow();await settle();expect(fired).toBe(true);
      if(action==='reopen'){
        expect(m.api.isOpen()).toBe(true);expect(m.instance.$el.parentNode).toBe(document.body);expect(roots()).toHaveLength(1);
        Node.prototype.insertBefore=original;m.api.close();await settle();expect(roots()).toHaveLength(0);
      }else{
        expect(()=>m.api.isOpen()).toThrow(/terminal/);m.host.remove();m.moved.remove();expect(roots()).toHaveLength(0);
      }
      expect(m.errors).toEqual([]);
    }finally{Node.prototype.insertBefore=original;m.cleanup();}
  });
  it('withdraws a Portal while its native consumer host is detached and can reopen after reattachment',async()=>{
    const m=mount();try{
      await settle();const first=m.instance.$el;m.host.remove();
      expect(first.parentNode).toBe(document.body);m.api.close();await settle();
      expect(first.isConnected).toBe(false);expect(roots()).toHaveLength(0);
      document.body.append(m.host);m.api.open();await settle();
      expect(m.api.isOpen()).toBe(true);expect(roots()).toHaveLength(1);expect(m.instance.$el.parentNode).toBe(document.body);
      m.vm.$destroy();m.host.remove();m.moved.remove();expect(roots()).toHaveLength(0);expect(m.errors).toEqual([]);
    }finally{m.cleanup();}
  });
  it('reports restoration failure after releasing the old portaled view and completing the current withdrawal',async()=>{
    const m=mount(),original=Node.prototype.insertBefore,sentinel=new Error('restore rejected');try{
      await settle();const first=m.instance.$el;
      Node.prototype.insertBefore=function<T extends Node>(node:T,child:Node|null):T{if(Object.is(node,first))throw sentinel;return original.call(this,node,child) as T;};
      expect(()=>m.api.close()).toThrow(sentinel);Node.prototype.insertBefore=original;await settle();
      expect(m.api.isOpen()).toBe(false);expect(first.isConnected).toBe(false);expect(roots()).toHaveLength(0);
      m.vm.$destroy();m.host.remove();m.moved.remove();expect(roots()).toHaveLength(0);
    }finally{Node.prototype.insertBefore=original;m.cleanup();}
  });
  it('retains both restore and anchor cleanup failures without abandoning the Portal target',async()=>{
    const m=mount(),original=Node.prototype.insertBefore,restoreError=new Error('restore failed'),removeError=new Error('anchor failed');
    let anchor:Comment|undefined,remove:(()=>void)|undefined;
    try{
      await settle();const first=m.instance.$el;anchor=anchorFor(first);remove=anchor.remove;
      anchor.remove=()=>{throw removeError;};
      Node.prototype.insertBefore=function<T extends Node>(node:T,child:Node|null):T{if(Object.is(node,first))throw restoreError;return original.call(this,node,child) as T;};
      let failure:unknown;try{m.api.close();}catch(error){failure=error;}
      expect(failure).toBeInstanceOf(AggregateError);expect((failure as AggregateError).errors).toEqual([restoreError,removeError]);
      Node.prototype.insertBefore=original;anchor.remove=remove;await settle();
      expect(first.isConnected).toBe(false);expect(roots()).toHaveLength(0);
      m.vm.$destroy();m.host.remove();m.moved.remove();expect(roots()).toHaveLength(0);
    }finally{Node.prototype.insertBefore=original;if(anchor&&remove)anchor.remove=remove;m.cleanup();}
  });
  it.each(['before','after'])('preserves a newer reopen when restoration throws %s the native insertion',async(insertion)=>{
    const m=mount(),original=Node.prototype.insertBefore,sentinel=new Error('restore after reopen');try{
      await settle();const first=m.instance.$el;let fired=false;
      Node.prototype.insertBefore=function<T extends Node>(node:T,child:Node|null):T{
        if(Object.is(node,first)&&!fired){fired=true;if(insertion==='after')original.call(this,node,child);m.api.open();throw sentinel;}
        return original.call(this,node,child) as T;
      };
      expect(()=>m.api.close()).toThrow(sentinel);Node.prototype.insertBefore=original;await settle();
      expect(fired).toBe(true);expect(m.api.isOpen()).toBe(true);
      expect(m.instance.$el).toBe(first);expect(first.parentNode).toBe(document.body);expect(roots()).toHaveLength(1);
      expect(portalAnchors()).toHaveLength(1);
      m.api.close();await settle();expect(first.isConnected).toBe(false);expect(roots()).toHaveLength(0);expect(portalAnchors()).toHaveLength(0);
      expect(m.errors).toEqual([]);
    }finally{Node.prototype.insertBefore=original;m.cleanup();}
  });
  it('does not confuse a physical target move with transfer of its logical owner',async()=>{
    const m=mount();try{
      await settle();const first=m.instance.$el;m.moved.append(first);
      expect(m.api.isOpen()).toBe(true);m.api.close();await settle();
      expect(first.isConnected).toBe(false);expect(m.moved.children).toHaveLength(0);expect(roots()).toHaveLength(0);
      m.api.open();await settle();expect(m.instance.$el.parentNode).toBe(document.body);expect(roots()).toHaveLength(1);
      expect(m.errors).toEqual([]);
    }finally{m.cleanup();}
  });

});
