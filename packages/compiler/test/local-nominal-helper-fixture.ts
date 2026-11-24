export const localNominalHelperSource = `import{definePrototype,type RunHandle}from'@proto.ui/core';
  export default definePrototype({name:'local-nominal-helper',setup(def){
    let module:RunHandle<{}>['lifecycle']|null=null;
    let writes=0;
    let mounted=0;
    let unmounted=0;
    const change=(owner:{setPresent(present:boolean):void},present:boolean)=>{
      writes++;owner.setPresent(present);
    };
    const alias=change;
    def.lifecycle.onCreated(run=>{module=run.lifecycle;change(run.lifecycle,false);});
    def.lifecycle.onMounted(()=>{mounted++;});
    def.lifecycle.onUnmounted(()=>{unmounted++;});
    def.expose.method('same',()=>alias===change);
    def.expose.method('change',(present:boolean)=>{if(module)alias(module,present);});
    def.expose.method('counts',()=>({writes,mounted,unmounted}));
    return r=>r.el('output','local helper');
  }});`;
