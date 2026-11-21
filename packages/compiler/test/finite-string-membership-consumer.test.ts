// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups:Array<()=>Promise<void>>=[];
afterEach(async()=>{
  const results=await Promise.allSettled(cleanups.splice(0).reverse().map(dispose=>dispose()));
  document.body.replaceChildren();
  const errors=results.flatMap(result=>result.status==='rejected'?[result.reason]:[]);
  if(errors.length)throw new AggregateError(errors,'Membership consumer cleanup failed');
});

for(const profile of nativeOwnerProfiles)describe(profile,()=>{
  it('compares unknown without coercion and evaluates receiver before search exactly once',async()=>{
    const source=`import{definePrototype}from'@proto.ui/core';
      const IDS=['vega','nova','maia','lyra','mira','luma','sera','rhea','new-york-v4'] as const;
      type Id=(typeof IDS)[number];
      function normalize(value:unknown):Id|null{
        if(value===undefined||value===null||value==='inherit')return null;
        if(value==='new-york')return 'new-york-v4';
        if(IDS.includes(value as Id))return value as Id;
        throw new Error('Unknown style');
      }
      export default definePrototype({name:'finite-membership-consumer',setup(def){
        let order='';let receivers=0;let searches=0;
        const ids=IDS;
        const receiver=()=>{order+='r';receivers++;return ids;};
        const search=()=>{order+='s';searches++;return 'vega';};
        const found=receiver().includes(search());
        const empty:Id[]=[];
        const missing=empty.includes(search());
        const hit=normalize('vega');const absent=normalize(undefined);
        const inherit=normalize('inherit');const alias=normalize('new-york');
        def.expose.method('rejectString',()=>normalize('other'));
        def.expose.method('rejectNumber',()=>normalize(1));
        def.expose.method('result',()=>({found,missing,order,receivers,searches,
          hit,absent,inherit,alias}));
        return r=>r.el('button','membership');
      }});`;
    const owner=await mountNativeOwner(source,profile);
    cleanups.push(owner.dispose);
    expect(owner.handle.getExposes().result()).toEqual({found:true,missing:false,order:'rss',
      receivers:1,searches:2,hit:'vega',absent:null,inherit:null,alias:'new-york-v4'});
    const api=owner.handle.getExposes();
    expect(()=>api.rejectString()).toThrow('Unknown style');
    expect(()=>api.rejectNumber()).toThrow('Unknown style');
  });
});
