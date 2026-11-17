// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  const results = await Promise.allSettled(
    cleanups
      .splice(0)
      .reverse()
      .map((dispose) => dispose())
  );
  document.body.replaceChildren();
  const errors = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  if (errors.length) throw new AggregateError(errors, 'Default-parameter consumer cleanup failed');
});

const source = `import{definePrototype}from'@proto.ui/core';
  function moduleRun(fallback:()=>number,first:number=fallback(),last:number){return first+last;}
  export default definePrototype({name:'non-trailing-default-consumer',setup(def){
    let moduleDefaults=0;let localDefaults=0;let dormantDefaults=0;
    const moduleFallback=()=>{moduleDefaults++;return 7;};
    const localFallback=()=>{localDefaults++;return 7;};
    const dormantFallback=()=>{dormantDefaults++;return 7;};
    const localRun=(first:number=localFallback(),last:number)=>first+last;
    const accepted:(first:number|undefined,last:number)=>number=localRun;
    const moduleProvided=moduleRun(moduleFallback,2,3);
    const moduleAfterProvided=moduleDefaults;
    const moduleDefaulted=moduleRun(moduleFallback,undefined,3);
    const localProvided=accepted(2,3);
    const localAfterProvided=localDefaults;
    const localDefaulted=accepted(undefined,3);
    const dormant=(first:number=dormantFallback(),last:number)=>first+last;
    const alias=dormant;
    def.expose.value('result',{
      moduleProvided,moduleAfterProvided,moduleDefaulted,moduleDefaults,
      localProvided,localAfterProvided,localDefaulted,localDefaults,
      same:dormant===alias,dormantDefaults
    });
    return r=>r.el('output','ordinary default parameter consumer');
  }});`;

for (const profile of nativeOwnerProfiles)
  it(`preserves supplied, undefined and uninvoked default behavior in ordinary ${profile}`, async () => {
    const owner = await mountNativeOwner(source, profile);
    cleanups.push(owner.dispose);
    expect(owner.handle.getExposes().result).toEqual({
      moduleProvided: 5,
      moduleAfterProvided: 0,
      moduleDefaulted: 10,
      moduleDefaults: 1,
      localProvided: 5,
      localAfterProvided: 0,
      localDefaulted: 10,
      localDefaults: 1,
      same: true,
      dormantDefaults: 0,
    });
  });
