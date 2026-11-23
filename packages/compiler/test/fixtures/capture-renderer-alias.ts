/** One authored fixture shared by source, framework, and generated native consumers. */
export function childRendererAliasSource(mode: 'direct' | 'copied' | 'forwarded'): string {
  const projection =
    mode === 'forwarded'
      ? 'return {...result};'
      : `
    const getter=result.getAsHookHandle;
    const child=${mode === 'direct' ? "result.getAsHookHandle?.('child')" : "getter?.('child')"};
    return {render:child?.render,sameGetter:getter===result.getAsHookHandle};`;
  const consume =
    mode === 'forwarded'
      ? `
    const getter=parent.getAsHookHandle;
    def.expose.value('sameGetter',getter===parent.getAsHookHandle);
    return getter?.('child')?.render;`
      : `
    def.expose.value('sameGetter',parent.sameGetter);
    return parent.render;`;
  return `import {defineAsHook,definePrototype} from '@proto.ui/core';
    const asChild=defineAsHook({name:'child',setup(){return()=> 'text';},
      projectHandle(result){return {...result};}});
    const asParent=defineAsHook({name:'parent',setup(){asChild();},
      projectHandle(result){${projection}}});
    export default definePrototype({name:'child-renderer-alias-owner',setup(def){
      const parent=asParent();${consume}
    }});`;
}

export const copiedChildRendererSource = childRendererAliasSource('copied');
