export const lifecycleModuleSource = `import {definePrototype,type RunHandle} from '@proto.ui/core';
  type Lifecycle=RunHandle<{}>['lifecycle'];
  function present(module:Lifecycle,value:boolean){module.setPresent(value);}
  export default definePrototype({name:'lifecycle-module',setup(def){
    let saved:Lifecycle|null=null;
    let created=0,mounted=0,unmounted=0;
    let acrossCallbacks=true;
    def.props.define({revision:{type:'number',default:0}});
    const same=def.state.bool('same',false);
    def.lifecycle.onCreated(run=>{
      created+=1;saved=run.lifecycle;same.set(saved===run.lifecycle);
      present(run.lifecycle,false);
    });
    def.lifecycle.onMounted(run=>{mounted+=1;acrossCallbacks=acrossCallbacks&&saved===run.lifecycle;});
    def.lifecycle.onUnmounted(run=>{unmounted+=1;acrossCallbacks=acrossCallbacks&&saved===run.lifecycle;});
    def.props.watch(['revision'],run=>{acrossCallbacks=acrossCallbacks&&saved===run.lifecycle;});
    def.expose.method('same',()=>same.get());
    def.expose.method('acrossCallbacks',()=>acrossCallbacks);
    def.expose.method('present',(value:boolean)=>{if(saved)present(saved,value);});
    def.expose.method('counts',()=>({created,mounted,unmounted}));
    return r=>r.el('output','retained logical owner');
  }});`;
