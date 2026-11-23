// Independently authored public-IR fixture. This is not the archived IR10 graph.
export function moduleCallableFixture(enabled = true) {
  return {
    source: `import {definePrototype} from '@proto.ui/core';
import {invokeSelected} from './selection';
export default definePrototype({name:'static-callable-selection',setup(def){
 const result=invokeSelected(def);
 def.expose.method('read',()=>result);
 return r=>r.el('output',String(result));
}});`,
    options: {
      fileName: 'subject.proto.ts',
      files: {
        'selection.ts': `import type {DefHandle} from '@proto.ui/core';
import {forward} from './forward';
export function invokeSelected(owner:DefHandle<Record<string,unknown>>):number{return forward(owner);}
function install(owner:DefHandle<Record<string,unknown>>):number{owner.expose.value('answer',73);return 73;}
const enabled:boolean=[true].includes(${enabled});
const selected:((owner:DefHandle<Record<string,unknown>>)=>number)|undefined=enabled?install:undefined;
export default selected;`,
        'forward.ts': `import type {DefHandle} from '@proto.ui/core';
import selected from './selection';
export function forward(owner:DefHandle<Record<string,unknown>>):number{return selected?.(owner)??0;}`,
      },
    },
  };
}
