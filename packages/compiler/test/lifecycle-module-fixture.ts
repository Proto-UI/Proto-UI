export const lifecycleModuleSource = `import {definePrototype,type RunHandle} from '@proto.ui/core';
  type Lifecycle=RunHandle<{}>['lifecycle'];
  function present(module:Lifecycle,value:boolean){module.setPresent(value);}
  export default definePrototype({name:'lifecycle-module',setup(def){
    let saved:Lifecycle|null=null;
    let created=0,mounted=0,unmounted=0;
    const same=def.state.bool('same',false);
    def.lifecycle.onCreated(run=>{
      created+=1;saved=run.lifecycle;same.set(saved===run.lifecycle);
      present(run.lifecycle,false);
    });
    def.lifecycle.onMounted(()=>{mounted+=1;});
    def.lifecycle.onUnmounted(()=>{unmounted+=1;});
    def.expose.method('same',()=>same.get());
    def.expose.method('present',(value:boolean)=>{if(saved)present(saved,value);});
    def.expose.method('counts',()=>({created,mounted,unmounted}));
    return r=>r.el('output','retained logical owner');
  }});`;
