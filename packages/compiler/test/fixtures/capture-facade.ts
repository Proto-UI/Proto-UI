export const captureFacadeSource = `import {defineAsHook,definePrototype} from '@proto.ui/core';
const asChild=defineAsHook({
  name:'facade-child',
  setup(def){
    const value=def.state.string('value','seed');
    def.expose.method('read',()=>value.get());
    def.expose.event('changed',{payload:'json'});
    def.lifecycle.onMounted(run=>run.expose.emit('changed',{value:value.get()}));
    return r=>r.el('span',value.get());
  },
});
const asParent=defineAsHook({
  name:'facade-parent',
  setup(){const child=asChild();return child.render;},
  projectHandle(result){
    const child=result.getAsHookHandle?.('facade-child');
    if(!child)throw new Error('missing child');
    return {
      ...result,
      props:child.props,
      state:child.state,
      stateHandles:child.stateHandles,
      getState:child.getState,
      methods:child.methods,
      getMethod:child.getMethod,
      artifacts:{
        ...result.artifacts,
        stateHandles:child.stateHandles,
        eventKeys:child.artifacts?.eventKeys,
        methods:child.methods,
      },
    };
  },
});
export default definePrototype({
  name:'capture-facade-consumer',
  setup(def){
    const first=asParent();
    const again=asParent();
    const child=first.getAsHookHandle?.('facade-child');
    const raw=first.getAsHook?.('facade-child');
    const state=first.getState?.('value');
    const read=first.getMethod?.('read');
    def.expose.value('same',first===again);
    def.expose.value('sameChild',raw?.handle===child);
    def.expose.value('sameRaw',raw?.result===child);
    def.expose.value('sameState',state===child?.stateHandles?.value);
    def.expose.value('sameMethod',read===child?.getMethod?.('read'));
    def.expose.method('readAlias',()=>read?.()??'missing');
    def.expose.method('readState',()=>state?.get()??'missing');
    return first.render;
  },
});`;

// Shared authored source for actual scalar/null native consumers.
export const captureRendererSource = (
  result: string
) => `import {defineAsHook,definePrototype} from '@proto.ui/core';
const asContent=defineAsHook({name:'projected-content',setup(){return()=>${result};},projectHandle(result){const copy={...result};return {...copy};}});
export default definePrototype({name:'projected-render-consumer',setup(){const content=asContent();return content.render;}});`;
